module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['*.ts', '!jest.config.js'],
  coverageDirectory: 'coverage',
  verbose: true,
};
