from sqlmodel import Session, select

from app.models.message import Message


def build_chat_room(chat_id: int) -> str:
    return f"chat:{chat_id}"


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
    return list(reversed(rows))


def save_chat_message(session: Session, *, chat_id: int, user_id: int, text: str) -> Message:
    msg = Message(
        user_id=user_id,
        room=build_chat_room(chat_id),
        text=text,
        chat_id=chat_id,
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return msg


def get_chat_history(session: Session, *, chat_id: int, limit: int = 50) -> list[Message]:
    stmt = (
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.id.desc())
        .limit(limit)
    )
    rows = session.exec(stmt).all()
    return list(reversed(rows))
