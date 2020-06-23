module.exports = {
  preset: 'ts-jest',
  verbose: false,
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
      statements: 63,
      branches: 55,
      functions: 68,
      lines: 64,
    },
  },
};
