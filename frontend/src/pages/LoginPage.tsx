import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, twoFactorChallenge, verifyTwoFactor, cancelTwoFactor } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    try {
      const authenticated = await login({ username, password });
      if (authenticated) {
        const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";
        navigate(nextPath, { replace: true });
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось выполнить вход.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTwoFactorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    try {
      await verifyTwoFactor(twoFactorCode, rememberDevice);
      const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";
      navigate(nextPath, { replace: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось подтвердить код.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (twoFactorChallenge) {
    return (
      <form className="space-y-5" onSubmit={handleTwoFactorSubmit}>
        <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-zinc-300">
          Для пользователя <span className="font-semibold text-white">{twoFactorChallenge.username}</span> включена двухфакторная аутентификация.
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-zinc-300">6-значный код или backup code</label>
          <input
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-600"
            placeholder="Введите код"
            type="text"
            value={twoFactorCode}
            onChange={(event) => setTwoFactorCode(event.target.value)}
          />
        </div>
        <label className="flex items-center gap-3 text-sm text-zinc-300">
          <input
            checked={rememberDevice}
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
            onChange={(event) => setRememberDevice(event.target.checked)}
            type="checkbox"
          />
          Запомнить это устройство на 30 дней
        </label>
        {status ? <div className="rounded-2xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{status}</div> : null}
        <button
          className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Проверяем..." : "Подтвердить вход"}
        </button>
        <button
          className="w-full rounded-2xl border border-zinc-800 px-4 py-3 text-sm text-white transition hover:border-zinc-600"
          disabled={isSubmitting}
          onClick={cancelTwoFactor}
          type="button"
        >
          Назад
        </button>
      </form>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm text-zinc-300">Имя пользователя</label>
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-600"
          placeholder="Введите имя пользователя"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm text-zinc-300">Пароль</label>
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-600"
          placeholder="Введите пароль"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {status ? <div className="rounded-2xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{status}</div> : null}
      <button
        className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Входим..." : "Войти"}
      </button>
      <p className="text-center text-sm text-zinc-400">
        Нет аккаунта?{" "}
        <Link className="text-white hover:text-zinc-300" to="/register">
          Зарегистрироваться
        </Link>
      </p>
      <p className="text-center text-sm text-zinc-400">
        <Link className="text-white hover:text-zinc-300" to="/forgot-password">
          Забыли пароль?
        </Link>
      </p>
    </form>
  );
}
