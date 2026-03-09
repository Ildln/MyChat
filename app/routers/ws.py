from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import Session

from app.db import engine
from app.services.ws_manager import manager
from app.services.messages import get_room_history, save_message
from app.core.security import verify_token

router = APIRouter(tags=["ws"])


@router.websocket("/ws/{room}")
async def ws_room(websocket: WebSocket, room: str):
    # 1) достаём токен из query params
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)  # policy violation
        return

    # 2) проверяем токен
    try:
        user_id = int(verify_token(token))
    except Exception:
        await websocket.close(code=1008)
        return

    # 3) подключаем в room
    await manager.connect(room, websocket)

    manager.set_user(websocket, user_id)

    # 4) открываем сессию БД и отправляем историю
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
        # можно ещё раз отправить online оставшимся
        await manager.broadcast(room, {
            "type": "online",
            "room": room,
            "users": manager.get_online_users(room),
        })