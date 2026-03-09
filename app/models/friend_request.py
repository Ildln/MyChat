from datetime import UTC, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class FriendRequest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    from_user_id: int
    to_user_id: int
    status: str = Field(default="pending")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
