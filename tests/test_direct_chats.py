import unittest

from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

import app.db as db_module
from app.models.chat import Chat
from app.models.chat_member import ChatMember
from app.models.message import Message
from app.models.user import User
from app.routers.auth import get_current_user, register
from app.routers.chats import create_direct_chat, get_chat_messages, get_chats, send_chat_message
from app.routers.friends import accept_friend_request, create_friend_request
from app.schemas.auth import RegisterRequest
from app.schemas.chat import DirectChatCreate
from app.schemas.friend_request import FriendRequestCreate
from app.schemas.message import ChatMessageCreate


class DirectChatsTests(unittest.TestCase):
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

    def make_friends(self, sender_user_id: int, target_user_id: int):
        with Session(self.engine) as session:
            friend_request = create_friend_request(
                FriendRequestCreate(to_user_id=target_user_id),
                session.get(User, sender_user_id),
                session,
            )

        with Session(self.engine) as session:
            accept_friend_request(
                friend_request.id,
                session.get(User, target_user_id),
                session,
            )

    def test_create_direct_chat_success_between_friends(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")
        self.make_friends(alice.user_id, bob.user_id)

        with Session(self.engine) as session:
            response = create_direct_chat(
                DirectChatCreate(user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        self.assertGreater(response.id, 0)
        self.assertEqual(response.type, "direct")
        self.assertEqual(len(response.members), 2)
        self.assertEqual({member.id for member in response.members}, {alice.user_id, bob.user_id})

        with Session(self.engine) as session:
            chat = session.exec(select(Chat)).first()
            members = session.exec(select(ChatMember).where(ChatMember.chat_id == chat.id)).all()

        self.assertIsNotNone(chat)
        self.assertEqual(len(members), 2)

    def test_create_direct_chat_rejects_self(self):
        alice = self.create_user("alice")

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                create_direct_chat(
                    DirectChatCreate(user_id=alice.user_id),
                    session.get(User, alice.user_id),
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 400)
        self.assertEqual(exc_info.exception.detail, "cannot create direct chat with yourself")

    def test_create_direct_chat_rejects_missing_target_user(self):
        alice = self.create_user("alice")

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                create_direct_chat(
                    DirectChatCreate(user_id=999999),
                    session.get(User, alice.user_id),
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 404)
        self.assertEqual(exc_info.exception.detail, "target user not found")

    def test_create_direct_chat_rejects_non_friend(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                create_direct_chat(
                    DirectChatCreate(user_id=bob.user_id),
                    session.get(User, alice.user_id),
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 400)
        self.assertEqual(exc_info.exception.detail, "direct chat is available only for friends")

    def test_create_direct_chat_returns_existing_chat_without_duplicate(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")
        self.make_friends(alice.user_id, bob.user_id)

        with Session(self.engine) as session:
            first_response = create_direct_chat(
                DirectChatCreate(user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            second_response = create_direct_chat(
                DirectChatCreate(user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        self.assertEqual(first_response.id, second_response.id)

        with Session(self.engine) as session:
            chats = session.exec(select(Chat)).all()
            members = session.exec(select(ChatMember)).all()

        self.assertEqual(len(chats), 1)
        self.assertEqual(len(members), 2)

    def test_create_direct_chat_requires_authentication(self):
        alice = self.create_user("alice")

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                current_user = get_current_user(None, session)
                create_direct_chat(
                    DirectChatCreate(user_id=alice.user_id),
                    current_user,
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 401)
        self.assertEqual(exc_info.exception.detail, "not authenticated")

    def test_get_chats_returns_empty_list_without_chats(self):
        alice = self.create_user("alice")

        with Session(self.engine) as session:
            chats = get_chats(session.get(User, alice.user_id), session)

        self.assertEqual(chats, [])

    def test_get_chats_returns_direct_chat_after_creation(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")
        self.make_friends(alice.user_id, bob.user_id)

        with Session(self.engine) as session:
            created_chat = create_direct_chat(
                DirectChatCreate(user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            chats = get_chats(session.get(User, alice.user_id), session)

        self.assertEqual(len(chats), 1)
        self.assertEqual(chats[0].id, created_chat.id)
        self.assertEqual(chats[0].type, "direct")

    def test_get_chats_returns_direct_chat_for_both_sides(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")
        self.make_friends(alice.user_id, bob.user_id)

        with Session(self.engine) as session:
            created_chat = create_direct_chat(
                DirectChatCreate(user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            alice_chats = get_chats(session.get(User, alice.user_id), session)
            bob_chats = get_chats(session.get(User, bob.user_id), session)

        self.assertEqual(len(alice_chats), 1)
        self.assertEqual(len(bob_chats), 1)
        self.assertEqual(alice_chats[0].id, created_chat.id)
        self.assertEqual(bob_chats[0].id, created_chat.id)

    def test_get_chats_does_not_return_foreign_chats(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")
        charlie = self.create_user("charlie")
        self.make_friends(alice.user_id, bob.user_id)

        with Session(self.engine) as session:
            create_direct_chat(
                DirectChatCreate(user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            charlie_chats = get_chats(session.get(User, charlie.user_id), session)

        self.assertEqual(charlie_chats, [])

    def test_get_chats_requires_authentication(self):
        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                get_current_user(None, session)

        self.assertEqual(exc_info.exception.status_code, 401)
        self.assertEqual(exc_info.exception.detail, "not authenticated")

    def test_send_chat_message_success(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")
        self.make_friends(alice.user_id, bob.user_id)

        with Session(self.engine) as session:
            chat = create_direct_chat(
                DirectChatCreate(user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            message = send_chat_message(
                chat.id,
                ChatMessageCreate(text="Привет, Bob"),
                session.get(User, alice.user_id),
                session,
            )

        self.assertEqual(message.chat_id, chat.id)
        self.assertEqual(message.user_id, alice.user_id)
        self.assertEqual(message.text, "Привет, Bob")

        with Session(self.engine) as session:
            stored = session.exec(select(Message).where(Message.chat_id == chat.id)).first()

        self.assertIsNotNone(stored)
        self.assertEqual(stored.room, f"chat:{chat.id}")

    def test_get_chat_messages_success(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")
        self.make_friends(alice.user_id, bob.user_id)

        with Session(self.engine) as session:
            chat = create_direct_chat(
                DirectChatCreate(user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            send_chat_message(
                chat.id,
                ChatMessageCreate(text="Первое сообщение"),
                session.get(User, alice.user_id),
                session,
            )
            send_chat_message(
                chat.id,
                ChatMessageCreate(text="Ответ"),
                session.get(User, bob.user_id),
                session,
            )

        with Session(self.engine) as session:
            history = get_chat_messages(
                chat.id,
                session.get(User, alice.user_id),
                session,
            )

        self.assertEqual(len(history), 2)
        self.assertEqual(history[0].text, "Первое сообщение")
        self.assertEqual(history[1].text, "Ответ")

    def test_cannot_read_foreign_chat(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")
        charlie = self.create_user("charlie")
        self.make_friends(alice.user_id, bob.user_id)

        with Session(self.engine) as session:
            chat = create_direct_chat(
                DirectChatCreate(user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                get_chat_messages(
                    chat.id,
                    session.get(User, charlie.user_id),
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 403)
        self.assertEqual(exc_info.exception.detail, "access to this chat is forbidden")

    def test_cannot_write_foreign_chat(self):
        alice = self.create_user("alice")
        bob = self.create_user("bob")
        charlie = self.create_user("charlie")
        self.make_friends(alice.user_id, bob.user_id)

        with Session(self.engine) as session:
            chat = create_direct_chat(
                DirectChatCreate(user_id=bob.user_id),
                session.get(User, alice.user_id),
                session,
            )

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                send_chat_message(
                    chat.id,
                    ChatMessageCreate(text="Чужое сообщение"),
                    session.get(User, charlie.user_id),
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 403)
        self.assertEqual(exc_info.exception.detail, "access to this chat is forbidden")

    def test_chat_message_endpoints_require_authentication(self):
        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                get_current_user(None, session)

        self.assertEqual(exc_info.exception.status_code, 401)
        self.assertEqual(exc_info.exception.detail, "not authenticated")

    def test_chat_message_endpoints_return_not_found_for_missing_chat(self):
        alice = self.create_user("alice")

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                get_chat_messages(
                    999999,
                    session.get(User, alice.user_id),
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 404)
        self.assertEqual(exc_info.exception.detail, "chat not found")

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                send_chat_message(
                    999999,
                    ChatMessageCreate(text="Нет такого чата"),
                    session.get(User, alice.user_id),
                    session,
                )

        self.assertEqual(exc_info.exception.status_code, 404)
        self.assertEqual(exc_info.exception.detail, "chat not found")


if __name__ == "__main__":
    unittest.main()
