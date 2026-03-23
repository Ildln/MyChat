from sqlalchemy import inspect, text

from app.db import engine


def run() -> None:
    print("[migration:create_message_receipt_table] started")

    with engine.begin() as connection:
        dialect = connection.dialect.name
        inspector = inspect(connection)

        if "message_receipt" in set(inspector.get_table_names()):
            print("[migration:create_message_receipt_table] table already exists")
            return

        if dialect == "sqlite":
            connection.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS "message_receipt" (
                    id INTEGER PRIMARY KEY,
                    message_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    delivered_at DATETIME NULL,
                    read_at DATETIME NULL,
                    created_at DATETIME NOT NULL
                )
                """
            )
            print("[migration:create_message_receipt_table] sqlite table created")
            return

        if dialect.startswith("postgresql"):
            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS message_receipt (
                        id SERIAL PRIMARY KEY,
                        message_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        delivered_at TIMESTAMP WITH TIME ZONE NULL,
                        read_at TIMESTAMP WITH TIME ZONE NULL,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL
                    )
                    """
                )
            )
            print("[migration:create_message_receipt_table] postgres table created")
            return

        raise RuntimeError(f"unsupported database dialect: {dialect}")


if __name__ == "__main__":
    run()
