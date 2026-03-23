from sqlalchemy import inspect, text

from app.db import engine


def add_columns_sqlite(connection) -> None:
    existing_columns = {
        row[1]
        for row in connection.exec_driver_sql('PRAGMA table_info("user")').fetchall()
    }

    if "refresh_token_hash" not in existing_columns:
        print("[migration:add_user_refresh_fields] adding refresh_token_hash to sqlite user table")
        connection.exec_driver_sql('ALTER TABLE "user" ADD COLUMN refresh_token_hash VARCHAR')

    if "refresh_token_expires_at" not in existing_columns:
        print("[migration:add_user_refresh_fields] adding refresh_token_expires_at to sqlite user table")
        connection.exec_driver_sql('ALTER TABLE "user" ADD COLUMN refresh_token_expires_at TIMESTAMP')


def add_columns_postgres(connection) -> None:
    print("[migration:add_user_refresh_fields] ensuring postgres columns exist")
    connection.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR'))
    connection.execute(text('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMP'))


def run() -> None:
    print("[migration:add_user_refresh_fields] started")
    with engine.begin() as connection:
        inspector = inspect(connection)
        if "user" not in inspector.get_table_names():
            print("[migration:add_user_refresh_fields] table 'user' not found, skip")
            return

        if connection.dialect.name == "sqlite":
            add_columns_sqlite(connection)
        else:
            add_columns_postgres(connection)

    print("[migration:add_user_refresh_fields] finished")


if __name__ == "__main__":
    run()
