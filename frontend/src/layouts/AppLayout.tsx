import { Link, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

export function AppLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="border-b border-zinc-800 bg-zinc-950/90 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">MyChat</h1>
            <p className="text-sm text-zinc-400">
              {user ? `Вы вошли как ${user.username}` : "Мессенджер для друзей"}
            </p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-zinc-300">
            <Link className="rounded-full border border-zinc-800 px-3 py-1.5 hover:border-zinc-700 hover:text-white" to="/">
              Главная
            </Link>
            <Link className="rounded-full border border-zinc-800 px-3 py-1.5 hover:border-zinc-700 hover:text-white" to="/profile">
              Профиль
            </Link>
            <button
              className="rounded-full border border-zinc-800 px-3 py-1.5 hover:border-zinc-700 hover:text-white"
              onClick={handleLogout}
              type="button"
            >
              Выйти
            </button>
          </nav>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
