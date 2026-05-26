import { IpcMainInvokeEvent } from 'electron';
import { BaseController } from './baseController';
import { IPCResponse } from '../types';
import { logInfo } from '../error-handler';
import { SupabaseSyncService } from '../services/supabaseSync';
import { SyncScheduler } from '../services/syncScheduler';
import { ServiceRegistry } from '../services/serviceRegistry';
import { prisma } from '../db/prisma-wrapper';

/**
 * IPC channels for sync operations
 */
export const SYNC_CHANNELS = {
  MANUAL_SYNC: 'mr5pos:sync:manual',
  GET_STATUS: 'mr5pos:sync:status',
  SET_AUTO_SYNC: 'mr5pos:sync:set-auto',
  SET_INTERVAL: 'mr5pos:sync:set-interval',
} as const;

/**
 * Sync Controller
 * Handles IPC communication for Supabase sync operations
 */
export class SyncController extends BaseController {
  private syncService: SupabaseSyncService;
  private syncScheduler: SyncScheduler;

  constructor(syncService: SupabaseSyncService, syncScheduler: SyncScheduler) {
    super();
    this.syncService = syncService;
    this.syncScheduler = syncScheduler;
    logInfo('SyncController initialized');
  }

  protected registerHandlers(): void {
    // Manual sync trigger
    this.registerHandler(SYNC_CHANNELS.MANUAL_SYNC, this.manualSync.bind(this));

    // Get sync status
    this.registerHandler(SYNC_CHANNELS.GET_STATUS, this.getStatus.bind(this));

    // Enable/disable auto-sync
    this.registerHandler(
      SYNC_CHANNELS.SET_AUTO_SYNC,
      this.setAutoSync.bind(this)
    );

    // Set sync interval
    this.registerHandler(
      SYNC_CHANNELS.SET_INTERVAL,
      this.setInterval.bind(this)
    );

    logInfo('All sync IPC handlers registered');
  }

  /**
   * IPC Handler: Perform manual sync (destructive wipe-and-replace).
   *
   * Two-step protocol: the renderer first invokes without `confirmed`, gets
   * back `{ requiresConfirmation: true }`, shows a destructive-action modal,
   * then re-invokes with `{ confirmed: true }`. The actual wipe + insert only
   * happens on the second call. Without this, a stray click in the UI could
   * destroy the website menu silently.
   */
  private async manualSync(
    _event: IpcMainInvokeEvent,
    opts?: { confirmed?: boolean },
  ): Promise<
    IPCResponse<{
      requiresConfirmation?: boolean;
      wiped?: { categories_wiped: number; items_wiped: number; addons_wiped: number };
      categoriesSynced: number;
      itemsSynced: number;
      addOnsSynced: number;
    }>
  > {
    try {
      logInfo(
        `Manual sync triggered from UI (confirmed=${opts?.confirmed === true})`,
      );

      const result = await this.syncService.syncAll({ confirmed: opts?.confirmed });

      if (result.requiresConfirmation) {
        return this.createSuccessResponse(
          {
            requiresConfirmation: true,
            categoriesSynced: 0,
            itemsSynced: 0,
            addOnsSynced: 0,
          },
          'Confirmation required',
        );
      }

      if (result.success) {
        return this.createSuccessResponse(
          {
            wiped: result.wiped,
            categoriesSynced: result.categoriesSynced,
            itemsSynced: result.itemsSynced,
            addOnsSynced: result.addOnsSynced,
          },
          'Website menu replaced with POS data',
        );
      } else {
        return this.createErrorResponse(result.error || 'Sync failed');
      }
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to sync menu',
      );
    }
  }

  /**
   * IPC Handler: Get sync status
   */
  private async getStatus(_event: IpcMainInvokeEvent): Promise<
    IPCResponse<{
      syncStatus: any;
      schedulerStatus: any;
      isConfigured: boolean;
    }>
  > {
    try {
      const syncStatus = this.syncService.getSyncStatus();
      const schedulerStatus = this.syncScheduler.getStatus();

      return this.createSuccessResponse({
        syncStatus,
        schedulerStatus,
        isConfigured: this.syncService.isConfigured(),
      });
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get sync status'
      );
    }
  }

  /**
   * IPC Handler: Enable/disable auto-sync
   */
  private async setAutoSync(
    _event: IpcMainInvokeEvent,
    enabled: boolean
  ): Promise<IPCResponse<{ enabled: boolean }>> {
    try {
      if (enabled) {
        this.syncScheduler.start();
        logInfo('Auto-sync enabled from UI');
      } else {
        this.syncScheduler.stop();
        logInfo('Auto-sync disabled from UI');
      }

      return this.createSuccessResponse(
        { enabled },
        `Auto-sync ${enabled ? 'enabled' : 'disabled'}`
      );
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to toggle auto-sync'
      );
    }
  }

  /**
   * IPC Handler: Set sync interval
   */
  private async setInterval(
    _event: IpcMainInvokeEvent,
    intervalMinutes: number
  ): Promise<IPCResponse<{ intervalMinutes: number }>> {
    try {
      if (intervalMinutes < 5 || intervalMinutes > 1440) {
        return this.createErrorResponse(
          'Interval must be between 5 minutes and 24 hours'
        );
      }

      this.syncScheduler.updateInterval(intervalMinutes);
      logInfo(`Sync interval updated to ${intervalMinutes} minutes`);

      return this.createSuccessResponse(
        { intervalMinutes },
        `Sync interval set to ${intervalMinutes} minutes`
      );
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to set sync interval'
      );
    }
  }
}
