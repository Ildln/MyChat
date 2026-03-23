import { useMemo, useState } from "react";

import { UserAvatar } from "./UserAvatar";
import type { Chat } from "../types/chat";
import type { User } from "../types/user";

type GroupChatDetailsModalProps = {
  chat: Chat | null;
  friends: User[];
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onAddMembers: (userIds: number[]) => Promise<void>;
  onLeave: () => Promise<void>;
};

export function GroupChatDetailsModal({
  chat,
  friends,
  isOpen,
  isSubmitting = false,
  onClose,
  onAddMembers,
  onLeave,
}: GroupChatDetailsModalProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const availableFriends = useMemo(() => {
    if (!chat) {
      return [];
    }
    const memberIds = new Set(chat.members.map((member) => member.id));
    return friends.filter((friend) => !memberIds.has(friend.id));
  }, [chat, friends]);

  if (!isOpen || !chat || chat.type !== "group") {
    return null;
  }

  function toggleUser(userId: number) {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  async function handleAddMembers() {
    if (selectedIds.length === 0) {
      return;
    }
    await onAddMembers(selectedIds);
    setSelectedIds([]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0f0f10] p-6 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-white">{chat.title || "Групповая беседа"}</h3>
            <p className="mt-1 text-sm text-zinc-400">Участников: {chat.members.length}</p>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="mt-6">
          <div className="mb-3 text-sm font-semibold text-zinc-300">Участники беседы</div>
          <div className="space-y-3">
            {chat.members.map((member) => (
              <div className="flex items-center gap-3 rounded-[18px] border border-white/6 bg-[#171718] px-4 py-3" key={member.id}>
                <UserAvatar avatarUrl={member.avatar_url} name={member.username} seed={member.id} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{member.username}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-3 text-sm font-semibold text-zinc-300">Добавить участников</div>
          {availableFriends.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">
              Все ваши друзья уже в этой беседе.
            </div>
          ) : (
            <div className="space-y-3">
              {availableFriends.map((friend) => {
                const isSelected = selectedIds.includes(friend.id);
                return (
                  <button
                    className={`flex w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition ${
                      isSelected ? "border-white/20 bg-white/10" : "border-white/6 bg-[#171718] hover:bg-[#1c1c1f]"
                    }`}
                    key={friend.id}
                    onClick={() => toggleUser(friend.id)}
                    type="button"
                  >
                    <UserAvatar avatarUrl={friend.avatar_url} name={friend.username} seed={friend.id} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{friend.username}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            className="flex-1 rounded-[18px] bg-white px-5 py-4 text-base font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
            disabled={selectedIds.length === 0 || isSubmitting}
            onClick={() => void handleAddMembers()}
            type="button"
          >
            Добавить в беседу
          </button>
          <button
            className="rounded-[18px] border border-rose-900 bg-rose-950/40 px-5 py-4 text-base text-rose-200 transition hover:bg-rose-950/70 disabled:opacity-60"
            disabled={isSubmitting}
            onClick={() => void onLeave()}
            type="button"
          >
            Выйти из беседы
          </button>
        </div>
      </div>
    </div>
  );
}
