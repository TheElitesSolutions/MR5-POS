/**
 * Secure Configuration Management
 * Implements secure environment variable handling with validation
 */

// Configuration schema with validation
interface AppConfig {
  // Application settings
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  APP_NAME: string;
  APP_VERSION: string;

  // Database settings
  DATABASE_URL: string;
  DB_CONNECTION_LIMIT: number;
  DB_POOL_TIMEOUT: number;

  // Security settings
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  SESSION_SECRET: string;
  SESSION_NAME: string;
  ENCRYPTION_KEY: string;

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;

  // Logging
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  LOG_FILE_ENABLED: boolean;
  LOG_FILE_PATH: string;

  // Development settings
  ENABLE_CORS: boolean;
  ENABLE_DEV_TOOLS: boolean;

  // Printer settings
  PRINTER_ENABLED: boolean;
  PRINTER_TYPE: string;
  PRINTER_WIDTH: number;

  // Security flags
  ALLOWED_ORIGINS: string[];
}

// Default configuration values
const defaultConfig: Partial<AppConfig> = {
  NODE_ENV: 'development',
  PORT: 3000,
  APP_NAME: 'mr5-POS',
  APP_VERSION: '1.0.0',
  DB_CONNECTION_LIMIT: 10,
  DB_POOL_TIMEOUT: 20000,
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  SESSION_NAME: 'mr5_pos_session',
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  LOG_LEVEL: 'info',
  LOG_FILE_ENABLED: true,
  LOG_FILE_PATH: './logs',
  ENABLE_CORS: true,
  ENABLE_DEV_TOOLS: false,
  PRINTER_ENABLED: true,
  PRINTER_TYPE: 'thermal',
  PRINTER_WIDTH: 80,
  ALLOWED_ORIGINS: [],
};

// Environment variable parsers
const parseBoolean = (
  value: string | undefined,
  defaultValue: boolean
): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

const parseNumber = (
  value: string | undefined,
  defaultValue: number
): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseString = (
  value: string | undefined,
  defaultValue: string
): string => {
  return value || defaultValue;
};

const parseStringArray = (
  value: string | undefined,
  defaultValue: string[]
): string[] => {
  if (!value) return defaultValue;
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

// Required environment variables validation
const requiredVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
];

// Validate required environment variables
const validateRequiredVars = (): void => {
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    const isProduction = process.env.NODE_ENV === 'production';
    const message = `Missing required environment variables: ${missing.join(', ')}`;

    if (isProduction) {
      console.error(`❌ Configuration Error: ${message}`);
      process.exit(1);
    } else {
      console.warn(`⚠️  Configuration Warning: ${message}`);
      console.warn(
        '⚠️  Using default values for development. This is NOT secure for production!'
      );
    }
  }
};

// Validate secret strength
const validateSecrets = (config: AppConfig): void => {
  const secrets = [
    { name: 'JWT_SECRET', value: config.JWT_SECRET },
    { name: 'JWT_REFRESH_SECRET', value: config.JWT_REFRESH_SECRET },
    { name: 'SESSION_SECRET', value: config.SESSION_SECRET },
    { name: 'ENCRYPTION_KEY', value: config.ENCRYPTION_KEY },
  ];

  for (const secret of secrets) {
    if (!secret.value || secret.value.length < 32) {
      const message = `${secret.name} must be at least 32 characters long for security`;

      if (config.NODE_ENV === 'production') {
        console.error(`❌ Security Error: ${message}`);
        process.exit(1);
      } else {
        console.warn(`⚠️  Security Warning: ${message}`);
      }
    }

    // Check for common weak secrets
    const weakSecrets = ['secret', 'password', '123456', 'changeme', 'default'];
    if (weakSecrets.some(weak => secret.value.toLowerCase().includes(weak))) {
      const message = `${secret.name} appears to contain weak/default values`;

      if (config.NODE_ENV === 'production') {
        console.error(`❌ Security Error: ${message}`);
        process.exit(1);
      } else {
        console.warn(`⚠️  Security Warning: ${message}`);
      }
    }
  }
};

// Generate secure random string for development defaults
const generateSecureDefault = (length: number = 32): string => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Create configuration object
const createConfig = (): AppConfig => {
  // Validate required variables first
  validateRequiredVars();

  const config: AppConfig = {
    NODE_ENV:
      (process.env.NODE_ENV as AppConfig['NODE_ENV']) ||
      defaultConfig.NODE_ENV!,
    PORT: parseNumber(process.env.PORT, defaultConfig.PORT!),
    APP_NAME: parseString(process.env.APP_NAME, defaultConfig.APP_NAME!),
    APP_VERSION: parseString(
      process.env.APP_VERSION,
      defaultConfig.APP_VERSION!
    ),

    DATABASE_URL:
      process.env.DATABASE_URL ||
      'postgresql://postgres:password@localhost:5432/mr5_pos_dev',
    DB_CONNECTION_LIMIT: parseNumber(
      process.env.DB_CONNECTION_LIMIT,
      defaultConfig.DB_CONNECTION_LIMIT!
    ),
    DB_POOL_TIMEOUT: parseNumber(
      process.env.DB_POOL_TIMEOUT,
      defaultConfig.DB_POOL_TIMEOUT!
    ),

    JWT_SECRET: process.env.JWT_SECRET || generateSecureDefault(64),
    JWT_REFRESH_SECRET:
      process.env.JWT_REFRESH_SECRET || generateSecureDefault(64),
    JWT_EXPIRES_IN: parseString(
      process.env.JWT_EXPIRES_IN,
      defaultConfig.JWT_EXPIRES_IN!
    ),
    JWT_REFRESH_EXPIRES_IN: parseString(
      process.env.JWT_REFRESH_EXPIRES_IN,
      defaultConfig.JWT_REFRESH_EXPIRES_IN!
    ),
    SESSION_SECRET: process.env.SESSION_SECRET || generateSecureDefault(64),
    SESSION_NAME: parseString(
      process.env.SESSION_NAME,
      defaultConfig.SESSION_NAME!
    ),
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || generateSecureDefault(32),

    RATE_LIMIT_WINDOW_MS: parseNumber(
      process.env.RATE_LIMIT_WINDOW_MS,
      defaultConfig.RATE_LIMIT_WINDOW_MS!
    ),
    RATE_LIMIT_MAX_REQUESTS: parseNumber(
      process.env.RATE_LIMIT_MAX_REQUESTS,
      defaultConfig.RATE_LIMIT_MAX_REQUESTS!
    ),

    LOG_LEVEL:
      (process.env.LOG_LEVEL as AppConfig['LOG_LEVEL']) ||
      defaultConfig.LOG_LEVEL!,
    LOG_FILE_ENABLED: parseBoolean(
      process.env.LOG_FILE_ENABLED,
      defaultConfig.LOG_FILE_ENABLED!
    ),
    LOG_FILE_PATH: parseString(
      process.env.LOG_FILE_PATH,
      defaultConfig.LOG_FILE_PATH!
    ),

    ENABLE_CORS: parseBoolean(
      process.env.ENABLE_CORS,
      defaultConfig.ENABLE_CORS!
    ),
    ENABLE_DEV_TOOLS: parseBoolean(
      process.env.ENABLE_DEV_TOOLS,
      defaultConfig.ENABLE_DEV_TOOLS!
    ),

    PRINTER_ENABLED: parseBoolean(
      process.env.PRINTER_ENABLED,
      defaultConfig.PRINTER_ENABLED!
    ),
    PRINTER_TYPE: parseString(
      process.env.PRINTER_TYPE,
      defaultConfig.PRINTER_TYPE!
    ),
    PRINTER_WIDTH: parseNumber(
      process.env.PRINTER_WIDTH,
      defaultConfig.PRINTER_WIDTH!
    ),

    ALLOWED_ORIGINS: parseStringArray(
      process.env.ALLOWED_ORIGINS,
      defaultConfig.ALLOWED_ORIGINS!
    ),
  };

  // Validate secrets
  validateSecrets(config);

  return config;
};

// Export singleton configuration
export const config = createConfig();

// Configuration validation report
export const getConfigReport = (): object => {
  return {
    environment: config.NODE_ENV,
    security: {
      secretsConfigured: !!(
        process.env.JWT_SECRET && process.env.SESSION_SECRET
      ),
      databaseConfigured: !!config.DATABASE_URL,
      corsEnabled: config.ENABLE_CORS,
      rateLimitingEnabled: true,
    },
    database: {
      connectionLimit: config.DB_CONNECTION_LIMIT,
      poolTimeout: config.DB_POOL_TIMEOUT,
    },
    logging: {
      level: config.LOG_LEVEL,
      fileEnabled: config.LOG_FILE_ENABLED,
    },
  };
};

// Environment-specific configurations
export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

// Log configuration status
if (isDevelopment) {
  console.log('📋 Configuration loaded:', getConfigReport());
}
