'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  FileText,
  BarChart3,
  RefreshCw,
  Settings,
  Download,
  Printer,
  Users,
  Package,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const QuickActions = () => {
  const router = useRouter();

  const actions = [
    {
      id: 'new-order',
      title: 'New Order',
      description: 'Create a new order',
      icon: Plus,
      color: 'bg-blue-500 hover:bg-blue-600',
      action: () => router.push('/pos'),
    },
    {
      id: 'view-reports',
      title: 'View Reports',
      description: 'Access detailed reports',
      icon: BarChart3,
      color: 'bg-green-500 hover:bg-green-600',
      action: () => router.push('/reports'),
    },
    {
      id: 'manage-menu',
      title: 'Manage Menu',
      description: 'Update menu items',
      icon: FileText,
      color: 'bg-purple-500 hover:bg-purple-600',
      action: () => router.push('/menu'),
    },
    {
      id: 'staff-management',
      title: 'Staff',
      description: 'Manage staff schedules',
      icon: Users,
      color: 'bg-orange-500 hover:bg-orange-600',
      action: () => router.push('/staff'),
    },
    {
      id: 'inventory',
      title: 'Inventory',
      description: 'Check stock levels',
      icon: Package,
      color: 'bg-teal-500 hover:bg-teal-600',
      action: () => router.push('/inventory'),
    },
    {
      id: 'print-reports',
      title: 'Print Reports',
      description: 'Print daily reports',
      icon: Printer,
      color: 'bg-gray-500 hover:bg-gray-600',
      action: () => {
        // Implement print functionality
        console.log('Print reports');
      },
    },
    {
      id: 'export-data',
      title: 'Export Data',
      description: 'Download data exports',
      icon: Download,
      color: 'bg-indigo-500 hover:bg-indigo-600',
      action: () => {
        // Implement export functionality
        console.log('Export data');
      },
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'System configuration',
      icon: Settings,
      color: 'bg-gray-600 hover:bg-gray-700',
      action: () => router.push('/settings'),
    },
  ];

  return (
    <Card>
      <CardHeader className='pb-4'>
        <CardTitle className='flex items-center space-x-2'>
          <RefreshCw className='h-5 w-5 text-blue-600' />
          <span>Quick Actions</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8'>
          {actions.map(action => {
            const Icon = action.icon;

            return (
              <Button
                key={action.id}
                variant='outline'
                className='flex h-auto flex-col items-center space-y-2 p-4 transition-all hover:shadow-md'
                onClick={action.action}
              >
                <div className={`rounded-full p-3 text-white ${action.color}`}>
                  <Icon className='h-5 w-5' />
                </div>
                <div className='text-center'>
                  <div className='text-sm font-medium text-gray-900 dark:text-white'>
                    {action.title}
                  </div>
                  <div className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                    {action.description}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickActions;
