from pydantic import BaseModel


class RegisterRequest(BaseModel):
    username: str
    password: str
    confirm_password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    username: str


class ForgotPasswordResponse(BaseModel):
    message: str
    reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    confirm_password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
    confirm_new_password: str


class AuthByUsernameRequest(BaseModel):
    username: str


class AuthTokenResponse(BaseModel):
    user_id: int
    username: str
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str
