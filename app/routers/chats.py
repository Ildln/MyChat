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
from app.schemas.message import ChatMessageCreate, ChatMessageRead
from app.schemas.user import UserRead
from app.services.messages import get_chat_history, save_chat_message

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


def get_chat_for_user(session: Session, chat_id: int, current_user_id: int) -> Chat:
    chat = session.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="chat not found")

    membership = session.exec(
        select(ChatMember).where(
            and_(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == current_user_id,
            )
        )
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="access to this chat is forbidden")

    return chat


@router.get("", response_model=list[ChatRead])
def get_chats(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    chats = session.exec(
        select(Chat)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .where(ChatMember.user_id == current_user.id)
        .order_by(Chat.id.asc())
    ).all()

    return [build_chat_read(session, chat) for chat in chats]


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


@router.get("/{chat_id}/messages", response_model=list[ChatMessageRead])
def get_chat_messages(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    get_chat_for_user(session, chat_id, current_user.id)

    messages = get_chat_history(session, chat_id=chat_id)

    return [
        ChatMessageRead(
            id=message.id,
            chat_id=message.chat_id,
            user_id=message.user_id,
            text=message.text,
            created_at=message.created_at,
        )
        for message in messages
    ]


@router.post("/{chat_id}/messages", response_model=ChatMessageRead)
def send_chat_message(
    chat_id: int,
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    get_chat_for_user(session, chat_id, current_user.id)

    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="message text must not be empty")

    message = save_chat_message(
        session,
        chat_id=chat_id,
        user_id=current_user.id,
        text=text,
    )

    return ChatMessageRead(
        id=message.id,
        chat_id=message.chat_id,
        user_id=message.user_id,
        text=message.text,
        created_at=message.created_at,
    )
