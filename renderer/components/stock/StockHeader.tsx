'use client';

import { Button } from '@/components/ui/button';
import { Settings, Plus } from 'lucide-react';
import { memo } from 'react';

interface StockHeaderProps {
  onAddItem: () => void;
  onManageCategories: () => void;
}

const StockHeader = memo(
  ({ onAddItem, onManageCategories }: StockHeaderProps) => {
    return (
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-bold text-gray-900 dark:text-white'>
            Stock Management
          </h1>
          <p className='text-sm text-gray-600 dark:text-gray-400'>
            Monitor inventory levels, track usage, and manage stock efficiently
            through automated POS integration.
          </p>
        </div>
        <div className='flex items-center space-x-2'>
          <Button
            onClick={onManageCategories}
            variant='outline'
            size='sm'
            className='flex items-center space-x-2'
          >
            <Settings className='h-4 w-4' />
            <span>Manage Categories</span>
          </Button>

          <Button
            onClick={onAddItem}
            className='flex items-center space-x-2'
            size='sm'
          >
            <Plus className='h-4 w-4' />
            <span>Add Stock Item</span>
          </Button>
        </div>
      </div>
    );
  }
);

StockHeader.displayName = 'StockHeader';

export default StockHeader;
