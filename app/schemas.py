# schemas.py

# imports
from pydantic import BaseModel
from typing import List, Optional


# SCHEMAS FOR AUTH (register and login)
# register user
class RegisterSchema(BaseModel):

    email    : str   # "hr@company.com"
    password : str   # "mypassword123"  hash the password  before saving it
    full_name: str   # "Priya Sharma"

# user login
class LoginSchema(BaseModel):

    email   : str   # "hr@company.com"
    password: str   # "mypassword123"  verify against the hash password


# JOB DESCRIPTION

class JDCreateSchema(BaseModel):

    title           : str         # "Senior Python Developer"
    company         : Optional[str] = None    
    description     : str         # full job description text
    required_skills : List[str]   # ["python", "docker", "fastapi"]
    preferred_skills: Optional[List[str]] = []  # ["kubernetes"] 
    min_experience  : Optional[int] = 0         # 3 years 


class JDResponseSchema(BaseModel):

    id              : int
    title           : str
    company         : Optional[str]
    required_skills : List[str]

    
    class Config:
        from_attributes = True


# FOR RESUMES

class ResumeResponseSchema(BaseModel):

    id              : int
    candidate_name  : Optional[str] = None
    email           : Optional[str] = None
    extracted_skills: Optional[List[str]] = []
    experience_years: Optional[float] = 0.0

    class Config:
        from_attributes = True



# FOR SCORING / RANKINGS


class CandidateRankSchema(BaseModel):

    rank               : int
    resume_id          : int
    candidate_name     : Optional[str]
    email              : Optional[str]
    final_score        : float    # 0-100
    tfidf_score        : float    # 0-100
    skill_match_percent: float    # 0-100
    matched_skills     : List[str]
    missing_skills     : List[str]


class RankingsResponseSchema(BaseModel):

    jd_id           : int
    jd_title        : str
    total_candidates: int
    candidates      : List[CandidateRankSchema]   # list of all ranked candidates
