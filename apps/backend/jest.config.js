const { loadEnv } = require("@medusajs/utils");
loadEnv("test", process.cwd());

module.exports = {
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  setupFiles: ["./integration-tests/setup.js"],
};

const testType = (process.env.TEST_TYPE || "unit").trim();
if (testType === "integration:http") {
  module.exports.testMatch = ["<rootDir>/integration-tests/http/*.spec.[jt]s"];
} else if (testType === "integration:db") {
  module.exports.testMatch = ["<rootDir>/integration-tests/db/*.spec.[jt]s"];
} else if (testType === "integration:modules") {
  module.exports.testMatch = ["<rootDir>/src/modules/*/__tests__/**/*.[jt]s"];
} else {
  module.exports.testMatch = ["<rootDir>/src/**/__tests__/**/*.unit.spec.[jt]s"];
}
