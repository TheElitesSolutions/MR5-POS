import { IpcRendererEvent } from 'electron';
import type { IPCChannels, IPCEvents } from '../../shared/ipc-channels';

declare global {
  interface Window {
    /**
     * Electron's API exposed through the preload script
     */
    electronAPI?: {
      // System information
      system: {
        platform: string;
        getEnvironmentInfo: () => Promise<any>;
        getSystemCapabilities: () => Promise<any>;
      };

      // IPC Communication
      ipc: {
        /**
         * Send a one-way message to the main process
         */
        send: <K extends keyof IPCChannels>(
          channel: K,
          ...args: Parameters<IPCChannels[K]>
        ) => void;

        /**
         * Call the main process and expect a response
         */
        invoke: <K extends keyof IPCChannels>(
          channel: K,
          ...args: Parameters<IPCChannels[K]>
        ) => ReturnType<IPCChannels[K]>;

        /**
         * Listen for events from the main process
         * Returns an unsubscribe function
         */
        on: <K extends keyof IPCEvents>(
          channel: K,
          listener: (
            event: IpcRendererEvent,
            ...args: Parameters<IPCEvents[K]>
          ) => void
        ) => () => void;

        /**
         * Listen for an event from the main process once
         */
        once: <K extends keyof IPCEvents>(
          channel: K,
          listener: (
            event: IpcRendererEvent,
            ...args: Parameters<IPCEvents[K]>
          ) => void
        ) => void;

        /**
         * Remove all listeners for a channel
         */
        removeAllListeners: (channel: string) => void;

        /**
         * Remove specific listener
         */
        removeListener: (
          channel: string,
          callback: (...args: any[]) => void
        ) => void;
      };

      // Application control
      app: {
        getVersion: () => string;
        getName: () => string;
        quit: () => Promise<{ success: boolean; error?: string }>;
        restart: () => void;
        minimize: () => void;
        maximize: () => void;
        unmaximize: () => void;
        close: () => void;
        isMaximized: () => Promise<boolean>;
        toggleFullscreen: () => void;
        isFullscreen: () => Promise<boolean>;
        showDevTools: () => void;
        hideDevTools: () => void;
      };

      // File system operations (limited and secure)
      file: {
        selectFile: (options?: any) => Promise<string | null>;
        selectFolder: (options?: any) => Promise<string | null>;
        saveFile: (options?: any) => Promise<string | null>;
        openExternal: (url: string) => Promise<void>;
        showItemInFolder: (path: string) => void;
      };

      // Database operations (through IPC)
      database: {
        query: (sql: string, params?: any[]) => Promise<any>;
        execute: (sql: string, params?: any[]) => Promise<any>;
        getInfo: () => Promise<any>;
        backup: () => Promise<string>;
        restore: (backupPath: string) => Promise<boolean>;
      };

      // Print operations
      print: {
        receipt: (data: any) => Promise<boolean>;
        report: (data: any) => Promise<boolean>;
        getDefaultPrinter: () => Promise<string>;
        getPrinters: () => Promise<any[]>;
        setPrinter: (printerName: string) => Promise<boolean>;
      };

      // Notifications
      notification: {
        show: (title: string, body: string, options?: any) => void;
        showError: (title: string, body: string) => void;
        showWarning: (title: string, body: string) => void;
        showInfo: (title: string, body: string) => void;
      };

      // Storage operations
      storage: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<boolean>;
        remove: (key: string) => Promise<boolean>;
        clear: () => Promise<boolean>;
        getAll: () => Promise<Record<string, any>>;
      };

      // Menu operations
      menu: {
        showContextMenu: (template: any[]) => void;
        updateMenuState: (state: any) => void;
      };

      // Window operations
      window: {
        openSettings: () => void;
        openReports: () => void;
        openAbout: () => void;
        setTitle: (title: string) => void;
        flashFrame: (flag: boolean) => void;
        setProgressBar: (progress: number) => void;
      };

      // Shortcuts
      shortcuts: {
        register: (
          accelerator: string,
          description: string
        ) => Promise<boolean>;
        unregister: (accelerator: string) => Promise<boolean>;
        getRegistered: () => Promise<Record<string, string>>;
        getHelp: () => Promise<string>;
      };

      // Security and validation
      security: {
        validateInput: (input: string, type: string) => boolean;
        sanitizeHtml: (html: string) => string;
        hashPassword: (password: string) => Promise<string>;
        verifyPassword: (password: string, hash: string) => Promise<boolean>;
      };

      // Development utilities (only in development)
      dev?: {
        reload: () => void;
        toggleDevTools: () => void;
        clearCache: () => void;
        getElectronVersion: () => string;
        logToMain: (level: string, message: string) => void;
      };
    };

    /**
     * Auto-updater API exposed through the preload script
     */
    electron?: {
      updater: {
        getStatus: () => Promise<any>;
        onUpdateChecking: (callback: () => void) => void;
        onUpdateAvailable: (callback: (info: any) => void) => void;
        onUpdateNotAvailable: (callback: () => void) => void;
        onDownloadProgress: (callback: (progress: { percent: number }) => void) => void;
        onUpdateDownloaded: (callback: (info: any) => void) => void;
        onUpdateError: (callback: (error: { message: string }) => void) => void;
        downloadUpdate: () => Promise<void>;
        installUpdate: () => Promise<void>;
        skipVersion: (version: string) => Promise<void>;
      };
      diagnostic: {
        runDatabaseDiagnostics: () => Promise<any>;
        createAdminUser: () => Promise<any>;
      };
    };

    /**
     * Version information exposed through the preload script
     */
    versions?: {
      /**
       * Get Node.js version
       */
      node: () => string;

      /**
       * Get Chromium version
       */
      chrome: () => string;

      /**
       * Get Electron version
       */
      electron: () => string;
    };
  }
}
