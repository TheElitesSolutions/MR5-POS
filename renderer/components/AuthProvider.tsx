'use client';

import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const { user, accessToken, refreshToken, clearAuth, refreshAccessToken } =
    useAuthStore();

  const isAuthenticated = !!user && !!accessToken;

  // Check authentication status on mount and token refresh
  const checkAuth = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log('AuthProvider: Checking authentication status', {
        hasUser: !!user,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
      });

      // If we have a user and access token, we're authenticated
      if (user && accessToken) {
        console.log('AuthProvider: Already authenticated');
        return true;
      }

      // Try to refresh the token if we have a refresh token
      if (refreshToken) {
        console.log('AuthProvider: Attempting token refresh');
        // Temporarily disable token refresh for desktop version
        console.log('AuthProvider: Token refresh disabled for desktop version');
        clearAuth(); // Clear auth since refresh is not implemented
        return false;
      }

      console.log('AuthProvider: No valid credentials found');
      return false;
    } catch (error) {
      console.error('Authentication check failed:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    console.log('AuthProvider: Logging out');
    clearAuth();
    router.push('/login');
  };

  // Check auth status on mount - only run once
  useEffect(() => {
    if (hasInitialized) return;

    const initialize = async () => {
      console.log('AuthProvider: Starting initialization');
      setIsLoading(true);
      setHasInitialized(true);

      try {
        // If we have a user and access token, we're authenticated
        if (user && accessToken) {
          console.log('AuthProvider: User already authenticated from store');
          setIsLoading(false);
          return;
        }

        // Try to refresh the token if we have a refresh token
        if (refreshToken) {
          console.log('AuthProvider: Attempting to refresh token');
          // Temporarily disable for desktop version
          console.log(
            'AuthProvider: Token refresh disabled for desktop, clearing auth'
          );
          clearAuth();
        } else {
          console.log('AuthProvider: No refresh token available');
        }
      } catch (error) {
        console.error(
          'AuthProvider: Authentication initialization failed:',
          error
        );
        clearAuth();
      } finally {
        setIsLoading(false);
        console.log('AuthProvider: Initialization completed');
      }
    };

    initialize();
  }, [
    hasInitialized,
    user,
    accessToken,
    refreshToken,
    refreshAccessToken,
    clearAuth,
  ]);

  // Cleanup tokens when browser/app is closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear tokens when user closes browser/tab (for security)
      try {
        clearAuth();
      } catch (error) {
        console.warn('Failed to clear auth on beforeunload:', error);
      }
    };

    const handleVisibilityChange = () => {
      // Optional: Clear tokens when tab becomes hidden (more aggressive security)
      // Uncomment if you want tokens cleared when user switches tabs
      // if (document.hidden) {
      //   clearAuth();
      // }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup event listeners
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearAuth]);

  // Simplified token monitoring
  useEffect(() => {
    if (!accessToken || !hasInitialized) return;

    // Set up simple refresh interval
    // Temporarily disabled for desktop version
    console.log(
      'AuthProvider: Periodic token refresh disabled for desktop version'
    );

    // const refreshInterval = setInterval(
    //   () => {
    //     if (refreshToken) {
    //       console.log('AuthProvider: Periodic token refresh');
    //       refreshAccessToken().catch(error => {
    //         console.error('Periodic token refresh failed:', error);
    //       });
    //     }
    //   },
    //   15 * 60 * 1000
    // ); // 15 minutes

    // return () => clearInterval(refreshInterval);
  }, [accessToken, refreshToken, refreshAccessToken, hasInitialized]);

  // Session timeout for security (30 minutes of inactivity)
  useEffect(() => {
    if (!isAuthenticated || !hasInitialized) return;

    let timeoutId: NodeJS.Timeout;
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log('Session timed out due to inactivity');
        clearAuth();
        router.push('/login');
      }, SESSION_TIMEOUT);
    };

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Reset timeout on user activity
    events.forEach(event => {
      document.addEventListener(event, resetTimeout, true);
    });

    // Initialize timeout
    resetTimeout();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout, true);
      });
    };
  }, [isAuthenticated, clearAuth, router, hasInitialized]);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, checkAuth, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
