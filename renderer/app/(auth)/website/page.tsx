'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WebsiteIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/website/items');
  }, [router]);
  return null;
}
