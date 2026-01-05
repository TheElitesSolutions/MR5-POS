'use client';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, XCircle, AlertCircle, } from 'lucide-react';
/**
 * StockIndicator - Progressive stock status display with accessibility
 *
 * Features:
 * - Progressive disclosure based on stock levels
 * - Clear visual indicators with icons and colors
 * - Accessibility compliant with ARIA labels
 * - Responsive sizing options
 * - Quantity display option
 */
export const StockIndicator = ({ addonId, required, currentStock, minimumStock = 5, showQuantity = false, showIcon = true, size = 'md', className, }) => {
    // Determine stock status
    const getStockStatus = () => {
        if (currentStock === 0)
            return 'out_of_stock';
        if (currentStock < required)
            return 'insufficient';
        if (currentStock <= minimumStock)
            return 'low';
        return 'available';
    };
    const status = getStockStatus();
    // Configuration for each status
    const statusConfig = {
        available: {
            variant: 'default',
            icon: CheckCircle,
            text: 'Available',
            className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100',
            ariaLabel: `${currentStock} items available, sufficient stock`,
        },
        low: {
            variant: 'outline',
            icon: AlertTriangle,
            text: 'Low Stock',
            className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-100',
            ariaLabel: `${currentStock} items available, low stock warning`,
        },
        insufficient: {
            variant: 'outline',
            icon: AlertCircle,
            text: 'Limited',
            className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-100',
            ariaLabel: `Only ${currentStock} available, need ${required}`,
        },
        out_of_stock: {
            variant: 'destructive',
            icon: XCircle,
            text: 'Out of Stock',
            className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-100',
            ariaLabel: 'Out of stock, unavailable',
        },
    };
    const config = statusConfig[status];
    const IconComponent = config.icon;
    // Size configurations
    const sizeConfig = {
        sm: {
            badge: 'px-2 py-1 text-xs',
            icon: 'h-3 w-3',
            gap: 'gap-1',
        },
        md: {
            badge: 'px-2.5 py-1.5 text-xs',
            icon: 'h-3.5 w-3.5',
            gap: 'gap-1.5',
        },
        lg: {
            badge: 'px-3 py-2 text-sm',
            icon: 'h-4 w-4',
            gap: 'gap-2',
        },
    };
    const sizeStyles = sizeConfig[size];
    // Build display text
    const getDisplayText = () => {
        let text = config.text;
        if (showQuantity) {
            if (status === 'out_of_stock') {
                text = 'Out of Stock';
            }
            else if (status === 'insufficient') {
                text = `${currentStock}/${required}`;
            }
            else if (status === 'low') {
                text = `${config.text} (${currentStock})`;
            }
            else {
                text = `Available (${currentStock})`;
            }
        }
        return text;
    };
    return (<Badge variant={config.variant} className={cn('flex items-center font-medium transition-all duration-200', config.className, sizeStyles.badge, sizeStyles.gap, className)} role='status' aria-label={config.ariaLabel} title={config.ariaLabel}>
      {showIcon && (<IconComponent className={cn(sizeStyles.icon)} aria-hidden='true'/>)}
      <span>{getDisplayText()}</span>
    </Badge>);
};
// Hook for stock status logic
export const useStockStatus = (currentStock, required, minimumStock = 5) => {
    const status = React.useMemo(() => {
        if (currentStock === 0)
            return 'out_of_stock';
        if (currentStock < required)
            return 'insufficient';
        if (currentStock <= minimumStock)
            return 'low';
        return 'available';
    }, [currentStock, required, minimumStock]);
    return React.useMemo(() => ({
        status,
        isAvailable: currentStock > 0,
        isSufficient: currentStock >= required,
        isLow: currentStock <= minimumStock && currentStock > 0,
    }), [status, currentStock, required, minimumStock]);
};
// Memoized version for performance
export const MemoizedStockIndicator = React.memo(StockIndicator);
export default StockIndicator;
