/**
 * Jest Global Setup
 * 
 * Runs before all tests to configure the test environment
 * and after all tests to clean up resources.
 */

// Increase timeout for all tests
jest.setTimeout(30000);

// Suppress console logs during tests (optional - comment out to see logs)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Clean up any hanging connections after all tests
afterAll(async () => {
  // Give time for connections to close
  await new Promise(resolve => setTimeout(resolve, 500));
});

// Export empty to make this a module
export {};
