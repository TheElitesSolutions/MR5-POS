'use client';

import { useState } from 'react';
import { CashboxSummary as CashboxSummaryType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DollarSign,
  CreditCard,
  ShoppingBag,
  TrendingUp,
  Lock,
  Calendar,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface CashboxSummaryProps {
  summary: CashboxSummaryType | null;
  date: Date;
  onCloseCashbox: (date: Date, actualCashAmount?: number) => Promise<void>;
  isLoading?: boolean;
}

const CashboxSummary = ({
  summary,
  date,
  onCloseCashbox,
  isLoading = false,
}: CashboxSummaryProps) => {
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

  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatBusinessDayRange = (businessDayRange?: {
    start: string;
    end: string;
  }) => {
    if (!businessDayRange) return null;

    const startDate = new Date(businessDayRange.start);
    const endDate = new Date(businessDayRange.end);

    const startTime = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const endTime = endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const endDateStr = endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    return `${startTime} - ${endTime} (${endDateStr})`;
  };

  const handleCloseCashbox = async () => {
    try {
      setIsClosing(true);
      // For now, we'll close without requiring actual cash amount input
      // In the future, this could be enhanced with a form input
      await onCloseCashbox(date);
      setShowCloseDialog(false);
    } catch (error) {
      console.error('Failed to close cashbox:', error);
    } finally {
      setIsClosing(false);
    }
  };

  if (isLoading) {
    return (
      <Card className='animate-pulse'>
        <CardHeader>
          <div className='h-6 w-1/2 rounded bg-gray-200 dark:bg-gray-700'></div>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className='h-16 rounded bg-gray-200 dark:bg-gray-700'
              ></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className='p-6'>
          <div className='py-8 text-center'>
            <Calendar className='mx-auto mb-4 h-12 w-12 text-gray-400' />
            <p className='text-gray-500'>
              No sales data available for {formatDate(date)}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = summary.totalCash || 0; // All payments are cash
  const cashPercentage = 100; // Since all payments are cash

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center space-x-2'>
            <DollarSign className='h-5 w-5 text-green-600' />
            <span>Daily Cashbox Summary</span>
          </CardTitle>
          <div className='flex flex-col items-end space-y-1'>
            <Badge variant='outline' className='text-xs'>
              {formatDate(date)}
            </Badge>
            {summary.businessDayRange && (
              <div className='text-xs text-gray-500'>
                Business Hours:{' '}
                {formatBusinessDayRange(summary.businessDayRange)}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-6'>
        {/* Revenue Overview */}
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <div className='flex items-center space-x-2'>
              <DollarSign className='h-4 w-4 text-green-600' />
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                Cash Sales
              </span>
            </div>
            <div className='text-2xl font-bold text-green-600'>
              {formatCurrency(summary.totalCash)}
            </div>
            <div className='text-xs text-gray-500'>
              {cashPercentage.toFixed(1)}% of total
            </div>
          </div>

          <div className='space-y-2'>
            <div className='flex items-center space-x-2'>
              <ShoppingBag className='h-4 w-4 text-blue-600' />
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                Order Types
              </span>
            </div>
            <div className='space-y-1'>
              <div className='flex justify-between text-xs'>
                <span className='text-gray-600'>Dine-in:</span>
                <span className='font-medium'>{formatCurrency(summary.dineInTotal || 0)}</span>
              </div>
              <div className='flex justify-between text-xs'>
                <span className='text-gray-600'>Takeout:</span>
                <span className='font-medium'>{formatCurrency(summary.takeoutTotal || 0)}</span>
              </div>
              <div className='flex justify-between text-xs'>
                <span className='text-gray-600'>Delivery:</span>
                <span className='font-medium'>{formatCurrency(summary.deliveryTotal || 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className='border-t pt-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-2'>
              <TrendingUp className='h-5 w-5 text-gray-600' />
              <span className='text-lg font-semibold'>Total Revenue</span>
            </div>
            <div className='text-3xl font-bold text-gray-900 dark:text-white'>
              {formatCurrency(totalRevenue)}
            </div>
          </div>
        </div>

        {/* Order Statistics */}
        <div className='grid grid-cols-2 gap-4 border-t pt-4'>
          <div className='space-y-2'>
            <div className='flex items-center space-x-2'>
              <ShoppingBag className='h-4 w-4 text-purple-600' />
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                Total Orders
              </span>
            </div>
            <div className='text-xl font-bold'>{summary.totalOrders}</div>
          </div>

          <div className='space-y-2'>
            <div className='flex items-center space-x-2'>
              <TrendingUp className='h-4 w-4 text-orange-600' />
              <span className='text-sm text-gray-600 dark:text-gray-400'>
                Avg Order Value
              </span>
            </div>
            <div className='text-xl font-bold'>
              {formatCurrency(summary.averageOrderValue)}
            </div>
          </div>
        </div>

        {/* Order Status Breakdown */}
        <div className='space-y-3 border-t pt-4'>
          <h4 className='font-medium text-gray-900 dark:text-white'>
            Order Status
          </h4>
          <div className='grid grid-cols-3 gap-3 text-sm'>
            <div className='flex items-center justify-between'>
              <span className='text-gray-600 dark:text-gray-400'>
                Completed:
              </span>
              <Badge
                variant='outline'
                className='border-green-200 bg-green-50 text-green-700'
              >
                {summary.ordersByStatus.completed}
              </Badge>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-gray-600 dark:text-gray-400'>Pending:</span>
              <Badge
                variant='outline'
                className='border-yellow-200 bg-yellow-50 text-yellow-700'
              >
                {summary.ordersByStatus.pending}
              </Badge>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-gray-600 dark:text-gray-400'>
                Cancelled:
              </span>
              <Badge
                variant='outline'
                className='border-red-200 bg-red-50 text-red-700'
              >
                {summary.ordersByStatus.cancelled}
              </Badge>
            </div>
          </div>
        </div>

        {/* Expected Cash Amount or Variance Information */}
        {summary.isClosed ? (
          <div
            className={`rounded-lg border p-4 ${
              summary.variance === 0
                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                : summary.variance && Math.abs(summary.variance) > 0
                  ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
                  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
            }`}
          >
            <div className='flex items-start space-x-3'>
              <CheckCircle
                className={`mt-0.5 h-5 w-5 ${
                  summary.variance === 0 ? 'text-green-600' : 'text-yellow-600'
                }`}
              />
              <div className='flex-1'>
                <h4
                  className={`font-medium ${
                    summary.variance === 0
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-yellow-900 dark:text-yellow-100'
                  }`}
                >
                  Cashbox Closed
                </h4>
                <div className='mt-1 space-y-1 text-sm'>
                  <div className='flex justify-between'>
                    <span>Expected Cash:</span>
                    <span className='font-medium'>
                      {formatCurrency(summary.totalCash)}
                    </span>
                  </div>
                  {summary.actualCashAmount !== undefined && (
                    <div className='flex justify-between'>
                      <span>Actual Cash:</span>
                      <span className='font-medium'>
                        {formatCurrency(summary.actualCashAmount)}
                      </span>
                    </div>
                  )}
                  {summary.variance !== undefined && (
                    <div className='flex justify-between border-t pt-1'>
                      <span>Variance:</span>
                      <span
                        className={`font-bold ${
                          summary.variance === 0
                            ? 'text-green-600'
                            : summary.variance > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                        }`}
                      >
                        {summary.variance >= 0 ? '+' : ''}
                        {formatCurrency(summary.variance)}
                      </span>
                    </div>
                  )}
                  {summary.closedAt && (
                    <div className='mt-2 text-xs text-gray-500'>
                      Closed on {new Date(summary.closedAt).toLocaleString()}
                      {summary.closedBy && ` by ${summary.closedBy}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className='rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20'>
            <div className='flex items-start space-x-3'>
              <AlertTriangle className='mt-0.5 h-5 w-5 text-blue-600' />
              <div className='flex-1'>
                <h4 className='font-medium text-blue-900 dark:text-blue-100'>
                  Expected Cash in Register
                </h4>
                <p className='mt-1 text-sm text-blue-700 dark:text-blue-300'>
                  You should have{' '}
                  <strong>{formatCurrency(summary.totalCash)}</strong> in cash
                  in your register at the end of the business day.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Close Cashbox Button */}
        {!summary.isClosed && (
          <div className='border-t pt-4'>
            <AlertDialog
              open={showCloseDialog}
              onOpenChange={setShowCloseDialog}
            >
              <AlertDialogTrigger asChild>
                <Button
                  className='flex w-full items-center space-x-2'
                  size='lg'
                  variant='default'
                >
                  <Lock className='h-4 w-4' />
                  <span>Close Cashbox for {formatDate(date)}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className='flex items-center space-x-2'>
                    <CheckCircle className='h-5 w-5 text-green-600' />
                    <span>Close Cashbox</span>
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to close the cashbox for{' '}
                    {formatDate(date)}?
                  </AlertDialogDescription>
                  <div className='mt-4 space-y-3'>
                    <div className='space-y-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800'>
                      <div className='flex justify-between'>
                        <span>Expected Cash:</span>
                        <span className='font-medium'>
                          {formatCurrency(summary.totalCash)}
                        </span>
                      </div>
                      <div className='flex justify-between'>
                        <span>Dine-in:</span>
                        <span className='font-medium'>
                          {formatCurrency(summary.dineInTotal || 0)}
                        </span>
                      </div>
                      <div className='flex justify-between'>
                        <span>Takeout:</span>
                        <span className='font-medium'>
                          {formatCurrency(summary.takeoutTotal || 0)}
                        </span>
                      </div>
                      <div className='flex justify-between'>
                        <span>Delivery:</span>
                        <span className='font-medium'>
                          {formatCurrency(summary.deliveryTotal || 0)}
                        </span>
                      </div>
                      <div className='flex justify-between border-t pt-2 font-bold'>
                        <span>Total Revenue:</span>
                        <span>{formatCurrency(totalRevenue)}</span>
                      </div>
                    </div>
                    <p className='text-sm text-gray-600'>
                      This action will finalize the day&apos;s sales and cannot
                      be undone.
                    </p>
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCloseCashbox}
                    disabled={isClosing}
                    className='bg-green-600 hover:bg-green-700'
                  >
                    {isClosing ? 'Closing...' : 'Close Cashbox'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CashboxSummary;
