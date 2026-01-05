'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Package,
  AlertTriangle,
  DollarSign,
  TrendingDown,
  Download,
  Printer,
  AlertCircle,
} from 'lucide-react';
import { useReportsStore } from '@/stores/reportsStore';
import { useToast } from '@/hooks/use-toast';

const InventoryReports = () => {
  const { inventoryReport, fetchInventoryReport, exportInventoryReport, dateRange, isLoading, error } =
    useReportsStore();
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchInventoryReport(dateRange);
  }, [dateRange, fetchInventoryReport]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportInventoryReport(dateRange);
      toast({
        title: 'Success',
        description: 'Inventory report exported successfully',
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

  if (isLoading || !inventoryReport) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex h-96 items-center justify-center'>
        <div className='text-center'>
          <AlertCircle className='h-12 w-12 text-red-500 mx-auto mb-4' />
          <p className='text-red-600 dark:text-red-400 mb-2'>Failed to load inventory report</p>
          <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>{error}</p>
          <Button onClick={() => fetchInventoryReport(dateRange)} variant='outline'>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
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

      {/* Summary Cards */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center space-x-3'>
              <div className='rounded-lg bg-blue-50 p-2'>
                <Package className='h-5 w-5 text-blue-600' />
              </div>
              <div>
                <div className='text-xl lg:text-2xl font-bold text-gray-900 dark:text-white'>
                  {inventoryReport.totalItems}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Total Items
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center space-x-3'>
              <div className='rounded-lg bg-green-50 p-2'>
                <DollarSign className='h-5 w-5 text-green-600' />
              </div>
              <div>
                <div className='text-xl lg:text-2xl font-bold text-gray-900 dark:text-white'>
                  {formatCurrency(inventoryReport.totalInventoryValue)}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Total Value
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center space-x-3'>
              <div className='rounded-lg bg-orange-50 p-2'>
                <AlertTriangle className='h-5 w-5 text-orange-600' />
              </div>
              <div>
                <div className='text-xl lg:text-2xl font-bold text-gray-900 dark:text-white'>
                  {inventoryReport.lowStockCount}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Low Stock Items
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center space-x-3'>
              <div className='rounded-lg bg-red-50 p-2'>
                <TrendingDown className='h-5 w-5 text-red-600' />
              </div>
              <div>
                <div className='text-xl lg:text-2xl font-bold text-gray-900 dark:text-white'>
                  {inventoryReport.outOfStockCount}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>
                  Out of Stock
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      {inventoryReport.lowStockItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <AlertTriangle className='h-5 w-5 text-orange-600' />
              <span>Low Stock Alerts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b bg-gray-50 dark:bg-gray-800'>
                    <th className='p-3 text-left text-sm font-medium'>Item Name</th>
                    <th className='p-3 text-left text-sm font-medium hidden lg:table-cell'>Category</th>
                    <th className='p-3 text-right text-sm font-medium'>Current Stock</th>
                    <th className='p-3 text-right text-sm font-medium hidden lg:table-cell'>Min Stock</th>
                    <th className='p-3 text-right text-sm font-medium'>Shortage</th>
                    <th className='p-3 text-left text-sm font-medium hidden xl:table-cell'>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryReport.lowStockItems.map((item) => (
                    <tr
                      key={item.id}
                      className='border-b hover:bg-gray-50 dark:hover:bg-gray-800'
                    >
                      <td className='p-3 font-medium'>{item.name}</td>
                      <td className='p-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell'>
                        {item.category}
                      </td>
                      <td className='p-3 text-right'>
                        <span
                          className={`font-medium ${
                            item.currentStock === 0
                              ? 'text-red-600'
                              : 'text-orange-600'
                          }`}
                        >
                          {item.currentStock}
                        </span>
                      </td>
                      <td className='p-3 text-right hidden lg:table-cell'>{item.minimumStock}</td>
                      <td className='p-3 text-right'>
                        <span className='font-medium text-red-600'>
                          {item.shortageAmount}
                        </span>
                      </td>
                      <td className='p-3 hidden xl:table-cell'>{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Stock */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center space-x-2'>
            <Package className='h-5 w-5 text-blue-600' />
            <span>Current Stock Levels</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b bg-gray-50 dark:bg-gray-800'>
                  <th className='p-3 text-left text-sm font-medium'>Item Name</th>
                  <th className='p-3 text-left text-sm font-medium hidden lg:table-cell'>Category</th>
                  <th className='p-3 text-right text-sm font-medium'>Current Stock</th>
                  <th className='p-3 text-right text-sm font-medium hidden xl:table-cell'>Min Stock</th>
                  <th className='p-3 text-left text-sm font-medium hidden xl:table-cell'>Unit</th>
                  <th className='p-3 text-right text-sm font-medium hidden xl:table-cell'>Cost/Unit</th>
                  <th className='p-3 text-right text-sm font-medium hidden lg:table-cell'>Total Value</th>
                  <th className='p-3 text-center text-sm font-medium'>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventoryReport.currentStock.map((item) => (
                  <tr
                    key={item.id}
                    className='border-b hover:bg-gray-50 dark:hover:bg-gray-800'
                  >
                    <td className='p-3 font-medium'>{item.name}</td>
                    <td className='p-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell'>
                      {item.category}
                    </td>
                    <td className='p-3 text-right'>{item.currentStock}</td>
                    <td className='p-3 text-right hidden xl:table-cell'>{item.minimumStock}</td>
                    <td className='p-3 hidden xl:table-cell'>{item.unit}</td>
                    <td className='p-3 text-right hidden xl:table-cell'>{formatCurrency(item.costPerUnit)}</td>
                    <td className='p-3 text-right font-medium hidden lg:table-cell'>
                      {formatCurrency(item.totalValue)}
                    </td>
                    <td className='p-3 text-center'>
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                          item.status === 'out'
                            ? 'bg-red-100 text-red-800'
                            : item.status === 'low'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {item.status === 'out'
                          ? 'Out'
                          : item.status === 'low'
                            ? 'Low'
                            : 'Normal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Stock Usage */}
      {inventoryReport.stockUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <TrendingDown className='h-5 w-5 text-purple-600' />
              <span>Stock Usage</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b bg-gray-50 dark:bg-gray-800'>
                    <th className='p-3 text-left text-sm font-medium'>Item Name</th>
                    <th className='p-3 text-left text-sm font-medium hidden lg:table-cell'>Category</th>
                    <th className='p-3 text-right text-sm font-medium'>Total Used</th>
                    <th className='p-3 text-right text-sm font-medium'>Avg Daily</th>
                    <th className='p-3 text-left text-sm font-medium hidden xl:table-cell'>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryReport.stockUsage.map((item) => (
                    <tr
                      key={item.itemId}
                      className='border-b hover:bg-gray-50 dark:hover:bg-gray-800'
                    >
                      <td className='p-3 font-medium'>{item.itemName}</td>
                      <td className='p-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell'>
                        {item.category}
                      </td>
                      <td className='p-3 text-right'>{item.totalUsed.toFixed(2)}</td>
                      <td className='p-3 text-right'>{item.averageDaily.toFixed(2)}</td>
                      <td className='p-3 hidden xl:table-cell'>{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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

export default InventoryReports;

