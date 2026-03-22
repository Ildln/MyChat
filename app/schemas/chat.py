from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserRead


class DirectChatCreate(BaseModel):
    user_id: int


class GroupChatCreate(BaseModel):
    title: str
    user_ids: list[int]


class ChatRead(BaseModel):
    id: int
    type: str
    title: str | None = None
    created_at: datetime
    members: list[UserRead]
