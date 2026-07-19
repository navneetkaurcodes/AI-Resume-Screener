from sqlalchemy.orm import Session
from sqlalchemy import func, or_

import google.genai as genai
from google.genai import types

from app.core.config import settings
from app.models.models import User, Resume, JobDescription, CandidateScore, SkillGap

client = genai.Client(api_key=settings.gemini_api_key)

MODEL_NAME = "gemini-3.1-flash-lite"

SYSTEM_INSTRUCTION = """
You are an HR Assistant chatbot inside an AI Resume Screener platform used by recruiters.

Rules:
- Always call the right tool to fetch real data before answering anything about
  candidates, job descriptions, scores, or dashboard stats. Never invent names,
  scores, or skills that a tool did not return.
- If a tool result contains an "error" key, or an empty list, tell the recruiter
  plainly that nothing was found — do not make something up instead.
- For interview questions: call get_candidate_details (and get_job_description if a
  job is mentioned), then write technical questions based on the candidate's real
  skills.
- For hiring recommendations: base your reasoning only on the final_score,
  skill_match_percent and missing_skills a tool actually returned, and explain why.
- For general platform FAQ questions, use this knowledge:
  - Only PDF resumes can be uploaded.
  - final_score = 0.50 * tfidf_score + 0.35 * skill_match_percent + 0.15 * experience_match
    (tfidf_score = resume text similarity to the JD, skill_match_percent = % of
    required skills found in the resume, experience_match = candidate experience vs
    the JD's minimum experience).
  - Recruiters upload resumes on the Resumes page, create job descriptions on the
    Job Descriptions page, and run scoring from the Scoring page to get rankings.
- Keep answers short: use bullet points for lists of candidates/skills, and quote
  scores/percentages exactly as the tools returned them.
"""


def handle_chat(db: Session, current_user: User, message: str, history: list[dict] | None = None) -> str:
    """Main entry point called by the chatbot router."""

    # ---- Tools: plain Python functions, scoped to this user via closure ----
    # Gemini reads each function's name, type hints and docstring to know when
    # and how to call it. `db` and `current_user` are NOT visible to the model
    # since they aren't parameters — only captured from the outer scope.

    def list_job_descriptions() -> list[dict]:
        """Get every job description (opening) created by this recruiter, with title, company and required skills."""
        jobs = db.query(JobDescription).filter(JobDescription.user_id == current_user.id).all()
        return [
            {
                "id": j.id, "title": j.title, "company": j.company,
                "required_skills": j.required_skills or [],
                "preferred_skills": j.preferred_skills or [],
                "min_experience": j.min_experience,
            }
            for j in jobs
        ]

    def get_job_description(job_title: str) -> dict:
        """Get full details of one job description by title (partial match ok): full text, required/preferred skills, min experience."""
        job = (
            db.query(JobDescription)
            .filter(JobDescription.user_id == current_user.id, JobDescription.title.ilike(f"%{job_title}%"))
            .first()
        )
        if not job:
            return {"error": f"No job description found matching '{job_title}'"}
        return {
            "id": job.id, "title": job.title, "company": job.company,
            "description": job.description,
            "required_skills": job.required_skills or [],
            "preferred_skills": job.preferred_skills or [],
            "min_experience": job.min_experience,
        }

    def list_all_candidates(limit: int = 50) -> list[dict]:
        """List all candidates/resumes uploaded by this recruiter, most recent first. Use for 'show all candidates', 'how many resumes uploaded' etc."""
        resumes = (
            db.query(Resume)
            .filter(Resume.uploaded_by == current_user.id)
            .order_by(Resume.uploaded_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id, "candidate_name": r.candidate_name, "email": r.email,
                "experience_years": r.experience_years, "skills": r.extracted_skills or [],
                "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else None,
            }
            for r in resumes
        ]

    def search_candidates(keyword: str) -> list[dict]:
        """Search candidates by name, email, or a skill keyword (e.g. 'Docker'). Use for 'find candidate X' or 'who knows Y'."""
        kw = f"%{keyword}%"
        resumes = (
            db.query(Resume)
            .filter(
                Resume.uploaded_by == current_user.id,
                or_(Resume.candidate_name.ilike(kw), Resume.email.ilike(kw)),
            )
            .all()
        )
        if not resumes:
            all_resumes = db.query(Resume).filter(Resume.uploaded_by == current_user.id).all()
            resumes = [
                r for r in all_resumes
                if r.extracted_skills and any(keyword.lower() in s.lower() for s in r.extracted_skills)
            ]
        return [
            {"id": r.id, "candidate_name": r.candidate_name, "email": r.email,
             "experience_years": r.experience_years, "skills": r.extracted_skills or []}
            for r in resumes
        ]

    def get_candidate_details(candidate_name: str) -> dict:
        """Get one candidate's full profile by name (partial match): experience, education, skills, and every score they have across job descriptions."""
        resume = (
            db.query(Resume)
            .filter(Resume.uploaded_by == current_user.id, Resume.candidate_name.ilike(f"%{candidate_name}%"))
            .first()
        )
        if not resume:
            return {"error": f"No candidate found matching '{candidate_name}'"}

        scores = (
            db.query(CandidateScore, JobDescription.title)
            .join(JobDescription, CandidateScore.jd_id == JobDescription.id)
            .filter(CandidateScore.resume_id == resume.id)
            .all()
        )
        return {
            "candidate_name": resume.candidate_name,
            "email": resume.email,
            "phone": resume.phone,
            "experience_years": resume.experience_years,
            "education": resume.education,
            "job_titles": resume.job_titles or [],
            "skills": resume.extracted_skills or [],
            "scores": [
                {"job_title": title, "final_score": s.final_score, "tfidf_score": s.tfidf_score,
                 "skill_match_percent": s.skill_match_percent, "rank": s.rank}
                for s, title in scores
            ],
        }

    def get_top_candidates(job_title: str, limit: int = 5) -> list[dict]:
        """Get top-ranked candidates for a job description, sorted by final_score descending."""
        job = (
            db.query(JobDescription)
            .filter(JobDescription.user_id == current_user.id, JobDescription.title.ilike(f"%{job_title}%"))
            .first()
        )
        if not job:
            return [{"error": f"No job description found matching '{job_title}'"}]

        rows = (
            db.query(CandidateScore, Resume.candidate_name, Resume.email)
            .join(Resume, CandidateScore.resume_id == Resume.id)
            .filter(CandidateScore.jd_id == job.id)
            .order_by(CandidateScore.final_score.desc())
            .limit(limit)
            .all()
        )
        return [
            {"candidate_name": name, "email": email, "final_score": s.final_score,
             "skill_match_percent": s.skill_match_percent, "rank": s.rank}
            for s, name, email in rows
        ]

    def get_skill_gap(candidate_name: str, job_title: str) -> dict:
        """Get which required skills a candidate matched vs missed for a specific job description."""
        resume = (
            db.query(Resume)
            .filter(Resume.uploaded_by == current_user.id, Resume.candidate_name.ilike(f"%{candidate_name}%"))
            .first()
        )
        job = (
            db.query(JobDescription)
            .filter(JobDescription.user_id == current_user.id, JobDescription.title.ilike(f"%{job_title}%"))
            .first()
        )
        if not resume or not job:
            return {"error": "Candidate or job description not found"}

        gap = (
            db.query(SkillGap)
            .filter(SkillGap.resume_id == resume.id, SkillGap.jd_id == job.id)
            .first()
        )
        if not gap:
            return {"error": f"{resume.candidate_name} has not been scored against '{job.title}' yet"}

        return {
            "candidate_name": resume.candidate_name,
            "job_title": job.title,
            "matched_skills": gap.matched_skills or [],
            "missing_skills": gap.missing_skills or [],
            "match_percent": gap.match_percent,
        }

    def compare_candidates(candidate_name_1: str, candidate_name_2: str) -> dict:
        """Compare two candidates side by side: experience, skills, and scores. Use for 'compare X and Y' / 'who is better'."""
        return {
            "candidate_1": get_candidate_details(candidate_name_1),
            "candidate_2": get_candidate_details(candidate_name_2),
        }

    def get_dashboard_stats() -> dict:
        """Get overall dashboard stats: total job descriptions, total resumes, total scored candidates, average score, highest score."""
        total_jobs = db.query(JobDescription).filter(JobDescription.user_id == current_user.id).count()
        total_resumes = db.query(Resume).filter(Resume.uploaded_by == current_user.id).count()
        total_scores = (
            db.query(CandidateScore).join(JobDescription)
            .filter(JobDescription.user_id == current_user.id).count()
        )
        avg_score = (
            db.query(func.avg(CandidateScore.final_score)).join(JobDescription)
            .filter(JobDescription.user_id == current_user.id).scalar()
        )
        highest = (
            db.query(CandidateScore).join(JobDescription)
            .filter(JobDescription.user_id == current_user.id)
            .order_by(CandidateScore.final_score.desc()).first()
        )
        return {
            "total_job_descriptions": total_jobs,
            "total_resumes": total_resumes,
            "total_scored_candidates": total_scores,
            "average_score": round(avg_score or 0, 2),
            "highest_score": highest.final_score if highest else 0,
        }

    tools = [
        list_job_descriptions, get_job_description, list_all_candidates,
        search_candidates, get_candidate_details, get_top_candidates,
        get_skill_gap, compare_candidates, get_dashboard_stats,
    ]

    # ---- Build the conversation: past turns + the new message ----
    contents = []
    for h in history or []:
        role = "user" if h.get("role") == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=h.get("text", ""))]))
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            tools=tools,          # SDK auto-calls these when Gemini asks for them
            temperature=0.3,
        ),
    )

    return response.text or "Sorry, I couldn't generate a response for that."