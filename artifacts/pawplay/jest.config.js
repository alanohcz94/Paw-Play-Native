module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@workspace/.*)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@workspace/(.*)$": "<rootDir>/../../lib/$1/src/index",
  },
  collectCoverageFrom: [
    "utils/**/*.ts",
    "context/**/*.tsx",
    "hooks/**/*.ts",
    "lib/**/*.ts",
    "!**/__tests__/**",
    "!**/node_modules/**",
  ],
};
