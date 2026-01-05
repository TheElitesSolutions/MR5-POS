/**
 * Base Service for mr5-POS Electron Application
 * Provides standardized patterns for data access, business logic, and error handling
 */
import { logError, logInfo } from '../error-handler';
import { getCurrentLocalDateTime } from '../utils/dateTime';
export class BaseService {
    /**
     * Constructor for BaseService
     * @param prisma The Prisma client instance for database access
     * @param registry The ServiceRegistry instance for service dependencies
     */
    constructor(prisma, registry) {
        this.prisma = prisma;
        this.registry = registry;
        logInfo(`Initializing ${this.constructor.name}...`, 'BaseService');
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
     * Create an error response object
     * @param error The error that occurred
     * @param message Optional error message override
     */
    createErrorResponse(error, message) {
        const errorMessage = message || (error instanceof Error ? error.message : 'Unknown error');
        logError(error instanceof Error ? error : new Error(errorMessage), 'Service Error');
        return {
            success: false,
            error: errorMessage,
            timestamp: getCurrentLocalDateTime(),
        };
    }
    /**
     * Wrap a service method with try/catch and standardized response formatting
     * @param handler The service method to wrap
     */
    wrapMethod(handler) {
        return async (...args) => {
            try {
                const result = await handler(...args);
                return this.createSuccessResponse(result);
            }
            catch (error) {
                return this.createErrorResponse(error);
            }
        };
    }
    /**
     * Execute a database transaction safely
     * @param handler The transaction handler function
     */
    async executeTransaction(handler) {
        return this.prisma.$transaction(async (tx) => {
            return handler(tx);
        });
    }
    /**
     * Validate that an entity exists by ID
     * @param model The Prisma model to query
     * @param id The entity ID to check
     * @param errorMessage Custom error message if not found
     */
    async validateEntityExists(model, id, errorMessage) {
        const entity = await model.findUnique({
            where: { id },
        });
        if (!entity) {
            throw new Error(errorMessage || `Entity with ID ${id} not found`);
        }
        return entity;
    }
    /**
     * Get a service from the registry
     * @param ServiceClass The service class to get
     * @returns The service instance
     */
    getService(ServiceClass) {
        return this.registry.getServiceByClass(ServiceClass);
    }
    /**
     * Clean up resources used by the service
     * This method should be called when the application is shutting down
     */
    cleanup() {
        logInfo(`${this.constructor.name} cleaned up successfully`, 'BaseService');
    }
}
