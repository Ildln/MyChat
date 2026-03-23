import { env } from "./env";
import { getAccessToken } from "./storage";

function normalizeWsBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, "");
  if (normalized.startsWith("https://")) {
    return normalized.replace("https://", "wss://");
  }
  if (normalized.startsWith("http://")) {
    return normalized.replace("http://", "ws://");
  }
  return normalized;
}

export function buildChatWebSocketUrl(chatId: number): string {
  const token = encodeURIComponent(getAccessToken());
  return `${normalizeWsBaseUrl(env.wsBaseUrl)}/ws/chats/${chatId}?token=${token}`;
}

export function buildNotificationsWebSocketUrl(): string {
  const token = encodeURIComponent(getAccessToken());
  return `${normalizeWsBaseUrl(env.wsBaseUrl)}/ws/notifications?token=${token}`;
}
