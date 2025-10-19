/**
 * Database Service for SQLite (Simplified)
 * Provides database operations for better-sqlite3
 */

import { getDatabase } from '../db';
import type { Database } from 'better-sqlite3';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database;

  private constructor() {
    this.db = getDatabase();
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Get the database instance
   */
  getDatabase(): Database {
    return this.db;
  }

  /**
   * Execute a raw SQL query
   */
  async executeRaw(sql: string, params: any[] = []): Promise<any> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Check if database is ready
   */
  async isReady(): Promise<boolean> {
    try {
      const result = this.db.prepare('SELECT 1 as test').get();
      return result !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    // Database is managed by main process, don't close here
    console.log('DatabaseService: close requested (no-op for singleton)');
  }
}
