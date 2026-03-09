from datetime import UTC, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Chat(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    type: str = Field(default="direct")
    direct_user_a_id: Optional[int] = Field(default=None)
    direct_user_b_id: Optional[int] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
