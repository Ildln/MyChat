from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlmodel import Session, select

from app.db import get_session
from app.models.friend_request import FriendRequest
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.friend_request import FriendRequestCreate, FriendRequestRead

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
