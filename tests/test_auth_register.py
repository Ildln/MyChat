import unittest

from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine, select
from sqlalchemy.pool import StaticPool

import app.db as db_module
from app.models.user import User
from app.routers.auth import register
from app.schemas.auth import RegisterRequest


class RegisterAuthTests(unittest.TestCase):
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
        db_module.engine = self.original_engine

    def test_register_success(self):
        with Session(self.engine) as session:
            response = register(
                RegisterRequest(username="  alice  ", password="secret123"),
                session,
            )

        self.assertEqual(response.username, "alice")
        self.assertGreater(response.user_id, 0)
        self.assertTrue(response.access_token)
        self.assertEqual(response.token_type, "bearer")

        with Session(self.engine) as session:
            user = session.exec(select(User).where(User.username == "alice")).first()

        self.assertIsNotNone(user)
        self.assertIsNotNone(user.password_hash)
        self.assertNotEqual(user.password_hash, "secret123")

    def test_register_rejects_empty_username(self):
        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                register(RegisterRequest(username="   ", password="secret123"), session)

        self.assertEqual(exc_info.exception.status_code, 400)
        self.assertEqual(exc_info.exception.detail, "username must not be empty")

    def test_register_rejects_empty_password(self):
        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                register(RegisterRequest(username="alice", password=""), session)

        self.assertEqual(exc_info.exception.status_code, 400)
        self.assertEqual(exc_info.exception.detail, "password must not be empty")

    def test_register_rejects_duplicate_username(self):
        with Session(self.engine) as session:
            first_response = register(
                RegisterRequest(username="alice", password="secret123"),
                session,
            )

        with Session(self.engine) as session:
            with self.assertRaises(HTTPException) as exc_info:
                register(
                    RegisterRequest(username="alice", password="another-secret"),
                    session,
                )

        self.assertEqual(first_response.username, "alice")
        self.assertEqual(exc_info.exception.status_code, 400)
        self.assertEqual(exc_info.exception.detail, "username already exists")


if __name__ == "__main__":
    unittest.main()
