import type { User } from "./user";

export interface Chat {
  id: number;
  type: string;
  created_at: string;
  members: User[];
}
