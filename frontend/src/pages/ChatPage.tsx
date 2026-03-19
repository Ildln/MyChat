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

  const {
    messages,
    isLoading,
    connectionStatus,
    sendMessage,
  } = useChatSession(Number.isNaN(numericChatId) ? null : numericChatId);

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
    <div className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl p-4 md:p-6">
      <div className="flex w-full flex-col gap-4">
        {status ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
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
    </div>
  );
}
