import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/storage";

export function useAuth() {
  return {
    getToken: getAccessToken,
    setToken: setAccessToken,
    logout: clearAccessToken,
    isAuthenticated: Boolean(getAccessToken()),
  };
}
