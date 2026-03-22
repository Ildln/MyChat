from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db import get_session
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.users import create_user, get_users
from app.services.users import build_user_read

router = APIRouter(prefix="/users", tags=["users"])

@router.post("", response_model=UserRead)
def create_user_endpoint(payload: UserCreate, session: Session = Depends(get_session)):
    payload.username = payload.username.strip()
    if not payload.username:
        raise HTTPException(status_code=400, detail="username must not be empty")
    return create_user(session, payload)

@router.get("", response_model=list[UserRead])
def get_users_endpoint(session: Session = Depends(get_session)):
    return [build_user_read(user) for user in get_users(session)]


@router.patch("/me", response_model=UserRead)
def update_me_endpoint(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if payload.about is not None:
        current_user.about = payload.about.strip() or None

    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url.strip() or None

    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return build_user_read(current_user)
