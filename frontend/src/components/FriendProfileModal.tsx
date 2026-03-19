import type { User } from "../types/user";
import { getUserAbout } from "../lib/profile";
import { UserAvatar } from "./UserAvatar";

type FriendProfileModalProps = {
  friend: User | null;
  isOpen: boolean;
  onClose: () => void;
  onWriteMessage: (friendId: number) => void;
};

export function FriendProfileModal({
  friend,
  isOpen,
  onClose,
  onWriteMessage,
}: FriendProfileModalProps) {
  if (!isOpen || !friend) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[28px] border border-white/10 bg-[#0f0f10] p-6 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/5 hover:text-white"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <UserAvatar name={friend.username} seed={friend.id} size="xl" />
          <h3 className="mt-5 text-[34px] font-semibold leading-none text-white">{friend.username}</h3>
          <p className="mt-4 text-[15px] leading-7 text-zinc-400">
            <span className="text-zinc-300">О себе:</span> {getUserAbout(friend)}
          </p>
          <button
            className="mt-8 w-full rounded-[18px] bg-white px-5 py-4 text-base font-medium text-zinc-950 transition hover:bg-zinc-200"
            onClick={() => onWriteMessage(friend.id)}
            type="button"
          >
            Написать сообщение
          </button>
        </div>
      </div>
    </div>
  );
}
