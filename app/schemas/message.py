from datetime import datetime
from pydantic import BaseModel


class MessageCreate(BaseModel):
    user_id: int
    text: str
    room: str

class MessageRead(BaseModel):
    id: int
    user_id: int
    text: str
    room: str
    created_at: datetime