'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useAuth } from './AuthProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();
  const user = useAuthStore(state => state.user);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasRedirected, setHasRedirected] = useState(false);

  // Track if we've already performed the auth check for this mount
  const authCheckPerformed = useRef(false);
  const lastPathname = useRef(pathname);

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register'];
  const isPublicRoute = pathname ? publicRoutes.includes(pathname) : false;

  const verifyAuth = useCallback(async () => {
    // Prevent multiple auth checks
    if (hasRedirected) return;

    setIsCheckingAuth(true);

    try {
      // Only log if pathname changed or first check
      if (!authCheckPerformed.current || lastPathname.current !== pathname) {
        console.log('ProtectedRoute verifying auth:', {
          pathname,
          isPublicRoute,
          isAuthenticated,
          hasUser: !!user,
          isLoading,
        });
      }

      // If we're on a public route, allow access
      if (isPublicRoute) {
        setIsAuthorized(true);
        setIsCheckingAuth(false);
        return;
      }

      // If still loading, wait
      if (isLoading) {
        return;
      }

      // Check if the user is authenticated
      if (!isAuthenticated || !user) {
        console.log('ProtectedRoute: Not authenticated, redirecting to login');
        setHasRedirected(true);
        router.replace('/login');
        setIsAuthorized(false);
        return;
      }

      // If authenticated and roles are specified, check role authorization
      if (allowedRoles && allowedRoles.length > 0) {
        const hasRequiredRole = allowedRoles.includes(user.role);
        setIsAuthorized(hasRequiredRole);

        // If not authorized, redirect to dashboard
        if (!hasRequiredRole) {
          console.log(
            'ProtectedRoute: Insufficient permissions, redirecting to dashboard'
          );
          setHasRedirected(true);
          router.replace('/dashboard');
          return;
        }
      } else {
        // If authenticated and no specific roles required
        setIsAuthorized(true);
      }

      // Mark auth check as performed
      authCheckPerformed.current = true;
      lastPathname.current = pathname;
    } finally {
      setIsCheckingAuth(false);
    }
  }, [
    pathname,
    isAuthenticated,
    user,
    router,
    isPublicRoute,
    allowedRoles,
    isLoading,
    hasRedirected,
  ]);

  useEffect(() => {
    // Reset auth check flag when pathname changes
    if (lastPathname.current !== pathname) {
      authCheckPerformed.current = false;
    }
    verifyAuth();
  }, [verifyAuth, pathname]);

  // Show loading state ONLY for initial auth check or when auth is actually loading
  // This prevents conflicts with Next.js loading.tsx files
  if (isCheckingAuth && !authCheckPerformed.current) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900'>
        <div className='text-center'>
          <div className='mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600'></div>
          <p className='text-gray-600 dark:text-gray-400'>
            Verifying access...
          </p>
        </div>
      </div>
    );
  }

  // If on a public route or authorized, render children
  if (isPublicRoute || isAuthorized) {
    return <>{children}</>;
  }

  // This should not be visible as the useEffect should redirect
  return null;
};

export default ProtectedRoute;
