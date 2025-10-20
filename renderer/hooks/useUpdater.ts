import { useCallback, useEffect, useState } from 'react';
import { isElectron } from '../utils/electron-api';
import { useIpcEvent, useIpcInvoke } from './useElectron';

/**
 * Updater channels - must match main/controllers/updaterController.ts
 */
const UPDATER_CHANNELS = {
  CHECK_FOR_UPDATES: 'mr5pos:updater:check-for-updates',
  DOWNLOAD_UPDATE: 'mr5pos:updater:download-update',
  INSTALL_UPDATE: 'mr5pos:updater:install-update',
  GET_UPDATE_STATUS: 'mr5pos:updater:get-status',
  SET_AUTO_UPDATE: 'mr5pos:updater:set-auto-update',
  CANCEL_UPDATE: 'mr5pos:updater:cancel-update',
  SKIP_VERSION: 'mr5pos:updater:skip-version',
} as const;

/**
 * Updater events - must match main/controllers/updaterController.ts
 */
const UPDATER_EVENTS = {
  CHECKING_FOR_UPDATE: 'updater:checking-for-update',
  UPDATE_AVAILABLE: 'updater:update-available',
  UPDATE_NOT_AVAILABLE: 'updater:update-not-available',
  DOWNLOAD_PROGRESS: 'updater:download-progress',
  UPDATE_DOWNLOADED: 'updater:update-downloaded',
  ERROR: 'updater:error',
} as const;

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
  files?: any[];
}

export interface ProgressInfo {
  total: number;
  delta: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
}

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
  updateInfo: UpdateInfo | null;
  progress: ProgressInfo | null;
  isDev: boolean;
  autoUpdateEnabled: boolean;
}

/**
 * Hook for managing application updates
 * Uses the UpdaterController IPC channels
 */
export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>({
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    updateInfo: null,
    progress: null,
    isDev: false,
    autoUpdateEnabled: false,
  });

  // IPC invoke hooks
  const checkForUpdatesInvoke = useIpcInvoke(UPDATER_CHANNELS.CHECK_FOR_UPDATES);
  const downloadUpdateInvoke = useIpcInvoke(UPDATER_CHANNELS.DOWNLOAD_UPDATE);
  const installUpdateInvoke = useIpcInvoke(UPDATER_CHANNELS.INSTALL_UPDATE);
  const getUpdateStatusInvoke = useIpcInvoke(UPDATER_CHANNELS.GET_UPDATE_STATUS);
  const setAutoUpdateInvoke = useIpcInvoke(UPDATER_CHANNELS.SET_AUTO_UPDATE);
  const cancelUpdateInvoke = useIpcInvoke(UPDATER_CHANNELS.CANCEL_UPDATE);
  const skipVersionInvoke = useIpcInvoke(UPDATER_CHANNELS.SKIP_VERSION);

  // Listen for updater events from main process
  useIpcEvent(
    UPDATER_EVENTS.CHECKING_FOR_UPDATE as any,
    () => {
      setStatus(prev => ({ ...prev, checking: true, error: null }));
    },
    []
  );

  useIpcEvent(
    UPDATER_EVENTS.UPDATE_AVAILABLE as any,
    (_, info: UpdateInfo) => {
      setStatus(prev => ({
        ...prev,
        checking: false,
        available: true,
        updateInfo: info,
      }));
    },
    []
  );

  useIpcEvent(
    UPDATER_EVENTS.UPDATE_NOT_AVAILABLE as any,
    () => {
      setStatus(prev => ({
        ...prev,
        checking: false,
        available: false,
        updateInfo: null,
      }));
    },
    []
  );

  useIpcEvent(
    UPDATER_EVENTS.DOWNLOAD_PROGRESS as any,
    (_, progress: ProgressInfo) => {
      setStatus(prev => ({
        ...prev,
        downloading: true,
        progress,
      }));
    },
    []
  );

  useIpcEvent(
    UPDATER_EVENTS.UPDATE_DOWNLOADED as any,
    (_, info: UpdateInfo) => {
      setStatus(prev => ({
        ...prev,
        downloading: false,
        downloaded: true,
        progress: null,
        updateInfo: info,
      }));
    },
    []
  );

  useIpcEvent(
    UPDATER_EVENTS.ERROR as any,
    (_, error: { message: string; stack?: string }) => {
      setStatus(prev => ({
        ...prev,
        checking: false,
        downloading: false,
        error: error.message,
      }));
    },
    []
  );

  // Get initial status on mount
  useEffect(() => {
    if (!isElectron()) return;

    const loadStatus = async () => {
      try {
        const response = await getUpdateStatusInvoke();
        if (response && response.success && response.data) {
          setStatus(response.data as UpdateStatus);
        }
      } catch (error) {
        console.error('Failed to get update status:', error);
      }
    };

    loadStatus();
  }, []);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if (!isElectron()) {
      console.warn('Update check not available - not in Electron environment');
      return { success: false, error: 'Not in Electron environment' };
    }

    try {
      const response = await checkForUpdatesInvoke();
      return response;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check for updates',
      };
    }
  }, [checkForUpdatesInvoke]);

  // Download update
  const downloadUpdate = useCallback(async () => {
    if (!isElectron()) {
      console.warn('Update download not available - not in Electron environment');
      return { success: false, error: 'Not in Electron environment' };
    }

    try {
      const response = await downloadUpdateInvoke();
      return response;
    } catch (error) {
      console.error('Failed to download update:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download update',
      };
    }
  }, [downloadUpdateInvoke]);

  // Install update
  const installUpdate = useCallback(async () => {
    if (!isElectron()) {
      console.warn('Update installation not available - not in Electron environment');
      return { success: false, error: 'Not in Electron environment' };
    }

    try {
      const response = await installUpdateInvoke();
      return response;
    } catch (error) {
      console.error('Failed to install update:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to install update',
      };
    }
  }, [installUpdateInvoke]);

  // Set auto-update enabled/disabled
  const setAutoUpdate = useCallback(
    async (enabled: boolean) => {
      if (!isElectron()) {
        console.warn('Auto-update setting not available - not in Electron environment');
        return { success: false, error: 'Not in Electron environment' };
      }

      try {
        const response = await setAutoUpdateInvoke(enabled);
        if (response && response.success) {
          setStatus(prev => ({ ...prev, autoUpdateEnabled: enabled }));
        }
        return response;
      } catch (error) {
        console.error('Failed to set auto-update:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set auto-update',
        };
      }
    },
    [setAutoUpdateInvoke]
  );

  // Cancel update download
  const cancelUpdate = useCallback(async () => {
    if (!isElectron()) {
      console.warn('Update cancellation not available - not in Electron environment');
      return { success: false, error: 'Not in Electron environment' };
    }

    try {
      const response = await cancelUpdateInvoke();
      if (response && response.success) {
        setStatus(prev => ({
          ...prev,
          downloading: false,
          available: false,
          progress: null,
        }));
      }
      return response;
    } catch (error) {
      console.error('Failed to cancel update:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel update',
      };
    }
  }, [cancelUpdateInvoke]);

  // Skip version
  const skipVersion = useCallback(
    async (version: string) => {
      if (!isElectron()) {
        console.warn('Version skipping not available - not in Electron environment');
        return { success: false, error: 'Not in Electron environment' };
      }

      try {
        const response = await skipVersionInvoke(version);
        if (response && response.success) {
          setStatus(prev => ({
            ...prev,
            available: false,
            updateInfo: null,
          }));
        }
        return response;
      } catch (error) {
        console.error('Failed to skip version:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to skip version',
        };
      }
    },
    [skipVersionInvoke]
  );

  return {
    status,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    setAutoUpdate,
    cancelUpdate,
    skipVersion,
  };
}
