from sqlalchemy.orm import Session

from app.models.models import CandidateScore



def update_candidate_ranks(job_id: int, db: Session):
    """
    Assign ranks to all candidates for a job
    based on final_score.
    """

    scores = (
        db.query(CandidateScore)
        .filter(CandidateScore.jd_id == job_id)
        .order_by(CandidateScore.final_score.desc())
        .all()
    )

    for rank, score in enumerate(scores, start=1):
        score.rank = rank

    db.commit()

    return scores

