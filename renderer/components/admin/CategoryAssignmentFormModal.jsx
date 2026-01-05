'use client';
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Package, ShoppingCart, Tag, CheckCircle2, AlertTriangle, } from 'lucide-react';
// Form validation schema
const categoryAssignmentSchema = z.object({
    categoryId: z.string().min(1, 'Category is required'),
    addonGroupId: z.string().min(1, 'Add-on group is required'),
    isActive: z.boolean(),
    sortOrder: z
        .number()
        .int('Must be a whole number')
        .min(0, 'Sort order cannot be negative')
        .max(999, 'Sort order must be less than 1000'),
});
export function CategoryAssignmentFormModal({ open, onClose, onSubmit, initialData, title, mode, categories, addonGroups, existingAssignments, }) {
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedAddonGroup, setSelectedAddonGroup] = useState(null);
    const [validationWarnings, setValidationWarnings] = useState([]);
    const { register, handleSubmit, control, formState: { errors, isSubmitting }, reset, watch, setValue, } = useForm({
        resolver: zodResolver(categoryAssignmentSchema),
        defaultValues: {
            categoryId: initialData?.categoryId || '',
            addonGroupId: initialData?.addonGroupId || '',
            isActive: initialData?.isActive ?? true,
            sortOrder: initialData?.sortOrder || 0,
        },
    });
    // Watch form values
    const categoryId = watch('categoryId');
    const addonGroupId = watch('addonGroupId');
    const isActive = watch('isActive');
    // Update selected objects when IDs change
    useEffect(() => {
        const category = categories.find(c => c.id === categoryId);
        setSelectedCategory(category || null);
    }, [categoryId, categories]);
    useEffect(() => {
        const addonGroup = addonGroups.find(g => g.id === addonGroupId);
        setSelectedAddonGroup(addonGroup || null);
    }, [addonGroupId, addonGroups]);
    // Validate assignment for warnings
    useEffect(() => {
        const warnings = [];
        if (categoryId && addonGroupId) {
            // Check for duplicate assignment
            const isDuplicate = existingAssignments.some(assignment => assignment.categoryId === categoryId &&
                assignment.addonGroupId === addonGroupId &&
                assignment.id !== initialData?.id);
            if (isDuplicate) {
                warnings.push('This add-on group is already assigned to this category');
            }
            // Check if category already has many assignments
            const categoryAssignments = existingAssignments.filter(a => a.categoryId === categoryId);
            if (categoryAssignments.length >= 5) {
                warnings.push('This category already has many add-on groups assigned');
            }
            // Check if addon group has few addons
            if (selectedAddonGroup && selectedAddonGroup._count.addons === 0) {
                warnings.push('This add-on group has no add-ons yet');
            }
            // Check if category is inactive
            if (selectedCategory && !selectedCategory.isActive) {
                warnings.push('This category is currently inactive');
            }
            // Check if addon group is inactive
            if (selectedAddonGroup && !selectedAddonGroup.isActive) {
                warnings.push('This add-on group is currently inactive');
            }
        }
        setValidationWarnings(warnings);
    }, [
        categoryId,
        addonGroupId,
        selectedCategory,
        selectedAddonGroup,
        existingAssignments,
        initialData?.id,
    ]);
    // Reset form when modal opens/closes or initial data changes
    useEffect(() => {
        if (open) {
            reset({
                categoryId: initialData?.categoryId || '',
                addonGroupId: initialData?.addonGroupId || '',
                isActive: initialData?.isActive ?? true,
                sortOrder: initialData?.sortOrder || 0,
            });
        }
    }, [open, initialData, reset]);
    const onFormSubmit = async (data) => {
        try {
            await onSubmit(data);
            reset();
        }
        catch (error) {
            console.error('Error submitting form:', error);
        }
    };
    const handleClose = () => {
        reset();
        setValidationWarnings([]);
        onClose();
    };
    // Get available categories (exclude those already assigned in edit mode)
    const availableCategories = categories.filter(category => {
        if (mode === 'edit' && initialData) {
            return category.isActive || category.id === initialData.categoryId;
        }
        return category.isActive;
    });
    // Get available addon groups (exclude those already assigned in edit mode)
    const availableAddonGroups = addonGroups.filter(group => {
        if (mode === 'edit' && initialData) {
            return group.isActive || group.id === initialData.addonGroupId;
        }
        return group.isActive;
    });
    const canSubmit = categoryId && addonGroupId && validationWarnings.length === 0;
    return (<Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-h-[90dvh] max-w-2xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
            ? 'Assign an add-on group to a menu category to make add-ons available for items in that category.'
            : 'Update the category assignment settings and configuration.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className='space-y-6'>
          {/* Assignment Selection */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <Package className='h-4 w-4'/>
                Assignment Selection
              </CardTitle>
              <CardDescription>
                Choose which category and add-on group to connect
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                {/* Category Selection */}
                <div className='space-y-2'>
                  <Label htmlFor='categoryId' className='required'>
                    Menu Category
                  </Label>
                  <Controller name='categoryId' control={control} render={({ field }) => (<Select value={field.value} onValueChange={field.onChange} disabled={mode === 'edit'} // Don't allow changing category in edit mode
        >
                        <SelectTrigger className={errors.categoryId ? 'border-destructive' : ''}>
                          <SelectValue placeholder='Select a category'/>
                        </SelectTrigger>
                        <SelectContent>
                          {availableCategories
                .filter(category => category && category.id && category.id.trim() !== '')
                .map(category => (<SelectItem key={category.id} value={category.id}>
                              <div className='flex w-full items-center justify-between'>
                                <span>{category.name}</span>
                                {category._count && (<div className='ml-2 flex gap-1'>
                                    <Badge variant='outline' className='text-xs'>
                                      {category._count.items} items
                                    </Badge>
                                    <Badge variant='outline' className='text-xs'>
                                      {category._count.categoryAddonGroups}{' '}
                                      groups
                                    </Badge>
                                  </div>)}
                              </div>
                            </SelectItem>))}
                        </SelectContent>
                      </Select>)}/>
                  {errors.categoryId && (<p className='flex items-center gap-1 text-sm text-destructive'>
                      <AlertCircle className='h-3 w-3'/>
                      {errors.categoryId.message}
                    </p>)}
                </div>

                {/* Add-on Group Selection */}
                <div className='space-y-2'>
                  <Label htmlFor='addonGroupId' className='required'>
                    Add-on Group
                  </Label>
                  <Controller name='addonGroupId' control={control} render={({ field }) => (<Select value={field.value} onValueChange={field.onChange} disabled={mode === 'edit'} // Don't allow changing group in edit mode
        >
                        <SelectTrigger className={errors.addonGroupId ? 'border-destructive' : ''}>
                          <SelectValue placeholder='Select an add-on group'/>
                        </SelectTrigger>
                        <SelectContent>
                          {availableAddonGroups
                .filter(group => group && group.id && group.id.trim() !== '')
                .map(group => (<SelectItem key={group.id} value={group.id}>
                              <div className='flex w-full items-center justify-between'>
                                <span>{group.name}</span>
                                <div className='ml-2 flex gap-1'>
                                  <Badge variant='outline' className='text-xs'>
                                    {group._count.addons} add-ons
                                  </Badge>
                                  {group.minSelections > 0 && (<Badge variant='secondary' className='text-xs'>
                                      Required
                                    </Badge>)}
                                </div>
                              </div>
                            </SelectItem>))}
                        </SelectContent>
                      </Select>)}/>
                  {errors.addonGroupId && (<p className='flex items-center gap-1 text-sm text-destructive'>
                      <AlertCircle className='h-3 w-3'/>
                      {errors.addonGroupId.message}
                    </p>)}
                </div>
              </div>

              {/* Selection Preview */}
              {selectedCategory && selectedAddonGroup && (<div className='grid grid-cols-1 gap-4 pt-4 md:grid-cols-2'>
                  {/* Category Info */}
                  <Card className='border-2 border-blue-100'>
                    <CardHeader className='pb-2'>
                      <CardTitle className='flex items-center gap-2 text-sm'>
                        <ShoppingCart className='h-3 w-3'/>
                        Selected Category
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-2'>
                      <div className='font-medium'>{selectedCategory.name}</div>
                      {selectedCategory.description && (<p className='text-xs text-muted-foreground'>
                          {selectedCategory.description}
                        </p>)}
                      <div className='flex items-center gap-2 text-xs'>
                        <Badge variant={selectedCategory.isActive ? 'default' : 'secondary'}>
                          {selectedCategory.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {selectedCategory._count && (<span className='text-muted-foreground'>
                            {selectedCategory._count.items} menu items
                          </span>)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Add-on Group Info */}
                  <Card className='border-2 border-green-100'>
                    <CardHeader className='pb-2'>
                      <CardTitle className='flex items-center gap-2 text-sm'>
                        <Tag className='h-3 w-3'/>
                        Selected Add-on Group
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-2'>
                      <div className='font-medium'>
                        {selectedAddonGroup.name}
                      </div>
                      {selectedAddonGroup.description && (<p className='text-xs text-muted-foreground'>
                          {selectedAddonGroup.description}
                        </p>)}
                      <div className='flex items-center gap-2 text-xs'>
                        <Badge variant={selectedAddonGroup.isActive
                ? 'default'
                : 'secondary'}>
                          {selectedAddonGroup.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <span className='text-muted-foreground'>
                          Min: {selectedAddonGroup.minSelections}, Max:{' '}
                          {selectedAddonGroup.maxSelections || 'Unlimited'}
                        </span>
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {selectedAddonGroup._count.addons} add-ons available
                      </div>
                    </CardContent>
                  </Card>
                </div>)}

              {/* Validation Warnings */}
              {validationWarnings.length > 0 && (<Alert variant={validationWarnings.some(w => w.includes('already assigned'))
                ? 'destructive'
                : 'default'}>
                  <AlertTriangle className='h-4 w-4'/>
                  <AlertDescription>
                    <div className='space-y-1'>
                      <div className='font-medium'>Please note:</div>
                      <ul className='list-inside list-disc space-y-1 text-sm'>
                        {validationWarnings.map((warning, index) => (<li key={index}>{warning}</li>))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>)}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg'>Assignment Settings</CardTitle>
              <CardDescription>
                Configure how this assignment behaves in the POS system
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                {/* Active Status */}
                <div className='flex items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-1'>
                    <Label htmlFor='isActive'>Active Status</Label>
                    <p className='text-xs text-muted-foreground'>
                      {isActive
            ? 'Add-on group will be available for this category'
            : "Assignment is disabled and won't show in POS"}
                    </p>
                  </div>
                  <Switch id='isActive' checked={isActive} onCheckedChange={checked => setValue('isActive', checked)}/>
                </div>

                {/* Sort Order */}
                <div className='space-y-2'>
                  <Label htmlFor='sortOrder'>Display Order</Label>
                  <Input id='sortOrder' type='number' min='0' max='999' {...register('sortOrder', { valueAsNumber: true })} className={errors.sortOrder ? 'border-destructive' : ''}/>
                  {errors.sortOrder && (<p className='flex items-center gap-1 text-sm text-destructive'>
                      <AlertCircle className='h-3 w-3'/>
                      {errors.sortOrder.message}
                    </p>)}
                  <p className='text-xs text-muted-foreground'>
                    Order in which add-on groups appear (0 = first)
                  </p>
                </div>
              </div>

              {/* Assignment Impact */}
              {selectedCategory && selectedAddonGroup && isActive && (<Alert>
                  <CheckCircle2 className='h-4 w-4'/>
                  <AlertDescription>
                    <div className='space-y-1'>
                      <div className='font-medium'>Assignment Impact:</div>
                      <div className='text-sm'>
                        The "<strong>{selectedAddonGroup.name}</strong>" add-on
                        group will be available when customers select items from
                        the "<strong>{selectedCategory.name}</strong>" category.
                        {selectedAddonGroup.minSelections > 0 && (<span className='mt-1 block text-orange-600'>
                            <strong>Note:</strong> This group requires at least{' '}
                            {selectedAddonGroup.minSelections} selection(s).
                          </span>)}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>)}
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting || !canSubmit}>
              {isSubmitting
            ? 'Saving...'
            : mode === 'create'
                ? 'Create Assignment'
                : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);
}
