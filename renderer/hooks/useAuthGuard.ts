import { useAuthStore, useUserPermissions } from '@/stores/authStore';
import { Role } from '@/types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useRef } from 'react';

interface UseAuthGuardOptions {
  requiredRoles?: Role[];
  redirectTo?: string;
  requireAuth?: boolean;
}

interface AuthGuardState {
  isLoading: boolean;
  isAuthenticated: boolean;
  hasAccess: boolean;
  user: any;
  permissions: any;
  error: string | null;
}

/**
 * Hook to handle authentication and permission checks without race conditions
 * Prevents multiple simultaneous auth checks and provides stable loading states
 */
export const useAuthGuard = (options: UseAuthGuardOptions = {}): AuthGuardState => {
  const {
    requiredRoles = [],
    redirectTo = '/login',
    requireAuth = true,
  } = options;

  const router = useRouter();
  const { isAuthenticated, user, isLoading: authLoading } = useAuthStore();
  const permissions = useUserPermissions();

  // Component-level states to prevent race conditions
  const [isInitializing, setIsInitializing] = useState(true);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [permissionCheckComplete, setPermissionCheckComplete] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to prevent multiple simultaneous checks
  const checkInProgress = useRef(false);
  const lastCheckTime = useRef(0);
  const CHECK_DEBOUNCE_MS = 100; // Debounce rapid auth checks

  // Stable permission check function
  const checkPermissions = useCallback(() => {
    // Only log significant permission checks
    if (process.env.NODE_ENV === 'development' && requiredRoles.length > 0) {
      console.log('AuthGuard: Checking permissions', {
        isAuthenticated,
        user: user?.username,
        role: user?.role,
        requiredRoles,
      });
    }

    if (!isAuthenticated || !user) {
      return { hasAccess: false, shouldRedirect: requireAuth };
    }

    // If no specific roles required, just need to be authenticated
    if (requiredRoles.length === 0) {
      return { hasAccess: true, shouldRedirect: false };
    }

    // Check if user has any of the required roles
    const hasRequiredRole = requiredRoles.some(role => permissions.hasRole(role));
    
    return { 
      hasAccess: hasRequiredRole, 
      shouldRedirect: !hasRequiredRole && isAuthenticated && user 
    };
  }, [isAuthenticated, user, requiredRoles, permissions, requireAuth]);

  // Sequential auth and permission check
  const performAuthCheck = useCallback(async () => {
    // Debounce rapid auth checks
    const now = Date.now();
    if (now - lastCheckTime.current < CHECK_DEBOUNCE_MS) {
      return;
    }
    
    if (checkInProgress.current || authLoading || permissions.isLoading) {
      return;
    }
    
    lastCheckTime.current = now;

    checkInProgress.current = true;
    setIsInitializing(true);
    setError(null);

    try {
      // Reduce logging noise
      if (process.env.NODE_ENV === 'development' && requiredRoles.length > 0) {
        console.log('AuthGuard: Starting auth check');
      }

      // Wait for auth loading to complete
      if (authLoading) {
        console.log('AuthGuard: Waiting for auth loading');
        return;
      }

      setAuthCheckComplete(true);

      // Wait for permissions loading to complete
      if (permissions.isLoading) {
        console.log('AuthGuard: Waiting for permissions loading');
        return;
      }

      // Perform permission check
      const permissionResult = checkPermissions();
      setPermissionCheckComplete(true);
      setHasAccess(permissionResult.hasAccess);

      // Handle redirects
      if (permissionResult.shouldRedirect) {
        console.log('AuthGuard: Redirecting due to auth/permission check', {
          redirectTo,
          reason: !isAuthenticated ? 'not_authenticated' : 'insufficient_permissions'
        });
        router.push(redirectTo);
        return;
      }

      // Only log meaningful completions
      if (process.env.NODE_ENV === 'development' && requiredRoles.length > 0) {
        console.log('AuthGuard: Auth check completed', {
          hasAccess: permissionResult.hasAccess,
          isAuthenticated,
          user: user?.username,
        });
      }
    } catch (error) {
      console.error('AuthGuard: Auth check error:', error);
      setError(error instanceof Error ? error.message : 'Authentication check failed');
    } finally {
      setIsInitializing(false);
      checkInProgress.current = false;
    }
  }, [
    authLoading,
    permissions.isLoading,
    checkPermissions,
    isAuthenticated,
    user,
    router,
    redirectTo
  ]);

  // Run auth check when dependencies change
  useEffect(() => {
    performAuthCheck();
  }, [performAuthCheck]);

  // Reset state when user changes
  useEffect(() => {
    if (!user) {
      setAuthCheckComplete(false);
      setPermissionCheckComplete(false);
      setHasAccess(false);
      checkInProgress.current = false;
    }
  }, [user]);

  const isLoading = authLoading || permissions.isLoading || isInitializing || !authCheckComplete || !permissionCheckComplete;

  return {
    isLoading,
    isAuthenticated: isAuthenticated && !!user,
    hasAccess,
    user,
    permissions,
    error,
  };
}; 