function getDeviceLocale() {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "ru-RU";
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
    hour: "2-digit",
    minute: "2-digit",
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
