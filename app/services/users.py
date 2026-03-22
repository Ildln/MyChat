from datetime import datetime, timezone

from sqlmodel import Session, select
from fastapi import HTTPException

from app.models.user import User
from app.schemas.user import UserCreate, UserRead
from app.services.ws_manager import manager


def create_user(session: Session, payload: UserCreate) -> User:
    existing = session.exec(
        select(User).where(User.username == payload.username)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="username already exists")

    user = User(username=payload.username)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def get_users(session: Session) -> list[User]:
    return session.exec(select(User)).all()


def touch_user(session: Session, user: User) -> User:
    user.last_seen_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def build_user_read(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        username=user.username,
        avatar_url=user.avatar_url,
        about=user.about,
        last_seen_at=user.last_seen_at,
        is_online=manager.is_user_online(user.id),
    )
