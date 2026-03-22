import { useMemo, useState } from "react";

import { UserAvatar } from "./UserAvatar";
import type { User } from "../types/user";

type CreateChatModalProps = {
  friends: User[];
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onCreate: (payload: { title: string; userIds: number[] }) => Promise<void>;
};

export function CreateChatModal({
  friends,
  isOpen,
  isSubmitting = false,
  onClose,
  onCreate,
}: CreateChatModalProps) {
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);

  const filteredFriends = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return friends;
    }
    return friends.filter((friend) => friend.username.toLowerCase().includes(normalizedQuery));
  }, [friends, query]);

  const selectedFriends = useMemo(
    () => friends.filter((friend) => selectedFriendIds.includes(friend.id)),
    [friends, selectedFriendIds],
  );

  if (!isOpen) {
    return null;
  }

  function toggleFriend(friendId: number) {
    setSelectedFriendIds((current) =>
      current.includes(friendId) ? current.filter((id) => id !== friendId) : [...current, friendId],
    );
  }

  async function handleCreate() {
    if (selectedFriendIds.length === 0) {
      return;
    }

    await onCreate({
      title,
      userIds: selectedFriendIds,
    });
    setQuery("");
    setTitle("");
    setSelectedFriendIds([]);
  }

  const isGroup = selectedFriendIds.length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0f0f10] p-5 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Новая беседа</h3>
            <p className="mt-1 text-sm text-zinc-400">Выберите одного или нескольких друзей.</p>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <input
            className="w-full rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти друга"
            type="text"
            value={query}
          />
        </div>

        {isGroup ? (
          <div className="mt-4">
            <input
              className="w-full rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Название беседы"
              type="text"
              value={title}
            />
          </div>
        ) : null}

        {selectedFriends.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedFriends.map((friend) => (
              <button
                className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 text-sm text-white transition hover:bg-white/12"
                key={friend.id}
                onClick={() => toggleFriend(friend.id)}
                type="button"
              >
                <UserAvatar avatarUrl={friend.avatar_url} name={friend.username} seed={friend.id} size="sm" />
                <span>{friend.username}</span>
                <span className="text-zinc-400">✕</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {filteredFriends.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
              Подходящих друзей не найдено.
            </div>
          ) : (
            filteredFriends.map((friend) => {
              const isSelected = selectedFriendIds.includes(friend.id);
              return (
                <button
                  className={`flex w-full items-center gap-4 rounded-[20px] border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-white/25 bg-white/10"
                      : "border-white/6 bg-[#171718] hover:bg-[#1c1c1f]"
                  }`}
                  key={friend.id}
                  onClick={() => toggleFriend(friend.id)}
                  type="button"
                >
                  <UserAvatar avatarUrl={friend.avatar_url} name={friend.username} seed={friend.id} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-white">{friend.username}</div>
                    <div className="mt-1 text-sm text-zinc-400">{isSelected ? "Выбран" : "Нажмите, чтобы выбрать"}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <button
          className="mt-5 w-full rounded-[18px] bg-white px-5 py-4 text-base font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={selectedFriendIds.length === 0 || (isGroup && !title.trim()) || isSubmitting}
          onClick={() => void handleCreate()}
          type="button"
        >
          {isSubmitting
            ? "Создаём беседу..."
            : isGroup
              ? "Создать групповую беседу"
              : "Создать direct chat"}
        </button>
      </div>
    </div>
  );
}
