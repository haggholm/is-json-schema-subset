module.exports = {
  preset: 'ts-jest',
  verbose: false,
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!test/common.ts',
    '!src/log-util.ts',
    '!src/types.ts',
    '!node_modules/**',
    '!dist/**',
    '!coverage/**',
  ],
  coverageThreshold: {
    global: {
      statements: 71,
      branches: 66,
      functions: 64,
      lines: 71,
    },
  },
};
