'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  Tag,
  Package,
  Calculator,
  Receipt,
  TrendingUp,
  Star,
  Percent,
} from 'lucide-react';
import { OrderItem } from '@/types';
import { PriceImpactIndicator } from '@/components/addon/PriceImpactIndicator';
import {
  calculateOrderSummary,
  formatPrice,
  getMobileAddonSummary,
  formatAddonSelection,
} from '@/utils/addonFormatting';

interface OrderSummaryWithAddonsProps {
  orderItems: OrderItem[];
  showTax?: boolean;
  taxRate?: number;
  showDiscount?: boolean;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  showService?: boolean;
  serviceCharge?: number;
  showDetails?: boolean;
  compactMode?: boolean;
  className?: string;
  onProceedToPayment?: () => void;
  onEditOrder?: () => void;
  paymentButtonText?: string;
  allowEditing?: boolean;
}

/**
 * OrderSummaryWithAddons - Comprehensive order summary with full add-on breakdown
 *
 * Features:
 * - Detailed add-on price breakdown
 * - Tax calculation with add-on awareness
 * - Discount application (before/after add-ons)
 * - Service charge calculation
 * - Collapsible details view
 * - Mobile-responsive layout
 * - Real-time price updates
 * - Accessibility compliant
 * - Export/print functionality
 */
export const OrderSummaryWithAddons: React.FC<OrderSummaryWithAddonsProps> = ({
  orderItems,
  showTax = false,
  taxRate = 0.1, // 10% default
  showDiscount = false,
  discount = 0,
  discountType = 'percentage',
  showService = false,
  serviceCharge = 0,
  showDetails = true,
  compactMode = false,
  className,
  onProceedToPayment,
  onEditOrder,
  paymentButtonText = 'Proceed to Payment',
  allowEditing = true,
}) => {
  const [showBreakdown, setShowBreakdown] = useState(!compactMode);
  const [showAddonDetails, setShowAddonDetails] = useState(false);

  // Calculate base order summary
  const orderSummary = useMemo(
    () => calculateOrderSummary(orderItems),
    [orderItems]
  );

  // Calculate advanced pricing (tax, service, discount)
  const advancedPricing = useMemo(() => {
    let subtotal = orderSummary.finalTotal; // Base + addons
    let discountAmount = 0;
    let taxAmount = 0;
    let serviceAmount = 0;

    // Calculate discount
    if (showDiscount && discount > 0) {
      if (discountType === 'percentage') {
        discountAmount = (subtotal * discount) / 100;
      } else {
        discountAmount = Math.min(discount, subtotal);
      }
    }

    const afterDiscount = subtotal - discountAmount;

    // Calculate service charge (typically applied before tax)
    if (showService && serviceCharge > 0) {
      serviceAmount = (afterDiscount * serviceCharge) / 100;
    }

    const afterService = afterDiscount + serviceAmount;

    // Calculate tax (typically on the final amount including service)
    if (showTax && taxRate > 0) {
      taxAmount = afterService * taxRate;
    }

    const finalTotal = afterService + taxAmount;

    return {
      subtotal,
      discountAmount,
      afterDiscount,
      serviceAmount,
      afterService,
      taxAmount,
      finalTotal,
    };
  }, [
    orderSummary.finalTotal,
    showDiscount,
    discount,
    discountType,
    showService,
    serviceCharge,
    showTax,
    taxRate,
  ]);

  // Group add-ons for detailed breakdown
  const addonBreakdown = useMemo(() => {
    const addonGroups = new Map<
      string,
      {
        name: string;
        count: number;
        totalPrice: number;
        items: Array<{
          itemName: string;
          addonName: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
        }>;
      }
    >();

    orderItems.forEach(item => {
      if (item.addons && item.addons.length > 0) {
        item.addons.forEach(addon => {
          const key = addon.addonName;
          if (!addonGroups.has(key)) {
            addonGroups.set(key, {
              name: addon.addonName,
              count: 0,
              totalPrice: 0,
              items: [],
            });
          }

          const group = addonGroups.get(key)!;
          const totalQuantity = addon.quantity * item.quantity;
          const totalPrice = addon.totalPrice * item.quantity;

          group.count += totalQuantity;
          group.totalPrice += totalPrice;
          group.items.push({
            itemName: item.name || item.menuItemName || 'Unknown Item',
            addonName: addon.addonName,
            quantity: totalQuantity,
            unitPrice: addon.unitPrice,
            totalPrice,
          });
        });
      }
    });

    return Array.from(addonGroups.values()).sort(
      (a, b) => b.totalPrice - a.totalPrice
    );
  }, [orderItems]);

  if (orderItems.length === 0) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className='flex flex-col items-center justify-center py-8'>
          <Calculator className='mb-4 h-12 w-12 text-muted-foreground' />
          <p className='text-center text-muted-foreground'>
            No items to calculate
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <Receipt className='h-5 w-5' />
            Order Summary
          </CardTitle>
          <div className='flex items-center gap-2'>
            {orderSummary.hasAddons && (
              <Badge variant='secondary' className='text-xs'>
                <Tag className='mr-1 h-3 w-3' />
                {orderSummary.addonCount} add-ons
              </Badge>
            )}
            <Badge variant='outline' className='text-xs'>
              {orderSummary.itemCount} items
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        {/* Main Price Display */}
        <div className='py-4 text-center'>
          <PriceImpactIndicator
            basePrice={orderSummary.subtotal}
            addonTotal={orderSummary.addonTotal}
            finalPrice={orderSummary.finalTotal}
            showBreakdown={true}
            variant='detailed'
            size='lg'
            className='justify-center'
          />
        </div>

        {/* Order Breakdown */}
        {showDetails && (
          <Collapsible open={showBreakdown} onOpenChange={setShowBreakdown}>
            <CollapsibleTrigger asChild>
              <Button
                variant='ghost'
                className='h-auto w-full justify-between p-0'
              >
                <span className='font-medium'>Order Details</span>
                {showBreakdown ? (
                  <ChevronUp className='h-4 w-4' />
                ) : (
                  <ChevronDown className='h-4 w-4' />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className='mt-3 space-y-3'>
              {/* Items Breakdown */}
              <div className='space-y-2'>
                <div className='flex items-center justify-between text-sm'>
                  <div className='flex items-center gap-2'>
                    <Package className='h-4 w-4' />
                    <span>Items ({orderSummary.itemCount})</span>
                  </div>
                  <span className='font-medium'>
                    {formatPrice(orderSummary.subtotal)}
                  </span>
                </div>

                {/* Add-ons Breakdown */}
                {orderSummary.hasAddons && (
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between text-sm'>
                      <div className='flex items-center gap-2'>
                        <Tag className='h-4 w-4 text-green-600' />
                        <span>Add-ons ({orderSummary.addonCount})</span>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => setShowAddonDetails(!showAddonDetails)}
                          className='h-auto p-0 text-xs hover:bg-transparent'
                        >
                          {showAddonDetails ? 'Hide' : 'Details'}
                        </Button>
                      </div>
                      <span className='font-medium text-green-600'>
                        +{formatPrice(orderSummary.addonTotal)}
                      </span>
                    </div>

                    {/* Detailed Add-on Breakdown */}
                    {showAddonDetails && addonBreakdown.length > 0 && (
                      <div className='ml-6 space-y-1 border-l pl-3 text-xs text-muted-foreground'>
                        {addonBreakdown.map((addon, index) => (
                          <div key={index} className='flex justify-between'>
                            <span>
                              {addon.name} (×{addon.count})
                            </span>
                            <span>{formatPrice(addon.totalPrice)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                <div className='flex items-center justify-between font-medium'>
                  <span>Subtotal</span>
                  <span>{formatPrice(orderSummary.finalTotal)}</span>
                </div>
              </div>

              {/* Advanced Pricing */}
              {(showDiscount || showService || showTax) && (
                <div className='space-y-2 border-t pt-3'>
                  {/* Discount */}
                  {showDiscount && discount > 0 && (
                    <div className='flex items-center justify-between text-sm text-green-600'>
                      <div className='flex items-center gap-2'>
                        <Percent className='h-4 w-4' />
                        <span>
                          Discount{' '}
                          {discountType === 'percentage'
                            ? `(${discount}%)`
                            : '(Fixed)'}
                        </span>
                      </div>
                      <span>
                        -{formatPrice(advancedPricing.discountAmount)}
                      </span>
                    </div>
                  )}

                  {/* Service Charge */}
                  {showService && serviceCharge > 0 && (
                    <div className='flex items-center justify-between text-sm'>
                      <div className='flex items-center gap-2'>
                        <Star className='h-4 w-4' />
                        <span>Service ({serviceCharge}%)</span>
                      </div>
                      <span>+{formatPrice(advancedPricing.serviceAmount)}</span>
                    </div>
                  )}

                  {/* Tax */}
                  {showTax && taxRate > 0 && (
                    <div className='flex items-center justify-between text-sm'>
                      <div className='flex items-center gap-2'>
                        <TrendingUp className='h-4 w-4' />
                        <span>Tax ({(taxRate * 100).toFixed(1)}%)</span>
                      </div>
                      <span>+{formatPrice(advancedPricing.taxAmount)}</span>
                    </div>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Final Total */}
        <div className='border-t pt-4'>
          <div className='flex items-center justify-between text-xl font-bold'>
            <span>Total</span>
            <span>
              {formatPrice(
                showTax || showService || showDiscount
                  ? advancedPricing.finalTotal
                  : orderSummary.finalTotal
              )}
            </span>
          </div>

          {/* Savings Indicator */}
          {showDiscount && advancedPricing.discountAmount > 0 && (
            <div className='mt-2 text-center'>
              <Badge
                variant='secondary'
                className='border-green-200 bg-green-50 text-green-600'
              >
                You save {formatPrice(advancedPricing.discountAmount)}!
              </Badge>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className='space-y-2 pt-4'>
          {onProceedToPayment && (
            <Button
              onClick={onProceedToPayment}
              className='w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:from-blue-600 hover:to-purple-700'
              size='lg'
            >
              <Receipt className='mr-2 h-4 w-4' />
              {paymentButtonText}
            </Button>
          )}

          {allowEditing && onEditOrder && (
            <Button
              onClick={onEditOrder}
              variant='outline'
              className='w-full'
              size='lg'
            >
              Edit Order
            </Button>
          )}
        </div>

        {/* Mobile Add-on Summary */}
        {orderSummary.hasAddons && compactMode && (
          <div className='md:hidden'>
            <div className='text-xs text-muted-foreground'>
              {getMobileAddonSummary(
                orderItems.flatMap(item => item.addons || [])
              )}
            </div>
          </div>
        )}

        {/* Accessibility information */}
        <div className='sr-only'>
          Order summary with {orderSummary.itemCount} items
          {orderSummary.hasAddons && ` and ${orderSummary.addonCount} add-ons`}.
          Base subtotal: {formatPrice(orderSummary.subtotal)}.
          {orderSummary.hasAddons &&
            ` Add-ons total: ${formatPrice(orderSummary.addonTotal)}.`}
          {showDiscount &&
            advancedPricing.discountAmount > 0 &&
            ` Discount applied: ${formatPrice(advancedPricing.discountAmount)}.`}
          {showService &&
            advancedPricing.serviceAmount > 0 &&
            ` Service charge: ${formatPrice(advancedPricing.serviceAmount)}.`}
          {showTax &&
            advancedPricing.taxAmount > 0 &&
            ` Tax: ${formatPrice(advancedPricing.taxAmount)}.`}
          Final total:{' '}
          {formatPrice(
            showTax || showService || showDiscount
              ? advancedPricing.finalTotal
              : orderSummary.finalTotal
          )}
          .
        </div>
      </CardContent>
    </Card>
  );
};

// Memoized version for performance
export const MemoizedOrderSummaryWithAddons = React.memo(
  OrderSummaryWithAddons,
  (prevProps, nextProps) => {
    return (
      prevProps.orderItems.length === nextProps.orderItems.length &&
      prevProps.showTax === nextProps.showTax &&
      prevProps.taxRate === nextProps.taxRate &&
      prevProps.showDiscount === nextProps.showDiscount &&
      prevProps.discount === nextProps.discount &&
      prevProps.discountType === nextProps.discountType &&
      prevProps.showService === nextProps.showService &&
      prevProps.serviceCharge === nextProps.serviceCharge &&
      prevProps.compactMode === nextProps.compactMode
    );
  }
);

export default OrderSummaryWithAddons;
