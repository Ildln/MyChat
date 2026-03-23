from pydantic import BaseModel


class RegisterRequest(BaseModel):
    username: str
    password: str
    confirm_password: str


class LoginRequest(BaseModel):
    username: str
    password: str
    trusted_device_token: str | None = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TwoFactorSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str


class TwoFactorEnableRequest(BaseModel):
    code: str


class TwoFactorEnableResponse(BaseModel):
    message: str
    backup_codes: list[str]


class TwoFactorLoginVerifyRequest(BaseModel):
    login_challenge_token: str
    code: str
    remember_device: bool = False


class TwoFactorDisableRequest(BaseModel):
    password: str | None = None
    code: str | None = None


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


class LoginResponse(BaseModel):
    requires_two_factor: bool = False
    user_id: int | None = None
    username: str | None = None
    access_token: str | None = None
    refresh_token: str | None = None
    trusted_device_token: str | None = None
    login_challenge_token: str | None = None
    token_type: str = "bearer"


class TwoFactorVerifyResponse(AuthTokenResponse):
    trusted_device_token: str | None = None


class TwoFactorStatusResponse(BaseModel):
    enabled: bool


class MessageResponse(BaseModel):
    message: str
