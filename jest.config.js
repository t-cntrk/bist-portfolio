/**
 * Jest configuration for backend unit tests.
 * Tests live in the tests/ directory and run in a Node environment.
 */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    verbose: true,
    clearMocks: true
};
