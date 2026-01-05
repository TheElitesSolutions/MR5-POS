/**
 * StockItemForm Component - REFACTORED to use new Service Architecture
 *
 * IMPROVEMENTS:
 * ✅ No more direct API calls - uses cached service layer
 * ✅ Request deduplication - prevents duplicate API calls
 * ✅ Optimized caching - data shared across components
 * ✅ Separation of concerns - UI state vs Data state
 * ✅ Better error handling with service-level retry logic
 */
'use client';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getStockService } from '@/services/ServiceContainer';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useStockCategories, useStockItems } from '@/hooks/useStockData';
const stockItemSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    unit: z.string().min(1, 'Unit is required'),
    currentQuantity: z.coerce.number().min(0, 'Quantity must be 0 or greater'),
    minimumQuantity: z.coerce
        .number()
        .min(0, 'Minimum quantity must be 0 or greater'),
    costPerUnit: z.coerce.number().min(0, 'Cost must be 0 or greater'),
    category: z.string().min(1, 'Category is required'),
});
// Categories are now managed dynamically through the category store
const UNITS = [
    'lbs',
    'kg',
    'oz',
    'g',
    'pieces',
    'bottles',
    'cans',
    'liters',
    'gallons',
    'cups',
    'tbsp',
    'tsp',
];
const StockItemForm = ({ itemId, onClose }) => {
    const stockService = getStockService();
    // Data from new service layer - automatically cached and deduplicated
    const { categories, isLoading: categoriesLoading, error: categoriesError, refresh: refreshCategories, } = useStockCategories();
    const { stockItems, refresh: refreshStockItems, isLoading: itemsLoading } = useStockItems();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const editingItem = itemId
        ? stockItems.find(item => item.id === itemId)
        : null;
    const form = useForm({
        resolver: zodResolver(stockItemSchema),
        defaultValues: {
            name: '',
            unit: '',
            currentQuantity: 0,
            minimumQuantity: 0,
            costPerUnit: 0,
            category: '',
        },
        mode: 'onBlur', // Validate when user leaves field, not on every keystroke
    });
    // Show error messages from service layer if any
    useEffect(() => {
        if (categoriesError) {
            toast({
                title: 'Categories Error',
                description: categoriesError,
                variant: 'destructive',
            });
        }
    }, [categoriesError, toast]);
    // Load existing item data when editing
    useEffect(() => {
        if (editingItem) {
            console.log('Loading editing item:', editingItem);
            console.log('Category from item:', editingItem.category);
            console.log('Unit from item:', editingItem.unit);
            console.log('Available categories:', categories);
            const resetData = {
                name: editingItem.name || editingItem.itemName || '',
                unit: editingItem.unit || '',
                currentQuantity: editingItem.currentQuantity ?? editingItem.currentStock ?? 0,
                minimumQuantity: editingItem.minimumQuantity ?? editingItem.minimumStock ?? 0,
                costPerUnit: editingItem.costPerUnit ?? 0,
                category: editingItem.category || '',
            };
            console.log('Resetting form with data:', resetData);
            form.reset(resetData);
        }
        else if (!itemId) {
            // Reset to empty form when adding new item
            form.reset({
                name: '',
                unit: '',
                currentQuantity: 0,
                minimumQuantity: 0,
                costPerUnit: 0,
                category: '',
            });
        }
    }, [editingItem, itemId, form, categories]);
    const handleAddNewCategory = async () => {
        if (!newCategoryName.trim())
            return;
        try {
            // Create new category using service layer
            await stockService.createStockCategory(newCategoryName.trim());
            // Set the form value immediately for better UX
            form.setValue('category', newCategoryName.trim());
            setNewCategoryName('');
            setIsAddingCategory(false);
            toast({
                title: 'Category Added',
                description: `"${newCategoryName.trim()}" has been added to your categories`,
            });
            // Refresh categories list with cache invalidation
            await refreshCategories();
        }
        catch (error) {
            console.error('Failed to add category:', error);
            toast({
                title: 'Add Category Failed',
                description: error instanceof Error ? error.message : 'Please try again.',
                variant: 'destructive',
            });
        }
    };
    const onSubmit = async (data) => {
        try {
            setIsSubmitting(true);
            const submitData = {
                name: data.name,
                unit: data.unit,
                currentQuantity: data.currentQuantity,
                minimumQuantity: data.minimumQuantity,
                costPerUnit: data.costPerUnit,
                category: data.category,
            };
            if (itemId) {
                await stockService.updateStockItem({ id: itemId, ...submitData });
                toast({
                    title: 'Stock Item Updated',
                    description: `${data.name} has been updated successfully`,
                });
            }
            else {
                await stockService.createStockItem(submitData);
                toast({
                    title: 'Stock Item Created',
                    description: `${data.name} has been added to inventory`,
                });
            }
            // Refresh the stock items list to show the new/updated item
            await refreshStockItems();
            onClose();
        }
        catch (error) {
            console.error('Failed to save stock item:', error);
            toast({
                title: itemId ? 'Update Failed' : 'Creation Failed',
                description: itemId
                    ? 'Failed to update stock item. Please try again.'
                    : 'Failed to create stock item. Please try again.',
                variant: 'destructive',
            });
        }
        finally {
            setIsSubmitting(false);
        }
    };
    // Show loading state when editing but item not yet loaded
    if (itemId && itemsLoading && !editingItem) {
        return (<div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-gray-400'/>
        <span className='ml-2 text-gray-600'>Loading item data...</span>
      </div>);
    }
    // Warn if trying to edit but item not found
    if (itemId && !itemsLoading && !editingItem) {
        return (<div className='rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
        <p className='text-yellow-800'>Item not found. It may have been deleted.</p>
      </div>);
    }
    return (<Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        {/* Name */}
        <FormField control={form.control} name='name' render={({ field }) => (<FormItem>
              <FormLabel>Item Name</FormLabel>
              <FormControl>
                <Input placeholder='e.g., Prime Ribeye Steak' {...field}/>
              </FormControl>
              <FormDescription>
                The name of the stock item as it appears in inventory.
              </FormDescription>
              <FormMessage />
            </FormItem>)}/>

        {/* Category and Unit Row */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <FormField control={form.control} name='category' render={({ field }) => (<FormItem>
                <FormLabel>Category</FormLabel>
                {isAddingCategory ? (<div className='space-y-2'>
                    <Input placeholder='Enter new category name' value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewCategory();
                    }
                    else if (e.key === 'Escape') {
                        setIsAddingCategory(false);
                        setNewCategoryName('');
                    }
                }}/>
                    <div className='flex gap-2'>
                      <Button type='button' size='sm' onClick={handleAddNewCategory} disabled={!newCategoryName.trim()}>
                        Add Category
                      </Button>
                      <Button type='button' size='sm' variant='outline' onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategoryName('');
                }}>
                        Cancel
                      </Button>
                    </div>
                  </div>) : (<div className='space-y-2'>
                    <Select key={`category-${field.value}`} onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select category'/>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(categories?.filter(category => category && category.trim() !== '') || []).map(category => (<SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Button type='button' variant='outline' size='sm' onClick={() => setIsAddingCategory(true)} className='w-full'>
                      <Plus className='mr-2 h-4 w-4'/>
                      Add New Category
                    </Button>
                  </div>)}
                <FormMessage />
              </FormItem>)}/>

          <FormField control={form.control} name='unit' render={({ field }) => (<FormItem>
                <FormLabel>Unit of Measure</FormLabel>
                <Select key={`unit-${field.value}`} onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select unit'/>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {UNITS.map(unit => (<SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>)}/>
        </div>

        {/* Quantities Row */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <FormField control={form.control} name='currentQuantity' render={({ field }) => (<FormItem>
                <FormLabel>Current Quantity</FormLabel>
                <FormControl>
                  <Input type='text' placeholder='0' value={field.value?.toString() || ''} onChange={e => {
                // Let user type freely
                field.onChange(e.target.value);
            }} onBlur={e => {
                // Sanitize and parse when user leaves field
                const value = e.target.value.replace(/[^0-9.]/g, '');
                const numValue = parseFloat(value) || 0;
                field.onChange(numValue);
                field.onBlur();
            }} name={field.name} ref={field.ref}/>
                </FormControl>
                <FormDescription>Current amount in stock.</FormDescription>
                <FormMessage />
              </FormItem>)}/>

          <FormField control={form.control} name='minimumQuantity' render={({ field }) => (<FormItem>
                <FormLabel>Minimum Quantity</FormLabel>
                <FormControl>
                  <Input type='text' placeholder='0' value={field.value?.toString() || ''} onChange={e => {
                // Let user type freely
                field.onChange(e.target.value);
            }} onBlur={e => {
                // Sanitize and parse when user leaves field
                const value = e.target.value.replace(/[^0-9.]/g, '');
                const numValue = parseFloat(value) || 0;
                field.onChange(numValue);
                field.onBlur();
            }} name={field.name} ref={field.ref}/>
                </FormControl>
                <FormDescription>Low stock alert threshold.</FormDescription>
                <FormMessage />
              </FormItem>)}/>
        </div>

        {/* Cost per Unit */}
        <FormField control={form.control} name='costPerUnit' render={({ field }) => (<FormItem>
              <FormLabel>Cost per Unit ($)</FormLabel>
              <FormControl>
                <Input type='text' placeholder='0.00' value={field.value?.toString() || ''} onChange={e => {
                // Let user type freely
                field.onChange(e.target.value);
            }} onBlur={e => {
                // Sanitize and parse when user leaves field
                const value = e.target.value.replace(/[^0-9.]/g, '');
                const numValue = parseFloat(value) || 0;
                field.onChange(numValue);
                field.onBlur();
            }} name={field.name} ref={field.ref}/>
              </FormControl>
              <FormDescription>
                Cost per unit for inventory valuation.
              </FormDescription>
              <FormMessage />
            </FormItem>)}/>

        {/* Form Actions */}
        <div className='flex items-center justify-end space-x-4 pt-4'>
          <Button type='button' variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button type='submit' disabled={isSubmitting}>
            {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin'/>}
            {itemId ? 'Update Item' : 'Create Item'}
          </Button>
        </div>
      </form>
    </Form>);
};
export default StockItemForm;
