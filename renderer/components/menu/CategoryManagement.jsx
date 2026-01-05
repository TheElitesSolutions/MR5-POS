'use client';
import { useState, useEffect } from 'react';
import { useMenuStore } from '@/stores/menuStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ColorPicker } from '@/components/ui/color-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Grid3X3, Package, UtensilsCrossed, AlertTriangle, } from 'lucide-react';
const CategoryManagement = ({ categories, menuItems, onCategorySelect, onCategoryUpdated, }) => {
    const { createCategory, updateCategory, deleteCategory, isLoading } = useMenuStore();
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedCategoryOriginalName, setSelectedCategoryOriginalName] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState(undefined);
    const [editCategoryName, setEditCategoryName] = useState('');
    const [editCategoryColor, setEditCategoryColor] = useState(undefined);
    // State for category statistics from backend
    const [categoryStats, setCategoryStats] = useState([]);
    // Debug: Log categories data when it changes
    useEffect(() => {
        console.log('🔍 [CategoryManagement] Categories prop updated:', {
            count: categories.length,
            categories: categories.map(c => ({ id: c.id, name: c.name, color: c.color, hasColor: !!c.color }))
        });
    }, [categories]);
    // Fetch category statistics from backend API
    useEffect(() => {
        const fetchCategoryStats = async () => {
            try {
                const response = await window.electronAPI?.ipc.invoke('mr5pos:menu-items:get-category-stats');
                if (response?.success && response.data) {
                    // Transform backend data to match component format
                    const stats = response.data.map((stat) => ({
                        name: stat.categoryName,
                        totalItems: stat.totalItems,
                        availableItems: stat.activeItems,
                        avgPrice: stat.avgPrice,
                    }));
                    setCategoryStats(stats.sort((a, b) => b.totalItems - a.totalItems));
                }
                else {
                    console.error('Failed to fetch category stats:', response);
                    setCategoryStats([]);
                }
            }
            catch (error) {
                console.error('Error fetching category stats:', error);
                setCategoryStats([]);
            }
        };
        // Fetch stats whenever categories change
        if (categories && categories.length > 0) {
            fetchCategoryStats();
        }
    }, [categories]);
    // Debug logging removed - issue resolved
    // Refresh category stats from backend
    const refreshCategoryStats = async () => {
        try {
            const response = await window.electronAPI?.ipc.invoke('mr5pos:menu-items:get-category-stats');
            if (response?.success && response.data) {
                const stats = response.data.map((stat) => ({
                    name: stat.categoryName,
                    totalItems: stat.totalItems,
                    availableItems: stat.activeItems,
                    avgPrice: stat.avgPrice,
                }));
                setCategoryStats(stats.sort((a, b) => b.totalItems - a.totalItems));
            }
        }
        catch (error) {
            console.error('Error refreshing category stats:', error);
        }
    };
    const handleCreateCategory = async () => {
        if (!newCategoryName.trim())
            return;
        try {
            await createCategory(newCategoryName.trim(), newCategoryColor);
            setNewCategoryName('');
            setNewCategoryColor(undefined);
            setShowAddDialog(false);
            // Refresh stats after creating category
            setTimeout(refreshCategoryStats, 500);
            // Notify parent component to refresh its data
            if (onCategoryUpdated) {
                await onCategoryUpdated();
            }
        }
        catch (error) {
            console.error('Failed to create category:', error);
        }
    };
    const handleEditCategory = async () => {
        if (!editCategoryName.trim() || !selectedCategoryOriginalName)
            return;
        try {
            // Pass the original name as the first parameter (oldName), not the ID
            await updateCategory(selectedCategoryOriginalName, editCategoryName.trim(), editCategoryColor);
            setEditCategoryName('');
            setEditCategoryColor(undefined);
            setSelectedCategory('');
            setSelectedCategoryOriginalName('');
            setShowEditDialog(false);
            // Refresh stats after updating category
            setTimeout(refreshCategoryStats, 500);
            // Notify parent component to refresh its data
            if (onCategoryUpdated) {
                await onCategoryUpdated();
            }
        }
        catch (error) {
            console.error('Failed to update category:', error);
        }
    };
    const handleDeleteCategory = async () => {
        if (!selectedCategory)
            return;
        try {
            await deleteCategory(selectedCategory);
            setSelectedCategory('');
            setShowDeleteDialog(false);
            // Refresh stats after deleting category
            setTimeout(refreshCategoryStats, 500);
            // Notify parent component to refresh its data
            if (onCategoryUpdated) {
                await onCategoryUpdated();
            }
        }
        catch (error) {
            console.error('Failed to delete category:', error);
        }
    };
    const openEditDialog = (categoryId) => {
        // Find the full category object to load its name and color
        const categoryObj = categories.find(cat => cat.id === categoryId);
        console.log('🎨 [CategoryManagement] Opening edit dialog:', {
            categoryId,
            categoryObj,
            hasColor: !!categoryObj?.color,
            color: categoryObj?.color,
            allCategories: categories.map(c => ({ id: c.id, name: c.name, color: c.color }))
        });
        if (categoryObj) {
            setSelectedCategory(categoryObj.id);
            setSelectedCategoryOriginalName(categoryObj.name); // Store original name for update
            setEditCategoryName(categoryObj.name);
            setEditCategoryColor(categoryObj.color);
            console.log('✅ [CategoryManagement] Set edit form state:', {
                name: categoryObj.name,
                color: categoryObj.color,
                colorUndefined: categoryObj.color === undefined,
                colorNull: categoryObj.color === null
            });
        }
        setShowEditDialog(true);
    };
    const openDeleteDialog = (category) => {
        setSelectedCategory(category);
        setShowDeleteDialog(true);
    };
    // Using the shared utility for consistent category colors across the application
    return (<div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-2'>
          <Grid3X3 className='h-5 w-5 text-blue-600'/>
          <h2 className='text-xl font-semibold text-gray-900 dark:text-white'>
            Category Management
          </h2>
          <Badge variant='outline' className='text-xs'>
            {categories.length} categories
          </Badge>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size='sm' className='flex items-center space-x-2'>
              <Plus className='h-4 w-4'/>
              <span>Add Category</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Category</DialogTitle>
            </DialogHeader>
            <div className='space-y-4'>
              <div>
                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  Category Name
                </label>
                <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder='Enter category name...' className='mt-1' onKeyDown={e => {
            if (e.key === 'Enter') {
                handleCreateCategory();
            }
        }}/>
              </div>
              <ColorPicker value={newCategoryColor} onChange={setNewCategoryColor} label='Category Color (Optional)'/>
              <div className='flex justify-end space-x-2'>
                <Button variant='outline' onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim() || isLoading}>
                  Create Category
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Grid */}
      {categoryStats.length > 0 ? (<div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {categoryStats.map(category => (<Card key={category.name} className='group cursor-pointer transition-shadow hover:shadow-md' onClick={() => onCategorySelect(category.name)}>
              <CardHeader className='pb-3'>
                <div className='flex items-center justify-between'>
                  <CardTitle className='flex items-center space-x-2 text-lg'>
                    <UtensilsCrossed className='h-5 w-5 text-gray-600'/>
                    {(() => {
                    const categoryObj = categories.find(cat => cat.name === category.name);
                    return categoryObj?.color && (<div className='h-3 w-3 rounded-full flex-shrink-0' style={{ backgroundColor: categoryObj.color }} title='Category color'/>);
                })()}
                    <span className='truncate'>{category.name}</span>
                  </CardTitle>
                  <div className='relative z-10 flex items-center space-x-1 opacity-0 transition-opacity group-hover:opacity-100'>
                    <Button variant='ghost' size='sm' onClick={e => {
                    e.stopPropagation();
                    // Find the category ID by matching name with the categories prop
                    const categoryObj = categories.find(cat => cat.name === category.name);
                    if (categoryObj) {
                        openEditDialog(categoryObj.id);
                    }
                }} className='h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-800'>
                      <Edit className='h-3 w-3'/>
                    </Button>
                    <Button variant='ghost' size='sm' onClick={e => {
                    e.stopPropagation();
                    openDeleteDialog(category.name);
                }} className='h-8 w-8 p-0 text-red-600 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/20' disabled={category.totalItems > 0}>
                      <Trash2 className='h-3 w-3'/>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='grid grid-cols-2 gap-3 text-sm'>
                  <div className='flex items-center space-x-2'>
                    <Package className='h-4 w-4 text-blue-600'/>
                    <span className='text-gray-600 dark:text-gray-400'>
                      Items:
                    </span>
                    <span className='font-medium'>{category.totalItems}</span>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <div className='h-3 w-3 rounded-full bg-green-500'></div>
                    <span className='text-gray-600 dark:text-gray-400'>
                      Available:
                    </span>
                    <span className='font-medium'>
                      {category.availableItems}
                    </span>
                  </div>
                </div>

                <div className='flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-700'>
                  <span className='text-sm text-gray-600 dark:text-gray-400'>
                    Avg Price:
                  </span>
                  <span className='font-semibold text-green-600'>
                    ${category.avgPrice.toFixed(2)}
                  </span>
                </div>

                <Badge variant='outline' className='w-full justify-center'>
                  Click to view items
                </Badge>
              </CardContent>
            </Card>))}
        </div>) : (<div className='py-12 text-center'>
          <Grid3X3 className='mx-auto mb-4 h-12 w-12 text-gray-400'/>
          <h3 className='mb-2 text-lg font-medium text-gray-900 dark:text-white'>
            Add New Category
          </h3>
          <p className='mb-4 text-gray-600 dark:text-gray-400'>
            Create your first category to organize your menu items.
          </p>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className='mr-2 h-4 w-4'/>
            Create Category
          </Button>
        </div>)}

      {/* Edit Category Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                Category Name
              </label>
              <Input value={editCategoryName} onChange={e => setEditCategoryName(e.target.value)} placeholder='Enter category name...' className='mt-1' onKeyDown={e => {
            if (e.key === 'Enter') {
                handleEditCategory();
            }
        }}/>
            </div>
            <ColorPicker value={editCategoryColor} onChange={setEditCategoryColor} label='Category Color (Optional)'/>
            <div className='flex justify-end space-x-2'>
              <Button variant='outline' onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditCategory} disabled={!editCategoryName.trim() || isLoading}>
                Update Category
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category &ldquo;
              {selectedCategory}&rdquo;?
              {(() => {
            const category = categoryStats.find(c => c.name === selectedCategory);
            return (category &&
                category.totalItems > 0 && (<span className='mt-2 block font-medium text-red-600'>
                      <AlertTriangle className='mr-1 inline h-4 w-4'/>
                      This category contains {category.totalItems} items. You
                      cannot delete a category that contains menu items.
                    </span>));
        })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} disabled={(categoryStats.find(c => c.name === selectedCategory)
            ?.totalItems ?? 0) > 0 || isLoading} className='bg-red-600 hover:bg-red-700'>
              Delete Category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
};
export default CategoryManagement;
