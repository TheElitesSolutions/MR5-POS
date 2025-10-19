'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Info,
  Star,
  StarOff,
} from 'lucide-react';
import {
  AddonGroup,
  Addon,
  AddonSelection,
  ValidationError,
} from '@/types/addon';
import { AddonSelector, MemoizedAddonSelector } from './AddonSelector';

interface AddonGroupSelectorProps {
  group: AddonGroup;
  addons: Addon[];
  selections: AddonSelection[];
  stockLevels: Map<string, number>;
  onSelectionChange: (groupId: string, selections: AddonSelection[]) => void;
  showGroupDescription?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * AddonGroupSelector - Manages a group of add-ons with selection constraints
 *
 * Features:
 * - Group-level validation (min/max selections)
 * - Collapsible interface for space efficiency
 * - Real-time constraint feedback
 * - Selection progress indicators
 * - Accessibility compliant with group semantics
 * - Touch-optimized for tablet POS devices
 */
export const AddonGroupSelector: React.FC<AddonGroupSelectorProps> = ({
  group,
  addons,
  selections,
  stockLevels,
  onSelectionChange,
  showGroupDescription = true,
  collapsible = true,
  defaultExpanded = true,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calculate selection metrics
  const selectionMetrics = useMemo(() => {
    const totalQuantity = selections.reduce(
      (sum, sel) => sum + sel.quantity,
      0
    );
    const totalItems = selections.length;
    const totalPrice = selections.reduce((sum, sel) => sum + sel.totalPrice, 0);

    const meetsMinimum =
      group.minSelections === 0 || totalQuantity >= group.minSelections;
    const withinMaximum =
      !group.maxSelections || totalQuantity <= group.maxSelections;
    const isValid = meetsMinimum && withinMaximum;

    return {
      totalQuantity,
      totalItems,
      totalPrice,
      meetsMinimum,
      withinMaximum,
      isValid,
    };
  }, [selections, group.minSelections, group.maxSelections]);

  // Group validation status
  const getValidationStatus = () => {
    if (!selectionMetrics.meetsMinimum) {
      return {
        type: 'error' as const,
        message: `Select at least ${group.minSelections} ${group.minSelections === 1 ? 'item' : 'items'}`,
        icon: AlertCircle,
      };
    }

    if (!selectionMetrics.withinMaximum) {
      return {
        type: 'error' as const,
        message: `Maximum ${group.maxSelections} ${group.maxSelections === 1 ? 'item' : 'items'} allowed`,
        icon: AlertCircle,
      };
    }

    if (selectionMetrics.totalQuantity > 0) {
      return {
        type: 'success' as const,
        message: `${selectionMetrics.totalQuantity} selected`,
        icon: CheckCircle,
      };
    }

    return null;
  };

  const validationStatus = getValidationStatus();

  // Handle individual addon selection
  const handleAddonSelection = useCallback(
    (addon: Addon, quantity: number) => {
      const newSelections = [...selections];
      const existingIndex = newSelections.findIndex(
        s => s.addonId === addon.id
      );

      const addonSelection: AddonSelection = {
        addonId: addon.id,
        addon,
        quantity,
        unitPrice: addon.price,
        totalPrice: addon.price * quantity,
      };

      if (existingIndex >= 0) {
        newSelections[existingIndex] = addonSelection;
      } else {
        newSelections.push(addonSelection);
      }

      onSelectionChange(group.id, newSelections);
    },
    [selections, group.id, onSelectionChange]
  );

  // Handle addon deselection
  const handleAddonDeselect = useCallback(
    (addonId: string) => {
      const newSelections = selections.filter(s => s.addonId !== addonId);
      onSelectionChange(group.id, newSelections);
    },
    [selections, group.id, onSelectionChange]
  );

  // Get selection for specific addon
  const getAddonSelection = useCallback(
    (addonId: string) => {
      return selections.find(s => s.addonId === addonId);
    },
    [selections]
  );

  // Filter and sort addons
  const sortedAddons = useMemo(() => {
    return addons
      .filter(addon => addon.addonGroupId === group.id && addon.isActive)
      .sort((a, b) => {
        // Sort by sortOrder first, then by name
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        return a.name.localeCompare(b.name);
      });
  }, [addons, group.id]);

  // Required indicator
  const isRequired = group.minSelections > 0;

  // Header content
  const HeaderContent = () => (
    <div className='flex w-full items-start justify-between'>
      <div className='flex flex-1 items-start gap-3'>
        <div className='flex-1'>
          {/* Group name with required indicator */}
          <div className='flex items-center gap-2'>
            <h3 className='text-lg font-semibold text-foreground'>
              {group.name}
            </h3>

            {isRequired && (
              <Badge
                variant='outline'
                className='border-blue-200 bg-blue-50 text-xs text-blue-700'
              >
                <Star className='mr-1 h-3 w-3' />
                Required
              </Badge>
            )}
          </div>

          {/* Group description */}
          {showGroupDescription && group.description && (
            <p className='mt-1 text-sm text-muted-foreground'>
              {group.description}
            </p>
          )}

          {/* Selection constraints */}
          <div className='mt-2 flex items-center gap-2 text-xs text-muted-foreground'>
            {group.minSelections > 0 && <span>Min: {group.minSelections}</span>}
            {group.maxSelections && <span>Max: {group.maxSelections}</span>}
            {sortedAddons.length > 0 && (
              <span>{sortedAddons.length} options</span>
            )}
          </div>
        </div>

        {/* Selection status */}
        <div className='flex flex-col items-end gap-2'>
          {validationStatus && (
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
                validationStatus.type === 'error'
                  ? 'border border-red-200 bg-red-100 text-red-800'
                  : 'border border-green-200 bg-green-100 text-green-800'
              )}
            >
              <validationStatus.icon className='h-3 w-3' />
              <span>{validationStatus.message}</span>
            </div>
          )}

          {/* Price indicator */}
          {selectionMetrics.totalPrice > 0 && (
            <Badge
              variant='default'
              className='border-blue-200 bg-blue-100 text-blue-800'
            >
              +${selectionMetrics.totalPrice.toFixed(2)}
            </Badge>
          )}

          {/* Collapsible indicator */}
          {collapsible && (
            <div className='text-muted-foreground'>
              {isExpanded ? (
                <ChevronUp className='h-4 w-4' />
              ) : (
                <ChevronDown className='h-4 w-4' />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (collapsible) {
    return (
      <Card className={cn('w-full', className)}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <CardHeader className='cursor-pointer transition-colors hover:bg-muted/50'>
              <HeaderContent />
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className='pt-0'>
              <div className='space-y-3'>
                {sortedAddons.map(addon => {
                  const selection = getAddonSelection(addon.id);
                  const currentStock = stockLevels.get(addon.id) || 0;

                  return (
                    <MemoizedAddonSelector
                      key={addon.id}
                      addon={addon}
                      isSelected={!!selection}
                      quantity={selection?.quantity || 0}
                      currentStock={currentStock}
                      onSelectionChange={handleAddonSelection}
                      onDeselect={handleAddonDeselect}
                      showDescription={true}
                      showPrice={true}
                      size='md'
                    />
                  );
                })}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  // Non-collapsible version
  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <HeaderContent />
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {sortedAddons.map(addon => {
            const selection = getAddonSelection(addon.id);
            const currentStock = stockLevels.get(addon.id) || 0;

            return (
              <MemoizedAddonSelector
                key={addon.id}
                addon={addon}
                isSelected={!!selection}
                quantity={selection?.quantity || 0}
                currentStock={currentStock}
                onSelectionChange={handleAddonSelection}
                onDeselect={handleAddonDeselect}
                showDescription={true}
                showPrice={true}
                size='md'
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// Memoized version for performance
export const MemoizedAddonGroupSelector = React.memo(
  AddonGroupSelector,
  (prevProps, nextProps) => {
    // ✅ FIX: Deep compare selections to detect quantity changes
    const selectionsEqual = 
      prevProps.selections.length === nextProps.selections.length &&
      prevProps.selections.every((prevSel, idx) => {
        const nextSel = nextProps.selections[idx];
        return (
          prevSel.addonId === nextSel?.addonId &&
          prevSel.quantity === nextSel?.quantity &&
          prevSel.totalPrice === nextSel?.totalPrice
        );
      });

    return (
      prevProps.group.id === nextProps.group.id &&
      prevProps.group.updatedAt === nextProps.group.updatedAt &&
      selectionsEqual &&
      prevProps.addons.length === nextProps.addons.length &&
      prevProps.stockLevels.size === nextProps.stockLevels.size
    );
  }
);

export default AddonGroupSelector;
