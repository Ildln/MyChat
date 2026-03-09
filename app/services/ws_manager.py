from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, list[WebSocket]] = {}
        self.ws_user: dict[WebSocket, int] = {}

    async def connect(self, room: str, websocket: WebSocket):
        await websocket.accept()
        self.rooms.setdefault(room, []).append(websocket)

    def set_user(self, websocket: WebSocket, user_id: int):
        self.ws_user[websocket] = user_id

    def disconnect(self, room: str, websocket: WebSocket):
        if room in self.rooms and websocket in self.rooms[room]:
            self.rooms[room].remove(websocket)
        self.ws_user.pop(websocket, None)

    def get_online_users(self, room: str) -> list[int]:
        users = []
        for ws in self.rooms.get(room, []):
            uid = self.ws_user.get(ws)
            if uid is not None:
                users.append(uid)
        return sorted(set(users))

    async def broadcast(self, room: str, message: dict):
        for ws in self.rooms.get(room, []):
            await ws.send_json(message)

manager = ConnectionManager()