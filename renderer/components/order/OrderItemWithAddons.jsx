'use client';
import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Plus, Minus, Trash2, Edit3, ChevronDown, ChevronUp, Tag, } from 'lucide-react';
import { formatOrderItemWithAddons, getAddonAccessibilityText, formatPrice, getMobileAddonSummary, getHighlightAddon, sortAddonsForDisplay, } from '@/utils/addonFormatting';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger, } from '@/components/ui/collapsible';
/**
 * OrderItemWithAddons - Enhanced order item display with beautiful add-on visualization
 *
 * Features:
 * - Beautiful add-on display with grouping
 * - Collapsible add-on details
 * - Mobile-responsive design
 * - Accessibility compliant
 * - Price breakdowns
 * - Touch-optimized controls
 * - Compact mode for small spaces
 */
export const OrderItemWithAddons = ({ orderItem, onQuantityChange, onRemoveItem, onEditAddons, showActions = true, showAddonsExpanded = false, compact = false, className, disabled = false, }) => {
    const [addonsExpanded, setAddonsExpanded] = useState(showAddonsExpanded);
    // Format the order item with addon information
    const formattedItem = useMemo(() => formatOrderItemWithAddons(orderItem), [orderItem]);
    // Calculate pricing
    const basePrice = (orderItem.unitPrice || orderItem.price || 0) * orderItem.quantity;
    const addonTotal = formattedItem.addonSummary.totalAddonPrice * orderItem.quantity;
    const totalPrice = basePrice + addonTotal;
    // Get display name (handle both naming conventions)
    const itemName = orderItem.name || orderItem.menuItemName || 'Unknown Item';
    // Highlight addon for emphasis
    const highlightAddon = getHighlightAddon(orderItem.addons || []);
    // Sort addons for optimal display
    const sortedAddons = useMemo(() => sortAddonsForDisplay(orderItem.addons || []), [orderItem.addons]);
    // Accessibility text
    const accessibilityText = getAddonAccessibilityText(orderItem.addons || []);
    // Handle quantity changes
    const handleQuantityChange = (delta) => {
        if (!onQuantityChange || disabled)
            return;
        const newQuantity = Math.max(0, orderItem.quantity + delta);
        onQuantityChange(orderItem.id, newQuantity);
    };
    // Compact mode rendering
    if (compact) {
        return (<div className={cn('flex items-center justify-between rounded-lg border bg-background p-3', disabled && 'opacity-60', className)}>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='truncate text-sm font-medium'>{itemName}</span>
            {orderItem.quantity > 1 && (<Badge variant='outline' className='text-xs'>
                x{orderItem.quantity}
              </Badge>)}
          </div>
          {formattedItem.addonSummary.hasAddons && (<p className='truncate text-xs text-muted-foreground'>
              {getMobileAddonSummary(orderItem.addons || [])}
            </p>)}
        </div>

        <div className='flex items-center gap-2'>
          <span className='text-sm font-semibold'>
            {formatPrice(totalPrice)}
          </span>
          {showActions && (<Button variant='ghost' size='sm' onClick={() => onRemoveItem?.(orderItem.id)} disabled={disabled} className='h-8 w-8 p-0 text-destructive'>
              <Trash2 className='h-3 w-3'/>
            </Button>)}
        </div>
      </div>);
    }
    return (<Card className={cn('w-full', className)}>
      <CardContent className='p-4'>
        {/* Main item display */}
        <div className='flex items-start justify-between gap-4'>
          {/* Item info */}
          <div className='min-w-0 flex-1'>
            <div className='mb-1 flex items-center gap-2'>
              <h3 className='truncate text-base font-semibold'>{itemName}</h3>
              {orderItem.status && (<Badge variant={orderItem.status === 'READY'
                ? 'default'
                : orderItem.status === 'PREPARING'
                    ? 'secondary'
                    : orderItem.status === 'CANCELLED'
                        ? 'destructive'
                        : 'outline'} className='text-xs'>
                  {orderItem.status}
                </Badge>)}
            </div>

            {/* Special instructions */}
            {(orderItem.notes || orderItem.specialInstructions) && (<p className='mb-2 text-sm text-muted-foreground'>
                {orderItem.notes || orderItem.specialInstructions}
              </p>)}

            {/* Price breakdown */}
            <div className='space-y-1'>
              <div className='flex items-center justify-between text-sm'>
                <span>Base price (x{orderItem.quantity})</span>
                <span>{formatPrice(basePrice)}</span>
              </div>

              {formattedItem.addonSummary.hasAddons && (<div className='flex items-center justify-between text-sm text-muted-foreground'>
                  <span>Add-ons (x{orderItem.quantity})</span>
                  <span>+{formatPrice(addonTotal)}</span>
                </div>)}

              <Separator />

              <div className='flex items-center justify-between font-semibold'>
                <span>Total</span>
                <span className='text-lg'>{formatPrice(totalPrice)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {showActions && (<div className='flex flex-col items-end gap-2'>
              {/* Quantity controls */}
              <div className='flex items-center gap-1 rounded-md bg-muted'>
                <Button variant='ghost' size='sm' onClick={() => handleQuantityChange(-1)} disabled={disabled || orderItem.quantity <= 1} className='h-8 w-8 p-0 hover:bg-muted-foreground/10'>
                  <Minus className='h-3 w-3'/>
                </Button>

                <span className='min-w-8 text-center text-sm font-medium'>
                  {orderItem.quantity}
                </span>

                <Button variant='ghost' size='sm' onClick={() => handleQuantityChange(1)} disabled={disabled} className='h-8 w-8 p-0 hover:bg-muted-foreground/10'>
                  <Plus className='h-3 w-3'/>
                </Button>
              </div>

              {/* Edit and Remove buttons */}
              <div className='flex items-center gap-1'>
                {onEditAddons && (<Button variant='outline' size='sm' onClick={() => onEditAddons(orderItem.id)} disabled={disabled} className='h-8 px-2'>
                    <Edit3 className='h-3 w-3'/>
                  </Button>)}

                <Button variant='outline' size='sm' onClick={() => onRemoveItem?.(orderItem.id)} disabled={disabled} className='h-8 border-destructive/20 px-2 text-destructive'>
                  <Trash2 className='h-3 w-3'/>
                </Button>
              </div>
            </div>)}
        </div>

        {/* Add-ons section */}
        {formattedItem.addonSummary.hasAddons && (<div className='mt-4'>
            <Collapsible open={addonsExpanded} onOpenChange={setAddonsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant='ghost' className='h-auto w-full justify-between p-2 hover:bg-muted/50'>
                  <div className='flex items-center gap-2'>
                    <Tag className='h-4 w-4 text-primary'/>
                    <span className='text-sm font-medium'>
                      Add-ons ({formattedItem.addonSummary.totalAddonCount})
                    </span>
                    {highlightAddon && (<Badge variant='outline' className='text-xs'>
                        {highlightAddon.addonName}
                      </Badge>)}
                  </div>
                  {addonsExpanded ? (<ChevronUp className='h-4 w-4'/>) : (<ChevronDown className='h-4 w-4'/>)}
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className='mt-3 space-y-2 border-l-2 border-primary/20 pl-6'>
                  {formattedItem.formattedAddons.map((group, groupIndex) => (<div key={groupIndex} className='space-y-1'>
                      {formattedItem.formattedAddons.length > 1 && (<h4 className='text-sm font-medium text-muted-foreground'>
                          {group.groupName}
                        </h4>)}

                      {group.addons.map((addon, addonIndex) => (<div key={addonIndex} className='flex items-center justify-between rounded bg-muted/30 px-2 py-1'>
                          <div className='flex items-center gap-2'>
                            <span className='text-sm'>{addon.addonName}</span>
                            {addon.quantity > 1 && (<Badge variant='outline' className='text-xs'>
                                x{addon.quantity}
                              </Badge>)}
                          </div>
                          <span className='text-sm font-medium'>
                            {formatPrice(addon.totalPrice)}
                          </span>
                        </div>))}
                    </div>))}

                  {/* Group total if multiple groups */}
                  {formattedItem.formattedAddons.length > 1 && (<div className='mt-2 border-t border-muted pt-2'>
                      <div className='flex items-center justify-between text-sm font-medium'>
                        <span>Add-ons subtotal</span>
                        <span>
                          {formatPrice(formattedItem.addonSummary.totalAddonPrice)}
                        </span>
                      </div>
                    </div>)}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>)}

        {/* Accessibility information */}
        <div className='sr-only'>
          Order item: {itemName}, quantity {orderItem.quantity}, base price{' '}
          {formatPrice(basePrice)},
          {formattedItem.addonSummary.hasAddons
            ? accessibilityText
            : 'no add-ons'}
          , total price {formatPrice(totalPrice)}.
        </div>
      </CardContent>
    </Card>);
};
// Memoized version for performance
export const MemoizedOrderItemWithAddons = React.memo(OrderItemWithAddons, (prevProps, nextProps) => {
    return (prevProps.orderItem.id === nextProps.orderItem.id &&
        prevProps.orderItem.quantity === nextProps.orderItem.quantity &&
        prevProps.orderItem.addons?.length ===
            nextProps.orderItem.addons?.length &&
        prevProps.showAddonsExpanded === nextProps.showAddonsExpanded &&
        prevProps.disabled === nextProps.disabled);
});
export default OrderItemWithAddons;
