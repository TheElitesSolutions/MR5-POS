import { app, crashReporter, dialog } from 'electron';
import log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';
import { getAppDataPath, getIsDev } from './utils/environment';

// Configure electron-log
log.transports.file.level = getIsDev() ? 'debug' : 'info';
log.transports.console.level = getIsDev() ? 'debug' : 'info';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error categories for better organization and filtering
export enum ErrorCategory {
  DATABASE = 'database',
  IPC = 'ipc',
  FILESYSTEM = 'filesystem',
  NETWORK = 'network',
  PRINTER = 'printer',
  SECURITY = 'security',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

// Error report interface
export interface ErrorReport {
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  stack: string | undefined;
  context: string;
  electronVersion: string;
  nodeVersion: string;
  platform: string;
}

// Base application error class with enhanced features
export class AppError extends Error {
  public readonly timestamp: string;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly isOperational: boolean;
  public readonly originalError: Error | null;
  public readonly context: Record<string, any> | null;

  constructor(
    message: string,
    isOperational = true,
    severity = ErrorSeverity.MEDIUM,
    category = ErrorCategory.UNKNOWN,
    originalError: Error | null = null,
    context: Record<string, any> | null = null
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.isOperational = isOperational;
    this.severity = severity;
    this.category = category;
    this.originalError = originalError;
    this.context = context;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specialized error types
export class DatabaseError extends AppError {
  constructor(
    message: string,
    isOperational = true,
    severity = ErrorSeverity.HIGH,
    originalError: Error | null = null,
    context: Record<string, any> | null = null
  ) {
    super(
      message,
      isOperational,
      severity,
      ErrorCategory.DATABASE,
      originalError,
      context
    );
  }
}

export class IPCError extends AppError {
  constructor(
    message: string,
    isOperational = true,
    severity = ErrorSeverity.MEDIUM,
    originalError: Error | null = null,
    context: Record<string, any> | null = null
  ) {
    super(
      message,
      isOperational,
      severity,
      ErrorCategory.IPC,
      originalError,
      context
    );
  }
}

export class PrinterError extends AppError {
  constructor(
    message: string,
    isOperational = true,
    severity = ErrorSeverity.MEDIUM,
    originalError: Error | null = null,
    context: Record<string, any> | null = null
  ) {
    super(
      message,
      isOperational,
      severity,
      ErrorCategory.PRINTER,
      originalError,
      context
    );
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    isOperational = true,
    severity = ErrorSeverity.LOW,
    originalError: Error | null = null,
    context: Record<string, any> | null = null
  ) {
    super(
      message,
      isOperational,
      severity,
      ErrorCategory.VALIDATION,
      originalError,
      context
    );
  }
}

export class SecurityError extends AppError {
  constructor(
    message: string,
    isOperational = true,
    severity = ErrorSeverity.HIGH,
    originalError: Error | null = null,
    context: Record<string, any> | null = null
  ) {
    super(
      message,
      isOperational,
      severity,
      ErrorCategory.SECURITY,
      originalError,
      context
    );
  }
}

/**
 * Comprehensive Error Handler for mr5-POS Electron Application
 * Handles logging, crash reporting, and error recovery
 */
class ErrorHandler {
  private crashReportsPath: string;
  private maxCrashReports: number = 10;

  constructor() {
    this.crashReportsPath = path.join(getAppDataPath(), 'crash-reports');
    this.ensureCrashReportsDirectory();
    this.setupLogging();
    this.setupCrashHandlers();
  }

  /**
   * Ensure crash reports directory exists
   */
  private ensureCrashReportsDirectory(): void {
    if (!fs.existsSync(this.crashReportsPath)) {
      fs.mkdirSync(this.crashReportsPath, { recursive: true });
    }
  }

  /**
   * Configure electron-log for comprehensive logging
   */
  private setupLogging(): void {
    // Main process file logging
    log.transports.file.level = getIsDev() ? 'debug' : 'info';
    log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
    const logPath = path.join(getAppDataPath(), 'logs', 'main.log');
    log.transports.file.resolvePathFn = () => logPath;

    // Console logging
    log.transports.console.level = getIsDev() ? 'debug' : 'info';
    log.transports.console.format = '{h}:{i}:{s}.{ms} [{level}] {text}';
  }

  /**
   * Setup global crash and error handlers
   */
  private setupCrashHandlers(): void {
    // Enable crash reporter only if available (after app is ready)
    try {
      if (crashReporter && crashReporter.start) {
        crashReporter.start({
          productName: 'mr5-POS',
          companyName: 'mr5',
          submitURL: '', // Add crash server URL in production
          uploadToServer: false, // Disable for now, enable when server ready
          ignoreSystemCrashHandler: false,
          rateLimit: true,
          compress: true,
        });
      }
    } catch (e) {
      // crashReporter not available yet, skip for now
      console.log('Warning: crashReporter not available yet');
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.handleCrash('uncaughtException', error);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      error.message = `Unhandled Promise Rejection: ${error.message}`;
      this.handleCrash('unhandledRejection', error);
    });

    // Handle renderer process crashes (only if app is available)
    if (app && app.on) {
      app.on('render-process-gone', (event, webContents, details) => {
        this.handleRendererCrash(details);
      });

      // Handle child process crashes
      app.on('child-process-gone', (event, details) => {
        const error = new Error(`Child process crashed: ${details.reason}`);
        this.handleCrash('childProcessGone', error);
      });
    }
  }

  /**
   * Handle application crashes
   */
  private handleCrash(type: string, error: Error): void {
    const errorReport: ErrorReport = {
      timestamp: new Date(),
      level: 'error',
      message: `${type}: ${error.message}`,
      stack: error.stack,
      context: type,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      platform: `${process.platform} ${process.arch}`,
    };

    // Log the error
    log.error(`CRASH [${type}]:`, error.message);
    if (error.stack) {
      log.error('Stack trace:', error.stack);
    }

    // Save crash report
    this.saveCrashReport(errorReport);

    // Show error dialog in development
    if (getIsDev()) {
      this.showErrorDialog(errorReport);
    }

    // Attempt graceful shutdown for critical errors
    if (type === 'uncaughtException') {
      setTimeout(() => {
        if (app && app.quit) {
          app.quit();
        } else {
          process.exit(1);
        }
      }, 1000);
    }
  }

  /**
   * Handle renderer process crashes specifically
   */
  private handleRendererCrash(details: any): void {
    const errorReport: ErrorReport = {
      timestamp: new Date(),
      level: 'error',
      message: `Renderer process crashed: ${details.reason}`,
      stack: undefined,
      context: 'rendererCrash',
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      platform: `${process.platform} ${process.arch}`,
    };

    log.error('Renderer process crashed:', details);
    this.saveCrashReport(errorReport);

    // Attempt to reload the renderer process
    // Note: This would be handled by the window manager
  }

  /**
   * Save crash report to disk
   */
  private saveCrashReport(errorReport: ErrorReport): void {
    try {
      const filename = `crash-${Date.now()}.json`;
      const filepath = path.join(this.crashReportsPath, filename);

      fs.writeFileSync(filepath, JSON.stringify(errorReport, null, 2));

      // Clean up old crash reports
      this.cleanupOldCrashReports();
    } catch (writeError) {
      log.error('Failed to save crash report:', writeError);
    }
  }

  /**
   * Clean up old crash reports to prevent disk space issues
   */
  private cleanupOldCrashReports(): void {
    try {
      const files = fs
        .readdirSync(this.crashReportsPath)
        .filter(file => file.startsWith('crash-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.crashReportsPath, file),
          mtime: fs.statSync(path.join(this.crashReportsPath, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Remove oldest files if we exceed the maximum
      if (files.length > this.maxCrashReports) {
        const filesToRemove = files.slice(this.maxCrashReports);
        filesToRemove.forEach(file => {
          fs.unlinkSync(file.path);
          log.info(`Removed old crash report: ${file.name}`);
        });
      }
    } catch (error) {
      log.error('Failed to cleanup old crash reports:', error);
    }
  }

  /**
   * Show error dialog in development mode
   */
  private showErrorDialog(errorReport: ErrorReport): void {
    const message = `${errorReport.context}: ${errorReport.message}\n\nCheck logs for more details.`;
    dialog.showErrorBox('Application Error', message);
  }

  /**
   * Log error with context
   */
  public logError(error: Error, context?: string): void {
    log.error(`[${context || 'Unknown'}]`, error.message);
    if (error.stack) {
      log.error('Stack:', error.stack);
    }
  }

  /**
   * Log warning with context
   */
  public logWarning(message: string, context?: string): void {
    log.warn(`[${context || 'Unknown'}]`, message);
  }

  /**
   * Log info message with context
   */
  public logInfo(message: string, context?: string): void {
    log.info(`[${context || 'Unknown'}]`, message);
  }

  /**
   * Log debug message with context
   */
  public logDebug(message: string, context?: string): void {
    log.debug(`[${context || 'Unknown'}]`, message);
  }
}

// Create singleton instance - delayed until first use
let errorHandler: ErrorHandler | null = null;

const getErrorHandler = (): ErrorHandler => {
  if (!errorHandler) {
    errorHandler = new ErrorHandler();
  }
  return errorHandler;
};

// Export initialization function
export const initializeErrorHandling = async (): Promise<void> => {
  // Initialize error handler when called (after app is ready)
  getErrorHandler();
  log.info('Error handling system initialized');
};

// Export logging functions for use throughout the application
export const logError = (error: Error | string, context?: string): void => {
  // For early errors before handler is ready, just console.error
  if (!errorHandler) {
    console.error(`[Early Error] ${context || 'Unknown'}:`, error);
    return;
  }
  const errorObj = typeof error === 'string' ? new Error(error) : error;
  getErrorHandler().logError(errorObj, context);
};

export const logWarning = (message: string, context?: string): void => {
  if (!errorHandler) {
    console.warn(`[Early Warning] ${context || 'Unknown'}:`, message);
    return;
  }
  getErrorHandler().logWarning(message, context);
};

export const logInfo = (message: string, context?: string): void => {
  if (!errorHandler) {
    console.log(`[Early Info] ${context || 'Unknown'}:`, message);
    return;
  }
  getErrorHandler().logInfo(message, context);
};

export const logDebug = (message: string, context?: string): void => {
  if (!errorHandler) {
    console.log(`[Early Debug] ${context || 'Unknown'}:`, message);
    return;
  }
  getErrorHandler().logDebug(message, context);
};

export default getErrorHandler;
