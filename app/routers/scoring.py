from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.security import get_current_admin
from app.services.ranking_service import update_candidate_ranks
from app.models.models import (
    User,
    Resume,
    JobDescription,
    CandidateScore,
    SkillGap
)

from app.services.scoring_service import (
    calculate_tfidf_score,
    calculate_skill_match,
    calculate_experience_match,
    calculate_final_score
)

router = APIRouter(
    prefix="/scoring",
    tags=["AI Scoring"]
)


@router.post("/score_candidate/{resume_id}/{job_id}")
def score_resume(
    resume_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    resume = (
        db.query(Resume)
        .filter(
            Resume.id == resume_id,
            Resume.uploaded_by == current_user.id
        )
        .first()
    )

    if not resume:
        raise HTTPException(
            status_code=404,
            detail="Resume not found or access denied."
        )

    job = (
        db.query(JobDescription)
        .filter(
            JobDescription.id == job_id,
            JobDescription.user_id == current_user.id
        )
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job Description not found or access denied."
        )

    tfidf_score = calculate_tfidf_score(
        job.description,
        resume.raw_text
    )

    skill_percent, matched, missing = calculate_skill_match(
        job.required_skills,
        resume.extracted_skills
    )

    experience_score = calculate_experience_match(
        job.min_experience,
        resume.experience_years
    )

    final_score = calculate_final_score(
        tfidf_score,
        skill_percent,
        experience_score
    )

    score = (
        db.query(CandidateScore)
        .filter(
            CandidateScore.resume_id == resume.id,
            CandidateScore.jd_id == job.id
        )
        .first()
    )

    if score:
        score.tfidf_score = float(tfidf_score)
        score.skill_match_percent = float(skill_percent)
        score.final_score = float(final_score)
    else:
        score = CandidateScore(
            resume_id=resume.id,
            jd_id=job.id,
            tfidf_score=float(tfidf_score),
            skill_match_percent=float(skill_percent),
            final_score=float(final_score)
        )
        db.add(score)

    gap = (
        db.query(SkillGap)
        .filter(
            SkillGap.resume_id == resume.id,
            SkillGap.jd_id == job.id
        )
        .first()
    )

    if gap:
        gap.matched_skills = matched
        gap.missing_skills = missing
        gap.match_percent = skill_percent
    else:
        gap = SkillGap(
            resume_id=resume.id,
            jd_id=job.id,
            matched_skills=matched,
            missing_skills=missing,
            match_percent=skill_percent
        )
        db.add(gap)

    db.commit()
    update_candidate_ranks(job.id, db)

    return {
        "resume_id": resume.id,
        "job_id": job.id,
        "tfidf_score": tfidf_score,
        "skill_match": skill_percent,
        "experience_score": experience_score,
        "final_score": final_score,
        "matched_skills": matched,
        "missing_skills": missing
    }


@router.get("/ranking/{job_id}")
def get_candidate_ranking(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    job = (
        db.query(JobDescription)
        .filter(
            JobDescription.id == job_id,
            JobDescription.user_id == current_user.id
        )
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job Description not found or access denied."
        )

    rankings = (
        db.query(CandidateScore)
        .filter(CandidateScore.jd_id == job.id)
        .order_by(CandidateScore.rank)
        .all()
    )

    return rankings


@router.get("/top/{job_id}")
def top_candidates(
    job_id: int,
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    job = (
        db.query(JobDescription)
        .filter(
            JobDescription.id == job_id,
            JobDescription.user_id == current_user.id
        )
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job Description not found or access denied."
        )

    scores = (
        db.query(CandidateScore)
        .filter(CandidateScore.jd_id == job.id)
        .order_by(CandidateScore.final_score.desc())
        .limit(limit)
        .all()
    )

    return scores


@router.get("/candidate/{resume_id}/{job_id}")
def candidate_result(
    resume_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    job = (
        db.query(JobDescription)
        .filter(
            JobDescription.id == job_id,
            JobDescription.user_id == current_user.id
        )
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job Description not found or access denied."
        )

    score = (
        db.query(CandidateScore)
        .filter(
            CandidateScore.resume_id == resume_id,
            CandidateScore.jd_id == job.id
        )
        .first()
    )

    gap = (
        db.query(SkillGap)
        .filter(
            SkillGap.resume_id == resume_id,
            SkillGap.jd_id == job.id
        )
        .first()
    )

    return {
        "score": score,
        "skill_gap": gap
    }


@router.post("/admin_scoring/score_candidate/{resume_id}/{job_id}")
def admin_score_resume(
    resume_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
 
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
 
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")
 
    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
 
    if not job:
        raise HTTPException(status_code=404, detail="Job Description not found.")
 
    tfidf_score = calculate_tfidf_score(
        job.description,
        resume.raw_text
    )
 
    skill_percent, matched, missing = calculate_skill_match(
        job.required_skills,
        resume.extracted_skills
    )
 
    experience_score = calculate_experience_match(
        job.min_experience,
        resume.experience_years
    )
 
    final_score = calculate_final_score(
        tfidf_score,
        skill_percent,
        experience_score
    )
 
    score = (
        db.query(CandidateScore)
        .filter(
            CandidateScore.resume_id == resume.id,
            CandidateScore.jd_id == job.id
        )
        .first()
    )

    if score:
        score.tfidf_score = float(tfidf_score)
        score.skill_match_percent = float(skill_percent)
        score.final_score = float(final_score)
    else:
        score = CandidateScore(
            resume_id=resume.id,
            jd_id=job.id,
            tfidf_score=float(tfidf_score),
            skill_match_percent=float(skill_percent),
            final_score=float(final_score)
        )
        db.add(score)

    gap = (
        db.query(SkillGap)
        .filter(
            SkillGap.resume_id == resume.id,
            SkillGap.jd_id == job.id
        )
        .first()
    )

    if gap:
        gap.matched_skills = matched
        gap.missing_skills = missing
        gap.match_percent = skill_percent
    else:
        gap = SkillGap(
            resume_id=resume.id,
            jd_id=job.id,
            matched_skills=matched,
            missing_skills=missing,
            match_percent=skill_percent
        )
        db.add(gap)

    db.commit()
    update_candidate_ranks(job.id, db)
 
    return {
        "resume_id": resume.id,
        "job_id": job.id,
        "tfidf_score": tfidf_score,
        "skill_match": skill_percent,
        "experience_score": experience_score,
        "final_score": final_score,
        "matched_skills": matched,
        "missing_skills": missing
    }
 
 
@router.get("/admin_scoring/ranking/{job_id}")
def admin_get_candidate_ranking(
    job_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
 
    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
 
    if not job:
        raise HTTPException(status_code=404, detail="Job Description not found.")
 
    rankings = (
        db.query(CandidateScore)
        .filter(CandidateScore.jd_id == job.id)
        .order_by(CandidateScore.rank)
        .all()
    )
 
    return rankings
 
 
@router.get("/admin_scoring/top/{job_id}")
def admin_top_candidates(
    job_id: int,
    limit: int = 5,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
 
    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
 
    if not job:
        raise HTTPException(status_code=404, detail="Job Description not found.")
 
    scores = (
        db.query(CandidateScore)
        .filter(CandidateScore.jd_id == job.id)
        .order_by(CandidateScore.final_score.desc())
        .limit(limit)
        .all()
    )
 
    return scores
 
 
@router.get("/admin_scoring/candidate/{resume_id}/{job_id}")
def admin_candidate_result(
    resume_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
 
    job = db.query(JobDescription).filter(JobDescription.id == job_id).first()
 
    if not job:
        raise HTTPException(status_code=404, detail="Job Description not found.")
 
    score = (
        db.query(CandidateScore)
        .filter(
            CandidateScore.resume_id == resume_id,
            CandidateScore.jd_id == job.id
        )
        .first()
    )
 
    gap = (
        db.query(SkillGap)
        .filter(
            SkillGap.resume_id == resume_id,
            SkillGap.jd_id == job.id
        )
        .first()
    )
 
    return {
        "score": score,
        "skill_gap": gap
    }
 
