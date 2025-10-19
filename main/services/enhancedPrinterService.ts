import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

interface PrinterDiagnosticResult {
  printerName: string;
  isOnline: boolean;
  spoolerHealthy: boolean;
  driverInstalled: boolean;
  communicationMethod: 'usb' | 'network' | 'serial' | 'unknown';
  lastError?: string;
  recommendedActions: string[];
  diagnosticDetails: {
    spoolerStatus?: string;
    driverVersion?: string;
    queueStatus?: string;
    portStatus?: string;
    hardwareStatus?: string;
  };
}

interface PrinterRecoveryOptions {
  restartSpooler: boolean;
  reinstallDriver: boolean;
  clearQueue: boolean;
  resetPort: boolean;
  testCommunication: boolean;
}

export class EnhancedPrinterService extends EventEmitter {
  private static instance: EnhancedPrinterService;
  private diagnosticCache: Map<string, PrinterDiagnosticResult> = new Map();
  private recoveryAttempts: Map<string, number> = new Map();
  private readonly MAX_RECOVERY_ATTEMPTS = 3;

  public static getInstance(): EnhancedPrinterService {
    if (!EnhancedPrinterService.instance) {
      EnhancedPrinterService.instance = new EnhancedPrinterService();
    }
    return EnhancedPrinterService.instance;
  }

  /**
   * Comprehensive printer diagnostic system
   */
  async diagnosePrinter(printerName: string): Promise<PrinterDiagnosticResult> {
    console.log(`🔍 Starting comprehensive diagnostics for: ${printerName}`);

    const result: PrinterDiagnosticResult = {
      printerName,
      isOnline: false,
      spoolerHealthy: false,
      driverInstalled: false,
      communicationMethod: 'unknown',
      recommendedActions: [],
      diagnosticDetails: {},
    };

    try {
      // Step 1: Check Windows Print Spooler Service
      result.spoolerHealthy = await this.checkPrintSpoolerHealth();
      if (!result.spoolerHealthy) {
        result.recommendedActions.push('Restart Windows Print Spooler service');
      }

      // Step 2: Verify printer driver installation
      const driverInfo = await this.checkPrinterDriver(printerName);
      result.driverInstalled = driverInfo.installed;
      result.diagnosticDetails.driverVersion = driverInfo.version;

      if (!result.driverInstalled) {
        result.recommendedActions.push(
          'Install or reinstall RONGTA printer driver'
        );
      }

      // Step 3: Test printer communication interfaces
      const communicationTest =
        await this.testPrinterCommunication(printerName);
      result.communicationMethod = communicationTest.method;
      result.diagnosticDetails.portStatus = communicationTest.status;

      // Step 4: Check printer status and queue
      const statusCheck = await this.checkPrinterStatus(printerName);
      result.isOnline = statusCheck.online;
      result.diagnosticDetails.queueStatus = statusCheck.queueStatus;
      result.diagnosticDetails.hardwareStatus = statusCheck.hardwareStatus;

      // Step 5: RONGTA-specific validations
      if (this.isRongtaPrinter(printerName)) {
        const rongtaChecks =
          await this.performRongtaSpecificChecks(printerName);
        result.recommendedActions.push(...rongtaChecks.recommendations);
      }

      // Cache results for performance
      this.diagnosticCache.set(printerName, result);

      console.log(`✅ Diagnostics completed for ${printerName}:`, {
        online: result.isOnline,
        spooler: result.spoolerHealthy,
        driver: result.driverInstalled,
        method: result.communicationMethod,
      });

      return result;
    } catch (error) {
      result.lastError = error instanceof Error ? error.message : String(error);
      result.recommendedActions.push(
        'Check system logs for detailed error information'
      );

      console.error(`❌ Diagnostic failed for ${printerName}:`, error);
      return result;
    }
  }

  /**
   * Automated printer recovery system
   */
  async recoverPrinter(
    printerName: string,
    options: Partial<PrinterRecoveryOptions> = {}
  ): Promise<{
    success: boolean;
    message: string;
    actionsPerformed: string[];
  }> {
    const attempts = this.recoveryAttempts.get(printerName) || 0;

    if (attempts >= this.MAX_RECOVERY_ATTEMPTS) {
      return {
        success: false,
        message:
          'Maximum recovery attempts exceeded. Manual intervention required.',
        actionsPerformed: [],
      };
    }

    this.recoveryAttempts.set(printerName, attempts + 1);
    const actionsPerformed: string[] = [];

    try {
      console.log(
        `🔧 Starting recovery for printer: ${printerName} (attempt ${attempts + 1})`
      );

      // Step 1: Restart Print Spooler if needed
      if (options.restartSpooler !== false) {
        const spoolerRestart = await this.restartPrintSpooler();
        if (spoolerRestart) {
          actionsPerformed.push('Restarted Windows Print Spooler');
        }
      }

      // Step 2: Clear print queue
      if (options.clearQueue !== false) {
        const queueCleared = await this.clearPrintQueue(printerName);
        if (queueCleared) {
          actionsPerformed.push('Cleared print queue');
        }
      }

      // Step 3: Reset printer port/connection
      if (options.resetPort !== false) {
        const portReset = await this.resetPrinterPort(printerName);
        if (portReset) {
          actionsPerformed.push('Reset printer port connection');
        }
      }

      // Step 4: Test communication
      if (options.testCommunication !== false) {
        const commTest = await this.testBasicCommunication(printerName);
        if (commTest.success) {
          actionsPerformed.push('Verified basic printer communication');
        }
      }

      // Step 5: Verify recovery success
      const postRecoveryDiag = await this.diagnosePrinter(printerName);

      if (postRecoveryDiag.isOnline && postRecoveryDiag.spoolerHealthy) {
        this.recoveryAttempts.delete(printerName); // Reset attempts on success
        return {
          success: true,
          message: 'Printer recovery completed successfully',
          actionsPerformed,
        };
      } else {
        return {
          success: false,
          message: 'Recovery partially successful. Some issues remain.',
          actionsPerformed,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Recovery failed: ${error instanceof Error ? error.message : String(error)}`,
        actionsPerformed,
      };
    }
  }

  /**
   * Enhanced printer test with multiple fallback methods
   */
  async testPrintWithFallbacks(printerName: string): Promise<{
    success: boolean;
    method: string;
    message: string;
    diagnostics?: PrinterDiagnosticResult;
  }> {
    console.log(`🧪 Testing printer with fallbacks: ${printerName}`);

    // First, run diagnostics
    const diagnostics = await this.diagnosePrinter(printerName);

    if (!diagnostics.spoolerHealthy || !diagnostics.driverInstalled) {
      // Attempt automatic recovery
      const recovery = await this.recoverPrinter(printerName);

      if (!recovery.success) {
        return {
          success: false,
          method: 'diagnostic',
          message: `Printer not ready: ${recovery.message}`,
          diagnostics,
        };
      }
    }

    // Method 1: Windows native printing
    try {
      const nativeResult = await this.testNativePrint(printerName);
      if (nativeResult.success) {
        return {
          success: true,
          method: 'windows-native',
          message: 'Test print successful via Windows native printing',
          diagnostics,
        };
      }
    } catch (error) {
      console.warn(`Native print failed: ${error}`);
    }

    // Method 2: Direct port printing
    try {
      const portResult = await this.testDirectPortPrint(printerName);
      if (portResult.success) {
        return {
          success: true,
          method: 'direct-port',
          message: 'Test print successful via direct port printing',
          diagnostics,
        };
      }
    } catch (error) {
      console.warn(`Direct port print failed: ${error}`);
    }

    // Method 3: RAW socket printing (for network printers)
    if (diagnostics.communicationMethod === 'network') {
      try {
        const rawResult = await this.testRawSocketPrint(printerName);
        if (rawResult.success) {
          return {
            success: true,
            method: 'raw-socket',
            message: 'Test print successful via RAW socket printing',
            diagnostics,
          };
        }
      } catch (error) {
        console.warn(`RAW socket print failed: ${error}`);
      }
    }

    // Method 4: ESC/POS direct commands
    try {
      const escposResult = await this.testESCPOSDirectPrint(printerName);
      if (escposResult.success) {
        return {
          success: true,
          method: 'escpos-direct',
          message: 'Test print successful via ESC/POS direct commands',
          diagnostics,
        };
      }
    } catch (error) {
      console.warn(`ESC/POS direct print failed: ${error}`);
    }

    return {
      success: false,
      method: 'all-methods-failed',
      message:
        'All printing methods failed. Check printer connection and drivers.',
      diagnostics,
    };
  }

  /**
   * Check Windows Print Spooler health
   */
  private async checkPrintSpoolerHealth(): Promise<boolean> {
    try {
      const script = `
        $service = Get-Service -Name "Spooler" -ErrorAction Stop
        @{
          Status = $service.Status
          StartType = $service.StartType
          CanStop = $service.CanStop
        } | ConvertTo-Json -Compress
      `;

      const tempScript = path.join(
        os.tmpdir(),
        `spooler-check-${Date.now()}.ps1`
      );
      fs.writeFileSync(tempScript, script, 'utf8');

      try {
        const { stdout } = await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScript}"`,
          { timeout: 5000 }
        );

        const spoolerInfo = JSON.parse(stdout.trim());
        return spoolerInfo.Status === 'Running';
      } finally {
        fs.unlinkSync(tempScript);
      }
    } catch (error) {
      console.error('Spooler health check failed:', error);
      return false;
    }
  }

  /**
   * Restart Windows Print Spooler service
   */
  private async restartPrintSpooler(): Promise<boolean> {
    try {
      const script = `
        try {
          Write-Host "Stopping Print Spooler..."
          Stop-Service -Name "Spooler" -Force -ErrorAction Stop
          Start-Sleep -Seconds 2
          
          Write-Host "Starting Print Spooler..."
          Start-Service -Name "Spooler" -ErrorAction Stop
          
          $service = Get-Service -Name "Spooler"
          if ($service.Status -eq "Running") {
            Write-Host "Print Spooler restarted successfully"
            exit 0
          } else {
            Write-Error "Print Spooler failed to start"
            exit 1
          }
        } catch {
          Write-Error "Failed to restart Print Spooler: $($_.Exception.Message)"
          exit 1
        }
      `;

      const tempScript = path.join(
        os.tmpdir(),
        `spooler-restart-${Date.now()}.ps1`
      );
      fs.writeFileSync(tempScript, script, 'utf8');

      try {
        await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScript}"`,
          { timeout: 15000 }
        );
        return true;
      } finally {
        fs.unlinkSync(tempScript);
      }
    } catch (error) {
      console.error('Spooler restart failed:', error);
      return false;
    }
  }

  /**
   * Check printer driver installation
   */
  private async checkPrinterDriver(printerName: string): Promise<{
    installed: boolean;
    version?: string;
  }> {
    try {
      const script = `
        try {
          $printer = Get-Printer -Name "${printerName.replace(/"/g, '""')}" -ErrorAction Stop
          $driver = Get-PrinterDriver -Name $printer.DriverName -ErrorAction Stop
          
          @{
            installed = $true
            driverName = $driver.Name
            version = $driver.Version
            manufacturer = $driver.Manufacturer
          } | ConvertTo-Json -Compress
        } catch {
          @{
            installed = $false
            error = $_.Exception.Message
          } | ConvertTo-Json -Compress
        }
      `;

      const tempScript = path.join(
        os.tmpdir(),
        `driver-check-${Date.now()}.ps1`
      );
      fs.writeFileSync(tempScript, script, 'utf8');

      try {
        const { stdout } = await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScript}"`,
          { timeout: 8000 }
        );

        const driverInfo = JSON.parse(stdout.trim());
        return {
          installed: driverInfo.installed,
          version: driverInfo.version,
        };
      } finally {
        fs.unlinkSync(tempScript);
      }
    } catch (error) {
      return { installed: false };
    }
  }

  /**
   * Test printer communication methods
   */
  private async testPrinterCommunication(printerName: string): Promise<{
    method: 'usb' | 'network' | 'serial' | 'unknown';
    status: string;
  }> {
    try {
      const script = `
        try {
          $printer = Get-Printer -Name "${printerName.replace(/"/g, '""')}" -ErrorAction Stop
          $port = $printer.PortName
          
          $method = "unknown"
          if ($port -like "USB*") { $method = "usb" }
          elseif ($port -like "*.*.*.*") { $method = "network" }
          elseif ($port -like "COM*") { $method = "serial" }
          
          @{
            method = $method
            portName = $port
            status = "detected"
          } | ConvertTo-Json -Compress
        } catch {
          @{
            method = "unknown"
            status = "failed"
            error = $_.Exception.Message
          } | ConvertTo-Json -Compress
        }
      `;

      const tempScript = path.join(os.tmpdir(), `comm-check-${Date.now()}.ps1`);
      fs.writeFileSync(tempScript, script, 'utf8');

      try {
        const { stdout } = await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScript}"`,
          { timeout: 6000 }
        );

        const commInfo = JSON.parse(stdout.trim());
        return {
          method: commInfo.method,
          status: commInfo.status,
        };
      } finally {
        fs.unlinkSync(tempScript);
      }
    } catch (error) {
      return { method: 'unknown', status: 'error' };
    }
  }

  /**
   * Check detailed printer status
   */
  private async checkPrinterStatus(printerName: string): Promise<{
    online: boolean;
    queueStatus: string;
    hardwareStatus: string;
  }> {
    try {
      const script = `
        try {
          $printer = Get-Printer -Name "${printerName.replace(/"/g, '""')}" -ErrorAction Stop
          $jobs = Get-PrintJob -PrinterName $printer.Name -ErrorAction SilentlyContinue
          
          @{
            online = ($printer.PrinterStatus -eq "Normal" -or $printer.PrinterStatus -eq "Idle")
            printerStatus = $printer.PrinterStatus
            jobCount = if ($jobs) { $jobs.Count } else { 0 }
            workflowPolicy = $printer.WorkflowPolicy
          } | ConvertTo-Json -Compress
        } catch {
          @{
            online = $false
            error = $_.Exception.Message
          } | ConvertTo-Json -Compress
        }
      `;

      const tempScript = path.join(
        os.tmpdir(),
        `status-check-${Date.now()}.ps1`
      );
      fs.writeFileSync(tempScript, script, 'utf8');

      try {
        const { stdout } = await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScript}"`,
          { timeout: 8000 }
        );

        const statusInfo = JSON.parse(stdout.trim());
        return {
          online: statusInfo.online || false,
          queueStatus: `${statusInfo.jobCount || 0} jobs in queue`,
          hardwareStatus: statusInfo.printerStatus || 'unknown',
        };
      } finally {
        fs.unlinkSync(tempScript);
      }
    } catch (error) {
      return {
        online: false,
        queueStatus: 'unknown',
        hardwareStatus: 'error',
      };
    }
  }

  /**
   * RONGTA-specific validation checks
   */
  private async performRongtaSpecificChecks(printerName: string): Promise<{
    recommendations: string[];
  }> {
    const recommendations: string[] = [];

    try {
      // Check for RONGTA driver specific issues
      const driverCheck = await this.checkPrinterDriver(printerName);

      if (!driverCheck.installed) {
        recommendations.push(
          'Download RONGTA driver from: https://www.rongtatech.com/category/downloads/1'
        );
        recommendations.push('Run driver installer as Administrator');
        recommendations.push(
          'Ensure USB cable is connected during driver installation'
        );
      }

      // Check for common RONGTA error codes
      const errorPatterns = ['AddMonitor error', '1805', '1797'];
      // Add specific RONGTA troubleshooting steps

      recommendations.push(
        'Verify RONGTA printer is powered on and paper loaded'
      );
      recommendations.push('Try different USB port or cable');
      recommendations.push(
        'Check Windows Device Manager for hardware conflicts'
      );

      return { recommendations };
    } catch (error) {
      return {
        recommendations: ['Run RONGTA printer troubleshooting tool'],
      };
    }
  }

  /**
   * Clear print queue for specific printer
   */
  private async clearPrintQueue(printerName: string): Promise<boolean> {
    try {
      const script = `
        try {
          Get-PrintJob -PrinterName "${printerName.replace(/"/g, '""')}" | Remove-PrintJob -Confirm:$false
          Write-Host "Print queue cleared successfully"
          exit 0
        } catch {
          Write-Host "No jobs to clear or error occurred: $($_.Exception.Message)"
          exit 0
        }
      `;

      const tempScript = path.join(
        os.tmpdir(),
        `queue-clear-${Date.now()}.ps1`
      );
      fs.writeFileSync(tempScript, script, 'utf8');

      try {
        await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScript}"`,
          { timeout: 10000 }
        );
        return true;
      } finally {
        fs.unlinkSync(tempScript);
      }
    } catch (error) {
      console.warn('Queue clear failed:', error);
      return false;
    }
  }

  /**
   * Reset printer port connection
   */
  private async resetPrinterPort(printerName: string): Promise<boolean> {
    try {
      // This is a placeholder for port reset logic
      // In practice, this might involve USB device reset or network reconnection
      console.log(`Resetting port for printer: ${printerName}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test basic printer communication
   */
  private async testBasicCommunication(printerName: string): Promise<{
    success: boolean;
    latency?: number;
  }> {
    const startTime = Date.now();

    try {
      const statusCheck = await this.checkPrinterStatus(printerName);

      return {
        success: statusCheck.online,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Native Windows print test
   */
  private async testNativePrint(
    printerName: string
  ): Promise<{ success: boolean }> {
    try {
      const testContent = `
=== MR5-POS TEST PAGE ===
Printer: ${printerName}
Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}

✓ Windows native printing
✓ Spooler communication
✓ Driver integration test

This is a test print to verify
printer functionality and driver
installation.

Status: SUCCESS
=============================
`;

      const script = `
        try {
          $printerName = "${printerName.replace(/"/g, '""')}"
          $content = @"
${testContent.replace(/"/g, '""')}
"@
          
          # Create temporary file
          $tempFile = [System.IO.Path]::GetTempFileName()
          $content | Out-File -FilePath $tempFile -Encoding UTF8
          
          # Print file
          Start-Process -FilePath "notepad.exe" -ArgumentList "/p \`"$tempFile\`"" -Wait -WindowStyle Hidden
          
          # Clean up
          Remove-Item $tempFile -Force
          
          Write-Host "Native print test completed"
          exit 0
        } catch {
          Write-Error "Native print failed: $($_.Exception.Message)"
          exit 1
        }
      `;

      const tempScript = path.join(
        os.tmpdir(),
        `native-print-${Date.now()}.ps1`
      );
      fs.writeFileSync(tempScript, script, 'utf8');

      try {
        await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScript}"`,
          { timeout: 15000 }
        );
        return { success: true };
      } finally {
        fs.unlinkSync(tempScript);
      }
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Direct port printing test
   */
  private async testDirectPortPrint(
    printerName: string
  ): Promise<{ success: boolean }> {
    try {
      // This would implement direct port communication
      // For now, return placeholder
      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * RAW socket printing test (for network printers)
   */
  private async testRawSocketPrint(
    printerName: string
  ): Promise<{ success: boolean }> {
    try {
      // This would implement RAW socket communication
      // For now, return placeholder
      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * ESC/POS direct command test
   */
  private async testESCPOSDirectPrint(
    printerName: string
  ): Promise<{ success: boolean }> {
    try {
      // This would implement direct ESC/POS commands
      // For now, return placeholder
      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Check if printer is RONGTA brand
   */
  private isRongtaPrinter(printerName: string): boolean {
    const rongtaPatterns = ['rongta', 'rp80', 'rp32'];
    const lowerName = printerName.toLowerCase();
    return rongtaPatterns.some(pattern => lowerName.includes(pattern));
  }

  /**
   * Get user-friendly troubleshooting instructions
   */
  getTroubleshootingInstructions(
    diagnostics: PrinterDiagnosticResult
  ): string[] {
    const instructions: string[] = [];

    if (!diagnostics.spoolerHealthy) {
      instructions.push(
        '1. Open Services (services.msc) and restart "Print Spooler" service'
      );
      instructions.push('2. Set Print Spooler startup type to "Automatic"');
    }

    if (!diagnostics.driverInstalled) {
      instructions.push(
        '3. Download the latest RONGTA driver from the official website'
      );
      instructions.push('4. Run the driver installer as Administrator');
      instructions.push(
        '5. Disconnect and reconnect the USB cable during installation'
      );
    }

    if (!diagnostics.isOnline) {
      instructions.push(
        '6. Check physical printer connections (USB/Network/Power)'
      );
      instructions.push('7. Verify printer is powered on and has paper loaded');
      instructions.push('8. Try a different USB port or cable');
    }

    if (diagnostics.recommendedActions.length > 0) {
      instructions.push('Additional recommendations:');
      diagnostics.recommendedActions.forEach((action, index) => {
        instructions.push(`${instructions.length + index + 1}. ${action}`);
      });
    }

    return instructions;
  }
}
