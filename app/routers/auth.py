from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models.user import User
from app.core.security import create_access_token
from app.schemas.auth import AuthByUsernameRequest, AuthTokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthTokenResponse)
def login_by_username(
    payload: AuthByUsernameRequest,
    session: Session = Depends(get_session),
):
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="username must not be empty")

    user = session.exec(
        select(User).where(User.username == username)
    ).first()

    if not user:
        user = User(username=username)
        session.add(user)
        session.commit()
        session.refresh(user)

    token = create_access_token(sub=str(user.id))

    return AuthTokenResponse(
        user_id=user.id,
        username=user.username,
        access_token=token,
    )
