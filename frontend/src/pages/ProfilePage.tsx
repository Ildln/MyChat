import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";

import { changePassword, disableTwoFactor, enableTwoFactor, setupTwoFactor } from "../api/auth";
import { updateCurrentUser } from "../api/users";
import { PushNotificationsCard } from "../components/PushNotificationsCard";
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
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [twoFactorQrUrl, setTwoFactorQrUrl] = useState("");
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [disableTwoFactorPassword, setDisableTwoFactorPassword] = useState("");
  const [disableTwoFactorCode, setDisableTwoFactorCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isSettingUpTwoFactor, setIsSettingUpTwoFactor] = useState(false);
  const [isSubmittingTwoFactor, setIsSubmittingTwoFactor] = useState(false);

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

  async function handleChangePassword() {
    if (newPassword !== confirmNewPassword) {
      setStatus("Новые пароли не совпадают.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось изменить пароль.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleSetupTwoFactor() {
    setIsSettingUpTwoFactor(true);
    try {
      const response = await setupTwoFactor();
      setTwoFactorSecret(response.secret);
      setTwoFactorCode("");
      setBackupCodes([]);
      setTwoFactorQrUrl(await QRCode.toDataURL(response.otpauth_uri, { margin: 1, width: 220 }));
      setStatus("Отсканируйте QR-код в приложении Authenticator и подтвердите кодом ниже.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось подготовить 2FA.");
    } finally {
      setIsSettingUpTwoFactor(false);
    }
  }

  async function handleEnableTwoFactor() {
    setIsSubmittingTwoFactor(true);
    try {
      const response = await enableTwoFactor({ code: twoFactorCode });
      setBackupCodes(response.backup_codes);
      setTwoFactorCode("");
      await refreshUser();
      setStatus(response.message + " Сохраните backup codes в безопасном месте.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось включить 2FA.");
    } finally {
      setIsSubmittingTwoFactor(false);
    }
  }

  async function handleDisableTwoFactor() {
    setIsSubmittingTwoFactor(true);
    try {
      const response = await disableTwoFactor({
        password: disableTwoFactorPassword || undefined,
        code: disableTwoFactorCode || undefined,
      });
      setDisableTwoFactorPassword("");
      setDisableTwoFactorCode("");
      setTwoFactorSecret("");
      setTwoFactorQrUrl("");
      setBackupCodes([]);
      await refreshUser();
      setStatus(response.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось отключить 2FA.");
    } finally {
      setIsSubmittingTwoFactor(false);
    }
  }

  async function handleLogout() {
    await logout();
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

        <div className="mt-6">
          <PushNotificationsCard />
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-sm text-zinc-400">Двухфакторная аутентификация</div>
          <div className="mt-2 text-base text-white">{user?.two_factor_enabled ? "2FA включена" : "2FA выключена"}</div>
          {!user?.two_factor_enabled ? (
            <>
              <div className="mt-3 text-sm leading-6 text-zinc-400">
                Подключите Google Authenticator, Microsoft Authenticator или любое совместимое TOTP-приложение.
              </div>
              {!twoFactorSecret ? (
                <button
                  className="mt-4 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
                  disabled={isSettingUpTwoFactor}
                  onClick={() => void handleSetupTwoFactor()}
                  type="button"
                >
                  {isSettingUpTwoFactor ? "Подготавливаем..." : "Включить 2FA"}
                </button>
              ) : (
                <div className="mt-4 space-y-4">
                  {twoFactorQrUrl ? <img alt="QR для 2FA" className="rounded-2xl border border-zinc-800 bg-white p-3" src={twoFactorQrUrl} /> : null}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
                    Secret: <span className="break-all text-white">{twoFactorSecret}</span>
                  </div>
                  <input
                    className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
                    onChange={(event) => setTwoFactorCode(event.target.value)}
                    placeholder="Введите 6-значный код"
                    type="text"
                    value={twoFactorCode}
                  />
                  <button
                    className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
                    disabled={isSubmittingTwoFactor}
                    onClick={() => void handleEnableTwoFactor()}
                    type="button"
                  >
                    {isSubmittingTwoFactor ? "Проверяем..." : "Подтвердить и включить"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="text-sm leading-6 text-zinc-400">
                Для отключения 2FA укажите текущий пароль или действующий 2FA/backup code.
              </div>
              <input
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
                onChange={(event) => setDisableTwoFactorPassword(event.target.value)}
                placeholder="Текущий пароль"
                type="password"
                value={disableTwoFactorPassword}
              />
              <input
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
                onChange={(event) => setDisableTwoFactorCode(event.target.value)}
                placeholder="Или код из Authenticator / backup code"
                type="text"
                value={disableTwoFactorCode}
              />
              <button
                className="rounded-2xl border border-rose-900 bg-rose-950/40 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-950/70 disabled:opacity-60"
                disabled={isSubmittingTwoFactor}
                onClick={() => void handleDisableTwoFactor()}
                type="button"
              >
                {isSubmittingTwoFactor ? "Отключаем..." : "Отключить 2FA"}
              </button>
            </div>
          )}

          {backupCodes.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-700/40 bg-amber-950/30 p-4 text-sm text-amber-100">
              <div className="font-semibold">Backup codes</div>
              <div className="mt-2 text-amber-200">Они показываются только один раз. Сохраните их в безопасном месте.</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {backupCodes.map((code) => (
                  <div className="rounded-xl border border-amber-800/40 bg-black/20 px-3 py-2 font-mono" key={code}>
                    {code}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="text-sm text-zinc-400">Сменить пароль</div>
          <div className="mt-4 space-y-4">
            <input
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
              onChange={(event) => setOldPassword(event.target.value)}
              placeholder="Старый пароль"
              type="password"
              value={oldPassword}
            />
            <input
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Новый пароль"
              type="password"
              value={newPassword}
            />
            <input
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-zinc-500"
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              placeholder="Повторите новый пароль"
              type="password"
              value={confirmNewPassword}
            />
            <button
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
              disabled={isChangingPassword}
              onClick={() => void handleChangePassword()}
              type="button"
            >
              {isChangingPassword ? "Сохраняем..." : "Изменить пароль"}
            </button>
          </div>
        </div>

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
