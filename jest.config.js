module.exports = {
  rootDir: '.',
  testMatch: [
    '<rootDir>/tests/unit/**/*.spec.ts',
    '<rootDir>/tests/integration/**/*.e2e-spec.ts',
    '<rootDir>/tests/integration/**/*.spec.ts',
    '<rootDir>/src/**/*.spec.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.git/',
  ],
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@nestjs|reflect-metadata|rxjs|pg|pg-hstore|sequelize|sequelize-typescript))',
  ],
};
