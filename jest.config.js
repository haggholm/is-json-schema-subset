module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!test/common.ts',
    '!node_modules/**',
    '!dist/**',
    '!coverage/**',
  ],
  // coveragePathIgnorePatterns: [
  //   '<rootDir>/src/foo.ts',
  // ],
  coverageThreshold: {
    global: {
      statements: 64,
      branches: 57,
      functions: 68,
      lines: 64,
    },
  },
};
