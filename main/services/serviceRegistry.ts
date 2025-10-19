/**
 * Service Registry for mr5-POS Electron Application
 * Manages service instances and dependencies
 */

import { logInfo } from '../error-handler';
import { ExtendedPrismaClient } from '../prisma';
import { BaseService } from './baseService';

/**
 * Service constructor type
 */
type ServiceConstructor<T extends BaseService> = new (
  prisma: ExtendedPrismaClient,
  registry: ServiceRegistry
) => T;

/**
 * Service Registry class
 * Singleton registry for managing service instances
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, BaseService> = new Map();
  private prismaClient: ExtendedPrismaClient;

  /**
   * Get singleton instance
   * @param prisma The Prisma client instance
   * @returns The ServiceRegistry instance
   */
  public static getInstance(prisma: ExtendedPrismaClient): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry(prisma);
    }
    return ServiceRegistry.instance;
  }

  /**
   * Private constructor for singleton pattern
   * @param prisma The Prisma client instance
   */
  private constructor(prisma: ExtendedPrismaClient) {
    this.prismaClient = prisma;
  }

  /**
   * Register a service
   * @param ServiceClass The service class to register
   * @returns The service instance
   */
  public registerService<T extends BaseService>(
    ServiceClass: ServiceConstructor<T>
  ): T {
    const serviceName = ServiceClass.name;

    // Check if service already exists
    if (this.services.has(serviceName)) {
      return this.services.get(serviceName) as T;
    }

    // Create new service instance
    logInfo(`Registering service: ${serviceName}`, 'ServiceRegistry');
    const service = new ServiceClass(this.prismaClient, this);
    this.services.set(serviceName, service);

    return service;
  }

  /**
   * Get a service by name
   * @param serviceName The name of the service to get
   * @returns The service instance
   */
  public getService<T extends BaseService>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }
    return service as T;
  }

  /**
   * Get a service by class reference (minification-safe)
   * @param ServiceClass The service class constructor
   * @returns The service instance
   */
  public getServiceByClass<T extends BaseService>(
    ServiceClass: ServiceConstructor<T>
  ): T {
    const serviceName = ServiceClass.name;
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }
    return service as T;
  }

  /**
   * Get all registered services
   * @returns Array of registered services
   */
  public getAllServices(): BaseService[] {
    return Array.from(this.services.values());
  }

  /**
   * Check if a service is registered
   * @param serviceName The name of the service to check
   * @returns True if the service is registered
   */
  public hasService(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  /**
   * Unregister a service
   * @param serviceName The name of the service to unregister
   */
  public unregisterService(serviceName: string): void {
    if (this.services.has(serviceName)) {
      this.services.delete(serviceName);
      logInfo(`Unregistered service: ${serviceName}`, 'ServiceRegistry');
    }
  }

  /**
   * Clear all registered services
   */
  public clearServices(): void {
    this.services.clear();
    logInfo('Cleared all services', 'ServiceRegistry');
  }
}
