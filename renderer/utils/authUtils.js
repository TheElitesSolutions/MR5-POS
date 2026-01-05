/**
 * Authentication utilities for secure operations
 */
import { useAuthStore } from '@/stores/authStore';
import { Role } from '@/types';
/**
 * Get the current user ID for secure operations
 * This function ensures we always have a valid user ID for operations
 * that require user tracking
 *
 * @returns The current user's ID or throws an error if not authenticated
 */
export function getCurrentUserId() {
    const { user, isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated || !user || !user.id) {
        throw new Error('User must be authenticated to perform this operation');
    }
    return user.id;
}
/**
 * Check if the current user has permission to perform an action
 *
 * @param requiredRole The minimum role required to perform the action
 * @returns True if the user has sufficient permissions, false otherwise
 */
export function hasPermission(requiredRole) {
    const { user, isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated || !user || !user.role) {
        return false;
    }
    // Handle permission hierarchy
    if (user.role === Role.OWNER) {
        return true; // Owners can do anything
    }
    if (user.role === Role.MANAGER && requiredRole !== Role.OWNER) {
        return true; // Managers can do anything except owner-only tasks
    }
    if (user.role === Role.EMPLOYEE && requiredRole === Role.EMPLOYEE) {
        return true; // Employees can only do employee tasks
    }
    return false;
}
/**
 * Verify permissions and throw an error if the user doesn't have sufficient privileges
 *
 * @param requiredRole The minimum role required to perform the action
 * @throws Error if the user doesn't have sufficient permissions
 */
export function verifyPermission(requiredRole) {
    if (!hasPermission(requiredRole)) {
        throw new Error('Insufficient permissions to perform this operation');
    }
}
/**
 * Get the current user's display name
 *
 * @returns The user's name or username or user ID
 */
export function getUserDisplayName() {
    const { user } = useAuthStore.getState();
    if (!user) {
        return 'Unknown User';
    }
    // Check for name first
    if (user.name) {
        return user.name;
    }
    // Fall back to username if available
    if (user.username) {
        return user.username;
    }
    // Last resort: user ID
    return user.id || 'Unknown User';
}
export default {
    getCurrentUserId,
    hasPermission,
    verifyPermission,
    getUserDisplayName,
};
