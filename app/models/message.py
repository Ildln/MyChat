from typing import Optional
from datetime import datetime, UTC
from sqlmodel import SQLModel, Field


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    text: str
    room: str
    user_id: int
    chat_id: Optional[int] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
