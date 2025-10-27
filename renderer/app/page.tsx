'use client';

import { useAuth } from '@/components/AuthProvider';
import { useAuthStore, useUserPermissions } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user, _hasHydrated } = useAuthStore();
  const { isLoading: authLoading } = useAuth();
  const permissions = useUserPermissions();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Prevent multiple redirects
    if (hasRedirected) return;

    // Wait for store hydration first
    if (!_hasHydrated) {
      console.log('Homepage: Waiting for store hydration...');
      return;
    }

    // Wait for auth to finish loading
    if (authLoading) return;

    console.log('Homepage redirect logic:', {
      isAuthenticated,
      user: user?.username,
      canViewDashboard: permissions.isManager || permissions.isAdmin,
      authLoading,
      storeHydrated: _hasHydrated,
      isElectron: typeof window !== 'undefined' && window.electronAPI,
    });

    setHasRedirected(true);

    if (isAuthenticated && user) {
      // Redirect to dashboard if user has permissions, otherwise to POS
      const targetRoute =
        permissions.isManager || permissions.isAdmin ? '/dashboard' : '/pos';

      // In Electron, use window.location for more reliable navigation
      if (typeof window !== 'undefined' && window.electronAPI) {
        const targetPath = targetRoute.substring(1); // Remove leading slash
        window.location.href = `./${targetPath}/`;
      } else {
        router.replace(targetRoute);
      }
    } else if (!authLoading) {
      // Redirect to login page
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.location.href = './login/';
      } else {
        router.replace('/login');
      }
    }
  }, [
    isAuthenticated,
    user,
    permissions.isManager,
    permissions.isAdmin,
    router,
    authLoading,
    hasRedirected,
    _hasHydrated,  // Add hydration dependency
  ]);

  return (
    <div className='flex min-h-screen items-center justify-center bg-background dark:bg-gray-900'>
      <div className='text-center'>
        <div className='mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600'></div>
        <h1 className='mb-4 text-3xl font-bold text-gray-900 dark:text-white'>
          Welcome to The Elites POS
        </h1>
        <p className='text-gray-600 dark:text-gray-400'>
          {!_hasHydrated ? 'Initializing...' : 'Loading...'}
        </p>
      </div>
    </div>
  );
}