import { logInfo } from '../error-handler';
import { BaseController } from './baseController';

// Unused interfaces removed - this controller delegates to StockController

/**
 * Controller for inventory operations
 */
export class InventoryController extends BaseController {
  constructor() {
    super();
    // this.initialize(); // Removed: StartupManager calls initialize() explicitly
  }

  protected override registerHandlers(): void {
    // This controller should not register any handlers for inventory
    // StockController already handles these channels
    logInfo(
      'InventoryController: No handlers registered, using StockController instead'
    );
  }

  public override unregisterHandlers(): void {
    // Nothing to unregister
    logInfo('InventoryController: No handlers to unregister');
  }
}
