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

import { addChatMembers, createDirectChat, createGroupChat, getChat, getChats, leaveChat } from "../api/chats";
import { useAuthContext } from "./AuthProvider";
import { formatMessageDay } from "../lib/format";
import { buildChatWebSocketUrl } from "../lib/ws";
import type { Chat } from "../types/chat";
import type {
  ChatMessage,
  ChatMessageDeliveredEvent,
  ChatMessageEvent,
  ChatMessageReadEvent,
} from "../types/message";

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
  refreshChat: (chatId: number) => Promise<void>;
  openOrCreateChat: (friendId: number) => Promise<Chat>;
  createConversation: (payload: { title?: string; userIds: number[] }) => Promise<Chat>;
  addMembersToChat: (chatId: number, userIds: number[]) => Promise<Chat>;
  leaveConversation: (chatId: number) => Promise<void>;
  markChatAsRead: (chatId: number) => void;
  setActiveChatId: (chatId: number | null) => void;
};

const ChatsContext = createContext<ChatsContextValue | null>(null);

function getChatSortValue(chat: Chat) {
  return chat.last_message ? Date.parse(chat.last_message.created_at) || 0 : Date.parse(chat.created_at) || 0;
}

function sortChats(chats: Chat[]) {
  return [...chats].sort((left, right) => getChatSortValue(right) - getChatSortValue(left));
}

function buildSummary(chat: Chat): ChatSummary {
  return {
    preview: chat.last_message?.text || "Откройте чат, чтобы начать переписку",
    time: chat.last_message ? formatMessageDay(chat.last_message.created_at) : "",
    sortValue: getChatSortValue(chat),
  };
}

function applyLastMessage(chat: Chat, message: ChatMessage): Chat {
  return {
    ...chat,
    last_message: {
      id: message.id,
      user_id: message.user_id,
      text: message.text,
      created_at: message.created_at,
      author_username: message.author_username,
      author_avatar_url: message.author_avatar_url,
    },
  };
}

export function ChatsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isReady, user } = useAuthContext();
  const [chats, setChats] = useState<Chat[]>([]);
  const [unreadByChat, setUnreadByChat] = useState<Record<number, number>>({});
  const [activeChatId, setActiveChatIdState] = useState<number | null>(null);
  const [isChatsReady, setIsChatsReady] = useState(false);
  const socketsRef = useRef<Map<number, WebSocket>>(new Map());
  const activeChatIdRef = useRef<number | null>(null);

  const closeSockets = useCallback(() => {
    socketsRef.current.forEach((socket) => socket.close());
    socketsRef.current = new Map();
  }, []);

  const syncChats = useCallback((incomingChats: Chat[]) => {
    const sortedChats = sortChats(incomingChats);
    setChats(sortedChats);
    setUnreadByChat(
      Object.fromEntries(sortedChats.map((chat) => [chat.id, chat.unread_count || 0])) as Record<number, number>,
    );
  }, []);

  const refreshChats = useCallback(async () => {
    if (!isAuthenticated) {
      setChats([]);
      setUnreadByChat({});
      setIsChatsReady(true);
      return;
    }

    const chatItems = await getChats();
    syncChats(chatItems);
    setIsChatsReady(true);
  }, [isAuthenticated, syncChats]);

  const refreshChat = useCallback(async (chatId: number) => {
    const chat = await getChat(chatId);
    setChats((current) => {
      const others = current.filter((item) => item.id !== chatId);
      return sortChats([...others, chat]);
    });
    setUnreadByChat((current) => ({ ...current, [chat.id]: chat.unread_count || 0 }));
  }, []);

  const markChatAsRead = useCallback((chatId: number) => {
    setUnreadByChat((current) => ({ ...current, [chatId]: 0 }));
    setChats((current) => current.map((chat) => (chat.id === chatId ? { ...chat, unread_count: 0 } : chat)));
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
      await refreshChat(chat.id);
      markChatAsRead(chat.id);
      return chat;
    },
    [markChatAsRead, refreshChat],
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

      await refreshChat(chat.id);
      markChatAsRead(chat.id);
      return chat;
    },
    [markChatAsRead, refreshChat],
  );

  const addMembersToChat = useCallback(async (chatId: number, userIds: number[]) => {
    const updatedChat = await addChatMembers(chatId, userIds);
    setChats((current) => sortChats([...current.filter((chat) => chat.id !== chatId), updatedChat]));
    return updatedChat;
  }, []);

  const leaveConversation = useCallback(async (chatId: number) => {
    await leaveChat(chatId);
    setChats((current) => current.filter((chat) => chat.id !== chatId));
    setUnreadByChat((current) => {
      const next = { ...current };
      delete next[chatId];
      return next;
    });
    if (activeChatIdRef.current === chatId) {
      activeChatIdRef.current = null;
      setActiveChatIdState(null);
    }
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!isAuthenticated) {
      closeSockets();
      setChats([]);
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
          const payload = JSON.parse(event.data) as
            | ChatMessageEvent
            | ChatMessageDeliveredEvent
            | ChatMessageReadEvent
            | { type: string };

          if (payload.type === "message") {
            const message = payload as ChatMessage;
            setChats((current) => {
              const currentChat = current.find((item) => item.id === chat.id);
              if (!currentChat) {
                return current;
              }
              const updatedChat = applyLastMessage(currentChat, message);
              if (message.user_id !== user.id && activeChatIdRef.current !== chat.id) {
                updatedChat.unread_count = (updatedChat.unread_count || 0) + 1;
              }
              const others = current.filter((item) => item.id !== chat.id);
              return sortChats([updatedChat, ...others]);
            });

            if (message.user_id !== user.id && activeChatIdRef.current !== chat.id) {
              setUnreadByChat((current) => ({
                ...current,
                [chat.id]: (current[chat.id] || 0) + 1,
              }));
            }
            return;
          }

          if (payload.type === "message_read") {
            if ((payload as ChatMessageReadEvent).chat_id === chat.id && activeChatIdRef.current === chat.id) {
              markChatAsRead(chat.id);
            }
          }
        } catch {
          // Список чатов не должен падать из-за одного битого realtime-события.
        }
      });

      socketsRef.current.set(chat.id, socket);
    });

    return () => {
      closeSockets();
    };
  }, [chatIdsKey, chats, closeSockets, isAuthenticated, markChatAsRead, user]);

  const chatSummaries = useMemo(
    () => Object.fromEntries(chats.map((chat) => [chat.id, buildSummary(chat)])),
    [chats],
  );

  const value = useMemo<ChatsContextValue>(
    () => ({
      chats,
      chatSummaries,
      unreadByChat,
      activeChatId,
      isReady: isChatsReady,
      refreshChats,
      refreshChat,
      openOrCreateChat,
      createConversation,
      addMembersToChat,
      leaveConversation,
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
      refreshChat,
      openOrCreateChat,
      createConversation,
      addMembersToChat,
      leaveConversation,
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
