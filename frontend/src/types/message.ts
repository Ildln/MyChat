export interface ChatMessage {
  id: number;
  chat_id: number;
  user_id: number;
  text: string;
  created_at: string;
}

export interface ChatHistoryEvent {
  type: "history";
  chat_id: number;
  items: ChatMessage[];
}

export interface ChatMessageEvent extends ChatMessage {
  type: "message";
}
