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
    registerHandlers() {
        // This controller should not register any handlers for inventory
        // StockController already handles these channels
        logInfo('InventoryController: No handlers registered, using StockController instead');
    }
    unregisterHandlers() {
        // Nothing to unregister
        logInfo('InventoryController: No handlers to unregister');
    }
}
