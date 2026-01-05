/**
 * Service Container - Dependency Injection and Service Management
 *
 * This container provides:
 * 1. Centralized service management and dependency injection
 * 2. Singleton pattern for shared services
 * 3. Service lifecycle management
 * 4. Configuration and environment-based service setup
 * 5. Service health monitoring and diagnostics
 */
import { RequestManager } from './core/RequestManager';
import { MenuService } from './domain/MenuService';
import { StockService } from './domain/StockService';
export class ServiceContainer {
    constructor(config = {}) {
        // Core infrastructure
        this.requestManager = null;
        // Domain services
        this.menuService = null;
        this.stockService = null;
        // Health monitoring
        this.healthChecks = new Map();
        this.healthCheckInterval = null;
        this.config = {
            enableAnalytics: true,
            enableCaching: true,
            logLevel: 'info',
            environment: 'development',
            ...config,
        };
        this.log('info', 'ServiceContainer initialized with config:', this.config);
        this.startHealthMonitoring();
    }
    /**
     * Get singleton instance
     */
    static getInstance(config) {
        if (!ServiceContainer.instance) {
            ServiceContainer.instance = new ServiceContainer(config);
        }
        return ServiceContainer.instance;
    }
    /**
     * Reset singleton (useful for testing)
     */
    static reset() {
        if (ServiceContainer.instance) {
            ServiceContainer.instance.cleanup();
            ServiceContainer.instance = null;
        }
    }
    /**
     * Get or create RequestManager
     */
    getRequestManager() {
        if (!this.requestManager) {
            this.log('info', 'Creating RequestManager instance');
            this.requestManager = new RequestManager();
            this.registerHealthCheck('requestManager', () => this.checkRequestManagerHealth());
        }
        return this.requestManager;
    }
    /**
     * Get or create MenuService
     */
    getMenuService() {
        if (!this.menuService) {
            this.log('info', 'Creating MenuService instance');
            const requestManager = this.getRequestManager();
            this.menuService = new MenuService(requestManager);
            this.registerHealthCheck('menuService', () => this.checkMenuServiceHealth());
        }
        return this.menuService;
    }
    /**
     * Get or create StockService
     */
    getStockService() {
        if (!this.stockService) {
            this.log('info', 'Creating StockService instance');
            const requestManager = this.getRequestManager();
            this.stockService = new StockService(requestManager);
            this.registerHealthCheck('stockService', () => this.checkStockServiceHealth());
        }
        return this.stockService;
    }
    /**
     * Initialize all services (useful for prefetching)
     */
    async initializeServices() {
        this.log('info', 'Initializing all services...');
        try {
            // Initialize core infrastructure
            this.getRequestManager();
            // Initialize domain services
            const menuService = this.getMenuService();
            const stockService = this.getStockService();
            // Prefetch critical data if caching is enabled
            if (this.config.enableCaching) {
                this.log('info', 'Prefetching critical data...');
                await Promise.allSettled([
                    menuService.prefetchMenuData(),
                    stockService.prefetchStockData(),
                ]);
            }
            this.log('info', 'All services initialized successfully');
        }
        catch (error) {
            this.log('error', 'Failed to initialize services:', error);
            throw error;
        }
    }
    /**
     * Get service health status
     */
    getServiceHealth() {
        return new Map(this.healthChecks);
    }
    /**
     * Get overall system health
     */
    getOverallHealth() {
        const services = Array.from(this.healthChecks.values());
        const healthy = services.filter(s => s.status === 'healthy').length;
        const degraded = services.filter(s => s.status === 'degraded').length;
        const unhealthy = services.filter(s => s.status === 'unhealthy').length;
        let status = 'healthy';
        if (unhealthy > 0) {
            status = 'unhealthy';
        }
        else if (degraded > 0) {
            status = 'degraded';
        }
        return {
            status,
            services: services.length,
            healthy,
            degraded,
            unhealthy,
        };
    }
    /**
     * Get comprehensive diagnostics
     */
    getDiagnostics() {
        const diagnostics = {
            config: this.config,
            health: this.getOverallHealth(),
            services: Object.fromEntries(this.healthChecks),
            timestamp: new Date().toISOString(),
        };
        // Add request manager metrics if available
        if (this.requestManager) {
            diagnostics.requestManager = {
                metrics: Object.fromEntries(this.requestManager.getMetrics()),
                cacheStats: this.requestManager.getCacheStats(),
            };
        }
        // Add service-specific metrics
        if (this.menuService) {
            diagnostics.menuService = {
                metrics: Object.fromEntries(this.menuService.getMetrics()),
            };
        }
        if (this.stockService) {
            diagnostics.stockService = {
                metrics: Object.fromEntries(this.stockService.getMetrics()),
            };
        }
        return diagnostics;
    }
    /**
     * Clear all caches across services
     */
    clearAllCaches() {
        this.log('info', 'Clearing all service caches');
        if (this.requestManager) {
            this.requestManager.clearCache();
        }
    }
    /**
     * Refresh all service data
     */
    async refreshAllData() {
        this.log('info', 'Refreshing all service data');
        const promises = [];
        if (this.menuService) {
            promises.push(this.menuService.refreshMenuData());
        }
        if (this.stockService) {
            promises.push(this.stockService.refreshStockData());
        }
        await Promise.allSettled(promises);
        this.log('info', 'All service data refreshed');
    }
    /**
     * Register health check for a service
     */
    registerHealthCheck(serviceName, checker) {
        this.healthChecks.set(serviceName, {
            service: serviceName,
            status: 'healthy',
            lastCheck: new Date(),
        });
        // Run initial health check
        this.runHealthCheck(serviceName, checker);
    }
    /**
     * Run health check for a specific service
     */
    async runHealthCheck(serviceName, checker) {
        try {
            const health = await checker();
            this.healthChecks.set(serviceName, {
                ...health,
                lastCheck: new Date(),
            });
        }
        catch (error) {
            this.healthChecks.set(serviceName, {
                service: serviceName,
                status: 'unhealthy',
                lastCheck: new Date(),
                errors: [error instanceof Error ? error.message : String(error)],
            });
        }
    }
    /**
     * Start periodic health monitoring
     */
    startHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        // Run health checks every 30 seconds
        this.healthCheckInterval = setInterval(() => {
            this.runAllHealthChecks();
        }, 30000);
    }
    /**
     * Run all registered health checks
     */
    async runAllHealthChecks() {
        // Note: In a real implementation, we would store the checker functions
        // For now, we'll just update timestamps and basic checks
        const now = new Date();
        for (const [serviceName, health] of this.healthChecks) {
            this.healthChecks.set(serviceName, {
                ...health,
                lastCheck: now,
            });
        }
    }
    /**
     * Health check for RequestManager
     */
    checkRequestManagerHealth() {
        if (!this.requestManager) {
            return {
                service: 'requestManager',
                status: 'unhealthy',
                lastCheck: new Date(),
                errors: ['RequestManager not initialized'],
            };
        }
        const cacheStats = this.requestManager.getCacheStats();
        const metrics = this.requestManager.getMetrics();
        return {
            service: 'requestManager',
            status: 'healthy',
            lastCheck: new Date(),
            metrics: {
                cacheStats,
                totalRequests: metrics.size,
            },
        };
    }
    /**
     * Health check for MenuService
     */
    checkMenuServiceHealth() {
        if (!this.menuService) {
            return {
                service: 'menuService',
                status: 'unhealthy',
                lastCheck: new Date(),
                errors: ['MenuService not initialized'],
            };
        }
        const metrics = this.menuService.getMetrics();
        return {
            service: 'menuService',
            status: 'healthy',
            lastCheck: new Date(),
            metrics: {
                totalRequests: metrics.size,
            },
        };
    }
    /**
     * Health check for StockService
     */
    checkStockServiceHealth() {
        if (!this.stockService) {
            return {
                service: 'stockService',
                status: 'unhealthy',
                lastCheck: new Date(),
                errors: ['StockService not initialized'],
            };
        }
        const metrics = this.stockService.getMetrics();
        return {
            service: 'stockService',
            status: 'healthy',
            lastCheck: new Date(),
            metrics: {
                totalRequests: metrics.size,
            },
        };
    }
    /**
     * Logging with level support
     */
    log(level, message, ...args) {
        const levels = { error: 0, warn: 1, info: 2, debug: 3 };
        const configLevel = levels[this.config.logLevel || 'info'];
        const messageLevel = levels[level];
        if (messageLevel <= configLevel) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [ServiceContainer] [${level.toUpperCase()}]`;
            switch (level) {
                case 'error':
                    console.error(prefix, message, ...args);
                    break;
                case 'warn':
                    console.warn(prefix, message, ...args);
                    break;
                case 'debug':
                    console.debug(prefix, message, ...args);
                    break;
                default:
                    console.log(prefix, message, ...args);
            }
        }
    }
    /**
     * Cleanup resources
     */
    cleanup() {
        this.log('info', 'Cleaning up ServiceContainer');
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        // Clear all caches
        this.clearAllCaches();
        // Reset service instances
        this.requestManager = null;
        this.menuService = null;
        this.stockService = null;
        this.healthChecks.clear();
    }
}
ServiceContainer.instance = null;
// Convenience functions for easy access
export function getServiceContainer() {
    return ServiceContainer.getInstance();
}
export function getMenuService() {
    return getServiceContainer().getMenuService();
}
export function getStockService() {
    return getServiceContainer().getStockService();
}
export function getRequestManager() {
    return getServiceContainer().getRequestManager();
}
