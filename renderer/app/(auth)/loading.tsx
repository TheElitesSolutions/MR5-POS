'use client';

import POSLayout from '@/components/pos/POSLayout';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function AuthLoading() {
  return (
    <POSLayout>
      <div className='flex h-[200px] items-center justify-center duration-75 animate-in fade-in-0'>
        <LoadingSpinner
          size='lg'
          variant='dots'
          text='Loading application...'
        />
      </div>
    </POSLayout>
  );
}
