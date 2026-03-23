import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import Session, select

from app.core.security import verify_token
from app.db import engine
from app.models.chat import Chat
from app.models.chat_member import ChatMember
from app.models.friend_request import FriendRequest
from app.models.user import User
from app.schemas.message import ChatMessageRead
from app.services.messages import (
    build_chat_message_read,
    build_chat_room,
    get_chat_history,
    get_room_history,
    mark_chat_messages_delivered,
    mark_message_delivered_for_users,
    save_chat_message,
    save_message,
)
from app.services.push import send_push_notifications_for_message
from app.services.users import touch_user
from app.services.ws_manager import manager

router = APIRouter(tags=["ws"])


def build_notification_room(user_id: int) -> str:
    return f"user:{user_id}"


def verify_chat_ws_access(session: Session, chat_id: int, token: str | None) -> int:
    if not token:
        raise ValueError("missing token")

    try:
        user_id = int(verify_token(token))
    except Exception as exc:
        raise ValueError("invalid token") from exc

    chat = session.get(Chat, chat_id)
    if not chat:
        raise LookupError("chat not found")

    membership = session.exec(
        select(ChatMember).where(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == user_id,
        )
    ).first()
    if not membership:
        raise PermissionError("chat access forbidden")

    return user_id


def verify_user_ws_access(token: str | None) -> int:
    if not token:
        raise ValueError("missing token")

    try:
        return int(verify_token(token))
    except Exception as exc:
        raise ValueError("invalid token") from exc


def build_chat_ws_message(session: Session, chat: Chat, message, current_user_id: int | None = None) -> dict:
    return {
        "type": "message",
        **build_chat_message_read(
            session,
            message=message,
            current_user_id=current_user_id,
            chat=chat,
        ).model_dump(mode="json"),
    }


@router.websocket("/ws/{room}")
async def ws_room(websocket: WebSocket, room: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return

    try:
        user_id = int(verify_token(token))
    except Exception:
        await websocket.close(code=1008)
        return

    session = Session(engine)
    await manager.connect(room, websocket)
    manager.set_user(websocket, user_id)
    user = session.get(User, user_id)
    if user:
        touch_user(session, user)

    try:
        history = get_room_history(session, room=room, limit=30)
        await websocket.send_json({
            "type": "history",
            "room": room,
            "items": [m.model_dump(mode="json") for m in history],
        })

        await websocket.send_json({
            "type": "online",
            "room": room,
            "users": manager.get_online_users(room),
        })

        while True:
            data = await websocket.receive_json()
            text = (data.get("text") or "").strip()
            if not text:
                continue

            saved = save_message(session, user_id=user_id, room=room, text=text)
            user = session.get(User, user_id)
            if user:
                touch_user(session, user)
            await manager.broadcast(room, {"type": "message", **saved.model_dump(mode="json")})

    except WebSocketDisconnect:
        pass
    finally:
        user = session.get(User, user_id)
        if user:
            touch_user(session, user)
        session.close()
        manager.disconnect(room, websocket)
        await manager.broadcast(room, {
            "type": "online",
            "room": room,
            "users": manager.get_online_users(room),
        })


@router.websocket("/ws/notifications")
async def ws_notifications(websocket: WebSocket):
    token = websocket.query_params.get("token")
    session = Session(engine)
    try:
        try:
            user_id = verify_user_ws_access(token)
        except ValueError:
            await websocket.close(code=1008)
            return

        room = build_notification_room(user_id)
        await manager.connect(room, websocket)
        manager.set_user(websocket, user_id)
        user = session.get(User, user_id)
        if user:
            touch_user(session, user)

        pending_requests = session.exec(
            select(FriendRequest)
            .where(
                FriendRequest.to_user_id == user_id,
                FriendRequest.status == "pending",
            )
            .order_by(FriendRequest.id.desc())
        ).all()
        await websocket.send_json(
            {
                "type": "friend_requests_snapshot",
                "pending_count": len(pending_requests),
                "items": [request.model_dump(mode="json") for request in pending_requests],
            }
        )

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        user = session.get(User, user_id) if "user_id" in locals() else None
        if user:
            touch_user(session, user)
        session.close()
        if "room" in locals():
            manager.disconnect(room, websocket)


@router.websocket("/ws/chats/{chat_id}")
async def ws_chat(websocket: WebSocket, chat_id: int):
    token = websocket.query_params.get("token")
    session = Session(engine)
    room = build_chat_room(chat_id)
    try:
        try:
            user_id = verify_chat_ws_access(session, chat_id, token)
        except (ValueError, LookupError, PermissionError):
            await websocket.close(code=1008)
            return

        chat = session.get(Chat, chat_id)
        if not chat:
            await websocket.close(code=1008)
            return

        await manager.connect(room, websocket)
        manager.set_user(websocket, user_id)
        user = session.get(User, user_id)
        if user:
            touch_user(session, user)

        delivered_message_ids = mark_chat_messages_delivered(session, chat_id=chat_id, user_id=user_id)
        if delivered_message_ids:
            await manager.broadcast(
                room,
                {
                    "type": "message_delivered",
                    "chat_id": chat_id,
                    "message_ids": delivered_message_ids,
                    "user_ids": [user_id],
                },
            )

        history = get_chat_history(session, chat_id=chat_id)
        await websocket.send_json({
            "type": "history",
            "chat_id": chat_id,
            "items": [
                build_chat_message_read(
                    session,
                    message=message,
                    current_user_id=user_id,
                    chat=chat,
                ).model_dump(mode="json")
                for message in history
            ],
        })

        while True:
            payload = await websocket.receive_json()
            text = str(payload.get("text") or "").strip()
            if not text:
                continue

            message = save_chat_message(session, chat_id=chat_id, user_id=user_id, text=text)
            user = session.get(User, user_id)
            if user:
                touch_user(session, user)

            await manager.broadcast(room, build_chat_ws_message(session, chat, message, current_user_id=user_id))

            online_recipient_ids = [member_id for member_id in manager.get_online_users(room) if member_id != user_id]
            delivered_user_ids = mark_message_delivered_for_users(
                session,
                message_id=message.id,
                user_ids=online_recipient_ids,
            )
            if delivered_user_ids:
                await manager.broadcast(
                    room,
                    {
                        "type": "message_delivered",
                        "chat_id": chat_id,
                        "message_ids": [message.id],
                        "user_ids": delivered_user_ids,
                    },
                )

            asyncio.create_task(asyncio.to_thread(send_push_notifications_for_message, message.id))

    except WebSocketDisconnect:
        pass
    finally:
        user = session.get(User, user_id) if "user_id" in locals() else None
        if user:
            touch_user(session, user)
        session.close()
        manager.disconnect(room, websocket)
