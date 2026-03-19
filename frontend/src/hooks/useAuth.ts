import { useAuthContext } from "../app/AuthProvider";

export function useAuth() {
  return useAuthContext();
}
