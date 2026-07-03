export const env = {
  /** Backend origin — the API client and Better Auth target this (CORS-allowed). */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001",
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;
