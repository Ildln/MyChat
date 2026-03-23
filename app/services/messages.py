from datetime import UTC, datetime

from sqlmodel import Session, select

from app.models.chat import Chat
from app.models.chat_member import ChatMember
from app.models.message import Message
from app.models.message_receipt import MessageReceipt
from app.models.user import User
from app.schemas.chat import ChatLastMessageRead
from app.schemas.message import ChatMessageRead


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


def _get_chat_member_ids(session: Session, chat_id: int) -> list[int]:
    return session.exec(
        select(ChatMember.user_id)
        .where(ChatMember.chat_id == chat_id)
        .order_by(ChatMember.user_id.asc())
    ).all()


def _create_message_receipts(session: Session, message_id: int, recipient_ids: list[int]) -> None:
    for recipient_id in recipient_ids:
        session.add(MessageReceipt(message_id=message_id, user_id=recipient_id))


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

    recipient_ids = [member_id for member_id in _get_chat_member_ids(session, chat_id) if member_id != user_id]
    if recipient_ids:
        _create_message_receipts(session, msg.id, recipient_ids)
        session.commit()

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


def get_chat_unread_count(session: Session, *, chat_id: int, user_id: int) -> int:
    receipts = session.exec(
        select(MessageReceipt)
        .join(Message, Message.id == MessageReceipt.message_id)
        .where(
            Message.chat_id == chat_id,
            MessageReceipt.user_id == user_id,
            MessageReceipt.read_at.is_(None),
        )
    ).all()
    return len(receipts)


def mark_chat_messages_delivered(session: Session, *, chat_id: int, user_id: int) -> list[int]:
    now = datetime.now(UTC)
    changed_message_ids: list[int] = []
    receipts = session.exec(
        select(MessageReceipt)
        .join(Message, Message.id == MessageReceipt.message_id)
        .where(
            Message.chat_id == chat_id,
            MessageReceipt.user_id == user_id,
            MessageReceipt.delivered_at.is_(None),
        )
    ).all()

    for receipt in receipts:
        receipt.delivered_at = now
        session.add(receipt)
        changed_message_ids.append(receipt.message_id)

    if changed_message_ids:
        session.commit()

    return changed_message_ids


def mark_message_delivered_for_users(
    session: Session,
    *,
    message_id: int,
    user_ids: list[int],
) -> list[int]:
    if not user_ids:
        return []

    now = datetime.now(UTC)
    changed_user_ids: list[int] = []
    receipts = session.exec(
        select(MessageReceipt).where(
            MessageReceipt.message_id == message_id,
            MessageReceipt.user_id.in_(user_ids),
            MessageReceipt.delivered_at.is_(None),
        )
    ).all()

    for receipt in receipts:
        receipt.delivered_at = now
        session.add(receipt)
        changed_user_ids.append(receipt.user_id)

    if receipts:
        session.commit()

    return changed_user_ids


def mark_chat_messages_read(session: Session, *, chat_id: int, user_id: int) -> list[int]:
    now = datetime.now(UTC)
    changed_message_ids: list[int] = []
    receipts = session.exec(
        select(MessageReceipt)
        .join(Message, Message.id == MessageReceipt.message_id)
        .where(
            Message.chat_id == chat_id,
            MessageReceipt.user_id == user_id,
            MessageReceipt.read_at.is_(None),
        )
    ).all()

    for receipt in receipts:
        if receipt.delivered_at is None:
            receipt.delivered_at = now
        receipt.read_at = now
        session.add(receipt)
        changed_message_ids.append(receipt.message_id)

    if changed_message_ids:
        session.commit()

    return changed_message_ids


def _get_delivery_status(
    session: Session,
    *,
    chat: Chat | None,
    message: Message,
    current_user_id: int | None,
) -> str | None:
    if current_user_id is None or current_user_id != message.user_id:
        return None

    if not chat or chat.type != "direct":
        return None

    receipts = session.exec(
        select(MessageReceipt).where(MessageReceipt.message_id == message.id)
    ).all()
    if not receipts:
        return "sent"

    if any(receipt.read_at is not None for receipt in receipts):
        return "read"
    if any(receipt.delivered_at is not None for receipt in receipts):
        return "delivered"
    return "sent"


def build_chat_message_read(
    session: Session,
    *,
    message: Message,
    current_user_id: int | None = None,
    chat: Chat | None = None,
) -> ChatMessageRead:
    author = session.get(User, message.user_id)
    return ChatMessageRead(
        id=message.id,
        chat_id=message.chat_id,
        user_id=message.user_id,
        text=message.text,
        created_at=message.created_at,
        author_username=author.username if author else f"Пользователь #{message.user_id}",
        author_avatar_url=author.avatar_url if author else None,
        delivery_status=_get_delivery_status(
            session,
            chat=chat,
            message=message,
            current_user_id=current_user_id,
        ),
    )


def build_last_message_read(session: Session, *, message: Message | None) -> ChatLastMessageRead | None:
    if not message:
        return None

    author = session.get(User, message.user_id)
    return ChatLastMessageRead(
        id=message.id,
        user_id=message.user_id,
        text=message.text,
        created_at=message.created_at,
        author_username=author.username if author else f"Пользователь #{message.user_id}",
        author_avatar_url=author.avatar_url if author else None,
    )
