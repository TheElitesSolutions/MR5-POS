import type { IpcRendererEvent } from 'electron';
import { useCallback, useEffect, useState } from 'react';
import type { IPCChannel } from '../../shared/ipc-handler-types';
import electronAPI, { isElectron } from '../utils/electron-api';

/**
 * Hook for handling IPC events from the main process
 */
export function useIpcEvent(
  channel: IPCChannel,
  handler: (event: IpcRendererEvent, ...args: any[]) => void,
  deps: any[] = []
) {
  useEffect(() => {
    if (!isElectron()) {
      console.warn(
        `IPC event listener not registered for channel '${channel}' - not in Electron environment`
      );
      return;
    }

    const unsubscribe = electronAPI.on(channel, handler);
    return () => {
      unsubscribe();
    };
  }, [channel, ...deps]);
}

/**
 * Hook for invoking IPC methods on the main process
 */
export function useIpcInvoke(channel: IPCChannel) {
  const invoke = useCallback(
    async (...args: any[]) => {
      if (!isElectron()) {
        throw new Error(
          `Cannot invoke IPC channel '${channel}' - not in Electron environment`
        );
      }
      return await electronAPI.invoke(channel, ...args);
    },
    [channel]
  );

  return invoke;
}

/**
 * Hook for sending one-way IPC messages to the main process
 */
export function useIpcSend(channel: IPCChannel) {
  const send = useCallback(
    (...args: any[]) => {
      if (!isElectron()) {
        console.warn(
          `Cannot send IPC message to channel '${channel}' - not in Electron environment`
        );
        return;
      }
      electronAPI.send(channel, ...args);
    },
    [channel]
  );

  return send;
}

/**
 * Hook for managing system theme synchronization with OS
 */
export function useSystemTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (!isElectron()) return;

    let cleanup: (() => void) | undefined;

    // Initial theme check
    electronAPI.invoke('settings:get').then(settings => {
      if (
        settings &&
        typeof settings === 'object' &&
        'theme' in settings &&
        (settings as any).theme === 'system'
      ) {
        // Get system theme preference
        const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
        setTheme(darkMode.matches ? 'dark' : 'light');

        // Listen for system theme changes
        const handler = (e: MediaQueryListEvent) =>
          setTheme(e.matches ? 'dark' : 'light');
        darkMode.addEventListener('change', handler);
        cleanup = () => darkMode.removeEventListener('change', handler);
      } else {
        setTheme((settings as any).theme === 'dark' ? 'dark' : 'light');
      }
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  return theme;
}

/**
 * Hook for managing printer selection and status
 */
export function usePrinter() {
  const [printers, setPrinters] = useState<string[]>([]);
  const [defaultPrinter, setDefaultPrinter] = useState<string>('');
  const [status, setStatus] = useState<'ready' | 'error'>('ready');

  useEffect(() => {
    if (!isElectron()) return;

    // Get initial printer list
    electronAPI.invoke('system:get-printers').then(printerList => {
      if (Array.isArray(printerList)) {
        setPrinters(printerList.map((p: any) => p.name));
        const defaultPrinter = printerList.find((p: any) => p.isDefault);
        if (defaultPrinter) {
          setDefaultPrinter(defaultPrinter.name);
        }
      }
    });

    // Listen for printer status changes
    const unsubscribe = electronAPI.on('printer-status', (_, printer: any) => {
      setStatus(printer?.status === 'ready' ? 'ready' : 'error');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const setPrinter = useCallback(async (printerName: string) => {
    if (!isElectron()) return false;
    return await electronAPI.invoke('system:set-printer', {
      name: printerName,
      isDefault: true,
    });
  }, []);

  return { printers, defaultPrinter, status, setPrinter };
}

/**
 * Hook for managing window controls (minimize, maximize, close)
 */
export function useWindowControls() {
  const minimize = useCallback(() => {
    if (!isElectron()) return;
    electronAPI.send('window:minimize');
  }, []);

  const maximize = useCallback(() => {
    if (!isElectron()) return;
    electronAPI.send('window:maximize');
  }, []);

  const close = useCallback(() => {
    if (!isElectron()) return;
    electronAPI.send('window:close');
  }, []);

  return { minimize, maximize, close };
}

/**
 * Hook for managing app updates
 */
export function useAppUpdates() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    version: string;
    releaseNotes?: string;
  } | null>(null);

  useEffect(() => {
    if (!isElectron()) return;

    // Check for updates on mount
    electronAPI.invoke('system:check-updates').then(info => {
      if (
        info &&
        typeof info === 'object' &&
        'hasUpdate' in info &&
        (info as any).hasUpdate
      ) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: (info as any).version || 'Unknown',
          releaseNotes: (info as any).releaseNotes,
        });
      }
    });

    // Listen for update notifications
    const unsubscribe = electronAPI.on('system-update-available', (_, info) => {
      setUpdateAvailable(true);
      setUpdateInfo({
        version: (info as any)?.version || 'Unknown',
        releaseNotes: (info as any)?.releaseNotes,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const installUpdate = useCallback(async () => {
    if (!isElectron() || !updateAvailable) return;
    await electronAPI.invoke('system:install-update');
  }, [updateAvailable]);

  return { updateAvailable, updateInfo, installUpdate };
}

/**
 * Hook for managing system information
 */
export function useSystemInfo() {
  const [systemInfo, setSystemInfo] = useState<{
    appVersion: string;
    platform: string;
    arch: string;
    uptime: number;
  } | null>(null);

  useEffect(() => {
    if (!isElectron()) return;

    electronAPI.invoke('system:get-info').then(info => {
      if (info && typeof info === 'object' && 'appVersion' in info) {
        setSystemInfo(info as any);
      }
    });

    const interval = setInterval(async () => {
      const info = await electronAPI.invoke('system:get-info');
      if (info && typeof info === 'object' && 'appVersion' in info) {
        setSystemInfo(info as any);
      }
    }, 60000); // Update every minute

    return () => {
      clearInterval(interval);
    };
  }, []);

  return systemInfo;
}

// Export a default hook that provides access to all Electron functionality
export default function useElectron() {
  return {
    isElectron: isElectron(),
    api: electronAPI,
    useIpcEvent,
    useIpcInvoke,
    useIpcSend,
    useSystemTheme,
    usePrinter,
    useWindowControls,
    useAppUpdates,
    useSystemInfo,
  };
}
