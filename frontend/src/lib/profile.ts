import type { User } from "../types/user";

const avatarPalette = [
  "from-amber-200 to-orange-400",
  "from-pink-200 to-rose-400",
  "from-cyan-200 to-sky-400",
  "from-lime-200 to-emerald-400",
  "from-violet-200 to-purple-400",
];

export function getUserInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function getAvatarTone(seed: string | number): string {
  const normalized = String(seed);
  const sum = normalized.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarPalette[sum % avatarPalette.length];
}

export function getUserAbout(user: User | null): string {
  if (!user) {
    return "Пользователь MyChat";
  }

  const variants = [
    "Люблю путешествия и технологии",
    "Всегда на связи в MyChat",
    "Люблю общение и хорошие разговоры",
    "Захожу сюда ради друзей и переписки",
    "Открыт к новым знакомствам и чатам",
  ];

  return variants[user.id % variants.length];
}
