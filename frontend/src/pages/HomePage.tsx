import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import {
  acceptFriendRequest,
  createFriendRequest,
  declineFriendRequest,
  getFriends,
  getIncomingFriendRequests,
} from "../api/friends";
import { updateCurrentUser } from "../api/users";
import { getUsers } from "../api/users";
import { BrandLogo } from "../components/BrandLogo";
import { CreateChatModal } from "../components/CreateChatModal";
import { FriendProfileModal } from "../components/FriendProfileModal";
import { MobileBottomNav } from "../components/MobileBottomNav";
import { UserAvatar } from "../components/UserAvatar";
import { useAuth } from "../hooks/useAuth";
import { useChats } from "../hooks/useChats";
import { getChatTitle } from "../lib/chat";
import { getPresenceLabel } from "../lib/format";
import { getUserAbout } from "../lib/profile";
import type { FriendRequest } from "../types/friends";
import type { User } from "../types/user";

type MobileTab = "requests" | "chats" | "profile";

export function HomePage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const {
    chats,
    chatSummaries,
    unreadByChat,
    activeChatId,
    isReady,
    openOrCreateChat,
    markChatAsRead,
  } = useChats();
  const [friends, setFriends] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageStatus, setPageStatus] = useState("");
  const [friendRequestTarget, setFriendRequestTarget] = useState("");
  const [activeTab, setActiveTab] = useState<MobileTab>("chats");
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [draftAbout, setDraftAbout] = useState("");
  const [draftAvatarUrl, setDraftAvatarUrl] = useState("");

  const usersMap = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);
  const visibleIncomingRequests = useMemo(
    () => incomingRequests.filter((request) => request.status === "pending"),
    [incomingRequests],
  );

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    setDraftAbout(user?.about || "");
    setDraftAvatarUrl(user?.avatar_url || "");
  }, [user?.about, user?.avatar_url, user?.id]);

  async function loadDashboard() {
    setIsLoading(true);
    try {
      const [incoming, friendsList, usersList] = await Promise.all([
        getIncomingFriendRequests(),
        getFriends(),
        getUsers(),
      ]);

      setIncomingRequests(incoming);
      setFriends(friendsList);
      setUsers(usersList);
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось загрузить данные.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAccept(requestId: number) {
    setIncomingRequests((current) => current.filter((request) => request.id !== requestId));

    try {
      await acceptFriendRequest(requestId);
      setPageStatus("Заявка принята.");
      setFriends(await getFriends());
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось принять заявку.");
      await loadDashboard();
    }
  }

  async function handleDecline(requestId: number) {
    setIncomingRequests((current) => current.filter((request) => request.id !== requestId));

    try {
      await declineFriendRequest(requestId);
      setPageStatus("Заявка отклонена.");
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось отклонить заявку.");
      await loadDashboard();
    }
  }

  async function handleSendFriendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await createFriendRequest(Number(friendRequestTarget));
      setFriendRequestTarget("");
      setPageStatus("Заявка в друзья отправлена.");
      setIncomingRequests(await getIncomingFriendRequests());
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось отправить заявку.");
    }
  }

  async function handleSaveProfile() {
    setIsSavingProfile(true);

    try {
      await updateCurrentUser({
        about: draftAbout,
        avatar_url: draftAvatarUrl,
      });
      await refreshUser();
      setIsEditingProfile(false);
      setPageStatus("Профиль обновлён.");
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось обновить профиль.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleOpenOrCreateChat(friendId: number) {
    try {
      const chat = await openOrCreateChat(friendId);
      markChatAsRead(chat.id);
      setPageStatus(`Чат с пользователем #${friendId} готов.`);
      navigate(`/chat/${chat.id}`);
    } catch (error) {
      setPageStatus(error instanceof Error ? error.message : "Не удалось открыть чат.");
    }
  }

  async function handleCreateChatFromModal(friendId: number) {
    setIsCreatingChat(true);

    try {
      await handleOpenOrCreateChat(friendId);
      setIsCreateChatOpen(false);
    } finally {
      setIsCreatingChat(false);
    }
  }

  function handleOpenChat(chatId: number) {
    markChatAsRead(chatId);
    navigate(`/chat/${chatId}`);
  }

  function renderRequestComposer() {
    return (
      <form
        className="rounded-[24px] border border-white/6 bg-[#171718] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.24)]"
        onSubmit={handleSendFriendRequest}
      >
        <div className="text-[15px] font-semibold text-white">Отправить заявку</div>
        <div className="mt-2 text-sm text-zinc-400">Введите ID пользователя и отправьте новую заявку в друзья.</div>
        <div className="mt-4 flex items-center gap-2">
          <input
            className="w-full rounded-[16px] border border-white/8 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
            onChange={(event) => setFriendRequestTarget(event.target.value)}
            placeholder="ID пользователя"
            type="number"
            value={friendRequestTarget}
          />
          <button
            className="rounded-[16px] bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
            type="submit"
          >
            Отправить
          </button>
        </div>
      </form>
    );
  }

  function renderRequestCard(request: FriendRequest) {
    const sender = usersMap.get(request.from_user_id);
    const displayName = sender?.username || `Пользователь #${request.from_user_id}`;

    return (
      <div className="rounded-[24px] border border-white/6 bg-[#171718] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.24)]" key={request.id}>
        <div className="flex items-center gap-3">
          <UserAvatar avatarUrl={sender?.avatar_url} name={displayName} seed={request.from_user_id} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-white">{displayName}</div>
            <div className="mt-1 text-sm leading-5 text-zinc-400">
              {sender ? getPresenceLabel(sender) : `ID: ${request.from_user_id}`}
            </div>
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

  function renderChatCard(chat: (typeof chats)[number]) {
    const summary = chatSummaries[chat.id];
    const title = getChatTitle(chat, user?.id);
    const unreadCount = unreadByChat[chat.id] || 0;
    const isActive = activeChatId === chat.id;
    const companion = chat.members.find((member) => member.id !== user?.id) || chat.members[0] || null;

    return (
      <button
        className={`group flex w-full items-start gap-3 rounded-[20px] px-4 py-3 text-left transition ${
          isActive ? "bg-white/10 ring-1 ring-white/10" : "hover:bg-white/5"
        }`}
        key={chat.id}
        onClick={() => handleOpenChat(chat.id)}
        type="button"
      >
        <UserAvatar avatarUrl={companion?.avatar_url} name={title} seed={chat.id} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="truncate text-[15px] font-semibold text-white">{title}</div>
            <div className="shrink-0 text-xs text-zinc-500">{summary?.time || ""}</div>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="truncate text-sm text-zinc-400">{summary?.preview || "Откройте чат"}</div>
            {unreadCount > 0 ? (
              <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold text-zinc-950">
                {unreadCount}
              </div>
            ) : null}
          </div>
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
        <UserAvatar avatarUrl={friend.avatar_url} name={friend.username} seed={friend.id} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-white">{friend.username}</div>
          <div className="mt-1 truncate text-sm text-zinc-400">{getPresenceLabel(friend)}</div>
        </div>
      </button>
    );
  }

  function renderProfileEditor() {
    return (
      <div className="mt-5 space-y-4">
        <div>
          <div className="mb-2 text-sm font-medium text-zinc-300">Ссылка на аватарку</div>
          <input
            className="w-full rounded-[16px] border border-white/8 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
            onChange={(event) => setDraftAvatarUrl(event.target.value)}
            placeholder="https://..."
            type="url"
            value={draftAvatarUrl}
          />
        </div>
        <div>
          <div className="mb-2 text-sm font-medium text-zinc-300">О себе</div>
          <textarea
            className="min-h-[110px] w-full rounded-[16px] border border-white/8 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
            onChange={(event) => setDraftAbout(event.target.value)}
            placeholder="Расскажите о себе"
            value={draftAbout}
          />
        </div>
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-[16px] bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
            disabled={isSavingProfile}
            onClick={() => void handleSaveProfile()}
            type="button"
          >
            {isSavingProfile ? "Сохраняем..." : "Сохранить"}
          </button>
          <button
            className="rounded-[16px] bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
            onClick={() => {
              setIsEditingProfile(false);
              setDraftAbout(user?.about || "");
              setDraftAvatarUrl(user?.avatar_url || "");
            }}
            type="button"
          >
            Отмена
          </button>
        </div>
      </div>
    );
  }

  function renderProfileCard(compact = false) {
    return (
      <>
        <div className="flex flex-col items-center text-center">
          <UserAvatar avatarUrl={user?.avatar_url} name={user?.username || "ME"} seed={user?.id || 0} size="xl" />
          <h2 className="mt-6 text-[22px] font-semibold text-white">{user?.username || "Пользователь"}</h2>
          <div className="mt-2 text-sm text-zinc-400">{getPresenceLabel(user)}</div>
          {!isEditingProfile ? (
            <>
              <div className="mt-4 text-sm font-medium text-zinc-300">О себе:</div>
              <p className={`mt-2 text-sm leading-7 text-zinc-400 ${compact ? "max-w-none" : "max-w-[240px]"}`}>
                {getUserAbout(user || null)}
              </p>
              <button
                className="mt-5 rounded-[16px] bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
                onClick={() => setIsEditingProfile(true)}
                type="button"
              >
                Редактировать профиль
              </button>
            </>
          ) : (
            renderProfileEditor()
          )}
        </div>
      </>
    );
  }

  function renderDesktopSidebar() {
    const isChatsTab = activeTab === "chats";

    return (
      <aside className="hidden min-h-screen border-r border-white/6 bg-[#09090a] lg:flex lg:w-[320px] lg:flex-col">
        <div className="border-b border-white/6 px-8 py-8">
          <div className="flex items-center justify-between gap-4">
            <BrandLogo className="text-[28px]" />
            {isChatsTab ? (
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-xl text-white transition hover:bg-white/10"
                onClick={() => setIsCreateChatOpen(true)}
                type="button"
              >
                +
              </button>
            ) : null}
          </div>
        </div>
        <div className="px-4 pt-4">
          <div className="grid grid-cols-2 gap-2">
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
              <>
                {renderRequestComposer()}
                {visibleIncomingRequests.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-white/10 px-5 py-10 text-sm leading-6 text-zinc-500">
                    Входящих заявок пока нет.
                  </div>
                ) : (
                  visibleIncomingRequests.map(renderRequestCard)
                )}
              </>
            ) : !isReady ? (
              <div className="rounded-[24px] border border-dashed border-white/10 px-5 py-10 text-sm leading-6 text-zinc-500">
                Загружаем чаты...
              </div>
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
      <section className="hidden min-h-screen border-r border-white/6 bg-[#09090a] lg:flex lg:flex-1 lg:flex-col">
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
        {renderProfileCard(false)}

        <div className="mt-10 border-t border-white/6 pt-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[28px] font-semibold text-white">Друзья</h3>
            <span className="text-lg font-medium text-zinc-400">{friends.length}</span>
          </div>
          <div className="space-y-3 overflow-y-auto pr-1">{friends.map(renderFriendCard)}</div>
        </div>
      </aside>
    );
  }

  function renderMobileHeader() {
    const isChatsTab = activeTab === "chats";

    return (
      <div className="border-b border-white/6 px-6 py-7 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="w-10" />
          <BrandLogo className="text-[22px]" />
          <div className="w-10 text-right">
            {isChatsTab ? (
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-xl text-white transition hover:bg-white/10"
                onClick={() => setIsCreateChatOpen(true)}
                type="button"
              >
                +
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function renderMobileRequests() {
    return (
      <div className="space-y-4 px-4 py-5">
        {renderRequestComposer()}
        {visibleIncomingRequests.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 px-5 py-10 text-sm leading-6 text-zinc-500">
            Входящих заявок пока нет.
          </div>
        ) : (
          visibleIncomingRequests.map(renderRequestCard)
        )}
      </div>
    );
  }

  function renderMobileChats() {
    return (
      <div className="px-3 py-4">
        {!isReady ? (
          <div className="rounded-[24px] border border-dashed border-white/10 px-5 py-10 text-sm leading-6 text-zinc-500">
            Загружаем чаты...
          </div>
        ) : chats.length === 0 ? (
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
        {renderProfileCard(true)}

        <div className="mt-8">
          <div className="mb-4 text-[28px] font-semibold text-white">Друзья ({friends.length})</div>
          <div className="space-y-3">{friends.map(renderFriendCard)}</div>
        </div>
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

      <CreateChatModal
        friends={friends}
        isOpen={isCreateChatOpen}
        isSubmitting={isCreatingChat}
        onClose={() => setIsCreateChatOpen(false)}
        onCreate={handleCreateChatFromModal}
      />
    </div>
  );
}
