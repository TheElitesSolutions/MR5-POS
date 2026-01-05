import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { getCurrentLocalDateTime } from './dateTime';
class Logger {
    constructor() {
        this.logPath = "";
        this.isInitialized = false;
        this.pendingLogs = [];
        // Don't access app in constructor
    }
    /**
     * Initialize the logger after app is ready
     * This should be called once after app.whenReady()
     */
    initialize() {
        if (this.isInitialized)
            return;
        try {
            // Now safe to access app.getPath
            if (app && app.getPath) {
                const logsDir = path.join(app.getPath("userData"), "logs");
                if (!fs.existsSync(logsDir)) {
                    fs.mkdirSync(logsDir, { recursive: true });
                }
                this.logPath = path.join(logsDir, "main.log");
            }
            else {
                // Fallback to temp directory
                const tempDir = path.join(process.env.TEMP || '/tmp', 'mr5-pos', 'logs');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                this.logPath = path.join(tempDir, 'main.log');
            }
            this.isInitialized = true;
            // Flush any pending logs
            this.flushPendingLogs();
        }
        catch (error) {
            console.error('Failed to initialize logger:', error);
            // Use fallback path
            const tempDir = path.join(process.env.TEMP || '/tmp', 'mr5-pos', 'logs');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            this.logPath = path.join(tempDir, 'main.log');
            this.isInitialized = true;
        }
    }
    flushPendingLogs() {
        while (this.pendingLogs.length > 0) {
            const log = this.pendingLogs.shift();
            if (log) {
                this.writeLog(log.level, log.message, log.context);
            }
        }
    }
    writeLog(level, message, context) {
        const timestamp = getCurrentLocalDateTime();
        const contextStr = context ? ` [${context}]` : "";
        const logEntry = `${timestamp} [${level.toUpperCase()}]${contextStr}: ${message}\n`;
        // Always log to console
        console.log(logEntry.trim());
        if (!this.isInitialized) {
            // Queue for later if not initialized
            this.pendingLogs.push({ level, message, context });
            return;
        }
        // Write to file if initialized
        if (this.logPath) {
            try {
                fs.appendFileSync(this.logPath, logEntry);
            }
            catch (error) {
                console.error('Failed to write to log file:', error);
            }
        }
    }
    info(message, context) {
        const msg = message instanceof Error ? message.message : message;
        this.writeLog("info", msg, context);
    }
    error(message, context) {
        const msg = message instanceof Error ? message.message : message;
        this.writeLog("error", msg, context);
    }
    warn(message, context) {
        const msg = message instanceof Error ? message.message : message;
        this.writeLog("warn", msg, context);
    }
    debug(message, context) {
        const msg = message instanceof Error ? message.message : message;
        this.writeLog("debug", msg, context);
    }
}
// Singleton instance - lazy creation
let _loggerInstance = null;
/**
 * Get the logger instance (creates it if needed)
 */
export function getLogger() {
    if (!_loggerInstance) {
        _loggerInstance = new Logger();
    }
    return _loggerInstance;
}
/**
 * Initialize the logger after app is ready
 */
export function initializeLogger() {
    getLogger().initialize();
}
// Backward compatibility - export as proxy that creates instance on first use
export const logger = new Proxy({}, {
    get(target, prop) {
        const instance = getLogger();
        return instance[prop];
    }
});
