import { apiRequest } from "./http";
import type { User } from "../types/user";

export function getUsers() {
  return apiRequest<User[]>("/users", { auth: false });
}

export function updateCurrentUser(payload: { about?: string | null; avatar_url?: string | null }) {
  return apiRequest<User>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
