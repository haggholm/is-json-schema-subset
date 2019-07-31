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
};
