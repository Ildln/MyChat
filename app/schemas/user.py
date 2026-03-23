from datetime import datetime

from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str


class UserRead(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    about: str | None = None
    last_seen_at: datetime | None = None
    is_online: bool = False
    two_factor_enabled: bool = False


class UserUpdate(BaseModel):
    avatar_url: str | None = None
    about: str | None = None
