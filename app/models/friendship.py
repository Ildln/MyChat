from datetime import UTC, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Friendship(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_a_id: int
    user_b_id: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
