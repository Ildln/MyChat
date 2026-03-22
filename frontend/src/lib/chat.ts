import type { Chat } from "../types/chat";

export function getChatTitle(chat: Chat, currentUserId?: number | null): string {
  if (chat.type === "group" && chat.title?.trim()) {
    return chat.title.trim();
  }

  const otherMembers = chat.members.filter((member) => member.id !== currentUserId);
  if (otherMembers.length === 0) {
    return `Чат #${chat.id}`;
  }
  return otherMembers.map((member) => member.username).join(", ");
}

export function getChatSubtitle(chat: Chat): string {
  if (chat.type === "group") {
    return `Групповая беседа • участников: ${chat.members.length}`;
  }

  return `Direct chat • участников: ${chat.members.length}`;
}
