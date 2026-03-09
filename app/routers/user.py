from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models.user import User
from app.schemas.user import UserRead, UserCreate
from app.services.users import create_user, get_users

router = APIRouter(prefix="/users", tags=["users"])

@router.post("", response_model=UserRead)
def create_user_endpoint(payload: UserCreate, session: Session = Depends(get_session)):
    payload.username = payload.username.strip()
    if not payload.username:
        raise HTTPException(status_code=400, detail="username must not be empty")
    return create_user(session, payload)

@router.get("", response_model=list[UserRead])
def get_users_endpoint(session: Session = Depends(get_session)):
    return get_users(session)
