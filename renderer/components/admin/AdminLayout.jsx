'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Settings, Package, Tag, Link, BarChart3, Menu, Home, ChevronRight, Bell, User, HelpCircle, } from 'lucide-react';
const navigationItems = [
    {
        id: 'overview',
        title: 'Overview',
        description: 'Dashboard and system overview',
        icon: Home,
    },
    {
        id: 'groups',
        title: 'Add-On Groups',
        description: 'Manage add-on group configurations',
        icon: Package,
        badge: 'Groups',
    },
    {
        id: 'addons',
        title: 'Individual Add-Ons',
        description: 'Manage individual add-on items',
        icon: Tag,
        badge: 'Items',
    },
    {
        id: 'assignments',
        title: 'Category Assignments',
        description: 'Assign add-on groups to categories',
        icon: Link,
        badge: 'Links',
    },
    {
        id: 'analytics',
        title: 'Analytics & Reports',
        description: 'Performance insights and reports',
        icon: BarChart3,
        badge: 'Data',
    },
];
export function AdminLayout({ children, currentPage = 'overview', onNavigate, }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const handleNavigation = (pageId) => {
        setIsMobileMenuOpen(false);
        onNavigate?.(pageId);
    };
    const renderNavigation = (isMobile = false) => (<nav className='space-y-2'>
      {/* Overview */}
      <div className='pb-2'>
        <Button variant={currentPage === 'overview' ? 'default' : 'ghost'} className={cn('h-auto w-full justify-start p-3', isMobile && 'text-left')} onClick={() => handleNavigation('overview')}>
          <div className='flex w-full items-center gap-3'>
            <Home className='h-4 w-4 flex-shrink-0'/>
            <div className='flex-1 text-left'>
              <div className='font-medium'>Dashboard</div>
              <div className='text-xs text-muted-foreground'>
                System overview and quick actions
              </div>
            </div>
            {currentPage === 'overview' && (<ChevronRight className='h-4 w-4 flex-shrink-0'/>)}
          </div>
        </Button>
      </div>

      <Separator />

      {/* Add-On Management Section */}
      <div className='py-2'>
        <div className='px-3 py-2'>
          <div className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
            Add-On Management
          </div>
        </div>
        <div className='space-y-1'>
          {navigationItems
            .filter(item => ['groups', 'addons', 'assignments'].includes(item.id))
            .map(item => (<Button key={item.id} variant={currentPage === item.id ? 'default' : 'ghost'} className={cn('h-auto w-full justify-start p-3', isMobile && 'text-left')} onClick={() => handleNavigation(item.id)}>
                <div className='flex w-full items-center gap-3'>
                  <item.icon className='h-4 w-4 flex-shrink-0'/>
                  <div className='flex-1 text-left'>
                    <div className='font-medium'>{item.title}</div>
                    <div className='text-xs text-muted-foreground'>
                      {item.description}
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {item.badge && (<Badge variant='outline' className='text-xs'>
                        {item.badge}
                      </Badge>)}
                    {currentPage === item.id && (<ChevronRight className='h-4 w-4 flex-shrink-0'/>)}
                  </div>
                </div>
              </Button>))}
        </div>
      </div>

      <Separator />

      {/* Analytics Section */}
      <div className='py-2'>
        <div className='px-3 py-2'>
          <div className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
            Insights & Reports
          </div>
        </div>
        <div className='space-y-1'>
          {navigationItems
            .filter(item => item.id === 'analytics')
            .map(item => (<Button key={item.id} variant={currentPage === item.id ? 'default' : 'ghost'} className={cn('h-auto w-full justify-start p-3', isMobile && 'text-left')} onClick={() => handleNavigation(item.id)}>
                <div className='flex w-full items-center gap-3'>
                  <item.icon className='h-4 w-4 flex-shrink-0'/>
                  <div className='flex-1 text-left'>
                    <div className='font-medium'>{item.title}</div>
                    <div className='text-xs text-muted-foreground'>
                      {item.description}
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {item.badge && (<Badge variant='outline' className='text-xs'>
                        {item.badge}
                      </Badge>)}
                    {currentPage === item.id && (<ChevronRight className='h-4 w-4 flex-shrink-0'/>)}
                  </div>
                </div>
              </Button>))}
        </div>
      </div>

      <Separator />

      {/* System Section */}
      <div className='py-2'>
        <div className='px-3 py-2'>
          <div className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
            System
          </div>
        </div>
        <div className='space-y-1'>
          <Button variant='ghost' className='h-auto w-full justify-start p-3' disabled>
            <div className='flex w-full items-center gap-3'>
              <Settings className='h-4 w-4 flex-shrink-0'/>
              <div className='flex-1 text-left'>
                <div className='font-medium'>Settings</div>
                <div className='text-xs text-muted-foreground'>
                  System configuration
                </div>
              </div>
              <Badge variant='secondary' className='text-xs'>
                Soon
              </Badge>
            </div>
          </Button>

          <Button variant='ghost' className='h-auto w-full justify-start p-3' disabled>
            <div className='flex w-full items-center gap-3'>
              <HelpCircle className='h-4 w-4 flex-shrink-0'/>
              <div className='flex-1 text-left'>
                <div className='font-medium'>Help & Support</div>
                <div className='text-xs text-muted-foreground'>
                  Documentation and support
                </div>
              </div>
            </div>
          </Button>
        </div>
      </div>
    </nav>);
    const getCurrentPageTitle = () => {
        const item = navigationItems.find(item => item.id === currentPage);
        return item ? item.title : 'Dashboard';
    };
    const getCurrentPageDescription = () => {
        const item = navigationItems.find(item => item.id === currentPage);
        return item ? item.description : 'System overview and quick actions';
    };
    return (<div className='flex h-screen bg-background'>
      {/* Desktop Sidebar */}
      <aside className='hidden lg:flex lg:w-80 lg:flex-col lg:border-r lg:bg-muted/30'>
        <div className='flex items-center gap-3 border-b p-6'>
          <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
            <Package className='h-4 w-4'/>
          </div>
          <div>
            <div className='font-semibold'>Add-On Management</div>
            <div className='text-xs text-muted-foreground'>Admin Panel</div>
          </div>
        </div>
        <ScrollArea className='flex-1 p-4'>{renderNavigation()}</ScrollArea>

        {/* User Profile Section */}
        <div className='border-t p-4'>
          <Card className='border-0 bg-muted/50 shadow-none'>
            <CardContent className='p-3'>
              <div className='flex items-center gap-3'>
                <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground'>
                  A
                </div>
                <div className='flex-1'>
                  <div className='text-sm font-medium'>Admin User</div>
                  <div className='text-xs text-muted-foreground'>
                    System Administrator
                  </div>
                </div>
                <Button variant='ghost' size='icon' className='h-8 w-8'>
                  <Settings className='h-3 w-3'/>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </aside>

      {/* Main Content */}
      <div className='flex flex-1 flex-col overflow-hidden'>
        {/* Header */}
        <header className='flex items-center gap-4 border-b bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:p-6'>
          {/* Mobile Menu */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant='ghost' size='icon' className='lg:hidden'>
                <Menu className='h-4 w-4'/>
              </Button>
            </SheetTrigger>
            <SheetContent side='left' className='w-80 p-0'>
              <div className='flex items-center gap-3 border-b p-6'>
                <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
                  <Package className='h-4 w-4'/>
                </div>
                <div>
                  <div className='font-semibold'>Add-On Management</div>
                  <div className='text-xs text-muted-foreground'>
                    Admin Panel
                  </div>
                </div>
              </div>
              <ScrollArea className='flex-1 p-4'>
                {renderNavigation(true)}
              </ScrollArea>
            </SheetContent>
          </Sheet>

          {/* Breadcrumb */}
          <div className='flex flex-1 items-center gap-2'>
            <Button variant='ghost' size='sm' className='gap-1 text-muted-foreground' onClick={() => handleNavigation('overview')}>
              <Home className='h-3 w-3'/>
              Admin
            </Button>
            <ChevronRight className='h-3 w-3 text-muted-foreground'/>
            <span className='font-medium'>{getCurrentPageTitle()}</span>
          </div>

          {/* Header Actions */}
          <div className='flex items-center gap-2'>
            <Button variant='ghost' size='icon'>
              <Bell className='h-4 w-4'/>
            </Button>
            <Button variant='ghost' size='icon'>
              <User className='h-4 w-4'/>
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className='flex-1 overflow-auto'>
          <div className='p-4 lg:p-6'>{children}</div>
        </main>
      </div>
    </div>);
}
// Admin Overview Component
export function AdminOverview({ onNavigate, }) {
    // Mock statistics
    const stats = {
        totalGroups: 4,
        totalAddons: 23,
        totalAssignments: 7,
        totalRevenue: 12567.5,
        activeGroups: 3,
        activeAddons: 20,
        activeAssignments: 6,
        recentActivity: [
            { type: 'create', item: 'Pizza Toppings Group', time: '2 hours ago' },
            { type: 'edit', item: 'Extra Cheese Add-on', time: '4 hours ago' },
            { type: 'assign', item: 'Beverages → Drink Sizes', time: '1 day ago' },
        ],
    };
    const quickActions = [
        {
            title: 'Create Add-On Group',
            description: 'Set up a new group for organizing add-ons',
            icon: Package,
            action: () => onNavigate?.('groups'),
            color: 'bg-blue-500',
        },
        {
            title: 'Add Individual Add-On',
            description: 'Create a new add-on item for customers',
            icon: Tag,
            action: () => onNavigate?.('addons'),
            color: 'bg-green-500',
        },
        {
            title: 'Assign to Category',
            description: 'Link add-on groups to menu categories',
            icon: Link,
            action: () => onNavigate?.('assignments'),
            color: 'bg-purple-500',
        },
        {
            title: 'View Analytics',
            description: 'Check performance and revenue insights',
            icon: BarChart3,
            action: () => onNavigate?.('analytics'),
            color: 'bg-orange-500',
        },
    ];
    return (<div className='space-y-6'>
      {/* Welcome Section */}
      <div>
        <h1 className='text-3xl font-bold'>Add-On Management Dashboard</h1>
        <p className='text-muted-foreground'>
          Manage your restaurant's add-on system from one central location
        </p>
      </div>

      {/* Statistics Cards */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Add-On Groups</CardTitle>
            <Package className='h-4 w-4 text-muted-foreground'/>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.totalGroups}</div>
            <p className='text-xs text-muted-foreground'>
              {stats.activeGroups} active groups
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Individual Add-Ons
            </CardTitle>
            <Tag className='h-4 w-4 text-muted-foreground'/>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.totalAddons}</div>
            <p className='text-xs text-muted-foreground'>
              {stats.activeAddons} active items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Category Assignments
            </CardTitle>
            <Link className='h-4 w-4 text-muted-foreground'/>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.totalAssignments}</div>
            <p className='text-xs text-muted-foreground'>
              {stats.activeAssignments} active assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Revenue Generated
            </CardTitle>
            <BarChart3 className='h-4 w-4 text-muted-foreground'/>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              ${stats.totalRevenue.toFixed(2)}
            </div>
            <p className='text-xs text-muted-foreground'>
              From add-on selections
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Jump to common tasks and management functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
            {quickActions.map((action, index) => (<Card key={index} className='cursor-pointer border-2 transition-shadow hover:border-primary/20 hover:shadow-md' onClick={action.action}>
                <CardContent className='p-4'>
                  <div className='space-y-3'>
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg text-white', action.color)}>
                      <action.icon className='h-5 w-5'/>
                    </div>
                    <div>
                      <div className='font-semibold'>{action.title}</div>
                      <div className='text-sm text-muted-foreground'>
                        {action.description}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest changes and updates to your add-on system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {stats.recentActivity.map((activity, index) => (<div key={index} className='flex items-center gap-3 rounded-lg bg-muted/30 p-3'>
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-sm text-white', activity.type === 'create'
                ? 'bg-green-500'
                : activity.type === 'edit'
                    ? 'bg-blue-500'
                    : 'bg-purple-500')}>
                  {activity.type === 'create'
                ? '+'
                : activity.type === 'edit'
                    ? '✎'
                    : '→'}
                </div>
                <div className='flex-1'>
                  <div className='font-medium'>{activity.item}</div>
                  <div className='text-sm text-muted-foreground'>
                    {activity.time}
                  </div>
                </div>
                <Badge variant='outline' className='text-xs'>
                  {activity.type}
                </Badge>
              </div>))}
          </div>
        </CardContent>
      </Card>
    </div>);
}
