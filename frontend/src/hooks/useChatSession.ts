import { useCallback, useEffect, useRef, useState } from "react";

import { getChatMessages, markChatRead as markChatReadRequest, sendChatMessage } from "../api/chats";
import { buildChatWebSocketUrl } from "../lib/ws";
import type {
  ChatHistoryEvent,
  ChatMessage,
  ChatMessageDeliveredEvent,
  ChatMessageEvent,
  ChatMessageReadEvent,
} from "../types/message";

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<number, ChatMessage>();

  for (const message of current) {
    byId.set(message.id, message);
  }

  for (const message of incoming) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort((left, right) => left.id - right.id);
}

function applyDelivered(messages: ChatMessage[], event: ChatMessageDeliveredEvent) {
  return messages.map((message) => {
    if (!event.message_ids.includes(message.id)) {
      return message;
    }

    if (message.delivery_status === "read") {
      return message;
    }

    return {
      ...message,
      delivery_status: "delivered" as const,
    };
  });
}

function applyRead(messages: ChatMessage[], event: ChatMessageReadEvent) {
  return messages.map((message) => {
    if (!event.message_ids.includes(message.id)) {
      return message;
    }

    return {
      ...message,
      delivery_status: "read" as const,
    };
  });
}

export function useChatSession(chatId: number | null) {
  const socketRef = useRef<WebSocket | null>(null);
  const activeChatIdRef = useRef<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Выберите чат, чтобы подключить realtime.");

  const closeSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    socketRef.current = null;
    activeChatIdRef.current = null;
  }, []);

  const confirmRead = useCallback(async (targetChatId: number) => {
    try {
      await markChatReadRequest(targetChatId);
    } catch {
      // Ничего не делаем: unread всё равно подтянется при следующем обновлении списка чатов.
    }
  }, []);

  const loadHistory = useCallback(async (targetChatId: number) => {
    const history = await getChatMessages(targetChatId);
    setMessages(history);
    return history;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connectToChat(targetChatId: number) {
      setIsLoading(true);
      setConnectionStatus("Загружаем историю сообщений...");

      try {
        await loadHistory(targetChatId);
        if (cancelled) {
          return;
        }

        if (typeof document === "undefined" || document.visibilityState === "visible") {
          void confirmRead(targetChatId);
        }

        setConnectionStatus("Подключаем realtime-соединение...");
        closeSocket();

        const socket = new WebSocket(buildChatWebSocketUrl(targetChatId));
        socketRef.current = socket;
        activeChatIdRef.current = targetChatId;

        socket.addEventListener("open", () => {
          if (cancelled || activeChatIdRef.current !== targetChatId) {
            return;
          }
          setConnectionStatus("Соединение активно.");
        });

        socket.addEventListener("message", (event) => {
          if (cancelled || activeChatIdRef.current !== targetChatId) {
            return;
          }

          try {
            const payload = JSON.parse(event.data) as
              | ChatHistoryEvent
              | ChatMessageEvent
              | ChatMessageDeliveredEvent
              | ChatMessageReadEvent;

            if (payload.type === "history") {
              setMessages((current) => mergeMessages(current, payload.items));
              return;
            }

            if (payload.type === "message") {
              const message = payload as ChatMessage;
              setMessages((current) => mergeMessages(current, [message]));
              if (typeof document === "undefined" || document.visibilityState === "visible") {
                void confirmRead(targetChatId);
              }
              return;
            }

            if (payload.type === "message_delivered") {
              setMessages((current) => applyDelivered(current, payload));
              return;
            }

            if (payload.type === "message_read") {
              setMessages((current) => applyRead(current, payload));
            }
          } catch {
            setConnectionStatus("Не удалось обработать сообщение. Используется обычный режим.");
          }
        });

        socket.addEventListener("error", () => {
          if (cancelled || activeChatIdRef.current !== targetChatId) {
            return;
          }
          setConnectionStatus("Realtime недоступен. Используется обычный режим.");
        });

        socket.addEventListener("close", () => {
          if (cancelled || activeChatIdRef.current !== targetChatId) {
            return;
          }
          socketRef.current = null;
          activeChatIdRef.current = null;
          setConnectionStatus("Соединение закрыто. Используется обычный режим.");
        });
      } catch {
        if (!cancelled) {
          setMessages([]);
          setConnectionStatus("Не удалось загрузить чат.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (!chatId) {
      setMessages([]);
      setIsLoading(false);
      closeSocket();
      setConnectionStatus("Выберите чат, чтобы подключить realtime.");
      return () => {
        cancelled = true;
      };
    }

    void connectToChat(chatId);

    return () => {
      cancelled = true;
      closeSocket();
    };
  }, [chatId, closeSocket, confirmRead, loadHistory]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!chatId) {
        throw new Error("Сначала выберите чат.");
      }

      const trimmedText = text.trim();
      if (!trimmedText) {
        throw new Error("Введите текст сообщения.");
      }

      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN && activeChatIdRef.current === chatId) {
        socket.send(JSON.stringify({ text: trimmedText }));
        return;
      }

      const message = await sendChatMessage(chatId, trimmedText);
      setMessages((current) => mergeMessages(current, [message]));
      setConnectionStatus("Realtime недоступен. Используется обычный режим.");
    },
    [chatId],
  );

  return {
    messages,
    isLoading,
    connectionStatus,
    sendMessage,
    reloadHistory: loadHistory,
    closeSocket,
    confirmRead,
  };
}
