from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserRead


class DirectChatCreate(BaseModel):
    user_id: int


class ChatRead(BaseModel):
    id: int
    type: str
    created_at: datetime
    members: list[UserRead]
