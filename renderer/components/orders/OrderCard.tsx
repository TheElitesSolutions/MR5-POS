'use client';

import React, { memo } from 'react';
import { Order } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  MapPin,
  DollarSign,
  Eye,
  ShoppingBag,
  Calendar,
  User
} from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onViewDetails: (order: Order) => void;
  showActions?: boolean;
}

const OrderCard = ({
  order,
  onViewDetails,
  showActions = true,
}: OrderCardProps) => {
  const formatTimeOnly = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDateOnly = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toFixed(2);
  };

  // Calculate total items quantity
  const totalQuantity = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

  // Get order type label
  const getOrderTypeLabel = () => {
    return (order.type || 'DINE_IN').replace('_', ' ');
  };

  // Get order type color
  const getOrderTypeColor = () => {
    switch (order.type) {
      case 'DELIVERY':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'TAKEOUT':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  const handleViewDetails = () => {
    onViewDetails(order);
  };

  return (
    <Card className='group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5'>
      <CardContent className='p-5'>
        {/* Header Section */}
        <div className='mb-4 flex items-start justify-between'>
          <div>
            <h3 className='text-base font-semibold text-gray-900 dark:text-white'>
              ORD-{order.orderNumber}
            </h3>
            <div className='mt-1 flex items-center gap-2'>
              <Badge variant='secondary' className={getOrderTypeColor()}>
                {getOrderTypeLabel()}
              </Badge>
              {order.customerName && (
                <span className='text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1'>
                  <User className='h-3 w-3' />
                  {order.customerName}
                </span>
              )}
            </div>
          </div>
          <div className='text-right'>
            <div className='text-xl font-bold text-gray-900 dark:text-white'>
              ${formatCurrency(order.totalAmount || order.total || 0)}
            </div>
          </div>
        </div>

        {/* Date and Time */}
        <div className='mb-3 flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2'>
          <div className='flex items-center gap-2 text-xs'>
            <Calendar className='h-3.5 w-3.5 text-gray-400' />
            <span className='text-gray-600 dark:text-gray-400'>
              {formatDateOnly(order.createdAt)}
            </span>
          </div>
          <div className='flex items-center gap-2 text-xs'>
            <Clock className='h-3.5 w-3.5 text-gray-400' />
            <span className='font-medium text-gray-700 dark:text-gray-300'>
              {formatTimeOnly(order.createdAt)}
            </span>
          </div>
        </div>

        {/* Quick Info */}
        <div className='mb-3 grid grid-cols-2 gap-3'>
          {order.tableId && (
            <div className='flex items-center gap-2'>
              <MapPin className='h-3.5 w-3.5 text-gray-400' />
              <span className='text-xs text-gray-600 dark:text-gray-400'>Table:</span>
              <span className='text-xs font-medium text-gray-900 dark:text-white'>
                {(order as any).table?.name || order.tableId}
              </span>
            </div>
          )}
          <div className='flex items-center gap-2'>
            <ShoppingBag className='h-3.5 w-3.5 text-gray-400' />
            <span className='text-xs text-gray-600 dark:text-gray-400'>Items:</span>
            <span className='text-xs font-medium text-gray-900 dark:text-white'>
              {totalQuantity} ({order.items?.length || 0} unique)
            </span>
          </div>
        </div>

        {/* Items Preview - Show first 3 items */}
        {order.items && order.items.length > 0 && (
          <div className='mb-3 border-t dark:border-gray-700 pt-3'>
            <div className='space-y-1'>
              {order.items.slice(0, 3).map((item, index) => (
                <div
                  key={item.id || index}
                  className='flex justify-between text-xs'
                >
                  <span className='text-gray-600 dark:text-gray-400 truncate max-w-[60%]'>
                    {item.quantity}x {item.name || item.menuItemName || 'Unknown Item'}
                  </span>
                  <span className='font-medium text-gray-900 dark:text-white'>
                    ${formatCurrency(item.totalPrice || item.price * item.quantity || 0)}
                  </span>
                </div>
              ))}
              {order.items.length > 3 && (
                <div className='text-xs text-gray-500 dark:text-gray-400 italic'>
                  +{order.items.length - 3} more items...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <Button
            variant='outline'
            size='sm'
            onClick={handleViewDetails}
            className='w-full mt-2 group-hover:bg-gray-50 dark:group-hover:bg-gray-800'
          >
            <Eye className='mr-1.5 h-3.5 w-3.5' />
            View Details
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default memo(OrderCard);
