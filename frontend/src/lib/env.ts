function requireEnv(name: "VITE_API_BASE_URL" | "VITE_WS_BASE_URL"): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}`);
  }
  return value.replace(/\/$/, "");
}

export const env = {
  apiBaseUrl: requireEnv("VITE_API_BASE_URL"),
  wsBaseUrl: requireEnv("VITE_WS_BASE_URL"),
};
