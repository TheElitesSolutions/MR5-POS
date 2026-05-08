'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Globe, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';

const TABS = [
  { href: '/website/items', label: 'Items' },
  { href: '/website/restaurant-info', label: 'Restaurant Info' },
  { href: '/website/branding', label: 'Branding' },
];

export function WebsiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const projectId = useMemo(() => 'buivobulqaryifxesvqo', []);

  return (
    <QueryClientProvider client={queryClient}>
      {/*
        POSLayout's <main> is flex-1 overflow-hidden, so we must take the full
        available height ourselves and scroll the inner content area. Without
        this the Items list overflows the viewport with no scrollbar.
      */}
      <div className='flex h-full min-h-0 flex-col overflow-hidden'>
        <div className='flex-shrink-0 space-y-4 px-4 pt-4 md:px-6 md:pt-6'>
          <header className='flex items-center justify-between gap-4'>
            <div className='flex items-center gap-3'>
              <Globe className='h-6 w-6 text-primary' />
              <h1 className='text-2xl font-bold tracking-tight'>Website Manager</h1>
            </div>
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <span className='hidden sm:inline'>Connected to</span>
              <code className='rounded bg-muted px-2 py-1 font-mono'>{projectId}</code>
              {!online && (
                <span className='ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-900 dark:text-amber-100'>
                  <WifiOff className='h-3 w-3' /> Offline — writes disabled
                </span>
              )}
            </div>
          </header>

          <nav className='flex gap-1 border-b'>
            {TABS.map((t) => {
              const active = pathname === t.href || (t.href === '/website/items' && pathname === '/website');
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`min-h-[44px] px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'border-b-2 border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6'>
          <Card className='p-4 md:p-6'>{children}</Card>
        </div>
      </div>
    </QueryClientProvider>
  );
}
