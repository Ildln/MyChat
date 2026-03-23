import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { resetPassword } from "../api/auth";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setToken(searchParams.get("token") || "");
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setStatus("Пароли не совпадают.");
      return;
    }

    setIsSubmitting(true);
    setStatus("");

    try {
      const response = await resetPassword({
        token,
        password,
        confirm_password: confirmPassword,
      });
      setStatus(response.message);
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось обновить пароль.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm text-zinc-300">Reset token</label>
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-600"
          onChange={(event) => setToken(event.target.value)}
          placeholder="Вставьте reset token"
          type="text"
          value={token}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm text-zinc-300">Новый пароль</label>
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-600"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Введите новый пароль"
          type="password"
          value={password}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm text-zinc-300">Повторите новый пароль</label>
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-600"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Повторите новый пароль"
          type="password"
          value={confirmPassword}
        />
      </div>

      {status ? <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-zinc-200">{status}</div> : null}

      <button
        className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Сохраняем..." : "Сохранить новый пароль"}
      </button>

      <p className="text-center text-sm text-zinc-400">
        <Link className="text-white hover:text-zinc-300" to="/login">
          Вернуться ко входу
        </Link>
      </p>
    </form>
  );
}
