import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createDirectChat, createGroupChat, getChatMessages, getChats } from "../api/chats";
import { useAuthContext } from "./AuthProvider";
import { formatMessageDay } from "../lib/format";
import { buildChatWebSocketUrl } from "../lib/ws";
import type { Chat } from "../types/chat";
import type { ChatMessage, ChatMessageEvent } from "../types/message";

type ChatSummary = {
  preview: string;
  time: string;
  sortValue: number;
};

type ChatsContextValue = {
  chats: Chat[];
  chatSummaries: Record<number, ChatSummary>;
  unreadByChat: Record<number, number>;
  activeChatId: number | null;
  isReady: boolean;
  refreshChats: () => Promise<void>;
  openOrCreateChat: (friendId: number) => Promise<Chat>;
  createConversation: (payload: { title?: string; userIds: number[] }) => Promise<Chat>;
  markChatAsRead: (chatId: number) => void;
  setActiveChatId: (chatId: number | null) => void;
};

const ChatsContext = createContext<ChatsContextValue | null>(null);

function sortChats(chats: Chat[], summaries: Record<number, ChatSummary>) {
  return [...chats].sort((left, right) => {
    const rightValue = summaries[right.id]?.sortValue || 0;
    const leftValue = summaries[left.id]?.sortValue || 0;
    return rightValue - leftValue;
  });
}

export function ChatsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isReady, user } = useAuthContext();
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatSummaries, setChatSummaries] = useState<Record<number, ChatSummary>>({});
  const [unreadByChat, setUnreadByChat] = useState<Record<number, number>>({});
  const [activeChatId, setActiveChatIdState] = useState<number | null>(null);
  const [isChatsReady, setIsChatsReady] = useState(false);
  const socketsRef = useRef<Map<number, WebSocket>>(new Map());
  const activeChatIdRef = useRef<number | null>(null);

  const closeSockets = useCallback(() => {
    socketsRef.current.forEach((socket) => socket.close());
    socketsRef.current = new Map();
  }, []);

  const loadChatSummaries = useCallback(async (chatItems: Chat[]) => {
    const entries = await Promise.all(
      chatItems.map(async (chat) => {
        try {
          const messages = await getChatMessages(chat.id);
          const lastMessage = messages[messages.length - 1];
          const sortValue = lastMessage ? Date.parse(lastMessage.created_at) || 0 : Date.parse(chat.created_at) || 0;
          return [
            chat.id,
            {
              preview: lastMessage?.text || "Откройте чат, чтобы начать переписку",
              time: lastMessage ? formatMessageDay(lastMessage.created_at) : "",
              sortValue,
            },
          ] as const;
        } catch {
          return [
            chat.id,
            {
              preview: "Сообщения пока недоступны",
              time: "",
              sortValue: Date.parse(chat.created_at) || 0,
            },
          ] as const;
        }
      }),
    );

    return Object.fromEntries(entries);
  }, []);

  const refreshChats = useCallback(async () => {
    if (!isAuthenticated) {
      setChats([]);
      setChatSummaries({});
      setUnreadByChat({});
      setIsChatsReady(true);
      return;
    }

    const chatItems = await getChats();
    const summaries = await loadChatSummaries(chatItems);
    setChatSummaries(summaries);
    setChats(sortChats(chatItems, summaries));
    setIsChatsReady(true);
  }, [isAuthenticated, loadChatSummaries]);

  const markChatAsRead = useCallback((chatId: number) => {
    setUnreadByChat((current) => ({ ...current, [chatId]: 0 }));
  }, []);

  const setActiveChatId = useCallback(
    (chatId: number | null) => {
      activeChatIdRef.current = chatId;
      setActiveChatIdState(chatId);
      if (chatId) {
        markChatAsRead(chatId);
      }
    },
    [markChatAsRead],
  );

  const openOrCreateChat = useCallback(
    async (friendId: number) => {
      const chat = await createDirectChat(friendId);
      await refreshChats();
      markChatAsRead(chat.id);
      return chat;
    },
    [markChatAsRead, refreshChats],
  );

  const createConversation = useCallback(
    async ({ title, userIds }: { title?: string; userIds: number[] }) => {
      const uniqueUserIds = [...new Set(userIds)];
      let chat: Chat;

      if (uniqueUserIds.length === 1) {
        chat = await createDirectChat(uniqueUserIds[0]);
      } else {
        chat = await createGroupChat(title?.trim() || "Новая беседа", uniqueUserIds);
      }

      await refreshChats();
      markChatAsRead(chat.id);
      return chat;
    },
    [markChatAsRead, refreshChats],
  );

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!isAuthenticated) {
      closeSockets();
      setChats([]);
      setChatSummaries({});
      setUnreadByChat({});
      setActiveChatId(null);
      setIsChatsReady(true);
      return;
    }

    void refreshChats();
  }, [closeSockets, isAuthenticated, isReady, refreshChats, setActiveChatId]);

  const chatIdsKey = useMemo(
    () => [...chats].map((chat) => chat.id).sort((left, right) => left - right).join(","),
    [chats],
  );

  useEffect(() => {
    if (!isAuthenticated || !user) {
      closeSockets();
      return;
    }

    closeSockets();

    chats.forEach((chat) => {
      const socket = new WebSocket(buildChatWebSocketUrl(chat.id));

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data) as ChatMessageEvent | { type: string };
          if (payload.type !== "message") {
            return;
          }

          const message = payload as ChatMessage;
          setChatSummaries((current) => ({
            ...current,
            [chat.id]: {
              preview: message.text,
              time: formatMessageDay(message.created_at),
              sortValue: Date.parse(message.created_at) || Date.now(),
            },
          }));

          setChats((current) => {
            const currentChat = current.find((item) => item.id === chat.id);
            if (!currentChat) {
              return current;
            }
            const others = current.filter((item) => item.id !== chat.id);
            return [currentChat, ...others];
          });

          if (message.user_id !== user.id && activeChatIdRef.current !== chat.id) {
            setUnreadByChat((current) => ({
              ...current,
              [chat.id]: (current[chat.id] || 0) + 1,
            }));
          }
        } catch {
          // Ничего не делаем: список чатов не должен падать из-за одного битого события.
        }
      });

      socketsRef.current.set(chat.id, socket);
    });

    return () => {
      closeSockets();
    };
  }, [chatIdsKey, chats, closeSockets, isAuthenticated, user]);

  const value = useMemo<ChatsContextValue>(
    () => ({
      chats,
      chatSummaries,
      unreadByChat,
      activeChatId,
      isReady: isChatsReady,
      refreshChats,
      openOrCreateChat,
      createConversation,
      markChatAsRead,
      setActiveChatId,
    }),
    [
      chats,
      chatSummaries,
      unreadByChat,
      activeChatId,
      isChatsReady,
      refreshChats,
      openOrCreateChat,
      createConversation,
      markChatAsRead,
      setActiveChatId,
    ],
  );

  return <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>;
}

export function useChatsContext() {
  const context = useContext(ChatsContext);
  if (!context) {
    throw new Error("useChatsContext must be used within ChatsProvider");
  }
  return context;
}
