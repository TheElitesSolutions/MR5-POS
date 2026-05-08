'use client';

import POSLayout from '@/components/pos/POSLayout';
import { WebsiteShell } from '@/components/website/WebsiteShell';

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <POSLayout>
      <WebsiteShell>{children}</WebsiteShell>
    </POSLayout>
  );
}
