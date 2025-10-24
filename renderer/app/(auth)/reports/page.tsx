'use client';

import POSLayout from '@/components/pos/POSLayout';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Package, TrendingUp } from 'lucide-react';

// Import report components
import SalesReports from '@/components/reports/SalesReports';
import InventoryReports from '@/components/reports/InventoryReports';
import ProfitReports from '@/components/reports/ProfitReports';
import TimePeriodSelector from '@/components/reports/TimePeriodSelector';

function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');

  return (
    <POSLayout>
      <div className='h-full space-y-4 overflow-y-auto p-6'>
        {/* Header Section */}
        <div className='flex flex-col space-y-3'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
              Reports
            </h1>
            <p className='text-gray-600 dark:text-gray-400'>
              View sales, inventory, and profit reports with real-time data
            </p>
          </div>

          {/* Time Period Selector */}
          <TimePeriodSelector />
        </div>

        {/* Main Content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className='space-y-4'
        >
          <TabsList className='grid w-full max-w-3xl grid-cols-3'>
            <TabsTrigger
              value='sales'
              className='flex items-center space-x-2'
            >
              <DollarSign className='h-4 w-4' />
              <span>Sales</span>
            </TabsTrigger>
            <TabsTrigger
              value='profit'
              className='flex items-center space-x-2'
            >
              <TrendingUp className='h-4 w-4' />
              <span>Revenue & Profit</span>
            </TabsTrigger>
            <TabsTrigger
              value='inventory'
              className='flex items-center space-x-2'
            >
              <Package className='h-4 w-4' />
              <span>Inventory</span>
            </TabsTrigger>
          </TabsList>

          {/* Sales Reports Tab */}
          <TabsContent value='sales'>
            <SalesReports />
          </TabsContent>

          {/* Revenue & Profit Reports Tab */}
          <TabsContent value='profit'>
            <ProfitReports />
          </TabsContent>

          {/* Inventory Reports Tab */}
          <TabsContent value='inventory'>
            <InventoryReports />
          </TabsContent>
        </Tabs>
      </div>
    </POSLayout>
  );
}

export default ReportsPage;
