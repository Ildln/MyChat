# Frontend

Новый frontend для MyChat находится в отдельной папке `frontend/`.

Стек:

- React
- Vite
- TypeScript
- Tailwind CSS
- React Router

## Переменные окружения

Создайте файл `.env.local` на основе `.env.example`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_BASE_URL=ws://127.0.0.1:8000
```

## Команды

Установка зависимостей:

```bash
npm install
```

Запуск dev-сервера:

```bash
npm run dev
```

Сборка:

```bash
npm run build
```

## Текущий статус

На этом шаге подготовлен базовый каркас frontend и структура проекта.
