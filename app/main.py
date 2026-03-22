from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routers.health import router as health_router
from app.routers.user import router as users_router
from app.routers.messages import router as messages_router
from app.routers.ws import router as ws_router
from app.routers.auth import router as auth_router
from app.routers.friends import router as friends_router
from app.routers.chats import router as chats_router
from app.routers.push import router as push_router

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="MyChat")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://mychat-frontend-n49g.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")


app.include_router(health_router)
app.include_router(users_router)
app.include_router(messages_router)
app.include_router(ws_router)
app.include_router(auth_router)
app.include_router(friends_router)
app.include_router(chats_router)
app.include_router(push_router)


@app.get("/")
def root():
    return FileResponse("app/static/index.html")


@app.on_event("startup")
def on_startup():
    init_db()
