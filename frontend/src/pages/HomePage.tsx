import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { createDirectChat, getChatMessages, getChats } from "../api/chats";
import {
  acceptFriendRequest,
  createFriendRequest,
  declineFriendRequest,
  getFriends,
  getIncomingFriendRequests,
} from "../api/friends";
import { getUsers } from "../api/users";
import { BrandLogo } from "../components/BrandLogo";
import { FriendProfileModal } from "../components/FriendProfileModal";
import { MobileBottomNav } from "../components/MobileBottomNav";
import { UserAvatar } from "../components/UserAvatar";
import { useAuth } from "../hooks/useAuth";
import { formatMessageDay, formatMessageTime } from "../lib/format";
import { getChatTitle } from "../lib/chat";
import { getUserAbout } from "../lib/profile";
import type { Chat } from "../types/chat";
import type { FriendRequest } from "../types/friends";
import type { ChatMessage } from "../types/message";
import type { User } from "../types/user";

type MobileTab = "requests" | "chats" | "profile";

type ChatSummary = {
  preview: string;
  time: string;
};

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [friends, setFriends] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatSummaries, setChatSummaries] = useState<Record<number, ChatSummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pageStatus, setPageStatus] = useState("");
  const [friendRequestTarget, setFriendRequestTarget] = useState("");
  const [activeTab, setActiveTab] = useState<MobileTab>("chats");
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);

  const usersMap = useMemo(() => {
    return new Map(users.map((item) => [item.id, item]));
  }, [users]);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setIsLoading(true);
    try {
      const [incoming, friendsList, chatsList, usersList] = await Promise.all([
        getIncomingFriendRequests(),
        getFriends(),
        getChats(),
        getUsers(),
      ]);

      setIncomingRequests(incoming);
      setFriends(friendsList);
      setChats(chatsList);
      setUsers(usersList);

      const summaries = await loadChatSummaries(chatsList);
      setChatSummaries(summaries);
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось загрузить данные.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadChatSummaries(chatsList: Chat[]) {
    const entries = await Promise.all(
      chatsList.map(async (chat) => {
        try {
          const messages = await getChatMessages(chat.id);
          const lastMessage = messages[messages.length - 1];
          return [
            chat.id,
            {
              preview: lastMessage?.text || "Откройте чат, чтобы начать переписку",
              time: lastMessage ? formatMessageDay(lastMessage.created_at) : "",
            },
          ] as const;
        } catch {
          return [
            chat.id,
            {
              preview: "Сообщения пока недоступны",
              time: "",
            },
          ] as const;
        }
      }),
    );

    return Object.fromEntries(entries);
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
      setPageStatus(`Чат с пользователем #${friendId} готов.`);
      navigate(`/chat/${chat.id}`);
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось открыть чат.");
    }
  }

  function renderRequestCard(request: FriendRequest) {
    const sender = usersMap.get(request.from_user_id);
    const displayName = sender?.username || `Пользователь #${request.from_user_id}`;

    return (
      <div className="rounded-[24px] border border-white/6 bg-[#171718] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.24)]" key={request.id}>
        <div className="flex items-center gap-3">
          <UserAvatar name={displayName} seed={request.from_user_id} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-white">{displayName}</div>
            <div className="mt-1 text-sm leading-5 text-zinc-400">ID: {request.from_user_id} • ждёт подтверждения</div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 rounded-[16px] bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
            onClick={() => void handleAccept(request.id)}
            type="button"
          >
            Принять
          </button>
          <button
            className="flex-1 rounded-[16px] bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
            onClick={() => void handleDecline(request.id)}
            type="button"
          >
            Отклонить
          </button>
        </div>
      </div>
    );
  }

  function renderChatCard(chat: Chat) {
    const summary = chatSummaries[chat.id];
    const title = getChatTitle(chat, user?.id);

    return (
      <button
        className="group flex w-full items-start gap-3 rounded-[20px] px-4 py-3 text-left transition hover:bg-white/5"
        key={chat.id}
        onClick={() => navigate(`/chat/${chat.id}`)}
        type="button"
      >
        <UserAvatar name={title} seed={chat.id} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="truncate text-[15px] font-semibold text-white">{title}</div>
            <div className="shrink-0 text-xs text-zinc-500">{summary?.time || ""}</div>
          </div>
          <div className="mt-1 truncate text-sm text-zinc-400">{summary?.preview || "Откройте чат"}</div>
        </div>
      </button>
    );
  }

  function renderFriendCard(friend: User) {
    return (
      <button
        className="flex w-full items-center gap-4 rounded-[20px] border border-white/6 bg-[#171718] px-4 py-3 text-left transition hover:bg-[#1c1c1f]"
        key={friend.id}
        onClick={() => setSelectedFriend(friend)}
        type="button"
      >
        <UserAvatar name={friend.username} seed={friend.id} />
        <div className="truncate text-[15px] font-semibold text-white">{friend.username}</div>
      </button>
    );
  }

  function renderDesktopSidebar() {
    return (
      <aside className="hidden min-h-screen border-r border-white/6 lg:flex lg:w-[320px] lg:flex-col bg-[#09090a]">
        <div className="border-b border-white/6 px-8 py-8">
          <BrandLogo className="text-[28px]" />
        </div>
        <div className="px-4 pt-4">
          <div className="grid grid-cols-2 gap-2 rounded-[22px] bg-transparent p-0">
            <button
              className={`rounded-[14px] px-4 py-3 text-sm font-semibold transition ${
                activeTab === "requests" ? "bg-white text-zinc-950" : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
              onClick={() => setActiveTab("requests")}
              type="button"
            >
              Заявки
            </button>
            <button
              className={`rounded-[14px] px-4 py-3 text-sm font-semibold transition ${
                activeTab === "chats" ? "bg-white text-zinc-950" : "bg-white/5 text-zinc-400 hover:text-white"
              }`}
              onClick={() => setActiveTab("chats")}
              type="button"
            >
              Чаты
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="space-y-4">
            {activeTab === "requests" ? (
              incomingRequests.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/10 px-5 py-10 text-sm leading-6 text-zinc-500">
                  Входящих заявок пока нет.
                </div>
              ) : (
                incomingRequests.map(renderRequestCard)
              )
            ) : chats.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 px-5 py-10 text-sm leading-6 text-zinc-500">
                Список чатов пока пуст.
              </div>
            ) : (
              chats.map(renderChatCard)
            )}
          </div>
        </div>
      </aside>
    );
  }

  function renderDesktopCenter() {
    return (
      <section className="hidden min-h-screen border-r border-white/6 lg:flex lg:flex-1 lg:flex-col bg-[#09090a]">
        <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-5xl text-white/10">
            ◔
          </div>
          <h2 className="text-[42px] font-semibold text-white">Выберите чат</h2>
          <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-400">
            Выберите беседу из списка слева, чтобы начать общение
          </p>
        </div>
      </section>
    );
  }

  function renderDesktopProfile() {
    return (
      <aside className="hidden min-h-screen w-[320px] bg-[#09090a] px-6 py-8 lg:flex lg:flex-col">
        <div className="flex flex-col items-center text-center">
          <UserAvatar name={user?.username || "ME"} seed={user?.id || 0} size="xl" />
          <h2 className="mt-6 text-[22px] font-semibold text-white">{user?.username || "Пользователь"}</h2>
          <div className="mt-3 text-sm font-medium text-zinc-300">О себе:</div>
          <p className="mt-2 max-w-[240px] text-sm leading-7 text-zinc-400">{getUserAbout(user || null)}</p>
        </div>

        <div className="mt-10 border-t border-white/6 pt-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[28px] font-semibold text-white">Друзья</h3>
            <span className="text-lg font-medium text-zinc-400">{friends.length}</span>
          </div>
          <div className="space-y-3 overflow-y-auto pr-1">
            {friends.map(renderFriendCard)}
          </div>
        </div>

        <form className="mt-6 space-y-3" onSubmit={handleSendFriendRequest}>
          <input
            className="w-full rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
            onChange={(event) => setFriendRequestTarget(event.target.value)}
            placeholder="Отправить заявку по ID"
            type="number"
            value={friendRequestTarget}
          />
          <button className="w-full rounded-[18px] bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200" type="submit">
            Отправить заявку
          </button>
        </form>
      </aside>
    );
  }

  function renderMobileHeader() {
    return (
      <div className="border-b border-white/6 px-6 py-7 lg:hidden">
        <div className="flex justify-center">
          <BrandLogo className="text-[22px]" />
        </div>
      </div>
    );
  }

  function renderMobileRequests() {
    return (
      <div className="space-y-4 px-4 py-5">
        {incomingRequests.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 px-5 py-10 text-sm leading-6 text-zinc-500">
            Входящих заявок пока нет.
          </div>
        ) : (
          incomingRequests.map(renderRequestCard)
        )}
      </div>
    );
  }

  function renderMobileChats() {
    return (
      <div className="px-3 py-4">
        {chats.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 px-5 py-10 text-sm leading-6 text-zinc-500">
            Чатов пока нет.
          </div>
        ) : (
          chats.map(renderChatCard)
        )}
      </div>
    );
  }

  function renderMobileProfile() {
    return (
      <div className="px-4 py-6">
        <div className="flex flex-col items-center text-center">
          <UserAvatar name={user?.username || "ME"} seed={user?.id || 0} size="xl" />
          <h2 className="mt-5 text-[22px] font-semibold text-white">{user?.username || "Пользователь"}</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-400">О себе: {getUserAbout(user || null)}</p>
        </div>

        <div className="mt-8">
          <div className="mb-4 text-[28px] font-semibold text-white">Друзья ({friends.length})</div>
          <div className="space-y-3">
            {friends.map(renderFriendCard)}
          </div>
        </div>

        <form className="mt-6 space-y-3" onSubmit={handleSendFriendRequest}>
          <input
            className="w-full rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
            onChange={(event) => setFriendRequestTarget(event.target.value)}
            placeholder="Отправить заявку по ID"
            type="number"
            value={friendRequestTarget}
          />
          <button className="w-full rounded-[18px] bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200" type="submit">
            Отправить заявку
          </button>
        </form>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-400">Загружаем данные MyChat...</div>;
  }

  return (
    <div className="min-h-screen bg-[#09090a] text-zinc-50">
      {pageStatus ? (
        <div className="fixed left-1/2 top-4 z-40 w-[min(560px,calc(100%-32px))] -translate-x-1/2 rounded-[18px] border border-white/8 bg-[#141416] px-4 py-3 text-sm text-zinc-300 shadow-2xl shadow-black/30">
          {pageStatus}
        </div>
      ) : null}

      <div className="lg:hidden">
        {renderMobileHeader()}
        <main className="min-h-[calc(100vh-152px)] pb-24">
          {activeTab === "requests" ? renderMobileRequests() : null}
          {activeTab === "chats" ? renderMobileChats() : null}
          {activeTab === "profile" ? renderMobileProfile() : null}
        </main>
        <MobileBottomNav activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="hidden lg:flex">
        {renderDesktopSidebar()}
        {renderDesktopCenter()}
        {renderDesktopProfile()}
      </div>

      <FriendProfileModal
        friend={selectedFriend}
        isOpen={Boolean(selectedFriend)}
        onClose={() => setSelectedFriend(null)}
        onWriteMessage={(friendId) => {
          setSelectedFriend(null);
          void handleOpenOrCreateChat(friendId);
        }}
      />
    </div>
  );
}
