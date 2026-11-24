// Jest cannot evaluate import.meta.env, so tests use this mutable stand-in
// for src/config/runtime.ts (wired up through moduleNameMapper).
export const runtimeConfig = {
  apiBaseUrl: "https://api.aven.test",
  isDevelopment: false,
};
