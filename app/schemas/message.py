from datetime import datetime
from pydantic import BaseModel


class MessageCreate(BaseModel):
    user_id: int
    text: str
    room: str


class ChatMessageCreate(BaseModel):
    text: str


class MessageRead(BaseModel):
    id: int
    user_id: int
    text: str
    room: str
    chat_id: int | None = None
    created_at: datetime


class ChatMessageRead(BaseModel):
    id: int
    chat_id: int
    user_id: int
    text: str
    created_at: datetime
