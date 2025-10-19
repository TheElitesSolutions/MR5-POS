import { logger } from "./logger";

// Advanced logging types for POS system
export interface UserActivityLog {
  userId: string;
  action: string;
  details: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  sessionId?: string;
  module?: string;
}

export interface SystemLog {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  metadata?: any;
  timestamp: Date;
  source?: string;
  requestId?: string;
}

export interface OrderLog {
  orderId: string;
  action:
    | "created"
    | "updated"
    | "cancelled"
    | "completed"
    | "paid"
    | "refunded";
  changes: any;
  userId: string;
  timestamp: Date;
  previousState?: any;
  newState?: any;
}

export interface SecurityLog {
  eventType: string;
  details: any;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: Date;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface EventLog {
  eventType: string;
  source: string;
  details: any;
  userId?: string;
  timestamp: Date;
  metadata?: any;
}

export interface ErrorLog {
  message: string;
  source: string;
  level: "error" | "fatal" | "warning";
  stack?: string;
  userId?: string;
  timestamp: Date;
  requestId?: string;
  metadata?: any;
}

export class AdvancedLogger {
  private static logs: {
    userActivities: UserActivityLog[];
    systemLogs: SystemLog[];
    orderLogs: OrderLog[];
    securityLogs: SecurityLog[];
    eventLogs: EventLog[];
    errorLogs: ErrorLog[];
  } = {
    userActivities: [],
    systemLogs: [],
    orderLogs: [],
    securityLogs: [],
    eventLogs: [],
    errorLogs: [],
  };

  // Auth failure tracking for brute force detection
  private static authFailures: Map<
    string,
    { count: number; lastAttempt: Date }
  > = new Map();

  static async logUserActivity(
    log: Omit<UserActivityLog, "timestamp">
  ): Promise<void> {
    try {
      const activityLog: UserActivityLog = {
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
    } catch (error) {
      logger.error("Failed to log user activity", String(error));
    }
  }

  static async logSystem(log: Omit<SystemLog, "timestamp">): Promise<void> {
    try {
      const systemLog: SystemLog = {
        ...log,
        timestamp: new Date(),
      };

      this.logs.systemLogs.push(systemLog);

      // Also log to console based on level
      switch (log.level) {
        case "error":
          logger.error(
            log.message,
            log.metadata ? JSON.stringify(log.metadata) : undefined
          );
          break;
        case "warn":
          logger.warn(
            log.message,
            log.metadata ? JSON.stringify(log.metadata) : undefined
          );
          break;
        default:
          logger.info(
            log.message,
            log.metadata ? JSON.stringify(log.metadata) : undefined
          );
      }

      // Keep only last 1000 entries
      if (this.logs.systemLogs.length > 1000) {
        this.logs.systemLogs = this.logs.systemLogs.slice(-1000);
      }
    } catch (error) {
      logger.error("Failed to log system event", String(error));
    }
  }

  static async logOrder(log: Omit<OrderLog, "timestamp">): Promise<void> {
    try {
      const orderLog: OrderLog = {
        ...log,
        timestamp: new Date(),
      };

      this.logs.orderLogs.push(orderLog);

      // Log to console
      logger.info(
        `Order Activity: ${log.action}`,
        `orderId: ${log.orderId}, userId: ${log.userId}`
      );

      // Keep only last 1000 entries
      if (this.logs.orderLogs.length > 1000) {
        this.logs.orderLogs = this.logs.orderLogs.slice(-1000);
      }
    } catch (error) {
      logger.error("Failed to log order activity", String(error));
    }
  }

  static async logSecurity(log: Omit<SecurityLog, "timestamp">): Promise<void> {
    try {
      const securityLog: SecurityLog = {
        ...log,
        timestamp: new Date(),
      };

      this.logs.securityLogs.push(securityLog);

      // Always log security events to console with appropriate level
      const severity = log.severity || "medium";
      switch (severity) {
        case "critical":
        case "high":
          logger.error(
            `[SECURITY:${severity.toUpperCase()}] ${log.eventType}`,
            JSON.stringify(log.details)
          );
          break;
        case "medium":
          logger.warn(
            `[SECURITY:${severity.toUpperCase()}] ${log.eventType}`,
            JSON.stringify(log.details)
          );
          break;
        default:
          logger.info(
            `[SECURITY:${severity.toUpperCase()}] ${log.eventType}`,
            JSON.stringify(log.details)
          );
      }

      // Alert for critical and high severity security events
      if (severity === "critical" || severity === "high") {
        this.triggerSecurityAlert(securityLog);
      }

      // Track authentication failures for brute force detection
      if (
        log.eventType === "authentication_failure" &&
        log.details?.ipAddress
      ) {
        this.trackAuthFailure(
          log.details.ipAddress,
          log.details.username || "unknown"
        );
      }

      // Keep only last 1000 entries
      if (this.logs.securityLogs.length > 1000) {
        this.logs.securityLogs = this.logs.securityLogs.slice(-1000);
      }
    } catch (error) {
      logger.error("Failed to log security event", String(error));
      // Fallback logging to console for critical security events
      logger.error(`[SECURITY] ${log.eventType}`, JSON.stringify(log.details));
    }
  }

  // Track authentication failures for brute force detection
  private static trackAuthFailure(ipAddress: string, username: string): void {
    try {
      const now = new Date();
      const key = `${ipAddress}:${username}`;

      const existing = this.authFailures.get(key);
      if (existing) {
        // Reset count if last attempt was more than 5 minutes ago
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        if (existing.lastAttempt < fiveMinutesAgo) {
          this.authFailures.set(key, { count: 1, lastAttempt: now });
        } else {
          existing.count++;
          existing.lastAttempt = now;
        }
      } else {
        this.authFailures.set(key, { count: 1, lastAttempt: now });
      }

      const current = this.authFailures.get(key)!;

      // Alert on potential brute force attempts (5+ failures in 5 minutes)
      if (current.count >= 5) {
        this.securityEvent(
          "potential_brute_force",
          {
            ipAddress,
            username,
            failureCount: current.count,
            timeWindow: "5 minutes",
          },
          "high"
        );
      }
    } catch (error) {
      logger.error("Failed to track auth failure", String(error));
    }
  }

  private static triggerSecurityAlert(log: SecurityLog): void {
    // In a real implementation, this could:
    // - Send notifications to administrators
    // - Trigger automated responses
    // - Send emails/SMS alerts
    // - Update security dashboards

    logger.error(
      "SECURITY ALERT TRIGGERED",
      JSON.stringify({
        eventType: log.eventType,
        severity: log.severity,
        details: log.details,
        timestamp: log.timestamp,
      })
    );

    // For now, just ensure it's prominently logged
    console.error("🚨 SECURITY ALERT 🚨", {
      eventType: log.eventType,
      severity: log.severity,
      timestamp: log.timestamp,
    });
  }

  // Convenience methods for common logging patterns
  static info(message: string, metadata?: any): void {
    this.logSystem({ level: "info", message, metadata });
  }

  static warn(message: string, metadata?: any): void {
    this.logSystem({ level: "warn", message, metadata });
  }

  static error(message: string, metadata?: any): void {
    this.logSystem({ level: "error", message, metadata });
  }

  static userAction(
    userId: string,
    action: string,
    details: any,
    ipAddress?: string,
    userAgent?: string
  ): void {
    const logData: Omit<UserActivityLog, "timestamp"> = {
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

  static orderAction(
    orderId: string,
    action: OrderLog["action"],
    changes: any,
    userId: string,
    previousState?: any,
    newState?: any
  ): void {
    this.logOrder({
      orderId,
      action,
      changes,
      userId,
      previousState,
      newState,
    });
  }

  static securityEvent(
    eventType: string,
    details: any,
    severity: "low" | "medium" | "high" | "critical" = "medium"
  ): void {
    this.logSecurity({
      eventType,
      details,
      severity,
    });
  }

  static async logEvent(log: Omit<EventLog, "timestamp">): Promise<void> {
    try {
      const eventLog: EventLog = {
        ...log,
        timestamp: new Date(),
      };

      this.logs.eventLogs.push(eventLog);

      logger.info(`Event: ${log.eventType}`, `source: ${log.source}`);

      // Keep only last 1000 entries
      if (this.logs.eventLogs.length > 1000) {
        this.logs.eventLogs = this.logs.eventLogs.slice(-1000);
      }
    } catch (error) {
      logger.error("Failed to log event", String(error));
    }
  }

  static async logError(log: Omit<ErrorLog, "timestamp">): Promise<void> {
    try {
      const errorLog: ErrorLog = {
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
    } catch (error) {
      logger.error("Failed to log error", String(error));
    }
  }

  // Convenience methods for events and errors
  static event(
    eventType: string,
    source: string,
    details: any,
    userId?: string,
    metadata?: any
  ): void {
    const logData: Omit<EventLog, "timestamp"> = {
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

  static errorEvent(
    message: string,
    source: string,
    level: "error" | "fatal" | "warning" = "error",
    stack?: string,
    userId?: string,
    requestId?: string,
    metadata?: any
  ): void {
    const logData: Omit<ErrorLog, "timestamp"> = {
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
  static clearLogs(): void {
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

    const recentSecurityEvents = this.logs.securityLogs.filter(
      (log) => log.timestamp > oneDayAgo
    );

    const authFailureCount = Array.from(this.authFailures.values()).reduce(
      (total, failure) => total + failure.count,
      0
    );

    return {
      totalSecurityEvents: this.logs.securityLogs.length,
      recentSecurityEvents: recentSecurityEvents.length,
      criticalEvents: recentSecurityEvents.filter(
        (log) => log.severity === "critical"
      ).length,
      highSeverityEvents: recentSecurityEvents.filter(
        (log) => log.severity === "high"
      ).length,
      authFailureCount,
      activeAuthFailureIPs: this.authFailures.size,
    };
  }
}
