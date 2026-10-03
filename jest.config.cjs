module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/tests/**/*.test.ts?(x)"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.cjs"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  collectCoverageFrom: ["src/App.tsx"],
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
