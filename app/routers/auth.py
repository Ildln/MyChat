from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.db import get_session
from app.models.user import User
from app.core.security import create_access_token, hash_password, verify_password, verify_token
from app.schemas.auth import AuthTokenResponse, LoginRequest, RegisterRequest
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


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

    token = create_access_token(sub=str(user.id))

    return AuthTokenResponse(
        user_id=user.id,
        username=user.username,
        access_token=token,
    )


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

    token = create_access_token(sub=str(user.id))

    return AuthTokenResponse(
        user_id=user.id,
        username=user.username,
        access_token=token,
    )


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return UserRead(
        id=current_user.id,
        username=current_user.username,
    )
