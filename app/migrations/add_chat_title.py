from sqlalchemy import text

from app.db import engine


def run() -> None:
    with engine.begin() as connection:
        dialect = connection.dialect.name

        if dialect == "sqlite":
            columns = {
                row[1]
                for row in connection.exec_driver_sql('PRAGMA table_info("chat")').fetchall()
            }

            if "title" not in columns:
                connection.exec_driver_sql('ALTER TABLE "chat" ADD COLUMN title VARCHAR')
            return

        if dialect.startswith("postgresql"):
            connection.execute(text('ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS title VARCHAR'))
            return

        raise RuntimeError(f"unsupported database dialect: {dialect}")


if __name__ == "__main__":
    run()
