'use client';
import { useState, useEffect, useCallback } from 'react';
export function useAddonGroups(options = {}) {
    const [addonGroups, setAddonGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Fetch addon groups from backend
    const fetchAddonGroups = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await window.electron.ipc.invoke('addon:getGroups', {
                search: options.search,
                isActive: options.isActive,
                sortBy: options.sortBy || 'name',
                sortOrder: options.sortOrder || 'asc',
                includeStats: true, // Include addons count and categories count
            });
            if (response.success) {
                setAddonGroups(response.data || []);
            }
            else {
                throw new Error(response.error || 'Failed to fetch addon groups');
            }
        }
        catch (err) {
            console.error('Error fetching addon groups:', err);
            setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        }
        finally {
            setLoading(false);
        }
    }, [options.search, options.isActive, options.sortBy, options.sortOrder]);
    // Create addon group
    const createAddonGroup = useCallback(async (data) => {
        try {
            const response = await window.electron.ipc.invoke('addon:createGroup', {
                name: data.name,
                description: data.description,
                minSelections: data.minSelections,
                maxSelections: data.maxSelections,
                isActive: data.isActive,
                sortOrder: data.sortOrder,
            });
            if (response.success) {
                const newGroup = response.data;
                setAddonGroups(prev => [...prev, newGroup]);
                return newGroup;
            }
            else {
                throw new Error(response.error || 'Failed to create addon group');
            }
        }
        catch (err) {
            console.error('Error creating addon group:', err);
            throw err;
        }
    }, []);
    // Update addon group
    const updateAddonGroup = useCallback(async (id, data) => {
        try {
            const response = await window.electron.ipc.invoke('addon:updateGroup', {
                id,
                ...data,
            });
            if (response.success) {
                const updatedGroup = response.data;
                setAddonGroups(prev => prev.map(group => (group.id === id ? updatedGroup : group)));
                return updatedGroup;
            }
            else {
                throw new Error(response.error || 'Failed to update addon group');
            }
        }
        catch (err) {
            console.error('Error updating addon group:', err);
            throw err;
        }
    }, []);
    // Delete addon groups
    const deleteAddonGroups = useCallback(async (ids) => {
        try {
            const response = await window.electron.ipc.invoke('addon:deleteGroups', {
                ids,
            });
            if (response.success) {
                setAddonGroups(prev => prev.filter(group => !ids.includes(group.id)));
            }
            else {
                throw new Error(response.error || 'Failed to delete addon groups');
            }
        }
        catch (err) {
            console.error('Error deleting addon groups:', err);
            throw err;
        }
    }, []);
    // Toggle active status
    const toggleActiveStatus = useCallback(async (id, isActive) => {
        try {
            const response = await window.electron.ipc.invoke('addon:updateGroup', {
                id,
                isActive,
            });
            if (response.success) {
                const updatedGroup = response.data;
                setAddonGroups(prev => prev.map(group => (group.id === id ? updatedGroup : group)));
            }
            else {
                throw new Error(response.error || 'Failed to update addon group status');
            }
        }
        catch (err) {
            console.error('Error toggling addon group status:', err);
            throw err;
        }
    }, []);
    // Refresh data
    const refresh = useCallback(() => {
        fetchAddonGroups();
    }, [fetchAddonGroups]);
    // Initial fetch and refetch when options change
    useEffect(() => {
        fetchAddonGroups();
    }, [fetchAddonGroups]);
    return {
        addonGroups,
        loading,
        error,
        refresh,
        createAddonGroup,
        updateAddonGroup,
        deleteAddonGroups,
        toggleActiveStatus,
    };
}
