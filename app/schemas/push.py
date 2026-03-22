from pydantic import BaseModel


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class PushSubscriptionDelete(BaseModel):
    endpoint: str


class PushSubscriptionRead(BaseModel):
    id: int
    endpoint: str


class VapidPublicKeyRead(BaseModel):
    public_key: str
