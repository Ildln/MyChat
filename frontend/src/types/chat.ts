import type { User } from "./user";

export interface Chat {
  id: number;
  type: string;
  title?: string | null;
  created_at: string;
  members: User[];
}
