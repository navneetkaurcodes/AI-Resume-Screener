# models.py

#sqlalchemy: used to create the database models
#column: used to define a column in a table
#integer: used to define an integer column
#string: used to define a string column
#float: used to define a float column
#text: used to define a text column
#array: used to define an array column
#timestamp: used to define a timestamp column
#foreignkey: used to define a foreign key column
#json: used to define a json column
#uniqueconstraint: used to define a unique constraint on a table
from sqlalchemy import (Column, Integer, String, Float, Text, ARRAY, TIMESTAMP, ForeignKey, JSON, UniqueConstraint)

#relationship: used to define a relationship between two tables
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


#TABLE 1: users
#Stores everyone who logs into the system (HR managers / Admins)
class User(Base):
    #__tablename__: used to define the name of the table in the database
    __tablename__ = 'users'   

    id             = Column(Integer, primary_key=True, index=True)  #id auto-incremented primary key
    email          = Column(String(255), unique=True, nullable=False)  #email address of the user, unique and not null
    hashed_password= Column(String(255), nullable=False)  #hashed password of the user, not null
    full_name      = Column(String(255)) #full name of the user
    role           = Column(String(50), default='hr_manager') #role of the user, default is 'hr_manager', can be 'admin' or 'hr_manager'
    created_at     = Column(TIMESTAMP, default=datetime.utcnow) #timestamp of when the user was created, default is current time

    # "A user can have many resumes" and "a user can have many job descriptions"
    #relationship: used to define a relationship between two tables
    # back_populates= establish a bidirectional relationship between two models
    #cascade= "all, delete-orphan" means that when a parent object is deleted, all its related child objects will also be deleted. "delete-orphan" means that if a child object is no longer associated with a parent, it will be automatically deleted from the database.
    resumes = relationship("Resume",back_populates="uploader",cascade="all, delete-orphan")
    job_descriptions = relationship("JobDescription",back_populates="creator",cascade="all, delete-orphan")


# TABLE 2: job_descriptions
# Stores every job posting the HR manager creates
# e.g. "Senior Python Developer at Infosys, needs Docker, FastAPI..."
class JobDescription(Base):
    #__tablename__: used to define the name of the table in the database
    __tablename__ = 'job_descriptions'

    id              = Column(Integer, primary_key=True, index=True)  #id auto-incremented primary key
    user_id = Column(Integer,ForeignKey("users.id", ondelete="CASCADE"),nullable=False)  #foreign key to the users table, not null, on delete cascade
    title           = Column(String(255), nullable=False ,index=True)     #title of the job description, not null, indexed
    company         = Column(String(255),index=True)      #company name, indexed
    description     = Column(Text, nullable=False)      #detailed description of the job, not null       
    required_skills = Column(ARRAY(String))    #array of required skills for the job, e.g. ["Python", "Docker", "FastAPI"]
    preferred_skills= Column(ARRAY(String))   #array of preferred skills for the job, e.g. ["Kubernetes", "Redis"]
    min_experience  = Column(Integer)        #minimum years of experience required for the job
    created_at      = Column(TIMESTAMP, default=datetime.utcnow)  #timestamp of when the job description was created, default is current time

    #creator: relationship to the User model, back_populates to establish a bidirectional relationship with the job_descriptions attribute in the User model
    creator = relationship('User', back_populates='job_descriptions')

    scores = relationship("CandidateScore",back_populates="job_description",cascade="all, delete-orphan")
    skill_gaps = relationship("SkillGap",back_populates="job_description",cascade="all, delete-orphan")


# TABLE 3: resumes
# Stores every uploaded PDF resume
# After PDF is uploaded, extract name/email/skills from it and save here
class Resume(Base):
    #__tablename__: used to define the name of the table in the database
    __tablename__ = 'resumes'

    id              = Column(Integer, primary_key=True, index=True)  #id auto-incremented primary key
    candidate_name  = Column(String(255),index=True)    #candidate's name, indexed
    email           = Column(String(255),index=True)    #candidate's email, indexed
    phone           = Column(String(50))     #candidate's phone number
    pdf_filename    = Column(String(500), nullable=False)  #name of the uploaded PDF file
    pdf_path        = Column(String(1000))   #path to the uploaded PDF file
    raw_text        = Column(Text)           #raw text extracted from the PDF
    extracted_skills= Column(ARRAY(String))  #array of skills extracted from the resume
    education       = Column(JSON)          #candidate's education details
    experience_years= Column(Float)          #years of experience
    job_titles      = Column(ARRAY(String))  #array of job titles held
    uploaded_by     = Column(Integer, ForeignKey('users.id', ondelete="CASCADE"),nullable=False) #foreign key to the users table, not null, on delete cascade   
    uploaded_at     = Column(TIMESTAMP, default=datetime.utcnow) #timestamp of when the resume was uploaded, default is current time

    uploader = relationship('User', back_populates='resumes')

    scores = relationship("CandidateScore",back_populates="resume",cascade="all, delete-orphan")
    skill_gaps = relationship("SkillGap",back_populates="resume",cascade="all, delete-orphan")



# TABLE 4: candidate_scores
# stores the match score for every resume+JD pair
# e.g. "Nav's resume scored 78/100 for the Python Dev job at Infosys"
class CandidateScore(Base):
    #__tablename__: used to define the name of the table in the database
    __tablename__ = 'candidate_scores'
    #__table_args__: used to define a unique constraint on the combination of resume_id and jd_id, ensuring that each resume can only have one score per job description
    __table_args__ = (UniqueConstraint('resume_id', 'jd_id',name="uq_candidate_scores_resume_jd"),)

    id                = Column(Integer, primary_key=True)  #id auto-incremented primary key
    resume_id         = Column(Integer, ForeignKey('resumes.id', ondelete="CASCADE"),nullable=False)  #foreign key to the resumes table, not null, on delete cascade
    jd_id             = Column(Integer, ForeignKey('job_descriptions.id', ondelete="CASCADE"),nullable=False)  #foreign key to the job_descriptions table, not null, on delete cascade
    tfidf_score       = Column(Float)   #TF-IDF score based on the similarity between the resume and job description text
    skill_match_percent= Column(Float)  #percentage of required skills from the job description that are present in the resume
    final_score       = Column(Float)   #final score calculated based on a weighted combination of tfidf_score and skill_match_percent
    rank              = Column(Integer)  #rank of the candidate based on the final score
    scored_at         = Column(TIMESTAMP, default=datetime.utcnow) #timestamp of when the score was calculated, default is current time

    resume = relationship("Resume", back_populates="scores")
    job_description = relationship("JobDescription", back_populates="scores")


# TABLE 5: skill_gaps
# Stores WHICH skills matched and which are missing
# e.g. "Nav has Python ✓, Docker ✓, but missing Kubernetes ✗, Redis ✗"
class SkillGap(Base):
    #__tablename__: used to define the name of the table in the database
    __tablename__ = 'skill_gaps'
    #__table_args__: used to define a unique constraint on the combination of resume_id and jd_id, ensuring that each resume can only have one skill gap entry per job description
    __table_args__ = (UniqueConstraint('resume_id', 'jd_id', name="uq_skill_gaps_resume_jd"),)

    id             = Column(Integer, primary_key=True)  #id auto-incremented primary key
    resume_id      = Column(Integer, ForeignKey('resumes.id', ondelete="CASCADE"),nullable=False)  #foreign key to the resumes table, not null, on delete cascade
    jd_id          = Column(Integer, ForeignKey('job_descriptions.id', ondelete="CASCADE"),nullable=False)  #foreign key to the job_descriptions table, not null, on delete cascade
    matched_skills = Column(ARRAY(String))  #list of skills that are matched between the resume and job description
    missing_skills = Column(ARRAY(String))  #list of skills that are required by the job description but missing from the resume
    match_percent  = Column(Float)           #percentage of matched skills relative to the total number of required skills

    resume = relationship("Resume", back_populates="skill_gaps")
    job_description = relationship("JobDescription", back_populates="skill_gaps")
