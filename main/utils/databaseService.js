/**
 * Database Service for SQLite (Simplified)
 * Provides database operations for better-sqlite3
 */
import { getDatabase } from '../db';
export class DatabaseService {
    constructor() {
        this.db = getDatabase();
    }
    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }
    /**
     * Get the database instance
     */
    getDatabase() {
        return this.db;
    }
    /**
     * Execute a raw SQL query
     */
    async executeRaw(sql, params = []) {
        const stmt = this.db.prepare(sql);
        return stmt.all(...params);
    }
    /**
     * Check if database is ready
     */
    async isReady() {
        try {
            const result = this.db.prepare('SELECT 1 as test').get();
            return result !== undefined;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Close database connection
     */
    async close() {
        // Database is managed by main process, don't close here
        console.log('DatabaseService: close requested (no-op for singleton)');
    }
}
