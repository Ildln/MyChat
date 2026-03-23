const ACCESS_TOKEN_KEY = "mychat_frontend_access_token";
const REFRESH_TOKEN_KEY = "mychat_frontend_refresh_token";
const TRUSTED_DEVICE_TOKEN_KEY = "mychat_frontend_trusted_device_token";

export function getAccessToken(): string {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export function getRefreshToken(): string {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || "";
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function setAuthTokens(accessToken: string, refreshToken: string): void {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
}

export function getTrustedDeviceToken(): string {
  return localStorage.getItem(TRUSTED_DEVICE_TOKEN_KEY) || "";
}

export function setTrustedDeviceToken(token: string): void {
  localStorage.setItem(TRUSTED_DEVICE_TOKEN_KEY, token);
}

export function clearTrustedDeviceToken(): void {
  localStorage.removeItem(TRUSTED_DEVICE_TOKEN_KEY);
}

export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  clearTrustedDeviceToken();
}
