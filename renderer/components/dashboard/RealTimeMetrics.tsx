'use client';

import { useDashboardStore } from '@/stores/dashboardStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

const RealTimeMetrics = () => {
  const { data, isLoading } = useDashboardStore();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const metrics = [
    {
      id: 'todays-sales',
      title: "Today's Sales",
      value: data?.totalRevenue || 0,
      format: 'currency' as const,
      icon: DollarSign,
      change: 8.2,
      trend: 'up' as const,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      id: 'active-orders',
      title: 'Active Orders',
      value: data?.totalOrders || 0,
      format: 'number' as const,
      icon: ShoppingCart,
      change: -2.1,
      trend: 'down' as const,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      id: 'total-customers',
      title: 'Total Customers',
      value: data?.totalCustomers || 0,
      format: 'number' as const,
      icon: Users,
      change: 12.5,
      trend: 'up' as const,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'avg-order-value',
      title: 'Avg Order Value',
      value: data?.averageOrderValue || 0,
      format: 'currency' as const,
      icon: TrendingUp,
      change: 5.3,
      trend: 'up' as const,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  if (isLoading) {
    return (
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className='animate-pulse'>
            <CardContent className='p-6'>
              <div className='h-16 rounded bg-gray-200'></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {metrics.map(metric => {
        const Icon = metric.icon;
        const formatValue = (value: number) => {
          switch (metric.format) {
            case 'currency':
              return formatCurrency(value);
            case 'number':
              return new Intl.NumberFormat('en-US').format(value);
            default:
              return value.toString();
          }
        };

        return (
          <Card
            key={metric.id}
            className='relative overflow-hidden transition-shadow hover:shadow-lg'
          >
            <CardContent className='p-6'>
              {/* Metric Icon and Value */}
              <div className='flex items-start justify-between'>
                <div className='flex-1'>
                  <div className='mb-2 flex items-center space-x-2'>
                    <div className={`rounded-lg p-2 ${metric.bgColor}`}>
                      <Icon className={`h-5 w-5 ${metric.color}`} />
                    </div>
                  </div>

                  <div className='space-y-1'>
                    <h3 className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                      {metric.title}
                    </h3>
                    <div className='text-2xl font-bold text-gray-900 dark:text-white'>
                      {formatValue(metric.value)}
                    </div>
                  </div>
                </div>

                {/* Trend Indicator */}
                <div className='flex items-center space-x-1'>
                  {metric.trend === 'up' ? (
                    <TrendingUp className='h-4 w-4 text-green-500' />
                  ) : (
                    <TrendingDown className='h-4 w-4 text-red-500' />
                  )}
                  <Badge
                    variant='outline'
                    className={`text-xs ${
                      metric.trend === 'up'
                        ? 'border-green-200 bg-green-50 text-green-600'
                        : 'border-red-200 bg-red-50 text-red-600'
                    }`}
                  >
                    {metric.change > 0 ? '+' : ''}
                    {metric.change}%
                  </Badge>
                </div>
              </div>

              {/* Status Indicator Bar */}
              <div className='mt-4'>
                <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
                  <span>vs. yesterday</span>
                  <Clock className='h-3 w-3' />
                </div>
              </div>
            </CardContent>

            {/* Real-time Pulse Indicator */}
            <div
              className={`absolute right-2 top-2 h-2 w-2 rounded-full ${metric.color.replace('text-', 'bg-')} animate-pulse`}
            ></div>
          </Card>
        );
      })}
    </div>
  );
};

export default RealTimeMetrics;
