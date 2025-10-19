'use client';

import { StockItem } from '@/types';
import { AlertTriangle, BarChart3, Package, TrendingUp } from 'lucide-react';
import { memo, useMemo } from 'react';

interface StockStatsProps {
  stockItems: StockItem[];
}

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}

const StatCard = memo(({ icon, value, label, color }: StatCardProps) => (
  <div className='rounded-lg border bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-800'>
    <div className='flex items-center space-x-2'>
      <div className={color}>
        <div className='h-4 w-4'>{icon}</div>
      </div>
      <div>
        <div className={`text-lg font-bold ${color}`}>{value}</div>
        <div className='text-xs text-gray-600 dark:text-gray-400'>{label}</div>
      </div>
    </div>
  </div>
));

StatCard.displayName = 'StatCard';

const StockStats = memo(({ stockItems }: StockStatsProps) => {
  const stats = useMemo(() => {
    // Use all stock items for stats calculation
    const realItems = stockItems;

    const totalItems = realItems.length;
    const totalValue = realItems.reduce(
      (sum, item) => sum + (item.currentQuantity ?? item.currentStock) * item.costPerUnit,
      0
    );
    const lowStockCount = realItems.filter(
      item => (item.currentQuantity ?? item.currentStock) <= (item.minimumQuantity ?? item.minimumStock)
    ).length;
    const activeItems = realItems.length; // All real items are considered active
    const averageValue = totalItems > 0 ? totalValue / totalItems : 0;

    return {
      totalItems,
      totalValue,
      lowStockCount,
      activeItems,
      averageValue,
    };
  }, [stockItems]);

  return (
    <div className='grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4'>
      <StatCard
        icon={<Package className='h-4 w-4' />}
        value={stats.totalItems}
        label='Total Items'
        color='text-blue-600'
      />

      <StatCard
        icon={<BarChart3 className='h-4 w-4' />}
        value={`$${stats.totalValue.toFixed(0)}`}
        label='Total Value'
        color='text-green-600'
      />

      <StatCard
        icon={<AlertTriangle className='h-4 w-4' />}
        value={stats.lowStockCount}
        label='Low Stock'
        color='text-red-600'
      />

      <StatCard
        icon={<TrendingUp className='h-4 w-4' />}
        value={`$${stats.averageValue.toFixed(0)}`}
        label='Avg Item Value'
        color='text-purple-600'
      />
    </div>
  );
});

StockStats.displayName = 'StockStats';

export default StockStats;
