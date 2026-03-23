import { apiRequest } from "./http";
import type {
  AuthTokenResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginResponse,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  ResetPasswordRequest,
  TwoFactorDisableRequest,
  TwoFactorEnableRequest,
  TwoFactorEnableResponse,
  TwoFactorLoginVerifyRequest,
  TwoFactorSetupResponse,
  TwoFactorVerifyResponse,
} from "../types/auth";
import type { User } from "../types/user";

export function login(payload: LoginRequest) {
  return apiRequest<LoginResponse>("/auth/login", {
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

export function refreshSession(refresh_token: string) {
  return apiRequest<AuthTokenResponse>("/auth/refresh", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ refresh_token }),
  });
}

export function logoutSession() {
  return apiRequest<MessageResponse>("/auth/logout", {
    method: "POST",
  });
}

export function requestPasswordReset(payload: ForgotPasswordRequest) {
  return apiRequest<ForgotPasswordResponse>("/auth/forgot-password", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export function resetPassword(payload: ResetPasswordRequest) {
  return apiRequest<MessageResponse>("/auth/reset-password", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export function changePassword(payload: ChangePasswordRequest) {
  return apiRequest<MessageResponse>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function setupTwoFactor() {
  return apiRequest<TwoFactorSetupResponse>("/auth/2fa/setup", {
    method: "POST",
  });
}

export function enableTwoFactor(payload: TwoFactorEnableRequest) {
  return apiRequest<TwoFactorEnableResponse>("/auth/2fa/enable", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyTwoFactorLogin(payload: TwoFactorLoginVerifyRequest) {
  return apiRequest<TwoFactorVerifyResponse>("/auth/2fa/login/verify", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export function disableTwoFactor(payload: TwoFactorDisableRequest) {
  return apiRequest<MessageResponse>("/auth/2fa/disable", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
