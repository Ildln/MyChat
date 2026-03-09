from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlmodel import Session, select

from app.db import get_session
from app.models.friend_request import FriendRequest
from app.models.friendship import Friendship
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.friend_request import FriendRequestCreate, FriendRequestRead
from app.schemas.user import UserRead

router = APIRouter(prefix="/friends", tags=["friends"])


@router.post("/requests", response_model=FriendRequestRead)
def create_friend_request(
    payload: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if payload.to_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="cannot send friend request to yourself")

    target_user = session.get(User, payload.to_user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="target user not found")

    existing_pending_request = session.exec(
        select(FriendRequest).where(
            and_(
                FriendRequest.status == "pending",
                or_(
                    and_(
                        FriendRequest.from_user_id == current_user.id,
                        FriendRequest.to_user_id == payload.to_user_id,
                    ),
                    and_(
                        FriendRequest.from_user_id == payload.to_user_id,
                        FriendRequest.to_user_id == current_user.id,
                    ),
                ),
            )
        )
    ).first()

    if existing_pending_request:
        raise HTTPException(status_code=400, detail="pending friend request already exists")

    friend_request = FriendRequest(
        from_user_id=current_user.id,
        to_user_id=payload.to_user_id,
    )
    session.add(friend_request)
    session.commit()
    session.refresh(friend_request)
    return friend_request


@router.get("/requests/incoming", response_model=list[FriendRequestRead])
def get_incoming_friend_requests(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return session.exec(
        select(FriendRequest)
        .where(FriendRequest.to_user_id == current_user.id)
        .order_by(FriendRequest.id.desc())
    ).all()


@router.get("/requests/outgoing", response_model=list[FriendRequestRead])
def get_outgoing_friend_requests(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return session.exec(
        select(FriendRequest)
        .where(FriendRequest.from_user_id == current_user.id)
        .order_by(FriendRequest.id.desc())
    ).all()


def normalize_friendship_pair(user_id_1: int, user_id_2: int) -> tuple[int, int]:
    return tuple(sorted((user_id_1, user_id_2)))


@router.get("", response_model=list[UserRead])
def get_friends(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    friendships = session.exec(
        select(Friendship).where(
            or_(
                Friendship.user_a_id == current_user.id,
                Friendship.user_b_id == current_user.id,
            )
        )
    ).all()

    friend_ids = []
    for friendship in friendships:
        if friendship.user_a_id == current_user.id:
            friend_ids.append(friendship.user_b_id)
        else:
            friend_ids.append(friendship.user_a_id)

    if not friend_ids:
        return []

    friends = session.exec(
        select(User)
        .where(User.id.in_(friend_ids))
        .order_by(User.id.asc())
    ).all()

    return [
        UserRead(id=friend.id, username=friend.username)
        for friend in friends
    ]


def get_request_for_recipient(session: Session, request_id: int, current_user_id: int) -> FriendRequest:
    friend_request = session.get(FriendRequest, request_id)
    if not friend_request:
        raise HTTPException(status_code=404, detail="friend request not found")

    if friend_request.to_user_id != current_user_id:
        raise HTTPException(status_code=403, detail="cannot process this friend request")

    if friend_request.status != "pending":
        raise HTTPException(status_code=400, detail="friend request already processed")

    return friend_request


@router.post("/requests/{request_id}/accept", response_model=FriendRequestRead)
def accept_friend_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    friend_request = get_request_for_recipient(session, request_id, current_user.id)
    user_a_id, user_b_id = normalize_friendship_pair(
        friend_request.from_user_id,
        friend_request.to_user_id,
    )

    existing_friendship = session.exec(
        select(Friendship).where(
            and_(
                Friendship.user_a_id == user_a_id,
                Friendship.user_b_id == user_b_id,
            )
        )
    ).first()
    if not existing_friendship:
        session.add(Friendship(user_a_id=user_a_id, user_b_id=user_b_id))

    friend_request.status = "accepted"
    session.add(friend_request)
    session.commit()
    session.refresh(friend_request)
    return friend_request


@router.post("/requests/{request_id}/decline", response_model=FriendRequestRead)
def decline_friend_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    friend_request = get_request_for_recipient(session, request_id, current_user.id)
    friend_request.status = "declined"
    session.add(friend_request)
    session.commit()
    session.refresh(friend_request)
    return friend_request
