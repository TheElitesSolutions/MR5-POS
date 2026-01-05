'use client';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Trash2, Tag, Package, ShoppingCart, AlertCircle, Loader2, CheckCircle2, DollarSign, Warehouse, } from 'lucide-react';
export function AddonDeleteModal({ open, onClose, onConfirm, addon, }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletionImpact, setDeletionImpact] = useState(null);
    // Analyze deletion impact when modal opens
    useEffect(() => {
        if (open && addon) {
            analyzeDeletionImpact();
        }
    }, [open, addon]);
    const analyzeDeletionImpact = async () => {
        if (!addon)
            return;
        setIsAnalyzing(true);
        try {
            // Simulate analysis of deletion impact
            // In a real app, this would call an API endpoint to check:
            // - Active orders containing this addon
            // - Category assignments
            // - Inventory implications
            const impact = {
                activeOrdersCount: 0, // Would be calculated from active orders
                categoryAssignmentsCount: 0, // Would be calculated from category addon groups
                inventoryLinked: !!addon.inventoryId,
                inventoryName: addon.inventory?.name,
                currentStock: addon.inventory?.currentStock,
                canSafelyDelete: true,
                warnings: [],
                errors: [],
            };
            // Add warnings based on usage
            if (addon.price > 0) {
                impact.warnings.push(`This add-on generates revenue ($${addon.price.toFixed(2)} per selection)`);
            }
            if (addon.isActive) {
                impact.warnings.push('Currently active and visible to customers');
            }
            if (impact.inventoryLinked && impact.inventoryName) {
                impact.warnings.push(`Linked to inventory item: ${impact.inventoryName}`);
                if (impact.currentStock && impact.currentStock > 0) {
                    impact.warnings.push(`${impact.currentStock} units in stock will remain unaffected`);
                }
            }
            // Add errors that prevent deletion
            if (impact.activeOrdersCount && impact.activeOrdersCount > 0) {
                impact.errors.push(`Cannot delete: ${impact.activeOrdersCount} active order${impact.activeOrdersCount !== 1 ? 's' : ''} contain this add-on`);
                impact.canSafelyDelete = false;
            }
            // Simulate some complexity for demo
            if (addon.name.toLowerCase().includes('popular')) {
                impact.warnings.push('This appears to be a popular add-on');
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
        if (!addon || !deletionImpact?.canSafelyDelete)
            return;
        setIsDeleting(true);
        try {
            await onConfirm(addon.id);
            onClose();
        }
        catch (error) {
            console.error('Error deleting add-on:', error);
        }
        finally {
            setIsDeleting(false);
        }
    };
    const handleClose = () => {
        setDeletionImpact(null);
        onClose();
    };
    if (!addon)
        return null;
    return (<Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-destructive'>
            <AlertTriangle className='h-5 w-5'/>
            Delete Add-On
          </DialogTitle>
          <DialogDescription>
            You are about to permanently delete the add-on "{addon.name}". This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Add-On Summary */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Tag className='h-4 w-4'/>
                Add-On Details
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex items-center justify-between'>
                <span className='font-medium'>{addon.name}</span>
                <div className='flex items-center gap-2'>
                  <Badge variant={addon.isActive ? 'default' : 'secondary'}>
                    {addon.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant='outline' className='flex items-center gap-1'>
                    <DollarSign className='h-3 w-3'/>${addon.price.toFixed(2)}
                  </Badge>
                </div>
              </div>

              {addon.description && (<p className='text-sm text-muted-foreground'>
                  {addon.description}
                </p>)}

              <Separator />

              <div className='space-y-2 text-sm'>
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground'>Group:</span>
                  <span className='font-medium'>{addon.addonGroup.name}</span>
                </div>

                {addon.inventory && (<div className='flex items-center justify-between'>
                    <span className='text-muted-foreground'>Inventory:</span>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>
                        {addon.inventory.name}
                      </span>
                      <Badge variant={addon.inventory.currentStock > 0
                ? 'default'
                : 'destructive'} className='text-xs'>
                        {addon.inventory.currentStock} stock
                      </Badge>
                    </div>
                  </div>)}
              </div>
            </CardContent>
          </Card>

          {/* Deletion Impact Analysis */}
          {isAnalyzing ? (<Card>
              <CardContent className='flex items-center justify-center py-6'>
                <div className='flex items-center gap-2 text-muted-foreground'>
                  <Loader2 className='h-4 w-4 animate-spin'/>
                  Analyzing deletion impact...
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
                  {/* Statistics */}
                  <div className='grid grid-cols-2 gap-4'>
                    <div className='flex items-center gap-2 rounded-lg bg-muted/50 p-3'>
                      <ShoppingCart className='h-4 w-4 text-muted-foreground'/>
                      <div>
                        <div className='font-semibold'>
                          {deletionImpact.activeOrdersCount}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          Active Orders
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-2 rounded-lg bg-muted/50 p-3'>
                      <Package className='h-4 w-4 text-muted-foreground'/>
                      <div>
                        <div className='font-semibold'>
                          {deletionImpact.categoryAssignmentsCount}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          Categories
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Inventory Impact */}
                  {deletionImpact.inventoryLinked && (<Alert>
                      <Warehouse className='h-4 w-4'/>
                      <AlertDescription>
                        <div className='space-y-1'>
                          <div className='font-medium'>Inventory Impact</div>
                          <div className='text-sm'>
                            This add-on is linked to{' '}
                            <strong>{deletionImpact.inventoryName}</strong>.
                            {deletionImpact.currentStock &&
                    deletionImpact.currentStock > 0 && (<span>
                                  {' '}
                                  The {deletionImpact.currentStock} units in
                                  stock will remain unaffected.
                                </span>)}
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>)}

                  {/* Warnings */}
                  {deletionImpact.warnings.length > 0 && (<Alert>
                      <AlertTriangle className='h-4 w-4'/>
                      <AlertDescription>
                        <div className='space-y-1'>
                          <div className='font-medium'>Please note:</div>
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
                          <div className='font-medium'>Cannot delete:</div>
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
                        This add-on can be safely deleted.
                      </AlertDescription>
                    </Alert>)}
                </CardContent>
              </Card>))}

          {/* Confirmation Text */}
          {deletionImpact?.canSafelyDelete && (<Alert variant='destructive'>
              <AlertTriangle className='h-4 w-4'/>
              <AlertDescription>
                <strong>This action is permanent and cannot be undone.</strong>
                <br />
                The add-on will be immediately removed from all menus and
                selection interfaces.
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
                Deleting...
              </>) : (<>
                <Trash2 className='mr-2 h-4 w-4'/>
                Delete Permanently
              </>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
