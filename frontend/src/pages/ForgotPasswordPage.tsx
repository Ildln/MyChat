import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { requestPasswordReset } from "../api/auth";

export function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("");
  const [devResetToken, setDevResetToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");
    setDevResetToken("");

    try {
      const response = await requestPasswordReset({ username });
      setStatus(response.message);
      setDevResetToken(response.reset_token || "");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось подготовить сброс пароля.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm text-zinc-300">Имя пользователя</label>
        <input
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-600"
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Введите имя пользователя"
          type="text"
          value={username}
        />
      </div>

      {status ? <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-zinc-200">{status}</div> : null}

      {devResetToken ? (
        <div className="rounded-2xl border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          <div className="font-semibold">Локальный dev-режим</div>
          <div className="mt-2 break-all">Reset token: {devResetToken}</div>
          <Link className="mt-3 inline-block text-white underline hover:text-zinc-300" to={`/reset-password?token=${encodeURIComponent(devResetToken)}`}>
            Перейти к сбросу пароля
          </Link>
        </div>
      ) : null}

      <button
        className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Подготавливаем..." : "Сбросить пароль"}
      </button>

      <p className="text-center text-sm text-zinc-400">
        Вспомнили пароль?{" "}
        <Link className="text-white hover:text-zinc-300" to="/login">
          Вернуться ко входу
        </Link>
      </p>
    </form>
  );
}
