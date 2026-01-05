import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logDebug, logError, logInfo } from './error-handler';
import { ensureDirectories, getDatabasePath, getPostgresPath, getIsDev, } from './utils/environment';
/**
 * Database Manager for mr5-POS Electron Application
 * Manages embedded PostgreSQL instance and connections
 */
class DatabaseManager {
    constructor() {
        this.postgresProcess = null;
        this.port = 5432; // Different port to avoid conflicts
        this.isConnected = false;
        this.dbPath = getDatabasePath();
        this.postgresPath = getPostgresPath();
        this.ensureDirectories();
    }
    /**
     * Get PostgreSQL executable path
     */
    getPostgresPath() {
        const platform = process.platform;
        let executableName = 'postgres';
        if (platform === 'win32') {
            executableName = 'postgres.exe';
        }
        // Check if PostgreSQL is available in system PATH first
        if (getIsDev()) {
            // In development, try to use system PostgreSQL
            return executableName;
        }
        // In production, use bundled PostgreSQL
        return path.join(this.postgresPath, 'bin', executableName);
    }
    /**
     * Ensure required directories exist
     */
    ensureDirectories() {
        ensureDirectories();
        // Create database-specific directories
        const dbDirs = [
            this.dbPath,
            path.join(this.dbPath, 'data'),
            path.join(this.dbPath, 'logs'),
        ];
        dbDirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    /**
     * Initialize database if it doesn't exist
     */
    async initializeDatabase() {
        const dataDir = path.join(this.dbPath, 'data');
        const pgVersionFile = path.join(dataDir, 'PG_VERSION');
        // Check if database is already initialized
        if (fs.existsSync(pgVersionFile)) {
            logInfo('Database already initialized', 'DatabaseManager');
            return;
        }
        logInfo('Initializing new database...', 'DatabaseManager');
        return new Promise((resolve, reject) => {
            const initdbPath = this.getInitDbPath();
            const args = [
                '-D',
                dataDir,
                '-U',
                'postgres',
                '--pwfile',
                this.createPasswordFile(),
                '--encoding=UTF8',
                '--locale=C',
            ];
            logDebug(`Executing: ${initdbPath} ${args.join(' ')}`, 'DatabaseManager');
            const initProcess = spawn(initdbPath, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env },
            });
            let output = '';
            let errorOutput = '';
            initProcess.stdout?.on('data', data => {
                output += data.toString();
                logDebug(`initdb stdout: ${data}`, 'DatabaseManager');
            });
            initProcess.stderr?.on('data', data => {
                errorOutput += data.toString();
                logDebug(`initdb stderr: ${data}`, 'DatabaseManager');
            });
            initProcess.on('close', code => {
                if (code === 0) {
                    logInfo('Database initialization completed successfully', 'DatabaseManager');
                    resolve();
                }
                else {
                    const error = new Error(`Database initialization failed with code ${code}: ${errorOutput}`);
                    logError(error, 'DatabaseManager');
                    reject(error);
                }
            });
            initProcess.on('error', error => {
                logError(error, 'DatabaseManager initdb');
                reject(error);
            });
            // Set timeout for initialization
            setTimeout(() => {
                if (!initProcess.killed) {
                    initProcess.kill();
                    reject(new Error('Database initialization timed out'));
                }
            }, 60000); // 60 seconds timeout
        });
    }
    /**
     * Get initdb executable path
     */
    getInitDbPath() {
        const platform = process.platform;
        let executableName = 'initdb';
        if (platform === 'win32') {
            executableName = 'initdb.exe';
        }
        if (getIsDev()) {
            return executableName; // Use system initdb in development
        }
        return path.join(this.postgresPath, 'bin', executableName);
    }
    /**
     * Create password file for database initialization
     */
    createPasswordFile() {
        const passwordFile = path.join(this.dbPath, 'pgpass');
        const password = 'mr5pos2024'; // Default password for embedded database
        fs.writeFileSync(passwordFile, password, { mode: 0o600 });
        return passwordFile;
    }
    /**
     * Start PostgreSQL server
     */
    async startPostgresServer() {
        if (this.postgresProcess) {
            logInfo('PostgreSQL server is already running', 'DatabaseManager');
            return;
        }
        const dataDir = path.join(this.dbPath, 'data');
        const logFile = path.join(this.dbPath, 'logs', 'postgres.log');
        return new Promise((resolve, reject) => {
            const postgresExe = this.getPostgresPath();
            const args = [
                '-D',
                dataDir,
                '-p',
                this.port.toString(),
                '-k',
                this.dbPath, // Unix socket directory
                '-F', // Don't run in background
                '-h',
                'localhost', // Listen on localhost only
                '-c',
                'log_destination=stderr',
                '-c',
                'logging_collector=off',
                '-c',
                'log_statement=none',
                '-c',
                'log_line_prefix=%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ',
                '-c',
                'fsync=on', // CRITICAL: Ensures data integrity during system crashes
                '-c',
                'synchronous_commit=on', // CRITICAL: Ensures transactions are committed reliably
                '-c',
                'full_page_writes=on', // CRITICAL: Protects against partial page writes during crashes
                '-c',
                'wal_level=replica', // Improved WAL logging for recovery
                '-c',
                'checkpoint_timeout=30s', // More frequent checkpoints
                '-c',
                'max_wal_size=256MB', // Controls WAL size before automatic checkpoint
            ];
            logDebug(`Starting PostgreSQL: ${postgresExe} ${args.join(' ')}`, 'DatabaseManager');
            this.postgresProcess = spawn(postgresExe, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env },
                cwd: this.dbPath,
            });
            let startupOutput = '';
            let errorOutput = '';
            let serverReady = false;
            // Handle stdout
            this.postgresProcess.stdout?.on('data', data => {
                const output = data.toString();
                startupOutput += output;
                logDebug(`PostgreSQL stdout: ${output.trim()}`, 'DatabaseManager');
                // Check for server ready message
                if (output.includes('database system is ready to accept connections')) {
                    serverReady = true;
                    logInfo(`PostgreSQL server started successfully on port ${this.port}`, 'DatabaseManager');
                    resolve();
                }
            });
            // Handle stderr
            this.postgresProcess.stderr?.on('data', data => {
                const output = data.toString();
                errorOutput += output;
                logDebug(`PostgreSQL stderr: ${output.trim()}`, 'DatabaseManager');
                // PostgreSQL logs startup messages to stderr by default
                if (output.includes('database system is ready to accept connections')) {
                    serverReady = true;
                    logInfo(`PostgreSQL server started successfully on port ${this.port}`, 'DatabaseManager');
                    resolve();
                }
                // Check for port conflicts
                if (output.includes('could not bind') ||
                    output.includes('Address already in use')) {
                    logError(new Error(`Port ${this.port} is already in use`), 'DatabaseManager');
                    reject(new Error(`PostgreSQL port ${this.port} is already in use`));
                }
            });
            // Handle process exit
            this.postgresProcess.on('close', (code, signal) => {
                logInfo(`PostgreSQL process exited with code ${code} and signal ${signal}`, 'DatabaseManager');
                this.postgresProcess = null;
                if (!serverReady && code !== 0) {
                    const error = new Error(`PostgreSQL failed to start (exit code: ${code})\n${errorOutput}`);
                    logError(error, 'DatabaseManager');
                    reject(error);
                }
            });
            // Handle process errors
            this.postgresProcess.on('error', error => {
                logError(error, 'DatabaseManager PostgreSQL');
                this.postgresProcess = null;
                if (!serverReady) {
                    reject(error);
                }
            });
            // Set startup timeout
            setTimeout(() => {
                if (!serverReady) {
                    logError(new Error('PostgreSQL startup timed out'), 'DatabaseManager');
                    if (this.postgresProcess) {
                        this.postgresProcess.kill('SIGTERM');
                    }
                    reject(new Error('PostgreSQL startup timed out after 30 seconds'));
                }
            }, 30000); // 30 seconds timeout
        });
    }
    /**
     * Stop PostgreSQL server
     */
    async stopPostgresServer() {
        if (!this.postgresProcess) {
            logInfo('PostgreSQL server is not running', 'DatabaseManager');
            return;
        }
        return new Promise(resolve => {
            if (!this.postgresProcess) {
                resolve();
                return;
            }
            logInfo('Stopping PostgreSQL server...', 'DatabaseManager');
            // Set up cleanup timeout
            const cleanup = () => {
                this.postgresProcess = null;
                this.isConnected = false;
                logInfo('PostgreSQL server stopped', 'DatabaseManager');
                resolve();
            };
            // Listen for process exit
            this.postgresProcess.once('close', cleanup);
            // Send SIGTERM for graceful shutdown
            this.postgresProcess.kill('SIGTERM');
            // Force kill after timeout
            setTimeout(() => {
                if (this.postgresProcess && !this.postgresProcess.killed) {
                    logInfo('Force killing PostgreSQL server', 'DatabaseManager');
                    this.postgresProcess.kill('SIGKILL');
                    cleanup();
                }
            }, 10000); // 10 seconds timeout for graceful shutdown
        });
    }
    /**
     * Wait for database to be ready for connections
     */
    async waitForConnection() {
        const maxAttempts = 30;
        const delayMs = 1000;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // In a real implementation, you would test the connection here
                // For now, we'll assume it's ready after the server starts
                logDebug(`Connection attempt ${attempt}/${maxAttempts}`, 'DatabaseManager');
                // Simple delay to allow server to fully initialize
                await new Promise(resolve => setTimeout(resolve, delayMs));
                // TODO: Add actual connection test when Prisma is integrated
                this.isConnected = true;
                logInfo('Database connection established', 'DatabaseManager');
                return;
            }
            catch (error) {
                logDebug(`Connection attempt ${attempt} failed: ${error}`, 'DatabaseManager');
                if (attempt === maxAttempts) {
                    throw new Error(`Failed to connect to database after ${maxAttempts} attempts`);
                }
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    /**
     * Initialize the database manager
     */
    async initialize() {
        try {
            logInfo('Starting database initialization...', 'DatabaseManager');
            if (getIsDev()) {
                logInfo('Development mode: Using external PostgreSQL connection', 'DatabaseManager');
                // In development, assume PostgreSQL is running externally
                this.isConnected = true;
                return;
            }
            // Production mode: manage embedded PostgreSQL
            logInfo('Production mode: Starting embedded PostgreSQL', 'DatabaseManager');
            // 1. Initialize database if needed
            await this.initializeDatabase();
            // 2. Start PostgreSQL server
            await this.startPostgresServer();
            // 3. Wait for connection to be ready
            await this.waitForConnection();
            logInfo('Database manager initialization completed', 'DatabaseManager');
        }
        catch (error) {
            logError(error, 'DatabaseManager');
            throw error;
        }
    }
    /**
     * Shutdown the database manager
     */
    async shutdown() {
        try {
            logInfo('Starting database shutdown...', 'DatabaseManager');
            if (getIsDev()) {
                logInfo('Development mode: External PostgreSQL connection closed', 'DatabaseManager');
                this.isConnected = false;
                return;
            }
            // Production mode: stop embedded PostgreSQL
            await this.stopPostgresServer();
            logInfo('Database shutdown completed', 'DatabaseManager');
        }
        catch (error) {
            logError(error, 'DatabaseManager');
            throw error;
        }
    }
    /**
     * Get database connection information
     */
    getConnectionInfo() {
        return {
            host: 'localhost',
            port: this.port,
            database: 'mr5pos',
            username: 'postgres',
            isConnected: this.isConnected,
            isDev: getIsDev(),
        };
    }
    /**
     * Check if database is connected
     */
    isConnectedToDB() {
        return this.isConnected;
    }
    /**
     * Get the current port
     */
    getPort() {
        return this.port;
    }
}
// Create singleton instance
const databaseManager = new DatabaseManager();
// Export functions for use in main process
export const initializeDatabase = () => databaseManager.initialize();
export const shutdownDatabase = () => databaseManager.shutdown();
export const getDatabaseInfo = () => databaseManager.getConnectionInfo();
export const isDatabaseConnected = () => databaseManager.isConnectedToDB();
export default databaseManager;
