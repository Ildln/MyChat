from sqlalchemy import inspect, text

from app.db import engine


def add_columns_sqlite(connection) -> None:
    existing_columns = {
        row[1]
        for row in connection.exec_driver_sql('PRAGMA table_info("user")').fetchall()
    }

    columns = {
        "trusted_device_token_hash": 'ALTER TABLE "user" ADD COLUMN trusted_device_token_hash VARCHAR',
        "trusted_device_token_expires_at": 'ALTER TABLE "user" ADD COLUMN trusted_device_token_expires_at TIMESTAMP',
        "two_factor_enabled": 'ALTER TABLE "user" ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 0',
        "two_factor_secret": 'ALTER TABLE "user" ADD COLUMN two_factor_secret VARCHAR',
        "two_factor_pending_secret": 'ALTER TABLE "user" ADD COLUMN two_factor_pending_secret VARCHAR',
        "two_factor_backup_codes_hashes": 'ALTER TABLE "user" ADD COLUMN two_factor_backup_codes_hashes TEXT',
        "two_factor_login_challenge_hash": 'ALTER TABLE "user" ADD COLUMN two_factor_login_challenge_hash VARCHAR',
        "two_factor_login_challenge_expires_at": 'ALTER TABLE "user" ADD COLUMN two_factor_login_challenge_expires_at TIMESTAMP',
    }

    for column, sql in columns.items():
        if column not in existing_columns:
            print(f"[migration:add_user_two_factor_fields] adding {column} to sqlite user table")
            connection.exec_driver_sql(sql)


def add_columns_postgres(connection) -> None:
    print("[migration:add_user_two_factor_fields] ensuring postgres columns exist")
    statements = [
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS trusted_device_token_hash VARCHAR',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS trusted_device_token_expires_at TIMESTAMP',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS two_factor_pending_secret VARCHAR',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS two_factor_backup_codes_hashes TEXT',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS two_factor_login_challenge_hash VARCHAR',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS two_factor_login_challenge_expires_at TIMESTAMP',
    ]
    for statement in statements:
        connection.execute(text(statement))


def run() -> None:
    print("[migration:add_user_two_factor_fields] started")
    with engine.begin() as connection:
        inspector = inspect(connection)
        if "user" not in inspector.get_table_names():
            print("[migration:add_user_two_factor_fields] table 'user' not found, skip")
            return

        if connection.dialect.name == "sqlite":
            add_columns_sqlite(connection)
        else:
            add_columns_postgres(connection)

    print("[migration:add_user_two_factor_fields] finished")


if __name__ == "__main__":
    run()
