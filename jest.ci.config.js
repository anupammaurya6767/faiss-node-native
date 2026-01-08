// Jest configuration for CI/CD - faster, focused on unit tests
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/test/unit/**/*.test.js',
    '**/test/integration/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test/manual/',
    '/test/testsprite/'
  ],
  collectCoverageFrom: [
    'src/js/**/*.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  maxWorkers: 1, // Use single worker to avoid OpenMP/threading conflicts
  testTimeout: 30000,
  // Fail fast in CI
  bail: false,
  // Show which tests are running/failing
  displayName: {
    name: 'FAISS-Node',
    color: 'blue'
  },
  // Report individual test failures
  reporters: ['default']
};
