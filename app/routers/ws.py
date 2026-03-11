from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import Session, select

from app.core.security import verify_token
from app.db import engine
from app.models.chat import Chat
from app.models.chat_member import ChatMember
from app.schemas.message import ChatMessageRead
from app.services.messages import (
    build_chat_room,
    get_chat_history,
    get_room_history,
    save_chat_message,
    save_message,
)
from app.services.ws_manager import manager

router = APIRouter(tags=["ws"])


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


def build_chat_ws_message(message) -> dict:
    return {
        "type": "message",
        **ChatMessageRead(
            id=message.id,
            chat_id=message.chat_id,
            user_id=message.user_id,
            text=message.text,
            created_at=message.created_at,
        ).model_dump(mode="json"),
    }


def handle_chat_ws_message(session: Session, chat_id: int, user_id: int, payload: dict) -> dict | None:
    text = str(payload.get("text") or "").strip()
    if not text:
        return None

    message = save_chat_message(session, chat_id=chat_id, user_id=user_id, text=text)
    return build_chat_ws_message(message)


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

    await manager.connect(room, websocket)
    manager.set_user(websocket, user_id)

    session = Session(engine)
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
            await manager.broadcast(room, {"type": "message", **saved.model_dump(mode="json")})

    except WebSocketDisconnect:
        pass
    finally:
        session.close()
        manager.disconnect(room, websocket)
        await manager.broadcast(room, {
            "type": "online",
            "room": room,
            "users": manager.get_online_users(room),
        })


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

        await manager.connect(room, websocket)
        manager.set_user(websocket, user_id)

        history = get_chat_history(session, chat_id=chat_id)
        await websocket.send_json({
            "type": "history",
            "chat_id": chat_id,
            "items": [
                ChatMessageRead(
                    id=message.id,
                    chat_id=message.chat_id,
                    user_id=message.user_id,
                    text=message.text,
                    created_at=message.created_at,
                ).model_dump(mode="json")
                for message in history
            ],
        })

        while True:
            payload = await websocket.receive_json()
            response = handle_chat_ws_message(session, chat_id, user_id, payload)
            if response is None:
                continue

            await manager.broadcast(room, response)

    except WebSocketDisconnect:
        pass
    finally:
        session.close()
        manager.disconnect(room, websocket)
