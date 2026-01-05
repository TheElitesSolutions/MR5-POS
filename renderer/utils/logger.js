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
class Logger {
    constructor(config = { enabled: process.env.NODE_ENV !== 'production' }) {
        this.config = config;
    }
    shouldLog() {
        return this.config.enabled;
    }
    formatMessage(level, message, ...args) {
        const prefix = this.config.prefix ? `[${this.config.prefix}]` : '';
        const timestamp = new Date().toISOString();
        return [
            `${prefix} [${level.toUpperCase()}] ${timestamp} - ${message}`,
            ...args,
        ];
    }
    log(message, ...args) {
        if (this.shouldLog()) {
            console.log(...this.formatMessage('log', message, ...args));
        }
    }
    info(message, ...args) {
        if (this.shouldLog()) {
            console.info(...this.formatMessage('info', message, ...args));
        }
    }
    warn(message, ...args) {
        if (this.shouldLog()) {
            console.warn(...this.formatMessage('warn', message, ...args));
        }
    }
    error(message, ...args) {
        // Always log errors, even in production (can be sent to error tracking service)
        console.error(...this.formatMessage('error', message, ...args));
    }
    debug(message, ...args) {
        if (this.shouldLog()) {
            console.debug(...this.formatMessage('debug', message, ...args));
        }
    }
    /**
     * Create a child logger with a specific prefix
     */
    child(prefix) {
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
