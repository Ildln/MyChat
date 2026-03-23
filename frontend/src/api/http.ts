import { env } from "../lib/env";
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "../lib/storage";

type RequestOptions = RequestInit & {
  auth?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;
let authFailureHandler: (() => void) | null = null;

export function registerAuthFailureHandler(handler: () => void) {
  authFailureHandler = handler;
}

async function tryRefreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthTokens();
    authFailureHandler?.();
    return false;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        clearAuthTokens();
        authFailureHandler?.();
        return false;
      }

      const payload = await response.json();
      setAuthTokens(payload.access_token, payload.refresh_token);
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  async function executeRequest() {
    return fetch(`${env.apiBaseUrl}${path}`, {
      ...options,
      headers,
    });
  }

  let response = await executeRequest();

  if (response.status === 401 && options.auth !== false && path !== "/auth/refresh") {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      const retryHeaders = new Headers(options.headers || {});
      if (!retryHeaders.has("Content-Type") && options.body) {
        retryHeaders.set("Content-Type", "application/json");
      }
      const newAccessToken = getAccessToken();
      if (newAccessToken) {
        retryHeaders.set("Authorization", `Bearer ${newAccessToken}`);
      }
      response = await fetch(`${env.apiBaseUrl}${path}`, {
        ...options,
        headers: retryHeaders,
      });
    }
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = data?.detail || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  return data as T;
}
