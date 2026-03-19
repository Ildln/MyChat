export function HomePage() {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-7xl grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-semibold">Заявки и чаты</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Здесь будут заявки в друзья, список чатов и создание direct chat.
        </p>
      </section>
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-semibold">Выбранный чат</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Здесь будет история сообщений, отправка сообщений и realtime через существующий WebSocket.
        </p>
      </section>
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-semibold">Профиль и друзья</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Здесь будут профиль текущего пользователя, список друзей и действия аккаунта.
        </p>
      </section>
    </div>
  );
}
