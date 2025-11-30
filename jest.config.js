/** @type {import('ts-jest').JestConfigWithTsJest} */
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

const ignoreCoverageThresholds =
  process.env.JEST_IGNORE_THRESHOLDS === '1' || process.env.JEST_COVERAGE === '0';

module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/performance/'],
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
    '!src/test/**/*.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: ignoreCoverageThresholds
    ? undefined
    : {
        global: {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75,
        },
      },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup-tests.ts'],
  moduleDirectories: ['node_modules', 'src'],
};
