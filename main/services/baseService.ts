/**
 * Base Service for mr5-POS Electron Application
 * Provides standardized patterns for data access, business logic, and error handling
 */

import { logError, logInfo } from '../error-handler';
import { ExtendedPrismaClient } from '../prisma';
import { IPCResponse } from '../types';
import { ServiceRegistry } from './serviceRegistry';
import { getCurrentLocalDateTime } from '../utils/dateTime';

export abstract class BaseService {
  /**
   * Constructor for BaseService
   * @param prisma The Prisma client instance for database access
   * @param registry The ServiceRegistry instance for service dependencies
   */
  constructor(
    protected prisma: ExtendedPrismaClient,
    protected registry: ServiceRegistry
  ) {
    logInfo(`Initializing ${this.constructor.name}...`, 'BaseService');
  }

  /**
   * Create a successful response object
   * @param data The data to include in the response
   * @param message Optional success message
   */
  protected createSuccessResponse<T>(
    data: T,
    message?: string
  ): IPCResponse<T> {
    const response: IPCResponse<T> = {
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
  protected createErrorResponse<T>(
    error: unknown,
    message?: string
  ): IPCResponse<T> {
    const errorMessage =
      message || (error instanceof Error ? error.message : 'Unknown error');

    logError(
      error instanceof Error ? error : new Error(errorMessage),
      'Service Error'
    );

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
  protected wrapMethod<T, Args extends any[]>(
    handler: (...args: Args) => Promise<T>
  ): (...args: Args) => Promise<IPCResponse<T>> {
    return async (...args: Args): Promise<IPCResponse<T>> => {
      try {
        const result = await handler(...args);
        return this.createSuccessResponse(result);
      } catch (error) {
        return this.createErrorResponse<T>(error);
      }
    };
  }

  /**
   * Execute a database transaction safely
   * @param handler The transaction handler function
   */
  protected async executeTransaction<T>(
    handler: (tx: ExtendedPrismaClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(async tx => {
      return handler(tx as ExtendedPrismaClient);
    });
  }

  /**
   * Validate that an entity exists by ID
   * @param model The Prisma model to query
   * @param id The entity ID to check
   * @param errorMessage Custom error message if not found
   */
  protected async validateEntityExists<T>(
    model: any,
    id: string,
    errorMessage?: string
  ): Promise<T> {
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
  protected getService<T extends BaseService>(
    ServiceClass: new (...args: any[]) => T
  ): T {
    return this.registry.getServiceByClass(ServiceClass as any);
  }

  /**
   * Clean up resources used by the service
   * This method should be called when the application is shutting down
   */
  public cleanup(): void {
    logInfo(`${this.constructor.name} cleaned up successfully`, 'BaseService');
  }
}
