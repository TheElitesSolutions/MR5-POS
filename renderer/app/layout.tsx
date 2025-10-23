import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import StateCleanupProvider from '@/components/StateCleanupProvider';
import DataLossPreventionProvider from '@/components/DataLossPreventionProvider';
import PriceSystemProvider from '@/components/PriceSystemProvider';
import AuthProvider from '@/components/AuthProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import { LoadingProvider } from '@/components/LoadingProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'The Elites POS - Restaurant Management System',
  description: 'Professional restaurant point of sale system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`${inter.className} h-full overflow-hidden`}>
        <ErrorBoundary>
          <ThemeProvider>
            <LoadingProvider>
              <AuthProvider>
                <StateCleanupProvider>
                  <DataLossPreventionProvider>
                    <PriceSystemProvider>
                      {children}
                      <Toaster />
                    </PriceSystemProvider>
                  </DataLossPreventionProvider>
                </StateCleanupProvider>
              </AuthProvider>
            </LoadingProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
