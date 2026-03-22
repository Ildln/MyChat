import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { updateCurrentUser } from "../api/users";
import { UserAvatar } from "../components/UserAvatar";
import { useAuth } from "../hooks/useAuth";
import { getPresenceLabel } from "../lib/format";
import { getUserAbout } from "../lib/profile";

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [draftAbout, setDraftAbout] = useState("");
  const [draftAvatarUrl, setDraftAvatarUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setDraftAbout(user?.about || "");
    setDraftAvatarUrl(user?.avatar_url || "");
  }, [user?.about, user?.avatar_url, user?.id]);

  async function handleRefresh() {
    await refreshUser();
    setStatus("Профиль обновлён.");
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateCurrentUser({ about: draftAbout, avatar_url: draftAvatarUrl });
      await refreshUser();
      setIsEditing(false);
      setStatus("Профиль сохранён.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось сохранить профиль.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-4xl p-4 md:p-6">
      <div className="w-full rounded-3xl border border-zinc-800 bg-zinc-900 p-5 md:p-8">
        {status ? (
          <div className="mb-4 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-zinc-300">{status}</div>
        ) : null}

        <div className="flex flex-col items-center text-center">
          <UserAvatar avatarUrl={user?.avatar_url} name={user?.username || "Пользователь"} seed={user?.id || 0} size="xl" />
          <h2 className="mt-5 text-2xl font-semibold text-white">{user?.username || "Пользователь"}</h2>
          <div className="mt-2 text-sm text-zinc-400">{getPresenceLabel(user)}</div>
          <div className="mt-2 text-sm text-zinc-500">ID: {user?.id ?? "—"}</div>
        </div>

        {!isEditing ? (
          <div className="mt-6 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div>
              <div className="text-sm text-zinc-400">О себе</div>
              <div className="mt-2 text-base text-white">{getUserAbout(user || null)}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-400">Аватарка</div>
              <div className="mt-2 break-all text-sm text-zinc-300">{user?.avatar_url || "Используется fallback-аватарка"}</div>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div>
              <div className="mb-2 text-sm text-zinc-400">Ссылка на аватарку</div>
              <input
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
                onChange={(event) => setDraftAvatarUrl(event.target.value)}
                placeholder="https://..."
                value={draftAvatarUrl}
              />
            </div>
            <div>
              <div className="mb-2 text-sm text-zinc-400">О себе</div>
              <textarea
                className="min-h-[120px] w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
                onChange={(event) => setDraftAbout(event.target.value)}
                placeholder="Расскажите о себе"
                value={draftAbout}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          {!isEditing ? (
            <button
              className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white transition hover:border-zinc-500"
              onClick={() => setIsEditing(true)}
              type="button"
            >
              Редактировать профиль
            </button>
          ) : (
            <>
              <button
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
                disabled={isSaving}
                onClick={() => void handleSave()}
                type="button"
              >
                {isSaving ? "Сохраняем..." : "Сохранить"}
              </button>
              <button
                className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-white transition hover:border-zinc-500"
                onClick={() => {
                  setIsEditing(false);
                  setDraftAbout(user?.about || "");
                  setDraftAvatarUrl(user?.avatar_url || "");
                }}
                type="button"
              >
                Отмена
              </button>
            </>
          )}
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
