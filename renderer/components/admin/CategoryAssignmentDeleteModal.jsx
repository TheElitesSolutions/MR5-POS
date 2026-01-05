'use client';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Trash2, Package, ShoppingCart, AlertCircle, Loader2, CheckCircle2, Tag, Users, Clock, } from 'lucide-react';
export function CategoryAssignmentDeleteModal({ open, onClose, onConfirm, assignment, }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletionImpact, setDeletionImpact] = useState(null);
    // Analyze deletion impact when modal opens
    useEffect(() => {
        if (open && assignment) {
            analyzeDeletionImpact();
        }
    }, [open, assignment]);
    const analyzeDeletionImpact = async () => {
        if (!assignment)
            return;
        setIsAnalyzing(true);
        try {
            // Simulate analysis of deletion impact
            // In a real app, this would call an API endpoint to check:
            // - Active orders with items from this category that might have selected add-ons
            // - Menu items in the category
            // - Customer usage patterns
            const menuItemsCount = assignment.category._count?.items || 0;
            const addonsCount = assignment.addonGroup._count.addons;
            const isRequired = assignment.addonGroup.minSelections > 0;
            const impact = {
                activeOrdersCount: 0, // Would be calculated from active orders
                categoryMenuItemsCount: menuItemsCount,
                addonGroupAddonsCount: addonsCount,
                isRequiredGroup: isRequired,
                customerImpact: 'low',
                canSafelyDelete: true,
                warnings: [],
                errors: [],
            };
            // Determine customer impact level
            if (isRequired && menuItemsCount > 5) {
                impact.customerImpact = 'high';
            }
            else if (isRequired || menuItemsCount > 10) {
                impact.customerImpact = 'medium';
            }
            // Add warnings based on impact
            if (impact.isRequiredGroup) {
                impact.warnings.push(`This is a required add-on group (min ${assignment.addonGroup.minSelections} selections)`);
            }
            if (impact.categoryMenuItemsCount > 0) {
                impact.warnings.push(`${impact.categoryMenuItemsCount} menu item${impact.categoryMenuItemsCount !== 1 ? 's' : ''} in "${assignment.category.name}" will lose access to "${assignment.addonGroup.name}" add-ons`);
            }
            if (impact.addonGroupAddonsCount > 0) {
                impact.warnings.push(`${impact.addonGroupAddonsCount} add-on${impact.addonGroupAddonsCount !== 1 ? 's' : ''} will no longer be available for this category`);
            }
            if (assignment.isActive) {
                impact.warnings.push('Currently active and visible to customers in POS');
            }
            // Add contextual warnings based on category/group combination
            if (assignment.category.name.toLowerCase().includes('pizza') &&
                assignment.addonGroup.name.toLowerCase().includes('topping')) {
                impact.warnings.push('This appears to be a core pizza-topping assignment that customers expect');
                impact.customerImpact = 'high';
            }
            if (assignment.category.name.toLowerCase().includes('drink') &&
                assignment.addonGroup.name.toLowerCase().includes('size')) {
                impact.warnings.push('Size options are typically essential for drink categories');
                impact.customerImpact = 'high';
            }
            // Add errors that prevent deletion
            if (impact.activeOrdersCount > 0) {
                impact.errors.push(`Cannot delete: ${impact.activeOrdersCount} active order${impact.activeOrdersCount !== 1 ? 's' : ''} contain items from this category with selected add-ons`);
                impact.canSafelyDelete = false;
            }
            // High impact warning
            if (impact.customerImpact === 'high') {
                impact.warnings.push('⚠️ High customer impact - this change may significantly affect the ordering experience');
            }
            setDeletionImpact(impact);
        }
        catch (error) {
            console.error('Error analyzing deletion impact:', error);
        }
        finally {
            setIsAnalyzing(false);
        }
    };
    const handleConfirm = async () => {
        if (!assignment || !deletionImpact?.canSafelyDelete)
            return;
        setIsDeleting(true);
        try {
            await onConfirm(assignment.id);
            onClose();
        }
        catch (error) {
            console.error('Error deleting category assignment:', error);
        }
        finally {
            setIsDeleting(false);
        }
    };
    const handleClose = () => {
        setDeletionImpact(null);
        onClose();
    };
    if (!assignment)
        return null;
    const getImpactColor = (level) => {
        switch (level) {
            case 'high':
                return 'text-red-600 bg-red-50 border-red-200';
            case 'medium':
                return 'text-orange-600 bg-orange-50 border-orange-200';
            default:
                return 'text-blue-600 bg-blue-50 border-blue-200';
        }
    };
    return (<Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-destructive'>
            <AlertTriangle className='h-5 w-5'/>
            Remove Category Assignment
          </DialogTitle>
          <DialogDescription>
            You are about to remove the add-on group "
            {assignment.addonGroup.name}" from the "{assignment.category.name}"
            category. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Assignment Summary */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Package className='h-4 w-4'/>
                Assignment Details
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {/* Category Info */}
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <ShoppingCart className='h-3 w-3 text-muted-foreground'/>
                    <span className='font-medium'>Category:</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span>{assignment.category.name}</span>
                    <Badge variant={assignment.category.isActive ? 'default' : 'secondary'}>
                      {assignment.category.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                {assignment.category.description && (<p className='pl-5 text-xs text-muted-foreground'>
                    {assignment.category.description}
                  </p>)}
              </div>

              <Separator />

              {/* Add-on Group Info */}
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <Tag className='h-3 w-3 text-muted-foreground'/>
                    <span className='font-medium'>Add-on Group:</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span>{assignment.addonGroup.name}</span>
                    <Badge variant={assignment.addonGroup.isActive ? 'default' : 'secondary'}>
                      {assignment.addonGroup.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                {assignment.addonGroup.description && (<p className='pl-5 text-xs text-muted-foreground'>
                    {assignment.addonGroup.description}
                  </p>)}
                <div className='flex items-center justify-between pl-5 text-xs text-muted-foreground'>
                  <span>Selection Rules:</span>
                  <span>
                    Min: {assignment.addonGroup.minSelections}, Max:{' '}
                    {assignment.addonGroup.maxSelections || 'Unlimited'}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Assignment Settings */}
              <div className='flex items-center justify-between text-sm'>
                <div className='flex items-center gap-2'>
                  <Clock className='h-3 w-3 text-muted-foreground'/>
                  <span>Status:</span>
                </div>
                <div className='flex items-center gap-2'>
                  <Badge variant={assignment.isActive ? 'default' : 'secondary'}>
                    {assignment.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant='outline' className='text-xs'>
                    Order: {assignment.sortOrder}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deletion Impact Analysis */}
          {isAnalyzing ? (<Card>
              <CardContent className='flex items-center justify-center py-6'>
                <div className='flex items-center gap-2 text-muted-foreground'>
                  <Loader2 className='h-4 w-4 animate-spin'/>
                  Analyzing removal impact...
                </div>
              </CardContent>
            </Card>) : (deletionImpact && (<Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-base'>
                    <AlertCircle className='h-4 w-4'/>
                    Impact Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {/* Customer Impact Level */}
                  <Alert className={getImpactColor(deletionImpact.customerImpact)}>
                    <Users className='h-4 w-4'/>
                    <AlertDescription>
                      <div className='space-y-1'>
                        <div className='font-medium'>
                          Customer Impact:{' '}
                          {deletionImpact.customerImpact.toUpperCase()}
                        </div>
                        <div className='text-sm'>
                          {deletionImpact.customerImpact === 'high' &&
                'This change will significantly affect customer ordering options'}
                          {deletionImpact.customerImpact === 'medium' &&
                'This change may affect some customer ordering preferences'}
                          {deletionImpact.customerImpact === 'low' &&
                'This change should have minimal impact on customer experience'}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>

                  {/* Statistics */}
                  <div className='grid grid-cols-2 gap-4'>
                    <div className='flex items-center gap-2 rounded-lg bg-muted/50 p-3'>
                      <ShoppingCart className='h-4 w-4 text-muted-foreground'/>
                      <div>
                        <div className='font-semibold'>
                          {deletionImpact.categoryMenuItemsCount}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          Menu Items
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-2 rounded-lg bg-muted/50 p-3'>
                      <Tag className='h-4 w-4 text-muted-foreground'/>
                      <div>
                        <div className='font-semibold'>
                          {deletionImpact.addonGroupAddonsCount}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          Add-ons Affected
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Warnings */}
                  {deletionImpact.warnings.length > 0 && (<Alert>
                      <AlertTriangle className='h-4 w-4'/>
                      <AlertDescription>
                        <div className='space-y-1'>
                          <div className='font-medium'>This removal will:</div>
                          <ul className='list-inside list-disc space-y-1 text-sm'>
                            {deletionImpact.warnings.map((warning, index) => (<li key={index}>{warning}</li>))}
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>)}

                  {/* Errors */}
                  {deletionImpact.errors.length > 0 && (<Alert variant='destructive'>
                      <AlertCircle className='h-4 w-4'/>
                      <AlertDescription>
                        <div className='space-y-1'>
                          <div className='font-medium'>Cannot remove:</div>
                          <ul className='list-inside list-disc space-y-1 text-sm'>
                            {deletionImpact.errors.map((error, index) => (<li key={index}>{error}</li>))}
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>)}

                  {/* Safe Deletion Confirmation */}
                  {deletionImpact.canSafelyDelete && (<Alert className='border-green-200 bg-green-50'>
                      <CheckCircle2 className='h-4 w-4 text-green-600'/>
                      <AlertDescription className='text-green-800'>
                        This assignment can be safely removed.
                        {deletionImpact.customerImpact === 'low' && (<span className='mt-1 block'>
                            The change will have minimal customer impact.
                          </span>)}
                      </AlertDescription>
                    </Alert>)}
                </CardContent>
              </Card>))}

          {/* Final Confirmation */}
          {deletionImpact?.canSafelyDelete && (<Alert variant='destructive'>
              <AlertTriangle className='h-4 w-4'/>
              <AlertDescription>
                <strong>This action is permanent and cannot be undone.</strong>
                <br />
                {deletionImpact.isRequiredGroup && (<span className='font-medium text-red-600'>
                    Warning: This is a required add-on group. Customers will no
                    longer be forced to make selections from it.
                  </span>)}
                {!deletionImpact.isRequiredGroup && (<span>
                    The add-on group will no longer be available for items in
                    this category.
                  </span>)}
              </AlertDescription>
            </Alert>)}
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant='destructive' onClick={handleConfirm} disabled={isAnalyzing || isDeleting || !deletionImpact?.canSafelyDelete}>
            {isDeleting ? (<>
                <Loader2 className='mr-2 h-4 w-4 animate-spin'/>
                Removing...
              </>) : (<>
                <Trash2 className='mr-2 h-4 w-4'/>
                Remove Assignment
              </>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
