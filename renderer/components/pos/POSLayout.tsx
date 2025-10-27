'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuthStore, useUserPermissions } from '@/stores/authStore';
import {
  BarChart3,
  DollarSign,
  FileBarChart,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LowStockWarning } from '@/components/stock/LowStockWarning';
import { useStockStore } from '@/stores/stockStore';

interface POSLayoutProps {
  children: React.ReactNode;
}

const POSLayout = ({ children }: POSLayoutProps) => {
  const { user, logout } = useAuthStore();
  const permissions = useUserPermissions();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { checkLowStock } = useStockStore();

  // Check for low stock items when component mounts and periodically
  useEffect(() => {
    // Initial check
    checkLowStock();

    // Set up interval to check periodically (every 5 minutes)
    const interval = setInterval(
      () => {
        checkLowStock();
      },
      5 * 60 * 1000
    );

    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, [checkLowStock]);

  const handleLogout = () => {
    logout();
  };

  const navigationItems = [
    {
      href: '/pos',
      label: 'POS',
      icon: UtensilsCrossed,
      show: true,
    },
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      show: permissions.isAdmin || permissions.isManager,
    },
    {
      href: '/orders',
      label: 'Orders',
      icon: ShoppingBag,
      show: permissions.isAdmin || permissions.isManager,
    },
    {
      href: '/expenses',
      label: 'Expenses',
      icon: DollarSign,
      show: permissions.isAdmin || permissions.isManager,
    },
    {
      href: '/menu',
      label: 'Menu',
      icon: UtensilsCrossed,
      show: permissions.isAdmin || permissions.isManager,
    },
    {
      href: '/stock',
      label: 'Stock',
      icon: Package,
      show: permissions.isAdmin || permissions.isManager,
    },
    {
      href: '/reports',
      label: 'Reports',
      icon: FileBarChart,
      show: permissions.isAdmin || permissions.isManager,
    },
  ];

  const isActivePage = (href: string) => pathname === href;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800';
      case 'EMPLOYEE':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className='flex h-full flex-col bg-background dark:bg-gray-900'>
      {/* Header */}
      <header className='border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800'>
        <div className='flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4'>
          {/* Logo and Brand */}
          <div className='flex items-center space-x-3 sm:space-x-4'>
            <h1 className='text-xl font-bold text-gray-900 dark:text-white sm:text-2xl'>
              The Elites POS
            </h1>
            <span className='hidden text-sm text-gray-500 dark:text-gray-400 sm:inline'>
              POS System
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className='hidden items-center space-x-2 lg:flex'>
            {navigationItems
              .filter(item => item.show)
              .map(item => {
                const IconComponent = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActivePage(item.href) ? 'default' : 'ghost'}
                      size='sm'
                      className='flex items-center space-x-2'
                    >
                      <IconComponent className='h-4 w-4' />
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
          </nav>

          {/* Right side controls */}
          <div className='flex items-center space-x-2 sm:space-x-4'>
            {/* User info - hidden on mobile */}
            <div className='hidden items-center space-x-2 md:flex'>
              <User className='h-4 w-4 text-gray-500 dark:text-gray-400' />
              <span className='text-sm font-medium text-gray-900 dark:text-white'>
                {user?.name}
              </span>
              <Badge
                variant='outline'
                className={`text-xs ${getRoleColor(user?.role || '')}`}
              >
                {user?.role}
              </Badge>
            </div>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Settings - hidden on mobile */}
            <Link href='/settings'>
              <Button variant='ghost' size='sm' className='hidden sm:flex'>
                <Settings className='h-4 w-4' />
              </Button>
            </Link>

            {/* Logout - hidden on mobile */}
            <Button
              variant='ghost'
              size='sm'
              onClick={handleLogout}
              className='hidden sm:flex'
            >
              <LogOut className='h-4 w-4' />
            </Button>

            {/* Mobile menu trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant='ghost' size='sm' className='lg:hidden'>
                  <Menu className='h-5 w-5' />
                </Button>
              </SheetTrigger>
              <SheetContent side='right' className='w-72'>
                <SheetHeader>
                  <SheetTitle className='flex items-center space-x-2'>
                    <User className='h-5 w-5' />
                    <span>{user?.name}</span>
                  </SheetTitle>
                  <Badge
                    variant='outline'
                    className={`w-fit text-xs ${getRoleColor(
                      user?.role || ''
                    )}`}
                  >
                    {user?.role}
                  </Badge>
                </SheetHeader>

                <div className='mt-6 space-y-4'>
                  {/* Mobile Navigation */}
                  <div className='space-y-2'>
                    <h3 className='text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                      Navigation
                    </h3>
                    {navigationItems
                      .filter(item => item.show)
                      .map(item => {
                        const IconComponent = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Button
                              variant={
                                isActivePage(item.href) ? 'default' : 'ghost'
                              }
                              size='sm'
                              className='w-full justify-start space-x-3'
                            >
                              <IconComponent className='h-4 w-4' />
                              <span>{item.label}</span>
                            </Button>
                          </Link>
                        );
                      })}
                  </div>

                  {/* Mobile Actions */}
                  <div className='space-y-2 border-t pt-4'>
                    <h3 className='text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                      Actions
                    </h3>
                    <Link
                      href='/settings'
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button
                        variant='ghost'
                        size='sm'
                        className='w-full justify-start space-x-3'
                      >
                        <Settings className='h-4 w-4' />
                        <span>Settings</span>
                      </Button>
                    </Link>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={handleLogout}
                      className='w-full justify-start space-x-3 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950'
                    >
                      <LogOut className='h-4 w-4' />
                      <span>Logout</span>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Low stock warning */}
      <div className='px-4 sm:px-6'>
        <LowStockWarning />
      </div>

      {/* Main content */}
      <main className='flex-1 overflow-hidden bg-background dark:bg-gray-900'>
        {children}
      </main>
    </div>
  );
};

export default POSLayout;