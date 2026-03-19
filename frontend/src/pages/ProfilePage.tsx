import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();

  async function handleRefresh() {
    await refreshUser();
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-4xl p-4 md:p-6">
      <div className="w-full rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-semibold">Профиль</h2>
        <div className="mt-4 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-sm text-zinc-400">Текущий пользователь</div>
          <div className="text-base text-white">{user?.username || "Неизвестный пользователь"}</div>
          <div className="text-sm text-zinc-500">ID: {user?.id ?? "—"}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white transition hover:border-zinc-500"
            onClick={handleRefresh}
            type="button"
          >
            Обновить профиль
          </button>
          <button
            className="rounded-2xl border border-rose-900 bg-rose-950/40 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-950/70"
            onClick={handleLogout}
            type="button"
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}
