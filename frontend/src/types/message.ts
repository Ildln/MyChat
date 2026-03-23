export interface ChatMessage {
  id: number;
  chat_id: number;
  user_id: number;
  text: string;
  created_at: string;
  author_username: string;
  author_avatar_url?: string | null;
  delivery_status?: "sent" | "delivered" | "read" | null;
}

export interface ChatHistoryEvent {
  type: "history";
  chat_id: number;
  items: ChatMessage[];
}

export interface ChatMessageEvent extends ChatMessage {
  type: "message";
}

export interface ChatMessageDeliveredEvent {
  type: "message_delivered";
  chat_id: number;
  message_ids: number[];
  user_ids: number[];
}

export interface ChatMessageReadEvent {
  type: "message_read";
  chat_id: number;
  message_ids: number[];
  user_id: number;
}

export interface ChatReadResponse {
  chat_id: number;
  unread_count: number;
}
