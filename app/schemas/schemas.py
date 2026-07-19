# schemas.py

from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime


# ==========================================================
# USER SCHEMAS
# ==========================================================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str
    admin_code: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str]
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    full_name: Optional[str] = None


# ==========================================================
# JOB DESCRIPTION SCHEMAS
# ==========================================================

class JobDescriptionCreate(BaseModel):
    title: str
    company: Optional[str] = None
    description: str
    required_skills: List[str]
    preferred_skills: Optional[List[str]] = []
    min_experience: Optional[int] = 0


class JobDescriptionUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[List[str]] = None
    preferred_skills: Optional[List[str]] = None
    min_experience: Optional[int] = None


class JobDescriptionResponse(BaseModel):
    id: int
    user_id: int
    title: str
    company: Optional[str]
    description: str
    required_skills: List[str]
    preferred_skills: Optional[List[str]]
    min_experience: Optional[int]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# RESUME SCHEMAS
# ==========================================================

class ResumeCreate(BaseModel):
    candidate_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    experience_years: Optional[float] = None
    extracted_skills: Optional[List[str]] = []
    education: Optional[Dict] = None
    job_titles: Optional[List[str]] = []


class ResumeUpdate(BaseModel):
    candidate_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    experience_years: Optional[float] = None
    extracted_skills: Optional[List[str]] = None
    education: Optional[Dict] = None
    job_titles: Optional[List[str]] = None


class ResumeResponse(BaseModel):
    id: int
    candidate_name: Optional[str]
    email: Optional[EmailStr]
    phone: Optional[str]
    pdf_filename: str
    pdf_path: Optional[str]
    raw_text: Optional[str]
    extracted_skills: Optional[List[str]]
    education: Optional[Dict]
    experience_years: Optional[float]
    job_titles: Optional[List[str]]
    uploaded_by: int
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# CANDIDATE SCORE SCHEMAS
# ==========================================================

class CandidateScoreResponse(BaseModel):
    id: int
    resume_id: int
    jd_id: int
    tfidf_score: Optional[float]
    skill_match_percent: Optional[float]
    final_score: Optional[float]
    rank: Optional[int]
    scored_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# SKILL GAP SCHEMAS
# ==========================================================

class SkillGapResponse(BaseModel):
    id: int
    resume_id: int
    jd_id: int
    matched_skills: Optional[List[str]]
    missing_skills: Optional[List[str]]
    match_percent: Optional[float]

    model_config = ConfigDict(from_attributes=True)


# ==========================================================
# AUTH SCHEMAS
# ==========================================================

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None


# ==========================================================
# CHATBOT SCHEMAS
# ==========================================================

class ChatMessage(BaseModel):
    role: str   # "user" or "model"
    text: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    reply: str