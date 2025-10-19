'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  Clock,
  RefreshCw,
  Calendar,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  Star,
  Target,
  PieChart,
  Activity,
} from 'lucide-react';

interface AnalyticsData {
  revenue: {
    total: number;
    byPeriod: Array<{
      period: string;
      amount: number;
      growth: number;
    }>;
    byAddonGroup: Array<{
      groupId: string;
      groupName: string;
      revenue: number;
      percentage: number;
    }>;
    byCategory: Array<{
      categoryId: string;
      categoryName: string;
      revenue: number;
      percentage: number;
    }>;
  };
  usage: {
    totalSelections: number;
    topAddons: Array<{
      id: string;
      name: string;
      groupName: string;
      selections: number;
      revenue: number;
      conversionRate: number;
    }>;
    topGroups: Array<{
      id: string;
      name: string;
      selections: number;
      revenue: number;
      avgSelectionsPerOrder: number;
    }>;
    categoryPerformance: Array<{
      categoryId: string;
      categoryName: string;
      totalOrders: number;
      ordersWithAddons: number;
      addonAttachRate: number;
      avgRevenuePerOrder: number;
    }>;
  };
  trends: {
    dailySelections: Array<{
      date: string;
      selections: number;
      revenue: number;
    }>;
    popularTimes: Array<{
      hour: number;
      selections: number;
      revenue: number;
    }>;
    seasonalTrends: Array<{
      month: string;
      selections: number;
      revenue: number;
    }>;
  };
  insights: {
    performingWell: Array<{
      type: 'addon' | 'group' | 'category';
      name: string;
      metric: string;
      value: number;
      reason: string;
    }>;
    needsAttention: Array<{
      type: 'addon' | 'group' | 'category';
      name: string;
      issue: string;
      impact: 'low' | 'medium' | 'high';
      recommendation: string;
    }>;
    opportunities: Array<{
      type: 'cross_sell' | 'upsell' | 'optimization';
      title: string;
      description: string;
      potentialImpact: string;
      difficulty: 'easy' | 'medium' | 'hard';
    }>;
  };
}

type TimeRange = '7d' | '30d' | '90d' | '1y';

export function AddonAnalyticsDashboard() {
  // State
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { toast } = useToast();

  // Load analytics data
  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange, selectedCategory]);

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // Mock analytics data - in production this would come from API
      const mockData: AnalyticsData = {
        revenue: {
          total: 12567.5,
          byPeriod: [
            { period: 'Week 1', amount: 2145.3, growth: 12.5 },
            { period: 'Week 2', amount: 2876.2, growth: 34.1 },
            { period: 'Week 3', amount: 3254.8, growth: 13.1 },
            { period: 'Week 4', amount: 4291.2, growth: 31.9 },
          ],
          byAddonGroup: [
            {
              groupId: 'group-1',
              groupName: 'Pizza Toppings',
              revenue: 5234.2,
              percentage: 41.6,
            },
            {
              groupId: 'group-2',
              groupName: 'Drink Sizes',
              revenue: 3456.8,
              percentage: 27.5,
            },
            {
              groupId: 'group-3',
              groupName: 'Crust Options',
              revenue: 2198.4,
              percentage: 17.5,
            },
            {
              groupId: 'group-4',
              groupName: 'Sauce Extras',
              revenue: 1678.1,
              percentage: 13.4,
            },
          ],
          byCategory: [
            {
              categoryId: 'cat-1',
              categoryName: 'Pizza',
              revenue: 8234.5,
              percentage: 65.5,
            },
            {
              categoryId: 'cat-2',
              categoryName: 'Beverages',
              revenue: 2876.3,
              percentage: 22.9,
            },
            {
              categoryId: 'cat-3',
              categoryName: 'Appetizers',
              revenue: 1456.7,
              percentage: 11.6,
            },
          ],
        },
        usage: {
          totalSelections: 4567,
          topAddons: [
            {
              id: 'addon-1',
              name: 'Extra Cheese',
              groupName: 'Pizza Toppings',
              selections: 456,
              revenue: 1140.0,
              conversionRate: 34.2,
            },
            {
              id: 'addon-2',
              name: 'Pepperoni',
              groupName: 'Pizza Toppings',
              selections: 389,
              revenue: 1167.0,
              conversionRate: 29.1,
            },
            {
              id: 'addon-3',
              name: 'Large Size',
              groupName: 'Drink Sizes',
              selections: 234,
              revenue: 351.0,
              conversionRate: 67.8,
            },
            {
              id: 'addon-4',
              name: 'Mushrooms',
              groupName: 'Pizza Toppings',
              selections: 178,
              revenue: 356.0,
              conversionRate: 13.3,
            },
            {
              id: 'addon-5',
              name: 'Thin Crust',
              groupName: 'Crust Options',
              selections: 156,
              revenue: 234.0,
              conversionRate: 45.6,
            },
          ],
          topGroups: [
            {
              id: 'group-1',
              name: 'Pizza Toppings',
              selections: 1234,
              revenue: 4567.2,
              avgSelectionsPerOrder: 2.3,
            },
            {
              id: 'group-2',
              name: 'Drink Sizes',
              selections: 567,
              revenue: 1234.5,
              avgSelectionsPerOrder: 1.0,
            },
            {
              id: 'group-3',
              name: 'Crust Options',
              selections: 345,
              revenue: 678.9,
              avgSelectionsPerOrder: 1.0,
            },
            {
              id: 'group-4',
              name: 'Sauce Extras',
              selections: 234,
              revenue: 456.3,
              avgSelectionsPerOrder: 0.8,
            },
          ],
          categoryPerformance: [
            {
              categoryId: 'cat-1',
              categoryName: 'Pizza',
              totalOrders: 1234,
              ordersWithAddons: 1098,
              addonAttachRate: 89.0,
              avgRevenuePerOrder: 6.78,
            },
            {
              categoryId: 'cat-2',
              categoryName: 'Beverages',
              totalOrders: 567,
              ordersWithAddons: 234,
              addonAttachRate: 41.3,
              avgRevenuePerOrder: 2.34,
            },
            {
              categoryId: 'cat-3',
              categoryName: 'Appetizers',
              totalOrders: 234,
              ordersWithAddons: 89,
              addonAttachRate: 38.0,
              avgRevenuePerOrder: 1.67,
            },
          ],
        },
        trends: {
          dailySelections: [
            { date: '2024-01-22', selections: 156, revenue: 234.5 },
            { date: '2024-01-23', selections: 178, revenue: 267.3 },
            { date: '2024-01-24', selections: 145, revenue: 201.8 },
            { date: '2024-01-25', selections: 198, revenue: 298.7 },
            { date: '2024-01-26', selections: 234, revenue: 356.2 },
            { date: '2024-01-27', selections: 267, revenue: 398.5 },
            { date: '2024-01-28', selections: 189, revenue: 283.4 },
          ],
          popularTimes: [
            { hour: 11, selections: 45, revenue: 67.5 },
            { hour: 12, selections: 89, revenue: 133.5 },
            { hour: 13, selections: 67, revenue: 100.5 },
            { hour: 17, selections: 78, revenue: 117.0 },
            { hour: 18, selections: 123, revenue: 184.5 },
            { hour: 19, selections: 156, revenue: 234.0 },
            { hour: 20, selections: 134, revenue: 201.0 },
          ],
          seasonalTrends: [
            { month: 'Oct', selections: 1234, revenue: 1856.7 },
            { month: 'Nov', selections: 1456, revenue: 2184.5 },
            { month: 'Dec', selections: 1789, revenue: 2683.5 },
            { month: 'Jan', selections: 1567, revenue: 2350.5 },
          ],
        },
        insights: {
          performingWell: [
            {
              type: 'addon',
              name: 'Extra Cheese',
              metric: 'Conversion Rate',
              value: 34.2,
              reason: 'High customer demand and good profit margin',
            },
            {
              type: 'group',
              name: 'Pizza Toppings',
              metric: 'Revenue',
              value: 5234.2,
              reason: 'Strong upsell performance across all pizza orders',
            },
            {
              type: 'category',
              name: 'Pizza',
              metric: 'Attachment Rate',
              value: 89.0,
              reason: 'Excellent add-on integration and customer adoption',
            },
          ],
          needsAttention: [
            {
              type: 'addon',
              name: 'Mushrooms',
              issue: 'Low conversion rate',
              impact: 'medium',
              recommendation:
                'Consider promotional pricing or better placement',
            },
            {
              type: 'group',
              name: 'Sauce Extras',
              issue: 'Declining usage',
              impact: 'low',
              recommendation: 'Review sauce variety and customer preferences',
            },
            {
              type: 'category',
              name: 'Appetizers',
              issue: 'Poor addon attachment',
              impact: 'high',
              recommendation:
                'Redesign addon offerings or improve staff training',
            },
          ],
          opportunities: [
            {
              type: 'cross_sell',
              title: 'Beverage + Size Combo',
              description:
                'Customers who order large pizzas rarely upgrade drink sizes',
              potentialImpact: '+$890/month',
              difficulty: 'easy',
            },
            {
              type: 'upsell',
              title: 'Premium Toppings Push',
              description:
                'Introduce premium topping bundles for higher margins',
              potentialImpact: '+$1,240/month',
              difficulty: 'medium',
            },
            {
              type: 'optimization',
              title: 'Peak Hour Specials',
              description:
                'Target addon promotions during high-traffic periods',
              potentialImpact: '+$560/month',
              difficulty: 'easy',
            },
          ],
        },
      };

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));

      setAnalyticsData(mockData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    if (!analyticsData) return null;

    const avgRevenuePerSelection =
      analyticsData.revenue.total / analyticsData.usage.totalSelections;
    const totalGrowth =
      analyticsData.revenue.byPeriod.reduce(
        (sum, period) => sum + period.growth,
        0
      ) / analyticsData.revenue.byPeriod.length;
    const topPerformingAddon = analyticsData.usage.topAddons[0];
    const avgAttachmentRate =
      analyticsData.usage.categoryPerformance.reduce(
        (sum, cat) => sum + cat.addonAttachRate,
        0
      ) / analyticsData.usage.categoryPerformance.length;

    return {
      avgRevenuePerSelection,
      totalGrowth,
      topPerformingAddon,
      avgAttachmentRate,
    };
  }, [analyticsData]);

  const exportData = () => {
    // Mock export functionality
    toast({
      title: 'Export Started',
      description: 'Analytics data export will be ready shortly',
    });
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='flex items-center gap-2 text-muted-foreground'>
          <RefreshCw className='h-6 w-6 animate-spin' />
          <span>Loading analytics data...</span>
        </div>
      </div>
    );
  }

  if (!analyticsData || !summaryMetrics) {
    return (
      <div className='py-12 text-center'>
        <BarChart3 className='mx-auto mb-4 h-12 w-12 text-muted-foreground' />
        <h3 className='mb-2 text-lg font-medium'>No Analytics Data</h3>
        <p className='text-muted-foreground'>
          Unable to load analytics data at this time
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
        <div>
          <h1 className='text-2xl font-bold'>Add-On Analytics & Reporting</h1>
          <p className='text-muted-foreground'>
            Comprehensive insights into add-on performance and customer behavior
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Select
            value={timeRange}
            onValueChange={(value: TimeRange) => setTimeRange(value)}
          >
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='7d'>Last 7 days</SelectItem>
              <SelectItem value='30d'>Last 30 days</SelectItem>
              <SelectItem value='90d'>Last 90 days</SelectItem>
              <SelectItem value='1y'>Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant='outline' onClick={exportData}>
            <Download className='mr-2 h-4 w-4' />
            Export
          </Button>
          <Button
            variant='outline'
            onClick={loadAnalyticsData}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Revenue</CardTitle>
            <DollarSign className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              ${analyticsData.revenue.total.toFixed(2)}
            </div>
            <p className='flex items-center gap-1 text-xs text-muted-foreground'>
              {summaryMetrics.totalGrowth >= 0 ? (
                <TrendingUp className='h-3 w-3 text-green-600' />
              ) : (
                <TrendingDown className='h-3 w-3 text-red-600' />
              )}
              <span
                className={
                  summaryMetrics.totalGrowth >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }
              >
                {summaryMetrics.totalGrowth >= 0 ? '+' : ''}
                {summaryMetrics.totalGrowth.toFixed(1)}%
              </span>
              <span>from add-ons</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Selections
            </CardTitle>
            <Activity className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {analyticsData.usage.totalSelections.toLocaleString()}
            </div>
            <p className='text-xs text-muted-foreground'>
              ${summaryMetrics.avgRevenuePerSelection.toFixed(2)} avg per
              selection
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Attachment Rate
            </CardTitle>
            <Target className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {summaryMetrics.avgAttachmentRate.toFixed(1)}%
            </div>
            <p className='text-xs text-muted-foreground'>
              Average across categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Top Performer</CardTitle>
            <Star className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-lg font-bold'>
              {summaryMetrics.topPerformingAddon.name}
            </div>
            <p className='text-xs text-muted-foreground'>
              {summaryMetrics.topPerformingAddon.conversionRate.toFixed(1)}%
              conversion rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue='overview' className='space-y-4'>
        <TabsList className='grid w-full grid-cols-4 lg:w-[600px]'>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='revenue'>Revenue</TabsTrigger>
          <TabsTrigger value='performance'>Performance</TabsTrigger>
          <TabsTrigger value='insights'>Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value='overview' className='space-y-4'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            {/* Top Add-ons */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Star className='h-5 w-5' />
                  Top Performing Add-ons
                </CardTitle>
                <CardDescription>
                  Most selected add-ons by customer preference
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {analyticsData.usage.topAddons
                  .slice(0, 5)
                  .map((addon, index) => (
                    <div
                      key={addon.id}
                      className='flex items-center justify-between'
                    >
                      <div className='flex items-center gap-3'>
                        <div className='flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground'>
                          {index + 1}
                        </div>
                        <div>
                          <div className='font-medium'>{addon.name}</div>
                          <div className='text-xs text-muted-foreground'>
                            {addon.groupName}
                          </div>
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='font-medium'>{addon.selections}</div>
                        <div className='text-xs text-muted-foreground'>
                          ${addon.revenue.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>

            {/* Category Performance */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <PieChart className='h-5 w-5' />
                  Category Performance
                </CardTitle>
                <CardDescription>
                  Add-on attachment rates by category
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {analyticsData.usage.categoryPerformance.map(category => (
                  <div key={category.categoryId} className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='font-medium'>
                        {category.categoryName}
                      </span>
                      <div className='text-right'>
                        <div className='font-medium'>
                          {category.addonAttachRate.toFixed(1)}%
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          ${category.avgRevenuePerOrder.toFixed(2)}/order
                        </div>
                      </div>
                    </div>
                    <Progress
                      value={category.addonAttachRate}
                      className='h-2'
                    />
                    <div className='text-xs text-muted-foreground'>
                      {category.ordersWithAddons} of {category.totalOrders}{' '}
                      orders include add-ons
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Revenue Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <DollarSign className='h-5 w-5' />
                Revenue Distribution
              </CardTitle>
              <CardDescription>
                Revenue breakdown by add-on groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
                {analyticsData.revenue.byAddonGroup.map(group => (
                  <Card key={group.groupId} className='border-2'>
                    <CardContent className='pt-4'>
                      <div className='space-y-2'>
                        <div className='flex items-center justify-between'>
                          <span className='font-medium'>{group.groupName}</span>
                          <Badge variant='outline'>
                            {group.percentage.toFixed(1)}%
                          </Badge>
                        </div>
                        <div className='text-2xl font-bold text-green-600'>
                          ${group.revenue.toFixed(0)}
                        </div>
                        <Progress value={group.percentage} className='h-2' />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value='revenue' className='space-y-4'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            {/* Revenue by Period */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>
                  Weekly revenue growth from add-ons
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {analyticsData.revenue.byPeriod.map(period => (
                  <div
                    key={period.period}
                    className='flex items-center justify-between'
                  >
                    <span className='font-medium'>{period.period}</span>
                    <div className='flex items-center gap-2'>
                      <span className='text-lg font-bold'>
                        ${period.amount.toFixed(0)}
                      </span>
                      <div className='flex items-center gap-1'>
                        {period.growth >= 0 ? (
                          <TrendingUp className='h-3 w-3 text-green-600' />
                        ) : (
                          <TrendingDown className='h-3 w-3 text-red-600' />
                        )}
                        <span
                          className={`text-xs ${period.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {period.growth >= 0 ? '+' : ''}
                          {period.growth.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Revenue by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Category Revenue</CardTitle>
                <CardDescription>
                  Revenue contribution by menu category
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {analyticsData.revenue.byCategory.map(category => (
                  <div key={category.categoryId} className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='font-medium'>
                        {category.categoryName}
                      </span>
                      <div className='text-right'>
                        <div className='text-lg font-bold'>
                          ${category.revenue.toFixed(0)}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          {category.percentage.toFixed(1)}% of total
                        </div>
                      </div>
                    </div>
                    <Progress value={category.percentage} className='h-2' />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Daily Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Performance</CardTitle>
              <CardDescription>
                Daily selections and revenue over the past week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-7 gap-2'>
                {analyticsData.trends.dailySelections.map(day => (
                  <Card key={day.date} className='p-3 text-center'>
                    <div className='mb-1 text-xs text-muted-foreground'>
                      {new Date(day.date).toLocaleDateString('en', {
                        weekday: 'short',
                      })}
                    </div>
                    <div className='font-bold'>{day.selections}</div>
                    <div className='text-xs text-green-600'>
                      ${day.revenue.toFixed(0)}
                    </div>
                    <div className='mt-2'>
                      <Progress
                        value={
                          (day.selections /
                            Math.max(
                              ...analyticsData.trends.dailySelections.map(
                                d => d.selections
                              )
                            )) *
                          100
                        }
                        className='h-1'
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value='performance' className='space-y-4'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            {/* Top Groups */}
            <Card>
              <CardHeader>
                <CardTitle>Group Performance</CardTitle>
                <CardDescription>
                  Add-on groups ranked by total selections
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {analyticsData.usage.topGroups.map((group, index) => (
                  <div
                    key={group.id}
                    className='flex items-center justify-between'
                  >
                    <div className='flex items-center gap-3'>
                      <div className='flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground'>
                        {index + 1}
                      </div>
                      <div>
                        <div className='font-medium'>{group.name}</div>
                        <div className='text-xs text-muted-foreground'>
                          {group.avgSelectionsPerOrder.toFixed(1)} avg per order
                        </div>
                      </div>
                    </div>
                    <div className='text-right'>
                      <div className='font-bold'>{group.selections}</div>
                      <div className='text-xs text-green-600'>
                        ${group.revenue.toFixed(0)}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Popular Times */}
            <Card>
              <CardHeader>
                <CardTitle>Peak Hours</CardTitle>
                <CardDescription>
                  Add-on selections by time of day
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                {analyticsData.trends.popularTimes
                  .sort((a, b) => b.selections - a.selections)
                  .slice(0, 7)
                  .map(time => (
                    <div
                      key={time.hour}
                      className='flex items-center justify-between'
                    >
                      <span className='font-medium'>
                        {time.hour}:00 - {time.hour + 1}:00
                      </span>
                      <div className='flex items-center gap-3'>
                        <div className='text-right'>
                          <div className='font-bold'>{time.selections}</div>
                          <div className='text-xs text-green-600'>
                            ${time.revenue.toFixed(0)}
                          </div>
                        </div>
                        <div className='w-20'>
                          <Progress
                            value={
                              (time.selections /
                                Math.max(
                                  ...analyticsData.trends.popularTimes.map(
                                    t => t.selections
                                  )
                                )) *
                              100
                            }
                            className='h-2'
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>

          {/* Conversion Rates */}
          <Card>
            <CardHeader>
              <CardTitle>Conversion Rates</CardTitle>
              <CardDescription>
                How often add-ons are selected when available
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
                {analyticsData.usage.topAddons.slice(0, 6).map(addon => (
                  <Card key={addon.id} className='p-4'>
                    <div className='space-y-2'>
                      <div className='font-medium'>{addon.name}</div>
                      <div className='text-xs text-muted-foreground'>
                        {addon.groupName}
                      </div>
                      <div className='flex items-center justify-between'>
                        <span className='text-2xl font-bold'>
                          {addon.conversionRate.toFixed(1)}%
                        </span>
                        <Badge
                          variant={
                            addon.conversionRate >= 30
                              ? 'default'
                              : addon.conversionRate >= 15
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {addon.conversionRate >= 30
                            ? 'High'
                            : addon.conversionRate >= 15
                              ? 'Medium'
                              : 'Low'}
                        </Badge>
                      </div>
                      <Progress value={addon.conversionRate} className='h-2' />
                      <div className='text-xs text-muted-foreground'>
                        {addon.selections} selections, $
                        {addon.revenue.toFixed(0)} revenue
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value='insights' className='space-y-4'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
            {/* Performing Well */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <CheckCircle2 className='h-5 w-5 text-green-600' />
                  Performing Well
                </CardTitle>
                <CardDescription>
                  Items that are exceeding expectations
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {analyticsData.insights.performingWell.map((item, index) => (
                  <Card
                    key={index}
                    className='border-green-200 bg-green-50 p-4'
                  >
                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <span className='font-medium'>{item.name}</span>
                        <Badge variant='outline' className='bg-white'>
                          {item.type}
                        </Badge>
                      </div>
                      <div className='text-sm'>
                        <span className='font-medium'>{item.metric}:</span>{' '}
                        {item.value.toFixed(1)}
                        {item.metric.includes('Rate') ||
                        item.metric.includes('%')
                          ? '%'
                          : item.metric.includes('Revenue')
                            ? ''
                            : ''}
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        {item.reason}
                      </p>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>

            {/* Needs Attention */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <AlertTriangle className='h-5 w-5 text-orange-600' />
                  Needs Attention
                </CardTitle>
                <CardDescription>
                  Items requiring improvement or review
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {analyticsData.insights.needsAttention.map((item, index) => (
                  <Card
                    key={index}
                    className='border-orange-200 bg-orange-50 p-4'
                  >
                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <span className='font-medium'>{item.name}</span>
                        <Badge
                          variant={
                            item.impact === 'high'
                              ? 'destructive'
                              : item.impact === 'medium'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {item.impact} impact
                        </Badge>
                      </div>
                      <div className='text-sm font-medium text-orange-700'>
                        {item.issue}
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        {item.recommendation}
                      </p>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Opportunities */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Target className='h-5 w-5 text-blue-600' />
                Growth Opportunities
              </CardTitle>
              <CardDescription>
                Actionable recommendations to increase revenue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                {analyticsData.insights.opportunities.map(
                  (opportunity, index) => (
                    <Card
                      key={index}
                      className='border-blue-200 bg-blue-50 p-4'
                    >
                      <div className='space-y-3'>
                        <div className='flex items-center justify-between'>
                          <Badge variant='outline' className='bg-white'>
                            {opportunity.type.replace('_', ' ')}
                          </Badge>
                          <Badge
                            variant={
                              opportunity.difficulty === 'easy'
                                ? 'default'
                                : opportunity.difficulty === 'medium'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                          >
                            {opportunity.difficulty}
                          </Badge>
                        </div>
                        <div>
                          <div className='font-medium text-blue-900'>
                            {opportunity.title}
                          </div>
                          <p className='mt-1 text-sm text-blue-700'>
                            {opportunity.description}
                          </p>
                        </div>
                        <div className='text-lg font-bold text-green-600'>
                          {opportunity.potentialImpact}
                        </div>
                      </div>
                    </Card>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
