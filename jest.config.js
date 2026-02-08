module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/setup\\.ts$',
    '/__tests__/jest\\.setup\\.ts$',
    '/__tests__/phase[0-9]+/index\\.ts$',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      isolatedModules: true,
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/server.ts',
    '!src/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true,
  testTimeout: 30000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest.setup.ts'],
  // Run tests serially to avoid port conflicts
  maxWorkers: 1,
  // Force exit after tests complete (suppress open handle warnings)
  forceExit: true,
};
