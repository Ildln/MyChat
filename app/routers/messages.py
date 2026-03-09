from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.schemas.message import MessageCreate, MessageRead
from app.services.messages import save_message, get_room_history

router = APIRouter(prefix="/messages", tags=["messages"])

@router.post("", response_model=MessageRead)
def send_message(payload: MessageCreate, session: Session = Depends(get_session)):
    return save_message(session, payload)

@router.get("", response_model=list[MessageRead])
def get_messages(room: str, limit: int = 30, session: Session = Depends(get_session)):
    return get_room_history(session, room=room, limit=limit)