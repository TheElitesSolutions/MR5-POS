'use client';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, Minus } from 'lucide-react';
/**
 * PriceImpactIndicator - Shows real-time pricing impact of add-on selections
 *
 * Features:
 * - Real-time price updates
 * - Visual indicators for price impact
 * - Breakdown view option
 * - Responsive design
 * - Accessibility compliant
 */
export const PriceImpactIndicator = ({ basePrice, addonTotal, finalPrice, showBreakdown = false, size = 'md', variant = 'default', className, }) => {
    // Calculate impact
    const impact = addonTotal;
    const hasImpact = impact > 0;
    // Size configurations
    const sizeConfig = {
        sm: {
            container: 'px-2 py-1 text-xs',
            icon: 'h-3 w-3',
            spacing: 'space-y-1',
        },
        md: {
            container: 'px-3 py-2 text-sm',
            icon: 'h-4 w-4',
            spacing: 'space-y-2',
        },
        lg: {
            container: 'px-4 py-3 text-base',
            icon: 'h-5 w-5',
            spacing: 'space-y-3',
        },
    };
    const config = sizeConfig[size];
    // Render compact variant
    if (variant === 'compact') {
        return (<Badge variant={hasImpact ? 'default' : 'secondary'} className={cn('font-semibold transition-all duration-200', hasImpact &&
                'border-green-200 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100', className)}>
        {hasImpact ? (<div className='flex items-center gap-1'>
            <TrendingUp className={config.icon}/>
            +${impact.toFixed(2)}
          </div>) : (<div className='flex items-center gap-1'>
            <Minus className={config.icon}/>
            No add-ons
          </div>)}
      </Badge>);
    }
    // Render default or detailed variant
    return (<div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-200', config.container, className)} role='region' aria-label='Price impact summary'>
      <div className={cn('flex items-center justify-between', config.spacing)}>
        {/* Main price display */}
        <div className='flex items-center gap-2'>
          <div className='flex items-center gap-1'>
            {hasImpact ? (<TrendingUp className={cn(config.icon, 'text-green-600')}/>) : (<Minus className={cn(config.icon, 'text-gray-400')}/>)}
            <span className='font-semibold text-foreground'>
              Total: ${finalPrice.toFixed(2)}
            </span>
          </div>

          {hasImpact && (<Badge variant='outline' className='border-green-200 bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-100'>
              +${impact.toFixed(2)}
            </Badge>)}
        </div>

        {/* Show breakdown option */}
        {showBreakdown && variant === 'detailed' && (<div className={cn('text-xs text-muted-foreground', config.spacing)}>
            <div className='flex justify-between'>
              <span>Base price:</span>
              <span>${basePrice.toFixed(2)}</span>
            </div>
            {hasImpact && (<div className='flex justify-between text-green-600'>
                <span>Add-ons:</span>
                <span>+${impact.toFixed(2)}</span>
              </div>)}
            <div className='mt-1 flex justify-between border-t pt-1 font-semibold'>
              <span>Total:</span>
              <span>${finalPrice.toFixed(2)}</span>
            </div>
          </div>)}
      </div>

      {/* Accessibility description */}
      <div className='sr-only'>
        {hasImpact
            ? `Total price ${finalPrice.toFixed(2)} dollars, including ${impact.toFixed(2)} dollars in add-ons`
            : `Base price ${basePrice.toFixed(2)} dollars, no add-ons selected`}
      </div>
    </div>);
};
// Memoized version for performance
export const MemoizedPriceImpactIndicator = React.memo(PriceImpactIndicator);
export default PriceImpactIndicator;
