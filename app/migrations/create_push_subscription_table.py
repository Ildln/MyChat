from sqlalchemy import inspect, text

from app.db import engine


def run() -> None:
    print("[migration:create_push_subscription_table] started")

    with engine.begin() as connection:
        dialect = connection.dialect.name
        inspector = inspect(connection)

        if "push_subscription" in set(inspector.get_table_names()):
            print("[migration:create_push_subscription_table] table already exists")
            return

        if dialect == "sqlite":
            connection.exec_driver_sql(
                """
                CREATE TABLE IF NOT EXISTS "push_subscription" (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    endpoint VARCHAR NOT NULL,
                    p256dh VARCHAR NOT NULL,
                    auth VARCHAR NOT NULL,
                    created_at DATETIME NOT NULL
                )
                """
            )
            print("[migration:create_push_subscription_table] sqlite table created")
            return

        if dialect.startswith("postgresql"):
            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS push_subscription (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        endpoint VARCHAR NOT NULL,
                        p256dh VARCHAR NOT NULL,
                        auth VARCHAR NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE NOT NULL
                    )
                    """
                )
            )
            print("[migration:create_push_subscription_table] postgres table created")
            return

        raise RuntimeError(f"unsupported database dialect: {dialect}")


if __name__ == "__main__":
    run()
