from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlmodel import Session, select

from app.db import get_session
from app.models.chat import Chat
from app.models.chat_member import ChatMember
from app.models.friendship import Friendship
from app.models.message import Message
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.chat import ChatMembersAdd, ChatRead, DirectChatCreate, GroupChatCreate
from app.schemas.message import ChatMessageCreate, ChatMessageRead, ChatReadResponse
from app.services.messages import (
    build_chat_message_read,
    build_chat_room,
    build_last_message_read,
    get_chat_history,
    get_chat_unread_count,
    mark_chat_messages_read,
    mark_message_delivered_for_users,
    save_chat_message,
)
from app.services.push import send_push_notifications_for_message
from app.services.users import build_user_read
from app.services.ws_manager import manager

router = APIRouter(prefix="/chats", tags=["chats"])


def normalize_user_pair(user_id_1: int, user_id_2: int) -> tuple[int, int]:
    return tuple(sorted((user_id_1, user_id_2)))


def build_chat_read(session: Session, chat: Chat, current_user_id: int) -> ChatRead:
    members = session.exec(
        select(User)
        .join(ChatMember, ChatMember.user_id == User.id)
        .where(ChatMember.chat_id == chat.id)
        .order_by(User.id.asc())
    ).all()
    last_message = session.exec(
        select(Message)
        .where(Message.chat_id == chat.id)
        .order_by(Message.id.desc())
        .limit(1)
    ).first()
    return ChatRead(
        id=chat.id,
        type=chat.type,
        title=chat.title,
        created_at=chat.created_at,
        members=[build_user_read(member) for member in members],
        unread_count=get_chat_unread_count(session, chat_id=chat.id, user_id=current_user_id),
        last_message=build_last_message_read(session, message=last_message),
    )


def ensure_user_exists(session: Session, user_id: int) -> User:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"user {user_id} not found")
    return user


def ensure_friendship_with_current_user(session: Session, current_user_id: int, target_user_id: int) -> None:
    user_a_id, user_b_id = normalize_user_pair(current_user_id, target_user_id)
    friendship = session.exec(
        select(Friendship).where(
            and_(
                Friendship.user_a_id == user_a_id,
                Friendship.user_b_id == user_b_id,
            )
        )
    ).first()
    if not friendship:
        raise HTTPException(status_code=400, detail=f"user {target_user_id} is not your friend")


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


def ensure_group_chat(chat: Chat) -> None:
    if chat.type != "group":
        raise HTTPException(status_code=400, detail="group chat management is available only for group chats")


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

    return [build_chat_read(session, chat, current_user.id) for chat in chats]


@router.get("/{chat_id}", response_model=ChatRead)
def get_chat_details(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    chat = get_chat_for_user(session, chat_id, current_user.id)
    return build_chat_read(session, chat, current_user.id)


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
        return build_chat_read(session, existing_chat, current_user.id)

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

    return build_chat_read(session, chat, current_user.id)


@router.post("/group", response_model=ChatRead)
def create_group_chat(
    payload: GroupChatCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="group title must not be empty")

    participant_ids = sorted(set(payload.user_ids))
    participant_ids = [user_id for user_id in participant_ids if user_id != current_user.id]

    if len(participant_ids) < 2:
        raise HTTPException(status_code=400, detail="group chat requires at least 2 other participants")

    for user_id in participant_ids:
        ensure_user_exists(session, user_id)
        ensure_friendship_with_current_user(session, current_user.id, user_id)

    chat = Chat(
        type="group",
        title=title,
    )
    session.add(chat)
    session.commit()
    session.refresh(chat)

    all_member_ids = [current_user.id, *participant_ids]
    for user_id in all_member_ids:
        session.add(ChatMember(chat_id=chat.id, user_id=user_id))

    session.commit()
    session.refresh(chat)

    return build_chat_read(session, chat, current_user.id)


@router.post("/{chat_id}/members", response_model=ChatRead)
def add_group_chat_members(
    chat_id: int,
    payload: ChatMembersAdd,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    chat = get_chat_for_user(session, chat_id, current_user.id)
    ensure_group_chat(chat)

    existing_member_ids = set(
        session.exec(select(ChatMember.user_id).where(ChatMember.chat_id == chat_id)).all()
    )
    candidate_ids = sorted(set(payload.user_ids))
    candidate_ids = [user_id for user_id in candidate_ids if user_id not in existing_member_ids and user_id != current_user.id]

    if not candidate_ids:
        raise HTTPException(status_code=400, detail="no new members selected")

    for user_id in candidate_ids:
        ensure_user_exists(session, user_id)
        ensure_friendship_with_current_user(session, current_user.id, user_id)
        session.add(ChatMember(chat_id=chat_id, user_id=user_id))

    session.commit()
    session.refresh(chat)
    return build_chat_read(session, chat, current_user.id)


@router.post("/{chat_id}/leave")
def leave_group_chat(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    chat = get_chat_for_user(session, chat_id, current_user.id)
    ensure_group_chat(chat)

    membership = session.exec(
        select(ChatMember).where(
            ChatMember.chat_id == chat_id,
            ChatMember.user_id == current_user.id,
        )
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="chat membership not found")

    session.delete(membership)
    session.commit()

    remaining_members = session.exec(
        select(ChatMember).where(ChatMember.chat_id == chat_id)
    ).all()
    if not remaining_members:
        session.delete(chat)
        session.commit()

    return {"message": "group chat left"}


@router.get("/{chat_id}/messages", response_model=list[ChatMessageRead])
def get_chat_messages(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    chat = get_chat_for_user(session, chat_id, current_user.id)
    messages = get_chat_history(session, chat_id=chat_id)

    return [
        build_chat_message_read(
            session,
            message=message,
            current_user_id=current_user.id,
            chat=chat,
        )
        for message in messages
    ]


@router.post("/{chat_id}/read", response_model=ChatReadResponse)
def mark_chat_read(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    get_chat_for_user(session, chat_id, current_user.id)
    changed_message_ids = mark_chat_messages_read(session, chat_id=chat_id, user_id=current_user.id)

    if changed_message_ids:
        manager.broadcast_sync(
            build_chat_room(chat_id),
            {
                "type": "message_read",
                "chat_id": chat_id,
                "message_ids": changed_message_ids,
                "user_id": current_user.id,
            },
        )

    return ChatReadResponse(
        chat_id=chat_id,
        unread_count=get_chat_unread_count(session, chat_id=chat_id, user_id=current_user.id),
    )


@router.post("/{chat_id}/messages", response_model=ChatMessageRead)
def send_chat_message(
    chat_id: int,
    payload: ChatMessageCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    chat = get_chat_for_user(session, chat_id, current_user.id)

    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="message text must not be empty")

    message = save_chat_message(
        session,
        chat_id=chat_id,
        user_id=current_user.id,
        text=text,
    )

    room = build_chat_room(chat_id)
    manager.broadcast_sync(
        room,
        {
            "type": "message",
            **build_chat_message_read(
                session,
                message=message,
                current_user_id=current_user.id,
                chat=chat,
            ).model_dump(mode="json"),
        },
    )

    online_recipient_ids = [user_id for user_id in manager.get_online_users(room) if user_id != current_user.id]
    delivered_user_ids = mark_message_delivered_for_users(
        session,
        message_id=message.id,
        user_ids=online_recipient_ids,
    )
    if delivered_user_ids:
        manager.broadcast_sync(
            room,
            {
                "type": "message_delivered",
                "chat_id": chat_id,
                "message_ids": [message.id],
                "user_ids": delivered_user_ids,
            },
        )

    background_tasks.add_task(send_push_notifications_for_message, message.id)

    return build_chat_message_read(
        session,
        message=message,
        current_user_id=current_user.id,
        chat=chat,
    )
