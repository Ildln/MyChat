import unittest

from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

import app.db as db_module
from app.models.friend_request import FriendRequest
from app.models.friendship import Friendship
from app.models.user import User
from app.routers.auth import get_current_user, register
from app.routers.friends import (
    accept_friend_request,
    create_friend_request,
    decline_friend_request,
    get_incoming_friend_requests,
    get_outgoing_friend_requests,
)
from app.schemas.auth import RegisterRequest
from app.schemas.friend_request import FriendRequestCreate


class FriendRequestsTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.original_engine = db_module.engine
        db_module.engine = self.engine
        SQLModel.metadata.create_all(self.engine)

    def tearDown(self):
        self.engine.dispose()
        db_module.engine = self.original_engine

    def create_user(self, username: str, password: str = "secret123"):
        with Session(self.engine) as session:
            return register(RegisterRequest(username=username, password=password), session)

    def test_create_friend_request_success(self):
        sender = self.create_user("alice")
        target = self.create_user("bob")

        with Session(self.engine) as session:
            current_user = session.get(User, sender.user_id)
            response = create_friend_request(
                FriendRequestCreate(to_user_id=target.user_id),
                current_user,
                session,
            )

        self.assertGreater(response.id, 0)
        self.assertEqual(response.from_user_id, sender.user_id)
        self.assertEqual(response.to_user_id, target.user_id)
        self.assertEqual(response.status, "pending")

        with Session(self.engine) as session:
            friend_request = session.exec(select(FriendRequest)).first()

        self.assertIsNotNone(friend_request)
        self.assertEqual(friend_request.status, "pending")

    def test_create_friend_request_rejects_self_request(self):
        sender = self.create_user("alice")

        with Session(self.engine) as session:
            current_user = session.get(User, sender.user_id)
            with self.assertRaises(HTTPException) as exc_info:
                create_friend_request(
                    FriendRequestCreate(to_user_id=sender.user_id),
                    current_user,
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 400)
        self.assertEqual(exc_info.exception.detail, "cannot send friend request to yourself")

    def test_create_friend_request_rejects_duplicate_pending_request(self):
        sender = self.create_user("alice")
        target = self.create_user("bob")

        with Session(self.engine) as session:
            current_user = session.get(User, sender.user_id)
            create_friend_request(
                FriendRequestCreate(to_user_id=target.user_id),
                current_user,
                session,
            )

        with Session(self.engine) as session:
            current_user = session.get(User, sender.user_id)
            with self.assertRaises(HTTPException) as exc_info:
                create_friend_request(
                    FriendRequestCreate(to_user_id=target.user_id),
                    current_user,
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 400)
        self.assertEqual(exc_info.exception.detail, "pending friend request already exists")

    def test_create_friend_request_rejects_missing_target_user(self):
        sender = self.create_user("alice")

        with Session(self.engine) as session:
            current_user = session.get(User, sender.user_id)
            with self.assertRaises(HTTPException) as exc_info:
                create_friend_request(
                    FriendRequestCreate(to_user_id=999999),
                    current_user,
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 404)
        self.assertEqual(exc_info.exception.detail, "target user not found")

    def test_create_friend_request_requires_authentication(self):
        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                get_current_user(None, session)

        self.assertEqual(exc_info.exception.status_code, 401)
        self.assertEqual(exc_info.exception.detail, "not authenticated")

    def test_incoming_returns_only_target_user_requests(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")
        charlie = self.create_user("charlie")

        with Session(self.engine) as session:
            create_friend_request(
                FriendRequestCreate(to_user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )
            create_friend_request(
                FriendRequestCreate(to_user_id=charlie.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            incoming = get_incoming_friend_requests(session.get(User, bob.user_id), session)

        self.assertEqual(len(incoming), 1)
        self.assertEqual(incoming[0].to_user_id, bob.user_id)
        self.assertEqual(incoming[0].from_user_id, alice.user_id)

    def test_outgoing_returns_only_current_user_requests(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")
        charlie = self.create_user("charlie")

        with Session(self.engine) as session:
            create_friend_request(
                FriendRequestCreate(to_user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )
            create_friend_request(
                FriendRequestCreate(to_user_id=alice.user_id),
                session.get(User, charlie.user_id),
                session,
            )

        with Session(self.engine) as session:
            outgoing = get_outgoing_friend_requests(session.get(User, alice.user_id), session)

        self.assertEqual(len(outgoing), 1)
        self.assertEqual(outgoing[0].from_user_id, alice.user_id)
        self.assertEqual(outgoing[0].to_user_id, bob.user_id)

    def test_accept_friend_request_creates_friendship(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")

        with Session(self.engine) as session:
            created_request = create_friend_request(
                FriendRequestCreate(to_user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            accepted_request = accept_friend_request(
                created_request.id,
                session.get(User, bob.user_id),
                session,
            )

        self.assertEqual(accepted_request.status, "accepted")

        with Session(self.engine) as session:
            friendship = session.exec(select(Friendship)).first()

        self.assertIsNotNone(friendship)
        self.assertEqual(friendship.user_a_id, min(alice.user_id, bob.user_id))
        self.assertEqual(friendship.user_b_id, max(alice.user_id, bob.user_id))

    def test_decline_friend_request_changes_status(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")

        with Session(self.engine) as session:
            created_request = create_friend_request(
                FriendRequestCreate(to_user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            declined_request = decline_friend_request(
                created_request.id,
                session.get(User, bob.user_id),
                session,
            )

        self.assertEqual(declined_request.status, "declined")

        with Session(self.engine) as session:
            stored_request = session.get(FriendRequest, created_request.id)

        self.assertIsNotNone(stored_request)
        self.assertEqual(stored_request.status, "declined")

    def test_cannot_process_foreign_friend_request(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")
        charlie = self.create_user("charlie")

        with Session(self.engine) as session:
            created_request = create_friend_request(
                FriendRequestCreate(to_user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                accept_friend_request(
                    created_request.id,
                    session.get(User, charlie.user_id),
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 403)

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                decline_friend_request(
                    created_request.id,
                    session.get(User, charlie.user_id),
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 403)

    def test_cannot_process_already_handled_request_twice(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")

        with Session(self.engine) as session:
            created_request = create_friend_request(
                FriendRequestCreate(to_user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            accept_friend_request(
                created_request.id,
                session.get(User, bob.user_id),
                session,
            )

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                decline_friend_request(
                    created_request.id,
                    session.get(User, bob.user_id),
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 400)
        self.assertEqual(exc_info.exception.detail, "friend request already processed")

    def test_protected_friends_endpoints_require_authentication(self):
        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                get_current_user(None, session)

        self.assertEqual(exc_info.exception.status_code, 401)
        self.assertEqual(exc_info.exception.detail, "not authenticated")


if __name__ == "__main__":
    unittest.main()
