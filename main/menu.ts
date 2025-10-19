import { Menu, MenuItem, BrowserWindow, dialog, shell, app } from "electron";
import { logInfo, logDebug } from "./error-handler";
import { getIsDev, getEnvironmentInfo } from "./utils/environment";

/**
 * Application Menu Manager for mr5-POS Electron Application
 * Creates platform-specific menus with keyboard shortcuts and IPC integration
 */
class ApplicationMenu {
  private mainWindow: BrowserWindow;
  private menu: Menu | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Create and set the application menu
   */
  public createMenu(): Menu {
    const template = this.getMenuTemplate();
    this.menu = Menu.buildFromTemplate(template);

    // Set the application menu
    Menu.setApplicationMenu(this.menu);

    logInfo("Application menu created and set", "ApplicationMenu");
    return this.menu;
  }

  /**
   * Get platform-specific menu template
   */
  private getMenuTemplate(): Electron.MenuItemConstructorOptions[] {
    const isMac = process.platform === "darwin";

    const template: Electron.MenuItemConstructorOptions[] = [
      // macOS specific app menu
      ...(isMac
        ? [
            {
              label: app.getName(),
              submenu: [
                { role: "about" as const },
                { type: "separator" as const },
                {
                  label: "Preferences...",
                  accelerator: "CmdOrCtrl+,",
                  click: () => this.openSettings(),
                },
                { type: "separator" as const },
                { role: "services" as const },
                { type: "separator" as const },
                { role: "hide" as const },
                { role: "hideOthers" as const },
                { role: "unhide" as const },
                { type: "separator" as const },
                { role: "quit" as const },
              ],
            },
          ]
        : []),

      // File menu
      {
        label: "File",
        submenu: [
          {
            label: "New Order",
            accelerator: "CmdOrCtrl+N",
            click: () => this.sendToRenderer("menu:new-order"),
          },
          {
            label: "Quick Order",
            accelerator: "CmdOrCtrl+Q",
            click: () => this.sendToRenderer("menu:quick-order"),
          },
          { type: "separator" },
          {
            label: "Print Receipt",
            accelerator: "CmdOrCtrl+P",
            click: () => this.sendToRenderer("menu:print-receipt"),
          },
          {
            label: "Print Report",
            accelerator: "CmdOrCtrl+Shift+P",
            click: () => this.sendToRenderer("menu:print-report"),
          },
          { type: "separator" },
          {
            label: "Export Data",
            accelerator: "CmdOrCtrl+E",
            submenu: [
              {
                label: "Export Orders (CSV)",
                click: () => this.sendToRenderer("menu:export-orders"),
              },
              {
                label: "Export Menu (JSON)",
                click: () => this.sendToRenderer("menu:export-menu"),
              },
              {
                label: "Export All Data",
                click: () => this.sendToRenderer("menu:export-all"),
              },
            ],
          },
          { type: "separator" },
          ...(!isMac
            ? [
                {
                  label: "Preferences...",
                  accelerator: "CmdOrCtrl+,",
                  click: () => this.openSettings(),
                },
                { type: "separator" as const },
                { role: "quit" as const },
              ]
            : []),
        ],
      },

      // Edit menu
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
          { type: "separator" },
          {
            label: "Find",
            accelerator: "CmdOrCtrl+F",
            click: () => this.sendToRenderer("menu:find"),
          },
          {
            label: "Find Menu Item",
            accelerator: "CmdOrCtrl+Shift+F",
            click: () => this.sendToRenderer("menu:find-menu-item"),
          },
        ],
      },

      // View menu
      {
        label: "View",
        submenu: [
          {
            label: "Dashboard",
            accelerator: "CmdOrCtrl+D",
            click: () => this.sendToRenderer("menu:navigate", "/dashboard"),
          },
          {
            label: "POS Terminal",
            accelerator: "CmdOrCtrl+T",
            click: () => this.sendToRenderer("menu:navigate", "/pos"),
          },
          {
            label: "Orders",
            accelerator: "CmdOrCtrl+O",
            click: () => this.sendToRenderer("menu:navigate", "/orders"),
          },
          {
            label: "Menu Management",
            accelerator: "CmdOrCtrl+M",
            click: () => this.sendToRenderer("menu:navigate", "/menu"),
          },
          {
            label: "Stock Management",
            accelerator: "CmdOrCtrl+S",
            click: () => this.sendToRenderer("menu:navigate", "/stock"),
          },
          {
            label: "Expenses",
            accelerator: "CmdOrCtrl+X",
            click: () => this.sendToRenderer("menu:navigate", "/expenses"),
          },
          { type: "separator" },
          {
            label: "Reports",
            accelerator: "CmdOrCtrl+R",
            click: () => this.openReports(),
          },
          { type: "separator" },
          {
            label: "Toggle Dark Mode",
            accelerator: "CmdOrCtrl+Shift+D",
            click: () => this.sendToRenderer("menu:toggle-theme"),
          },
          {
            label: "Toggle Fullscreen",
            accelerator: process.platform === "darwin" ? "Ctrl+Cmd+F" : "F11",
            click: () => {
              const isFullscreen = this.mainWindow.isFullScreen();
              this.mainWindow.setFullScreen(!isFullscreen);
            },
          },
          { type: "separator" },
          {
            label: "Zoom In",
            accelerator: "CmdOrCtrl+Plus",
            click: () => {
              const webContents = this.mainWindow.webContents;
              webContents.setZoomFactor(webContents.getZoomFactor() + 0.1);
            },
          },
          {
            label: "Zoom Out",
            accelerator: "CmdOrCtrl+-",
            click: () => {
              const webContents = this.mainWindow.webContents;
              webContents.setZoomFactor(webContents.getZoomFactor() - 0.1);
            },
          },
          {
            label: "Reset Zoom",
            accelerator: "CmdOrCtrl+0",
            click: () => {
              this.mainWindow.webContents.setZoomFactor(1.0);
            },
          },
          { type: "separator" },
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
        ],
      },

      // POS menu
      {
        label: "POS",
        submenu: [
          {
            label: "Take Order",
            accelerator: "CmdOrCtrl+Shift+N",
            click: () => this.sendToRenderer("pos:take-order"),
          },
          {
            label: "View Tables",
            accelerator: "CmdOrCtrl+Shift+T",
            click: () => this.sendToRenderer("pos:view-tables"),
          },
          {
            label: "Cash Register",
            accelerator: "CmdOrCtrl+Shift+R",
            click: () => this.sendToRenderer("pos:cash-register"),
          },
          { type: "separator" },
          {
            label: "Kitchen Display",
            accelerator: "CmdOrCtrl+K",
            click: () => this.sendToRenderer("pos:kitchen-display"),
          },
          {
            label: "Order Status",
            accelerator: "CmdOrCtrl+Shift+S",
            click: () => this.sendToRenderer("pos:order-status"),
          },
          { type: "separator" },
          {
            label: "End of Day Report",
            click: () => this.sendToRenderer("pos:end-of-day"),
          },
        ],
      },

      // Window menu
      {
        label: "Window",
        submenu: [
          { role: "minimize" },
          { role: "close" },
          { type: "separator" },
          {
            label: "Settings",
            accelerator: "CmdOrCtrl+,",
            click: () => this.openSettings(),
          },
          {
            label: "Reports",
            accelerator: "CmdOrCtrl+Shift+R",
            click: () => this.openReports(),
          },
          { type: "separator" },
          ...(isMac
            ? [
                { role: "front" as const },
                { type: "separator" as const },
                { role: "window" as const },
              ]
            : [{ role: "close" as const }]),
        ],
      },

      // Help menu
      {
        label: "Help",
        submenu: [
          {
            label: "Keyboard Shortcuts",
            accelerator: "CmdOrCtrl+?",
            click: () => this.showKeyboardShortcuts(),
          },
          {
            label: "User Guide",
            click: () => shell.openExternal("https://docs.mr5pos.com"),
          },
          {
            label: "Report Issue",
            click: () =>
              shell.openExternal("https://github.com/mr5pos/mr5-pos/issues"),
          },
          { type: "separator" },
          {
            label: "Check for Updates",
            click: () => this.checkForUpdates(),
          },
          { type: "separator" },
          ...(!isMac
            ? [
                {
                  label: "About mr5-POS",
                  click: () => this.showAboutDialog(),
                },
              ]
            : []),
        ],
      },
    ];

    return template;
  }

  /**
   * Send message to renderer process
   */
  private sendToRenderer(channel: string, data?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
      logDebug(`Sent message to renderer: ${channel}`, "ApplicationMenu");
    }
  }

  /**
   * Open settings in main window
   */
  private openSettings(): void {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('navigate-to', '/settings');
        this.mainWindow.focus();
        logInfo("Navigated to settings", "ApplicationMenu");
      }
    } catch (error) {
      logInfo(`Failed to navigate to settings: ${error}`, "ApplicationMenu");
    }
  }

  /**
   * Open reports in main window
   */
  private openReports(): void {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('navigate-to', '/reports');
        this.mainWindow.focus();
        logInfo("Navigated to reports", "ApplicationMenu");
      }
    } catch (error) {
      logInfo(`Failed to navigate to reports: ${error}`, "ApplicationMenu");
    }
  }

  /**
   * Show keyboard shortcuts dialog
   */
  private showKeyboardShortcuts(): void {
    const shortcuts = [
      { action: "New Order", shortcut: "Ctrl+N" },
      { action: "Quick Order", shortcut: "Ctrl+Q" },
      { action: "Print Receipt", shortcut: "Ctrl+P" },
      { action: "Export Data", shortcut: "Ctrl+E" },
      { action: "Find", shortcut: "Ctrl+F" },
      { action: "Dashboard", shortcut: "Ctrl+D" },
      { action: "POS Terminal", shortcut: "Ctrl+T" },
      { action: "Orders", shortcut: "Ctrl+O" },
      { action: "Menu Management", shortcut: "Ctrl+M" },
      { action: "Stock Management", shortcut: "Ctrl+S" },
      { action: "Expenses", shortcut: "Ctrl+X" },
      { action: "Reports", shortcut: "Ctrl+R" },
      { action: "Settings", shortcut: "Ctrl+," },
      { action: "Toggle Dark Mode", shortcut: "Ctrl+Shift+D" },
      { action: "Toggle Fullscreen", shortcut: "F11" },
      { action: "Zoom In", shortcut: "Ctrl+Plus" },
      { action: "Zoom Out", shortcut: "Ctrl+-" },
      { action: "Reset Zoom", shortcut: "Ctrl+0" },
    ];

    const shortcutText = shortcuts
      .map((s) => `${s.action}: ${s.shortcut}`)
      .join("\n");

    dialog.showMessageBox(this.mainWindow, {
      type: "info",
      title: "Keyboard Shortcuts",
      message: "mr5-POS Keyboard Shortcuts",
      detail: shortcutText,
      buttons: ["OK"],
      defaultId: 0,
    });
  }

  /**
   * Check for application updates
   */
  private checkForUpdates(): void {
    // This would integrate with electron-updater in production
    dialog.showMessageBox(this.mainWindow, {
      type: "info",
      title: "Updates",
      message: "Check for Updates",
      detail: "You are running the latest version of mr5-POS.",
      buttons: ["OK"],
      defaultId: 0,
    });
  }

  /**
   * Show about dialog
   */
  private showAboutDialog(): void {
    const envInfo = getEnvironmentInfo();

    const aboutText = [
      `Version: ${envInfo.appVersion}`,
      `Platform: ${envInfo.platform} ${envInfo.arch}`,
      `Electron: ${envInfo.electronVersion}`,
      `Node: ${envInfo.nodeVersion}`,
      `Chrome: ${envInfo.chromeVersion}`,
      "",
      "© 2024 mr5-POS. All rights reserved.",
      "",
      "A modern Point of Sale system built with Electron.",
    ].join("\n");

    dialog.showMessageBox(this.mainWindow, {
      type: "info",
      title: "About mr5-POS",
      message: "mr5-POS Desktop",
      detail: aboutText,
      buttons: ["OK"],
      defaultId: 0,
    });
  }

  /**
   * Update menu state based on application state
   */
  public updateMenuState(state: any): void {
    // This could be used to enable/disable menu items based on app state
    // For example, disable "Print Receipt" if no order is selected
    logDebug("Menu state updated", "ApplicationMenu");
  }

  /**
   * Get the current menu
   */
  public getMenu(): Menu | null {
    return this.menu;
  }
}

// Export function to create application menu
export const createApplicationMenu = (mainWindow: BrowserWindow): Menu => {
  const appMenu = new ApplicationMenu(mainWindow);
  return appMenu.createMenu();
};

export default ApplicationMenu;
