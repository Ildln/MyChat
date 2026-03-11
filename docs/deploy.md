# Deploy

## Что подготовлено в проекте

MyChat теперь умеет работать в двух режимах:

- локально через SQLite, как и раньше
- в проде через `DATABASE_URL` с PostgreSQL

Для JWT теперь используется `SECRET_KEY` из переменных окружения. Локально есть безопасный fallback для разработки, но в проде `SECRET_KEY` обязательно нужно задать явно.

## Какие env нужны

Минимальный набор:

- `DATABASE_URL`
- `SECRET_KEY`

Дополнительно:

- `PORT`
  Render передает его сам, вручную задавать обычно не нужно
- `SQL_ECHO`
  необязательный флаг для SQL-логов, в проде лучше не включать

## Как локально запускать проект

Если переменная `DATABASE_URL` не задана, проект использует:

```text
sqlite:///./mychat.db
```

Локальный запуск:

```bash
uvicorn app.main:app --reload
```

Если хотите локально проверить PostgreSQL-режим, можно задать env вручную:

```bash
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/DB
SECRET_KEY=your-local-secret
uvicorn app.main:app --reload
```

## Как деплоить на Render

В проект уже добавлен файл `render.yaml`, поэтому можно использовать Blueprint deploy.

Что делает `render.yaml`:

- создает Python web service
- создает PostgreSQL database
- передает `DATABASE_URL` из Render Postgres в приложение
- генерирует `SECRET_KEY`
- запускает приложение через `uvicorn`

## Как создать Postgres в Render

Если деплой через Blueprint:

- Render сам прочитает `render.yaml`
- база `mychat-db` будет описана в этом же файле

Если создавать сервис вручную:

1. создайте PostgreSQL database в Render
2. возьмите `Internal Database URL` или `External Database URL`
3. добавьте его в env приложения как `DATABASE_URL`

Для этого проекта лучше использовать внутренний URL между сервисами Render.

## Build и Start команды

Если используете `render.yaml`, команды уже описаны.

Если настраиваете web service вручную, укажите:

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Что важно для базы данных

В коде поддерживается такой порядок:

- если `DATABASE_URL` не задан, используется SQLite
- если `DATABASE_URL` начинается с `postgres://`, он автоматически нормализуется для SQLAlchemy и `psycopg`
- если `DATABASE_URL` начинается с `postgresql://`, он тоже автоматически переводится в формат `postgresql+psycopg://`

Это сделано для удобства деплоя на Render и сохранения локального SQLite-режима.

## Что важно для SECRET_KEY

В проде нельзя оставлять fallback-значение.

Для публичного деплоя обязательно:

- задать `SECRET_KEY` через env
- использовать длинное случайное значение
- не коммитить production secret в репозиторий

В `render.yaml` для `SECRET_KEY` уже включена генерация значения.

## Статика и UI

Дополнительная CORS-настройка для встроенного UI сейчас не нужна:

- backend и UI обслуживаются одним приложением
- `index.html` и API работают с одного origin
- WebSocket для direct chat использует тот же host, что и страница

Это позволяет оставить текущий фронт без отдельной прокси-схемы и без Docker.

## Что проверить после первого деплоя

1. Открывается главная страница `/`
2. Открывается Swagger `/docs`
3. Работает `GET /ping`
4. Работает регистрация нового пользователя
5. Работает логин
6. Работает `GET /auth/me`
7. Работает friends flow: заявка, accept, список друзей
8. Работает создание `direct chat`
9. Работает отправка и чтение сообщений через REST
10. Работает realtime через `/ws/chats/{chat_id}`

## Минимальный порядок первого деплоя

1. Запушить проект в GitHub
2. Создать Blueprint в Render из репозитория
3. Проверить, что подтянулись `DATABASE_URL` и `SECRET_KEY`
4. Дождаться первого деплоя
5. Открыть приложение по публичной ссылке
6. Пройти ручную проверку auth, friends, direct chats и realtime
