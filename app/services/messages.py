from sqlmodel import Session, select

from app.models.message import Message


def save_message(session: Session, *, user_id: int, room: str, text: str) -> Message:
    msg = Message(user_id=user_id, room=room, text=text)
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return msg


def get_room_history(session: Session, *, room: str, limit: int = 30) -> list[Message]:
    stmt = (
        select(Message)
        .where(Message.room == room)
        .order_by(Message.id.desc())
        .limit(limit)
    )
    rows = session.exec(stmt).all()
    return list(reversed(rows))  # старые -> новые