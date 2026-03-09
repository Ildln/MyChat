from pydantic import BaseModel


class AuthByUsernameRequest(BaseModel):
    username: str


class AuthTokenResponse(BaseModel):
    user_id: int
    username: str
    access_token: str
    token_type: str = "bearer"