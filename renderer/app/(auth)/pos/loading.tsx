'use client';

import POSLayout from '@/components/pos/POSLayout';
import { UtensilsCrossed } from 'lucide-react';

export default function POSLoading() {
  return (
    <POSLayout>
      <div className='flex h-[250px] items-center justify-center duration-75 animate-in fade-in-0'>
        <div className='space-y-4 text-center'>
          <div className='relative mx-auto'>
            <div className='flex h-16 w-16 items-center justify-center rounded-full border-4 border-gray-200 dark:border-gray-700'>
              <UtensilsCrossed className='h-6 w-6 animate-pulse text-blue-600' />
            </div>
            <div className='absolute left-0 top-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-blue-600'></div>
          </div>
          <div className='space-y-2'>
            <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
              Initializing POS system...
            </p>
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              Loading tables and menu items
            </p>
          </div>
        </div>
      </div>
    </POSLayout>
  );
}
