import json
import os
from typing import Any

from pywebpush import WebPushException, webpush
from sqlmodel import Session, select

from app.db import engine
from app.models.chat import Chat
from app.models.chat_member import ChatMember
from app.models.message import Message
from app.models.push_subscription import PushSubscription
from app.models.user import User

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "")


def has_vapid_config() -> bool:
    return bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY and VAPID_SUBJECT)


def build_push_payload(session: Session, message: Message) -> dict[str, Any] | None:
    if message.chat_id is None:
        return None

    chat = session.get(Chat, message.chat_id)
    sender = session.get(User, message.user_id)
    if not chat or not sender:
        return None

    members = session.exec(
        select(User)
        .join(ChatMember, ChatMember.user_id == User.id)
        .where(ChatMember.chat_id == chat.id)
        .order_by(User.id.asc())
    ).all()

    if chat.type == "group":
        title = chat.title or "Новая беседа"
        body = f"{sender.username}: {message.text}"
    else:
        title = sender.username
        body = message.text

    return {
        "title": title,
        "body": body,
        "chatId": chat.id,
        "icon": "/icon-192.svg",
        "badge": "/icon-192.svg",
    }


def cleanup_invalid_subscription(session: Session, subscription: PushSubscription) -> None:
    session.delete(subscription)
    session.commit()


def send_push_notifications_for_message(message_id: int) -> None:
    if not has_vapid_config():
        return

    with Session(engine) as session:
        message = session.get(Message, message_id)
        if not message or message.chat_id is None:
            return

        payload = build_push_payload(session, message)
        if payload is None:
            return

        member_ids = session.exec(
            select(ChatMember.user_id).where(ChatMember.chat_id == message.chat_id)
        ).all()
        recipient_ids = [user_id for user_id in member_ids if user_id != message.user_id]
        if not recipient_ids:
            return

        subscriptions = session.exec(
            select(PushSubscription).where(PushSubscription.user_id.in_(recipient_ids))
        ).all()

        for subscription in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": subscription.endpoint,
                        "keys": {
                            "p256dh": subscription.p256dh,
                            "auth": subscription.auth,
                        },
                    },
                    data=json.dumps(payload),
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": VAPID_SUBJECT},
                    ttl=60,
                )
            except WebPushException as exc:
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                if status_code in (404, 410):
                    cleanup_invalid_subscription(session, subscription)
