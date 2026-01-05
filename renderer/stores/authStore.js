import { ipcAPI } from '@/lib/ipc-api';
import { Role } from '@/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// Map IPC UserRole to our Role enum
const mapUserRole = (role) => {
    switch (role) {
        case 'OWNER':
            return Role.OWNER;
        case 'ADMIN': // Map ADMIN to OWNER for full access
            return Role.OWNER;
        case 'MANAGER':
            return Role.MANAGER;
        case 'EMPLOYEE':
        case 'CASHIER':
        case 'WAITER':
        case 'KITCHEN':
            return Role.EMPLOYEE;
        default:
            return Role.EMPLOYEE;
    }
};
const handleApiError = (error) => {
    console.error('API Error:', error);
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred';
};
export const useAuthStore = create()(persist((set, get) => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    lastTokenCheck: 0,
    // Hydration tracking
    _hasHydrated: false,
    setHasHydrated: (state) => {
        set({ _hasHydrated: state });
    },
    login: async (credentials) => {
        try {
            set({ isLoading: true, error: null });
            console.log('AuthStore: Attempting login with credentials:', {
                username: credentials.username,
                passwordLength: credentials.password?.length || 0,
            });
            // Validate credentials before sending
            if (!credentials.username || !credentials.password) {
                throw new Error('Username and password are required');
            }
            console.log('AuthStore: Calling ipcAPI.auth.login...');
            const response = await ipcAPI.auth.login(credentials);
            console.log('AuthStore: Login response received:', response);
            if (!response) {
                console.error('AuthStore: No response received from IPC call');
                throw new Error('No response from authentication service');
            }
            if (!response.success || !response.data) {
                console.error('AuthStore: Login failed:', response.error);
                throw new Error(response.error || 'Authentication failed');
            }
            const authData = response.data;
            // Validate the response data
            if (!authData.user ||
                !authData.accessToken ||
                !authData.refreshToken) {
                console.error('AuthStore: Invalid auth data received:', {
                    hasUser: !!authData.user,
                    hasAccessToken: !!authData.accessToken,
                    hasRefreshToken: !!authData.refreshToken,
                });
                throw new Error('Invalid authentication data received');
            }
            // Debug logging
            console.log('Auth Store Login Response:', {
                hasUser: !!authData.user,
                hasAccessToken: !!authData.accessToken,
                hasRefreshToken: !!authData.refreshToken,
                user: authData.user,
            });
            // Store tokens securely
            // Note: refresh token should also be in an httpOnly cookie from the backend
            const now = Date.now();
            set({
                user: {
                    ...authData.user,
                    name: authData.user.firstName + ' ' + authData.user.lastName,
                    role: mapUserRole(authData.user.role),
                },
                accessToken: authData.accessToken,
                refreshToken: authData.refreshToken,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                lastTokenCheck: now,
            });
        }
        catch (error) {
            console.error('AuthStore: Login error:', error);
            // Handle different error types
            if (error instanceof Error) {
                // Standard JS Error object
                set({
                    error: error.message || 'Authentication failed',
                    isLoading: false,
                    isAuthenticated: false,
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                });
            }
            else if (typeof error === 'string') {
                // String error
                set({
                    error: error,
                    isLoading: false,
                    isAuthenticated: false,
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                });
            }
            else {
                // Unknown error type
                set({
                    error: 'An unknown authentication error occurred',
                    isLoading: false,
                    isAuthenticated: false,
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                });
            }
            throw error;
        }
    },
    register: async (userData) => {
        try {
            set({ isLoading: true, error: null });
            // TODO: Implement registration logic
            console.log('Registration data:', userData);
            // Simulate success
            setTimeout(() => {
                set({
                    isLoading: false,
                    error: null,
                });
            }, 1000);
        }
        catch (error) {
            console.error('Registration error:', error);
            set({
                isLoading: false,
                error: handleApiError(error),
            });
        }
    },
    logout: () => {
        // Call logout endpoint to invalidate tokens on the server
        const { accessToken, refreshToken } = get();
        if (accessToken && refreshToken) {
            ipcAPI.auth.logout({ accessToken, refreshToken }).catch(() => {
                // Ignore errors for logout
            });
        }
        // Clear state
        get().clearAuth();
    },
    clearAuth: () => {
        // Clear all authentication state
        set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            error: null,
            isLoading: false,
            lastTokenCheck: 0,
        });
        // Clear persisted storage manually to ensure complete cleanup
        try {
            localStorage.removeItem('auth-storage');
        }
        catch (error) {
            console.warn('Failed to clear localStorage:', error);
        }
        // Clear any auth cookies on the client side
        try {
            document.cookie =
                'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' +
                    window.location.hostname;
            document.cookie =
                'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' +
                    window.location.hostname;
        }
        catch (error) {
            console.warn('Failed to clear cookies:', error);
        }
    },
    refreshAccessToken: async () => {
        try {
            // Only attempt refresh if we have a refresh token
            if (!get().refreshToken) {
                return false;
            }
            const response = await ipcAPI.auth.refreshToken(get().refreshToken || '');
            if (!response.success || !response.data) {
                throw new Error(response.error || 'Token refresh failed');
            }
            const tokenData = response.data;
            const now = Date.now();
            set({
                accessToken: tokenData.accessToken,
                isAuthenticated: true,
                lastTokenCheck: now,
            });
            return true;
        }
        catch {
            // If refresh fails, clear auth
            get().clearAuth();
            return false;
        }
    },
    getMe: async () => {
        const { lastTokenCheck, accessToken } = get();
        const now = Date.now();
        // Prevent excessive API calls - only check every 30 seconds
        if (now - lastTokenCheck < 30000) {
            return;
        }
        // Don't attempt if no access token
        if (!accessToken) {
            throw new Error('No access token available');
        }
        try {
            set({ isLoading: true });
            const response = await ipcAPI.auth.getCurrentUser(accessToken);
            if (!response.success || !response.data) {
                throw new Error(response.error || 'Failed to get user data');
            }
            const userData = response.data;
            set({
                user: {
                    ...userData,
                    name: userData.firstName + ' ' + userData.lastName,
                    role: mapUserRole(userData.role),
                },
                isAuthenticated: true,
                isLoading: false,
                lastTokenCheck: now,
            });
        }
        catch (fetchError) {
            // If getMe fails, but we have tokens, it might be a network issue
            // Don't clear auth immediately, let the token refresh handle it
            console.warn('Failed to fetch user profile:', fetchError);
            set({ isLoading: false });
        }
    },
    setTokens: (accessToken, refreshToken) => {
        set({
            accessToken,
            refreshToken,
            isAuthenticated: true,
            lastTokenCheck: Date.now(),
        });
    },
    clearError: () => set({ error: null }),
    setLoading: (loading) => set({ isLoading: loading }),
    updateProfile: async (updates) => {
        try {
            set({ isLoading: true, error: null });
            // TODO: Implement profile update logic
            console.log('Profile update data:', updates);
            // Simulate success
            setTimeout(() => {
                set({
                    isLoading: false,
                    error: null,
                });
            }, 1000);
        }
        catch (error) {
            console.error('Profile update error:', error);
            set({
                isLoading: false,
                error: handleApiError(error),
            });
        }
    },
}), {
    name: 'auth-storage',
    onRehydrateStorage: () => {
        console.log('[AUTH STORE] Starting rehydration from localStorage');
        return (state, error) => {
            if (error) {
                console.error('[AUTH STORE] Rehydration failed:', error);
            }
            else {
                console.log('[AUTH STORE] Rehydration complete', {
                    hasUser: !!state?.user,
                    isAuthenticated: state?.isAuthenticated,
                });
                state?.setHasHydrated(true);
            }
        };
    },
    partialize: state => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        lastTokenCheck: state.lastTokenCheck,
        // Don't persist _hasHydrated - it should reset on mount
    }),
}));
// Export custom hook to check hydration status
export const useAuthHydration = () => {
    return useAuthStore(state => state._hasHydrated);
};
/**
 * Custom hook to get user permissions
 */
export const useUserPermissions = () => {
    const { user, isLoading, isAuthenticated } = useAuthStore();
    const role = user?.role;
    // Return loading state to prevent race conditions
    if (isLoading || !isAuthenticated || !user) {
        return {
            isAdmin: false,
            isManager: false,
            isStaff: false,
            hasRole: () => false,
            isLoading: true,
        };
    }
    const isAdmin = role === Role.OWNER;
    const isManager = role === Role.MANAGER;
    const isStaff = role === Role.EMPLOYEE;
    const hasRole = (requiredRole) => {
        if (!role)
            return false;
        if (requiredRole === Role.OWNER) {
            return role === Role.OWNER;
        }
        if (requiredRole === Role.MANAGER) {
            return role === Role.OWNER || role === Role.MANAGER;
        }
        // Everyone has EMPLOYEE level access
        return true;
    };
    return {
        isAdmin,
        isManager,
        isStaff,
        hasRole,
        isLoading: false,
    };
};
