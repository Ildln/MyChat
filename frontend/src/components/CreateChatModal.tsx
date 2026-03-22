import { useMemo, useState } from "react";

import { UserAvatar } from "./UserAvatar";
import type { User } from "../types/user";

type CreateChatModalProps = {
  friends: User[];
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onCreate: (friendId: number) => Promise<void>;
};

export function CreateChatModal({
  friends,
  isOpen,
  isSubmitting = false,
  onClose,
  onCreate,
}: CreateChatModalProps) {
  const [query, setQuery] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);

  const filteredFriends = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return friends;
    }
    return friends.filter((friend) => friend.username.toLowerCase().includes(normalizedQuery));
  }, [friends, query]);

  if (!isOpen) {
    return null;
  }

  async function handleCreate() {
    if (!selectedFriendId) {
      return;
    }

    await onCreate(selectedFriendId);
    setQuery("");
    setSelectedFriendId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0f0f10] p-5 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Новая беседа</h3>
            <p className="mt-1 text-sm text-zinc-400">Выберите друга и создайте direct chat.</p>
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

        <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {filteredFriends.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
              Подходящих друзей не найдено.
            </div>
          ) : (
            filteredFriends.map((friend) => {
              const isSelected = selectedFriendId === friend.id;
              return (
                <button
                  className={`flex w-full items-center gap-4 rounded-[20px] border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-white/25 bg-white/10"
                      : "border-white/6 bg-[#171718] hover:bg-[#1c1c1f]"
                  }`}
                  key={friend.id}
                  onClick={() => setSelectedFriendId(friend.id)}
                  type="button"
                >
                  <UserAvatar name={friend.username} seed={friend.id} />
                  <div className="truncate text-[15px] font-semibold text-white">{friend.username}</div>
                </button>
              );
            })
          )}
        </div>

        <button
          className="mt-5 w-full rounded-[18px] bg-white px-5 py-4 text-base font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!selectedFriendId || isSubmitting}
          onClick={() => void handleCreate()}
          type="button"
        >
          {isSubmitting ? "Создаём беседу..." : "Создать беседу"}
        </button>
      </div>
    </div>
  );
}
