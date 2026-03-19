import { env } from "./env";
import { getAccessToken } from "./storage";

export function buildChatWebSocketUrl(chatId: number): string {
  const token = encodeURIComponent(getAccessToken());
  return `${env.wsBaseUrl}/ws/chats/${chatId}?token=${token}`;
}
