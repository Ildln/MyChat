from sqlalchemy import inspect, text

from app.db import engine


def run() -> None:
    print("[migration:add_chat_title] started")

    with engine.begin() as connection:
        dialect = connection.dialect.name
        inspector = inspect(connection)
        table_names = set(inspector.get_table_names())

        if "chat" not in table_names:
            print("[migration:add_chat_title] table 'chat' not found, skip")
            return

        if dialect == "sqlite":
            columns = {column["name"] for column in inspector.get_columns("chat")}

            if "title" not in columns:
                print("[migration:add_chat_title] adding column 'title' to sqlite table 'chat'")
                connection.exec_driver_sql('ALTER TABLE "chat" ADD COLUMN title VARCHAR')
            else:
                print("[migration:add_chat_title] column 'title' already exists in sqlite table 'chat'")
            return

        if dialect.startswith("postgresql"):
            print("[migration:add_chat_title] ensuring column 'title' exists in postgres table 'chat'")
            connection.execute(text('ALTER TABLE "chat" ADD COLUMN IF NOT EXISTS title VARCHAR'))
            print("[migration:add_chat_title] postgres migration finished")
            return

        raise RuntimeError(f"unsupported database dialect: {dialect}")


if __name__ == "__main__":
    run()
