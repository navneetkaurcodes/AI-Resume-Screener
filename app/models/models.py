# models.py

from sqlalchemy import (
    Column, Integer, String, Float, 
    Text, ARRAY, TIMESTAMP, ForeignKey, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


# TABLE 1: users
# Stores everyone who logs into the system (HR managers)
class User(Base):
    __tablename__ = 'users'   # tbale name in PostgreSQL

    id             = Column(Integer, primary_key=True, index=True)  # auto-incrementing ID
    email          = Column(String(255), unique=True, nullable=False)  # must be unique
    hashed_password= Column(String(255), nullable=False)  # passwords save in hash form
    full_name      = Column(String(255)) # name of the HR
    role           = Column(String(50), default='hr_manager') 
    created_at     = Column(TIMESTAMP, default=datetime.utcnow) 

    # "A user can have many resumes" and "a user can have many job descriptions"
    # back_populates= establish a bidirectional relationship between two models
    resumes = relationship("Resume",back_populates="uploader",cascade="all, delete-orphan")
    job_descriptions = relationship("JobDescription",back_populates="creator",cascade="all, delete-orphan")


# TABLE 2: job_descriptions
# Stores every job posting the HR manager creates
# e.g. "Senior Python Developer at Infosys, needs Docker, FastAPI..."

class JobDescription(Base):
    __tablename__ = 'job_descriptions'

    id              = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer,ForeignKey("users.id", ondelete="CASCADE"),nullable=False)  # which HR created this JD
    title           = Column(String(255), nullable=False ,index=True)       # "Senior Python Developer"
    company         = Column(String(255),index=True)                       # "Infosys"
    description     = Column(Text, nullable=False)              # full job description text
    required_skills = Column(ARRAY(String))   # ['python', 'docker', 'fastapi']
    preferred_skills= Column(ARRAY(String))   # ['kubernetes', 'redis']
    min_experience  = Column(Integer)         # 3 (meaning 3 years)
    created_at      = Column(TIMESTAMP, default=datetime.utcnow)

    # Link back: "this JD was created by one user"
    creator = relationship('User', back_populates='job_descriptions')
    scores = relationship("CandidateScore",back_populates="job_description",cascade="all, delete-orphan")

    skill_gaps = relationship("SkillGap",back_populates="job_description",cascade="all, delete-orphan")


# TABLE 3: resumes
# Stores every uploaded PDF resume
# After PDF is uploaded, we extract name/email/skills from it and save here

class Resume(Base):
    __tablename__ = 'resumes'

    id              = Column(Integer, primary_key=True, index=True)
    candidate_name  = Column(String(255),index=True)    # extracted from resume text
    email           = Column(String(255),index=True)    # extracted from PDF by regex
    phone           = Column(String(50))     # extracted from PDF by regex
    pdf_filename    = Column(String(500), nullable=False)  # saved filename
    pdf_path        = Column(String(1000))   # full path: ./uploads/uuid_filename.pdf
    raw_text        = Column(Text)           # all text extracted from the PDF
    extracted_skills= Column(ARRAY(String))  # ['python', 'react', 'docker']
    education       = Column(JSON)           # {"degree": "B.Tech", "college": "..."}
    experience_years= Column(Float)          # 3.5
    job_titles      = Column(ARRAY(String))  # ['Software Engineer', 'Backend Dev']
    uploaded_by     = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"),nullable=False)
    uploaded_at     = Column(TIMESTAMP, default=datetime.utcnow)

    # Link back: "this resume was uploaded by one user"
    uploader = relationship('User', back_populates='resumes')

    scores = relationship("CandidateScore",back_populates="resume",cascade="all, delete-orphan")

    skill_gaps = relationship("SkillGap",back_populates="resume",cascade="all, delete-orphan")


# ─────────────────────────────────────────
# TABLE 4: candidate_scores
# stores the match score for every resume+JD pair
# e.g. "Raj's resume scored 78/100 for the Python Dev job at Infosys"
# ─────────────────────────────────────────
class CandidateScore(Base):
    __tablename__ = 'candidate_scores'

    # UniqueConstraint means: one resume can only be scored once per JD
    # If you try to score the same pair again, it updates instead of duplicating
    __table_args__ = (UniqueConstraint('resume_id', 'jd_id',name="uq_candidate_scores_resume_jd"),)

    id                = Column(Integer, primary_key=True)
    resume_id         = Column(Integer, ForeignKey('resumes.id', ondelete="CASCADE"),nullable=False)
    jd_id             = Column(Integer, ForeignKey('job_descriptions.id', ondelete="CASCADE"),nullable=False)
    tfidf_score       = Column(Float)   # 0-100: how well resume TEXT matches JD text
    skill_match_percent= Column(Float)  # 0-100: % of required skills found in resume
    final_score       = Column(Float)   # (0.50 × tfidf) + (0.35 × skill_match) + (0.15 × experience_match)
    rank              = Column(Integer) # 1st, 2nd, 3rd... among all candidates for this JD
    scored_at         = Column(TIMESTAMP, default=datetime.utcnow)

    resume = relationship("Resume", back_populates="scores")
    job_description = relationship("JobDescription", back_populates="scores")


# ─────────────────────────────────────────
# TABLE 5: skill_gaps
# Stores WHICH skills matched and which are missing
# e.g. "Raj has Python ✓, Docker ✓, but missing Kubernetes ✗, Redis ✗"
# ─────────────────────────────────────────
class SkillGap(Base):
    __tablename__ = 'skill_gaps'

    __table_args__ = (UniqueConstraint('resume_id', 'jd_id', name="uq_skill_gaps_resume_jd"),)

    id             = Column(Integer, primary_key=True)
    resume_id      = Column(Integer, ForeignKey('resumes.id', ondelete="CASCADE"),nullable=False)
    jd_id          = Column(Integer, ForeignKey('job_descriptions.id', ondelete="CASCADE"),nullable=False)
    matched_skills = Column(ARRAY(String))  # ['python', 'docker']
    missing_skills = Column(ARRAY(String))  # ['kubernetes', 'redis']
    match_percent  = Column(Float)          # 50.0 (2 out of 4 skills matched)

    resume = relationship("Resume", back_populates="skill_gaps")
    job_description = relationship("JobDescription", back_populates="skill_gaps")
