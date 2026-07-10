from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.security import get_current_admin
from app.models.models import (
    User,
    Resume,
    JobDescription,
    CandidateScore
)

router = APIRouter(prefix="/dashboard",tags=["Dashboard"])

@router.get("/hr_manager")
def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    total_jobs = (
        db.query(JobDescription)
        .filter(JobDescription.user_id == current_user.id)
        .count()
    )

    total_resumes = (
        db.query(Resume)
        .filter(Resume.uploaded_by == current_user.id)
        .count()
    )

    total_scores = (
        db.query(CandidateScore)
        .join(JobDescription)
        .filter(JobDescription.user_id == current_user.id)
        .count()
    )

    average_score = (
        db.query(func.avg(CandidateScore.final_score))
        .join(JobDescription)
        .filter(JobDescription.user_id == current_user.id)
        .scalar()
    )

    highest_score = (
        db.query(CandidateScore)
        .join(JobDescription)
        .filter(JobDescription.user_id == current_user.id)
        .order_by(CandidateScore.final_score.desc())
        .first()
    )

    return {
        "total_jobs": total_jobs,
        "total_resumes": total_resumes,
        "total_scored_candidates": total_scores,
        "average_score": round(average_score or 0, 2),
        "highest_score": highest_score.final_score if highest_score else 0
    }

@router.get("/admin")
def admin_dashboard(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):

    total_users = (
        db.query(User)
        .count()
    )

    total_jobs = (
        db.query(JobDescription)
        .count()
    )

    total_resumes = (
        db.query(Resume)
        .count()
    )

    total_scores = (
        db.query(CandidateScore)
        .count()
    )

    average_score = (
        db.query(func.avg(CandidateScore.final_score))
        .scalar()
    )

    highest_score = (
        db.query(CandidateScore)
        .order_by(CandidateScore.final_score.desc())
        .first()
    )

    return {
        "total_users": total_users,
        "total_jobs": total_jobs,
        "total_resumes": total_resumes,
        "total_scored_candidates": total_scores,
        "average_score": round(average_score or 0, 2),
        "highest_score": highest_score.final_score if highest_score else 0
    }