'use client';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Trash2, Tag, Package, ShoppingCart, AlertCircle, Loader2, CheckCircle2, } from 'lucide-react';
export function AddonGroupDeleteModal({ open, onClose, onConfirm, group, }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletionImpact, setDeletionImpact] = useState(null);
    // Analyze deletion impact when modal opens
    useEffect(() => {
        if (open && group) {
            analyzeDeletionImpact();
        }
    }, [open, group]);
    const analyzeDeletionImpact = async () => {
        if (!group)
            return;
        setIsAnalyzing(true);
        try {
            // Simulate analysis of deletion impact
            // In a real app, this would call an API endpoint
            const impact = {
                addonsCount: group._count.addons,
                categoriesCount: group._count.categoryAddonGroups,
                activeOrdersCount: 0, // Would be calculated from active orders
                canSafelyDelete: true,
                warnings: [],
                errors: [],
            };
            // Add warnings based on usage
            if (impact.addonsCount > 0) {
                impact.warnings.push(`${impact.addonsCount} add-on${impact.addonsCount !== 1 ? 's' : ''} will be permanently deleted`);
            }
            if (impact.categoriesCount > 0) {
                impact.warnings.push(`Will be removed from ${impact.categoriesCount} categor${impact.categoriesCount !== 1 ? 'ies' : 'y'}`);
            }
            if (group.isActive) {
                impact.warnings.push('Currently active in POS system');
            }
            // Add errors that prevent deletion
            if (impact.activeOrdersCount && impact.activeOrdersCount > 0) {
                impact.errors.push(`Cannot delete: ${impact.activeOrdersCount} active order${impact.activeOrdersCount !== 1 ? 's' : ''} contain this add-on group`);
                impact.canSafelyDelete = false;
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
        if (!group || !deletionImpact?.canSafelyDelete)
            return;
        setIsDeleting(true);
        try {
            await onConfirm(group.id);
            onClose();
        }
        catch (error) {
            console.error('Error deleting add-on group:', error);
        }
        finally {
            setIsDeleting(false);
        }
    };
    const handleClose = () => {
        setDeletionImpact(null);
        onClose();
    };
    if (!group)
        return null;
    return (<Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-destructive'>
            <AlertTriangle className='h-5 w-5'/>
            Delete Add-On Group
          </DialogTitle>
          <DialogDescription>
            You are about to permanently delete the add-on group "{group.name}".
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Group Summary */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Package className='h-4 w-4'/>
                Group Details
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex items-center justify-between'>
                <span className='font-medium'>{group.name}</span>
                <Badge variant={group.isActive ? 'default' : 'secondary'}>
                  {group.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {group.description && (<p className='text-sm text-muted-foreground'>
                  {group.description}
                </p>)}
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
                      <Tag className='h-4 w-4 text-muted-foreground'/>
                      <div>
                        <div className='font-semibold'>
                          {deletionImpact.addonsCount}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          Add-ons
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-2 rounded-lg bg-muted/50 p-3'>
                      <ShoppingCart className='h-4 w-4 text-muted-foreground'/>
                      <div>
                        <div className='font-semibold'>
                          {deletionImpact.categoriesCount}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          Categories
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Warnings */}
                  {deletionImpact.warnings.length > 0 && (<Alert>
                      <AlertTriangle className='h-4 w-4'/>
                      <AlertDescription>
                        <div className='space-y-1'>
                          <div className='font-medium'>
                            The following will occur:
                          </div>
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
                        This add-on group can be safely deleted.
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
                All associated data will be permanently removed from the system.
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
