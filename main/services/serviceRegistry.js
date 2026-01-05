/**
 * Service Registry for mr5-POS Electron Application
 * Manages service instances and dependencies
 */
import { logInfo } from '../error-handler';
/**
 * Service Registry class
 * Singleton registry for managing service instances
 */
export class ServiceRegistry {
    /**
     * Get singleton instance
     * @param prisma The Prisma client instance
     * @returns The ServiceRegistry instance
     */
    static getInstance(prisma) {
        if (!ServiceRegistry.instance) {
            ServiceRegistry.instance = new ServiceRegistry(prisma);
        }
        return ServiceRegistry.instance;
    }
    /**
     * Private constructor for singleton pattern
     * @param prisma The Prisma client instance
     */
    constructor(prisma) {
        this.services = new Map();
        this.prismaClient = prisma;
    }
    /**
     * Register a service
     * @param ServiceClass The service class to register
     * @returns The service instance
     */
    registerService(ServiceClass) {
        const serviceName = ServiceClass.name;
        // Check if service already exists
        if (this.services.has(serviceName)) {
            return this.services.get(serviceName);
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
    getService(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) {
            throw new Error(`Service not found: ${serviceName}`);
        }
        return service;
    }
    /**
     * Get a service by class reference (minification-safe)
     * @param ServiceClass The service class constructor
     * @returns The service instance
     */
    getServiceByClass(ServiceClass) {
        const serviceName = ServiceClass.name;
        const service = this.services.get(serviceName);
        if (!service) {
            throw new Error(`Service not found: ${serviceName}`);
        }
        return service;
    }
    /**
     * Get all registered services
     * @returns Array of registered services
     */
    getAllServices() {
        return Array.from(this.services.values());
    }
    /**
     * Check if a service is registered
     * @param serviceName The name of the service to check
     * @returns True if the service is registered
     */
    hasService(serviceName) {
        return this.services.has(serviceName);
    }
    /**
     * Unregister a service
     * @param serviceName The name of the service to unregister
     */
    unregisterService(serviceName) {
        if (this.services.has(serviceName)) {
            this.services.delete(serviceName);
            logInfo(`Unregistered service: ${serviceName}`, 'ServiceRegistry');
        }
    }
    /**
     * Clear all registered services
     */
    clearServices() {
        this.services.clear();
        logInfo('Cleared all services', 'ServiceRegistry');
    }
}
