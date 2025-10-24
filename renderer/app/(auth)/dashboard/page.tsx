'use client';

import DashboardKPIs from '@/components/dashboard/DashboardKPIs';
import SalesChart from '@/components/dashboard/SalesChart';
import TopMenuItems from '@/components/dashboard/TopMenuItems';
import POSLayout from '@/components/pos/POSLayout';
import RealTimeMetrics from '@/components/dashboard/RealTimeMetrics';
import QuickActions from '@/components/dashboard/QuickActions';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RefreshCw,
  TrendingUp,
  Clock,
  Activity,
  AlertTriangle,
} from 'lucide-react';

function DashboardContent() {
  const { isLoading, fetchDashboardData, clearError, error } =
    useDashboardStore();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Auto-refresh interval (every 30 seconds)
  useEffect(() => {
    if (!hasInitialized) return;

    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [hasInitialized, fetchDashboardData]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      clearError();
      await fetchDashboardData();
      toast({
        title: 'Dashboard Refreshed',
        description: 'Real-time data has been updated successfully',
      });
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh dashboard data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initialize dashboard data
  useEffect(() => {
    if (!hasInitialized && user) {
      setHasInitialized(true);
      fetchDashboardData().catch(error => {
        toast({
          title: 'Loading Error',
          description: 'Failed to load dashboard data. Please try refreshing.',
          variant: 'destructive',
        });
      });
    }
  }, [hasInitialized, user, fetchDashboardData, toast]);

  const currentTime = useMemo(() => {
    return new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [isLoading]);

  if (error && hasInitialized) {
    return (
      <POSLayout>
        <div className='flex h-full items-center justify-center'>
          <Card className='w-full max-w-md'>
            <CardContent className='pt-6'>
              <div className='text-center'>
                <AlertTriangle className='mx-auto h-12 w-12 text-red-500' />
                <h3 className='mt-4 text-lg font-semibold'>Dashboard Error</h3>
                <p className='mt-2 text-gray-600'>{error}</p>
                <Button onClick={handleRefresh} className='mt-4'>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </POSLayout>
    );
  }

  return (
    <POSLayout>
      <div className='h-full space-y-6 overflow-y-auto p-6'>
        {/* Header with Real-time Status */}
        <div className='flex items-center justify-between border-b pb-4'>
          <div>
            <h1 className='text-lg font-bold text-gray-900 dark:text-white'>
              Live Dashboard
            </h1>
            <div className='flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400'>
              <div className='flex items-center space-x-3'>
                <Clock className='h-4 w-4' />
                <span>Last updated: {currentTime}</span>
              </div>
              <div className='flex items-center space-x-3'>
                <Activity className='h-4 w-4 text-green-500' />
                <span>Real-time</span>
              </div>
            </div>
          </div>

          <div className='flex items-center space-x-3'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className='flex items-center space-x-3'
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Real-time Metrics Hero Section */}
        <RealTimeMetrics />

        {/* Content Area */}
        <div className='space-y-6'>
            {/* Key Performance Indicators */}
            <div className='space-y-4'>
              <div className='flex items-center space-x-2'>
                <TrendingUp className='h-5 w-5 text-blue-600' />
                <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
                  Key Performance Indicators
                </h2>
              </div>
              <DashboardKPIs />
            </div>

            {/* Charts and Analytics */}
            <div className='grid grid-cols-1 gap-6 xl:grid-cols-3'>
              {/* Sales Chart - Takes 2/3 width */}
              <div className='xl:col-span-2'>
                <Card className='border-2 border-gray-200 dark:border-gray-700'>
                  <CardHeader className='pb-3'>
                    <CardTitle className='flex items-center space-x-2 text-lg'>
                      <TrendingUp className='h-5 w-5 text-green-600' />
                      <span>Today's Sales Trend</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='pt-0'>
                    <SalesChart />
                  </CardContent>
                </Card>
              </div>

              {/* Top Menu Items - Takes 1/3 width */}
              <div className='xl:col-span-1'>
                <TopMenuItems />
              </div>
            </div>

          {/* Quick Actions */}
          <QuickActions />
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-25'>
            <Card className='p-6'>
              <div className='flex items-center space-x-3'>
                <div className='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600'></div>
                <span>Updating dashboard...</span>
              </div>
            </Card>
          </div>
        )}
      </div>
    </POSLayout>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
