import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getCurrentUser, login as loginRequest, logoutSession, register as registerRequest } from "../api/auth";
import { registerAuthFailureHandler } from "../api/http";
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "../lib/storage";
import type { LoginRequest, RegisterRequest } from "../types/auth";
import type { User } from "../types/user";

type AuthContextValue = {
  user: User | null;
  token: string;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string>(() => getAccessToken());
  const [isReady, setIsReady] = useState(false);

  const clearLocalSession = useCallback(() => {
    clearAuthTokens();
    setTokenState("");
    setUser(null);
    setIsReady(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getAccessToken()) {
        await logoutSession();
      }
    } catch {
      // Локальная очистка сессии важнее сетевой ошибки logout.
    } finally {
      clearLocalSession();
    }
  }, [clearLocalSession]);

  const refreshUser = useCallback(async () => {
    const currentToken = getAccessToken();
    const currentRefreshToken = getRefreshToken();
    if (!currentToken && !currentRefreshToken) {
      setUser(null);
      return null;
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setTokenState(getAccessToken());
      return currentUser;
    } catch {
      clearLocalSession();
      return null;
    }
  }, [clearLocalSession]);

  const completeAuth = useCallback(async (accessToken: string, refreshToken: string) => {
    setAuthTokens(accessToken, refreshToken);
    setTokenState(accessToken);
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    setIsReady(true);
  }, []);

  const login = useCallback(
    async (payload: LoginRequest) => {
      const response = await loginRequest(payload);
      await completeAuth(response.access_token, response.refresh_token);
    },
    [completeAuth],
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      const response = await registerRequest(payload);
      await completeAuth(response.access_token, response.refresh_token);
    },
    [completeAuth],
  );

  useEffect(() => {
    registerAuthFailureHandler(() => {
      clearLocalSession();
    });
  }, [clearLocalSession]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      const existingToken = getAccessToken();
      const existingRefreshToken = getRefreshToken();
      if (!existingToken && !existingRefreshToken) {
        if (!cancelled) {
          setIsReady(true);
        }
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (!cancelled) {
          setTokenState(getAccessToken());
          setUser(currentUser);
          setIsReady(true);
        }
      } catch {
        if (!cancelled) {
          clearLocalSession();
        }
      }
    }

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [clearLocalSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isReady,
      login,
      register,
      refreshUser,
      logout,
    }),
    [user, token, isReady, login, register, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}
