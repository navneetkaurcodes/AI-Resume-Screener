from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Resume
from app.schemas.schemas import (ResumeCreate,ResumeUpdate,ResumeResponse)
from fastapi import UploadFile, File
from app.services.pdf_service import save_pdf
from app.services.extraction_service import extract_text_from_pdf
from app.services.parser_service import parse_resume
from app.core.security import get_current_user
from app.core.security import get_current_admin
from app.models.models import User
from sqlalchemy import or_

router = APIRouter(prefix="/resumes",tags=["Resumes"])

@router.post("/resume_create",response_model=ResumeResponse,status_code=status.HTTP_201_CREATED)
def create_resume(resume: ResumeCreate,db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):

    new_resume = Resume(uploaded_by=current_user.id,  pdf_filename="temp.pdf",pdf_path="uploads/temp.pdf",raw_text="",**resume.model_dump())

    db.add(new_resume)
    db.commit()
    db.refresh(new_resume)

    return new_resume

@router.get("/get_resumes",response_model=list[ResumeResponse])
def get_all_resumes(db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):

    return db.query(Resume).filter(Resume.uploaded_by == current_user.id).all()

@router.get("/get_resume/{resume_id}", response_model=ResumeResponse)
def get_resume(resume_id: int,db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):

    resume = (db.query(Resume).filter(Resume.id == resume_id,Resume.uploaded_by == current_user.id).first())

    if not resume:
        raise HTTPException(status_code=404,detail="Resume not found")

    return resume

@router.put("/update_resume/{resume_id}",response_model=ResumeResponse)
def update_resume(resume_id: int,updated_resume: ResumeUpdate,db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):

    resume = (db.query(Resume).filter(Resume.id == resume_id,Resume.uploaded_by == current_user.id).first())

    if not resume:
        raise HTTPException(status_code=404,detail="Resume not found")

    update_data = updated_resume.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(resume, key, value)

    db.commit()
    db.refresh(resume)

    return resume

@router.delete("/delete_resume/{resume_id}")
def delete_resume(resume_id: int,db: Session = Depends(get_db),admin: User = Depends(get_current_admin)):

    resume = (db.query(Resume).filter(Resume.id == resume_id).first())

    if not resume:
        raise HTTPException(status_code=404,detail="Resume not found")

    db.delete(resume)
    db.commit()

    return {"message": "Resume deleted successfully"}

@router.post("/upload")
def upload_resume(file: UploadFile = File(...),db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400,detail="Only PDF files are allowed.")

    filename, path = save_pdf(file)
    raw_text = extract_text_from_pdf(path)
    parsed_data = parse_resume(raw_text)

    resume = Resume(
    candidate_name=parsed_data["candidate_name"],email=parsed_data["email"],phone=parsed_data["phone"],
    extracted_skills=parsed_data["skills"],experience_years=parsed_data["experience_years"],
    education=parsed_data["education"],job_titles=parsed_data["job_titles"],
    raw_text=raw_text,pdf_filename=filename,
    pdf_path=path,uploaded_by=current_user.id)

    db.add(resume)
    db.commit()
    db.refresh(resume)

    return {"message": "Resume uploaded successfully.","resume_id": resume.id,"filename": filename}

@router.get("/search")
def search_resumes(
    candidate_name: str | None = None,
    skill: str | None = None,
    min_experience: float | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    query = db.query(Resume).filter(
        Resume.uploaded_by == current_user.id
    )

    if candidate_name:
        query = query.filter(
            Resume.candidate_name.ilike(f"%{candidate_name}%")
        )

    if min_experience:
        query = query.filter(
            Resume.experience_years >= min_experience
        )

    resumes = query.all()

    if skill:
        resumes = [
            resume for resume in resumes
            if resume.extracted_skills
            and skill.lower() in [s.lower() for s in resume.extracted_skills]
        ]

    return resumes

@router.get("/")
def get_resumes(
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    skip = (page - 1) * limit

    resumes = (
        db.query(Resume)
        .filter(Resume.uploaded_by == current_user.id)
        .offset(skip)
        .limit(limit)
        .all()
    )

    return resumes
