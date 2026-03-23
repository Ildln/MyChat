from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    password_hash: Optional[str] = Field(default=None)
    refresh_token_hash: Optional[str] = Field(default=None)
    refresh_token_expires_at: Optional[datetime] = Field(default=None)
    password_reset_token_hash: Optional[str] = Field(default=None)
    password_reset_expires_at: Optional[datetime] = Field(default=None)
    avatar_url: Optional[str] = Field(default=None)
    about: Optional[str] = Field(default=None)
    last_seen_at: Optional[datetime] = Field(default=None)
