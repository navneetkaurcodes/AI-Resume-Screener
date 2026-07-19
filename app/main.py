from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers.job_description import router as job_router
from app.routers.user import router as user_router
from app.routers.resume import router as resume_router
from app.routers.scoring import router as scoring_router
from app.routers.auth import router as auth_router
from app.routers.dashboard import router as dashboard_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.include_router(job_router)
app.include_router(user_router)
app.include_router(resume_router)
app.include_router(scoring_router)
app.include_router(auth_router)
app.include_router(dashboard_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "AI Resume Screener API"}


@app.get("/test-db")
def test_db(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {
        "message": "Database Connected Successfully"
    }