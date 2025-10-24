import { menuAPI } from '@/lib/ipc-api';
import { create } from 'zustand';
import {
  CreateMenuItemRequest,
  DeleteMenuItemRequest,
  MenuItem,
  UpdateMenuItemRequest,
} from '../../shared/ipc-types';
import {
  getCurrentUserId,
  verifyPermission,
  getUserDisplayName,
} from '@/utils/authUtils';
import { Role } from '@/types';
import { cache, generateCacheKey } from '@/utils/cacheUtils';
import { detectVersionConflict, ConflictType } from '@/utils/versionUtils';
import { recordAudit, calculateChanges } from '@/utils/auditUtils';

import { checkMenuItemDeletionIntegrity } from '@/utils/integrityUtils';
import { getLastDeletedEntity } from '@/utils/restoreUtils';
import {
  UIMenuItem,
  convertToUIMenuItem,
  convertToAPIMenuItem,
} from '@/types/menu';

// Define pagination state
interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  search: string;
  category: string;
}

interface MenuState {
  menuItems: UIMenuItem[];
  categories: string[];
  isLoading: boolean;
  error: string | null;

  // Pagination state
  pagination: PaginationState;

  // Actions
  _internalFetchMenuItems: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
  }) => Promise<void>;
  _internalFetchCategories: () => Promise<void>;
  createMenuItem: (
    itemData: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<UIMenuItem>;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  toggleMenuItemAvailability: (id: string) => Promise<void>;

  // Restore deleted items
  restoreMenuItem: (id: string) => Promise<void>;

  // Category management
  createCategory: (name: string) => Promise<void>;
  updateCategory: (oldName: string, newName: string) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;

  // Pagination actions
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (search: string) => void;
  setCategory: (category: string) => void;
  clearSearch: () => void;

  clearError: () => void;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  menuItems: [],
  categories: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 12,
    totalItems: 0,
    totalPages: 0,
    search: '',
    category: '',
  },

  // Private internal method for store's own use (no deprecation warnings)
  _internalFetchMenuItems: async params => {
    try {
      set({ isLoading: true, error: null });

      const { pagination } = get();

      // Merge current pagination state with provided params
      const queryParams = {
        page: params?.page || pagination.page,
        pageSize: params?.pageSize || pagination.pageSize,
        search:
          params?.search !== undefined ? params.search : pagination.search,
        category:
          params?.category !== undefined
            ? params.category
            : pagination.category,
      };

      // Generate a cache key for this specific query
      const cacheKey = generateCacheKey('menuItems', queryParams);

      if (process.env.NODE_ENV === 'development') {
        console.log(
          'Menu Store: _internalFetchMenuItems called with params:',
          queryParams
        );
      }

      // Check if we have a cached response
      const cachedData = cache.get(cacheKey);

      if (cachedData) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Menu Store: Using cached data for', cacheKey);
        }
        // Update state from cache
        const cachedResponse = cachedData as {
          items: MenuItem[];
          total: number;
          page: number;
          pageSize: number;
        };

        // Convert API menu items to UI menu items - add null safety for cached data
        const uiMenuItems = Array.isArray(cachedResponse.items)
          ? cachedResponse.items.map(item => convertToUIMenuItem(item))
          : [];

        set({
          menuItems: uiMenuItems,
          isLoading: false,
          pagination: {
            ...pagination,
            page: cachedResponse.page,
            pageSize: cachedResponse.pageSize,
            totalItems: cachedResponse.total,
            totalPages: Math.ceil(
              cachedResponse.total / cachedResponse.pageSize
            ),
            search: queryParams.search,
            category: queryParams.category,
          },
        });

        // Refresh the data in the background to keep cache fresh
        menuAPI
          .getAll(queryParams)
          .then(response => {
            if (response.success && response.data) {
              // Update cache with fresh data
              cache.set(cacheKey, response.data);
            }
          })
          .catch(err => {
            console.warn('Background cache refresh failed:', err);
          });

        return; // Exit early with cached data
      }

      // No cache hit, fetch from API
      const response = await menuAPI.getAll(queryParams);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch menu items');
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('Menu Store: API response:', {
          success: response.success,
          itemCount: response.data?.items?.length,
          total: response.data?.total,
        });
      }

      // Add null checks to prevent "Cannot read properties of undefined (reading 'map')" error
      const {
        items: apiMenuItems = [],
        total = 0,
        page = 1,
        pageSize = 12,
      } = response.data || {};
      const totalPages = Math.ceil(total / pageSize);

      console.log('📥 Menu Store: Received API items:', {
        count: apiMenuItems.length,
        items: apiMenuItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          categoryId: item.categoryId,
          price: item.price,
        })),
      });

      // Store response in cache (expires in 5 minutes)
      cache.set(cacheKey, response.data, 5 * 60 * 1000);

      // Convert API menu items to UI menu items - with complete null safety
      const menuItems =
        Array.isArray(apiMenuItems) && apiMenuItems.length > 0
          ? (apiMenuItems
              .map(item => (item ? convertToUIMenuItem(item) : null))
              .filter(Boolean) as UIMenuItem[])
          : [];

      console.log('🎨 Menu Store: Converted to UI items:', {
        count: menuItems.length,
        items: menuItems.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          categoryId: item.categoryId,
          price: item.price,
        })),
      });

      // Update pagination state
      set({
        menuItems,
        isLoading: false,
        pagination: {
          ...pagination,
          page,
          pageSize,
          totalItems: total,
          totalPages,
          search: queryParams.search,
          category: queryParams.category,
        },
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('Menu Store: Fetched menu items successfully', {
          items: menuItems.length,
          total,
          page,
          totalPages,
        });
      }
    } catch (error) {
      console.error('Menu Store: Failed to fetch menu items', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to fetch menu items',
        isLoading: false,
      });
    }
  },

  // Private internal method for fetching categories (no deprecation warnings)
  _internalFetchCategories: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await menuAPI.getCategories();
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch categories');
      }

      // Safety check for array
      if (!Array.isArray(response.data)) {
        console.warn(
          'Menu Store: Categories response is not an array:',
          response.data
        );
        set({ categories: [], isLoading: false });
        return;
      }

      // FIX: Store full category objects with id and name (not just names)
      // This allows frontend to send categoryId for optimal backend filtering
      const categoryObjects = response.data
        .filter((c: any) => c !== null && typeof c === 'object')
        .filter((c: any) => c.id && c.name && typeof c.name === 'string' && c.name.trim())
        .map((c: any) => ({ id: c.id, name: c.name }));

      // Make sure we have unique categories (by id)
      const uniqueCategories = Array.from(
        new Map(categoryObjects.map(c => [c.id, c])).values()
      );

      // Ensure we're not setting an empty array if we previously had categories
      const { categories: existingCategories } = get();
      if (uniqueCategories.length === 0 && existingCategories.length > 0) {
        console.warn(
          'Menu Store: Received empty categories from server, keeping existing categories'
        );
        set({ isLoading: false });
      } else {
        set({ categories: uniqueCategories as any, isLoading: false });
        if (process.env.NODE_ENV === 'development') {
          console.log(
            'Menu Store: Fetched categories successfully',
            uniqueCategories
          );
        }
      }

      // FIX: Backup extraction from menu items if API returned no categories
      // IMPORTANT: Must preserve object structure {id, name}, not convert to strings
      const { menuItems } = get();
      if (
        Array.isArray(menuItems) &&
        menuItems.length > 0 &&
        uniqueCategories.length === 0  // FIX: was uniqueNames (ReferenceError!)
      ) {
        // Extract unique category objects from menu items
        const categoryMap = new Map<string, { id: string; name: string }>();

        menuItems
          .filter(item => item && typeof item === 'object')
          .forEach(item => {
            // Each menu item has categoryId and category (name)
            if (item.categoryId && item.category && typeof item.category === 'string') {
              categoryMap.set(item.categoryId, {
                id: item.categoryId,
                name: item.category
              });
            }
          });

        const categoriesFromItems = Array.from(categoryMap.values());

        if (categoriesFromItems.length > 0) {
          set({ categories: categoriesFromItems as any });
          if (process.env.NODE_ENV === 'development') {
            console.log(
              'Menu Store: Used categories from menu items as fallback',
              categoriesFromItems
            );
          }
        }
      }
    } catch (error) {
      console.error('Menu Store: Failed to fetch categories', error);
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch menu categories',
        isLoading: false,
      });

      // Fallback to extracting categories from menu items with safety checks
      try {
        const { menuItems } = get();
        if (Array.isArray(menuItems) && menuItems.length > 0) {
          const categoriesFromItems = menuItems
            .filter(item => item && typeof item === 'object')
            .map(item => item.category)
            .filter((category: string) =>
              Boolean(category && typeof category === 'string')
            )
            .filter((v, i, a) => a.indexOf(v) === i); // Unique values

          if (categoriesFromItems.length > 0) {
            set({
              categories: categoriesFromItems,
              isLoading: false,
              error: null,
            });
            if (process.env.NODE_ENV === 'development') {
              console.log(
                'Menu Store: Used categories from menu items as fallback after error',
                categoriesFromItems
              );
            }
          }
        }
      } catch (fallbackError) {
        console.error(
          'Menu Store: Fallback category extraction failed',
          fallbackError
        );
      }
    }
  },

  createMenuItem: async itemData => {
    // 🔍 DIAGNOSTIC: Log what we received from the form
    console.log('🔍 menuStore.createMenuItem - Received itemData:', {
      name: itemData.name,
      price: itemData.price,
      category: itemData.category,
      ingredientsCount: itemData.ingredients?.length || 0,
      ingredients: itemData.ingredients,
      hasIngredients: !!itemData.ingredients,
      isArray: Array.isArray(itemData.ingredients),
    });

    // Create a temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create an optimistic version of the new item
    const optimisticItem: UIMenuItem = {
      id: tempId,
      ...itemData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOptimistic: true, // Flag to identify optimistic items
    };

    // Save the current state for potential rollback
    const previousState = get();

    try {
      // Apply optimistic update immediately
      const { menuItems, categories } = previousState;
      const updatedMenuItems = [...menuItems, optimisticItem];

      // Update categories if new category was added - with null safety
      const updatedCategories = [
        ...new Set([
          ...(Array.isArray(categories) ? categories : []),
          optimisticItem.category,
        ]),
      ].filter(Boolean);

      // Update UI immediately
      set({
        menuItems: updatedMenuItems,
        categories: updatedCategories,
        isLoading: true, // Show loading spinner during the actual request
        error: null,
      });

      // Verify the user has permission to create menu items
      verifyPermission(Role.MANAGER);

      // Get the actual user ID from auth store
      const userId = getCurrentUserId();

      // Ensure all required fields are present and properly formatted
      // Only apply defaults if values are actually missing (undefined/null), not empty strings or 0
      // Use categoryId if provided, otherwise fall back to category
      const categoryValue = itemData.categoryId || itemData.category || 'Uncategorized';
      
      const sanitizedData = {
        ...itemData,
        name: itemData.name?.trim() || 'New Item',
        description: itemData.description !== undefined ? (itemData.description?.trim() || '') : '',
        price: itemData.price !== undefined ? itemData.price : 0,
        category: categoryValue, // Use the resolved category value
        categoryId: categoryValue, // Also set categoryId explicitly
        isAvailable: itemData.isAvailable !== undefined ? !!itemData.isAvailable : true,
        isActive: itemData.isActive !== undefined ? !!itemData.isActive : true,
        isCustomizable: itemData.isCustomizable !== undefined ? !!itemData.isCustomizable : false,
        ingredients: itemData.ingredients || [], // ✅ EXPLICIT preservation
        allergens: itemData.allergens || [], // ✅ EXPLICIT preservation
        id: '', // Will be generated by the server
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log('🔧 menuStore.createMenuItem sanitized:', {
        ...sanitizedData,
        categoryId: sanitizedData.categoryId,
        category: sanitizedData.category,
        ingredientsCount: sanitizedData.ingredients?.length || 0,
        hasIngredients: !!sanitizedData.ingredients && sanitizedData.ingredients.length > 0,
      });

      // Convert to API format and create request with the proper userId
      const createRequest: CreateMenuItemRequest = {
        menuItem: convertToAPIMenuItem(sanitizedData as UIMenuItem),
        userId,
      };

      // Perform the actual API call
      const response = await menuAPI.create(createRequest);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create menu item');
      }

      // Get the real item from the server and convert to UI format
      const apiItem = response.data;
      const newItem = convertToUIMenuItem(apiItem);

      // Replace the optimistic item with the real one
      set(state => ({
        menuItems: state.menuItems.map(item =>
          item.id === tempId ? newItem : item
        ),
        isLoading: false,
      }));

      // Refresh categories to ensure new item's category appears
      try {
        const categoriesResponse = await menuAPI.getCategories();
        if (categoriesResponse.success && categoriesResponse.data) {
          const refreshedCategories = categoriesResponse.data.map(
            (cat: any) => cat.name || cat
          );

          set(state => ({
            ...state,
            categories: refreshedCategories,
          }));

          if (process.env.NODE_ENV === 'development') {
            console.log(
              'Menu Store: Categories refreshed after item creation',
              refreshedCategories
            );
          }
        }
      } catch (categoryError) {
        console.warn(
          'Menu Store: Failed to refresh categories after item creation:',
          categoryError
        );
        // Don't fail the entire operation for category refresh failure
      }

      // Invalidate relevant caches
      const removedCacheEntries = cache.removeByPrefix('menuItems');
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `Menu Store: Invalidated ${removedCacheEntries} cache entries`
        );
      }

      // Record audit trail
      // Get user display name directly
      await recordAudit({
        entityId: newItem.id,
        entityType: 'menuItem',
        action: 'create',
        timestamp: new Date().toISOString(),
        userId,
        userName: getUserDisplayName(),
        metadata: {
          name: newItem.name,
          category: newItem.category,
        },
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('Menu Store: Created menu item successfully', newItem);
      }

      // Return the created item to the caller
      return newItem;
    } catch (error) {
      console.error('Menu Store: Failed to create menu item', error);

      // Roll back optimistic update on error
      set({
        // Remove the optimistic item from the array
        menuItems: previousState.menuItems,
        categories: previousState.categories,
        error:
          error instanceof Error ? error.message : 'Failed to create menu item',
        isLoading: false,
      });
      throw error;
    }
  },

  updateMenuItem: async (id, updates) => {
    // Save the current state for potential rollback
    const previousState = get();
    const { menuItems } = previousState;

    // Find the item to update
    const itemToUpdate = menuItems.find(item => item.id === id);

    if (!itemToUpdate) {
      throw new Error(`Menu item with ID ${id} not found`);
    }

    try {
      // First check if the item has been modified since we last loaded it
      // Get the latest version of the item from the server for comparison
      const itemResponse = await menuAPI.getById(id);

      if (itemResponse.success && itemResponse.data) {
        const serverItem = itemResponse.data;

        // Detect version conflicts
        const conflict = detectVersionConflict(itemToUpdate, serverItem);

        // Handle conflicts
        if (conflict) {
          switch (conflict.type) {
            case ConflictType.DELETED:
              throw new Error(
                'This item has been deleted and cannot be updated.'
              );

            case ConflictType.MODIFIED:
              // We could handle this differently with a confirmation,
              // but for now, we'll just throw an error
              throw new Error(
                'This item has been modified by another user. Please refresh and try again.'
              );

            default:
              throw new Error(`Conflict detected: ${conflict.message}`);
          }
        }
      }

      // Apply optimistic update immediately - with proper typing
      const updatedMenuItems = menuItems.map(item => {
        if (item.id === id) {
          return {
            ...item,
            ...updates,
            updatedAt: new Date().toISOString(),
            isOptimisticallyUpdated: true, // Flag for optimistic update
          } as UIMenuItem;
        }
        return item;
      });

      // Update categories if a new category was added
      const updatedCategories = [
        ...new Set(updatedMenuItems.map(item => item.category)),
      ].filter(Boolean);

      // Update UI immediately with optimistic update
      set({
        menuItems: updatedMenuItems,
        categories: updatedCategories,
        isLoading: true,
        error: null,
      });

      // Verify the user has permission to update menu items
      verifyPermission(Role.MANAGER);

      // Get the actual user ID from auth store
      const userId = getCurrentUserId();

      // Convert to API format and create the request object
      const apiUpdates = {
        ...updates,
        // Include current version info for server-side version checking
        _lastKnownUpdatedAt: itemToUpdate.updatedAt,
      };

      const updateRequest: UpdateMenuItemRequest = {
        id,
        updates: apiUpdates,
        userId,
      };

      // Perform the actual API call
      const response = await menuAPI.update(updateRequest);

      if (!response.success || !response.data) {
        // Check if this is a version conflict reported by the server
        if (
          response.error?.includes('version conflict') ||
          response.error?.includes('modified by another user')
        ) {
          throw new Error(`Version conflict: ${response.error}`);
        }
        throw new Error(response.error || 'Failed to update menu item');
      }

      // Convert API response to UI format
      const apiItem = response.data;
      const updatedItem = convertToUIMenuItem(apiItem);

      // Replace the optimistically updated item with the real one
      const finalMenuItems = menuItems.map(item =>
        item.id === id ? updatedItem : item
      );

      // Finalize categories
      const finalCategories = [
        ...new Set(finalMenuItems.map(item => item.category)),
      ].filter(Boolean);

      set({
        menuItems: finalMenuItems,
        categories: finalCategories,
        isLoading: false,
      });

      // Invalidate ALL menu-related caches to ensure fresh data
      const removedCacheEntries = cache.removeByPrefix('menuItems');
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `Menu Store: Invalidated ${removedCacheEntries} cache entries after item update`
        );
      }

      // Record audit trail with detailed changes
      // Get user display name directly
      const changes = calculateChanges(itemToUpdate, updatedItem);
      await recordAudit({
        entityId: id,
        entityType: 'menuItem',
        action: 'update',
        timestamp: new Date().toISOString(),
        userId,
        userName: getUserDisplayName(),
        changes,
        metadata: {
          name: updatedItem.name,
          category: updatedItem.category,
        },
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('Menu Store: Updated menu item successfully', updatedItem);
      }
    } catch (error) {
      console.error('Menu Store: Failed to update menu item', error);

      // Roll back optimistic update on error
      set({
        menuItems: previousState.menuItems,
        categories: previousState.categories,
        error:
          error instanceof Error ? error.message : 'Failed to update menu item',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteMenuItem: async id => {
    // Save the current state for potential rollback
    const previousState = get();
    const { menuItems } = previousState;

    // Find the item to delete
    const itemToDelete = menuItems.find(item => item.id === id);

    if (!itemToDelete) {
      throw new Error(`Menu item with ID ${id} not found`);
    }

    try {
      // Perform integrity checks before proceeding with deletion
      const integrityResult = await checkMenuItemDeletionIntegrity(
        id,
        itemToDelete.name
      );

      // If there are errors that prevent deletion, throw an error
      if (!integrityResult.canProceed) {
        const errorMessages = integrityResult.errors
          .map(err => err.message)
          .join('. ');
        throw new Error(`Cannot delete menu item: ${errorMessages}`);
      }

      // If there are warnings, log them (in a real app, we might show these to the user)
      if (integrityResult.warnings.length > 0) {
        const warningMessages = integrityResult.warnings
          .map(warning => warning.message)
          .join('. ');
        console.warn(`Deletion warnings: ${warningMessages}`);
      }

      // First check if the item has been modified since we last loaded it
      // Get the latest version of the item from the server for comparison
      const itemResponse = await menuAPI.getById(id);

      // Handle item not found or already deleted
      if (!itemResponse.success || !itemResponse.data) {
        // Item may have already been deleted, so we'll continue
        console.warn(
          `Menu item ${id} not found on server, may already be deleted`
        );
      } else {
        // Check for version conflicts
        const serverItem = itemResponse.data;
        const conflict = detectVersionConflict(itemToDelete, serverItem);

        if (conflict && conflict.type === ConflictType.MODIFIED) {
          // If the item was modified, we should warn the user
          throw new Error(
            'This item has been modified by another user. Please refresh and try again.'
          );
        }
      }

      // Apply optimistic update immediately
      const updatedMenuItems = menuItems.filter(item => item.id !== id);

      // Update categories if a category is no longer used
      const updatedCategories = [
        ...new Set(updatedMenuItems.map(item => item.category)),
      ].filter(Boolean);

      // Update UI immediately with optimistic update
      set({
        menuItems: updatedMenuItems,
        categories: updatedCategories,
        isLoading: true,
        error: null,
      });

      // Verify the user has permission to delete menu items
      verifyPermission(Role.MANAGER);

      // Get the actual user ID from auth store
      const userId = getCurrentUserId();

      // Create the request object with the proper userId
      const deleteRequest: DeleteMenuItemRequest = {
        id,
        userId,
        // Include version info for server-side conflict detection
        _lastKnownUpdatedAt: itemToDelete.updatedAt,
      };

      // Perform the actual API call
      const response = await menuAPI.delete(deleteRequest);

      if (!response.success && response.error) {
        // Check if this is a version conflict reported by the server
        if (
          response.error?.includes('version conflict') ||
          response.error?.includes('modified by another user')
        ) {
          throw new Error(`Version conflict: ${response.error}`);
        }
        throw new Error(response.error);
      }

      // Finalize the state after successful deletion
      set({ isLoading: false });

      // Invalidate ALL menu-related caches to ensure fresh data
      const removedCacheEntries = cache.removeByPrefix('menuItems');
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `Menu Store: Invalidated ${removedCacheEntries} cache entries after item deletion`
        );
      }

      // Refresh categories from the backend to ensure they're up-to-date
      try {
        await get()._internalFetchCategories();
      } catch (refreshError) {
        console.warn(
          'Failed to refresh categories after deletion:',
          refreshError
        );
      }

      // Record audit trail
      // Get user display name directly
      await recordAudit({
        entityId: id,
        entityType: 'menuItem',
        action: 'delete',
        timestamp: new Date().toISOString(),
        userId,
        userName: getUserDisplayName(),
        metadata: {
          name: itemToDelete.name,
          category: itemToDelete.category,
          // Store the complete item data in case we need to restore it
          deletedItem: JSON.stringify(itemToDelete),
        },
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('Menu Store: Deleted menu item successfully', id);
      }
    } catch (error) {
      console.error('Menu Store: Failed to delete menu item', error);

      // Roll back optimistic update on error
      set({
        menuItems: previousState.menuItems,
        categories: previousState.categories,
        error:
          error instanceof Error ? error.message : 'Failed to delete menu item',
        isLoading: false,
      });
      throw error;
    }
  },

  toggleMenuItemAvailability: async id => {
    // Save the current state for potential rollback
    const previousState = get();
    const { menuItems } = previousState;

    // Find the item to toggle
    const menuItem = menuItems.find(item => item.id === id);

    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    try {
      // Create the update
      const updates = {
        isAvailable: !menuItem.isAvailable,
      };

      // Apply optimistic update immediately
      const updatedMenuItems = menuItems.map(item => {
        if (item.id === id) {
          return {
            ...item,
            ...updates,
            updatedAt: new Date().toISOString(),
            isOptimisticallyUpdated: true, // Flag for optimistic update
          } as UIMenuItem;
        }
        return item;
      });

      // Update UI immediately with optimistic update
      set({
        menuItems: updatedMenuItems,
        isLoading: true,
        error: null,
      });

      // Verify the user has permission to update menu items
      verifyPermission(Role.MANAGER);

      // Get the actual user ID from auth store
      const userId = getCurrentUserId();

      const updateRequest: UpdateMenuItemRequest = {
        id,
        updates,
        userId,
      };

      // Perform the actual API call
      const response = await menuAPI.update(updateRequest);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to toggle availability');
      }

      // Convert API response to UI format
      const apiItem = response.data;
      const updatedItem = convertToUIMenuItem(apiItem);

      // Replace the optimistically updated item with the real one from the server
      set(state => ({
        menuItems: state.menuItems.map(item =>
          item.id === id ? updatedItem : item
        ),
        isLoading: false,
      }));

      // Invalidate relevant caches
      const removedCacheEntries = cache.removeByPrefix('menuItems');
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `Menu Store: Invalidated ${removedCacheEntries} cache entries`
        );
      }

      // Record audit trail
      // Get user display name directly
      await recordAudit({
        entityId: id,
        entityType: 'menuItem',
        action: 'toggle_availability',
        timestamp: new Date().toISOString(),
        userId,
        userName: getUserDisplayName(),
        changes: {
          isAvailable: {
            old: menuItem.isAvailable,
            new: updatedItem.isAvailable,
          },
        },
        metadata: {
          name: updatedItem.name,
          newStatus: updatedItem.isAvailable ? 'available' : 'unavailable',
        },
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(
          'Menu Store: Toggled menu item availability successfully',
          updatedItem
        );
      }
    } catch (error) {
      console.error('Menu Store: Failed to toggle availability', error);

      // Roll back optimistic update on error
      set({
        menuItems: previousState.menuItems,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to toggle availability',
        isLoading: false,
      });
      throw error;
    }
  },

  createCategory: async name => {
    try {
      set({ isLoading: true, error: null });

      // Verify the user has permission to create categories
      verifyPermission(Role.MANAGER);

      // First, create the category directly using a custom API endpoint
      const createCategoryResponse = await menuAPI.createCategory({ name });

      if (!createCategoryResponse.success) {
        throw new Error(
          createCategoryResponse.error || 'Failed to create category'
        );
      }

      // Get the newly created category from the response
      const newCategory = createCategoryResponse.data;
      if (process.env.NODE_ENV === 'development') {
        console.log(
          'Menu Store: Created new category successfully',
          newCategory
        );
      }

      // Refresh categories list from backend
      await get()._internalFetchCategories();
      set({ isLoading: false });
    } catch (error) {
      console.error('Menu Store: Failed to create category', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to create category',
        isLoading: false,
      });
      throw error;
    }
  },

  updateCategory: async (oldName, newName) => {
    try {
      set({ isLoading: true, error: null });

      // Verify the user has permission to update categories
      verifyPermission(Role.MANAGER);

      // Use backend category update
      const categoriesResponse = await menuAPI.getCategories();
      if (!categoriesResponse.success || !categoriesResponse.data) {
        throw new Error(
          categoriesResponse.error || 'Failed to load categories'
        );
      }
      const match = categoriesResponse.data.find(
        (c: any) => c.name === oldName
      );
      if (!match) throw new Error(`Category "${oldName}" not found`);

      await menuAPI.updateCategory({ id: match.id, name: newName });

      // Refresh
      await get()._internalFetchCategories();
      await get()._internalFetchMenuItems();

      set({ isLoading: false });
      if (process.env.NODE_ENV === 'development') {
        console.log(
          'Menu Store: Updated category successfully',
          oldName,
          'to',
          newName
        );
      }
    } catch (error) {
      console.error('Menu Store: Failed to update category', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to update category',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteCategory: async name => {
    try {
      set({ isLoading: true, error: null });

      // Verify the user has permission to delete categories
      verifyPermission(Role.MANAGER);

      const categoriesResponse = await menuAPI.getCategories();
      if (!categoriesResponse.success || !categoriesResponse.data) {
        throw new Error(
          categoriesResponse.error || 'Failed to load categories'
        );
      }

      // Add safety check for categoriesResponse.data
      if (!Array.isArray(categoriesResponse.data)) {
        throw new Error('Unexpected response format from categories API');
      }

      const match = categoriesResponse.data.find(
        (c: any) => c && c.name === name
      );
      if (!match) throw new Error(`Category "${name}" not found`);

      await menuAPI.deleteCategory(match.id);

      // Refresh with safe error handling
      try {
        await get()._internalFetchCategories();
      } catch (refreshError) {
        console.warn(
          'Menu Store: Failed to refresh categories after delete:',
          refreshError
        );
      }

      try {
        const { pagination } = get();
        // Use explicit parameters to avoid undefined issues
        await get()._internalFetchMenuItems({
          page: pagination.page || 1,
          pageSize: pagination.pageSize || 12,
          search: pagination.search || '',
          category: '', // Reset category filter after deletion
        });
      } catch (refreshError) {
        console.warn(
          'Menu Store: Failed to refresh menu items after delete:',
          refreshError
        );
      }

      set({ isLoading: false });
      if (process.env.NODE_ENV === 'development') {
        console.log('Menu Store: Deleted category successfully', name);
      }
    } catch (error) {
      console.error('Menu Store: Failed to delete category', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to delete category',
        isLoading: false,
      });
      throw error;
    }
  },

  // Pagination actions
  setPage: page => {
    const { pagination } = get();
    set({ pagination: { ...pagination, page } });
    get()._internalFetchMenuItems({ page });
  },

  setPageSize: pageSize => {
    const { pagination } = get();
    set({ pagination: { ...pagination, pageSize, page: 1 } }); // Reset to first page when changing page size
    get()._internalFetchMenuItems({ pageSize, page: 1 });
  },

  setSearch: search => {
    const { pagination } = get();
    set({ pagination: { ...pagination, search, page: 1 } }); // Reset to first page when searching
    get()._internalFetchMenuItems({ search, page: 1 });
  },

  setCategory: category => {
    const { pagination } = get();
    set({ pagination: { ...pagination, category, page: 1 } }); // Reset to first page when changing category
    get()._internalFetchMenuItems({ category, page: 1 });
  },

  clearSearch: () => {
    const { pagination } = get();
    set({ pagination: { ...pagination, search: '', page: 1 } });
    get()._internalFetchMenuItems({ search: '', page: 1 });
  },

  // Restore a deleted menu item
  restoreMenuItem: async id => {
    try {
      set({ isLoading: true, error: null });

      // Verify the user has permission to restore menu items (requires manager role)
      verifyPermission(Role.MANAGER);

      // Get the actual user ID from auth store
      const userId = getCurrentUserId();

      // Get the last deleted version of the menu item
      const deletedItem = getLastDeletedEntity<MenuItem>(id, 'menuItem');

      if (!deletedItem) {
        throw new Error(
          `Menu item with ID ${id} cannot be found in deletion history`
        );
      }

      // Create a restored version of the item as UIMenuItem
      const restoredItem: UIMenuItem = {
        ...deletedItem,
        isAvailable: false, // Default to unavailable for safety
        updatedAt: new Date().toISOString(),
        // Ensure date fields are strings
        createdAt:
          typeof deletedItem.createdAt === 'string'
            ? deletedItem.createdAt
            : new Date().toISOString(),
      };

      // Convert to API format and create a request to recreate the item with its original ID
      const createRequest: CreateMenuItemRequest = {
        menuItem: convertToAPIMenuItem(restoredItem),
        userId,
        restoreMode: true, // Signal to the API that this is a restore operation
      };

      // Call the create API (in a real implementation, we might have a dedicated restore endpoint)
      const response = await menuAPI.create(createRequest);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to restore menu item');
      }

      const restoredData = response.data;

      // Convert the restored API data to UI format
      const restoredUIItem = convertToUIMenuItem(restoredData);

      // Update the store with the restored item
      const { menuItems, categories } = get();
      const updatedMenuItems = [...menuItems, restoredUIItem];

      // Update categories if needed
      const updatedCategories = [
        ...new Set([...categories, restoredUIItem.category]),
      ].filter(Boolean);

      set({
        menuItems: updatedMenuItems,
        categories: updatedCategories,
        isLoading: false,
      });

      // Invalidate ALL menu-related caches to ensure fresh data
      const removedCacheEntries = cache.removeByPrefix('menuItems');
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `Menu Store: Invalidated ${removedCacheEntries} cache entries after item restoration`
        );
      }

      // Record audit trail
      // Get user display name directly
      await recordAudit({
        entityId: id,
        entityType: 'menuItem',
        action: 'create', // Use 'create' as the action since we're recreating the item
        timestamp: new Date().toISOString(),
        userId,
        userName: getUserDisplayName(),
        metadata: {
          name: restoredUIItem.name,
          category: restoredUIItem.category,
          isRestore: true,
        },
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(
          'Menu Store: Restored menu item successfully',
          restoredUIItem
        );
      }
    } catch (error) {
      console.error('Menu Store: Failed to restore menu item', error);
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to restore menu item',
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
