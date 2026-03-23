import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.core.security import (
    build_totp_uri,
    create_access_token,
    generate_backup_codes,
    generate_login_challenge_token,
    generate_password_reset_token,
    generate_refresh_token,
    generate_trusted_device_token,
    generate_two_factor_secret,
    get_password_reset_expires_at,
    get_refresh_token_expires_at,
    get_trusted_device_expires_at,
    get_two_factor_login_challenge_expires_at,
    hash_backup_codes,
    hash_password,
    hash_password_reset_token,
    hash_refresh_token,
    hash_secret_value,
    load_backup_code_hashes,
    verify_password,
    verify_token,
    verify_totp_code,
)
from app.db import get_session
from app.models.user import User
from app.schemas.auth import (
    AuthTokenResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TwoFactorDisableRequest,
    TwoFactorEnableResponse,
    TwoFactorEnableRequest,
    TwoFactorLoginVerifyRequest,
    TwoFactorSetupResponse,
    TwoFactorStatusResponse,
    TwoFactorVerifyResponse,
)
from app.schemas.user import UserRead
from app.services.users import build_user_read, touch_user

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


def should_return_dev_reset_token() -> bool:
    return os.getenv("DEV_SHOW_PASSWORD_RESET_TOKEN", "").strip().lower() in {"1", "true", "yes", "on"}


def issue_auth_tokens(session: Session, user: User) -> AuthTokenResponse:
    access_token = create_access_token(sub=str(user.id))
    refresh_token = generate_refresh_token()
    user.refresh_token_hash = hash_refresh_token(refresh_token)
    user.refresh_token_expires_at = get_refresh_token_expires_at()
    session.add(user)
    session.commit()
    session.refresh(user)

    return AuthTokenResponse(
        user_id=user.id,
        username=user.username,
        access_token=access_token,
        refresh_token=refresh_token,
    )


def build_login_success_response(tokens: AuthTokenResponse, trusted_device_token: str | None = None) -> LoginResponse:
    return LoginResponse(
        requires_two_factor=False,
        user_id=tokens.user_id,
        username=tokens.username,
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        trusted_device_token=trusted_device_token,
    )


def verify_backup_code_and_consume(session: Session, user: User, code: str) -> bool:
    normalized = code.strip().replace(" ", "").upper()
    if not normalized:
        return False

    code_hash = hash_secret_value(normalized)
    current_hashes = load_backup_code_hashes(user.two_factor_backup_codes_hashes)
    if code_hash not in current_hashes:
        return False

    remaining_hashes = [item for item in current_hashes if item != code_hash]
    user.two_factor_backup_codes_hashes = hash_backup_codes([]) if not remaining_hashes else __import__("json").dumps(remaining_hashes)
    session.add(user)
    session.commit()
    session.refresh(user)
    return True


def verify_two_factor_code(session: Session, user: User, code: str) -> bool:
    if verify_totp_code(user.two_factor_secret, code):
        return True
    return verify_backup_code_and_consume(session, user, code)


def clear_login_challenge(user: User) -> None:
    user.two_factor_login_challenge_hash = None
    user.two_factor_login_challenge_expires_at = None


def is_trusted_device_valid(user: User, trusted_device_token: str | None) -> bool:
    if not trusted_device_token or not user.trusted_device_token_hash or not user.trusted_device_expires_at:
        return False

    if user.trusted_device_expires_at < datetime.now(timezone.utc):
        return False

    return hash_secret_value(trusted_device_token) == user.trusted_device_token_hash


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

    existing_user = session.exec(select(User).where(User.username == username)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="username already exists")

    user = User(username=username, password_hash=hash_password(password))
    session.add(user)
    session.commit()
    session.refresh(user)
    user = touch_user(session, user)

    return issue_auth_tokens(session, user)


@router.post("/login", response_model=LoginResponse)
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

    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid username or password")

    user = touch_user(session, user)

    if not user.two_factor_enabled:
        return build_login_success_response(issue_auth_tokens(session, user))

    trusted_device_token = (payload.trusted_device_token or "").strip()
    if is_trusted_device_valid(user, trusted_device_token):
        return build_login_success_response(issue_auth_tokens(session, user), trusted_device_token=trusted_device_token)

    login_challenge_token = generate_login_challenge_token()
    user.two_factor_login_challenge_hash = hash_secret_value(login_challenge_token)
    user.two_factor_login_challenge_expires_at = get_two_factor_login_challenge_expires_at()
    session.add(user)
    session.commit()

    return LoginResponse(
        requires_two_factor=True,
        user_id=user.id,
        username=user.username,
        login_challenge_token=login_challenge_token,
    )


@router.post("/2fa/login/verify", response_model=TwoFactorVerifyResponse)
def verify_two_factor_login(
    payload: TwoFactorLoginVerifyRequest,
    session: Session = Depends(get_session),
):
    challenge_token = payload.login_challenge_token.strip()
    if not challenge_token:
        raise HTTPException(status_code=400, detail="login challenge token must not be empty")

    challenge_hash = hash_secret_value(challenge_token)
    now = datetime.now(timezone.utc)
    user = session.exec(
        select(User).where(
            User.two_factor_login_challenge_hash == challenge_hash,
            User.two_factor_login_challenge_expires_at.is_not(None),
            User.two_factor_login_challenge_expires_at >= now,
        )
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="login challenge is invalid or expired")

    if not verify_two_factor_code(session, user, payload.code):
        raise HTTPException(status_code=401, detail="two-factor code is invalid")

    clear_login_challenge(user)
    trusted_device_token = None
    if payload.remember_device:
        trusted_device_token = generate_trusted_device_token()
        user.trusted_device_token_hash = hash_secret_value(trusted_device_token)
        user.trusted_device_token_expires_at = get_trusted_device_expires_at()

    session.add(user)
    session.commit()
    tokens = issue_auth_tokens(session, touch_user(session, user))

    return TwoFactorVerifyResponse(
        user_id=tokens.user_id,
        username=tokens.username,
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        trusted_device_token=trusted_device_token,
    )


@router.get("/2fa/status", response_model=TwoFactorStatusResponse)
def get_two_factor_status(current_user: User = Depends(get_current_user)):
    return TwoFactorStatusResponse(enabled=current_user.two_factor_enabled)


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
def setup_two_factor(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if current_user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="two-factor authentication is already enabled")

    secret = generate_two_factor_secret()
    current_user.two_factor_pending_secret = secret
    session.add(current_user)
    session.commit()

    return TwoFactorSetupResponse(
        secret=secret,
        otpauth_uri=build_totp_uri(current_user.username, secret),
    )


@router.post("/2fa/enable", response_model=TwoFactorEnableResponse)
def enable_two_factor(
    payload: TwoFactorEnableRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if current_user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="two-factor authentication is already enabled")

    if not verify_totp_code(current_user.two_factor_pending_secret, payload.code):
        raise HTTPException(status_code=400, detail="two-factor code is invalid")

    backup_codes = generate_backup_codes()
    current_user.two_factor_secret = current_user.two_factor_pending_secret
    current_user.two_factor_pending_secret = None
    current_user.two_factor_enabled = True
    current_user.two_factor_backup_codes_hashes = hash_backup_codes(backup_codes)
    session.add(current_user)
    session.commit()

    return TwoFactorEnableResponse(
        message="Двухфакторная аутентификация включена.",
        backup_codes=backup_codes,
    )


@router.post("/2fa/disable", response_model=MessageResponse)
def disable_two_factor(
    payload: TwoFactorDisableRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    password = (payload.password or "").strip()
    code = (payload.code or "").strip()

    if not current_user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="two-factor authentication is not enabled")

    is_password_valid = bool(password) and verify_password(password, current_user.password_hash)
    is_code_valid = bool(code) and verify_two_factor_code(session, current_user, code)

    if not is_password_valid and not is_code_valid:
        raise HTTPException(status_code=400, detail="password or two-factor code is invalid")

    current_user.two_factor_enabled = False
    current_user.two_factor_secret = None
    current_user.two_factor_pending_secret = None
    current_user.two_factor_backup_codes_hashes = None
    current_user.trusted_device_token_hash = None
    current_user.trusted_device_token_expires_at = None
    clear_login_challenge(current_user)
    session.add(current_user)
    session.commit()

    return MessageResponse(message="Двухфакторная аутентификация отключена.")


@router.post("/refresh", response_model=AuthTokenResponse)
def refresh_tokens(
    payload: RefreshTokenRequest,
    session: Session = Depends(get_session),
):
    refresh_token = payload.refresh_token.strip()
    if not refresh_token:
        raise HTTPException(status_code=401, detail="invalid refresh token")

    token_hash = hash_refresh_token(refresh_token)
    now = datetime.now(timezone.utc)
    user = session.exec(
        select(User).where(
            User.refresh_token_hash == token_hash,
            User.refresh_token_expires_at.is_not(None),
            User.refresh_token_expires_at >= now,
        )
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="invalid refresh token")

    user = touch_user(session, user)
    return issue_auth_tokens(session, user)


@router.post("/logout", response_model=MessageResponse)
def logout(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    current_user.refresh_token_hash = None
    current_user.refresh_token_expires_at = None
    current_user.trusted_device_token_hash = None
    current_user.trusted_device_token_expires_at = None
    clear_login_challenge(current_user)
    session.add(current_user)
    session.commit()
    return MessageResponse(message="Сессия завершена.")


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


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return build_user_read(current_user)
