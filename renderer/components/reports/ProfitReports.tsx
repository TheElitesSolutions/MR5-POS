'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Printer,
  Package,
  ShoppingBag,
  Receipt,
  Percent,
} from 'lucide-react';
import { useReportsStore } from '@/stores/reportsStore';
import { useToast } from '@/hooks/use-toast';

const ProfitReports = () => {
  const { profitReport, fetchProfitReport, exportProfitReport, dateRange, isLoading } =
    useReportsStore();
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfitReport(dateRange);
  }, [dateRange]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportProfitReport(dateRange);
      toast({
        title: 'Success',
        description: 'Profit report exported successfully',
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

  if (isLoading || !profitReport) {
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

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className='space-y-6'>
      {/* Action Buttons */}
      <div className='flex justify-end space-x-2 print:hidden'>
        <Button
          variant='outline'
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className='mr-2 h-4 w-4' />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
        <Button variant='outline' onClick={handlePrint}>
          <Printer className='mr-2 h-4 w-4' />
          Print
        </Button>
      </div>

      {/* Summary KPI Cards - Row 1 */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Revenue</CardTitle>
            <DollarSign className='h-4 w-4 text-green-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>
              {formatCurrency(profitReport.totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Cost</CardTitle>
            <Receipt className='h-4 w-4 text-red-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-red-600'>
              {formatCurrency(profitReport.totalCost)}
            </div>
          </CardContent>
        </Card>

        <Card className={profitReport.grossProfit >= 0 ? 'border-green-200' : 'border-red-200'}>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Gross Profit</CardTitle>
            {profitReport.grossProfit >= 0 ? (
              <TrendingUp className='h-4 w-4 text-green-600' />
            ) : (
              <TrendingDown className='h-4 w-4 text-red-600' />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitReport.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(profitReport.grossProfit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary KPI Cards - Row 2 */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Food Cost</CardTitle>
            <Package className='h-4 w-4 text-orange-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-orange-600'>
              {formatCurrency(profitReport.totalFoodCost)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Expenses</CardTitle>
            <ShoppingBag className='h-4 w-4 text-red-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-red-500'>
              {formatCurrency(profitReport.totalExpenses)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Profit Margin</CardTitle>
            <Percent className='h-4 w-4 text-purple-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-purple-600'>
              {formatPercent(profitReport.profitMargin)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Operations - Unified Orders and Expenses */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b bg-gray-50'>
                  <th className='p-2 text-left font-semibold'>Time</th>
                  <th className='p-2 text-left font-semibold'>Type</th>
                  <th className='p-2 text-left font-semibold'>Description</th>
                  <th className='p-2 text-left font-semibold'>Category</th>
                  <th className='p-2 text-right font-semibold'>Amount</th>
                  <th className='p-2 text-left font-semibold'>Notes</th>
                </tr>
              </thead>
              <tbody>
                {profitReport.operations.map((operation, index) => (
                  <tr
                    key={index}
                    className={`border-b hover:bg-gray-50 ${operation.type === 'expense' ? 'bg-red-50/30' : ''}`}
                  >
                    <td className='p-2'>{formatDateTime(operation.timestamp)}</td>
                    <td className='p-2'>
                      <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                        operation.type === 'order'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {operation.type === 'order' ? 'Order' : 'Expense'}
                      </span>
                    </td>
                    <td className='p-2 font-medium'>{operation.description}</td>
                    <td className='p-2'>{operation.category}</td>
                    <td className={`p-2 text-right font-semibold ${
                      operation.type === 'order' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {operation.type === 'order' ? '+' : '-'}{formatCurrency(Math.abs(operation.amount))}
                    </td>
                    <td className='p-2 text-gray-600'>{operation.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className='border-t-2 bg-gray-50 font-semibold'>
                <tr>
                  <td colSpan={4} className='p-3 text-right'>Total Income (Orders):</td>
                  <td className='p-3 text-right text-green-600 text-base'>
                    {formatCurrency(profitReport.totalRevenue)}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={4} className='p-3 text-right'>Total Expenses:</td>
                  <td className='p-3 text-right text-red-600 text-base'>
                    -{formatCurrency(profitReport.totalExpenses)}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td colSpan={4} className='p-3 text-right'>Total Food Cost:</td>
                  <td className='p-3 text-right text-orange-600 text-base'>
                    -{formatCurrency(profitReport.totalFoodCost)}
                  </td>
                  <td></td>
                </tr>
                <tr className='border-t-2'>
                  <td colSpan={4} className='p-3 text-right text-lg'>Net Profit:</td>
                  <td className={`p-3 text-right text-lg font-bold ${
                    profitReport.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(profitReport.grossProfit)}
                  </td>
                  <td className='p-3 text-sm text-gray-600'>
                    ({formatPercent(profitReport.profitMargin)} margin)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitReports;

