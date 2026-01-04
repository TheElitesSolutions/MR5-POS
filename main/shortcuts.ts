import { globalShortcut, BrowserWindow } from "electron";
import { logError, logInfo, logDebug } from "./error-handler";
import { getIsDev } from "./utils/environment";

/**
 * Global Shortcuts Manager for mr5-POS Electron Application
 * Manages application-wide keyboard shortcuts and focus handling
 */
class ShortcutManager {
  private shortcuts: Map<string, string> = new Map();
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.setupShortcuts();
  }

  /**
   * Define all global shortcuts for the application
   */
  private setupShortcuts(): void {
    this.shortcuts = new Map();

    // Core POS Operations
    this.shortcuts.set("CmdOrCtrl+N", "New Order");
    this.shortcuts.set("CmdOrCtrl+Q", "Quick Order");
    this.shortcuts.set("CmdOrCtrl+P", "Print Receipt");
    this.shortcuts.set("CmdOrCtrl+Shift+P", "Print Report");
    this.shortcuts.set("CmdOrCtrl+E", "Export Data");

    // Navigation
    this.shortcuts.set("CmdOrCtrl+D", "Dashboard");
    this.shortcuts.set("CmdOrCtrl+T", "POS Terminal");
    this.shortcuts.set("CmdOrCtrl+O", "Orders");
    this.shortcuts.set("CmdOrCtrl+M", "Menu Management");
    this.shortcuts.set("CmdOrCtrl+S", "Stock Management");
    this.shortcuts.set("CmdOrCtrl+X", "Expenses");
    this.shortcuts.set("CmdOrCtrl+R", "Reports");

    // System
    this.shortcuts.set("CmdOrCtrl+,", "Settings");
    this.shortcuts.set("CmdOrCtrl+Shift+D", "Toggle Dark Mode");
    this.shortcuts.set("F11", "Toggle Fullscreen");
    this.shortcuts.set("F12", "Toggle DevTools"); // Enable F12 in all modes

    // Search
    this.shortcuts.set("CmdOrCtrl+F", "Find");
    this.shortcuts.set("CmdOrCtrl+Shift+F", "Find Menu Item");

    // POS Specific
    this.shortcuts.set("CmdOrCtrl+Shift+N", "Take Order");
    this.shortcuts.set("CmdOrCtrl+Shift+T", "View Tables");
    this.shortcuts.set("CmdOrCtrl+Shift+R", "Cash Register");
    this.shortcuts.set("CmdOrCtrl+K", "Kitchen Display");
    this.shortcuts.set("CmdOrCtrl+Shift+S", "Order Status");

    // Development shortcuts (only in dev mode)
    if (getIsDev()) {
      this.shortcuts.set("CmdOrCtrl+Shift+I", "Toggle DevTools");
      this.shortcuts.set("CmdOrCtrl+Shift+J", "Toggle Console");
    }
  }

  /**
   * Register all global shortcuts
   */
  public registerShortcuts(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    let registeredCount = 0;
    let failedCount = 0;

    for (const [accelerator, description] of Array.from(this.shortcuts.entries())) {
      try {
        const success = globalShortcut.register(accelerator, () => {
          this.handleShortcut(accelerator, description);
        });

        if (success) {
          registeredCount++;
          logDebug(
            `Registered shortcut: ${accelerator} (${description})`,
            "ShortcutManager"
          );
        } else {
          failedCount++;
          logError(
            new Error(`Failed to register shortcut: ${accelerator}`),
            "ShortcutManager"
          );
        }
      } catch (error) {
        failedCount++;
        logError(error as Error, `ShortcutManager ${accelerator}`);
      }
    }

    logInfo(
      `Shortcuts registration complete: ${registeredCount} registered, ${failedCount} failed`,
      "ShortcutManager"
    );
  }

  /**
   * Handle shortcut activation
   */
  private handleShortcut(accelerator: string, description: string): void {
    logDebug(
      `Shortcut activated: ${accelerator} (${description})`,
      "ShortcutManager"
    );

    // Ensure the main window is focused and visible
    this.focusMainWindow();

    // Send shortcut event to renderer process
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("global-shortcut", {
        accelerator,
        description,
        timestamp: Date.now(),
      });
    }

    // Handle specific shortcuts at the main process level
    switch (accelerator) {
      case "F11":
        this.toggleFullscreen();
        break;

      case "F12":
      case "CmdOrCtrl+Shift+I":
        this.toggleDevTools();
        break;

      case "CmdOrCtrl+,":
        // Settings window would be handled by menu system
        this.sendToRenderer("menu:open-settings");
        break;

      case "CmdOrCtrl+R":
        this.sendToRenderer("menu:open-reports");
        break;

      default:
        // Most shortcuts are handled by the renderer process
        this.sendToRenderer("shortcut:handle", { accelerator, description });
        break;
    }
  }

  /**
   * Focus and bring main window to front
   */
  private focusMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    try {
      // Restore window if minimized
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }

      // Show window if hidden
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }

      // Focus the window
      this.mainWindow.focus();

      // Bring to front on macOS
      if (process.platform === "darwin") {
        this.mainWindow.moveTop();
      }

      logDebug("Main window focused via shortcut", "ShortcutManager");
    } catch (error) {
      logError(error as Error, "ShortcutManager focusMainWindow");
    }
  }

  /**
   * Toggle fullscreen mode
   */
  private toggleFullscreen(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    try {
      const isFullscreen = this.mainWindow.isFullScreen();
      this.mainWindow.setFullScreen(!isFullscreen);

      logDebug(
        `Fullscreen toggled: ${!isFullscreen ? "ON" : "OFF"}`,
        "ShortcutManager"
      );
    } catch (error) {
      logError(error as Error, "ShortcutManager toggleFullscreen");
    }
  }

  /**
   * Toggle developer tools
   */
  private toggleDevTools(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    try {
      if (this.mainWindow.webContents.isDevToolsOpened()) {
        this.mainWindow.webContents.closeDevTools();
      } else {
        this.mainWindow.webContents.openDevTools({ mode: "bottom" });
      }

      logDebug("DevTools toggled", "ShortcutManager");
    } catch (error) {
      logError(error as Error, "ShortcutManager toggleDevTools");
    }
  }

  /**
   * Send message to renderer process
   */
  private sendToRenderer(channel: string, data?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
      logDebug(`Sent to renderer: ${channel}`, "ShortcutManager");
    }
  }

  /**
   * Unregister all global shortcuts
   */
  public unregisterAllShortcuts(): void {
    try {
      globalShortcut.unregisterAll();
      logInfo("All global shortcuts unregistered", "ShortcutManager");
    } catch (error) {
      logError(error as Error, "ShortcutManager unregisterAll");
    }
  }

  /**
   * Unregister a specific shortcut
   */
  public unregisterShortcut(accelerator: string): void {
    try {
      globalShortcut.unregister(accelerator);
      logDebug(`Unregistered shortcut: ${accelerator}`, "ShortcutManager");
    } catch (error) {
      logError(error as Error, `ShortcutManager unregister ${accelerator}`);
    }
  }

  /**
   * Check if a shortcut is registered
   */
  public isRegistered(accelerator: string): boolean {
    try {
      return globalShortcut.isRegistered(accelerator);
    } catch (error) {
      logError(error as Error, `ShortcutManager isRegistered ${accelerator}`);
      return false;
    }
  }

  /**
   * Get all registered shortcuts
   */
  public getRegisteredShortcuts(): Map<string, string> {
    return new Map(this.shortcuts);
  }

  /**
   * Temporarily disable all shortcuts
   */
  public disableShortcuts(): void {
    for (const [accelerator] of Array.from(this.shortcuts.entries())) {
      this.unregisterShortcut(accelerator);
    }
    logInfo("All shortcuts temporarily disabled", "ShortcutManager");
  }

  /**
   * Re-enable all shortcuts
   */
  public enableShortcuts(): void {
    if (this.mainWindow) {
      this.registerShortcuts(this.mainWindow);
      logInfo("All shortcuts re-enabled", "ShortcutManager");
    }
  }

  /**
   * Add or update a shortcut
   */
  public addShortcut(accelerator: string, description: string): boolean {
    try {
      // Unregister if it already exists
      if (this.isRegistered(accelerator)) {
        this.unregisterShortcut(accelerator);
      }

      const success = globalShortcut.register(accelerator, () => {
        this.handleShortcut(accelerator, description);
      });

      if (success) {
        this.shortcuts.set(accelerator, description);
        logInfo(
          `Added shortcut: ${accelerator} (${description})`,
          "ShortcutManager"
        );
        return true;
      } else {
        logError(
          new Error(`Failed to add shortcut: ${accelerator}`),
          "ShortcutManager"
        );
        return false;
      }
    } catch (error) {
      logError(error as Error, `ShortcutManager addShortcut ${accelerator}`);
      return false;
    }
  }

  /**
   * Remove a shortcut
   */
  public removeShortcut(accelerator: string): void {
    this.unregisterShortcut(accelerator);
    this.shortcuts.delete(accelerator);
    logInfo(`Removed shortcut: ${accelerator}`, "ShortcutManager");
  }

  /**
   * Get shortcuts help text
   */
  public getShortcutsHelp(): string {
    const categories = {
      "Core POS Operations": [
        "CmdOrCtrl+N - New Order",
        "CmdOrCtrl+Q - Quick Order",
        "CmdOrCtrl+P - Print Receipt",
        "CmdOrCtrl+Shift+P - Print Report",
        "CmdOrCtrl+E - Export Data",
      ],
      Navigation: [
        "CmdOrCtrl+D - Dashboard",
        "CmdOrCtrl+T - POS Terminal",
        "CmdOrCtrl+O - Orders",
        "CmdOrCtrl+M - Menu Management",
        "CmdOrCtrl+S - Stock Management",
        "CmdOrCtrl+X - Expenses",
        "CmdOrCtrl+R - Reports",
      ],
      System: [
        "CmdOrCtrl+, - Settings",
        "CmdOrCtrl+Shift+D - Toggle Dark Mode",
        "F11 - Toggle Fullscreen",
        "F12 - Toggle DevTools",
      ],
      Search: ["CmdOrCtrl+F - Find", "CmdOrCtrl+Shift+F - Find Menu Item"],
      "POS Specific": [
        "CmdOrCtrl+Shift+N - Take Order",
        "CmdOrCtrl+Shift+T - View Tables",
        "CmdOrCtrl+Shift+R - Cash Register",
        "CmdOrCtrl+K - Kitchen Display",
        "CmdOrCtrl+Shift+S - Order Status",
      ],
    };

    let helpText = "mr5-POS Keyboard Shortcuts\n\n";

    for (const [category, shortcuts] of Object.entries(categories)) {
      helpText += `${category}:\n`;
      for (const shortcut of shortcuts) {
        helpText += `  ${shortcut}\n`;
      }
      helpText += "\n";
    }

    if (getIsDev()) {
      helpText += "Development:\n";
      helpText += "  CmdOrCtrl+Shift+I - Toggle DevTools\n";
      helpText += "  CmdOrCtrl+Shift+J - Toggle Console\n";
    }

    return helpText;
  }
}

// Create singleton instance
const shortcutManager = new ShortcutManager();

// Export functions for use in main process
export const setupGlobalShortcuts = (mainWindow: BrowserWindow): void => {
  shortcutManager.registerShortcuts(mainWindow);
};

export const unregisterAllShortcuts = (): void => {
  shortcutManager.unregisterAllShortcuts();
};

export const unregisterShortcut = (accelerator: string): void => {
  shortcutManager.unregisterShortcut(accelerator);
};

export const isShortcutRegistered = (accelerator: string): boolean => {
  return shortcutManager.isRegistered(accelerator);
};

export const addGlobalShortcut = (
  accelerator: string,
  description: string
): boolean => {
  return shortcutManager.addShortcut(accelerator, description);
};

export const removeGlobalShortcut = (accelerator: string): void => {
  shortcutManager.removeShortcut(accelerator);
};

export const getShortcutsHelp = (): string => {
  return shortcutManager.getShortcutsHelp();
};

export const disableAllShortcuts = (): void => {
  shortcutManager.disableShortcuts();
};

export const enableAllShortcuts = (): void => {
  shortcutManager.enableShortcuts();
};

export default shortcutManager;
