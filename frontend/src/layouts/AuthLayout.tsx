import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6 py-10">
        <div className="w-full rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl shadow-black/30">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">MyChat</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Новый frontend для MyChat. На следующем шаге сюда будет подключен рабочий auth flow.
            </p>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
