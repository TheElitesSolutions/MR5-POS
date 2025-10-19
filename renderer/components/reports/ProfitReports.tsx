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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
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

  const getMarginColor = (margin: number) => {
    if (margin > 50) return 'text-green-600 bg-green-50';
    if (margin >= 30) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getMarginBorderColor = (margin: number) => {
    if (margin > 50) return 'border-green-200';
    if (margin >= 30) return 'border-yellow-200';
    return 'border-red-200';
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

      {/* Daily Trends Chart */}
      {profitReport.dailyTrends && profitReport.dailyTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={300} className='print:h-64'>
              <LineChart data={profitReport.dailyTrends}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis 
                  dataKey='date' 
                  tickFormatter={formatDate}
                  angle={-45}
                  textAnchor='end'
                  height={60}
                />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend />
                <Line 
                  type='monotone' 
                  dataKey='revenue' 
                  stroke='#10B981' 
                  name='Revenue'
                  strokeWidth={2}
                />
                <Line 
                  type='monotone' 
                  dataKey='foodCost' 
                  stroke='#F59E0B' 
                  name='Food Cost'
                  strokeWidth={2}
                />
                <Line 
                  type='monotone' 
                  dataKey='expenses' 
                  stroke='#EF4444' 
                  name='Expenses'
                  strokeWidth={2}
                />
                <Line 
                  type='monotone' 
                  dataKey='profit' 
                  stroke='#3B82F6' 
                  name='Profit'
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-Item Profitability Table */}
      <Card>
        <CardHeader>
          <CardTitle>Item Profitability Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b bg-gray-50'>
                  <th className='p-2 text-left font-semibold'>Item</th>
                  <th className='p-2 text-left font-semibold'>Category</th>
                  <th className='p-2 text-right font-semibold'>Units Sold</th>
                  <th className='p-2 text-right font-semibold'>Revenue</th>
                  <th className='p-2 text-right font-semibold'>Food Cost/Unit</th>
                  <th className='p-2 text-right font-semibold'>Profit/Unit</th>
                  <th className='p-2 text-right font-semibold'>Total Profit</th>
                  <th className='p-2 text-center font-semibold'>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {profitReport.itemProfitability.map((item, index) => (
                  <tr key={index} className='border-b hover:bg-gray-50'>
                    <td className='p-2'>{item.itemName}</td>
                    <td className='p-2'>{item.category}</td>
                    <td className='p-2 text-right'>{item.unitsSold}</td>
                    <td className='p-2 text-right'>{formatCurrency(item.revenue)}</td>
                    <td className='p-2 text-right'>{formatCurrency(item.foodCostPerUnit)}</td>
                    <td className='p-2 text-right'>{formatCurrency(item.profitPerUnit)}</td>
                    <td className='p-2 text-right font-semibold'>{formatCurrency(item.totalProfit)}</td>
                    <td className='p-2 text-center'>
                      <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getMarginColor(item.margin)}`}>
                        {formatPercent(item.margin)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Per-Order Profitability Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order Profitability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b bg-gray-50'>
                  <th className='p-2 text-left font-semibold'>Order #</th>
                  <th className='p-2 text-left font-semibold'>Date</th>
                  <th className='p-2 text-left font-semibold'>Type</th>
                  <th className='p-2 text-right font-semibold'>Revenue</th>
                  <th className='p-2 text-right font-semibold'>Food Cost</th>
                  <th className='p-2 text-right font-semibold'>Expenses</th>
                  <th className='p-2 text-right font-semibold'>Total Cost</th>
                  <th className='p-2 text-right font-semibold'>Profit</th>
                  <th className='p-2 text-center font-semibold'>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {profitReport.orderProfitability.map((order, index) => (
                  <tr key={index} className='border-b hover:bg-gray-50'>
                    <td className='p-2'>{order.orderNumber}</td>
                    <td className='p-2'>{formatDateTime(order.createdAt)}</td>
                    <td className='p-2'>{order.type}</td>
                    <td className='p-2 text-right'>{formatCurrency(order.revenue)}</td>
                    <td className='p-2 text-right'>{formatCurrency(order.foodCost)}</td>
                    <td className='p-2 text-right'>{formatCurrency(order.allocatedExpenses)}</td>
                    <td className='p-2 text-right'>{formatCurrency(order.totalCost)}</td>
                    <td className={`p-2 text-right font-semibold ${order.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(order.profit)}
                    </td>
                    <td className='p-2 text-center'>
                      <span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${getMarginColor(order.margin)}`}>
                        {formatPercent(order.margin)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitReports;

