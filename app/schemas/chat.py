from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserRead


class ChatLastMessageRead(BaseModel):
    id: int
    user_id: int
    text: str
    created_at: datetime
    author_username: str
    author_avatar_url: str | None = None


class DirectChatCreate(BaseModel):
    user_id: int


class GroupChatCreate(BaseModel):
    title: str
    user_ids: list[int]


class ChatMembersAdd(BaseModel):
    user_ids: list[int]


class ChatRead(BaseModel):
    id: int
    type: str
    title: str | None = None
    created_at: datetime
    members: list[UserRead]
    unread_count: int = 0
    last_message: ChatLastMessageRead | None = None
