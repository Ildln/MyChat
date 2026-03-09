from datetime import datetime

from pydantic import BaseModel


class FriendRequestCreate(BaseModel):
    to_user_id: int


class FriendRequestRead(BaseModel):
    id: int
    from_user_id: int
    to_user_id: int
    status: str
    created_at: datetime
