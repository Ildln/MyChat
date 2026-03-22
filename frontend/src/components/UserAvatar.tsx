import { getAvatarTone, getUserInitials } from "../lib/profile";

type UserAvatarProps = {
  name: string;
  seed: string | number;
  size?: "sm" | "md" | "lg" | "xl";
  avatarUrl?: string | null;
};

const sizeClasses = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

export function UserAvatar({ name, seed, size = "md", avatarUrl }: UserAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        alt={name}
        className={`${sizeClasses[size]} inline-flex rounded-full object-cover shadow-lg shadow-black/30`}
        src={avatarUrl}
      />
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br ${getAvatarTone(seed)} ${sizeClasses[size]} font-semibold text-zinc-950 shadow-lg shadow-black/30`}
    >
      {getUserInitials(name)}
    </div>
  );
}
