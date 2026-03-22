import { usePushNotifications } from "../hooks/usePushNotifications";

type PushNotificationsCardProps = {
  compact?: boolean;
};

export function PushNotificationsCard({ compact = false }: PushNotificationsCardProps) {
  const push = usePushNotifications();

  return (
    <div className="rounded-[24px] border border-white/6 bg-[#171718] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.24)]">
      <div className="text-[15px] font-semibold text-white">Push-уведомления</div>
      <div className="mt-2 text-base text-white">
        {push.uiState === "unsupported" ? "Не поддерживаются" : push.isSubscribed ? "Включены" : "Выключены"}
      </div>
      <div className={`mt-2 text-sm leading-6 text-zinc-400 ${compact ? "" : "max-w-[320px]"}`}>
        {push.uiState === "unsupported"
          ? "Этот браузер не поддерживает web push."
          : push.uiState === "denied"
            ? "Доступ к уведомлениям запрещён в настройках браузера."
            : push.iosNeedsStandalone
              ? "Для iPhone: сначала добавьте MyChat на экран домой и откройте его как приложение."
              : "Уведомления будут приходить о новых сообщениях, даже если чат не открыт."}
      </div>

      {push.status ? <div className="mt-3 text-sm text-zinc-300">{push.status}</div> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-[16px] bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
          disabled={push.isBusy || push.uiState === "unsupported" || push.uiState === "denied"}
          onClick={() => void push.enable()}
          type="button"
        >
          {push.isBusy ? "Подождите..." : "Включить уведомления"}
        </button>
        <button
          className="rounded-[16px] bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12 disabled:opacity-60"
          disabled={push.isBusy || !push.isSubscribed}
          onClick={() => void push.disable()}
          type="button"
        >
          Отключить уведомления
        </button>
      </div>
    </div>
  );
}
