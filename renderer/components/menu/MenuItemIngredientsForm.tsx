/**
 * Menu Item Ingredients Form Component
 *
 * A reusable component for managing ingredient relationships between menu items and inventory
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useStockStore } from '@/stores/stockStore';
import { Button } from '@/components/ui/button';
import {
  FormControl,
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
import { Calculator, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm, Control } from 'react-hook-form';
import { inventoryAPI } from '@/lib/ipc-api';
import { useToast } from '@/hooks/use-toast';

interface Ingredient {
  inventoryId: string;
  quantity: number;
  unit?: string;
}

interface MenuItemIngredientsFormProps {
  menuItemId: string;
  initialIngredients?: Ingredient[];
  onSave: (ingredients: Ingredient[]) => void;
  onCancel: () => void;
}

interface FormValues {
  ingredients: Ingredient[];
}

export const MenuItemIngredientsForm: React.FC<
  MenuItemIngredientsFormProps
> = ({ menuItemId, initialIngredients = [], onSave, onCancel }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { stockItems, adjustStockQuantity } = useStockStore();

  // Initialize form with react-hook-form
  const form = useForm<FormValues>({
    defaultValues: {
      ingredients: initialIngredients.length > 0 ? initialIngredients : [],
    },
    mode: 'onBlur', // Validate when user leaves field, not on every keystroke
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });

  // Load existing ingredients for this menu item
  useEffect(() => {
    const loadIngredients = async () => {
      if (!menuItemId) return;

      setIsLoading(true);
      try {
        // Fetch menu item with its inventory relationships
        const response = await inventoryAPI.getMenuItemIngredients(menuItemId);

        if (response.success && response.data) {
          // Map the data to our form format
          const ingredients = response.data.map(item => ({
            inventoryId: item.inventoryId,
            quantity: item.quantity,
            unit: item.inventory?.unit,
          }));

          // Reset form with fetched data
          form.reset({ ingredients });
        }
      } catch (error) {
        toast({
          title: 'Error loading ingredients',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to load ingredients',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadIngredients();
  }, [menuItemId, toast]); // Removed 'form' - it's stable and doesn't need to trigger reloads

  const addIngredient = () => {
    if (stockItems.length === 0) {
      toast({
        title: 'No inventory items',
        description: 'Please add inventory items first',
        variant: 'destructive',
      });
      return;
    }

    append({
      inventoryId: stockItems[0].id,
      quantity: 1,
      unit: stockItems[0].unit,
    });
  };

  const handleSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      // Save ingredients using the API
      const response = await inventoryAPI.updateMenuItemIngredients(
        menuItemId,
        data.ingredients
      );

      if (response.success) {
        toast({
          title: 'Ingredients saved',
          description: 'Menu item ingredients updated successfully',
        });
        onSave(data.ingredients);
      } else {
        throw new Error(response.error || 'Failed to save ingredients');
      }
    } catch (error) {
      toast({
        title: 'Error saving ingredients',
        description:
          error instanceof Error ? error.message : 'Failed to save ingredients',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-medium'>Ingredients</h3>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={addIngredient}
          disabled={isLoading}
        >
          <Plus className='mr-2 h-4 w-4' />
          Add Ingredient
        </Button>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)}>
        {fields.length === 0 ? (
          <div className='py-8 text-center text-gray-500'>
            <Calculator className='mx-auto mb-4 h-12 w-12 text-gray-400' />
            <p className='text-sm'>No ingredients added yet</p>
            <p className='text-xs text-gray-400'>
              Add ingredients to track inventory usage
            </p>
          </div>
        ) : (
          <div className='mb-4 space-y-4'>
            {fields.map((field, index) => (
              <div
                key={field.id}
                className='flex items-end space-x-3 rounded-lg border p-3'
              >
                <FormField
                  control={form.control}
                  name={`ingredients.${index}.inventoryId`}
                  render={({ field }) => (
                    <FormItem className='flex-1'>
                      <FormLabel>Inventory Item</FormLabel>
                      <Select
                        onValueChange={value => {
                          // Update the inventoryId
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
                            form.setValue('ingredients', updatedIngredients);
                          }
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select ingredient' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoading ? (
                            <SelectItem value='loading-placeholder' disabled>
                              Loading inventory items...
                            </SelectItem>
                          ) : stockItems && stockItems.length > 0 ? (
                            stockItems
                              .filter(item => item && item.id && item.id.trim() !== '')
                              .map(item => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name} ({item.unit}) - $
                                  {item.costPerUnit.toFixed(2)}
                                </SelectItem>
                              ))
                          ) : (
                            <SelectItem value='no-items-placeholder' disabled>
                              No inventory items available
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
                  name={`ingredients.${index}.quantity`}
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
                            value={field.value?.toString() || ''}
                            onChange={e => {
                              // Let user type freely
                              field.onChange(e.target.value);
                            }}
                            onBlur={e => {
                              // Sanitize and parse when user leaves field
                              const value = e.target.value.replace(/[^0-9.]/g, '');
                              const numValue = parseFloat(value) || 0;
                              field.onChange(numValue);
                            }}
                          />
                        </FormControl>
                        <div className='text-sm text-gray-500'>
                          {form.getValues().ingredients[index].unit || ''}
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
                  disabled={isLoading}
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className='mt-4 flex justify-end space-x-2'>
          <Button
            type='button'
            variant='outline'
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type='submit' disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Ingredients'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default MenuItemIngredientsForm;
