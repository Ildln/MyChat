from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlmodel import Session, select

from app.db import get_session
from app.models.chat import Chat
from app.models.chat_member import ChatMember
from app.models.friendship import Friendship
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.chat import ChatRead, DirectChatCreate
from app.schemas.user import UserRead

router = APIRouter(prefix="/chats", tags=["chats"])


def normalize_user_pair(user_id_1: int, user_id_2: int) -> tuple[int, int]:
    return tuple(sorted((user_id_1, user_id_2)))


def build_chat_read(session: Session, chat: Chat) -> ChatRead:
    members = session.exec(
        select(User)
        .join(ChatMember, ChatMember.user_id == User.id)
        .where(ChatMember.chat_id == chat.id)
        .order_by(User.id.asc())
    ).all()
    return ChatRead(
        id=chat.id,
        type=chat.type,
        created_at=chat.created_at,
        members=[UserRead(id=member.id, username=member.username) for member in members],
    )


@router.post("/direct", response_model=ChatRead)
def create_direct_chat(
    payload: DirectChatCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if payload.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="cannot create direct chat with yourself")

    target_user = session.get(User, payload.user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="target user not found")

    user_a_id, user_b_id = normalize_user_pair(current_user.id, payload.user_id)
    friendship = session.exec(
        select(Friendship).where(
            and_(
                Friendship.user_a_id == user_a_id,
                Friendship.user_b_id == user_b_id,
            )
        )
    ).first()
    if not friendship:
        raise HTTPException(status_code=400, detail="direct chat is available only for friends")

    existing_chat = session.exec(
        select(Chat).where(
            and_(
                Chat.type == "direct",
                Chat.direct_user_a_id == user_a_id,
                Chat.direct_user_b_id == user_b_id,
            )
        )
    ).first()
    if existing_chat:
        return build_chat_read(session, existing_chat)

    chat = Chat(
        type="direct",
        direct_user_a_id=user_a_id,
        direct_user_b_id=user_b_id,
    )
    session.add(chat)
    session.commit()
    session.refresh(chat)

    session.add(ChatMember(chat_id=chat.id, user_id=current_user.id))
    session.add(ChatMember(chat_id=chat.id, user_id=target_user.id))
    session.commit()
    session.refresh(chat)

    return build_chat_read(session, chat)
