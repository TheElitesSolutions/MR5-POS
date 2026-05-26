import { SupabaseSyncService } from './supabaseSync';
import { logInfo, logError } from '../error-handler';

/**
 * Sync Scheduler
 * Handles automated periodic syncing to Supabase
 */
export class SyncScheduler {
  private syncService: SupabaseSyncService;
  private intervalId: NodeJS.Timeout | null = null;
  private intervalMinutes: number = 60;
  private isRunning: boolean = false;

  constructor(syncService: SupabaseSyncService) {
    this.syncService = syncService;
  }

  /**
   * Start scheduled sync (every X minutes)
   */
  public start(intervalMinutes: number = 60): void {
    if (this.intervalId) {
      logInfo('Sync scheduler already running, stopping previous schedule');
      this.stop();
    }

    if (!this.syncService.isConfigured()) {
      logInfo(
        'Supabase not configured, sync scheduler will not start. ' +
          'Set SUPABASE_URL and SUPABASE_SERVICE_KEY in environment variables.'
      );
      return;
    }

    this.intervalMinutes = intervalMinutes;
    this.isRunning = true;

    // No 30-second startup sync. Sync is now a destructive wipe-and-replace —
    // running it implicitly on app start would silently destroy Website Manager
    // edits. Users must enable auto-sync explicitly and accept the destructive
    // tradeoff at the same time.

    // Schedule periodic syncs. The user enabled auto-sync after reading the
    // info box — that toggle is itself the confirmation for these ticks.
    this.intervalId = setInterval(
      () => {
        if (this.isRunning) {
          this.performSync('scheduled');
        }
      },
      intervalMinutes * 60 * 1000
    );

    logInfo(`✅ Scheduled sync started (every ${intervalMinutes} minutes)`);
  }

  /**
   * Stop scheduled sync
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logInfo('Scheduled sync stopped');
    }
  }

  /**
   * Perform a sync operation. Always passes `confirmed: true` — the user
   * enabled auto-sync through the settings toggle, which is their standing
   * consent for the destructive wipe-and-replace each interval.
   */
  private async performSync(type: 'scheduled'): Promise<void> {
    try {
      logInfo(`🔄 Starting ${type} sync...`);
      const result = await this.syncService.syncAll({ confirmed: true });

      if (result.success) {
        logInfo(
          `✅ ${type} sync completed - ` +
            `Categories: ${result.categoriesSynced}, ` +
            `Items: ${result.itemsSynced}, ` +
            `Add-ons: ${result.addOnsSynced}`
        );
      } else {
        logError(
          new Error(`${type} sync failed: ${result.error}`),
          'SyncScheduler'
        );
      }
    } catch (error) {
      logError(error as Error, `SyncScheduler ${type} sync`);
    }
  }

  /**
   * Get scheduler status
   */
  public getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.intervalMinutes,
      nextSyncIn: this.isRunning ? this.intervalMinutes * 60 : null, // seconds
    };
  }

  /**
   * Update sync interval (will restart scheduler)
   */
  public updateInterval(intervalMinutes: number): void {
    if (this.isRunning) {
      this.stop();
      this.start(intervalMinutes);
    } else {
      this.intervalMinutes = intervalMinutes;
    }
  }

  /**
   * Check if scheduler is running
   */
  public isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}
