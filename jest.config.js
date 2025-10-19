module.exports = {
  // Test environment setup
  testEnvironment: 'node',

  // Project configuration for different test types
  projects: [
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/main/**/*.test.ts',
        '<rootDir>/main/**/*.spec.ts',
        '<rootDir>/tests/backend/**/*.test.ts'
      ],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: '<rootDir>/tsconfig.json'
        }]
      },
      moduleNameMapper: {
        '^@main/(.*)$': '<rootDir>/main/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1'
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup/backend.setup.ts']
    },
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/renderer/**/*.test.tsx',
        '<rootDir>/renderer/**/*.spec.tsx',
        '<rootDir>/tests/frontend/**/*.test.tsx'
      ],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: {
            jsx: 'react',
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            module: 'commonjs',
            target: 'ES2020',
            isolatedModules: true
          }
        }]
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/renderer/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1',
        '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
        '\\.(gif|ttf|eot|svg|png|jpg)$': '<rootDir>/tests/__mocks__/fileMock.js'
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup/frontend.setup.ts']
    },
    {
      displayName: 'e2e',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/e2e/**/*.test.ts',
        '<rootDir>/tests/e2e/**/*.spec.ts'
      ],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: '<rootDir>/tsconfig.json'
        }]
      },
      testTimeout: 30000
    }
  ],

  // Coverage configuration
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'main/**/*.{ts,tsx}',
    'renderer/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/tests/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },

  // Other configurations
  verbose: true,
  maxWorkers: '50%',
  clearMocks: true,
  restoreMocks: true
};