import { Link } from "react-router-dom";

export function LoginPage() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="block text-sm text-zinc-300">Имя пользователя</label>
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-600"
          placeholder="Введите имя пользователя"
          type="text"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm text-zinc-300">Пароль</label>
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-600"
          placeholder="Введите пароль"
          type="password"
        />
      </div>
      <button className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200">
        Войти
      </button>
      <p className="text-center text-sm text-zinc-400">
        Нет аккаунта?{" "}
        <Link className="text-white hover:text-zinc-300" to="/register">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}
