import React from 'react';
import { useStockStore } from '@/stores/stockStore';
import { AlertTriangle, X } from 'lucide-react';

export const LowStockWarning: React.FC = () => {
  const { lowStockItems, hasLowStockWarning, dismissLowStockWarning } =
    useStockStore();

  if (!hasLowStockWarning) return null;

  return (
    <div className='mb-4 border-l-4 border-amber-500 bg-amber-50 p-4'>
      <div className='flex items-center'>
        <div className='flex-shrink-0'>
          <AlertTriangle className='h-5 w-5 text-amber-500' />
        </div>
        <div className='ml-3 flex-1'>
          <p className='text-sm font-medium text-amber-700'>
            Low Stock Warning
          </p>
          <ul className='mt-1 list-inside list-disc text-sm text-amber-700'>
            {lowStockItems.map(item => (
              <li key={item.id}>
                {item.name} - {item.currentQuantity} {item.unit} remaining
                (below minimum of {item.minimumQuantity} {item.unit})
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={dismissLowStockWarning}
          className='ml-auto pl-3'
          aria-label='Dismiss warning'
        >
          <X className='h-5 w-5 text-amber-500' />
        </button>
      </div>
    </div>
  );
};

export default LowStockWarning;
