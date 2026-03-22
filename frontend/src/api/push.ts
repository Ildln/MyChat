import { apiRequest } from "./http";

export function getVapidPublicKey() {
  return apiRequest<{ public_key: string }>("/push/vapid-public-key");
}

export function savePushSubscription(payload: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  return apiRequest<{ id: number; endpoint: string }>("/push/subscriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deletePushSubscription(endpoint: string) {
  return apiRequest<void>("/push/subscriptions", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}
