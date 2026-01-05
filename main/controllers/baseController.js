/**
 * Base Controller for mr5-POS Electron Application
 * Provides standardized patterns for IPC communication, error handling, and logging
 */
import { ipcMain } from 'electron';
import { logError, logInfo } from '../error-handler';
import { getCurrentLocalDateTime } from '../utils/dateTime';
/**
 * Base controller class
 */
export class BaseController {
    constructor() {
        this.handlers = new Map();
    }
    /**
     * Unregister all IPC handlers for the controller
     * This method should be implemented by each controller to clean up its handlers
     */
    unregisterHandlers() {
        for (const [channel] of Array.from(this.handlers)) {
            ipcMain.removeHandler(channel);
            logInfo(`Unregistered handler for channel: ${channel}`, this.constructor.name);
        }
        this.handlers.clear();
    }
    /**
     * Unregister a specific IPC handler
     * @param channel The IPC channel to unregister
     */
    unregisterHandler(channel) {
        if (this.handlers.has(channel)) {
            ipcMain.removeHandler(channel);
            this.handlers.delete(channel);
            logInfo(`Unregistered handler for channel: ${channel}`, this.constructor.name);
        }
    }
    /**
     * Helper method to safely register an IPC handler with proper error handling and type safety
     * @param channel The IPC channel to handle
     * @param handler The handler function
     */
    registerHandler(channel, handler) {
        if (!this.handlers.has(channel)) {
            ipcMain.handle(channel, handler);
            this.handlers.set(channel, handler);
            logInfo(`Registered handler for channel: ${channel}`, this.constructor.name);
        }
        else {
            logError(`Handler already registered for channel: ${channel}`, this.constructor.name);
        }
    }
    /**
     * Create a successful response object
     * @param data The data to include in the response
     * @param message Optional success message
     */
    createSuccessResponse(data, message) {
        const response = {
            success: true,
            data,
            timestamp: getCurrentLocalDateTime(),
        };
        if (message) {
            response.message = message;
        }
        return response;
    }
    /**
     * Create an error response
     * @param error Error object or message
     * @returns Error response
     */
    createErrorResponse(error) {
        const errorMessage = error instanceof Error ? error.message : error;
        logError(error, this.constructor.name);
        return {
            success: false,
            error: errorMessage,
            timestamp: getCurrentLocalDateTime(),
        };
    }
    /**
     * Wrap a handler function with error handling
     * @param handler Handler function to wrap
     * @returns Wrapped handler function
     */
    wrapHandler(handler) {
        return async (_event, ...args) => {
            try {
                const result = await handler(...args);
                return this.createSuccessResponse(result);
            }
            catch (error) {
                return this.createErrorResponse(error instanceof Error ? error : String(error));
            }
        };
    }
    /**
     * Initialize the controller
     * This method should be called in the constructor of each controller
     */
    initialize() {
        try {
            logInfo(`Initializing ${this.constructor.name}...`);
            this.registerHandlers();
            logInfo(`${this.constructor.name} initialized successfully`);
        }
        catch (error) {
            logError(error instanceof Error
                ? error
                : new Error(`Unknown error initializing ${this.constructor.name}`), `Failed to initialize ${this.constructor.name}`);
            throw error;
        }
    }
    /**
     * Clean up the controller
     * This method should be called when the application is shutting down
     */
    cleanup() {
        try {
            this.unregisterHandlers();
            logInfo(`${this.constructor.name} cleaned up successfully`);
        }
        catch (error) {
            logError(error instanceof Error
                ? error
                : new Error(`Unknown error cleaning up ${this.constructor.name}`), `Failed to clean up ${this.constructor.name}`);
        }
    }
}
