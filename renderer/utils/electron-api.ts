import type { IpcRendererEvent } from 'electron';

// Global Window interface is already declared in types/electron.d.ts

// IPC Readiness state management
class IPCReadinessManager {
  private ready = false;
  private listeners: Array<() => void> = [];
  public initialized = false;
  private initInProgress = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    // Prevent multiple simultaneous initialization attempts
    if (this.initInProgress) {
      console.log('🔄 IPC initialization already in progress, waiting...');
      return new Promise(resolve => {
        const checkInitialized = () => {
          if (this.initialized) {
            resolve();
          } else {
            setTimeout(checkInitialized, 50);
          }
        };
        checkInitialized();
      });
    }

    this.initInProgress = true;
    console.log('🔄 Initializing IPC readiness manager...');

    // Test basic IPC communication first using a safer test method
    console.log('🧪 Testing basic IPC communication...');
    try {
      if (window.electronAPI?.ipc?.invoke) {
        // Use system info call which is safe and doesn't interfere with authentication
        await window.electronAPI.ipc.invoke('mr5pos:system:get-info');
        console.log('✅ IPC test successful - handlers are ready!');
        this.ready = true;
        this.notifyListeners();
        this.initialized = true;
        this.initInProgress = false;
        return;
      }
    } catch (error) {
      console.log('❌ IPC system test failed:', error);
    }

    // Set up listener for the ready signal
    console.log('🔄 Setting up IPC readiness listener...');
    try {
      if (window.electronAPI?.ipc?.on) {
        window.electronAPI.ipc.on('ipc:ready', (data: any) => {
          console.log('📨 Received IPC ready signal:', data);
          this.ready = true;
          this.notifyListeners();
        });
        console.log('✅ IPC readiness listener established');
      }
    } catch (error) {
      console.error('❌ Failed to setup IPC readiness listener:', error);
    }

    this.initialized = true;
    this.initInProgress = false;
  }

  get isReady(): boolean {
    return this.ready;
  }

  async waitForReady(): Promise<boolean> {
    await this.ensureInitialized();

    if (this.ready) {
      return true;
    }

    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        console.warn('⚠️ IPC readiness timeout - assuming handlers are ready');
        this.ready = true;
        resolve(true);
      }, 10000); // 10 second timeout

      this.onReady(() => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  }

  onReady(callback: () => void): void {
    if (this.ready) {
      callback();
    } else {
      this.listeners.push(callback);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
    this.listeners = [];
  }

  // Manual override for testing
  forceReady(): void {
    console.log('🔧 FORCING IPC readiness (manual override)');
    this.ready = true;
    this.notifyListeners();
  }

  // Test specific IPC channel
  async testChannel(channel: string, ...args: any[]): Promise<any> {
    console.log(`🧪 Testing IPC channel: ${channel}`, args);
    try {
      if (window.electronAPI?.ipc?.invoke) {
        const result = await window.electronAPI.ipc.invoke(channel, ...args);
        console.log(`✅ Channel ${channel} test successful:`, result);
        return result;
      } else {
        throw new Error('Electron API not available');
      }
    } catch (error) {
      console.log(`❌ Channel ${channel} test failed:`, error);
      throw error;
    }
  }
}

// Global IPC readiness manager instance (singleton pattern)
let ipcReadinessInstance: IPCReadinessManager | null = null;

function getIPCReadinessManager(): IPCReadinessManager {
  if (!ipcReadinessInstance) {
    // Ensure only one instance exists globally, even if module is imported multiple times
    if (typeof window !== 'undefined' && (window as any).__ipcReadinessManager) {
      ipcReadinessInstance = (window as any).__ipcReadinessManager;
    } else {
      ipcReadinessInstance = new IPCReadinessManager();
      if (typeof window !== 'undefined') {
        (window as any).__ipcReadinessManager = ipcReadinessInstance;
      }
    }
  }
  // TypeScript now knows ipcReadinessInstance cannot be null here
  return ipcReadinessInstance!;
}

const ipcReadiness = getIPCReadinessManager();

// Manual override for testing - expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).forceIpcReady = () => {
    console.log('🔧 MANUAL OVERRIDE: Forcing IPC ready state');
    (ipcReadiness as any)._isReady = true;
    (ipcReadiness as any)._resolveReady(true);
    console.log('✅ IPC forced ready - you can now try login');
  };
}

// Type guard to check if Electron API is available
export function isElectron(): boolean {
  // First check if we're in a browser environment
  if (typeof window === 'undefined') {
    return false;
  }

  const hasElectronAPI = window.electronAPI !== undefined;
  const hasIpcAPI = window.electronAPI?.ipc !== undefined;
  const hasInvokeMethod = window.electronAPI?.ipc?.invoke !== undefined;
  const hasElectronUserAgent = navigator.userAgent.includes('Electron');

  // Must have all API components AND Electron user agent
  const isElectronEnvironment =
    hasElectronAPI && hasIpcAPI && hasInvokeMethod && hasElectronUserAgent;

  if (!isElectronEnvironment) {
    console.warn('⚠️ Not in Electron environment:', {
      missingElectronAPI: !hasElectronAPI,
      missingIpcAPI: !hasIpcAPI,
      missingInvokeMethod: !hasInvokeMethod,
      missingElectronUserAgent: !hasElectronUserAgent,
    });
  }

  return isElectronEnvironment;
}

// Error for when Electron API is not available
export class ElectronAPIUnavailableError extends Error {
  constructor(methodName: string) {
    super(
      `Electron API method '${methodName}' is not available in this environment. Make sure you're running the app with 'npm run electron:dev' or the packaged desktop version.`
    );
    this.name = 'ElectronAPIUnavailableError';
  }
}

// Create a type-safe wrapper around the Electron API
export const electronAPI = {
  /**
   * Debug function to test API availability
   */
  debugAPI: () => {
    console.log('=== RENDERER API DEBUG ===');
    console.log('window.electronAPI:', window.electronAPI);
    console.log('window.electronAPITest:', (window as any).electronAPITest);

    if (window.electronAPI) {
      console.log('electronAPI keys:', Object.keys(window.electronAPI));
      console.log('electronAPI.ipc:', window.electronAPI.ipc);
      if (window.electronAPI.ipc) {
        console.log(
          'electronAPI.ipc keys:',
          Object.keys(window.electronAPI.ipc)
        );
        console.log(
          'electronAPI.ipc.invoke type:',
          typeof window.electronAPI.ipc.invoke
        );
      }
    }

    // Test the preload API test function
    if ((window as any).electronAPITest) {
      try {
        const testResult = (window as any).electronAPITest.test();
        console.log('electronAPITest.test() result:', testResult);
      } catch (error) {
        console.error('electronAPITest.test() error:', error);
      }
    }

    console.log('=== END RENDERER DEBUG ===');
  },

  /**
   * Send a message to the main process (one-way)
   */
  send: (channel: string, ...args: any[]) => {
    if (!isElectron()) {
      console.warn(
        `Electron API 'send' is not available. Channel: ${channel}. Running in browser mode - use 'npm run electron:dev' for desktop functionality.`
      );
      return;
    }
    console.log(`IPC Send: ${channel}`, args);
    window.electronAPI!.ipc.send(channel, ...args);
  },

  /**
   * Call the main process and get a response (two-way)
   * Waits for IPC handlers to be ready before making the call
   */
  invoke: async <T = any>(channel: string, ...args: any[]): Promise<T> => {
    if (!isElectron()) {
      console.error(
        `IPC Invoke failed: ${channel} - Electron API not available`
      );
      throw new ElectronAPIUnavailableError('invoke');
    }

    // Wait for IPC handlers to be ready
    if (!ipcReadiness.isReady) {
      console.log(
        `🔄 Waiting for IPC handlers to be ready before calling ${channel}...`
      );
      await ipcReadiness.waitForReady();
      console.log(`✅ IPC handlers ready, proceeding with ${channel} call`);
    }

    console.log(`IPC Invoke: ${channel}`, args);
    try {
      const result = await window.electronAPI!.ipc.invoke(channel, ...args);
      console.log(`IPC Invoke Result: ${channel}`, result);
      return result;
    } catch (error) {
      console.error(`IPC Invoke Error: ${channel}`, error);
      throw error;
    }
  },

  /**
   * Listen for events from the main process
   * Returns an unsubscribe function
   */
  on: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: any[]) => void
  ): (() => void) => {
    if (!isElectron()) {
      console.warn(
        `Electron API 'on' is not available. Channel: ${channel}. Running in browser mode.`
      );
      return () => {}; // Return empty unsubscribe function
    }
    console.log(`IPC Listen: ${channel}`);
    return window.electronAPI!.ipc.on(channel, listener as any);
  },

  /**
   * Listen for an event from the main process once
   */
  once: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: any[]) => void
  ): void => {
    if (!isElectron()) {
      console.warn(
        `Electron API 'once' is not available. Channel: ${channel}. Running in browser mode.`
      );
      return;
    }
    console.log(`IPC Once: ${channel}`);
    window.electronAPI!.ipc.once(channel, listener as any);
  },

  /**
   * Remove all listeners for a channel
   */
  removeAllListeners: (channel: string): void => {
    if (!isElectron()) {
      console.warn(
        `Electron API 'removeAllListeners' is not available. Channel: ${channel}. Running in browser mode.`
      );
      return;
    }
    console.log(`IPC Remove All Listeners: ${channel}`);
    window.electronAPI!.ipc.removeAllListeners(channel);
  },

  /**
   * Get system version information
   */
  getVersions: (): {
    node: string;
    chrome: string;
    electron: string;
  } | null => {
    if (!isElectron() || !window.versions) {
      console.warn('Electron versions not available - running in browser mode');
      return null;
    }
    return {
      node: window.versions.node(),
      chrome: window.versions.chrome(),
      electron: window.versions.electron(),
    };
  },

  /**
   * Check if running in Electron environment
   */
  isElectronApp: isElectron,

  // Manual testing methods
  forceIpcReady: () => ipcReadiness.forceReady(),
  testIpcChannel: (channel: string, ...args: any[]) =>
    ipcReadiness.testChannel(channel, ...args),
  getIpcStatus: () => ({
    ready: ipcReadiness.isReady,
    initialized: ipcReadiness.initialized,
  }),
};

// Expose manual testing functions globally for debugging
if (typeof window !== 'undefined') {
  (window as any).forceIpcReady = electronAPI.forceIpcReady;
  (window as any).testIpcChannel = electronAPI.testIpcChannel;
  (window as any).getIpcStatus = electronAPI.getIpcStatus;
}

// Export default API
export default electronAPI;
