import { apiRequest } from "./http";
import type { User } from "../types/user";

export function getUsers() {
  return apiRequest<User[]>("/users", { auth: false });
}
