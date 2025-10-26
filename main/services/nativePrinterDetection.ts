/**
 * Native Printer Detection Service
 * Phase 2 optimization for fast printer detection using native Win32 API
 *
 * Performance Target: Reduce detection from 5-8s to 50-200ms (10-40x improvement)
 * Compatibility: PowerShell fallback maintained for maximum reliability
 */

import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { enhancedLogger, LogCategory } from '../utils/enhanced-logger';
import { getCurrentLocalDateTime } from '../utils/dateTime';

const execAsync = promisify(exec);

// Import native printer library
let electronPrinter: any;
try {
  electronPrinter = require('@thesusheer/electron-printer');
} catch (error) {
  enhancedLogger.warn(
    '⚠️ Native printer library not available - will use PowerShell only',
    LogCategory.SYSTEM,
    'NativePrinterDetection',
    { error }
  );
}

/**
 * Printer information interface (matches existing PrinterInfo)
 */
export interface PrinterInfo {
  name: string;
  driverName: string;
  portName: string;
  status: number;
  isShared: boolean;
  location?: string;
  comment?: string;
}

/**
 * Detection method enum for telemetry
 */
export enum DetectionMethod {
  NATIVE = 'native',
  POWERSHELL = 'powershell',
  CACHED = 'cached'
}

/**
 * Detection result with metadata
 */
export interface DetectionResult {
  printers: PrinterInfo[];
  method: DetectionMethod;
  duration: number;
  cached: boolean;
}

/**
 * Native Printer Detection Service
 * Singleton service for fast Win32 API-based printer detection
 */
export class NativePrinterDetection {
  private static instance: NativePrinterDetection;

  // Feature flag for native detection (can be disabled via env var)
  private readonly USE_NATIVE_DETECTION: boolean;

  // Cache settings (aligned with Phase 1 optimizations)
  private printerCache: { data: PrinterInfo[]; timestamp: number; method: DetectionMethod } | null = null;
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // Performance tracking
  private detectionStats = {
    nativeAttempts: 0,
    nativeSuccesses: 0,
    nativeFallbacks: 0,
    avgNativeDuration: 0,
    avgPowerShellDuration: 0,
  };

  public static getInstance(): NativePrinterDetection {
    if (!NativePrinterDetection.instance) {
      NativePrinterDetection.instance = new NativePrinterDetection();
    }
    return NativePrinterDetection.instance;
  }

  private constructor() {
    // Check feature flag
    this.USE_NATIVE_DETECTION = process.env.USE_NATIVE_PRINTER_DETECTION !== 'false';

    const nativeAvailable = !!electronPrinter;

    enhancedLogger.info(
      `🔧 NativePrinterDetection initialized`,
      LogCategory.SYSTEM,
      'NativePrinterDetection',
      {
        nativeEnabled: this.USE_NATIVE_DETECTION && nativeAvailable,
        nativeAvailable,
        fallbackAvailable: true,
      }
    );
  }

  /**
   * Detect printers using best available method (native → PowerShell)
   * @param forceRefresh Bypass cache and force fresh detection
   * @returns Detection result with metadata
   */
  async detectPrinters(forceRefresh: boolean = false): Promise<DetectionResult> {
    const startTime = Date.now();

    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh && this.printerCache && this.isCacheValid()) {
        const duration = Date.now() - startTime;
        enhancedLogger.info(
          `📦 Returning cached printer list (${this.printerCache.data.length} printers)`,
          LogCategory.SYSTEM,
          'NativePrinterDetection',
          { cacheAge: Date.now() - this.printerCache.timestamp, method: this.printerCache.method }
        );

        return {
          printers: this.printerCache.data,
          method: DetectionMethod.CACHED,
          duration,
          cached: true,
        };
      }

      // Try native detection first (if enabled and available)
      if (this.USE_NATIVE_DETECTION && electronPrinter) {
        try {
          this.detectionStats.nativeAttempts++;

          enhancedLogger.info(
            '🚀 Attempting native Win32 API printer detection',
            LogCategory.SYSTEM,
            'NativePrinterDetection'
          );

          const printers = await this.getNativePrinters();
          const duration = Date.now() - startTime;

          this.detectionStats.nativeSuccesses++;
          this.updateAverageDuration('native', duration);

          // Update cache
          this.printerCache = {
            data: printers,
            timestamp: Date.now(),
            method: DetectionMethod.NATIVE,
          };

          enhancedLogger.info(
            `✅ Native detection successful: ${printers.length} printer(s) in ${duration}ms`,
            LogCategory.SYSTEM,
            'NativePrinterDetection',
            { stats: this.getStats() }
          );

          return {
            printers,
            method: DetectionMethod.NATIVE,
            duration,
            cached: false,
          };
        } catch (nativeError) {
          this.detectionStats.nativeFallbacks++;

          enhancedLogger.warn(
            '⚠️ Native detection failed, falling back to PowerShell',
            LogCategory.SYSTEM,
            'NativePrinterDetection',
            { error: nativeError }
          );

          // Fall through to PowerShell fallback
        }
      }

      // PowerShell fallback (always available)
      enhancedLogger.info(
        '🔄 Using PowerShell printer detection',
        LogCategory.SYSTEM,
        'NativePrinterDetection'
      );

      const printers = await this.getPowerShellPrinters();
      const duration = Date.now() - startTime;

      this.updateAverageDuration('powershell', duration);

      // Update cache
      this.printerCache = {
        data: printers,
        timestamp: Date.now(),
        method: DetectionMethod.POWERSHELL,
      };

      enhancedLogger.info(
        `✅ PowerShell detection successful: ${printers.length} printer(s) in ${duration}ms`,
        LogCategory.SYSTEM,
        'NativePrinterDetection'
      );

      return {
        printers,
        method: DetectionMethod.POWERSHELL,
        duration,
        cached: false,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      enhancedLogger.error(
        '❌ Printer detection failed',
        LogCategory.SYSTEM,
        'NativePrinterDetection',
        { error, duration },
        error as Error
      );

      // Return empty array rather than throwing
      return {
        printers: [],
        method: DetectionMethod.POWERSHELL,
        duration,
        cached: false,
      };
    }
  }

  /**
   * Get printers using native Win32 API (fast)
   * Expected performance: 50-200ms
   */
  private async getNativePrinters(): Promise<PrinterInfo[]> {
    try {
      // Call native addon for Win32 EnumPrinters
      const nativePrinters = await electronPrinter.getPrinters();

      // Transform native format to our PrinterInfo interface
      const printers: PrinterInfo[] = nativePrinters
        .filter((printer: any) => {
          // Filter out virtual/fax printers
          const name = printer.name || '';
          return !name.match(/Fax|OneNote|XPS|Send To|Microsoft Print to PDF/i);
        })
        .map((printer: any) => ({
          name: printer.name || 'Unknown Printer',
          driverName: printer.driverName || printer.driver || 'Unknown Driver',
          portName: printer.portName || printer.port || 'Unknown Port',
          status: this.mapNativeStatus(printer.status),
          isShared: printer.isShared || false,
          location: printer.location || '',
          comment: printer.comment || '',
        }));

      enhancedLogger.info(
        `🔍 Native detection found ${printers.length} printer(s)`,
        LogCategory.SYSTEM,
        'NativePrinterDetection'
      );

      return printers;
    } catch (error) {
      enhancedLogger.error(
        '❌ Native printer detection error',
        LogCategory.SYSTEM,
        'NativePrinterDetection',
        { error },
        error as Error
      );
      throw error;
    }
  }

  /**
   * Get printers using PowerShell (slower but reliable)
   * Expected performance: 5-8s on old hardware
   */
  private async getPowerShellPrinters(): Promise<PrinterInfo[]> {
    try {
      // Create temporary PowerShell script
      const scriptContent = `
        try {
          Get-Printer | Where-Object {
            $_.PrinterStatus -ne 7 -and
            $_.Name -notmatch 'Fax|OneNote|XPS|Send To' -and
            $_.Type -ne 'Connection'
          } | Select-Object @{
            Name='name'; Expression={$_.Name}
          }, @{
            Name='driverName'; Expression={$_.DriverName}
          }, @{
            Name='portName'; Expression={$_.PortName}
          }, @{
            Name='status'; Expression={[int]$_.PrinterStatus}
          }, @{
            Name='isShared'; Expression={$_.Shared}
          }, @{
            Name='location'; Expression={$_.Location}
          }, @{
            Name='comment'; Expression={$_.Comment}
          } | ConvertTo-Json -Depth 2 -Compress
        } catch {
          Write-Error "PowerShell Error: $($_.Exception.Message)"
          exit 1
        }
      `;

      const tempScriptPath = path.join(
        os.tmpdir(),
        `printer-detect-native-${Date.now()}.ps1`
      );

      // Write script to temporary file
      fs.writeFileSync(tempScriptPath, scriptContent, 'utf8');

      try {
        const { stdout, stderr } = await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"`,
          {
            timeout: 15000, // 15 second timeout
            maxBuffer: 2 * 1024 * 1024, // 2MB buffer
            encoding: 'utf8',
            windowsHide: true,
          }
        );

        // Handle warnings
        if (stderr && stderr.trim()) {
          enhancedLogger.warn(
            `PowerShell warnings: ${stderr.trim()}`,
            LogCategory.SYSTEM,
            'NativePrinterDetection'
          );
        }

        // Validate output
        if (!stdout || stdout.trim() === '' || stdout.trim() === 'null') {
          enhancedLogger.warn(
            'No printer data returned from PowerShell',
            LogCategory.SYSTEM,
            'NativePrinterDetection'
          );
          return [];
        }

        // Parse JSON output
        let printers: any[];
        try {
          const trimmedOutput = stdout.trim();
          const parsed = JSON.parse(trimmedOutput);
          printers = Array.isArray(parsed) ? parsed : [parsed];
        } catch (parseError) {
          enhancedLogger.error(
            'Failed to parse PowerShell JSON output',
            LogCategory.SYSTEM,
            'NativePrinterDetection',
            { error: parseError, rawOutput: stdout.substring(0, 200) }
          );
          throw new Error('Failed to parse printer data from PowerShell');
        }

        // Map to PrinterInfo interface
        const validPrinters: PrinterInfo[] = printers
          .filter(printer => printer && typeof printer.name === 'string' && printer.name.trim())
          .map(printer => ({
            name: printer.name.trim(),
            driverName: printer.driverName || 'Unknown Driver',
            portName: printer.portName || 'Unknown Port',
            status: printer.status || 0,
            isShared: printer.isShared || false,
            location: printer.location || '',
            comment: printer.comment || '',
          }));

        enhancedLogger.info(
          `🔍 PowerShell detection found ${validPrinters.length} printer(s)`,
          LogCategory.SYSTEM,
          'NativePrinterDetection'
        );

        return validPrinters;
      } finally {
        // Clean up temp file
        try {
          if (fs.existsSync(tempScriptPath)) {
            fs.unlinkSync(tempScriptPath);
          }
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      enhancedLogger.error(
        '❌ PowerShell printer detection error',
        LogCategory.SYSTEM,
        'NativePrinterDetection',
        { error },
        error as Error
      );
      throw error;
    }
  }

  /**
   * Map native printer status to our status codes
   */
  private mapNativeStatus(nativeStatus: any): number {
    // Map native status to Windows printer status codes
    // 0 = Ready, 3 = Idle, 4 = Printing, 5 = Warmup, etc.
    if (typeof nativeStatus === 'number') {
      return nativeStatus;
    }

    // Default to "ready" if unknown
    return 0;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (!this.printerCache) {
      return false;
    }

    const age = Date.now() - this.printerCache.timestamp;
    return age < this.CACHE_TTL;
  }

  /**
   * Update average duration statistics
   */
  private updateAverageDuration(method: 'native' | 'powershell', duration: number): void {
    if (method === 'native') {
      const total = this.detectionStats.avgNativeDuration * (this.detectionStats.nativeSuccesses - 1);
      this.detectionStats.avgNativeDuration = (total + duration) / this.detectionStats.nativeSuccesses;
    } else {
      const attempts = this.detectionStats.nativeAttempts - this.detectionStats.nativeSuccesses + this.detectionStats.nativeFallbacks;
      const total = this.detectionStats.avgPowerShellDuration * (attempts - 1);
      this.detectionStats.avgPowerShellDuration = (total + duration) / attempts;
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): any {
    return {
      ...this.detectionStats,
      cacheAge: this.printerCache ? Date.now() - this.printerCache.timestamp : null,
      cacheMethod: this.printerCache?.method || null,
      cacheSize: this.printerCache?.data.length || 0,
    };
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.printerCache = null;
    enhancedLogger.info(
      '🗑️ Printer cache cleared',
      LogCategory.SYSTEM,
      'NativePrinterDetection'
    );
  }

  /**
   * Get cached printers without detection
   */
  getCachedPrinters(): PrinterInfo[] | null {
    if (this.printerCache && this.isCacheValid()) {
      return this.printerCache.data;
    }
    return null;
  }
}

// Export singleton instance
export const nativePrinterDetection = NativePrinterDetection.getInstance();
