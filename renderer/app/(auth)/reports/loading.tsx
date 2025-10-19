'use client';

import POSLayout from '@/components/pos/POSLayout';
import { PageLoader } from '@/components/ui/loading-spinner';

export default function ReportsLoading() {
  return (
    <POSLayout>
      <PageLoader text='Loading reports...' />
    </POSLayout>
  );
}
