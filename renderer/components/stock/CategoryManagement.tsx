/**
 * CategoryManagement Component - REFACTORED to use new Service Architecture
 *
 * IMPROVEMENTS:
 * ✅ No more direct API calls - uses cached service layer
 * ✅ Request deduplication - prevents duplicate API calls
 * ✅ Optimized caching - data shared across components
 * ✅ Separation of concerns - UI state vs Data state
 * ✅ Better error handling with service-level retry logic
 */
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Edit, Loader2, Package, Plus, Tags, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useStockCategories } from '@/hooks/useStockData';
import { getStockService } from '@/services/ServiceContainer';

const categorySchema = z.object({
  name: z
    .string()
    .min(1, 'Category name is required')
    .max(50, 'Category name must be 50 characters or less')
    .regex(
      /^[a-zA-Z0-9\s\-_]+$/,
      'Category name can only contain letters, numbers, spaces, hyphens, and underscores'
    ),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryManagementProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryUpdated?: () => void | Promise<void>; // Callback to refresh parent data
}

const CategoryManagement = ({ isOpen, onClose, onCategoryUpdated }: CategoryManagementProps) => {
  // Data from new service layer - automatically cached and deduplicated
  const {
    categories,
    isLoading,
    error,
    refetch: refreshCategories,
    clearError,
  } = useStockCategories();

  const { toast } = useToast();

  // Local state for UI management
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form for adding/editing categories
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
    },
  });

  // Categories are automatically loaded by service layer - no manual fetch needed

  // Clear error and reset form when modal closes
  useEffect(() => {
    if (!isOpen && error) {
      clearError();
    }
    if (!isOpen) {
      setIsAddingCategory(false);
      setEditingCategory(null);
      setDeletingCategory(null);
      form.reset();
    }
  }, [isOpen, error, clearError, form]);

  const handleAddCategory = () => {
    setIsAddingCategory(true);
    setEditingCategory(null);
    form.reset({ name: '' });
  };

  const handleEditCategory = (categoryName: string) => {
    setEditingCategory(categoryName);
    setIsAddingCategory(false);
    form.reset({ name: categoryName });
  };

  const handleCancelEdit = () => {
    setIsAddingCategory(false);
    setEditingCategory(null);
    form.reset();
  };

  const onSubmit = async (data: CategoryFormData) => {
    try {
      setIsSubmitting(true);
      const trimmedName = data.name.trim();

      // Use service layer for category operations
      const stockService = getStockService();

      if (editingCategory) {
        // Edit existing category
        await stockService.updateStockCategory(editingCategory, trimmedName);
        toast({
          title: 'Category Updated',
          description: `"${editingCategory}" has been renamed to "${trimmedName}"`,
        });
      } else {
        // Add new category
        await stockService.createStockCategory(trimmedName);
        toast({
          title: 'Category Added',
          description: `"${trimmedName}" has been added to your categories`,
        });
      }

      // Reset form and state
      handleCancelEdit();

      // Refresh categories using service layer
      await refreshCategories();
      
      // Notify parent component to refresh its data
      if (onCategoryUpdated) {
        await onCategoryUpdated();
      }
    } catch (error) {
      console.error('Failed to save category:', error);
      toast({
        title: editingCategory ? 'Update Failed' : 'Add Failed',
        description:
          error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    try {
      setIsSubmitting(true);

      // Use service layer for category deletion
      const stockService = getStockService();
      await stockService.deleteStockCategory(categoryName);

      toast({
        title: 'Category Deleted',
        description: `"${categoryName}" has been removed from your categories`,
      });

      setDeletingCategory(null);

      // Refresh categories using service layer
      await refreshCategories();
      
      // Notify parent component to refresh its data
      if (onCategoryUpdated) {
        await onCategoryUpdated();
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast({
        title: 'Delete Failed',
        description:
          error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryUsageColor = (usageCount: number) => {
    if (usageCount === 0) return 'bg-gray-100 text-gray-600';
    if (usageCount <= 5) return 'bg-blue-100 text-blue-600';
    if (usageCount <= 15) return 'bg-green-100 text-green-600';
    return 'bg-orange-100 text-orange-600';
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className='max-h-[80vh] max-w-2xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Tags className='h-5 w-5' />
              Manage Categories
            </DialogTitle>
            <DialogDescription>
              Create and manage categories for your stock items. Categories help
              organize your inventory and make it easier to find items.
            </DialogDescription>
          </DialogHeader>

          {/* Error Display */}
          {error && (
            <div className='rounded-lg border border-red-200 bg-red-50 p-3'>
              <div className='flex items-center justify-between'>
                <p className='text-sm text-red-800'>{error}</p>
                <Button variant='ghost' size='sm' onClick={clearError}>
                  <X className='h-4 w-4' />
                </Button>
              </div>
            </div>
          )}

          <div className='space-y-4'>
            {/* Add/Edit Form */}
            {(isAddingCategory || editingCategory) && (
              <div className='rounded-lg border bg-gray-50 p-4'>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className='space-y-4'
                  >
                    <FormField
                      control={form.control}
                      name='name'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {editingCategory
                              ? 'Edit Category Name'
                              : 'New Category Name'}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder='e.g., Fresh Produce, Cleaning Supplies'
                              {...field}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className='flex gap-2'>
                      <Button type='submit' disabled={isSubmitting} size='sm'>
                        {isSubmitting && (
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        )}
                        {editingCategory ? 'Update Category' : 'Add Category'}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        onClick={handleCancelEdit}
                        disabled={isSubmitting}
                        size='sm'
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}

            {/* Add Category Button */}
            {!isAddingCategory && !editingCategory && (
              <Button
                onClick={handleAddCategory}
                className='w-full'
                variant='outline'
              >
                <Plus className='mr-2 h-4 w-4' />
                Add New Category
              </Button>
            )}

            {/* Categories List */}
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <h3 className='text-sm font-medium text-gray-900'>
                  Your Categories ({categories.length})
                </h3>
                {isLoading && (
                  <Loader2 className='h-4 w-4 animate-spin text-gray-400' />
                )}
              </div>

              {categories.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-8 text-center'>
                  <Package className='mb-3 h-12 w-12 text-gray-400' />
                  <h4 className='mb-2 text-sm font-medium text-gray-900'>
                    No categories yet
                  </h4>
                  <p className='mb-4 text-sm text-gray-600'>
                    Add your first category to start organizing your inventory.
                  </p>
                </div>
              ) : (
                <div className='grid gap-2'>
                  {categories.map(category => (
                    <div
                      key={category}
                      className='flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm'
                    >
                      <div className='flex items-center gap-3'>
                        <Package className='h-4 w-4 text-gray-400' />
                        <div>
                          <span className='font-medium text-gray-900'>
                            {category}
                          </span>
                          <Badge
                            className={`ml-2 text-xs ${getCategoryUsageColor(0)}`}
                          >
                            Unused
                          </Badge>
                        </div>
                      </div>
                      <div className='flex items-center gap-1'>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleEditCategory(category)}
                          disabled={isSubmitting}
                        >
                          <Edit className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => setDeletingCategory(category)}
                          disabled={isSubmitting}
                          className='text-red-600 hover:text-red-700'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className='flex justify-end pt-4'>
            <Button variant='outline' onClick={onClose}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingCategory}
        onOpenChange={open => !open && setDeletingCategory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category "{deletingCategory}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingCategory && handleDeleteCategory(deletingCategory)
              }
              disabled={isSubmitting}
              className='bg-red-600 hover:bg-red-700'
            >
              {isSubmitting && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              Delete Category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CategoryManagement;
