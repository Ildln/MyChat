import { apiRequest } from "./http";
import type { AuthTokenResponse, LoginRequest, RegisterRequest } from "../types/auth";
import type { User } from "../types/user";

export function login(payload: LoginRequest) {
  return apiRequest<AuthTokenResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export function register(payload: RegisterRequest) {
  return apiRequest<AuthTokenResponse>("/auth/register", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export function getCurrentUser() {
  return apiRequest<User>("/auth/me");
}
