import { logger } from "./logger";
export class AdvancedLogger {
    static async logUserActivity(log) {
        try {
            const activityLog = {
                ...log,
                timestamp: new Date(),
            };
            this.logs.userActivities.push(activityLog);
            // Log to console
            logger.info(`User Activity: ${log.action}`, `userId: ${log.userId}`);
            // Keep only last 1000 entries to prevent memory issues
            if (this.logs.userActivities.length > 1000) {
                this.logs.userActivities = this.logs.userActivities.slice(-1000);
            }
        }
        catch (error) {
            logger.error("Failed to log user activity", String(error));
        }
    }
    static async logSystem(log) {
        try {
            const systemLog = {
                ...log,
                timestamp: new Date(),
            };
            this.logs.systemLogs.push(systemLog);
            // Also log to console based on level
            switch (log.level) {
                case "error":
                    logger.error(log.message, log.metadata ? JSON.stringify(log.metadata) : undefined);
                    break;
                case "warn":
                    logger.warn(log.message, log.metadata ? JSON.stringify(log.metadata) : undefined);
                    break;
                default:
                    logger.info(log.message, log.metadata ? JSON.stringify(log.metadata) : undefined);
            }
            // Keep only last 1000 entries
            if (this.logs.systemLogs.length > 1000) {
                this.logs.systemLogs = this.logs.systemLogs.slice(-1000);
            }
        }
        catch (error) {
            logger.error("Failed to log system event", String(error));
        }
    }
    static async logOrder(log) {
        try {
            const orderLog = {
                ...log,
                timestamp: new Date(),
            };
            this.logs.orderLogs.push(orderLog);
            // Log to console
            logger.info(`Order Activity: ${log.action}`, `orderId: ${log.orderId}, userId: ${log.userId}`);
            // Keep only last 1000 entries
            if (this.logs.orderLogs.length > 1000) {
                this.logs.orderLogs = this.logs.orderLogs.slice(-1000);
            }
        }
        catch (error) {
            logger.error("Failed to log order activity", String(error));
        }
    }
    static async logSecurity(log) {
        try {
            const securityLog = {
                ...log,
                timestamp: new Date(),
            };
            this.logs.securityLogs.push(securityLog);
            // Always log security events to console with appropriate level
            const severity = log.severity || "medium";
            switch (severity) {
                case "critical":
                case "high":
                    logger.error(`[SECURITY:${severity.toUpperCase()}] ${log.eventType}`, JSON.stringify(log.details));
                    break;
                case "medium":
                    logger.warn(`[SECURITY:${severity.toUpperCase()}] ${log.eventType}`, JSON.stringify(log.details));
                    break;
                default:
                    logger.info(`[SECURITY:${severity.toUpperCase()}] ${log.eventType}`, JSON.stringify(log.details));
            }
            // Alert for critical and high severity security events
            if (severity === "critical" || severity === "high") {
                this.triggerSecurityAlert(securityLog);
            }
            // Track authentication failures for brute force detection
            if (log.eventType === "authentication_failure" &&
                log.details?.ipAddress) {
                this.trackAuthFailure(log.details.ipAddress, log.details.username || "unknown");
            }
            // Keep only last 1000 entries
            if (this.logs.securityLogs.length > 1000) {
                this.logs.securityLogs = this.logs.securityLogs.slice(-1000);
            }
        }
        catch (error) {
            logger.error("Failed to log security event", String(error));
            // Fallback logging to console for critical security events
            logger.error(`[SECURITY] ${log.eventType}`, JSON.stringify(log.details));
        }
    }
    // Track authentication failures for brute force detection
    static trackAuthFailure(ipAddress, username) {
        try {
            const now = new Date();
            const key = `${ipAddress}:${username}`;
            const existing = this.authFailures.get(key);
            if (existing) {
                // Reset count if last attempt was more than 5 minutes ago
                const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
                if (existing.lastAttempt < fiveMinutesAgo) {
                    this.authFailures.set(key, { count: 1, lastAttempt: now });
                }
                else {
                    existing.count++;
                    existing.lastAttempt = now;
                }
            }
            else {
                this.authFailures.set(key, { count: 1, lastAttempt: now });
            }
            const current = this.authFailures.get(key);
            // Alert on potential brute force attempts (5+ failures in 5 minutes)
            if (current.count >= 5) {
                this.securityEvent("potential_brute_force", {
                    ipAddress,
                    username,
                    failureCount: current.count,
                    timeWindow: "5 minutes",
                }, "high");
            }
        }
        catch (error) {
            logger.error("Failed to track auth failure", String(error));
        }
    }
    static triggerSecurityAlert(log) {
        // In a real implementation, this could:
        // - Send notifications to administrators
        // - Trigger automated responses
        // - Send emails/SMS alerts
        // - Update security dashboards
        logger.error("SECURITY ALERT TRIGGERED", JSON.stringify({
            eventType: log.eventType,
            severity: log.severity,
            details: log.details,
            timestamp: log.timestamp,
        }));
        // For now, just ensure it's prominently logged
        console.error("🚨 SECURITY ALERT 🚨", {
            eventType: log.eventType,
            severity: log.severity,
            timestamp: log.timestamp,
        });
    }
    // Convenience methods for common logging patterns
    static info(message, metadata) {
        this.logSystem({ level: "info", message, metadata });
    }
    static warn(message, metadata) {
        this.logSystem({ level: "warn", message, metadata });
    }
    static error(message, metadata) {
        this.logSystem({ level: "error", message, metadata });
    }
    static userAction(userId, action, details, ipAddress, userAgent) {
        const logData = {
            userId,
            action,
            details,
        };
        if (ipAddress !== undefined) {
            logData.ipAddress = ipAddress;
        }
        if (userAgent !== undefined) {
            logData.userAgent = userAgent;
        }
        this.logUserActivity(logData);
    }
    static orderAction(orderId, action, changes, userId, previousState, newState) {
        this.logOrder({
            orderId,
            action,
            changes,
            userId,
            previousState,
            newState,
        });
    }
    static securityEvent(eventType, details, severity = "medium") {
        this.logSecurity({
            eventType,
            details,
            severity,
        });
    }
    static async logEvent(log) {
        try {
            const eventLog = {
                ...log,
                timestamp: new Date(),
            };
            this.logs.eventLogs.push(eventLog);
            logger.info(`Event: ${log.eventType}`, `source: ${log.source}`);
            // Keep only last 1000 entries
            if (this.logs.eventLogs.length > 1000) {
                this.logs.eventLogs = this.logs.eventLogs.slice(-1000);
            }
        }
        catch (error) {
            logger.error("Failed to log event", String(error));
        }
    }
    static async logError(log) {
        try {
            const errorLog = {
                ...log,
                timestamp: new Date(),
            };
            this.logs.errorLogs.push(errorLog);
            // Also log to console
            switch (log.level) {
                case "fatal":
                    logger.error(`[FATAL] ${log.message}`, log.stack || "");
                    break;
                case "error":
                    logger.error(log.message, log.stack || "");
                    break;
                case "warning":
                    logger.warn(log.message, log.stack || "");
                    break;
            }
            // Keep only last 1000 entries
            if (this.logs.errorLogs.length > 1000) {
                this.logs.errorLogs = this.logs.errorLogs.slice(-1000);
            }
        }
        catch (error) {
            logger.error("Failed to log error", String(error));
        }
    }
    // Convenience methods for events and errors
    static event(eventType, source, details, userId, metadata) {
        const logData = {
            eventType,
            source,
            details,
        };
        if (userId !== undefined) {
            logData.userId = userId;
        }
        if (metadata !== undefined) {
            logData.metadata = metadata;
        }
        this.logEvent(logData);
    }
    static errorEvent(message, source, level = "error", stack, userId, requestId, metadata) {
        const logData = {
            message,
            source,
            level,
        };
        if (stack !== undefined) {
            logData.stack = stack;
        }
        if (userId !== undefined) {
            logData.userId = userId;
        }
        if (requestId !== undefined) {
            logData.requestId = requestId;
        }
        if (metadata !== undefined) {
            logData.metadata = metadata;
        }
        this.logError(logData);
    }
    // Get logs for analysis/export
    static getLogs() {
        return {
            userActivities: [...this.logs.userActivities],
            systemLogs: [...this.logs.systemLogs],
            orderLogs: [...this.logs.orderLogs],
            securityLogs: [...this.logs.securityLogs],
            eventLogs: [...this.logs.eventLogs],
            errorLogs: [...this.logs.errorLogs],
        };
    }
    // Clear logs (for maintenance)
    static clearLogs() {
        this.logs = {
            userActivities: [],
            systemLogs: [],
            orderLogs: [],
            securityLogs: [],
            eventLogs: [],
            errorLogs: [],
        };
        this.authFailures.clear();
        logger.info("Advanced logs cleared");
    }
    // Get security statistics
    static getSecurityStats() {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const recentSecurityEvents = this.logs.securityLogs.filter((log) => log.timestamp > oneDayAgo);
        const authFailureCount = Array.from(this.authFailures.values()).reduce((total, failure) => total + failure.count, 0);
        return {
            totalSecurityEvents: this.logs.securityLogs.length,
            recentSecurityEvents: recentSecurityEvents.length,
            criticalEvents: recentSecurityEvents.filter((log) => log.severity === "critical").length,
            highSeverityEvents: recentSecurityEvents.filter((log) => log.severity === "high").length,
            authFailureCount,
            activeAuthFailureIPs: this.authFailures.size,
        };
    }
}
AdvancedLogger.logs = {
    userActivities: [],
    systemLogs: [],
    orderLogs: [],
    securityLogs: [],
    eventLogs: [],
    errorLogs: [],
};
// Auth failure tracking for brute force detection
AdvancedLogger.authFailures = new Map();
