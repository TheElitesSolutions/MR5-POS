'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, Minus, Info } from 'lucide-react';
import { Addon, AddonSelection, AddonConstraints } from '@/types/addon';
import { StockIndicator, useStockStatus } from './StockIndicator';
import { PriceImpactIndicator } from './PriceImpactIndicator';

interface AddonSelectorProps {
  addon: Addon;
  isSelected: boolean;
  quantity: number;
  maxQuantity?: number;
  currentStock: number;
  onSelectionChange: (addon: Addon, quantity: number) => void;
  onDeselect: (addonId: string) => void;
  disabled?: boolean;
  showDescription?: boolean;
  showPrice?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * AddonSelector - Individual add-on selection with quantity controls
 *
 * Features:
 * - Checkbox selection with quantity stepper
 * - Real-time stock validation
 * - Price display with quantity calculation
 * - Touch-optimized controls (44px minimum)
 * - Accessibility compliant
 * - Responsive design
 */
export const AddonSelector: React.FC<AddonSelectorProps> = ({
  addon,
  isSelected,
  quantity,
  maxQuantity = 10,
  currentStock,
  onSelectionChange,
  onDeselect,
  disabled = false,
  showDescription = true,
  showPrice = true,
  size = 'md',
  className,
}) => {
  // Stock status calculations
  const {
    status: stockStatus,
    isAvailable,
    isSufficient,
  } = useStockStatus(
    currentStock,
    quantity,
    addon.inventory?.minimumStock || 5
  );

  // Determine if addon is selectable
  const canSelect = isAvailable && !disabled;
  const canIncreaseQuantity =
    isSelected && quantity < Math.min(maxQuantity, currentStock);
  const canDecreaseQuantity = isSelected && quantity > 0;

  // Size configurations
  const sizeConfig = {
    sm: {
      card: 'p-3',
      button: 'h-6 w-6 text-xs',
      text: 'text-xs',
      title: 'text-sm font-medium',
      spacing: 'gap-2',
    },
    md: {
      card: 'p-4',
      button: 'h-8 w-8 text-sm',
      text: 'text-sm',
      title: 'text-base font-medium',
      spacing: 'gap-3',
    },
    lg: {
      card: 'p-5',
      button: 'h-10 w-10 text-base',
      text: 'text-base',
      title: 'text-lg font-medium',
      spacing: 'gap-4',
    },
  };

  const config = sizeConfig[size];

  // Handle selection toggle
  const handleSelectionToggle = useCallback(
    (checked: boolean) => {
      if (checked && canSelect) {
        onSelectionChange(addon, 1);
      } else if (!checked) {
        onDeselect(addon.id);
      }
    },
    [addon, canSelect, onSelectionChange, onDeselect]
  );

  // Handle quantity changes
  const handleQuantityChange = useCallback(
    (newQuantity: number) => {
      if (
        newQuantity > 0 &&
        newQuantity <= currentStock &&
        newQuantity <= maxQuantity
      ) {
        onSelectionChange(addon, newQuantity);
      } else if (newQuantity === 0) {
        onDeselect(addon.id);
      }
    },
    [addon, currentStock, maxQuantity, onSelectionChange, onDeselect]
  );

  // Calculate price display
  const unitPriceDisplay = addon.price.toFixed(2);
  const totalPriceDisplay = (addon.price * quantity).toFixed(2);

  return (
    <Card
      className={cn(
        'transition-all duration-200 hover:shadow-md',
        isSelected && 'ring-2 ring-primary ring-offset-2',
        !canSelect && 'opacity-60',
        className
      )}
    >
      <CardContent className={config.card}>
        <div className={cn('flex items-start justify-between', config.spacing)}>
          {/* Left section - Selection and info */}
          <div className={cn('flex items-start', config.spacing)}>
            {/* Checkbox */}
            <div className='flex items-center pt-1'>
              <Checkbox
                id={`addon-${addon.id}`}
                checked={isSelected}
                onCheckedChange={handleSelectionToggle}
                disabled={!canSelect}
                className='touch-manipulation'
                aria-describedby={`addon-${addon.id}-description`}
              />
            </div>

            {/* Addon info */}
            <div className='flex-1 space-y-1'>
              <label
                htmlFor={`addon-${addon.id}`}
                className={cn(
                  'cursor-pointer transition-colors',
                  config.title,
                  !canSelect && 'text-muted-foreground'
                )}
              >
                {addon.name}
              </label>

              {/* Description */}
              {showDescription && addon.description && (
                <p
                  id={`addon-${addon.id}-description`}
                  className={cn('text-muted-foreground', config.text)}
                >
                  {addon.description}
                </p>
              )}

              {/* Stock indicator */}
              <div className='flex items-center gap-2'>
                <StockIndicator
                  addonId={addon.id}
                  required={quantity}
                  currentStock={currentStock}
                  minimumStock={addon.inventory?.minimumStock || 5}
                  showQuantity={stockStatus !== 'available'}
                  size='sm'
                />

                {/* Price display */}
                {showPrice && (
                  <Badge variant='outline' className={config.text}>
                    ${unitPriceDisplay}
                    {isSelected && quantity > 1 && (
                      <span className='ml-1 text-muted-foreground'>
                        × {quantity}
                      </span>
                    )}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right section - Quantity controls and price */}
          {isSelected && (
            <div className='flex items-center gap-2'>
              {/* Quantity stepper */}
              <div className='flex items-center gap-1'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={!canDecreaseQuantity}
                  className={cn(
                    'touch-manipulation',
                    config.button,
                    'min-h-[44px] min-w-[44px] rounded-full'
                  )}
                  aria-label='Decrease quantity'
                >
                  <Minus className='h-3 w-3' />
                </Button>

                <span
                  className={cn('min-w-8 text-center font-medium', config.text)}
                >
                  {quantity}
                </span>

                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={!canIncreaseQuantity}
                  className={cn(
                    'touch-manipulation',
                    config.button,
                    'min-h-[44px] min-w-[44px] rounded-full'
                  )}
                  aria-label='Increase quantity'
                >
                  <Plus className='h-3 w-3' />
                </Button>
              </div>

              {/* Total price */}
              {quantity > 1 && showPrice && (
                <Badge
                  variant='default'
                  className='border-green-200 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                >
                  ${totalPriceDisplay}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Accessibility information */}
        <div className='sr-only'>
          {`${addon.name}, ${addon.price.toFixed(2)} dollars${
            addon.description ? `, ${addon.description}` : ''
          }. ${isAvailable ? 'Available' : 'Out of stock'}.${
            isSelected ? ` Selected quantity: ${quantity}` : ''
          }`}
        </div>
      </CardContent>
    </Card>
  );
};

// Memoized version for performance
export const MemoizedAddonSelector = React.memo(
  AddonSelector,
  (prevProps, nextProps) => {
    return (
      prevProps.addon.id === nextProps.addon.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.quantity === nextProps.quantity &&
      prevProps.currentStock === nextProps.currentStock &&
      prevProps.disabled === nextProps.disabled
    );
  }
);

export default AddonSelector;
