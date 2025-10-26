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
  // Parse SQLite datetime as local time (not UTC)
  const parseLocalDateTime = (dateString: string): Date => {
    // SQLite format: "YYYY-MM-DD HH:MM:SS"
    // We need to parse this as local time, not UTC
    const [datePart, timePart] = dateString.replace('T', ' ').split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = (timePart || '00:00:00').split(':').map(Number);

    // Create date in local timezone (month is 0-indexed)
    return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
  };

  const formatTimeOnly = (dateString: string) => {
    return parseLocalDateTime(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDateOnly = (dateString: string) => {
    return parseLocalDateTime(dateString).toLocaleDateString('en-US', {
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

        {/* Order Info - 2x2 Grid with second column right-aligned */}
        <div className='mb-3 space-y-2 text-xs'>
          {/* First Row: Date on left, Time on right */}
          <div className='flex items-center justify-between gap-2'>
            <div className='flex items-center gap-1.5'>
              <Calendar className='h-3.5 w-3.5 text-gray-400' />
              <span className='text-gray-600 dark:text-gray-400'>
                {formatDateOnly(order.createdAt)}
              </span>
            </div>
            <div className='flex items-center gap-1.5'>
              <Clock className='h-3.5 w-3.5 text-gray-400' />
              <span className='text-gray-600 dark:text-gray-400'>
                {formatTimeOnly(order.createdAt)}
              </span>
            </div>
          </div>

          {/* Second Row: Table on left, Items on right */}
          <div className='flex items-center justify-between gap-2'>
            {/* Table */}
            {(order.tableId || order.tableName) && (
              <div className='flex items-center gap-1.5'>
                <MapPin className='h-3.5 w-3.5 text-gray-400' />
                <span className='text-gray-600 dark:text-gray-400'>Table:</span>
                <span className='font-medium text-gray-900 dark:text-white'>
                  {(order as any).table?.name || order.tableName || 'N/A'}
                </span>
              </div>
            )}
            {/* Items */}
            <div className='flex items-center gap-1.5'>
              <ShoppingBag className='h-3.5 w-3.5 text-gray-400' />
              <span className='text-gray-600 dark:text-gray-400'>Items:</span>
              <span className='font-medium text-gray-900 dark:text-white'>
                {totalQuantity}
              </span>
            </div>
          </div>
        </div>

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
