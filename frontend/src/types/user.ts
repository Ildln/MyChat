export interface User {
  id: number;
  username: string;
  avatar_url?: string | null;
  about?: string | null;
  last_seen_at?: string | null;
  is_online?: boolean;
}
