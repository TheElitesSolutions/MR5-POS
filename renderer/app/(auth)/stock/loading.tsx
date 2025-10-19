'use client';

import POSLayout from '@/components/pos/POSLayout';
import { Package } from 'lucide-react';

export default function StockLoading() {
  return (
    <POSLayout>
      <div className='flex h-[250px] items-center justify-center duration-75 animate-in fade-in-0'>
        <div className='space-y-4 text-center'>
          <div className='relative mx-auto'>
            <div className='border-3 flex h-14 w-14 items-center justify-center rounded-full border-gray-200 dark:border-gray-700'>
              <Package className='loading-pulse h-5 w-5 text-purple-600' />
            </div>
            <div className='border-3 loading-spin absolute left-0 top-0 h-14 w-14 rounded-full border-transparent border-t-purple-600'></div>
          </div>
          <div className='space-y-2'>
            <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
              Loading stock...
            </p>
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              Fetching inventory data
            </p>
          </div>
        </div>
      </div>
    </POSLayout>
  );
}
