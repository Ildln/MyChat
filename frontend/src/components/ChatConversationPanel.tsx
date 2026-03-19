import { useEffect, useRef, useState, type FormEvent } from "react";

import { getChatTitle } from "../lib/chat";
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

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-3xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 p-4 md:p-5">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              className="rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white"
              onClick={onBack}
              type="button"
            >
              Назад
            </button>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">
              {chat ? getChatTitle(chat, currentUser?.id) : emptyTitle}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {chat ? connectionStatus : emptyText}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
        {!chat ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-zinc-500">
            {emptyText}
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Загружаем историю сообщений...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-zinc-500">
            В этом чате пока нет сообщений. Отправьте первое сообщение.
          </div>
        ) : (
          messages.map((message) => {
            const isMine = currentUser?.id === message.user_id;
            return (
              <div className={`flex ${isMine ? "justify-end" : "justify-start"}`} key={message.id}>
                <div
                  className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm md:max-w-[70%] ${
                    isMine
                      ? "rounded-br-md bg-white text-zinc-950"
                      : "rounded-bl-md border border-zinc-800 bg-zinc-950 text-zinc-100"
                  }`}
                >
                  <div className="mb-1 text-xs opacity-70">user_id={message.user_id}</div>
                  <div className="whitespace-pre-wrap break-words leading-6">{message.text}</div>
                  <div className="mt-2 text-[11px] opacity-60">{message.created_at}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-zinc-800 p-4 md:p-5">
        {status ? (
          <div className="mb-3 rounded-2xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {status}
          </div>
        ) : null}
        <form className="flex items-end gap-3" onSubmit={handleSubmit}>
          <textarea
            className="min-h-[56px] flex-1 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isComposerDisabled}
            onChange={(event) => setText(event.target.value)}
            placeholder={chat ? "Введите сообщение" : "Выберите чат, чтобы начать переписку"}
            value={text}
          />
          <button
            className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isComposerDisabled}
            type="submit"
          >
            {isSending ? "Отправляем..." : "Отправить"}
          </button>
        </form>
      </div>
    </section>
  );
}

