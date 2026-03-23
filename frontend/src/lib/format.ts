import type { User } from "../types/user";

function getDeviceLocale() {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "ru-RU";
}

function buildTimeFormatterOptions(): Intl.DateTimeFormatOptions {
  return {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
}

export function formatMessageTime(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(getDeviceLocale(), {
    ...buildTimeFormatterOptions(),
  }).format(date);
}

export function formatMessageDay(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (sameDay) {
    return formatMessageTime(value);
  }

  return new Intl.DateTimeFormat(getDeviceLocale(), {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function formatLastSeen(value?: string | null): string {
  if (!value) {
    return "был(а) в сети недавно";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "был(а) в сети недавно";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "был(а) в сети только что";
  }

  if (diffMinutes < 60) {
    return `был(а) в сети ${diffMinutes} мин назад`;
  }

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return `был(а) в сети сегодня в ${formatMessageTime(value)}`;
  }

  return `был(а) в сети ${new Intl.DateTimeFormat(getDeviceLocale(), {
    day: "2-digit",
    month: "2-digit",
    ...buildTimeFormatterOptions(),
  }).format(date)}`;
}

export function getPresenceLabel(user: User | null | undefined): string {
  if (user?.is_online) {
    return "в сети";
  }

  return formatLastSeen(user?.last_seen_at);
}
