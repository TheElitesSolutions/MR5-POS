'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  Info,
  Package,
  DollarSign,
  Warehouse,
  Plus,
  Trash2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { inventoryAPI } from '@/lib/ipc-api';

// Form validation schema
const getAddonSchema = () => {
  return z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters'),
    description: z
      .string()
      .max(500, 'Description must be less than 500 characters')
      .optional()
      .nullable(),
    price: z
      .number()
      .min(0, 'Price cannot be negative')
      .max(999.99, 'Price cannot exceed $999.99')
      .multipleOf(0.01, 'Price must be in cents'),
    addonGroupId: z.string().min(1, 'Add-on group is required'),
    inventoryItems: z
      .array(
        z.object({
          inventoryId: z.string(),
          quantity: z.number().min(0),
        })
      )
      .optional()
      .default([]),
    isActive: z.boolean(),
    sortOrder: z
      .number()
      .int('Must be a whole number')
      .min(0, 'Sort order cannot be negative')
      .max(999, 'Sort order must be less than 1000'),
  });
};

type AddonFormData = z.infer<ReturnType<typeof getAddonSchema>>;

interface AddonInventoryItem {
  inventoryId: string;
  quantity: number;
}

interface Addon {
  id: string;
  name: string;
  description: string | null;
  price: number;
  addonGroupId: string;
  inventoryItems?: AddonInventoryItem[];
  isActive: boolean;
  sortOrder: number;
}

interface AddonGroup {
  id: string;
  name: string;
  isActive: boolean;
}

interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
  costPerUnit: number;
  supplier?: string;
  lastRestocked?: Date;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AddonFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AddonFormData) => Promise<void>;
  initialData?: Addon | null;
  title: string;
  mode: 'create' | 'edit';
  addonGroups: AddonGroup[];
  inventoryItems: InventoryItem[];
}

export function AddonFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  title,
  mode,
  addonGroups,
  inventoryItems,
}: AddonFormModalProps) {
  // State for inventory selection
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  const [inventoryQuantity, setInventoryQuantity] = useState<string>(''); // Use string for better UX
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryItems, setCategoryItems] = useState<InventoryItem[]>([]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<AddonFormData>({
    resolver: zodResolver(getAddonSchema()),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      price: initialData?.price || 0,
      addonGroupId: initialData?.addonGroupId || '',
      inventoryItems: initialData?.inventoryItems || [],
      isActive: initialData?.isActive ?? true,
      sortOrder: initialData?.sortOrder || 0,
    },
  });

  // Use field array for inventory items
  const {
    fields: inventoryFields,
    append: appendInventory,
    remove: removeInventory,
    update: updateInventory,
  } = useFieldArray({
    control,
    name: 'inventoryItems',
  });

  // Watch form values
  const price = watch('price');
  const isActive = watch('isActive');
  const addonGroupId = watch('addonGroupId');

  // Load categories when modal opens
  useEffect(() => {
    if (!open) return;
    
    const loadCategories = async () => {
      try {
        const response = await inventoryAPI.getCategories();
        if (response.success && response.data) {
          setCategories(Array.isArray(response.data) ? response.data : []);
        } else {
          console.error('Failed to load categories:', response.error);
          setCategories([]);
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
        setCategories([]);
      }
    };
    loadCategories();
  }, [open]);

  // Load items when category changes
  useEffect(() => {
    if (!open || !selectedCategory) {
      setCategoryItems([]);
      return;
    }
    
    const loadCategoryItems = async () => {
      try {
        console.log('[AddonFormModal] Loading items for category:', selectedCategory);
        const response = await inventoryAPI.getByCategory(selectedCategory);
        console.log('[AddonFormModal] Response:', response);
        
        if (response.success && response.data) {
          const items = Array.isArray(response.data) ? response.data : [];
          console.log('[AddonFormModal] Loaded items:', items);
          setCategoryItems(items);
        } else {
          console.error('Failed to load category items:', response.error);
          setCategoryItems([]);
        }
      } catch (error) {
        console.error('Failed to load category items:', error);
        setCategoryItems([]);
      }
    };
    loadCategoryItems();
  }, [selectedCategory, open]);

  // Reset form when modal opens/closes or initial data changes
  useEffect(() => {
    if (open) {
      reset({
        name: initialData?.name || '',
        description: initialData?.description || '',
        price: initialData?.price || 0,
        addonGroupId: initialData?.addonGroupId || '',
        inventoryItems: initialData?.inventoryItems || [],
        isActive: initialData?.isActive ?? true,
        sortOrder: initialData?.sortOrder || 0,
      });
      setSelectedCategory('');
      setSelectedInventoryId('');
      setInventoryQuantity('');
    }
  }, [open, initialData, reset]);

  const onFormSubmit = async (data: AddonFormData) => {
    try {
      await onSubmit(data);
      reset();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Handler to add inventory item
  const handleAddInventoryItem = () => {
    if (!selectedInventoryId) return;

    const item = (categoryItems || []).find(i => i && i.id === selectedInventoryId);
    if (!item) {
      console.error('[AddonFormModal] Item not found:', selectedInventoryId);
      return;
    }

    console.log('[AddonFormModal] Adding item:', item);

    // Convert quantity string to number
    const quantity = parseFloat(inventoryQuantity) || 0;

    // Check if already added
    const existingIndex = (inventoryFields || []).findIndex(
      f => f && f.inventoryId === selectedInventoryId
    );

    if (existingIndex >= 0) {
      // Update quantity
      console.log('[AddonFormModal] Updating existing item at index:', existingIndex);
      updateInventory(existingIndex, {
        inventoryId: selectedInventoryId,
        quantity: quantity,
      });
    } else {
      // Add new
      console.log('[AddonFormModal] Adding new item');
      appendInventory({
        inventoryId: selectedInventoryId,
        quantity: quantity,
      });
    }

    // Reset selection
    setSelectedInventoryId('');
    setInventoryQuantity('');
  };

  // Find selected addon group for validation info
  const selectedAddonGroup = addonGroups.find(
    group => group.id === addonGroupId
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-h-[80vh] max-w-3xl overflow-hidden flex flex-col'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new add-on item with optional inventory tracking.'
              : 'Update the add-on item settings and configuration.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className='flex flex-col flex-1 overflow-hidden'>
          <div className='flex-1 overflow-y-auto px-1 space-y-4'>
          {/* Inventory Items (Optional) */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <Warehouse className='h-4 w-4' />
                Inventory Items (Optional)
              </CardTitle>
              <CardDescription>
                Add inventory items that make up this add-on. Quantities will be deducted when ordered.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {/* Add Item Section */}
              <div className='grid grid-cols-4 gap-2'>
                <Select
                  value={selectedCategory}
                  onValueChange={val => {
                    setSelectedCategory(val);
                    setSelectedInventoryId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select category' />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories || [])
                      .filter(cat => 
                        cat && 
                        cat.trim() !== '' &&
                        !cat.toLowerCase().includes('placeholder') // Filter out placeholder categories
                      )
                      .map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedInventoryId}
                  onValueChange={setSelectedInventoryId}
                  disabled={!selectedCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select item' />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryItems && categoryItems.length > 0 ? (
                      categoryItems
                        .filter(item => 
                          item && 
                          item.id && 
                          item.id.trim() !== '' &&
                          !item.itemName.toLowerCase().includes('placeholder') // Filter out placeholders
                        )
                        .map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.itemName}
                          </SelectItem>
                        ))
                    ) : (
                      <SelectItem value='no-items' disabled>
                        {selectedCategory ? 'No items in this category' : 'Select a category first'}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>

                <Input
                  type='number'
                  min='0'
                  step='0.01'
                  value={inventoryQuantity}
                  onChange={e => setInventoryQuantity(e.target.value)}
                  onFocus={e => e.target.select()}
                  placeholder='Qty (0 = track only)'
                />

                <Button
                  type='button'
                  onClick={handleAddInventoryItem}
                  disabled={!selectedInventoryId}
                >
                  <Plus className='h-4 w-4' />
                  Add
                </Button>
              </div>

              {/* Items List */}
              {inventoryFields.length > 0 && (
                <div className='space-y-2'>
                  <Label>Added Items</Label>
                  {inventoryFields.map((field, index) => {
                    // Look in categoryItems first (recently loaded), then fallback to inventoryItems prop
                    const item = 
                      (categoryItems || []).find(i => i && i.id === field.inventoryId) ||
                      (inventoryItems || []).find(i => i && i.id === field.inventoryId);
                    
                    return (
                      <div
                        key={field.id}
                        className='flex items-center justify-between rounded border p-2'
                      >
                        <div className='flex-1'>
                          <span className='font-medium'>
                            {item?.itemName || `Item ID: ${field.inventoryId}`}
                          </span>
                          <span className='ml-2 text-sm text-muted-foreground'>
                            Qty: {field.quantity} {item?.unit || ''}
                          </span>
                        </div>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => removeInventory(index)}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {inventoryFields.length === 0 && (
                <Alert>
                  <Info className='h-4 w-4' />
                  <AlertDescription>
                    <strong>No inventory tracking:</strong> This add-on will not
                    affect stock levels and will always be available for selection.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <Package className='h-4 w-4' />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                {/* Name */}
                <div className='space-y-2'>
                  <Label htmlFor='name' className='required'>
                    Name
                  </Label>
                  <Input
                    id='name'
                    placeholder='e.g., Extra Cheese, Large Size'
                    {...register('name')}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className='flex items-center gap-1 text-sm text-destructive'>
                      <AlertCircle className='h-3 w-3' />
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Price */}
                <div className='space-y-2'>
                  <Label htmlFor='price' className='required'>
                    Price ($)
                  </Label>
                  <div className='relative'>
                    <DollarSign className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                    <Input
                      id='price'
                      type='number'
                      step='0.01'
                      min='0'
                      max='999.99'
                      placeholder='0.00'
                      {...register('price', { valueAsNumber: true })}
                      onFocus={e => e.target.select()}
                      className={`pl-9 ${errors.price ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {errors.price && (
                    <p className='flex items-center gap-1 text-sm text-destructive'>
                      <AlertCircle className='h-3 w-3' />
                      {errors.price.message}
                    </p>
                  )}
                  {price > 0 && (
                    <p className='text-xs text-muted-foreground'>
                      Display price: ${price.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className='space-y-2'>
                <Label htmlFor='description'>Description (Optional)</Label>
                <Textarea
                  id='description'
                  placeholder='Brief description of this add-on...'
                  {...register('description')}
                  className={errors.description ? 'border-destructive' : ''}
                  rows={2}
                />
                {errors.description && (
                  <p className='flex items-center gap-1 text-sm text-destructive'>
                    <AlertCircle className='h-3 w-3' />
                    {errors.description.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Group Assignment */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg'>Group Assignment</CardTitle>
              <CardDescription>
                Assign this add-on to a specific group
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {/* Add-on Group */}
              <div className='space-y-2'>
                <Label htmlFor='addonGroupId' className='required'>
                  Add-on Group
                </Label>
                <Select
                  value={addonGroupId}
                  onValueChange={value => setValue('addonGroupId', value)}
                >
                  <SelectTrigger
                    className={errors.addonGroupId ? 'border-destructive' : ''}
                  >
                    <SelectValue placeholder='Select an add-on group' />
                  </SelectTrigger>
                  <SelectContent>
                    {addonGroups
                      .filter(group => group.isActive && group.id && group.id.trim() !== '')
                      .map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {errors.addonGroupId && (
                  <p className='flex items-center gap-1 text-sm text-destructive'>
                    <AlertCircle className='h-3 w-3' />
                    {errors.addonGroupId.message}
                  </p>
                )}
              </div>

              {/* Group Info */}
              {selectedAddonGroup && (
                <Alert>
                  <Info className='h-4 w-4' />
                  <AlertDescription>
                    <strong>Group:</strong> {selectedAddonGroup.name}
                    <br />
                    This add-on will be available when customers are selecting
                    from this group.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg'>Settings</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                {/* Active Status */}
                <div className='flex items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-1'>
                    <Label htmlFor='isActive'>Active Status</Label>
                    <p className='text-xs text-muted-foreground'>
                      {isActive
                        ? 'Available for selection in POS'
                        : 'Hidden from POS interface'}
                    </p>
                  </div>
                  <Switch
                    id='isActive'
                    checked={isActive}
                    onCheckedChange={checked => setValue('isActive', checked)}
                  />
                </div>

                {/* Sort Order */}
                <div className='space-y-2'>
                  <Label htmlFor='sortOrder'>Sort Order</Label>
                  <Input
                    id='sortOrder'
                    type='number'
                    min='0'
                    max='999'
                    {...register('sortOrder', { valueAsNumber: true })}
                    onFocus={e => e.target.select()}
                    className={errors.sortOrder ? 'border-destructive' : ''}
                  />
                  {errors.sortOrder && (
                    <p className='flex items-center gap-1 text-sm text-destructive'>
                      <AlertCircle className='h-3 w-3' />
                      {errors.sortOrder.message}
                    </p>
                  )}
                  <p className='text-xs text-muted-foreground'>
                    Display order within the group (0 = first)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>

          <DialogFooter className='mt-4'>
            <Button
              type='button'
              variant='outline'
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving...'
                : mode === 'create'
                  ? 'Create Add-on'
                  : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
