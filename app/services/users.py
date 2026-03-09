from sqlmodel import Session, select
from fastapi import HTTPException

from app.models.user import User
from app.schemas.user import UserCreate


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