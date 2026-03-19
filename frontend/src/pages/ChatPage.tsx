import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getChats } from "../api/chats";
import { ChatConversationPanel } from "../components/ChatConversationPanel";
import { useAuth } from "../hooks/useAuth";
import { useChatSession } from "../hooks/useChatSession";
import type { Chat } from "../types/chat";

export function ChatPage() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [status, setStatus] = useState("");

  const numericChatId = Number(chatId);
  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === numericChatId) || null,
    [chats, numericChatId],
  );

  const { messages, isLoading, connectionStatus, sendMessage } = useChatSession(
    Number.isNaN(numericChatId) ? null : numericChatId,
  );

  useEffect(() => {
    async function loadChatsList() {
      try {
        const items = await getChats();
        setChats(items);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Не удалось загрузить чат.");
      }
    }

    void loadChatsList();
  }, []);

  return (
    <div className="min-h-screen bg-[#09090a] text-zinc-50">
      {status ? (
        <div className="fixed left-1/2 top-4 z-40 w-[min(560px,calc(100%-32px))] -translate-x-1/2 rounded-[18px] border border-white/8 bg-[#141416] px-4 py-3 text-sm text-zinc-300 shadow-2xl shadow-black/30">
          {status}
        </div>
      ) : null}
      <ChatConversationPanel
        chat={selectedChat}
        connectionStatus={connectionStatus}
        currentUser={user}
        emptyText="Этот чат не найден или недоступен."
        emptyTitle="Чат недоступен"
        isLoading={isLoading}
        messages={messages}
        onBack={() => navigate("/")}
        onSendMessage={sendMessage}
      />
    </div>
  );
}
