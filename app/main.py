from fastapi import FastAPI

app = FastAPI(
    title="AI Resume Screener",
    version="1.0.0",
    description="AI-powered Resume Screening API"
)


@app.get("/")
def home():
    return {
        "message": "Welcome to AI Resume Screener API"
    }