from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select

from app.db import get_session
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.push import (
    PushSubscriptionCreate,
    PushSubscriptionDelete,
    PushSubscriptionRead,
    VapidPublicKeyRead,
)
from app.services.push import VAPID_PUBLIC_KEY, has_vapid_config

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/vapid-public-key", response_model=VapidPublicKeyRead)
def get_vapid_public_key() -> VapidPublicKeyRead:
    if not has_vapid_config():
        raise HTTPException(status_code=503, detail="push notifications are not configured")

    return VapidPublicKeyRead(public_key=VAPID_PUBLIC_KEY)


@router.post("/subscriptions", response_model=PushSubscriptionRead)
def save_push_subscription(
    payload: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    existing = session.exec(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    ).first()

    if existing:
        existing.user_id = current_user.id
        existing.p256dh = payload.p256dh
        existing.auth = payload.auth
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return PushSubscriptionRead(id=existing.id, endpoint=existing.endpoint)

    subscription = PushSubscription(
        user_id=current_user.id,
        endpoint=payload.endpoint,
        p256dh=payload.p256dh,
        auth=payload.auth,
    )
    session.add(subscription)
    session.commit()
    session.refresh(subscription)
    return PushSubscriptionRead(id=subscription.id, endpoint=subscription.endpoint)


@router.delete("/subscriptions", status_code=204)
def delete_push_subscription(
    payload: PushSubscriptionDelete,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    subscription = session.exec(
        select(PushSubscription).where(
            PushSubscription.user_id == current_user.id,
            PushSubscription.endpoint == payload.endpoint,
        )
    ).first()

    if subscription:
        session.delete(subscription)
        session.commit()

    return Response(status_code=204)
