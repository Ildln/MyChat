import { apiRequest } from "./http";
import type { Chat } from "../types/chat";
import type { ChatMessage, ChatReadResponse } from "../types/message";

export function getChats() {
  return apiRequest<Chat[]>("/chats");
}

export function getChat(chatId: number) {
  return apiRequest<Chat>(`/chats/${chatId}`);
}

export function createDirectChat(userId: number) {
  return apiRequest<Chat>("/chats/direct", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export function createGroupChat(title: string, userIds: number[]) {
  return apiRequest<Chat>("/chats/group", {
    method: "POST",
    body: JSON.stringify({ title, user_ids: userIds }),
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

export function markChatRead(chatId: number) {
  return apiRequest<ChatReadResponse>(`/chats/${chatId}/read`, {
    method: "POST",
  });
}

export function addChatMembers(chatId: number, userIds: number[]) {
  return apiRequest<Chat>(`/chats/${chatId}/members`, {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export function leaveChat(chatId: number) {
  return apiRequest<{ message: string }>(`/chats/${chatId}/leave`, {
    method: "POST",
  });
}
