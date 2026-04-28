module.exports = {
  // Pure node environment — avoids loading react-native/jest/setup.js
  // which uses ESM imports incompatible with Jest's CommonJS runner.
  // All current tests are pure TypeScript utilities with no RN dependencies.
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.[jt]s"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  // Don't transform anything in node_modules for pure TS utils
  transformIgnorePatterns: ["node_modules/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "utils/**/*.ts",
    "!**/__tests__/**",
    "!**/node_modules/**",
  ],
};
