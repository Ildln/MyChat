import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getCurrentUser, login as loginRequest, logoutSession, register as registerRequest, verifyTwoFactorLogin } from "../api/auth";
import { registerAuthFailureHandler } from "../api/http";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  getTrustedDeviceToken,
  setAuthTokens,
  setTrustedDeviceToken,
} from "../lib/storage";
import type { LoginRequest, RegisterRequest } from "../types/auth";
import type { User } from "../types/user";

type TwoFactorChallenge = {
  userId: number;
  username: string;
  loginChallengeToken: string;
};

type AuthContextValue = {
  user: User | null;
  token: string;
  isAuthenticated: boolean;
  isReady: boolean;
  twoFactorChallenge: TwoFactorChallenge | null;
  login: (payload: LoginRequest) => Promise<boolean>;
  verifyTwoFactor: (code: string, rememberDevice: boolean) => Promise<void>;
  cancelTwoFactor: () => void;
  register: (payload: RegisterRequest) => Promise<void>;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string>(() => getAccessToken());
  const [isReady, setIsReady] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<TwoFactorChallenge | null>(null);

  const clearLocalSession = useCallback(() => {
    clearAuthTokens();
    setTokenState("");
    setUser(null);
    setTwoFactorChallenge(null);
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
    setTwoFactorChallenge(null);
    setIsReady(true);
  }, []);

  const login = useCallback(
    async (payload: LoginRequest) => {
      const response = await loginRequest({
        ...payload,
        trusted_device_token: getTrustedDeviceToken() || undefined,
      });

      if (response.requires_two_factor) {
        setTwoFactorChallenge({
          userId: response.user_id || 0,
          username: response.username || payload.username.trim(),
          loginChallengeToken: response.login_challenge_token || "",
        });
        setIsReady(true);
        return false;
      }

      await completeAuth(response.access_token || "", response.refresh_token || "");
      if (response.trusted_device_token) {
        setTrustedDeviceToken(response.trusted_device_token);
      }
      return true;
    },
    [completeAuth],
  );

  const verifyTwoFactor = useCallback(
    async (code: string, rememberDevice: boolean) => {
      if (!twoFactorChallenge) {
        throw new Error("Нет активного шага двухфакторной проверки.");
      }

      const response = await verifyTwoFactorLogin({
        login_challenge_token: twoFactorChallenge.loginChallengeToken,
        code,
        remember_device: rememberDevice,
      });
      await completeAuth(response.access_token, response.refresh_token);
      if (response.trusted_device_token) {
        setTrustedDeviceToken(response.trusted_device_token);
      }
    },
    [completeAuth, twoFactorChallenge],
  );

  const cancelTwoFactor = useCallback(() => {
    setTwoFactorChallenge(null);
  }, []);

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
      twoFactorChallenge,
      login,
      verifyTwoFactor,
      cancelTwoFactor,
      register,
      refreshUser,
      logout,
    }),
    [user, token, isReady, twoFactorChallenge, login, verifyTwoFactor, cancelTwoFactor, register, refreshUser, logout],
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
