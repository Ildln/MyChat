import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.db import get_session
from app.models.user import User
from app.core.security import (
    create_access_token,
    generate_password_reset_token,
    get_password_reset_expires_at,
    hash_password,
    hash_password_reset_token,
    verify_password,
    verify_token,
)
from app.schemas.auth import (
    AuthTokenResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
)
from app.schemas.user import UserRead
from app.services.users import build_user_read, touch_user

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


def should_return_dev_reset_token() -> bool:
    return os.getenv("DEV_SHOW_PASSWORD_RESET_TOKEN", "").strip().lower() in {"1", "true", "yes", "on"}


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="not authenticated")

    try:
        user_id = int(verify_token(credentials.credentials))
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="invalid token")

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="invalid token")

    user = touch_user(session, user)
    return user


@router.post("/register", response_model=AuthTokenResponse)
def register(
    payload: RegisterRequest,
    session: Session = Depends(get_session),
):
    username = payload.username.strip()
    password = payload.password

    if not username:
        raise HTTPException(status_code=400, detail="username must not be empty")

    if not password:
        raise HTTPException(status_code=400, detail="password must not be empty")

    if password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="passwords do not match")

    existing_user = session.exec(
        select(User).where(User.username == username)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="username already exists")

    user = User(
        username=username,
        password_hash=hash_password(password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    user = touch_user(session, user)

    token = create_access_token(sub=str(user.id))

    return AuthTokenResponse(
        user_id=user.id,
        username=user.username,
        access_token=token,
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    session: Session = Depends(get_session),
):
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="username must not be empty")

    user = session.exec(select(User).where(User.username == username)).first()
    reset_token = None

    if user:
        reset_token = generate_password_reset_token()
        user.password_reset_token_hash = hash_password_reset_token(reset_token)
        user.password_reset_expires_at = get_password_reset_expires_at()
        session.add(user)
        session.commit()

    return ForgotPasswordResponse(
        message="Если пользователь существует, инструкция по сбросу пароля уже подготовлена.",
        reset_token=reset_token if reset_token and should_return_dev_reset_token() else None,
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    payload: ResetPasswordRequest,
    session: Session = Depends(get_session),
):
    token = payload.token.strip()
    password = payload.password

    if not token:
        raise HTTPException(status_code=400, detail="reset token must not be empty")

    if not password:
        raise HTTPException(status_code=400, detail="password must not be empty")

    if password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="passwords do not match")

    token_hash = hash_password_reset_token(token)
    now = datetime.now(timezone.utc)
    user = session.exec(
        select(User).where(
            User.password_reset_token_hash == token_hash,
            User.password_reset_expires_at.is_not(None),
            User.password_reset_expires_at >= now,
        )
    ).first()

    if not user:
        raise HTTPException(status_code=400, detail="reset token is invalid or expired")

    user.password_hash = hash_password(password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    session.add(user)
    session.commit()

    return MessageResponse(message="Пароль успешно обновлён.")


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not payload.old_password:
        raise HTTPException(status_code=400, detail="old password must not be empty")

    if not payload.new_password:
        raise HTTPException(status_code=400, detail="new password must not be empty")

    if payload.new_password != payload.confirm_new_password:
        raise HTTPException(status_code=400, detail="new passwords do not match")

    if not verify_password(payload.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="old password is incorrect")

    current_user.password_hash = hash_password(payload.new_password)
    current_user.password_reset_token_hash = None
    current_user.password_reset_expires_at = None
    session.add(current_user)
    session.commit()

    return MessageResponse(message="Пароль успешно изменён.")


@router.post("/login", response_model=AuthTokenResponse)
def login(
    payload: LoginRequest,
    session: Session = Depends(get_session),
):
    username = payload.username.strip()
    password = payload.password

    if not username:
        raise HTTPException(status_code=400, detail="username must not be empty")

    if not password:
        raise HTTPException(status_code=400, detail="password must not be empty")

    user = session.exec(
        select(User).where(User.username == username)
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="invalid username or password")

    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid username or password")

    user = touch_user(session, user)
    token = create_access_token(sub=str(user.id))

    return AuthTokenResponse(
        user_id=user.id,
        username=user.username,
        access_token=token,
    )


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return build_user_read(current_user)
