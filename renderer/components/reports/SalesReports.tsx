'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Download,
  Printer,
  Package,
} from 'lucide-react';
import { useReportsStore } from '@/stores/reportsStore';
import { useToast } from '@/hooks/use-toast';

const SalesReports = () => {
  const { salesReport, fetchSalesReport, exportSalesReport, dateRange, isLoading } =
    useReportsStore();
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSalesReport(dateRange);
  }, [dateRange]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportSalesReport(dateRange);
      toast({
        title: 'Success',
        description: 'Sales report exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export report',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading || !salesReport) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600'></div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatOrderType = (type: string) => {
    switch (type) {
      case 'DINE_IN':
        return 'Dine-in';
      case 'TAKEOUT':
        return 'Takeout';
      case 'DELIVERY':
        return 'Delivery';
      default:
        return type;
    }
  };

  return (
    <div className='space-y-6'>
      {/* Action Buttons */}
      <div className='flex justify-end space-x-2 print:hidden'>
        <Button
          variant='outline'
          size='sm'
          onClick={handleExport}
          disabled={isExporting}
          className='flex items-center space-x-2'
        >
          <Download className='h-4 w-4' />
          <span>{isExporting ? 'Exporting...' : 'Export to Excel'}</span>
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={handlePrint}
          className='flex items-center space-x-2'
        >
          <Printer className='h-4 w-4' />
          <span>Print</span>
        </Button>
      </div>

      {/* Sales Summary Cards */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center space-x-3'>
              <div className='rounded-lg bg-green-50 p-2 dark:bg-green-900/20'>
                <DollarSign className='h-5 w-5 text-green-600 dark:text-green-400' />
              </div>
              <div>
                <div className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {formatCurrency(salesReport.totalRevenue)}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Total Revenue
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center space-x-3'>
              <div className='rounded-lg bg-blue-50 p-2 dark:bg-blue-900/20'>
                <ShoppingCart className='h-5 w-5 text-blue-600 dark:text-blue-400' />
              </div>
              <div>
                <div className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {salesReport.totalOrders}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Total Orders
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center space-x-3'>
              <div className='rounded-lg bg-purple-50 p-2 dark:bg-purple-900/20'>
                <TrendingUp className='h-5 w-5 text-purple-600 dark:text-purple-400' />
              </div>
              <div>
                <div className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {formatCurrency(salesReport.averageOrderValue)}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Avg Order Value
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center space-x-3'>
              <div className='rounded-lg bg-orange-50 p-2 dark:bg-orange-900/20'>
                <Package className='h-5 w-5 text-orange-600 dark:text-orange-400' />
              </div>
              <div>
                <div className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {salesReport.averageItemsPerOrder.toFixed(1)}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Avg Items per Order
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center justify-between'>
            <span className='flex items-center space-x-2'>
              <ShoppingCart className='h-5 w-5 text-blue-600' />
              <span>Orders</span>
            </span>
            <span className='text-sm font-normal text-gray-500'>
              {salesReport.orders.length} orders
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b bg-gray-50 dark:bg-gray-800'>
                  <th className='p-3 text-left text-sm font-medium'>Order #</th>
                  <th className='p-3 text-left text-sm font-medium'>Time</th>
                  <th className='p-3 text-left text-sm font-medium'>Type</th>
                  <th className='p-3 text-left text-sm font-medium'>Table</th>
                  <th className='p-3 text-right text-sm font-medium'>Items</th>
                  <th className='p-3 text-right text-sm font-medium'>Total</th>
                </tr>
              </thead>
              <tbody>
                {salesReport.orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className='p-8 text-center text-gray-500'>
                      No orders found for the selected period
                    </td>
                  </tr>
                ) : (
                  salesReport.orders.map((order) => (
                    <tr
                      key={order.id}
                      className='border-b hover:bg-gray-50 dark:hover:bg-gray-800'
                    >
                      <td className='p-3 font-medium text-blue-600'>
                        {order.orderNumber}
                      </td>
                      <td className='p-3 text-gray-600 dark:text-gray-400'>
                        <div className='text-sm'>{formatTime(order.createdAt)}</div>
                        <div className='text-xs text-gray-500'>
                          {formatDate(order.createdAt)}
                        </div>
                      </td>
                      <td className='p-3'>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            order.type === 'DINE_IN'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              : order.type === 'TAKEOUT'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                          }`}
                        >
                          {formatOrderType(order.type)}
                        </span>
                      </td>
                      <td className='p-3 text-gray-600 dark:text-gray-400'>
                        {(order as any).table?.name || order.tableName || '-'}
                      </td>
                      <td className='p-3 text-right font-medium'>
                        {order.itemCount}
                      </td>
                      <td className='p-3 text-right font-bold text-green-600 dark:text-green-400'>
                        {formatCurrency(order.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          table {
            page-break-inside: avoid;
          }

          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

export default SalesReports;
