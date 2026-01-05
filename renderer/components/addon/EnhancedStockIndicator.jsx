'use client';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, XCircle, Package, AlertCircle, RefreshCw, ChevronDown, ChevronUp, } from 'lucide-react';
import { useAddonStockStatus } from '@/hooks/useAddonStock';
/**
 * EnhancedStockIndicator - Advanced stock display with alternatives and real-time updates
 *
 * Features:
 * - Real-time stock status from AddonStockService
 * - Alternative suggestions for out-of-stock items
 * - Progressive disclosure with detailed information
 * - Refresh functionality for real-time updates
 * - Multiple display variants (default, detailed, compact, minimal)
 * - Accessibility compliant with ARIA labels and keyboard navigation
 * - Touch-optimized for mobile devices
 */
export const EnhancedStockIndicator = ({ addon, required = 1, showQuantity = false, showIcon = true, showTooltip = true, showAlternatives = false, showRefresh = false, size = 'md', variant = 'default', className, onAlternativeClick, onRefresh, }) => {
    const { status, isLoading, error, refreshStatus, canSelect, maxQuantity, level, warningMessage, } = useAddonStockStatus(addon);
    const [showDetails, setShowDetails] = React.useState(false);
    // Configuration for each stock level
    const levelConfig = {
        available: {
            variant: 'default',
            icon: CheckCircle,
            text: 'Available',
            className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100',
            priority: 'none',
        },
        low: {
            variant: 'outline',
            icon: AlertTriangle,
            text: 'Low Stock',
            className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-100',
            priority: 'warning',
        },
        critical: {
            variant: 'outline',
            icon: AlertCircle,
            text: 'Critical',
            className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-100',
            priority: 'error',
        },
        out_of_stock: {
            variant: 'destructive',
            icon: XCircle,
            text: 'Out of Stock',
            className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-100',
            priority: 'error',
        },
    };
    // Size configurations
    const sizeConfig = {
        sm: {
            badge: 'px-2 py-1 text-xs',
            icon: 'h-3 w-3',
            button: 'h-6 w-6',
            gap: 'gap-1',
        },
        md: {
            badge: 'px-2.5 py-1.5 text-xs',
            icon: 'h-3.5 w-3.5',
            button: 'h-7 w-7',
            gap: 'gap-1.5',
        },
        lg: {
            badge: 'px-3 py-2 text-sm',
            icon: 'h-4 w-4',
            button: 'h-8 w-8',
            gap: 'gap-2',
        },
    };
    const config = levelConfig[level];
    const sizes = sizeConfig[size];
    const IconComponent = isLoading ? RefreshCw : config.icon;
    // Build display text based on variant
    const getDisplayText = () => {
        if (variant === 'minimal') {
            return showQuantity ? `${status?.currentStock || 0}` : '';
        }
        if (variant === 'compact') {
            if (level === 'out_of_stock')
                return 'N/A';
            if (showQuantity)
                return `${status?.currentStock || 0}`;
            return config.text;
        }
        let text = config.text;
        if (showQuantity && status) {
            if (level === 'out_of_stock') {
                text = 'Out of Stock';
            }
            else if (level === 'critical') {
                text = `${config.text} (${status.currentStock})`;
            }
            else if (level === 'low') {
                text = `${config.text} (${status.currentStock})`;
            }
            else {
                text = `Available (${status.currentStock})`;
            }
        }
        return text;
    };
    // Build ARIA label
    const getAriaLabel = () => {
        if (!status)
            return 'Stock information not available';
        const stockInfo = `${status.currentStock} items available`;
        const requiredInfo = required > 1 ? `, ${required} required` : '';
        const statusInfo = level === 'out_of_stock'
            ? ', out of stock'
            : level === 'critical'
                ? ', critically low stock'
                : level === 'low'
                    ? ', low stock warning'
                    : ', sufficient stock';
        return `${stockInfo}${requiredInfo}${statusInfo}`;
    };
    // Handle refresh
    const handleRefresh = () => {
        refreshStatus();
        onRefresh?.();
    };
    // Render loading state
    if (isLoading && !status) {
        return (<Badge variant='outline' className={cn('flex items-center', sizes.badge, sizes.gap, className)} role='status' aria-label='Loading stock information'>
        <RefreshCw className={cn(sizes.icon, 'animate-spin')} aria-hidden='true'/>
        <span>Loading...</span>
      </Badge>);
    }
    // Render error state
    if (error) {
        return (<Badge variant='destructive' className={cn('flex items-center', sizes.badge, sizes.gap, className)} role='status' aria-label='Error loading stock information'>
        <AlertCircle className={sizes.icon} aria-hidden='true'/>
        <span>Error</span>
        {showRefresh && (<Button variant='ghost' size='sm' onClick={handleRefresh} className={cn(sizes.button, 'ml-1 p-0')} aria-label='Refresh stock information'>
            <RefreshCw className='h-2.5 w-2.5'/>
          </Button>)}
      </Badge>);
    }
    // For addons without inventory tracking, show always available
    if (!addon.inventory) {
        if (variant === 'minimal')
            return null;
        return (<Badge variant='secondary' className={cn('flex items-center', sizes.badge, sizes.gap, className)} role='status' aria-label='Always available - no stock tracking'>
        {showIcon && <Package className={sizes.icon} aria-hidden='true'/>}
        <span>Available</span>
      </Badge>);
    }
    // Main indicator content
    const indicatorContent = (<Badge variant={config.variant} className={cn('flex cursor-default items-center font-medium transition-all duration-200', config.className, sizes.badge, sizes.gap, variant === 'detailed' && 'cursor-pointer hover:opacity-80', className)} role='status' aria-label={getAriaLabel()} onClick={variant === 'detailed' ? () => setShowDetails(!showDetails) : undefined}>
      {showIcon && (<IconComponent className={cn(sizes.icon, isLoading && 'animate-spin')} aria-hidden='true'/>)}
      <span>{getDisplayText()}</span>

      {/* Refresh button */}
      {showRefresh && !isLoading && (<Button variant='ghost' size='sm' onClick={handleRefresh} className={cn(sizes.button, 'ml-1 p-0 hover:bg-transparent')} aria-label='Refresh stock information'>
          <RefreshCw className='h-2.5 w-2.5'/>
        </Button>)}

      {/* Expandable indicator for detailed variant */}
      {variant === 'detailed' &&
            (showDetails ? (<ChevronUp className='ml-1 h-3 w-3' aria-hidden='true'/>) : (<ChevronDown className='ml-1 h-3 w-3' aria-hidden='true'/>))}
    </Badge>);
    // Wrap with tooltip if enabled
    const withTooltip = showTooltip && warningMessage ? (<TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{indicatorContent}</TooltipTrigger>
          <TooltipContent>
            <div className='space-y-1'>
              <p className='font-medium'>{warningMessage}</p>
              {status && (<div className='space-y-0.5 text-xs'>
                  <p>Current: {status.currentStock}</p>
                  <p>Minimum: {status.minimumStock}</p>
                  <p>Max selectable: {maxQuantity}</p>
                </div>)}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>) : (indicatorContent);
    // Return simple indicator for non-detailed variants
    if (variant !== 'detailed') {
        return withTooltip;
    }
    // Detailed variant with collapsible content
    return (<div className='space-y-2'>
      {withTooltip}

      <Collapsible open={showDetails} onOpenChange={setShowDetails}>
        <CollapsibleContent>
          <div className='space-y-2 rounded-lg border bg-card p-3 text-sm'>
            {/* Stock details */}
            {status && (<div className='grid grid-cols-2 gap-2 text-xs'>
                <div>
                  <span className='font-medium'>Current:</span>{' '}
                  <span>{status.currentStock}</span>
                </div>
                <div>
                  <span className='font-medium'>Minimum:</span>{' '}
                  <span>{status.minimumStock}</span>
                </div>
                <div>
                  <span className='font-medium'>Available:</span>{' '}
                  <span>{canSelect(required) ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <span className='font-medium'>Max qty:</span>{' '}
                  <span>{maxQuantity}</span>
                </div>
              </div>)}

            {/* Warning message */}
            {warningMessage && (<div className='rounded bg-muted/50 p-2 text-xs text-muted-foreground'>
                {warningMessage}
              </div>)}

            {/* Alternative suggestions */}
            {showAlternatives && level === 'out_of_stock' && (<div className='space-y-2'>
                <p className='text-xs font-medium'>Alternatives available:</p>
                <Button variant='outline' size='sm' onClick={() => onAlternativeClick?.(addon.id)} className='w-full text-xs'>
                  View Alternatives
                </Button>
              </div>)}

            {/* Refresh option */}
            <div className='flex justify-end'>
              <Button variant='ghost' size='sm' onClick={handleRefresh} className='h-auto p-1 text-xs' disabled={isLoading}>
                <RefreshCw className={cn('mr-1 h-3 w-3', isLoading && 'animate-spin')}/>
                {isLoading ? 'Updating...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>);
};
// Memoized version for performance
export const MemoizedEnhancedStockIndicator = React.memo(EnhancedStockIndicator, (prevProps, nextProps) => {
    return (prevProps.addon.id === nextProps.addon.id &&
        prevProps.addon.inventory?.currentStock ===
            nextProps.addon.inventory?.currentStock &&
        prevProps.required === nextProps.required &&
        prevProps.variant === nextProps.variant &&
        prevProps.size === nextProps.size);
});
export default EnhancedStockIndicator;
