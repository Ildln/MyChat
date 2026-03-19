import { apiRequest } from "./http";
import type { Chat } from "../types/chat";
import type { ChatMessage } from "../types/message";

export function getChats() {
  return apiRequest<Chat[]>("/chats");
}

export function createDirectChat(userId: number) {
  return apiRequest<Chat>("/chats/direct", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export function getChatMessages(chatId: number) {
  return apiRequest<ChatMessage[]>(`/chats/${chatId}/messages`);
}

export function sendChatMessage(chatId: number, text: string) {
  return apiRequest<ChatMessage>(`/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
