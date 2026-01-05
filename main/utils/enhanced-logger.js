/**
 * Enhanced Logging System for mr5-POS
 *
 * Features:
 * - Structured JSON logging with consistent format
 * - Multiple transports (file, console, IPC)
 * - Log rotation and compression
 * - Log levels with color coding
 * - Context-based logging with module/component tracking
 * - Performance metrics and timing
 * - Request/response logging
 * - Log filtering and search
 * - Support for log visualization tools
 */
import { createHash } from 'crypto';
import { app } from 'electron';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { getIsDev } from './environment';
// Log levels with numeric values for filtering
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["TRACE"] = 0] = "TRACE";
    LogLevel[LogLevel["DEBUG"] = 1] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["WARN"] = 3] = "WARN";
    LogLevel[LogLevel["ERROR"] = 4] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 5] = "FATAL";
    LogLevel[LogLevel["SILENT"] = 6] = "SILENT";
})(LogLevel || (LogLevel = {}));
// Log categories for better organization
export var LogCategory;
(function (LogCategory) {
    LogCategory["DATABASE"] = "database";
    LogCategory["IPC"] = "ipc";
    LogCategory["FILESYSTEM"] = "filesystem";
    LogCategory["NETWORK"] = "network";
    LogCategory["PRINTER"] = "printer";
    LogCategory["SECURITY"] = "security";
    LogCategory["VALIDATION"] = "validation";
    LogCategory["BUSINESS"] = "business";
    LogCategory["SYSTEM"] = "system";
    LogCategory["PERFORMANCE"] = "performance";
    LogCategory["UI"] = "ui";
    LogCategory["UNKNOWN"] = "unknown";
})(LogCategory || (LogCategory = {}));
/**
 * Enhanced Logger class with multiple transports and advanced features
 */
export class EnhancedLogger {
    constructor() {
        this.currentLogFile = '';
        this.currentLogStream = null;
        this.currentLogSize = 0;
        this.logQueue = [];
        this.isProcessingQueue = false;
        this.timers = new Map();
        this.lastRotationCheck = new Date();
        // Generate unique session ID
        this.sessionId = createHash('sha256')
            .update(`${Date.now()}-${Math.random()}`)
            .digest('hex')
            .substring(0, 8);
        // Default configuration
        // Safely get the log directory - handle case when app is not ready
        let logDir;
        try {
            if (app && app.getPath) {
                logDir = path.join(app.getPath('userData'), 'logs');
            }
            else {
                // Fallback to temp directory if app is not ready
                logDir = path.join(process.env.TEMP || '/tmp', 'mr5-pos', 'logs');
            }
        }
        catch (e) {
            // If app.getPath fails, use fallback
            logDir = path.join(process.env.TEMP || '/tmp', 'mr5-pos', 'logs');
        }
        this.config = {
            appName: 'mr5-pos',
            minLevel: getIsDev() ? LogLevel.DEBUG : LogLevel.INFO,
            enableConsole: true,
            enableFile: true,
            enableIPC: false,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 10,
            logDir: logDir,
            enableCompression: true,
            includeProcessInfo: true,
            prettyPrintConsole: getIsDev(),
            rotationInterval: 'daily',
        };
        // Initialize logging system
        this.initializeLogger();
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!EnhancedLogger.instance) {
            EnhancedLogger.instance = new EnhancedLogger();
        }
        return EnhancedLogger.instance;
    }
    /**
     * Initialize the logger
     */
    initializeLogger() {
        // Ensure log directory exists
        fs.ensureDirSync(this.config.logDir);
        // Set up current log file
        this.setupLogFile();
        // Set up process event handlers
        this.setupProcessHandlers();
        // Initial log entry
        this.info(`Logging system initialized (${getIsDev() ? 'development' : 'production'})`, LogCategory.SYSTEM, 'logger', { sessionId: this.sessionId });
    }
    /**
     * Set up the log file with rotation if needed
     */
    setupLogFile() {
        const timestamp = this.getTimestampForFilename();
        const baseFilename = `${this.config.appName}-${timestamp}.log`;
        this.currentLogFile = path.join(this.config.logDir, baseFilename);
        // Close existing stream if any
        if (this.currentLogStream) {
            this.currentLogStream.end();
            this.currentLogStream = null;
        }
        // Create new write stream
        this.currentLogStream = fs.createWriteStream(this.currentLogFile, {
            flags: 'a',
        });
        this.currentLogSize = fs.existsSync(this.currentLogFile)
            ? fs.statSync(this.currentLogFile).size
            : 0;
        // Clean up old log files
        this.cleanupOldLogFiles();
    }
    /**
     * Get timestamp string for log filenames
     */
    getTimestampForFilename() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        if (this.config.rotationInterval === 'hourly') {
            const hour = String(now.getHours()).padStart(2, '0');
            return `${year}${month}${day}-${hour}`;
        }
        return `${year}${month}${day}`;
    }
    /**
     * Set up process event handlers for graceful shutdown
     */
    setupProcessHandlers() {
        // Handle process exit
        process.on('exit', () => {
            this.flushSync();
        });
        // Handle uncaught exceptions
        process.on('uncaughtException', error => {
            this.fatal('Uncaught exception', LogCategory.SYSTEM, 'process', {
                error,
            });
            this.flushSync();
        });
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, _promise) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            this.error('Unhandled promise rejection', LogCategory.SYSTEM, 'process', {
                error,
            });
        });
    }
    /**
     * Clean up old log files based on retention policy
     */
    cleanupOldLogFiles() {
        try {
            const files = fs
                .readdirSync(this.config.logDir)
                .filter(file => file.startsWith(this.config.appName) && file.endsWith('.log'))
                .map(file => ({
                name: file,
                path: path.join(this.config.logDir, file),
                time: fs
                    .statSync(path.join(this.config.logDir, file))
                    .mtime.getTime(),
            }))
                .sort((a, b) => b.time - a.time); // Sort by time, newest first
            // Keep only the most recent files based on maxFiles config
            if (files.length > this.config.maxFiles) {
                const filesToDelete = files.slice(this.config.maxFiles);
                for (const file of filesToDelete) {
                    // Compress log file before deletion if enabled
                    if (this.config.enableCompression) {
                        this.compressLogFile(file.path);
                    }
                    else {
                        fs.unlinkSync(file.path);
                    }
                }
            }
        }
        catch (error) {
            console.error('Error cleaning up old log files:', error);
        }
    }
    /**
     * Compress a log file using gzip
     */
    compressLogFile(filePath) {
        try {
            const gzFilePath = `${filePath}.gz`;
            const fileContent = fs.readFileSync(filePath);
            const compressed = zlib.gzipSync(fileContent);
            fs.writeFileSync(gzFilePath, compressed);
            fs.unlinkSync(filePath);
        }
        catch (error) {
            console.error('Error compressing log file:', error);
        }
    }
    /**
     * Check if log rotation is needed
     */
    checkRotation() {
        const now = new Date();
        // Check file size rotation
        if (this.currentLogSize >= this.config.maxFileSize) {
            this.setupLogFile();
            return;
        }
        // Check time-based rotation
        if (this.config.rotationInterval === 'never') {
            return;
        }
        const needsRotation = this.config.rotationInterval === 'hourly'
            ? now.getHours() !== this.lastRotationCheck.getHours() ||
                now.getDate() !== this.lastRotationCheck.getDate()
            : now.getDate() !== this.lastRotationCheck.getDate();
        if (needsRotation) {
            this.setupLogFile();
            this.lastRotationCheck = now;
        }
    }
    /**
     * Format a log entry as a string
     */
    formatLogEntry(entry) {
        if (this.config.prettyPrintConsole) {
            // Pretty format for console
            return this.formatPrettyLogEntry(entry);
        }
        // JSON format for file and other transports
        return JSON.stringify(entry);
    }
    /**
     * Format a log entry for pretty console output
     */
    formatPrettyLogEntry(entry) {
        const colors = {
            [LogLevel.TRACE]: '\x1b[90m', // Gray
            [LogLevel.DEBUG]: '\x1b[36m', // Cyan
            [LogLevel.INFO]: '\x1b[32m', // Green
            [LogLevel.WARN]: '\x1b[33m', // Yellow
            [LogLevel.ERROR]: '\x1b[31m', // Red
            [LogLevel.FATAL]: '\x1b[35m', // Magenta
            reset: '\x1b[0m',
        };
        const color = colors[entry.levelCode] || colors.reset;
        const reset = colors.reset;
        // Format: [TIME] [LEVEL] [CATEGORY] [MODULE] Message
        let timeString = entry.timestamp;
        try {
            const parts = entry.timestamp.split('T');
            if (parts.length > 1 && parts[1]) {
                const timePart = parts[1].split('.');
                if (timePart.length > 0 && timePart[0]) {
                    timeString = timePart[0];
                }
            }
        }
        catch (e) {
            // Keep default timeString if any error occurs
        }
        let output = `${color}[${timeString}] `;
        output += `[${entry.level.padEnd(5)}] `;
        if (entry.category) {
            output += `[${entry.category}] `;
        }
        if (entry.module) {
            output += `[${entry.module}] `;
        }
        output += `${entry.message}${reset}`;
        // Add context if available
        if (entry.context && Object.keys(entry.context).length > 0) {
            output += `\n${JSON.stringify(entry.context, null, 2)}`;
        }
        // Add error stack if available
        if (entry.error?.stack) {
            output += `\n${entry.error.stack}`;
        }
        return output;
    }
    /**
     * Create a log entry
     */
    createLogEntry(level, message, category, module, context, error) {
        const now = new Date();
        // Create base log entry with required properties
        const entry = {
            timestamp: now.toISOString(),
            level: LogLevel[level],
            levelCode: level,
            message,
            sessionId: this.sessionId,
        };
        // Add optional properties only if they have values
        if (category !== undefined) {
            entry.category = category;
        }
        if (module !== undefined) {
            entry.module = module;
        }
        if (context !== undefined) {
            entry.context = context;
        }
        // Add error information if provided
        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
            };
            // Only add stack if it exists
            if (error.stack !== undefined) {
                entry.error.stack = error.stack;
            }
        }
        // Add process info if enabled
        if (this.config.includeProcessInfo) {
            entry.processInfo = {
                pid: process.pid,
                hostname: os.hostname(),
                platform: process.platform,
                memory: process.memoryUsage().heapUsed,
            };
        }
        return entry;
    }
    /**
     * Write log entry to all enabled transports
     */
    writeLogEntry(entry) {
        // Skip if below minimum level
        if (entry.levelCode < this.config.minLevel) {
            return;
        }
        // Check for log rotation
        this.checkRotation();
        // Format the log entry
        const formattedEntry = this.formatLogEntry(entry);
        // Write to console if enabled
        if (this.config.enableConsole) {
            const consoleMethod = this.getConsoleMethod(entry.levelCode);
            consoleMethod(this.config.prettyPrintConsole ? formattedEntry : entry);
        }
        // Write to file if enabled
        if (this.config.enableFile && this.currentLogStream) {
            const entryWithNewline = this.config.prettyPrintConsole
                ? `${formattedEntry}\n`
                : `${JSON.stringify(entry)}\n`;
            this.currentLogStream.write(entryWithNewline);
            this.currentLogSize += entryWithNewline.length;
        }
        // Send via IPC if enabled
        if (this.config.enableIPC) {
            // Implementation for IPC transport would go here
        }
    }
    /**
     * Get the appropriate console method based on log level
     */
    getConsoleMethod(level) {
        switch (level) {
            case LogLevel.TRACE:
                return console.debug;
            case LogLevel.DEBUG:
                return console.debug;
            case LogLevel.INFO:
                return console.info;
            case LogLevel.WARN:
                return console.warn;
            case LogLevel.ERROR:
            case LogLevel.FATAL:
                return console.error;
            default:
                return console.log;
        }
    }
    /**
     * Queue a log entry for writing
     */
    queueLogEntry(entry) {
        this.logQueue.push(entry);
        this.processQueue();
    }
    /**
     * Process the log queue asynchronously
     */
    async processQueue() {
        if (this.isProcessingQueue || this.logQueue.length === 0) {
            return;
        }
        this.isProcessingQueue = true;
        try {
            while (this.logQueue.length > 0) {
                const entry = this.logQueue.shift();
                if (entry) {
                    this.writeLogEntry(entry);
                }
            }
        }
        finally {
            this.isProcessingQueue = false;
        }
    }
    /**
     * Flush the log queue synchronously
     */
    flushSync() {
        while (this.logQueue.length > 0) {
            const entry = this.logQueue.shift();
            if (entry) {
                this.writeLogEntry(entry);
            }
        }
        if (this.currentLogStream) {
            this.currentLogStream.end();
            this.currentLogStream = null;
        }
    }
    /**
     * Configure the logger
     */
    configure(config) {
        this.config = { ...this.config, ...config };
        // Re-initialize if needed
        if (config.logDir || config.maxFileSize || config.rotationInterval) {
            this.setupLogFile();
        }
        this.info('Logger configuration updated', LogCategory.SYSTEM, 'logger', {
            config,
        });
    }
    /**
     * Log at TRACE level
     */
    trace(message, category, module, context) {
        const entry = this.createLogEntry(LogLevel.TRACE, message, category, module, context);
        this.queueLogEntry(entry);
    }
    /**
     * Log at DEBUG level
     */
    debug(message, category, module, context) {
        const entry = this.createLogEntry(LogLevel.DEBUG, message, category, module, context);
        this.queueLogEntry(entry);
    }
    /**
     * Log at INFO level
     */
    info(message, category, module, context) {
        const entry = this.createLogEntry(LogLevel.INFO, message, category, module, context);
        this.queueLogEntry(entry);
    }
    /**
     * Log at WARN level
     */
    warn(message, category, module, context) {
        const entry = this.createLogEntry(LogLevel.WARN, message, category, module, context);
        this.queueLogEntry(entry);
    }
    /**
     * Log at ERROR level
     */
    error(message, category, module, context, error) {
        const entry = this.createLogEntry(LogLevel.ERROR, message, category, module, context, error);
        this.queueLogEntry(entry);
    }
    /**
     * Log at FATAL level
     */
    fatal(message, category, module, context, error) {
        const entry = this.createLogEntry(LogLevel.FATAL, message, category, module, context, error);
        this.queueLogEntry(entry);
    }
    /**
     * Start a timer for performance measurement
     */
    startTimer(id) {
        this.timers.set(id, performance.now());
    }
    /**
     * End a timer and log the duration
     */
    endTimer(id, message, category = LogCategory.PERFORMANCE, module) {
        const startTime = this.timers.get(id);
        if (startTime === undefined) {
            this.warn(`Timer "${id}" does not exist`, LogCategory.SYSTEM, 'logger');
            return undefined;
        }
        const duration = performance.now() - startTime;
        this.timers.delete(id);
        this.info(message, category, module, { duration, timerId: id });
        return duration;
    }
    /**
     * Log a request with timing
     */
    logRequest(method, url, statusCode, duration, userId, requestId, context) {
        const level = statusCode >= 500
            ? LogLevel.ERROR
            : statusCode >= 400
                ? LogLevel.WARN
                : LogLevel.INFO;
        const message = `${method} ${url} ${statusCode} ${duration.toFixed(2)}ms`;
        const entry = this.createLogEntry(level, message, LogCategory.NETWORK, 'http', { ...context, statusCode, duration, userId, requestId });
        this.queueLogEntry(entry);
    }
    /**
     * Get logs with filtering options
     */
    async getLogs(_options = {}) {
        // Implementation would depend on how logs are stored
        // This is a placeholder for the interface
        return [];
    }
    /**
     * Get current logger statistics
     */
    getStats() {
        return {
            queueLength: this.logQueue.length,
            currentLogFile: this.currentLogFile,
            currentLogSize: this.currentLogSize,
            activeTimers: this.timers.size,
            sessionId: this.sessionId,
            config: this.config,
        };
    }
}
// Create singleton instance
export const enhancedLogger = EnhancedLogger.getInstance();
// Export convenience methods
export const trace = (message, category, module, context) => {
    enhancedLogger.trace(message, category, module, context);
};
export const debug = (message, category, module, context) => {
    enhancedLogger.debug(message, category, module, context);
};
export const info = (message, category, module, context) => {
    enhancedLogger.info(message, category, module, context);
};
export const warn = (message, category, module, context) => {
    enhancedLogger.warn(message, category, module, context);
};
export const error = (message, category, module, context, error) => {
    enhancedLogger.error(message, category, module, context, error);
};
export const fatal = (message, category, module, context, error) => {
    enhancedLogger.fatal(message, category, module, context, error);
};
export const startTimer = (id) => {
    enhancedLogger.startTimer(id);
};
export const endTimer = (id, message, category, module) => {
    return enhancedLogger.endTimer(id, message, category, module);
};
// Performance measurement decorator
export function measure(category, module) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
            const timerId = `${target.constructor.name}.${propertyKey}`;
            enhancedLogger.startTimer(timerId);
            try {
                const result = originalMethod.apply(this, args);
                // Handle promises
                if (result instanceof Promise) {
                    return result.finally(() => {
                        enhancedLogger.endTimer(timerId, `Executed ${target.constructor.name}.${propertyKey}`, category || LogCategory.PERFORMANCE, module || target.constructor.name);
                    });
                }
                enhancedLogger.endTimer(timerId, `Executed ${target.constructor.name}.${propertyKey}`, category || LogCategory.PERFORMANCE, module || target.constructor.name);
                return result;
            }
            catch (error) {
                enhancedLogger.error(`Error in ${target.constructor.name}.${propertyKey}`, category || LogCategory.PERFORMANCE, module || target.constructor.name, { args }, error instanceof Error ? error : new Error(String(error)));
                throw error;
            }
        };
        return descriptor;
    };
}
