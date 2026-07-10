from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import JobDescription
from app.schemas.schemas import (
    JobDescriptionCreate,
    JobDescriptionUpdate,
    JobDescriptionResponse
)
from app.core.security import get_current_user
from app.core.security import get_current_admin
from app.models.models import User
router = APIRouter(prefix="/job-descriptions",tags=["Job Descriptions"])

@router.post("/create_job_description",response_model=JobDescriptionResponse,status_code=status.HTTP_201_CREATED)
def create_job_description(job: JobDescriptionCreate,db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):

    new_job = JobDescription(user_id=current_user.id, **job.model_dump())

    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job

@router.get("/display_jobs",response_model=list[JobDescriptionResponse])
def get_all_job_descriptions(db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):

    jobs = db.query(JobDescription).filter(JobDescription.user_id == current_user.id).all()

    return jobs

@router.get("/display_job_description/{job_id}",response_model=JobDescriptionResponse)
def get_job_description(job_id: int,db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):

    job = (db.query(JobDescription).filter(JobDescription.id == job_id, JobDescription.user_id == current_user.id).first())

    if not job:
        
        raise HTTPException(status_code=404,detail="Job Description not found")

    return job

@router.put("/update_job_description/{job_id}",response_model=JobDescriptionResponse)
def update_job_description(job_id: int,updated_job: JobDescriptionUpdate,db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):

    job = (db.query(JobDescription).filter(JobDescription.id == job_id,JobDescription.user_id == current_user.id).first())

    if not job:
        raise HTTPException(status_code=404,detail="Job Description not found")

    update_data = updated_job.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(job, key, value)

    db.commit()
    db.refresh(job)

    return job

@router.delete("/delete_job_description/{job_id}")
def delete_job_description(job_id: int,db: Session = Depends(get_db),admin: User = Depends(get_current_admin)):

    job = (db.query(JobDescription).filter(JobDescription.id == job_id).first())

    if not job:
        raise HTTPException(status_code=404,detail="Job Description not found")

    db.delete(job)
    db.commit()

    return {"message": "Job Description deleted successfully"}