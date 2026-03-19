import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getCurrentUser, login as loginRequest, register as registerRequest } from "../api/auth";
import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/storage";
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
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string>(() => getAccessToken());
  const [isReady, setIsReady] = useState(false);

  const logout = useCallback(() => {
    clearAccessToken();
    setTokenState("");
    setUser(null);
    setIsReady(true);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = getAccessToken();
    if (!currentToken) {
      setUser(null);
      return null;
    }

    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setTokenState(currentToken);
      return currentUser;
    } catch {
      logout();
      return null;
    }
  }, [logout]);

  const completeAuth = useCallback(async (newToken: string) => {
    setAccessToken(newToken);
    setTokenState(newToken);
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    setIsReady(true);
  }, []);

  const login = useCallback(
    async (payload: LoginRequest) => {
      const response = await loginRequest(payload);
      await completeAuth(response.access_token);
    },
    [completeAuth],
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      const response = await registerRequest(payload);
      await completeAuth(response.access_token);
    },
    [completeAuth],
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      const existingToken = getAccessToken();
      if (!existingToken) {
        if (!cancelled) {
          setIsReady(true);
        }
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (!cancelled) {
          setTokenState(existingToken);
          setUser(currentUser);
          setIsReady(true);
        }
      } catch {
        if (!cancelled) {
          logout();
        }
      }
    }

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [logout]);

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
