import type { User } from "./user";

export interface ChatLastMessage {
  id: number;
  user_id: number;
  text: string;
  created_at: string;
  author_username: string;
  author_avatar_url?: string | null;
}

export interface Chat {
  id: number;
  type: string;
  title?: string | null;
  created_at: string;
  members: User[];
  unread_count: number;
  last_message?: ChatLastMessage | null;
}
