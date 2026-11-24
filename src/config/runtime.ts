// Build-time settings for the browser bundle. VITE_AVEN_API_URL is a public
// URL (never a secret); API keys live only on the Aven API server.
export const runtimeConfig = {
  apiBaseUrl: (import.meta.env.VITE_AVEN_API_URL ?? "").trim().replace(/\/+$/, ""),
  isDevelopment: import.meta.env.DEV,
};
