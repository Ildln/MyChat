import { useCallback, useEffect, useMemo, useState } from "react";

import { deletePushSubscription, getVapidPublicKey, savePushSubscription } from "../api/push";
import { isIosDevice, isPushSupported, isStandalonePwa, urlBase64ToUint8Array } from "../lib/push";

type PushUiState = "unsupported" | "default" | "granted" | "denied";

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState("");

  const supported = isPushSupported();
  const iosNeedsStandalone = supported && isIosDevice() && !isStandalonePwa();

  const refresh = useCallback(async () => {
    if (!supported) {
      return;
    }

    setPermission(Notification.permission);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(Boolean(subscription));
    } catch {
      setIsSubscribed(false);
    }
  }, [supported]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const uiState = useMemo<PushUiState>(() => {
    if (!supported) {
      return "unsupported";
    }

    return permission;
  }, [permission, supported]);

  const enable = useCallback(async () => {
    if (!supported) {
      setStatus("Push-уведомления не поддерживаются в этом браузере.");
      return;
    }

    if (iosNeedsStandalone) {
      setStatus("На iPhone сначала добавьте MyChat на экран домой, затем откройте приложение как PWA.");
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        setStatus(nextPermission === "denied" ? "Доступ к уведомлениям запрещён." : "Разрешение на уведомления не выдано.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array((await getVapidPublicKey()).public_key),
      });

      const json = subscription.toJSON();
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;

      if (!subscription.endpoint || !p256dh || !auth) {
        throw new Error("Браузер не вернул корректную push subscription.");
      }

      await savePushSubscription({
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      });

      setIsSubscribed(true);
      setStatus("Push-уведомления включены.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось включить уведомления.");
    } finally {
      setIsBusy(false);
    }
  }, [iosNeedsStandalone, supported]);

  const disable = useCallback(async () => {
    if (!supported) {
      return;
    }

    setIsBusy(true);
    setStatus("");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setStatus("Push-уведомления отключены.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось отключить уведомления.");
    } finally {
      setIsBusy(false);
    }
  }, [supported]);

  return {
    supported,
    iosNeedsStandalone,
    permission,
    uiState,
    isSubscribed,
    isBusy,
    status,
    enable,
    disable,
    refresh,
  };
}
