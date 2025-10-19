'use client';

import POSLayout from '@/components/pos/POSLayout';
import { PageLoader } from '@/components/ui/loading-spinner';

export default function ExpensesLoading() {
  return (
    <POSLayout>
      <PageLoader text='Loading expenses...' />
    </POSLayout>
  );
}
