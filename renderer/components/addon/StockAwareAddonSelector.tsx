'use client';

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Plus, Minus, Info, AlertTriangle, Ban, Lightbulb } from 'lucide-react';
import { Addon, AddonSelection } from '@/types/addon';
import { MemoizedEnhancedStockIndicator } from './EnhancedStockIndicator';
import { MemoizedAlternativeSuggestions } from './AlternativeSuggestions';
import { PriceImpactIndicator } from './PriceImpactIndicator';
import { useAddonStockStatus } from '@/hooks/useAddonStock';
import { useSwipeToSelect, useSwipeQuantity } from '@/hooks/useTouchGestures';
import { formatPrice } from '@/utils/addonFormatting';

interface StockAwareAddonSelectorProps {
  addon: Addon;
  isSelected: boolean;
  quantity: number;
  maxQuantity?: number;
  onSelectionChange: (addon: Addon, quantity: number) => void;
  onDeselect: (addonId: string) => void;
  onAlternativeSelect?: (
    originalAddon: Addon,
    alternativeAddon: Addon,
    quantity: number
  ) => void;
  disabled?: boolean;
  showDescription?: boolean;
  showPrice?: boolean;
  showAlternatives?: boolean;
  enableStockChecking?: boolean;
  enableSwipeGestures?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * StockAwareAddonSelector - Advanced add-on selector with comprehensive stock integration
 *
 * Features:
 * - Real-time stock checking and validation
 * - Automatic out-of-stock prevention
 * - Low stock warnings with visual indicators
 * - Alternative suggestions for unavailable items
 * - Touch gestures (swipe-to-select, swipe quantity adjustment)
 * - Accessibility compliant with ARIA labels
 * - Stock-aware quantity controls
 * - Performance optimized with React.memo
 */
export const StockAwareAddonSelector: React.FC<
  StockAwareAddonSelectorProps
> = ({
  addon,
  isSelected,
  quantity,
  maxQuantity: propMaxQuantity = 10,
  onSelectionChange,
  onDeselect,
  onAlternativeSelect,
  disabled = false,
  showDescription = true,
  showPrice = true,
  showAlternatives = true,
  enableStockChecking = true,
  enableSwipeGestures = true,
  size = 'md',
  className,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showStockDetails, setShowStockDetails] = useState(false);

  // Stock status integration
  const {
    status: stockStatus,
    isLoading: stockLoading,
    canSelect,
    maxQuantity: stockMaxQuantity,
    isAvailable,
    level: stockLevel,
    warningMessage,
  } = useAddonStockStatus(enableStockChecking ? addon : null);

  // Calculate effective max quantity (consider stock limits)
  const effectiveMaxQuantity = useMemo(() => {
    if (!enableStockChecking || !stockStatus) {
      return propMaxQuantity;
    }
    return Math.min(propMaxQuantity, stockMaxQuantity);
  }, [enableStockChecking, stockStatus, propMaxQuantity, stockMaxQuantity]);

  // Stock-aware selection validation
  const canSelectQuantity = useCallback(
    (requestedQuantity: number) => {
      if (!enableStockChecking) return true;
      if (!stockStatus) return false;
      return canSelect(requestedQuantity);
    },
    [enableStockChecking, stockStatus, canSelect]
  );

  // Determine if addon can be selected at all
  const canBeSelected = useMemo(() => {
    if (disabled) return false;
    if (!enableStockChecking) return true;
    return isAvailable && canSelectQuantity(1);
  }, [disabled, enableStockChecking, isAvailable, canSelectQuantity]);

  // Determine if quantity can be increased
  const canIncreaseQuantity = useMemo(() => {
    if (!isSelected || !canBeSelected) return false;
    const newQuantity = quantity + 1;
    return (
      newQuantity <= effectiveMaxQuantity && canSelectQuantity(newQuantity)
    );
  }, [
    isSelected,
    canBeSelected,
    quantity,
    effectiveMaxQuantity,
    canSelectQuantity,
  ]);

  // Determine if quantity can be decreased
  const canDecreaseQuantity = useMemo(() => {
    return isSelected && quantity > 1;
  }, [isSelected, quantity]);

  // Touch gestures integration
  useSwipeToSelect(
    cardRef,
    () => {
      if (canBeSelected && !isSelected) {
        onSelectionChange(addon, 1);
      }
    },
    () => {
      if (isSelected) {
        onDeselect(addon.id);
      }
    },
    isSelected
  );

  useSwipeQuantity(
    cardRef,
    () => {
      if (canIncreaseQuantity) {
        onSelectionChange(addon, quantity + 1);
      }
    },
    () => {
      if (canDecreaseQuantity) {
        onSelectionChange(addon, quantity - 1);
      }
    }
  );

  // Handle selection toggle
  const handleSelectionToggle = useCallback(
    (checked: boolean) => {
      if (checked && canBeSelected) {
        onSelectionChange(addon, 1);
      } else if (!checked && isSelected) {
        onDeselect(addon.id);
      }
    },
    [addon, canBeSelected, isSelected, onSelectionChange, onDeselect]
  );

  // Handle quantity changes
  const handleQuantityChange = useCallback(
    (delta: number) => {
      const newQuantity = quantity + delta;
      if (newQuantity <= 0) {
        onDeselect(addon.id);
      } else if (
        newQuantity <= effectiveMaxQuantity &&
        canSelectQuantity(newQuantity)
      ) {
        onSelectionChange(addon, newQuantity);
      }
    },
    [
      quantity,
      effectiveMaxQuantity,
      canSelectQuantity,
      addon,
      onSelectionChange,
      onDeselect,
    ]
  );

  // Handle alternative selection
  const handleAlternativeSelect = useCallback(
    (alternativeAddon: Addon, alternativeQuantity: number) => {
      onAlternativeSelect?.(addon, alternativeAddon, alternativeQuantity);
    },
    [addon, onAlternativeSelect]
  );

  // Size configurations - Touch-optimized with 44px minimum touch targets
  const sizeConfig = {
    sm: {
      card: 'p-3',
      text: 'text-sm',
      badge: 'text-xs px-2 py-0.5',
      button: 'min-h-[44px] min-w-[44px]', // Touch-optimized
      gap: 'gap-2',
    },
    md: {
      card: 'p-4',
      text: 'text-sm',
      badge: 'text-xs px-2 py-1',
      button: 'min-h-[44px] min-w-[44px]', // Touch-optimized
      gap: 'gap-3',
    },
    lg: {
      card: 'p-5',
      text: 'text-base',
      badge: 'text-sm px-3 py-1',
      button: 'min-h-[48px] min-w-[48px]', // Larger for lg size
      gap: 'gap-4',
    },
  };

  const config = sizeConfig[size];

  // Calculate total price for this addon
  const totalPrice = addon.price * quantity;

  return (
    <Card
      ref={cardRef}
      className={cn(
        'border-2 transition-all duration-200',
        isSelected
          ? 'border-primary bg-primary/5 shadow-md'
          : 'border-border hover:border-primary/50 hover:shadow-sm',
        !canBeSelected && 'cursor-not-allowed opacity-60',
        enableSwipeGestures && 'touch-manipulation',
        className
      )}
    >
      <CardContent className={cn(config.card, 'space-y-3')}>
        {/* Header with selection and stock status */}
        <div className='flex items-start justify-between'>
          <div className='flex flex-1 items-start gap-3'>
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleSelectionToggle}
              disabled={!canBeSelected}
              className='mt-1 min-h-[44px] min-w-[44px] touch-manipulation' // Touch optimized
              aria-describedby={`addon-${addon.id}-description`}
            />

            <div className='flex-1 space-y-1'>
              <div className='flex items-center gap-2'>
                <h4 className={cn('font-medium leading-tight', config.text)}>
                  {addon.name}
                </h4>

                {/* Stock warning indicator */}
                {stockLevel === 'low' || stockLevel === 'critical' ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className='h-4 w-4 text-orange-500' />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{warningMessage}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}

                {/* Out of stock indicator */}
                {stockLevel === 'out_of_stock' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Ban className='h-4 w-4 text-red-500' />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Out of stock</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {/* Description */}
              {showDescription && addon.description && (
                <p className='line-clamp-2 text-xs text-muted-foreground'>
                  {addon.description}
                </p>
              )}

              {/* Price display */}
              {showPrice && (
                <div className='flex items-center gap-2'>
                  <Badge variant='outline' className={config.badge}>
                    {formatPrice(addon.price)} each
                  </Badge>
                  {isSelected && quantity > 1 && (
                    <Badge variant='secondary' className={config.badge}>
                      Total: {formatPrice(totalPrice)}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stock indicator */}
          {enableStockChecking && (
            <MemoizedEnhancedStockIndicator
              addon={addon}
              required={quantity}
              variant='compact'
              size='sm'
              showRefresh={false}
            />
          )}
        </div>

        {/* Stock warning alert */}
        {enableStockChecking && stockLevel === 'critical' && isSelected && (
          <Alert variant='destructive' className='py-2'>
            <AlertTriangle className='h-4 w-4' />
            <AlertDescription className='text-xs'>
              {warningMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Out of stock alert with alternatives */}
        {enableStockChecking && stockLevel === 'out_of_stock' && (
          <Alert className='py-2'>
            <Ban className='h-4 w-4' />
            <AlertDescription className='text-xs'>
              <div className='flex items-center justify-between'>
                <span>This item is currently out of stock</span>
                {showAlternatives && (
                  <MemoizedAlternativeSuggestions
                    originalAddon={addon}
                    requestedQuantity={quantity || 1}
                    onAlternativeSelect={handleAlternativeSelect}
                    trigger={
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-6 p-1 text-xs'
                      >
                        <Lightbulb className='mr-1 h-3 w-3' />
                        Alternatives
                      </Button>
                    }
                    maxSuggestions={3}
                  />
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Quantity controls (only shown when selected) */}
        {isSelected && canBeSelected && (
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handleQuantityChange(-1)}
                disabled={!canDecreaseQuantity}
                className={cn('min-h-[44px] min-w-[44px]', config.button)} // Touch optimized
                aria-label='Decrease quantity'
              >
                <Minus className='h-4 w-4' />
              </Button>

              <Badge
                variant='secondary'
                className='px-4 py-2 text-sm font-medium'
              >
                {quantity}
              </Badge>

              <Button
                variant='outline'
                size='sm'
                onClick={() => handleQuantityChange(1)}
                disabled={!canIncreaseQuantity}
                className={cn('min-h-[44px] min-w-[44px]', config.button)} // Touch optimized
                aria-label='Increase quantity'
              >
                <Plus className='h-4 w-4' />
              </Button>
            </div>

            {/* Price impact */}
            {showPrice && (
              <PriceImpactIndicator
                basePrice={0}
                addonTotal={totalPrice}
                finalPrice={totalPrice}
                variant='compact'
                size='sm'
              />
            )}
          </div>
        )}

        {/* Accessibility information */}
        <div id={`addon-${addon.id}-description`} className='sr-only'>
          {addon.name}, {formatPrice(addon.price)} each.
          {addon.description && ` Description: ${addon.description}.`}
          {enableStockChecking &&
            stockStatus &&
            ` Stock: ${stockStatus.currentStock} available.`}
          {!canBeSelected && ` Currently unavailable.`}
          {isSelected && ` Selected quantity: ${quantity}.`}
        </div>
      </CardContent>
    </Card>
  );
};

// Memoized version for performance
export const MemoizedStockAwareAddonSelector = React.memo(
  StockAwareAddonSelector,
  (prevProps, nextProps) => {
    return (
      prevProps.addon.id === nextProps.addon.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.quantity === nextProps.quantity &&
      prevProps.maxQuantity === nextProps.maxQuantity &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.addon.inventory?.currentStock ===
        nextProps.addon.inventory?.currentStock
    );
  }
);

export default StockAwareAddonSelector;
