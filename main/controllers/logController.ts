/**
 * LogController for mr5-POS
 *
 * Provides IPC handlers for accessing and filtering logs from the renderer process
 */

import { app, ipcMain, IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as zlib from 'zlib';
import { LOGGING_CHANNELS } from '../../shared/ipc-channels';
import { IPCResponse } from '../types';
import {
  enhancedLogger,
  LogCategory,
  LogLevel,
} from '../utils/enhanced-logger';
import { BaseController } from './baseController';

interface LogFile {
  name: string;
  path: string;
  size: number;
  created: Date;
  isCompressed: boolean;
}

interface LogSearchOptions {
  level?: LogLevel;
  category?: LogCategory;
  module?: string;
  startTime?: string;
  endTime?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface LogStats {
  totalLogs: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  recentErrors: number;
  diskUsage: number;
}

export class LogController extends BaseController {
  private logDir: string;

  constructor() {
    super();
    this.logDir = path.join(app.getPath('userData'), 'logs');
    // this.initialize(); // Removed: StartupManager calls initialize() explicitly
    enhancedLogger.info(
      'LogController initialized',
      LogCategory.SYSTEM,
      'LogController'
    );
  }

  protected override registerHandlers(): void {
    this.registerHandler(
      LOGGING_CHANNELS.GET_FILES,
      this.getLogFiles.bind(this)
    );
    this.registerHandler(
      LOGGING_CHANNELS.GET_CONTENT,
      this.getLogContent.bind(this)
    );
    this.registerHandler(LOGGING_CHANNELS.SEARCH, this.searchLogs.bind(this));
    this.registerHandler(
      LOGGING_CHANNELS.GET_STATS,
      this.getLogStats.bind(this)
    );
    this.registerHandler(LOGGING_CHANNELS.CLEAR, this.clearLogs.bind(this));
    this.registerHandler(LOGGING_CHANNELS.EXPORT, this.exportLogs.bind(this));
    this.registerHandler(
      LOGGING_CHANNELS.WRITE_LOG,
      this.writeLog.bind(this)
    );
  }

  public override unregisterHandlers(): void {
    Object.values(LOGGING_CHANNELS).forEach(channel => {
      ipcMain.removeHandler(channel);
    });
  }

  /**
   * Get list of available log files
   */
  private async getLogFiles(
    _event: IpcMainInvokeEvent
  ): Promise<IPCResponse<LogFile[]>> {
    try {
      enhancedLogger.startTimer('getLogFiles');

      // Ensure log directory exists
      await fs.ensureDir(this.logDir);

      // Get all files in the log directory
      const files = await fs.readdir(this.logDir);

      // Filter and map log files
      const logFiles: LogFile[] = [];

      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);

        if (
          stats.isFile() &&
          (file.endsWith('.log') || file.endsWith('.log.gz'))
        ) {
          logFiles.push({
            name: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            isCompressed: file.endsWith('.gz'),
          });
        }
      }

      // Sort by creation date, newest first
      logFiles.sort((a, b) => b.created.getTime() - a.created.getTime());

      /* const _duration = */ enhancedLogger.endTimer(
        'getLogFiles',
        'Retrieved log files list',
        LogCategory.FILESYSTEM,
        'LogController'
      );

      return {
        success: true,
        data: logFiles,
        message: `Found ${logFiles.length} log files`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      enhancedLogger.error(
        'Failed to get log files',
        LogCategory.FILESYSTEM,
        'LogController',
        { error: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : undefined
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get content of a specific log file
   */
  private async getLogContent(
    _event: IpcMainInvokeEvent,
    params: { filePath: string; limit?: number; offset?: number }
  ): Promise<IPCResponse<string[]>> {
    try {
      enhancedLogger.startTimer('getLogContent');
      const { filePath, limit = 1000, offset = 0 } = params;

      // Security check - ensure the file is within the logs directory
      const normalizedPath = path.normalize(filePath);
      if (!normalizedPath.startsWith(this.logDir)) {
        throw new Error('Access denied: File is outside the logs directory');
      }

      // Check if file exists
      if (!(await fs.pathExists(normalizedPath))) {
        throw new Error(`Log file not found: ${path.basename(normalizedPath)}`);
      }

      // Read file content
      let content: string;

      if (normalizedPath.endsWith('.gz')) {
        // Decompress gzipped file
        const compressed = await fs.readFile(normalizedPath);
        content = zlib.gunzipSync(compressed).toString('utf8');
      } else {
        // Read normal log file
        content = await fs.readFile(normalizedPath, 'utf8');
      }

      // Split into lines and apply limit/offset
      const lines = content
        .split('\n')
        .filter(line => line.trim().length > 0)
        .slice(offset, offset + limit);

      /* const _duration = */ enhancedLogger.endTimer(
        'getLogContent',
        'Retrieved log file content',
        LogCategory.FILESYSTEM,
        'LogController'
      );

      return {
        success: true,
        data: lines,
        message: `Retrieved ${lines.length} log entries`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      enhancedLogger.error(
        'Failed to get log content',
        LogCategory.FILESYSTEM,
        'LogController',
        { filePath: params.filePath },
        error instanceof Error ? error : undefined
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Search logs with filtering options
   */
  private async searchLogs(
    event: IpcMainInvokeEvent,
    options: LogSearchOptions
  ): Promise<IPCResponse<any[]>> {
    try {
      enhancedLogger.startTimer('searchLogs');
      const {
        level,
        category,
        module,
        startTime,
        endTime,
        search,
        limit = 100,
        offset = 0,
      } = options;

      // Get all log files
      const logFilesResponse = await this.getLogFiles(event);
      if (!logFilesResponse.success || !logFilesResponse.data) {
        throw new Error('Failed to get log files');
      }

      const logFiles = logFilesResponse.data;
      const results: any[] = [];

      // Process each log file
      for (const logFile of logFiles) {
        // Skip processing more files if we have enough results
        if (results.length >= limit + offset) {
          break;
        }

        // Get file content
        let lines: string[];

        try {
          const contentResponse = await this.getLogContent(event, {
            filePath: logFile.path,
          });
          if (!contentResponse.success || !contentResponse.data) {
            continue;
          }
          lines = contentResponse.data;
        } catch (error) {
          enhancedLogger.warn(
            `Skipping log file ${logFile.name} due to error`,
            LogCategory.FILESYSTEM,
            'LogController',
            { error: error instanceof Error ? error.message : String(error) }
          );
          continue;
        }

        // Parse and filter log entries
        for (const line of lines) {
          try {
            // Skip empty lines
            if (!line.trim()) continue;

            // Parse JSON log entry
            const entry = JSON.parse(line);

            // Apply filters
            if (level !== undefined && entry.levelCode < level) continue;
            if (category && entry.category !== category) continue;
            if (module && entry.module !== module) continue;

            // Time range filtering
            if (startTime) {
              const startDate = new Date(startTime);
              const entryDate = new Date(entry.timestamp);
              if (entryDate < startDate) continue;
            }

            if (endTime) {
              const endDate = new Date(endTime);
              const entryDate = new Date(entry.timestamp);
              if (entryDate > endDate) continue;
            }

            // Text search
            if (search && !this.matchesSearch(entry, search)) continue;

            // Add to results
            results.push(entry);
          } catch (error) {
            // Skip invalid JSON entries
            continue;
          }
        }
      }

      // Apply limit and offset
      const paginatedResults = results
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(offset, offset + limit);

      /* const _duration = */ enhancedLogger.endTimer(
        'searchLogs',
        'Searched logs',
        LogCategory.FILESYSTEM,
        'LogController'
      );

      return {
        success: true,
        data: paginatedResults,
        message: `Found ${paginatedResults.length} matching log entries`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      enhancedLogger.error(
        'Failed to search logs',
        LogCategory.FILESYSTEM,
        'LogController',
        { options },
        error instanceof Error ? error : undefined
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if a log entry matches a search term
   */
  private matchesSearch(entry: any, search: string): boolean {
    const searchLower = search.toLowerCase();

    // Check message
    if (entry.message && entry.message.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Check module
    if (entry.module && entry.module.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Check category
    if (entry.category && entry.category.toLowerCase().includes(searchLower)) {
      return true;
    }

    // Check error message
    if (
      entry.error &&
      typeof entry.error === 'object' &&
      entry.error.message &&
      typeof entry.error.message === 'string' &&
      entry.error.message.toLowerCase().includes(searchLower)
    ) {
      return true;
    }

    // Check context (stringify and search)
    if (entry.context) {
      const contextStr = JSON.stringify(entry.context).toLowerCase();
      if (contextStr.includes(searchLower)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get log statistics
   */
  private async getLogStats(
    event: IpcMainInvokeEvent
  ): Promise<IPCResponse<LogStats>> {
    try {
      enhancedLogger.startTimer('getLogStats');

      // Get all log files
      const logFilesResponse = await this.getLogFiles(event);
      if (!logFilesResponse.success || !logFilesResponse.data) {
        throw new Error('Failed to get log files');
      }

      const logFiles = logFilesResponse.data;

      // Calculate disk usage
      const diskUsage = logFiles.reduce((total, file) => total + file.size, 0);

      // Get sample of recent logs for statistics
      const recentLogs: any[] = [];
      let recentErrors = 0;

      // Process most recent log file
      if (logFiles.length > 0) {
        try {
          const contentResponse = await this.getLogContent(event, {
            filePath: logFiles[0]?.path || '',
            limit: 1000,
          });

          if (contentResponse.success && contentResponse.data) {
            for (const line of contentResponse.data) {
              try {
                if (!line.trim()) continue;
                const entry = JSON.parse(line);
                recentLogs.push(entry);

                // Count recent errors
                if (entry.levelCode >= LogLevel.ERROR) {
                  recentErrors++;
                }
              } catch (error) {
                // Skip invalid JSON entries
                continue;
              }
            }
          }
        } catch (error) {
          enhancedLogger.warn(
            `Error processing recent log file: ${error}`,
            LogCategory.FILESYSTEM,
            'LogController'
          );
        }
      }

      // Count by level and category
      const byLevel: Record<string, number> = {};
      const byCategory: Record<string, number> = {};

      for (const entry of recentLogs) {
        // Count by level
        const level = entry.level || 'unknown';
        byLevel[level] = (byLevel[level] || 0) + 1;

        // Count by category
        const category = entry.category || 'unknown';
        byCategory[category] = (byCategory[category] || 0) + 1;
      }

      const stats: LogStats = {
        totalLogs: recentLogs.length,
        byLevel,
        byCategory,
        recentErrors,
        diskUsage,
      };

      /* const _duration = */ enhancedLogger.endTimer(
        'getLogStats',
        'Generated log statistics',
        LogCategory.SYSTEM,
        'LogController'
      );

      return {
        success: true,
        data: stats,
        message: 'Log statistics generated',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      enhancedLogger.error(
        'Failed to get log statistics',
        LogCategory.SYSTEM,
        'LogController',
        {},
        error instanceof Error ? error : undefined
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Clear old logs
   */
  private async clearLogs(
    event: IpcMainInvokeEvent,
    params: { keepLatest?: number }
  ): Promise<IPCResponse<{ deletedCount: number }>> {
    try {
      enhancedLogger.startTimer('clearLogs');
      const { keepLatest = 2 } = params;

      // Get all log files
      const logFilesResponse = await this.getLogFiles(event);
      if (!logFilesResponse.success || !logFilesResponse.data) {
        throw new Error('Failed to get log files');
      }

      const logFiles = logFilesResponse.data;

      // Keep the latest N files, delete the rest
      const filesToDelete = logFiles.slice(keepLatest);
      let deletedCount = 0;

      for (const file of filesToDelete) {
        try {
          await fs.unlink(file.path);
          deletedCount++;
        } catch (error) {
          enhancedLogger.warn(
            `Failed to delete log file: ${file.name}`,
            LogCategory.FILESYSTEM,
            'LogController',
            { error: error instanceof Error ? error.message : String(error) }
          );
        }
      }

      /* const _duration = */ enhancedLogger.endTimer(
        'clearLogs',
        'Cleared old logs',
        LogCategory.FILESYSTEM,
        'LogController'
      );

      return {
        success: true,
        data: { deletedCount },
        message: `Deleted ${deletedCount} log files`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      enhancedLogger.error(
        'Failed to clear logs',
        LogCategory.FILESYSTEM,
        'LogController',
        {},
        error instanceof Error ? error : undefined
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Export logs to a file
   */
  private async exportLogs(
    event: IpcMainInvokeEvent,
    params: {
      outputPath: string;
      options?: LogSearchOptions;
    }
  ): Promise<IPCResponse<{ filePath: string }>> {
    try {
      enhancedLogger.startTimer('exportLogs');
      const { outputPath, options = {} } = params;

      // Security check - ensure the output path is valid
      const normalizedPath = path.normalize(outputPath);
      const outputDir = path.dirname(normalizedPath);

      // Ensure output directory exists
      await fs.ensureDir(outputDir);

      // Get filtered logs
      const searchResponse = await this.searchLogs(event, {
        ...options,
        limit: 10000, // Allow exporting more logs
        offset: 0,
      });

      if (!searchResponse.success || !searchResponse.data) {
        throw new Error('Failed to search logs for export');
      }

      const logs = searchResponse.data;

      // Write logs to file
      await fs.writeFile(
        normalizedPath,
        logs.map(log => JSON.stringify(log)).join('\n'),
        'utf8'
      );

      /* const _duration = */ enhancedLogger.endTimer(
        'exportLogs',
        'Exported logs to file',
        LogCategory.FILESYSTEM,
        'LogController'
      );

      return {
        success: true,
        data: { filePath: normalizedPath },
        message: `Exported ${logs.length} logs to ${path.basename(normalizedPath)}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      enhancedLogger.error(
        'Failed to export logs',
        LogCategory.FILESYSTEM,
        'LogController',
        { outputPath: params.outputPath },
        error instanceof Error ? error : undefined
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Write a log entry from renderer process to file
   */
  private async writeLog(
    _event: IpcMainInvokeEvent,
    params: {
      level: string;
      message: string;
      category?: string;
      module?: string;
      context?: any;
    }
  ): Promise<IPCResponse<boolean>> {
    try {
      const { level, message, category, module, context } = params;

      // Map log level string to LogLevel enum
      let logLevel: LogLevel;
      switch (level.toUpperCase()) {
        case 'DEBUG':
          logLevel = LogLevel.DEBUG;
          break;
        case 'INFO':
          logLevel = LogLevel.INFO;
          break;
        case 'WARN':
          logLevel = LogLevel.WARN;
          break;
        case 'ERROR':
          logLevel = LogLevel.ERROR;
          break;
        default:
          logLevel = LogLevel.INFO;
      }

      // Write log using EnhancedLogger
      if (logLevel === LogLevel.ERROR) {
        enhancedLogger.error(
          message,
          (category as LogCategory) || LogCategory.UI,
          module || 'Renderer',
          context
        );
      } else if (logLevel === LogLevel.WARN) {
        enhancedLogger.warn(
          message,
          (category as LogCategory) || LogCategory.UI,
          module || 'Renderer',
          context
        );
      } else if (logLevel === LogLevel.DEBUG) {
        enhancedLogger.debug(
          message,
          (category as LogCategory) || LogCategory.UI,
          module || 'Renderer',
          context
        );
      } else {
        enhancedLogger.info(
          message,
          (category as LogCategory) || LogCategory.UI,
          module || 'Renderer',
          context
        );
      }

      return {
        success: true,
        data: true,
        message: 'Log written successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Fallback error logging if something goes wrong
      enhancedLogger.error(
        'Failed to write renderer log',
        LogCategory.SYSTEM,
        'LogController',
        { params },
        error instanceof Error ? error : undefined
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }
}
