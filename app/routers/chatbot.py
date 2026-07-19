from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User
from app.schemas.schemas import ChatRequest, ChatResponse
from app.services.chatbot_service import handle_chat

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])


@router.post("/ask", response_model=ChatResponse)
def ask_chatbot(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = [h.model_dump() for h in payload.history] if payload.history else []
    reply = handle_chat(db, current_user, payload.message, history)
    return {"reply": reply}