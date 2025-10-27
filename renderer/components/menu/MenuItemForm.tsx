/**
 * MenuItemForm Component - REFACTORED to use new Service Architecture
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMenuStore } from '@/stores/menuStore';
import { zodResolver } from '@hookform/resolvers/zod';
import { handleError, tryCatch, ErrorSeverity } from '@/utils/errorHandler';
import { Calculator, DollarSign, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  calculateIngredientCosts,
  calculateProfitMetrics,
  convertIngredientsFromApi,
  IngredientWithQuantity,
} from '@/utils/ingredientUtils';
import {
  menuItemSchema,
  validateMenuItem,
  checkDuplicateName,
} from '@/utils/menuValidation';
import { useStockItems, resetStockDataFetch } from '@/hooks/useStockData';
import { useMenuCategories } from '@/hooks/useMenuData';
import { menuAPI } from '@/lib/ipc-api';
// Import directly from shared directory with correct relative path

// Enhanced validation schema with ingredients for form use
const ingredientSchema = z.object({
  stockItemId: z.string().min(1, 'Stock item is required'),
  quantityRequired: z.coerce
    .number()
    .min(0, 'Quantity cannot be negative'),
  unit: z.string().optional().nullable(), // Store unit for display purposes
});

// Create a form-specific schema that extends the base schema
const formSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .or(z.literal('')),
  price: z.coerce
    .number({ message: 'Price must be a number' })
    .min(0.01, 'Price must be greater than 0')
    .max(10000, 'Price exceeds maximum allowed'),
  category: z
    .string()
    .min(1, 'Category is required')
    .max(50, 'Category name too long'),
  // Accept both boolean and number (SQLite stores booleans as 0/1)
  isAvailable: z.union([z.boolean(), z.number()]).transform(val => {
    if (typeof val === 'number') return val !== 0;
    return val;
  }).pipe(z.boolean()).default(true),
  isActive: z.union([z.boolean(), z.number()]).transform(val => {
    if (typeof val === 'number') return val !== 0;
    return val;
  }).pipe(z.boolean()).default(true),
  isCustomizable: z.union([z.boolean(), z.number()]).transform(val => {
    if (typeof val === 'number') return val !== 0;
    return val;
  }).pipe(z.boolean()).default(false),
  isPrintableInKitchen: z.union([z.boolean(), z.number()]).transform(val => {
    if (typeof val === 'number') return val !== 0;
    return val;
  }).pipe(z.boolean()).default(true),
  ingredients: z.array(ingredientSchema).default([]),
});

interface MenuItemFormProps {
  itemId?: string | null;
  onClose: () => void;
  defaultCategory?: string; // Pre-selected category when adding new item
}

// Use dynamic categories from the store instead of hard-coded list

const MenuItemForm = ({ itemId, onClose, defaultCategory }: MenuItemFormProps) => {
  // Reset stock data fetch to ensure fresh data for ingredients
  resetStockDataFetch();

  const { menuItems, createMenuItem, updateMenuItem } = useMenuStore();

  // Data from new service layer - automatically cached and deduplicated
  const {
    stockItems,
    isLoading: stockLoading,
    error: stockError,
  } = useStockItems();

  const {
    categories,
    isLoading: categoriesLoading,
    error: categoriesError,
    refresh: refreshCategories,
  } = useMenuCategories();

  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editingItem = itemId
    ? menuItems.find(item => item.id === itemId)
    : null;

  const [nameError, setNameError] = useState<string | null>(null);

  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      price: undefined as any, // Will be set by user input, no invalid default
      category: defaultCategory || (categories && categories.length > 0 ? categories[0].id : 'default'),
      isAvailable: true,
      isActive: true,
      isCustomizable: false, // ✅ NEW: Default value for isCustomizable
      isPrintableInKitchen: true, // Default: print in kitchen tickets
      ingredients: [],
    },
    mode: 'onChange', // Validate fields as they change
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients' as const,
  });

  // 🔍 Stock data monitoring (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📦 MenuItemForm Stock Status:', {
        stockItemsLength: stockItems?.length,
        stockLoading,
        stockError,
        hasStockItems: !!(stockItems && stockItems.length > 0),
      });
    }
  }, [stockItems, stockLoading, stockError]);

  // Refresh categories when form opens to get latest data
  useEffect(() => {
    refreshCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount - refreshCategories is stable

  // Debug: Log categories when they load
  useEffect(() => {
    console.log('📂 MenuItemForm - Categories loaded:', {
      count: categories?.length || 0,
      categories: categories,
      defaultCategory,
      currentFormCategory: form.getValues('category'),
    });
  }, [categories, defaultCategory, form]);

  // Show error messages from service layer if any
  useEffect(() => {
    if (stockError) {
      toast({
        title: 'Stock Error',
        description: stockError,
        variant: 'destructive',
      });
    }
    if (categoriesError) {
      toast({
        title: 'Categories Error',
        description: categoriesError,
        variant: 'destructive',
      });
    }
  }, [stockError, categoriesError, toast]);

  // Update form when categories are loaded (only if no defaultCategory was provided)
  useEffect(() => {
    // Don't override if editing an existing item
    if (editingItem) return;
    
    if (!defaultCategory && categories && categories.length > 0) {
      const currentValue = form.getValues('category');
      // Only set if no value or invalid value
      if (!currentValue || currentValue === 'default' || currentValue === '[object Object]') {
        form.setValue('category', categories[0].id);
        console.log('✅ Set default category ID:', categories[0].id, 'Name:', categories[0].name);
      }
    } else if (defaultCategory && categories && categories.length > 0) {
      // Find the category ID by name if a default category name was provided
      const categoryObj = categories.find(cat => cat.name === defaultCategory);
      if (categoryObj) {
        form.setValue('category', categoryObj.id);
        console.log('✅ Set pre-selected category ID:', categoryObj.id, 'Name:', categoryObj.name);
      } else {
        // If not found by name, try using it as an ID directly
        form.setValue('category', defaultCategory);
        console.log('✅ Set pre-selected category (as-is):', defaultCategory);
      }
    }
  }, [categories, form, defaultCategory, editingItem]);

  // Load existing item data when editing
  useEffect(() => {
    if (editingItem) {
      console.log('🔄 Loading editing item data:', {
        itemId: editingItem.id,
        name: editingItem.name,
        category: editingItem.category,
        categoryId: editingItem.categoryId,
        price: editingItem.price,
        isCustomizable: (editingItem as any).isCustomizable,
      });

      // Convert Ingredient[] to IngredientWithQuantity[] for the form
      const ingredients: IngredientWithQuantity[] = Array.isArray(editingItem.ingredients)
        ? editingItem.ingredients.map(ing => ({
            stockItemId: ing.id,
            quantityRequired: ing.quantityRequired || 1,
            unit: ing.unit || '',
          }))
        : [];

      // CRITICAL FIX: Use categoryId if available, otherwise try to find ID from category name
      let categoryValue = editingItem.categoryId || editingItem.category;
      
      // If we only have a category name, try to find its ID
      if (!editingItem.categoryId && categories && categories.length > 0) {
        const foundCategory = categories.find(cat => cat.name === editingItem.category);
        if (foundCategory) {
          categoryValue = foundCategory.id;
          console.log('✅ Found category ID from name:', { name: editingItem.category, id: foundCategory.id });
        }
      }

      form.reset({
        name: editingItem.name,
        description: editingItem.description || '',
        price: editingItem.price,
        category: categoryValue, // Use the resolved category ID
        isAvailable: editingItem.isAvailable,
        isActive: true, // Default value as it's not in the MenuItem type
        isCustomizable: (editingItem as any).isCustomizable || false, // ✅ NEW: Load isCustomizable value
        isPrintableInKitchen: (editingItem as any).isPrintableInKitchen !== undefined ? (editingItem as any).isPrintableInKitchen : true, // Default to true if not set
        ingredients: ingredients,
      });

      console.log('✅ Form reset with data:', {
        name: editingItem.name,
        category: categoryValue,
        price: editingItem.price,
        ingredientsCount: ingredients.length,
      });
    } else {
      // Reset to default values when not editing
      console.log('🔄 Resetting form to default values (new item mode)');
      form.reset({
        name: '',
        description: '',
        price: undefined as any,
        category: defaultCategory || (categories && categories.length > 0 ? categories[0].id : 'default'),
        isAvailable: true,
        isActive: true,
        isCustomizable: false,
        isPrintableInKitchen: true,
        ingredients: [],
      });
    }
  }, [editingItem, form, categories, defaultCategory]); // Removed stockItems, added categories and defaultCategory

  // Calculate ingredient costs and profit margin
  const calculateCosts = () => {
    const ingredients = (form.watch('ingredients') || []) as IngredientWithQuantity[];
    const price = form.watch('price') || 0;

    // Use the utility functions to calculate costs and profit metrics
    const { totalCost: totalIngredientCost, hasLowStock } =
      calculateIngredientCosts(ingredients, stockItems || []);
    const { profitMargin, grossProfit } = calculateProfitMetrics(
      price,
      totalIngredientCost
    );

    return {
      totalIngredientCost,
      profitMargin,
      grossProfit,
      hasLowStock,
    };
  };

  const costs = calculateCosts();

  const addIngredient = () => {
    append({
      stockItemId: '',
      quantityRequired: 0,
      unit: '', // Initialize with empty unit - will be updated when stock item is selected
    });
  };

  const onSubmit = async (data: FormData) => {
    // Prevent double submissions
    if (isSubmitting) {
      console.log('⚠️ Already submitting, ignoring duplicate submission');
      return;
    }

    console.log('🔵 onSubmit called with:', { itemId, isEditMode: !!itemId, data });
    setIsSubmitting(true);

    try {
      // Ensure data is properly formatted
      const formattedData = {
        ...data,
        name: data.name?.trim() || '',
        description: data.description?.trim() || '',
        price:
          typeof data.price === 'number'
            ? data.price
            : parseFloat(data.price as any) || 0,
        category:
          data.category || (categories.length > 0 ? categories[0] : 'default'),
        isAvailable: !!data.isAvailable,
        isActive: !!data.isActive,
        isCustomizable: !!data.isCustomizable, // ✅ NEW: Include isCustomizable in formatted data
        isPrintableInKitchen: data.isPrintableInKitchen !== undefined ? !!data.isPrintableInKitchen : true, // Default to true
        ingredients: data.ingredients || [],
      };

      // Run comprehensive validation
      const validationResult = await validateMenuItem(
        formattedData,
        itemId || undefined
      );

      console.log('Validation result:', validationResult);

      if (!validationResult.isValid) {
        // Apply validation errors to the form
        if (Object.keys(validationResult.errors).length > 0) {
          Object.entries(validationResult.errors).forEach(
            ([field, message]) => {
              console.log(`Setting error for field ${field}:`, message);
              form.setError(field as any, {
                type: 'manual',
                message: String(message),
              });
            }
          );
        } else {
          // If no specific errors were found but validation failed
          form.setError('root', {
            type: 'manual',
            message: 'Please check all fields and try again',
          });
          console.error(
            'Validation failed but no specific errors were returned'
          );
        }

        toast({
          title: 'Validation Error',
          description: 'Please correct the errors in the form',
          variant: 'destructive',
        });

        setIsSubmitting(false);
        return;
      }

      // 🔥 CRITICAL FIX: Transform form data to proper Ingredient objects
      const ingredientsList = data.ingredients
        ? data.ingredients
            .map(ing => {
              if (typeof ing === 'object' && ing !== null && 'stockItemId' in ing && ing.stockItemId) {
                // Find the full stock item data to create proper Ingredient object
                const stockItem = stockItems?.find(
                  stock => stock.id === ing.stockItemId
                );
                if (stockItem) {
                  return {
                    id: ing.stockItemId, // ✅ Use 'id' for backend compatibility
                    name: stockItem.name || stockItem.itemName,
                    quantityRequired: ing.quantityRequired || 1,
                    currentStock: stockItem.currentStock || 0,
                    unit: stockItem.unit || 'pcs',
                    costPerUnit: stockItem.costPerUnit || 0,
                    isRequired: true,
                    isSelected: true,
                    canAdjust: true,
                  };
                }
              }
              return null;
            })
            .filter((ing): ing is NonNullable<typeof ing> => ing !== null)
        : [];

      // Create a proper MenuItem object for the API
      // Now sending categoryId (the form stores the ID)
      const apiMenuItem = {
        name: data.name.trim(), // Ensure trimmed values are sent
        description: data.description?.trim() || '',
        price: data.price,
        categoryId: data.category, // Send category ID from the form
        category: data.category, // Also send for backwards compatibility
        isAvailable: data.isAvailable,
        isCustomizable: data.isCustomizable,
        isPrintableInKitchen: data.isPrintableInKitchen !== undefined ? data.isPrintableInKitchen : true, // Default to true
        ingredients: ingredientsList,
      };

      console.log('📤 MenuItemForm sending to store:', {
        formData: {
          name: data.name,
          description: data.description,
          price: data.price,
          category: data.category,
          isAvailable: data.isAvailable,
          isCustomizable: data.isCustomizable,
        },
        apiMenuItem: {
          ...apiMenuItem,
          categoryId: apiMenuItem.categoryId,
          category: apiMenuItem.category,
          price: apiMenuItem.price,
        },
        priceType: typeof data.price,
        categoryType: typeof data.category,
        ingredientsCount: ingredientsList.length,
      });

      // Use our tryCatch utility for better error handling
      const actionType = itemId ? 'update' : 'create';
      const operationTitle = itemId ? 'Update Menu Item' : 'Create Menu Item';

      console.log('🎯 Action type determined:', { actionType, itemId, operationTitle });

      if (actionType === 'update' && itemId) {
        console.log('🔄 Calling updateMenuItem with:', { itemId, apiMenuItem });
        try {
          const result = await updateMenuItem(itemId!, apiMenuItem);
          console.log('✅ Update result:', result);
          toast({
            title: 'Menu Item Updated',
            description: `${data.name} has been updated successfully`,
          });
        } catch (updateError) {
          console.error('❌ Update failed:', updateError);
          toast({
            title: 'Update Failed',
            description: updateError instanceof Error ? updateError.message : 'Failed to update menu item',
            variant: 'destructive',
          });
          throw updateError; // Re-throw to prevent form from closing
        }
      } else {
        await tryCatch(
          async () => {
            const result = await createMenuItem(apiMenuItem);

            // Additional verification - try to fetch the item back immediately
            if (result && result.id) {
              try {
                const verifyResponse = await menuAPI.getById(result.id);
                console.log('✅ Menu item created and verified successfully:', {
                  id: result.id,
                  name: result.name,
                  verified: !!verifyResponse,
                });
              } catch (verifyError) {
                console.warn(
                  '⚠️ Menu item created but verification failed:',
                  verifyError
                );
              }
            }
            toast({
              title: 'Menu Item Created',
              description: `${data.name} has been added to the menu`,
            });
            return result;
          },
          operationTitle,
          'Failed to create menu item. Please check your input and try again.',
          { rethrow: false }
        );
      }

      // Close the form if we got this far (no errors were thrown)
      console.log('✅ Menu item saved successfully, closing form');
      onClose();
    } catch (error) {
      // This will rarely execute because we use { rethrow: false } in tryCatch,
      // but it's here as a fallback for any unhandled errors
      console.error('❌ Unexpected error in onSubmit:', error);
      handleError(
        error,
        itemId ? 'Update Menu Item' : 'Create Menu Item',
        'An unexpected error occurred while saving the menu item.',
        { severity: ErrorSeverity.ERROR }
      );
      // Show a toast for the error
      toast({
        title: itemId ? 'Update Failed' : 'Creation Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      console.log('🔚 Submission complete, isSubmitting set to false');
    }
  };

  // Log form errors for debugging
  const formErrors = form.formState.errors;
  useEffect(() => {
    if (Object.keys(formErrors).length > 0) {
      console.log('❌ Form validation errors:', formErrors);
    }
  }, [formErrors]);

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          console.log('📝 Form onSubmit event triggered');
          form.handleSubmit(onSubmit as any)(e);
        }}
        className='flex flex-col h-full'
      >
        <div className='flex-1 space-y-4 pb-4'>
          {form.formState.errors.root && (
            <div className='rounded-md bg-red-50 p-4 dark:bg-red-900/20'>
              <div className='flex'>
                <div className='ml-3'>
                  <h3 className='text-sm font-medium text-red-800 dark:text-red-200'>
                    {form.formState.errors.root.message}
                  </h3>
                </div>
              </div>
            </div>
          )}
          {/* Basic Information */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-lg'>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {/* Name */}
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='e.g., Grilled Ribeye Steak'
                      {...field}
                      onChange={e => {
                        field.onChange(e); // Call the original onChange
                      }}
                      onBlur={async e => {
                        field.onBlur(); // Call the original onBlur

                        // Only check for duplicates if the name is not empty
                        if (e.target.value.trim()) {
                          await tryCatch(
                            async () => {
                              const result = await checkDuplicateName(
                                e.target.value,
                                itemId || undefined
                              );

                              if (!result.isUnique) {
                                setNameError(
                                  result.message || 'Duplicate name'
                                );
                                form.setError('name', {
                                  type: 'manual',
                                  message: result.message || 'Duplicate name',
                                });
                              } else {
                                setNameError(null);
                              }

                              return result;
                            },
                            'Validate Menu Name',
                            'Failed to check for duplicate menu item names.',
                            { showToast: false, rethrow: false }
                          );
                        }
                      }}
                    />
                  </FormControl>
                  {nameError && (
                    <p className='text-sm font-medium text-destructive'>
                      {nameError}
                    </p>
                  )}
                  <FormDescription>
                    The name of the menu item as it will appear to customers.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Describe the dish and its preparation...'
                      className='min-h-[100px]'
                      {...field}
                      onChange={e => {
                        field.onChange(e); // Call the original onChange
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Detailed description of the dish for customers.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price and Category Row */}
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='price'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type='text'
                        placeholder='0.00'
                        value={
                          typeof field.value === 'number'
                            ? field.value.toString()
                            : ''
                        }
                        onChange={e => {
                          // Only allow numbers and a single decimal point
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          // Ensure only one decimal point
                          const parts = value.split('.');
                          const sanitizedValue =
                            parts.length > 2
                              ? `${parts[0]}.${parts.slice(1).join('')}`
                              : value;

                          if (sanitizedValue === '' || sanitizedValue === '.') {
                            // Don't set value for empty or invalid input - let validation handle it
                            field.onChange(undefined);
                            console.log('Price cleared - undefined');
                          } else {
                            const numValue = parseFloat(sanitizedValue);
                            if (!isNaN(numValue)) {
                              field.onChange(numValue);
                              console.log('✅ Price set to:', numValue);
                            }
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='category'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={value => {
                        field.onChange(value);
                        console.log('Category selected:', value);
                      }}
                      value={field.value || undefined}
                      defaultValue={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select a category' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories && categories.length > 0 ? (
                          categories
                            .filter(
                              category => 
                                category && 
                                category.id && 
                                category.id.trim() !== '' && 
                                category.name &&
                                category.name.trim() !== ''
                            ) // ✅ Filter out invalid categories including empty strings
                            .map(category => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))
                        ) : (
                          <SelectItem value='no-category-placeholder'>
                            No Categories Available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Ingredient Tracking */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center justify-between text-lg'>
              <span className='flex items-center'>
                <Calculator className='mr-2 h-5 w-5' />
                Ingredient Tracking & Cost Analysis
              </span>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={addIngredient}
              >
                <Plus className='mr-1 h-4 w-4' />
                Add Ingredient
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {fields.length === 0 ? (
              <div className='py-8 text-center text-gray-500'>
                <Calculator className='mx-auto mb-4 h-12 w-12 text-gray-400' />
                <p className='text-sm'>No ingredients added yet</p>
                <p className='text-xs text-gray-400'>
                  Add ingredients to calculate profit margins
                </p>
              </div>
            ) : (
              <div className='space-y-2'>
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className='flex items-end space-x-2 rounded-lg border p-2'
                  >
                    <FormField
                      control={form.control}
                      name={`ingredients.${index}.stockItemId`}
                      render={({ field }) => (
                        <FormItem className='flex-1'>
                          <FormLabel>Stock Item</FormLabel>
                          <Select
                            onValueChange={value => {
                              // Update the stockItemId
                              field.onChange(value);

                              // Find the selected stock item
                              const selectedStockItem = stockItems.find(
                                item => item.id === value
                              );

                              // Update the unit in the ingredient object
                              if (selectedStockItem) {
                                // Get the current form values
                                const currentValues = form.getValues();

                                // Update the unit for this ingredient
                                const updatedIngredients = [
                                  ...currentValues.ingredients,
                                ];
                                updatedIngredients[index] = {
                                  ...updatedIngredients[index],
                                  unit: selectedStockItem.unit,
                                };

                                // Update the form
                                form.setValue(
                                  'ingredients',
                                  updatedIngredients
                                );
                              }
                            }}
                            value={field.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder='Select ingredient' />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {stockLoading ? (
                                <SelectItem
                                  value='loading-placeholder'
                                  disabled
                                >
                                  Loading stock items...
                                </SelectItem>
                              ) : stockItems && stockItems.length > 0 ? (
                                (() => {
                                  // 🔍 DEBUG: Log exactly what we're about to render
                                  console.log(
                                    '🎯 SelectContent Render Debug:',
                                    {
                                      totalStockItems: stockItems.length,
                                      stockItemsSample: stockItems.slice(0, 3),
                                    }
                                  );

                                  const filteredItems = stockItems.filter(
                                    item =>
                                      item.id &&
                                      item.id.trim() !== '' &&
                                      item.supplier !==
                                        'System-Generated Category'
                                  );

                                  console.log('🎯 Filtered Items Debug:', {
                                    originalCount: stockItems.length,
                                    filteredCount: filteredItems.length,
                                    filteredSample: filteredItems.slice(0, 3),
                                    filterReasons: stockItems.map(item => ({
                                      name: item.name || (item as any).itemName,
                                      hasValidId: !!(
                                        item.id && item.id.trim() !== ''
                                      ),
                                      supplier: item.supplier,
                                      passesSupplierFilter:
                                        item.supplier !==
                                        'System-Generated Category',
                                    })),
                                  });

                                  return filteredItems.map(item => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.name ||
                                        (item as any).itemName ||
                                        'Unknown Item'}{' '}
                                      ({item.unit}) - $
                                      {item.costPerUnit?.toFixed(2) || '0.00'}
                                    </SelectItem>
                                  ));
                                })()
                              ) : (
                                <SelectItem
                                  value='no-items-placeholder'
                                  disabled
                                >
                                  No stock items available
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`ingredients.${index}.quantityRequired`}
                      render={({ field }) => (
                        <FormItem className='w-40'>
                          <FormLabel>Quantity</FormLabel>
                          <div className='flex items-center space-x-2'>
                            <FormControl>
                              <Input
                                type='text'
                                placeholder='0'
                                className='w-24'
                                {...field}
                                onChange={e => {
                                  const value = e.target.value.replace(
                                    /[^0-9.]/g,
                                    ''
                                  );
                                  field.onChange(parseFloat(value) || 0);
                                }}
                              />
                            </FormControl>
                            <div className='text-sm text-gray-500'>
                              {form.getValues().ingredients[index]?.unit || ''}
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => remove(index)}
                      className='mb-2'
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Cost Analysis */}
            {fields.length > 0 && (
              <>
                <Separator />
                <div className='space-y-2 rounded-lg bg-gray-50 p-3'>
                  <h4 className='flex items-center font-medium text-gray-900'>
                    <DollarSign className='mr-2 h-4 w-4' />
                    Cost Analysis
                  </h4>
                  <div className='grid grid-cols-1 gap-3 text-sm md:grid-cols-3'>
                    <div>
                      <span className='text-gray-600'>Ingredient Cost:</span>
                      <div className='font-semibold text-red-600'>
                        ${costs.totalIngredientCost.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className='text-gray-600'>Gross Profit:</span>
                      <div
                        className={`font-semibold ${
                          costs.grossProfit >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        ${costs.grossProfit.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className='text-gray-600'>Profit Margin:</span>
                      <div
                        className={`font-semibold ${
                          costs.profitMargin >= 50
                            ? 'text-green-600'
                            : costs.profitMargin >= 30
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }`}
                      >
                        {costs.profitMargin.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  {costs.profitMargin < 30 && (
                    <div className='flex items-center space-x-2 rounded bg-orange-50 p-2 text-sm text-orange-600'>
                      <span>⚠️</span>
                      <span>
                        Low profit margin. Consider adjusting price or
                        ingredients.
                      </span>
                    </div>
                  )}
                  {costs.hasLowStock && (
                    <div className='mt-2 flex items-center space-x-2 rounded bg-amber-50 p-2 text-sm text-amber-600'>
                      <span>📉</span>
                      <span>
                        Some ingredients have low stock levels. Check inventory
                        before adding this item.
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Availability and Status */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-lg'>Availability Settings</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <FormField
              control={form.control}
              name='isAvailable'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Available for Order
                    </FormLabel>
                    <FormDescription>
                      Whether this item can be ordered by customers.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='isActive'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>Active Item</FormLabel>
                    <FormDescription>
                      Whether this item is active in the system.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* ✅ NEW: Allow Customization Toggle */}
            <FormField
              control={form.control}
              name='isCustomizable'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Allow Customization
                    </FormLabel>
                    <FormDescription>
                      Whether customers can customize this item (ingredients,
                      notes, etc.) regardless of ingredient count.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Kitchen Ticket Printing Toggle */}
            <FormField
              control={form.control}
              name='isPrintableInKitchen'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      Print in Kitchen Tickets
                    </FormLabel>
                    <FormDescription>
                      When enabled, this item will appear on kitchen tickets when ordered.
                      Disable for items that don't require kitchen preparation.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        </div>

        {/* Submit Buttons */}
        <div className='flex justify-end space-x-2 pt-4 border-t mt-4'>
          <Button type='button' variant='outline' onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            type='submit' 
            disabled={isSubmitting}
            onClick={() => {
              console.log('🔘 Submit button clicked', { 
                itemId, 
                isEditMode: !!itemId,
                isSubmitting,
                buttonText: itemId ? 'Update Item' : 'Create Item'
              });
            }}
          >
            {isSubmitting
              ? 'Saving...'
              : itemId
                ? 'Update Item'
                : 'Create Item'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default MenuItemForm;
