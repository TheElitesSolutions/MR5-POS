'use client';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Check, ArrowLeft, Loader2, Package, } from 'lucide-react';
import { useAddonSelection } from '@/context/AddonSelectionContext';
import { MemoizedAddonGroupSelector, } from './AddonGroupSelector';
import { PriceImpactIndicator } from './PriceImpactIndicator';
/**
 * AddonSelectionStep - Main add-on selection interface for MenuFlow
 *
 * Features:
 * - Category-based add-on group loading
 * - Real-time validation with error feedback
 * - Price impact calculation and display
 * - Performance optimized with memoization
 * - Accessibility compliant interface
 * - Touch-optimized for tablet POS devices
 */
export const AddonSelectionStep = ({ selectedItem, itemQuantity, onContinue, onBack, className, }) => {
    const { state, loadCategoryAddonGroups, selectAddon, deselectAddon, updateAddonQuantity, clearAddons, validateSelections, getSelectionsForMenuItem, calculatePriceImpact, } = useAddonSelection();
    // Local state for UI
    const [validationErrors, setValidationErrors] = useState([]);
    const [isValidating, setIsValidating] = useState(false);
    // Get current selections for this menu item
    const currentSelections = useMemo(() => getSelectionsForMenuItem(selectedItem.id), [getSelectionsForMenuItem, selectedItem.id]);
    // Calculate pricing
    const priceImpact = useMemo(() => calculatePriceImpact(selectedItem.id), [calculatePriceImpact, selectedItem.id]);
    const basePrice = selectedItem.price * itemQuantity;
    const finalPrice = basePrice + priceImpact * itemQuantity;
    // Load addon groups when component mounts or category changes
    useEffect(() => {
        // ✅ FIXED: Use categoryId (ID) instead of category (name) for addon lookup
        const categoryIdentifier = selectedItem.categoryId || selectedItem.category;
        console.log('🔍 AddonSelectionStep: Loading addon groups for category:', {
            categoryId: selectedItem.categoryId,
            categoryName: selectedItem.category,
            using: categoryIdentifier,
        });
        loadCategoryAddonGroups(categoryIdentifier);
        // Clear any existing selections for this item to start fresh
        clearAddons(selectedItem.id);
    }, [
        selectedItem.categoryId,
        selectedItem.category,
        selectedItem.id,
        loadCategoryAddonGroups,
        clearAddons,
    ]);
    // Validate selections when they change
    useEffect(() => {
        const errors = validateSelections(selectedItem.id);
        setValidationErrors(errors);
    }, [currentSelections, validateSelections, selectedItem.id]);
    // Group addons by addon group
    const addonsByGroup = useMemo(() => {
        const groups = new Map();
        // Initialize empty arrays for each group
        state.availableGroups.forEach(group => {
            groups.set(group.id, []);
        });
        // Populate groups with their addons
        state.availableGroups.forEach(group => {
            if (group.addons && group.addons.length > 0) {
                groups.set(group.id, group.addons.filter(addon => addon.isActive));
            }
        });
        return groups;
    }, [state.availableGroups]);
    // Handle addon selection for a specific group
    // ✅ FIX: Wrap in useCallback and work with fresh selections
    const handleGroupSelectionChange = useCallback((groupId, selections) => {
        // Get fresh current selections
        const freshCurrentSelections = getSelectionsForMenuItem(selectedItem.id);
        // Clear existing selections for this group
        const otherGroupSelections = freshCurrentSelections.filter(sel => sel.addon.addonGroupId !== groupId);
        // Combine with new selections for this group
        const allSelections = [...otherGroupSelections, ...selections];
        // Batch updates: first remove deselected, then add/update selected
        const selectedAddonIds = new Set(selections.map(s => s.addonId));
        // Remove addons from this group that are no longer selected
        freshCurrentSelections.forEach(currentSel => {
            if (currentSel.addon.addonGroupId === groupId &&
                !selectedAddonIds.has(currentSel.addonId)) {
                deselectAddon(selectedItem.id, currentSel.addonId);
            }
        });
        // Add or update selected addons
        selections.forEach(selection => {
            selectAddon(selectedItem.id, selection.addon, selection.quantity);
        });
    }, [selectedItem.id, getSelectionsForMenuItem, selectAddon, deselectAddon]);
    // Check if can continue
    const canContinue = useMemo(() => {
        // Must have no validation errors
        const hasErrors = validationErrors.some(err => err.severity === 'error');
        return !hasErrors && !state.loadingGroups;
    }, [validationErrors, state.loadingGroups]);
    // Handle continue action
    const handleContinue = async () => {
        setIsValidating(true);
        try {
            // Final validation
            const finalErrors = validateSelections(selectedItem.id);
            const hasErrors = finalErrors.some(err => err.severity === 'error');
            if (!hasErrors) {
                console.log('✅ AddonSelectionStep: Continuing with selections:', currentSelections);
                onContinue(currentSelections);
            }
            else {
                setValidationErrors(finalErrors);
                console.warn('❌ AddonSelectionStep: Validation errors prevent continue:', finalErrors);
            }
        }
        finally {
            setIsValidating(false);
        }
    };
    // Handle skip addons (continue without selections)
    const handleSkipAddons = () => {
        clearAddons(selectedItem.id);
        onContinue([]);
    };
    // Loading state
    if (state.loadingGroups) {
        return (<div className={cn('flex flex-col items-center justify-center p-8', className)}>
        <Loader2 className='mb-4 h-8 w-8 animate-spin text-primary'/>
        <p className='text-muted-foreground'>Loading add-on options...</p>
      </div>);
    }
    // No addon groups available
    if (state.availableGroups.length === 0) {
        return (<div className={cn('flex h-full flex-col', className)}>
        {/* Header */}
        <Card className='flex-none'>
          <CardHeader className='pb-3 pt-4'>
            <div className='flex items-center justify-between'>
              <div>
                <h2 className='text-lg font-semibold text-foreground'>
                  Customize Your Order
                </h2>
                <p className='text-sm text-muted-foreground'>
                  {selectedItem.name} • Quantity: {itemQuantity}
                </p>
              </div>
              <PriceImpactIndicator basePrice={basePrice} addonTotal={0} finalPrice={basePrice} variant='compact'/>
            </div>
          </CardHeader>
          <CardContent className='pb-3'>
            <Alert>
              <Package className='h-4 w-4'/>
              <AlertDescription>
                No add-on options available for this item. You can continue to
                add it to your order.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className='flex-1'/>

        {/* Action buttons - Fixed at bottom */}
        <div className='flex flex-none items-center gap-3 border-t bg-background p-4'>
          <Button variant='outline' onClick={onBack} className='touch-manipulation'>
            <ArrowLeft className='mr-2 h-4 w-4'/>
            Back
          </Button>
          <Button onClick={() => onContinue([])} className='flex-1' size='lg'>
            <Check className='mr-2 h-4 w-4'/>
            Continue - ${basePrice.toFixed(2)}
          </Button>
        </div>
      </div>);
    }
    return (<div className={cn('flex h-full flex-col', className)}>
      {/* Header with item info and price impact */}
      <Card className='flex-none'>
        <CardHeader className='pb-3 pt-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold text-foreground'>
                Add Extras & Customize
              </h2>
              <p className='text-sm text-muted-foreground'>
                {selectedItem.name} • Quantity: {itemQuantity}
              </p>
            </div>
            <PriceImpactIndicator basePrice={basePrice} addonTotal={priceImpact * itemQuantity} finalPrice={finalPrice} showBreakdown={priceImpact > 0} variant='detailed'/>
          </div>
        </CardHeader>
      </Card>

      {/* Addon groups - Scrollable area */}
      <div className='flex-1 overflow-y-auto px-1 py-4'>
        <div className='space-y-4'>
          {state.availableGroups.map(group => {
            const groupAddons = addonsByGroup.get(group.id) || [];
            const groupSelections = currentSelections.filter(sel => sel.addon.addonGroupId === group.id);
            return (<MemoizedAddonGroupSelector key={group.id} group={group} addons={groupAddons} selections={groupSelections} stockLevels={state.stockLevels} onSelectionChange={handleGroupSelectionChange} showGroupDescription={true} collapsible={true} defaultExpanded={group.minSelections > 0} // Expand required groups by default
            />);
        })}
        </div>
      </div>

      {/* Action buttons - Fixed at bottom */}
      <div className='flex flex-none items-center gap-3 border-t bg-background p-4'>
        <Button variant='outline' onClick={onBack} className='touch-manipulation'>
          <ArrowLeft className='mr-2 h-4 w-4'/>
          Back
        </Button>

        {currentSelections.length === 0 && (<Button variant='ghost' onClick={handleSkipAddons} className='touch-manipulation'>
            Skip Add-ons
          </Button>)}

        <Button onClick={handleContinue} disabled={!canContinue || isValidating} className='flex-1' size='lg'>
          {isValidating ? (<Loader2 className='mr-2 h-4 w-4 animate-spin'/>) : (<Check className='mr-2 h-4 w-4'/>)}
          {currentSelections.length > 0 ? 'Add to Order' : 'Continue'} - $
          {finalPrice.toFixed(2)}
        </Button>
      </div>

      {/* Accessibility improvements */}
      <div className='sr-only'>
        <p>
          Add-on selection step for {selectedItem.name}.
          {state.availableGroups.length} add-on groups available. Current
          selections: {currentSelections.length} items adding $
          {priceImpact.toFixed(2)} to the price.
          {validationErrors.length > 0 &&
            `${validationErrors.length} validation errors need to be resolved.`}
        </p>
      </div>
    </div>);
};
// Memoized version for performance
export const MemoizedAddonSelectionStep = React.memo(AddonSelectionStep);
export default AddonSelectionStep;
