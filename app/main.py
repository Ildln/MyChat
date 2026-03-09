from fastapi import FastAPI

from app.db import init_db
from app.routers.health import router as health_router
from app.routers.user import router as users_router
from app.routers.messages import router as messages_router
from app.routers.ws import router as ws_router
from app.routers.auth import router as auth_router

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="MyChat")
app.mount("/static", StaticFiles(directory="app/static"), name="static")


app.include_router(health_router)
app.include_router(users_router)
app.include_router(messages_router)
app.include_router(ws_router)
app.include_router(auth_router)


@app.get("/")
def root():
    return FileResponse("app/static/index.html")


@app.on_event("startup")
def on_startup():
    init_db()