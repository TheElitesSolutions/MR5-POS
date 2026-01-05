import { inventoryAPI } from '@/lib/ipc-api';
import { create } from 'zustand';
export const useCategoryStore = create((set, get) => ({
    categories: [],
    isLoading: false,
    error: null,
    fetchCategories: async () => {
        try {
            set({ isLoading: true, error: null });
            // Get unique categories from existing stock items
            const response = await inventoryAPI.getCategories();
            if (response.success && response.data) {
                // For each category, we need to get the usage count
                const categoriesWithUsage = [];
                for (const categoryName of response.data) {
                    if (categoryName && categoryName.trim()) {
                        const usageCount = await get().getCategoryUsage(categoryName);
                        categoriesWithUsage.push({
                            name: categoryName,
                            usageCount,
                            createdAt: new Date(),
                        });
                    }
                }
                set({
                    categories: categoriesWithUsage.sort((a, b) => a.name.localeCompare(b.name)),
                    isLoading: false,
                });
            }
            else {
                throw new Error(response.error || 'Failed to fetch categories');
            }
        }
        catch (error) {
            console.error('Failed to fetch categories:', error);
            set({
                error: error instanceof Error ? error.message : 'Failed to fetch categories',
                isLoading: false,
            });
        }
    },
    addCategory: async (name) => {
        try {
            set({ isLoading: true, error: null });
            const trimmedName = name.trim();
            if (!trimmedName) {
                throw new Error('Category name cannot be empty');
            }
            const { categories } = get();
            // Check if category already exists (case-insensitive)
            const existingCategory = categories.find(cat => cat.name.toLowerCase() === trimmedName.toLowerCase());
            if (existingCategory) {
                throw new Error('Category already exists');
            }
            // Strategy: Create a permanent inventory item with this category
            // Instead of creating and deleting a placeholder, we'll keep it
            const stockItem = {
                itemName: `${trimmedName} Category Placeholder`,
                category: trimmedName,
                currentStock: 0,
                minimumStock: 0,
                unit: 'unit',
                costPerUnit: 0,
                supplier: 'System-Generated Category',
            };
            console.log('Creating stock item to establish category:', stockItem);
            // Make an API call to create the item
            const response = await inventoryAPI.createInventoryItem(stockItem);
            if (!response.success) {
                console.error('Failed to create category item:', response.error);
                throw new Error(response.error || 'Failed to create category');
            }
            console.log('Successfully created category with item:', response.data);
            // Add to local state
            const newCategory = {
                name: trimmedName,
                usageCount: 1, // Count includes our placeholder item
                createdAt: new Date(),
            };
            set({
                categories: [...categories, newCategory].sort((a, b) => a.name.localeCompare(b.name)),
                isLoading: false,
            });
            // Explicitly refresh categories
            await get().fetchCategories();
        }
        catch (error) {
            console.error('Failed to add category:', error);
            set({
                error: error instanceof Error ? error.message : 'Failed to add category',
                isLoading: false,
            });
            throw error;
        }
    },
    updateCategory: async (oldName, newName) => {
        try {
            set({ isLoading: true, error: null });
            const trimmedNewName = newName.trim();
            if (!trimmedNewName) {
                throw new Error('Category name cannot be empty');
            }
            const { categories } = get();
            // Check if new name already exists (case-insensitive, excluding current category)
            const existingCategory = categories.find(cat => cat.name.toLowerCase() === trimmedNewName.toLowerCase() &&
                cat.name !== oldName);
            if (existingCategory) {
                throw new Error('Category name already exists');
            }
            // This would require a backend API to update all stock items using this category
            // For now, we'll update locally and assume backend handles the bulk update
            const response = await inventoryAPI.updateCategoryName(oldName, trimmedNewName);
            if (response.success) {
                // Update local state
                set({
                    categories: categories
                        .map(cat => cat.name === oldName ? { ...cat, name: trimmedNewName } : cat)
                        .sort((a, b) => a.name.localeCompare(b.name)),
                    isLoading: false,
                });
            }
            else {
                throw new Error(response.error || 'Failed to update category');
            }
        }
        catch (error) {
            console.error('Failed to update category:', error);
            set({
                error: error instanceof Error ? error.message : 'Failed to update category',
                isLoading: false,
            });
            throw error;
        }
    },
    deleteCategory: async (name) => {
        try {
            set({ isLoading: true, error: null });
            const usageCount = await get().getCategoryUsage(name);
            if (usageCount > 0) {
                throw new Error(`Cannot delete category "${name}" because it is used by ${usageCount} stock item(s). Please reassign these items to other categories first.`);
            }
            const { categories } = get();
            // Remove from local state
            set({
                categories: categories.filter(cat => cat.name !== name),
                isLoading: false,
            });
        }
        catch (error) {
            console.error('Failed to delete category:', error);
            set({
                error: error instanceof Error ? error.message : 'Failed to delete category',
                isLoading: false,
            });
            throw error;
        }
    },
    getCategoryUsage: async (name) => {
        try {
            // Get all stock items and count how many use this category
            const response = await inventoryAPI.getAllInventoryItems();
            if (response.success && response.data) {
                const usage = response.data.filter(item => item.category === name).length;
                return usage;
            }
            return 0;
        }
        catch (error) {
            console.error('Failed to get category usage:', error);
            return 0;
        }
    },
    clearError: () => {
        set({ error: null });
    },
}));
