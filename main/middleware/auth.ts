// Authentication Middleware for Main Process
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { AUTH_CHANNELS } from '../../shared/ipc-channels';
import { AppError, logDebug, logError, logInfo } from '../error-handler';
import { IPCResponse, User, UserRole } from '../types';

/**
 * Authentication error class
 */
class AuthError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Authentication middleware for the main process
 * Handles user authentication and session management
 */
export class AuthMiddleware {
  private currentUser: User | null = null;
  private sessionToken: string | null = null;
  private backendBaseUrl: string;

  constructor() {
    this.backendBaseUrl = 'http://localhost:3001';
    // Disabled: setupAuthHandlers() - Using AuthController instead to avoid conflicts
    console.log(
      'AuthMiddleware initialized without IPC handlers (using AuthController)'
    );
  }

  /**
   * Setup authentication IPC handlers
   */
  private setupAuthHandlers(): void {
    // Login handler
    ipcMain.handle(
      AUTH_CHANNELS.LOGIN,
      async (
        _,
        credentials: { email: string; password: string }
      ): Promise<IPCResponse<{ user: User; token: string }>> => {
        try {
          logDebug(`Login attempt for ${credentials.email}`, 'AuthMiddleware');

          const response = await fetch(
            `${this.backendBaseUrl}/api/auth/login`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(credentials),
            }
          );

          if (!response.ok) {
            throw new Error(`Authentication failed: ${response.statusText}`);
          }

          const authData = await response.json();

          // Type check and store session data
          if (
            authData &&
            typeof authData === 'object' &&
            'user' in authData &&
            'token' in authData
          ) {
            this.currentUser = authData.user as User;
            this.sessionToken = authData.token as string;

            logInfo(
              `User logged in: ${(authData.user as User).email}`,
              'AuthMiddleware'
            );

            return {
              success: true,
              data: {
                user: authData.user as User,
                token: authData.token as string,
              },
              timestamp: new Date().toISOString(),
            };
          } else {
            throw new Error('Invalid authentication response format');
          }
        } catch (error) {
          logError(`Login failed: ${error}`, 'AuthMiddleware');
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Login failed',
            timestamp: new Date().toISOString(),
          };
        }
      }
    );

    // Logout handler
    ipcMain.handle(
      AUTH_CHANNELS.LOGOUT,
      async (): Promise<IPCResponse<boolean>> => {
        try {
          logDebug('User logout', 'AuthMiddleware');

          if (this.sessionToken) {
            // Notify backend of logout
            await fetch(`${this.backendBaseUrl}/api/auth/logout`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.sessionToken}`,
              },
            });
          }

          // Clear session data
          this.currentUser = null;
          this.sessionToken = null;

          logInfo('User logged out', 'AuthMiddleware');

          return {
            success: true,
            data: true,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          // Even if backend call fails, clear local session
          this.currentUser = null;
          this.sessionToken = null;

          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          logError(
            new Error(`Logout error: ${errorMessage}`),
            'AuthMiddleware'
          );

          return {
            success: true, // Still return success as local session is cleared
            data: true,
            timestamp: new Date().toISOString(),
          };
        }
      }
    );

    // Check authentication status
    ipcMain.handle(
      AUTH_CHANNELS.VERIFY_SESSION,
      async (): Promise<
        IPCResponse<{ isAuthenticated: boolean; user?: User }>
      > => {
        try {
          if (!this.sessionToken || !this.currentUser) {
            return {
              success: true,
              data: { isAuthenticated: false },
              timestamp: new Date().toISOString(),
            };
          }

          // Verify token with backend
          const response = await fetch(
            `${this.backendBaseUrl}/api/auth/verify`,
            {
              headers: {
                Authorization: `Bearer ${this.sessionToken}`,
              },
            }
          );

          if (!response.ok) {
            // Token invalid, clear session
            this.currentUser = null;
            this.sessionToken = null;

            return {
              success: true,
              data: { isAuthenticated: false },
              timestamp: new Date().toISOString(),
            };
          }

          return {
            success: true,
            data: { isAuthenticated: true, user: this.currentUser },
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          logError(
            new Error(`Auth check failed: ${errorMessage}`),
            'AuthMiddleware'
          );

          return {
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          };
        }
      }
    );

    // Token refresh handler
    ipcMain.handle(
      AUTH_CHANNELS.TOKEN_REFRESH,
      async (): Promise<IPCResponse<{ token: string }>> => {
        try {
          if (!this.sessionToken) {
            throw new Error('No active session to refresh');
          }

          const response = await fetch(
            `${this.backendBaseUrl}/api/auth/refresh`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.sessionToken}`,
              },
            }
          );

          if (!response.ok) {
            throw new Error(`Token refresh failed: ${response.statusText}`);
          }

          const tokenResponse = await response.json();
          if (
            tokenResponse &&
            typeof tokenResponse === 'object' &&
            'token' in tokenResponse
          ) {
            this.sessionToken = tokenResponse.token as string;
          } else {
            throw new Error('Invalid token refresh response format');
          }

          logDebug('Token refreshed', 'AuthMiddleware');

          return {
            success: true,
            data: { token: this.sessionToken },
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          logError(
            new Error(`Token refresh failed: ${errorMessage}`),
            'AuthMiddleware'
          );

          return {
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          };
        }
      }
    );

    logInfo('Authentication handlers registered', 'AuthMiddleware');
  }

  /**
   * Require authentication middleware
   */
  public requireAuth = (_event: IpcMainInvokeEvent): boolean => {
    if (!this.sessionToken || !this.currentUser) {
      throw new AuthError('Authentication required');
    }
    return true;
  };

  /**
   * Require specific role middleware
   */
  public requireRole = (role: UserRole) => {
    return (_event: IpcMainInvokeEvent): boolean => {
      this.requireAuth(_event);
      if (!this.hasRole(role)) {
        throw new AuthError(`Insufficient permissions. Required role: ${role}`);
      }
      return true;
    };
  };

  /**
   * Get current user
   */
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get current session token
   */
  public getSessionToken(): string | null {
    return this.sessionToken;
  }

  /**
   * Unregister IPC handlers
   */
  public unregisterHandlers(): void {
    ipcMain.removeHandler(AUTH_CHANNELS.LOGIN);
    ipcMain.removeHandler(AUTH_CHANNELS.LOGOUT);
    ipcMain.removeHandler(AUTH_CHANNELS.VERIFY_SESSION);
    ipcMain.removeHandler(AUTH_CHANNELS.CHANGE_PASSWORD);
    ipcMain.removeHandler(AUTH_CHANNELS.GET_CURRENT_USER);
    ipcMain.removeHandler(AUTH_CHANNELS.TOKEN_REFRESH);
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.unregisterHandlers();
    this.sessionToken = null;
    this.currentUser = null;
    logInfo('Authentication handlers cleaned up', 'AuthMiddleware');
  }

  /**
   * Check if the current user has the required role
   */
  public hasRole(requiredRole: UserRole): boolean {
    if (!this.currentUser) {
      return false;
    }

    const roleHierarchy: Record<string, number> = {
      [UserRole.ADMIN]: 3,
      [UserRole.MANAGER]: 2,
      [UserRole.CASHIER]: 1,
      [UserRole.WAITER]: 1,
      [UserRole.KITCHEN]: 1,
      [UserRole.OWNER]: 4, // Owner has highest privileges
    };

    // If role doesn't exist in hierarchy, deny access
    const currentRoleLevel = roleHierarchy[this.currentUser.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    if (currentRoleLevel === undefined || requiredRoleLevel === undefined) {
      return false;
    }

    // Check if current user role is >= required role
    return currentRoleLevel >= requiredRoleLevel;
  }

  /**
   * Handle verify session request
   */
  private async handleVerifySession(
    _event: IpcMainInvokeEvent,
    token: string
  ): Promise<IPCResponse<{ isAuthenticated: boolean; user?: User }>> {
    try {
      if (!token) {
        return {
          success: true,
          data: { isAuthenticated: false },
          timestamp: new Date().toISOString(),
        };
      }

      // Verify token with backend
      const response = await fetch(`${this.backendBaseUrl}/api/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Token invalid
        return {
          success: true,
          data: { isAuthenticated: false },
          timestamp: new Date().toISOString(),
        };
      }

      const userData = await response.json();

      if (userData && typeof userData === 'object' && 'user' in userData) {
        this.currentUser = userData.user as User;
        this.sessionToken = token;

        return {
          success: true,
          data: {
            isAuthenticated: true,
            user: this.currentUser,
          },
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: true,
          data: { isAuthenticated: false },
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      logError(
        `Session verification failed: ${error instanceof Error ? error.message : String(error)}`,
        'AuthMiddleware'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Session verification failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Handle token refresh request
   */
  private async handleTokenRefresh(
    _event: IpcMainInvokeEvent,
    refreshToken: string
  ): Promise<IPCResponse<{ token: string }>> {
    try {
      if (!refreshToken) {
        throw new Error('No refresh token provided');
      }

      const response = await fetch(`${this.backendBaseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenResponse = await response.json();

      if (
        tokenResponse &&
        typeof tokenResponse === 'object' &&
        'token' in tokenResponse
      ) {
        this.sessionToken = tokenResponse.token as string;

        return {
          success: true,
          data: { token: this.sessionToken },
          timestamp: new Date().toISOString(),
        };
      } else {
        throw new Error('Invalid token refresh response format');
      }
    } catch (error) {
      logError(
        `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
        'AuthMiddleware'
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();
export default authMiddleware;
