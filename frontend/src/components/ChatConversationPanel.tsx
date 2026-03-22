import { type FormEvent, useEffect, useRef, useState } from "react";

import { formatMessageTime, getPresenceLabel } from "../lib/format";
import { getChatSubtitle, getChatTitle } from "../lib/chat";
import { UserAvatar } from "./UserAvatar";
import type { Chat } from "../types/chat";
import type { ChatMessage } from "../types/message";
import type { User } from "../types/user";

type ChatConversationPanelProps = {
  chat: Chat | null;
  currentUser: User | null;
  messages: ChatMessage[];
  isLoading: boolean;
  connectionStatus: string;
  emptyTitle?: string;
  emptyText?: string;
  onSendMessage: (text: string) => Promise<void>;
  onBack?: () => void;
};

export function ChatConversationPanel({
  chat,
  currentUser,
  messages,
  isLoading,
  connectionStatus,
  emptyTitle = "Выберите чат",
  emptyText = "Откройте direct chat, чтобы увидеть историю сообщений.",
  onSendMessage,
  onBack,
}: ChatConversationPanelProps) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const companion = chat?.members.find((member) => member.id !== currentUser?.id) || chat?.members[0] || null;
  const chatTitle = chat ? getChatTitle(chat, currentUser?.id) : emptyTitle;
  const avatarName = chat?.type === "group" ? chatTitle : companion?.username || chatTitle;
  const avatarUrl = chat?.type === "group" ? null : companion?.avatar_url;
  const subtitle = chat?.type === "group" ? getChatSubtitle(chat) : getPresenceLabel(companion);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chat) {
      setStatus("Выберите чат, чтобы начать переписку.");
      return;
    }

    setIsSending(true);
    setStatus("");

    try {
      await onSendMessage(text);
      setText("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось отправить сообщение.");
    } finally {
      setIsSending(false);
    }
  }

  const isComposerDisabled = !chat || isSending;

  if (!chat) {
    return (
      <section className="flex min-h-screen flex-col bg-[#09090a] text-zinc-50">
        <div className="border-b border-white/6 px-5 py-5 md:px-10 md:py-6">
          <div className="text-lg font-semibold text-white">{emptyTitle}</div>
          <div className="mt-2 text-sm text-zinc-400">{emptyText}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-screen flex-col bg-[#09090a] text-zinc-50">
      <header className="sticky top-0 z-10 border-b border-white/6 bg-[#09090a]/95 px-5 py-5 backdrop-blur md:px-10 md:py-6">
        <div className="flex items-center gap-4">
          {onBack ? (
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-2xl text-white transition hover:bg-white/5"
              onClick={onBack}
              type="button"
            >
              ←
            </button>
          ) : null}
          <UserAvatar avatarUrl={avatarUrl} name={avatarName} seed={chat.id} size="md" />
          <div className="min-w-0">
            <div className="truncate text-[24px] font-semibold text-white md:text-[28px]">
              {chatTitle}
            </div>
            <div className="mt-1 text-sm text-zinc-400">{subtitle}</div>
          </div>
        </div>
        {chat.type === "group" ? (
          <div className="mt-4 truncate text-sm text-zinc-500">
            Участники: {chat.members.map((member) => member.username).join(", ")}
          </div>
        ) : null}
      </header>

      <div className="px-5 pt-4 text-sm text-zinc-500 md:px-10">{connectionStatus}</div>

      <div className="flex-1 overflow-y-auto px-5 py-6 md:px-10 md:py-8">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">Загружаем историю сообщений...</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-zinc-500">
            В этом чате пока нет сообщений. Отправьте первое сообщение.
          </div>
        ) : (
          <div className="space-y-5 md:space-y-7">
            {messages.map((message) => {
              const isMine = currentUser?.id === message.user_id;
              return (
                <div className={`flex ${isMine ? "justify-end" : "justify-start"}`} key={message.id}>
                  <div
                    className={`max-w-[78%] rounded-[22px] px-5 py-4 shadow-[0_14px_30px_rgba(0,0,0,0.18)] md:max-w-[44%] ${
                      isMine
                        ? "rounded-br-md bg-white text-zinc-950"
                        : "rounded-bl-md bg-[#1c1c1f] text-white"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words text-[15px] leading-7">{message.text}</div>
                    <div className={`mt-2 text-xs ${isMine ? "text-zinc-500" : "text-zinc-400"}`}>
                      {formatMessageTime(message.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-white/6 bg-[#09090a]/95 px-5 py-4 backdrop-blur md:px-10 md:py-5">
        {status ? (
          <div className="mb-3 rounded-[18px] border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {status}
          </div>
        ) : null}
        <form className="flex items-end gap-3" onSubmit={handleSubmit}>
          <textarea
            className="min-h-[56px] flex-1 rounded-[18px] border border-white/6 bg-[#171718] px-5 py-4 text-[15px] text-white outline-none transition placeholder:text-zinc-500 focus:border-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isComposerDisabled}
            onChange={(event) => setText(event.target.value)}
            placeholder={chat ? "Написать сообщение..." : "Выберите чат, чтобы начать переписку"}
            value={text}
          />
          <button
            className="inline-flex items-center justify-center rounded-[18px] bg-white px-5 py-4 text-base font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60 md:min-w-[164px]"
            disabled={isComposerDisabled}
            type="submit"
          >
            <span className="hidden md:inline">Отправить</span>
            <span className="text-xl md:hidden">➤</span>
          </button>
        </form>
      </div>
    </section>
  );
}
