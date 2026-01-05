/**
 * Printer Spooler Optimization Service
 * Proactive spooler management for improved printing performance on old Windows 10 hardware
 */
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import { enhancedLogger, LogCategory } from '../utils/enhanced-logger';
const execAsync = promisify(exec);
export class PrinterSpoolerService extends EventEmitter {
    static getInstance() {
        if (!PrinterSpoolerService.instance) {
            PrinterSpoolerService.instance = new PrinterSpoolerService();
        }
        return PrinterSpoolerService.instance;
    }
    constructor() {
        super();
        this.monitoringInterval = null;
        this.MONITORING_INTERVAL = 5 * 60 * 1000; // 5 minutes
        this.SPOOLER_RESTART_COOLDOWN = 30 * 60 * 1000; // 30 minutes
        this.lastSpoolerRestart = 0;
        this.isMonitoring = false;
        enhancedLogger.info('🔧 PrinterSpoolerService initialized', LogCategory.SYSTEM, 'PrinterSpoolerService');
    }
    /**
     * Start background spooler monitoring and optimization
     */
    startMonitoring() {
        if (this.isMonitoring) {
            enhancedLogger.warn('Spooler monitoring already active', LogCategory.SYSTEM, 'PrinterSpoolerService');
            return;
        }
        enhancedLogger.info('🚀 Starting spooler background monitoring', LogCategory.SYSTEM, 'PrinterSpoolerService');
        this.isMonitoring = true;
        // Immediate health check on start
        this.performHealthCheck().catch(error => {
            enhancedLogger.error('Initial spooler health check failed', LogCategory.SYSTEM, 'PrinterSpoolerService', { error });
        });
        // Schedule periodic monitoring
        this.monitoringInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, this.MONITORING_INTERVAL);
    }
    /**
     * Stop background monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        enhancedLogger.info('⏹️ Spooler monitoring stopped', LogCategory.SYSTEM, 'PrinterSpoolerService');
    }
    /**
     * Perform comprehensive spooler health check and optimization
     */
    async performHealthCheck() {
        try {
            enhancedLogger.info('🔍 Performing spooler health check', LogCategory.SYSTEM, 'PrinterSpoolerService');
            // Check spooler status
            const isHealthy = await this.checkSpoolerHealth();
            if (!isHealthy) {
                enhancedLogger.warn('⚠️ Spooler unhealthy - attempting recovery', LogCategory.SYSTEM, 'PrinterSpoolerService');
                // Attempt to restart spooler if cooldown period has passed
                const now = Date.now();
                if (now - this.lastSpoolerRestart > this.SPOOLER_RESTART_COOLDOWN) {
                    await this.restartSpooler();
                    this.lastSpoolerRestart = now;
                }
                else {
                    enhancedLogger.info('⏳ Spooler restart cooldown active - skipping restart', LogCategory.SYSTEM, 'PrinterSpoolerService');
                }
            }
            // Proactive queue clearing for all printers
            await this.clearAllPrintQueues();
            // Check for stuck jobs
            await this.checkForStuckJobs();
            enhancedLogger.info('✅ Spooler health check completed', LogCategory.SYSTEM, 'PrinterSpoolerService');
            this.emit('health-check-complete', { healthy: isHealthy });
        }
        catch (error) {
            enhancedLogger.error('❌ Spooler health check failed', LogCategory.SYSTEM, 'PrinterSpoolerService', { error }, error);
            this.emit('health-check-error', error);
        }
    }
    /**
     * Check Windows Print Spooler service health
     */
    async checkSpoolerHealth() {
        try {
            const { stdout } = await execAsync('powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Service -Name Spooler | Select-Object -ExpandProperty Status"', { timeout: 5000, windowsHide: true });
            const status = stdout.trim();
            const isRunning = status === 'Running';
            if (!isRunning) {
                enhancedLogger.warn(`⚠️ Spooler status: ${status}`, LogCategory.SYSTEM, 'PrinterSpoolerService');
            }
            return isRunning;
        }
        catch (error) {
            enhancedLogger.error('Failed to check spooler health', LogCategory.SYSTEM, 'PrinterSpoolerService', { error });
            return false;
        }
    }
    /**
     * Restart Windows Print Spooler service
     */
    async restartSpooler() {
        try {
            enhancedLogger.info('🔄 Restarting Print Spooler service', LogCategory.SYSTEM, 'PrinterSpoolerService');
            // Stop spooler
            await execAsync('powershell -NoProfile -ExecutionPolicy Bypass -Command "Stop-Service -Name Spooler -Force"', { timeout: 10000, windowsHide: true });
            // Wait 2 seconds
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Start spooler
            await execAsync('powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Service -Name Spooler"', { timeout: 10000, windowsHide: true });
            enhancedLogger.info('✅ Spooler restarted successfully', LogCategory.SYSTEM, 'PrinterSpoolerService');
            this.emit('spooler-restarted');
            return true;
        }
        catch (error) {
            enhancedLogger.error('❌ Failed to restart spooler', LogCategory.SYSTEM, 'PrinterSpoolerService', { error }, error);
            return false;
        }
    }
    /**
     * Clear print queues for all printers proactively
     */
    async clearAllPrintQueues() {
        try {
            enhancedLogger.info('🧹 Clearing all print queues (proactive optimization)', LogCategory.SYSTEM, 'PrinterSpoolerService');
            // PowerShell command to clear all print jobs across all printers
            await execAsync('powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-PrintJob | Remove-PrintJob -Confirm:$false"', { timeout: 15000, windowsHide: true });
            enhancedLogger.info('✅ All print queues cleared', LogCategory.SYSTEM, 'PrinterSpoolerService');
            this.emit('queues-cleared');
        }
        catch (error) {
            // This is expected if there are no jobs in queue - don't log as error
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!errorMessage.includes('No print jobs found') &&
                !errorMessage.includes('Cannot find any')) {
                enhancedLogger.warn('Queue clearing encountered minor issue', LogCategory.SYSTEM, 'PrinterSpoolerService', { error: errorMessage });
            }
        }
    }
    /**
     * Check for stuck print jobs (over 5 minutes old)
     */
    async checkForStuckJobs() {
        try {
            const { stdout } = await execAsync('powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-PrintJob | Where-Object { $_.SubmittedTime -lt (Get-Date).AddMinutes(-5) } | Select-Object -Property PrinterName, JobStatus, @{Name=\'Age\';Expression={(New-TimeSpan -Start $_.SubmittedTime).TotalMinutes}}"', { timeout: 10000, windowsHide: true });
            if (stdout.trim()) {
                enhancedLogger.warn(`⚠️ Found stuck print jobs (>5 minutes old)`, LogCategory.SYSTEM, 'PrinterSpoolerService', { jobs: stdout.trim() });
                this.emit('stuck-jobs-detected', { jobs: stdout.trim() });
                // Auto-clear stuck jobs
                await this.clearAllPrintQueues();
            }
        }
        catch (error) {
            // Expected if no stuck jobs found
        }
    }
    /**
     * Manual spooler optimization trigger
     */
    async optimizeNow() {
        const actions = [];
        try {
            // Clear queues
            await this.clearAllPrintQueues();
            actions.push('Cleared all print queues');
            // Check health
            const isHealthy = await this.checkSpoolerHealth();
            if (!isHealthy) {
                await this.restartSpooler();
                actions.push('Restarted Print Spooler service');
            }
            else {
                actions.push('Spooler health verified');
            }
            return {
                success: true,
                message: 'Spooler optimization completed successfully',
                actions,
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Spooler optimization failed: ${error instanceof Error ? error.message : String(error)}`,
                actions,
            };
        }
    }
    /**
     * Get current spooler status
     */
    async getStatus() {
        try {
            const spoolerRunning = await this.checkSpoolerHealth();
            // Get queue length
            let queueLength = 0;
            try {
                const { stdout } = await execAsync('powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-PrintJob).Count"', { timeout: 5000, windowsHide: true });
                queueLength = parseInt(stdout.trim()) || 0;
            }
            catch {
                // No jobs in queue
            }
            return {
                spoolerRunning,
                queueLength,
                monitoringActive: this.isMonitoring,
                lastRestart: this.lastSpoolerRestart || null,
            };
        }
        catch (error) {
            return {
                spoolerRunning: false,
                queueLength: 0,
                monitoringActive: this.isMonitoring,
                lastRestart: this.lastSpoolerRestart || null,
            };
        }
    }
}
// Export singleton instance
export const printerSpoolerService = PrinterSpoolerService.getInstance();
