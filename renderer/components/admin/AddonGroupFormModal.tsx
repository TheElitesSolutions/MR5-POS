'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Form validation schema
const addonGroupSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters')
      .regex(
        /^[a-zA-Z0-9\s\-_]+$/,
        'Name can only contain letters, numbers, spaces, hyphens, and underscores'
      ),
    description: z
      .string()
      .max(500, 'Description must be less than 500 characters')
      .optional()
      .nullable(),
    minSelections: z
      .number()
      .int('Must be a whole number')
      .min(0, 'Minimum selections cannot be negative')
      .max(20, 'Maximum of 20 minimum selections allowed'),
    maxSelections: z
      .number()
      .int('Must be a whole number')
      .min(1, 'Maximum selections must be at least 1')
      .max(50, 'Maximum of 50 selections allowed')
      .optional()
      .nullable(),
    isActive: z.boolean(),
    sortOrder: z
      .number()
      .int('Must be a whole number')
      .min(0, 'Sort order cannot be negative')
      .max(999, 'Sort order must be less than 1000'),
  })
  .refine(
    data => {
      if (data.maxSelections && data.minSelections > data.maxSelections) {
        return false;
      }
      return true;
    },
    {
      message: 'Minimum selections cannot be greater than maximum selections',
      path: ['minSelections'],
    }
  );

type AddonGroupFormData = z.infer<typeof addonGroupSchema>;

interface AddonGroup {
  id: string;
  name: string;
  description: string | null;
  minSelections: number;
  maxSelections: number | null;
  isActive: boolean;
  sortOrder: number;
}

interface AddonGroupFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AddonGroupFormData) => Promise<void>;
  initialData?: AddonGroup | null;
  title: string;
  mode: 'create' | 'edit';
}

export function AddonGroupFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  title,
  mode,
}: AddonGroupFormModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<AddonGroupFormData>({
    resolver: zodResolver(addonGroupSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      minSelections: initialData?.minSelections || 0,
      maxSelections: initialData?.maxSelections || null,
      isActive: initialData?.isActive ?? true,
      sortOrder: initialData?.sortOrder || 0,
    },
  });

  // Watch form values for validation feedback
  const minSelections = watch('minSelections');
  const maxSelections = watch('maxSelections');
  const isActive = watch('isActive');

  // Reset form when modal opens/closes or initial data changes
  React.useEffect(() => {
    if (open) {
      reset({
        name: initialData?.name || '',
        description: initialData?.description || '',
        minSelections: initialData?.minSelections || 0,
        maxSelections: initialData?.maxSelections || null,
        isActive: initialData?.isActive ?? true,
        sortOrder: initialData?.sortOrder || 0,
      });
    }
  }, [open, initialData, reset]);

  const onFormSubmit = async (data: AddonGroupFormData) => {
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-h-[80vh] max-w-2xl overflow-hidden flex flex-col'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new add-on group that can be assigned to menu categories.'
              : 'Update the add-on group settings and configuration.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className='flex flex-col flex-1 overflow-hidden'>
          <div className='flex-1 overflow-y-auto px-1 space-y-4'>
          {/* Basic Information */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg'>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {/* Name */}
              <div className='space-y-2'>
                <Label htmlFor='name' className='required'>
                  Name
                </Label>
                <Input
                  id='name'
                  placeholder='e.g., Drink Sizes, Pizza Toppings'
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

              {/* Description */}
              <div className='space-y-2'>
                <Label htmlFor='description'>Description (Optional)</Label>
                <Textarea
                  id='description'
                  placeholder='Brief description of this add-on group...'
                  {...register('description')}
                  className={errors.description ? 'border-destructive' : ''}
                  rows={3}
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

          {/* Selection Rules */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg'>Selection Rules</CardTitle>
              <CardDescription>
                Configure how many add-ons customers can select from this group
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                {/* Minimum Selections */}
                <div className='space-y-2'>
                  <Label htmlFor='minSelections'>Minimum Selections</Label>
                  <Input
                    id='minSelections'
                    type='number'
                    min='0'
                    max='20'
                    {...register('minSelections', { valueAsNumber: true })}
                    className={errors.minSelections ? 'border-destructive' : ''}
                  />
                  {errors.minSelections && (
                    <p className='flex items-center gap-1 text-sm text-destructive'>
                      <AlertCircle className='h-3 w-3' />
                      {errors.minSelections.message}
                    </p>
                  )}
                  <p className='text-xs text-muted-foreground'>
                    Required number of selections (0 = optional)
                  </p>
                </div>

                {/* Maximum Selections */}
                <div className='space-y-2'>
                  <Label htmlFor='maxSelections'>Maximum Selections</Label>
                  <Input
                    id='maxSelections'
                    type='number'
                    min='1'
                    max='50'
                    placeholder='Unlimited'
                    {...register('maxSelections', {
                      valueAsNumber: true,
                      setValueAs: value =>
                        value === '' ? null : parseInt(value),
                    })}
                    className={errors.maxSelections ? 'border-destructive' : ''}
                  />
                  {errors.maxSelections && (
                    <p className='flex items-center gap-1 text-sm text-destructive'>
                      <AlertCircle className='h-3 w-3' />
                      {errors.maxSelections.message}
                    </p>
                  )}
                  <p className='text-xs text-muted-foreground'>
                    Maximum allowed selections (empty = unlimited)
                  </p>
                </div>
              </div>

              {/* Validation Preview */}
              {(minSelections > 0 || maxSelections) && (
                <Alert>
                  <Info className='h-4 w-4' />
                  <AlertDescription>
                    <strong>Selection Rule:</strong> Customers must select{' '}
                    {minSelections > 0 && `at least ${minSelections}`}
                    {minSelections > 0 && maxSelections && ' and '}
                    {maxSelections && `at most ${maxSelections}`} add-on
                    {minSelections !== 1 && maxSelections !== 1 ? 's' : ''} from
                    this group.
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
                    className={errors.sortOrder ? 'border-destructive' : ''}
                  />
                  {errors.sortOrder && (
                    <p className='flex items-center gap-1 text-sm text-destructive'>
                      <AlertCircle className='h-3 w-3' />
                      {errors.sortOrder.message}
                    </p>
                  )}
                  <p className='text-xs text-muted-foreground'>
                    Display order in POS (0 = first)
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
                  ? 'Create Group'
                  : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
