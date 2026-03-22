from datetime import UTC, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class PushSubscription(SQLModel, table=True):
    __tablename__ = "push_subscription"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int
    endpoint: str
    p256dh: str
    auth: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
