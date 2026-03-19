export function ProfilePage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-4xl p-4 md:p-6">
      <div className="w-full rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-semibold">Профиль</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Здесь будут данные текущего пользователя, logout и список друзей.
        </p>
      </div>
    </div>
  );
}
