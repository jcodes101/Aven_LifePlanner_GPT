module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/tests/**/*.test.ts?(x)"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.cjs"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  // import.meta.env only exists inside Vite, so tests use a stand-in.
  moduleNameMapper: {
    "^.+/config/runtime$": "<rootDir>/tests/mocks/runtime.ts",
  },
  collectCoverageFrom: [
    "src/App.tsx",
    "src/components/chat/RecentChatsModal.tsx",
    "src/hooks/**/*.ts",
    "src/services/**/*.ts",
    "src/utils/**/*.ts",
    "server/**/*.ts",
    "!server/index.ts",
  ],
  coverageThreshold: {
    global: {
      lines: 85,
      statements: 85,
      branches: 85,
    },
  },
  coverageReporters: ["text", "lcov"],
  clearMocks: true,
};
