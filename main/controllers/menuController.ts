import { PrismaClient } from '../prisma';
import { logInfo } from '../error-handler';
import { BaseController } from './baseController';

/**
 * Menu controller
 *
 * IMPORTANT: This is now a legacy class that serves as a compatibility layer.
 * All menu functionality has been moved to MenuItemController.
 * This class is kept to maintain backward compatibility with existing code that
 * might still reference MenuController directly.
 *
 * New code should use MenuItemController directly.
 */
export class MenuController extends BaseController {
  constructor(_prisma: PrismaClient) {
    super();
    logInfo(
      'MenuController (Legacy): Created as wrapper for MenuItemController'
    );
    // this.initialize(); // Removed: StartupManager calls initialize() explicitly
  }

  /**
   * Initialize controller
   */
  public override initialize(): void {
    super.initialize();
    logInfo('MenuController (Legacy): Initialized as compatibility wrapper');
  }

  /**
   * Register handlers for IPC communication
   */
  protected registerHandlers(): void {
    // This controller should not register any handlers
    // MenuItemController already handles all menu-related IPC channels
    logInfo(
      'MenuController (Legacy): No handlers registered, using MenuItemController instead'
    );
  }

  /**
   * Unregister all handlers
   */
  public override unregisterHandlers(): void {
    // Nothing to unregister since this controller doesn't register any handlers
    logInfo('MenuController (Legacy): No handlers to unregister');
  }
}
