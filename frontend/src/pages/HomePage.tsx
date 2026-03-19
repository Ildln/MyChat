import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import {
  acceptFriendRequest,
  createFriendRequest,
  declineFriendRequest,
  getFriends,
  getIncomingFriendRequests,
} from "../api/friends";
import { createDirectChat, getChats } from "../api/chats";
import { ChatConversationPanel } from "../components/ChatConversationPanel";
import { useAuth } from "../hooks/useAuth";
import { useChatSession } from "../hooks/useChatSession";
import { getChatSubtitle, getChatTitle } from "../lib/chat";
import type { Chat } from "../types/chat";
import type { FriendRequest } from "../types/friends";
import type { User } from "../types/user";

type MobileTab = "requests" | "chats" | "profile";

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [friends, setFriends] = useState<User[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageStatus, setPageStatus] = useState("");
  const [friendRequestTarget, setFriendRequestTarget] = useState("");
  const [activeTab, setActiveTab] = useState<MobileTab>("chats");
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) || null,
    [chats, selectedChatId],
  );

  const {
    messages,
    isLoading: isChatLoading,
    connectionStatus,
    sendMessage,
  } = useChatSession(selectedChatId);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setIsLoading(true);
    try {
      const [incoming, friendsList, chatsList] = await Promise.all([
        getIncomingFriendRequests(),
        getFriends(),
        getChats(),
      ]);
      setIncomingRequests(incoming);
      setFriends(friendsList);
      setChats(chatsList);

      if (!selectedChatId && chatsList.length > 0 && window.innerWidth >= 1024) {
        setSelectedChatId(chatsList[0].id);
      }
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось загрузить данные.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAccept(requestId: number) {
    try {
      await acceptFriendRequest(requestId);
      setPageStatus("Заявка принята.");
      await loadDashboard();
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось принять заявку.");
    }
  }

  async function handleDecline(requestId: number) {
    try {
      await declineFriendRequest(requestId);
      setPageStatus("Заявка отклонена.");
      await loadDashboard();
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось отклонить заявку.");
    }
  }

  async function handleSendFriendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createFriendRequest(Number(friendRequestTarget));
      setFriendRequestTarget("");
      setPageStatus("Заявка в друзья отправлена.");
      await loadDashboard();
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось отправить заявку.");
    }
  }

  async function handleOpenOrCreateChat(friendId: number) {
    try {
      const chat = await createDirectChat(friendId);
      setSelectedChatId(chat.id);
      setPageStatus(`Чат с пользователем #${friendId} готов.`);
      await loadDashboard();

      if (window.innerWidth < 1024) {
        navigate(`/chat/${chat.id}`);
      }
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось открыть чат.");
    }
  }

  function handleSelectChat(chatId: number) {
    setSelectedChatId(chatId);
    if (window.innerWidth < 1024) {
      navigate(`/chat/${chatId}`);
    }
  }

  function renderRequestsBlock() {
    return (
      <div className="space-y-4">
        <form className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-4" onSubmit={handleSendFriendRequest}>
          <div>
            <h3 className="text-base font-semibold">Новая заявка в друзья</h3>
            <p className="mt-1 text-sm text-zinc-400">Введите ID пользователя из backend.</p>
          </div>
          <input
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-600"
            onChange={(event) => setFriendRequestTarget(event.target.value)}
            placeholder="ID пользователя"
            type="number"
            value={friendRequestTarget}
          />
          <button className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200" type="submit">
            Отправить заявку
          </button>
        </form>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold">Входящие заявки</h3>
            <p className="mt-1 text-sm text-zinc-400">Принимайте только те заявки, которые действительно ждёте.</p>
          </div>
          <div className="space-y-3">
            {incomingRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                Входящих заявок пока нет.
              </div>
            ) : (
              incomingRequests.map((request) => (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4" key={request.id}>
                  <div className="text-sm font-medium text-white">Заявка #{request.id}</div>
                  <div className="mt-1 text-sm text-zinc-400">
                    От пользователя #{request.from_user_id} • статус: {request.status}
                  </div>
                  {request.status === "pending" ? (
                    <div className="mt-3 flex gap-3">
                      <button
                        className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
                        onClick={() => void handleAccept(request.id)}
                        type="button"
                      >
                        Принять
                      </button>
                      <button
                        className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
                        onClick={() => void handleDecline(request.id)}
                        type="button"
                      >
                        Отклонить
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderChatsBlock() {
    return (
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3">
          <h3 className="text-base font-semibold">Чаты</h3>
          <p className="mt-1 text-sm text-zinc-400">Выберите чат, чтобы открыть историю и realtime.</p>
        </div>
        <div className="space-y-3">
          {chats.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
              Чатов пока нет. Создайте direct chat из списка друзей.
            </div>
          ) : (
            chats.map((chat) => (
              <button
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  selectedChatId === chat.id
                    ? "border-zinc-500 bg-zinc-800"
                    : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                }`}
                key={chat.id}
                onClick={() => handleSelectChat(chat.id)}
                type="button"
              >
                <div className="text-sm font-medium text-white">{getChatTitle(chat, user?.id)}</div>
                <div className="mt-1 text-sm text-zinc-400">{getChatSubtitle(chat)}</div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  function renderProfileBlock() {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="text-base font-semibold">Профиль</h3>
          <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-sm text-zinc-400">Текущий пользователь</div>
            <div className="mt-1 text-base text-white">{user?.username || "Неизвестный пользователь"}</div>
            <div className="mt-1 text-sm text-zinc-500">ID: {user?.id ?? "—"}</div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold">Друзья</h3>
            <p className="mt-1 text-sm text-zinc-400">Из списка друзей можно сразу открыть direct chat.</p>
          </div>
          <div className="space-y-3">
            {friends.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                Список друзей пока пуст.
              </div>
            ) : (
              friends.map((friend) => (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4" key={friend.id}>
                  <div className="text-sm font-medium text-white">{friend.username}</div>
                  <div className="mt-1 text-sm text-zinc-400">ID пользователя: {friend.id}</div>
                  <button
                    className="mt-3 rounded-2xl bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
                    onClick={() => void handleOpenOrCreateChat(friend.id)}
                    type="button"
                  >
                    Открыть чат
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center text-zinc-400">
        Загружаем данные MyChat...
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-[calc(100vh-73px)] w-full max-w-7xl p-4 md:p-6">
      {pageStatus ? (
        <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
          {pageStatus}
        </div>
      ) : null}

      <div className="space-y-4 lg:hidden">
        {activeTab === "requests" ? renderRequestsBlock() : null}
        {activeTab === "chats" ? renderChatsBlock() : null}
        {activeTab === "profile" ? renderProfileBlock() : null}

        <nav className="sticky bottom-4 grid grid-cols-3 gap-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-2">
          {(["requests", "chats", "profile"] as MobileTab[]).map((tab) => (
            <button
              className={`rounded-2xl px-4 py-3 text-sm transition ${
                activeTab === tab ? "bg-white font-medium text-zinc-950" : "text-zinc-300 hover:bg-zinc-800"
              }`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab === "requests" ? "Заявки" : tab === "chats" ? "Чаты" : "Профиль"}
            </button>
          ))}
        </nav>
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-[320px_minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {renderRequestsBlock()}
          {renderChatsBlock()}
        </div>

        <ChatConversationPanel
          chat={selectedChat}
          connectionStatus={connectionStatus}
          currentUser={user}
          emptyText="Выберите direct chat в левой колонке, чтобы увидеть историю сообщений."
          isLoading={isChatLoading}
          messages={messages}
          onSendMessage={sendMessage}
        />

        <div>{renderProfileBlock()}</div>
      </div>
    </div>
  );
}

