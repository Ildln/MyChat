import type { Chat } from "../types/chat";

export function getChatTitle(chat: Chat, currentUserId?: number | null): string {
  const otherMembers = chat.members.filter((member) => member.id !== currentUserId);
  if (otherMembers.length === 0) {
    return `Чат #${chat.id}`;
  }
  return otherMembers.map((member) => member.username).join(", ");
}

export function getChatSubtitle(chat: Chat): string {
  return `Direct chat • участников: ${chat.members.length}`;
}
