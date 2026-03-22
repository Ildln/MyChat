from sqlalchemy import text

from app.db import engine


def run() -> None:
    with engine.begin() as connection:
        dialect = connection.dialect.name

        if dialect == "sqlite":
            columns = {
                row[1]
                for row in connection.exec_driver_sql('PRAGMA table_info("user")').fetchall()
            }

            if "avatar_url" not in columns:
                connection.exec_driver_sql('ALTER TABLE "user" ADD COLUMN avatar_url VARCHAR')
            if "about" not in columns:
                connection.exec_driver_sql('ALTER TABLE "user" ADD COLUMN about VARCHAR')
            if "last_seen_at" not in columns:
                connection.exec_driver_sql('ALTER TABLE "user" ADD COLUMN last_seen_at DATETIME')
            return

        if dialect.startswith("postgresql"):
            connection.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS avatar_url VARCHAR'))
            connection.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS about VARCHAR'))
            connection.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE'))
            return

        raise RuntimeError(f"unsupported database dialect: {dialect}")


if __name__ == "__main__":
    run()
