/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  clearMocks: true,
  coverageDirectory: "coverage",
  moduleNameMapper: {
    // 本包 src 不用 @/；映射到核心源码，以便 workspace 联调 import "tason"
    "^@/(.*)$": "<rootDir>/../tason/src/$1",
    "^tason$": "<rootDir>/../tason/src/index.ts",
  },
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { tsconfig: "<rootDir>/test/tsconfig.json" },
    ],
  },
};
