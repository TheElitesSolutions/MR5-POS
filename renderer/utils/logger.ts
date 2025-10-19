/**
 * Production-Safe Logger Utility
 *
 * This logger automatically gates all logging based on NODE_ENV.
 * In production, all logs are suppressed to improve performance and security.
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.info('User action', { data });
 *   logger.error('Error occurred', error);
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LoggerConfig {
  enabled: boolean;
  prefix?: string;
}

class Logger {
  private config: LoggerConfig;

  constructor(
    config: LoggerConfig = { enabled: process.env.NODE_ENV !== 'production' }
  ) {
    this.config = config;
  }

  private shouldLog(): boolean {
    return this.config.enabled;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    ...args: any[]
  ): [string, ...any[]] {
    const prefix = this.config.prefix ? `[${this.config.prefix}]` : '';
    const timestamp = new Date().toISOString();
    return [
      `${prefix} [${level.toUpperCase()}] ${timestamp} - ${message}`,
      ...args,
    ];
  }

  log(message: string, ...args: any[]): void {
    if (this.shouldLog()) {
      console.log(...this.formatMessage('log', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog()) {
      console.info(...this.formatMessage('info', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog()) {
      console.warn(...this.formatMessage('warn', message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    // Always log errors, even in production (can be sent to error tracking service)
    console.error(...this.formatMessage('error', message, ...args));
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog()) {
      console.debug(...this.formatMessage('debug', message, ...args));
    }
  }

  /**
   * Create a child logger with a specific prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      enabled: this.config.enabled,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix,
    });
  }
}

// Export default logger instance
export const logger = new Logger();

// Export logger for specific modules
export const posLogger = logger.child('POS');
export const menuLogger = logger.child('Menu');
export const orderLogger = logger.child('Order');
export const stockLogger = logger.child('Stock');
export const authLogger = logger.child('Auth');
export const appLogger = logger.child('App');

export default logger;
