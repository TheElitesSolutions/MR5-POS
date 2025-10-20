import { IpcMainInvokeEvent } from 'electron';
import { AUTH_CHANNELS } from '../../shared/ipc-channels';
import {
  LoginSchema,
  ChangePasswordSchema,
} from '../../shared/validation-schemas';
import { validateWithSchema } from '../utils/validation-helpers';
import { logError, logInfo } from '../error-handler';
import { UserModel } from '../models/User';
import { IPCResponse, JWTPayload, User } from '../types/index';
import { enhancedLogger, LogCategory } from '../utils/enhanced-logger';
import { AdvancedLogger } from '../utils/advancedLogger';
import { generateToken, verifyToken } from '../utils/auth';
import { BaseController } from './baseController';
import { prisma } from '../db/prisma-wrapper';
import { createDefaultAdminUser } from '../utils/create-default-admin';

// Token blacklist for logout invalidation
const tokenBlacklist = new Set<string>();

// Helper functions for token management
function blacklistToken(token: string): void {
  tokenBlacklist.add(token);
}

function isTokenBlacklisted(token: string): boolean {
  return tokenBlacklist.has(token);
}

function generateTokenPair(user: User): {
  accessToken: string;
  refreshToken: string;
} {
  // JWT secrets should be loaded from environment variables in production
  const JWT_SECRET = process.env.JWT_SECRET || 'electron-pos-secret-dev';
  const JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || 'electron-pos-refresh-secret-dev';

  const accessToken = generateToken(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      type: 'access',
    },
    JWT_SECRET,
    '1h'
  );

  const refreshToken = generateToken(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      type: 'refresh',
    },
    JWT_REFRESH_SECRET,
    '30d'
  );

  return { accessToken, refreshToken };
}

function refreshAccessToken(refreshToken: string): string | null {
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'electron-pos-secret-dev';
    const JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'electron-pos-refresh-secret-dev';

    const payload = verifyToken(refreshToken, JWT_REFRESH_SECRET);

    if (!payload || isTokenBlacklisted(refreshToken)) {
      return null;
    }

    return generateToken(
      {
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
        type: 'access',
      },
      JWT_SECRET,
      '1h'
    );
  } catch (error) {
    logError(
      error instanceof Error ? error : new Error('Token refresh failed')
    );
    return null;
  }
}

export class AuthController extends BaseController {
  private userModel: UserModel;
  private activeSessions = new Map<
    string,
    { userId: string; token: string; refreshToken: string }
  >();

  constructor() {
    super();
    enhancedLogger.info('AuthController constructor called', LogCategory.SYSTEM, 'AuthController');
    this.userModel = new UserModel(prisma);
    enhancedLogger.info('AuthController initialized', LogCategory.SYSTEM, 'AuthController');
    // NOTE: Do NOT call this.initialize() here!
    // StartupManager will call initialize() after construction
  }

  protected registerHandlers(): void {
    enhancedLogger.info('Starting IPC handler registration', LogCategory.SYSTEM, 'AuthController');

    // Test handler for debugging IPC communication
    this.registerHandler<any>(
      'mr5pos:auth:test',
      async (_event: IpcMainInvokeEvent) => {
        logInfo('🧪 Test handler called successfully');

        // Gather diagnostic information
        const diagnosticInfo = {
          timestamp: new Date().toISOString(),
          userModelAvailable: !!this.userModel,
          activeSessionsCount: this.activeSessions.size,
          prismaConnected: false,
          environment: process.env.NODE_ENV || 'unknown',
          authChannels: Object.values(AUTH_CHANNELS),
        };

        // Test Prisma connection
        try {
          if (prisma) {
            // Simple query to test connection
            await prisma.$queryRaw('SELECT 1 as result');
            diagnosticInfo.prismaConnected = true;
          }
        } catch (error) {
          logError('Prisma connection test failed in auth test handler');
        }

        logInfo(`🧪 Auth diagnostic info: ${JSON.stringify(diagnosticInfo)}`);

        return this.createSuccessResponse({
          message: 'Auth IPC test successful',
          diagnosticInfo,
        });
      }
    );

    // Authentication handlers
    this.registerHandler<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>(AUTH_CHANNELS.LOGIN, this.login.bind(this));

    // Register alias for backward compatibility with short channel name
    this.registerHandler<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('auth:login', this.login.bind(this));

    this.registerHandler<boolean>(AUTH_CHANNELS.LOGOUT, this.logout.bind(this));

    this.registerHandler<{ user: User; isValid: boolean }>(
      AUTH_CHANNELS.VERIFY_SESSION,
      this.verifySession.bind(this)
    );

    this.registerHandler<boolean>(
      AUTH_CHANNELS.CHANGE_PASSWORD,
      this.changePassword.bind(this)
    );

    this.registerHandler<User>(
      AUTH_CHANNELS.GET_CURRENT_USER,
      this.getCurrentUser.bind(this)
    );

    this.registerHandler<{ accessToken: string }>(
      AUTH_CHANNELS.TOKEN_REFRESH,
      this.handleTokenRefresh.bind(this)
    );

    // Manual admin creation handler for troubleshooting
    this.registerHandler<{ success: boolean; message: string }>(
      AUTH_CHANNELS.CREATE_DEFAULT_ADMIN,
      this.createAdminUser.bind(this)
    );

    // Verify handlers are actually registered
    const registeredChannels = Object.values(AUTH_CHANNELS);
    enhancedLogger.info(`AUTH_CHANNELS defined: ${registeredChannels.join(', ')}`, LogCategory.SYSTEM, 'AuthController');
    enhancedLogger.info('All Auth IPC handlers registered successfully', LogCategory.SYSTEM, 'AuthController');
  }

  public override unregisterHandlers(): void {
    Object.values(AUTH_CHANNELS).forEach(channel => {
      this.unregisterHandler(channel);
    });
    logInfo('All Auth IPC handlers unregistered');
  }

  /**
   * Handle user login with enhanced JWT and security logging
   */
  private async login(
    _event: IpcMainInvokeEvent,
    credentials: unknown
  ): Promise<
    IPCResponse<{ user: User; accessToken: string; refreshToken: string }>
  > {
    try {
      // Runtime validation with Zod
      const validation = validateWithSchema(
        LoginSchema,
        credentials,
        'Login'
      );

      if (!validation.success) {
        enhancedLogger.error(`Login: Validation failed - ${validation.error}`);
        return this.createErrorResponse(new Error(validation.error));
      }

      const validatedCredentials = validation.data!;

      const clientInfo = {
        userAgent: 'Electron-Desktop-App',
        ipAddress: '127.0.0.1', // Desktop app local
      };

      enhancedLogger.info(`Login attempt for: ${validatedCredentials.username}`);

      const result = await this.userModel.findByCredentials(
        validatedCredentials.username,
        validatedCredentials.password
      );

      if (!result.success || !result.data) {
        // Log failed login attempt for security monitoring
        enhancedLogger.error(`Login failed for: ${validatedCredentials.username} - ${result.error || 'Invalid credentials'}`, LogCategory.SYSTEM, 'AuthController');
        AdvancedLogger.securityEvent(
          'authentication_failure',
          {
            username: validatedCredentials.username,
            reason: 'invalid_credentials',
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
            timestamp: new Date().toISOString(),
          },
          'medium'
        );

        return this.createErrorResponse(
          new Error(result.error || 'Invalid credentials')
        );
      }

      const user = result.data;

      // Generate JWT token pair
      const { accessToken, refreshToken } = generateTokenPair(user as User);

      // Store session information
      const sessionId = `session_${user.id}_${Date.now()}`;
      this.activeSessions.set(sessionId, {
        userId: user.id,
        token: accessToken,
        refreshToken,
      });

      // Log successful login
      AdvancedLogger.userAction(
        user.id,
        'login',
        {
          username: user.username,
          role: user.role,
          sessionId,
          loginTime: new Date().toISOString(),
        },
        clientInfo.ipAddress,
        clientInfo.userAgent
      );

      AdvancedLogger.securityEvent(
        'authentication_success',
        {
          userId: user.id,
          username: user.username,
          role: user.role,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
        },
        'low'
      );

      logInfo(`Login successful for user: ${user.username} (${user.role})`);
      enhancedLogger.info(`Returning success response with tokens for: ${user.username}`, LogCategory.SYSTEM, 'AuthController');

      return this.createSuccessResponse({
        user: user as User,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Login failed';

      AdvancedLogger.errorEvent(
        `Login error: ${errorMessage}`,
        'AuthController',
        'error',
        error instanceof Error ? error.stack : undefined
      );

      return this.createErrorResponse(
        error instanceof Error ? error : new Error(errorMessage)
      );
    }
  }

  /**
   * Handle user logout with token blacklisting
   */
  private async logout(
    _event: IpcMainInvokeEvent,
    tokenData: { accessToken: string; refreshToken: string }
  ): Promise<IPCResponse<boolean>> {
    try {
      // Verify and get user info from token
      const JWT_SECRET = process.env.JWT_SECRET || 'electron-pos-secret-dev';
      let userId: string | undefined;
      try {
        const payload = verifyToken(tokenData.accessToken, JWT_SECRET);
        userId = payload?.userId;
      } catch {
        // Token might be expired, try to decode without verification
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(tokenData.accessToken) as JWTPayload;
        userId = decoded?.userId;
      }

      // Blacklist both tokens
      blacklistToken(tokenData.accessToken);
      blacklistToken(tokenData.refreshToken);

      // Remove from active sessions
      for (const [sessionId, session] of Array.from(this.activeSessions.entries())) {
        if (session.token === tokenData.accessToken) {
          this.activeSessions.delete(sessionId);
          break;
        }
      }

      // Log logout activity
      if (userId) {
        AdvancedLogger.userAction(
          userId,
          'logout',
          {
            logoutTime: new Date().toISOString(),
            tokenBlacklisted: true,
          },
          '127.0.0.1',
          'Electron-Desktop-App'
        );

        AdvancedLogger.securityEvent(
          'user_logout',
          {
            userId,
            tokenBlacklisted: true,
            sessionTerminated: true,
          },
          'low'
        );
      }

      return this.createSuccessResponse(true, 'Logged out successfully');
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : new Error('Logout failed')
      );
    }
  }

  /**
   * Verify user session token
   */
  private async verifySession(
    _event: IpcMainInvokeEvent,
    accessToken: string
  ): Promise<IPCResponse<{ user: User; isValid: boolean }>> {
    try {
      if (!accessToken) {
        return this.createErrorResponse(
          new Error('Authentication required: No access token provided')
        );
      }

      try {
        const JWT_SECRET = process.env.JWT_SECRET || 'electron-pos-secret-dev';

        // Verify token and get payload
        const payload = verifyToken(accessToken, JWT_SECRET);

        if (!payload || isTokenBlacklisted(accessToken)) {
          return this.createErrorResponse(
            new Error(
              'Session expired or invalid: Invalid or blacklisted token'
            )
          );
        }

        // Get user from database
        const userResult = await this.userModel.findById(payload.userId);

        if (!userResult.success || !userResult.data) {
          return this.createErrorResponse(
            new Error('Invalid session: User not found')
          );
        }

        // Check if token is in active sessions
        let isActiveSession = false;
        for (const session of Array.from(this.activeSessions.values())) {
          if (
            session.token === accessToken &&
            session.userId === payload.userId
          ) {
            isActiveSession = true;
            break;
          }
        }

        return this.createSuccessResponse({
          user: userResult.data as User,
          isValid: isActiveSession,
        });
      } catch (error) {
        return this.createErrorResponse(
          error instanceof Error
            ? new Error(`Session expired or invalid: ${error.message}`)
            : new Error('Session expired or invalid')
        );
      }
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error
          ? error
          : new Error('Session verification failed')
      );
    }
  }

  /**
   * Handle password change with security logging
   */
  private async changePassword(
    _event: IpcMainInvokeEvent,
    data: unknown
  ): Promise<IPCResponse<boolean>> {
    try {
      // Runtime validation with Zod
      const validation = validateWithSchema(
        ChangePasswordSchema,
        data,
        'ChangePassword'
      );

      if (!validation.success) {
        enhancedLogger.error(`ChangePassword: Validation failed - ${validation.error}`);
        return this.createErrorResponse(new Error(validation.error));
      }

      const validatedData = validation.data!;

      if (!validatedData.accessToken) {
        return this.createErrorResponse(
          new Error('Authentication required: No access token provided')
        );
      }

      try {
        const JWT_SECRET = process.env.JWT_SECRET || 'electron-pos-secret-dev';

        // Verify token and get payload
        const payload = verifyToken(validatedData.accessToken, JWT_SECRET);

        if (!payload || isTokenBlacklisted(validatedData.accessToken)) {
          return this.createErrorResponse(
            new Error('Authentication failed: Invalid or blacklisted token')
          );
        }

        // Change password
        const result = await this.userModel.changePassword(
          payload.userId,
          validatedData.currentPassword,
          validatedData.newPassword
        );

        if (!result.success) {
          AdvancedLogger.securityEvent(
            'password_change_failed',
            {
              userId: payload.userId,
              reason: result.error,
              timestamp: new Date().toISOString(),
            },
            'medium'
          );

          return this.createErrorResponse(
            new Error(result.error || 'Failed to change password')
          );
        }

        // Log password change
        AdvancedLogger.securityEvent(
          'password_changed',
          {
            userId: payload.userId,
            timestamp: new Date().toISOString(),
          },
          'medium'
        );

        return this.createSuccessResponse(
          true,
          'Password changed successfully'
        );
      } catch (error) {
        return this.createErrorResponse(
          error instanceof Error
            ? new Error(`Authentication failed: ${error.message}`)
            : new Error('Authentication failed')
        );
      }
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : new Error('Password change failed')
      );
    }
  }

  /**
   * Get current user from token
   */
  private async getCurrentUser(
    _event: IpcMainInvokeEvent,
    accessToken: string
  ): Promise<IPCResponse<User>> {
    try {
      if (!accessToken) {
        return this.createErrorResponse(
          new Error('Authentication required: No access token provided')
        );
      }

      try {
        const JWT_SECRET = process.env.JWT_SECRET || 'electron-pos-secret-dev';

        // Verify token and get payload
        const payload = verifyToken(accessToken, JWT_SECRET);

        if (!payload || isTokenBlacklisted(accessToken)) {
          return this.createErrorResponse(
            new Error('Authentication failed: Invalid or blacklisted token')
          );
        }

        // Get user from database
        const userResult = await this.userModel.findById(payload.userId);

        if (!userResult.success || !userResult.data) {
          return this.createErrorResponse(new Error('User not found'));
        }

        return this.createSuccessResponse(userResult.data as User);
      } catch (error) {
        return this.createErrorResponse(
          error instanceof Error
            ? new Error(`Authentication failed: ${error.message}`)
            : new Error('Authentication failed')
        );
      }
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : new Error('Failed to get current user')
      );
    }
  }

  /**
   * Handle token refresh request
   */
  private async handleTokenRefresh(
    _event: IpcMainInvokeEvent,
    refreshTokenData: { refreshToken: string }
  ): Promise<IPCResponse<{ accessToken: string }>> {
    try {
      if (!refreshTokenData || !refreshTokenData.refreshToken) {
        return this.createErrorResponse(
          new Error('Authentication required: No refresh token provided')
        );
      }

      const newAccessToken = refreshAccessToken(refreshTokenData.refreshToken);

      if (!newAccessToken) {
        return this.createErrorResponse(
          new Error('Invalid or expired refresh token')
        );
      }

      return this.createSuccessResponse({ accessToken: newAccessToken });
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : new Error('Token refresh failed')
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshToken(
    refreshToken: string
  ): Promise<IPCResponse<{ accessToken: string }>> {
    try {
      if (!refreshToken) {
        return this.createErrorResponse(new Error('No refresh token provided'));
      }

      try {
        const newAccessToken = refreshAccessToken(refreshToken);

        if (!newAccessToken) {
          return this.createErrorResponse(new Error('Failed to refresh token'));
        }

        return this.createSuccessResponse({ accessToken: newAccessToken });
      } catch (error) {
        return this.createErrorResponse(
          error instanceof Error
            ? new Error(`Token refresh failed: ${error.message}`)
            : new Error('Token refresh failed')
        );
      }
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : new Error('Token refresh failed')
      );
    }
  }

  /**
   * Clean up expired sessions
   */
  public cleanupExpiredSessions(): void {
    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'electron-pos-secret-dev';
      const expiredSessions: string[] = [];

      for (const [sessionId, session] of Array.from(this.activeSessions.entries())) {
        try {
          const payload = verifyToken(session.token, JWT_SECRET);
          if (!payload || isTokenBlacklisted(session.token)) {
            expiredSessions.push(sessionId);
          }
        } catch (error) {
          // Token is expired or invalid
          expiredSessions.push(sessionId);
        }
      }

      // Remove expired sessions
      expiredSessions.forEach(sessionId => {
        this.activeSessions.delete(sessionId);
      });

      if (expiredSessions.length > 0) {
        logInfo(`Cleaned up ${expiredSessions.length} expired sessions`);
      }
    } catch (error) {
      logError(
        error instanceof Error
          ? error
          : new Error('Failed to clean up expired sessions')
      );
    }
  }

  /**
   * Get security statistics
   */
  public getSecurityStats(): { activeSessions: number; timestamp: string } {
    return {
      activeSessions: this.activeSessions.size,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Manually create default admin user
   * Useful for troubleshooting when automatic creation fails
   */
  private async createAdminUser(
    _event: IpcMainInvokeEvent
  ): Promise<IPCResponse<{ success: boolean; message: string }>> {
    try {
      logInfo('Manual admin user creation requested via IPC', 'AuthController');
      console.log('[AuthController] Manual admin creation called from renderer');

      const result = await createDefaultAdminUser();

      if (result.success) {
        logInfo('Admin user created successfully via manual trigger', 'AuthController');
        return this.createSuccessResponse(result);
      } else {
        logError(
          `Admin user creation failed: ${result.message}`,
          'AuthController'
        );
        return this.createErrorResponse(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(
        `Exception during manual admin creation: ${errorMessage}`,
        'AuthController'
      );
      return this.createErrorResponse(`Failed to create admin user: ${errorMessage}`);
    }
  }

  /**
   * Clean up resources
   */
  public override cleanup(): void {
    this.cleanupExpiredSessions();
    this.activeSessions.clear();
    super.cleanup();
  }
}
