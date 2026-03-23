import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
import pyotp

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me-before-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
PASSWORD_HASH_ITERATIONS = 100_000
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 30
TWO_FACTOR_LOGIN_CHALLENGE_EXPIRE_MINUTES = 10
TRUSTED_DEVICE_EXPIRE_DAYS = 30
BACKUP_CODES_COUNT = 8


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    password_bytes = password.encode("utf-8")
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password_bytes,
        salt,
        PASSWORD_HASH_ITERATIONS,
    )
    salt_b64 = base64.b64encode(salt).decode("ascii")
    hash_b64 = base64.b64encode(derived_key).decode("ascii")
    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt_b64}${hash_b64}"


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False

    try:
        algorithm, iterations_str, salt_b64, hash_b64 = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False

        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected_hash = base64.b64decode(hash_b64.encode("ascii"))
        derived_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            int(iterations_str),
        )
    except (ValueError, TypeError):
        return False

    return hmac.compare_digest(derived_key, expected_hash)


def generate_password_reset_token() -> str:
    return secrets.token_urlsafe(32)


def hash_password_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_password_reset_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_refresh_token_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)


def hash_secret_value(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def generate_two_factor_secret() -> str:
    return pyotp.random_base32()


def build_totp_uri(username: str, secret: str) -> str:
    issuer = os.getenv("TOTP_ISSUER", "MyChat")
    return pyotp.TOTP(secret).provisioning_uri(name=username, issuer_name=issuer)


def verify_totp_code(secret: str | None, code: str) -> bool:
    if not secret:
        return False
    normalized = code.strip().replace(" ", "")
    if not normalized:
        return False
    try:
        return bool(pyotp.TOTP(secret).verify(normalized, valid_window=1))
    except Exception:
        return False


def generate_login_challenge_token() -> str:
    return secrets.token_urlsafe(32)


def get_two_factor_login_challenge_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=TWO_FACTOR_LOGIN_CHALLENGE_EXPIRE_MINUTES)


def generate_trusted_device_token() -> str:
    return secrets.token_urlsafe(48)


def get_trusted_device_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=TRUSTED_DEVICE_EXPIRE_DAYS)


def generate_backup_codes() -> list[str]:
    return [secrets.token_hex(4).upper() for _ in range(BACKUP_CODES_COUNT)]


def hash_backup_codes(codes: list[str]) -> str:
    return json.dumps([hash_secret_value(code) for code in codes])


def load_backup_code_hashes(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []
    try:
        data = json.loads(raw_value)
        if isinstance(data, list):
            return [str(item) for item in data]
    except json.JSONDecodeError:
        return []
    return []


def create_access_token(*, sub: str, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise JWTError("missing sub")
        return str(sub)
    except JWTError as e:
        raise ValueError("invalid token") from e
