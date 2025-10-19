'use client';

import POSLayout from '@/components/pos/POSLayout';
import PrinterSettings from '@/components/settings/PrinterSettings';
import UserProfileSettings from '@/components/settings/UserProfileSettings';
import DatabaseSettings from '@/components/settings/DatabaseSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Role } from '@/types';
import { Database, Printer, Settings as SettingsIcon, User } from 'lucide-react';
import { useState } from 'react';

function SettingsContent() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <POSLayout>
      <div className='mx-auto max-w-4xl space-y-4 p-3 sm:space-y-6 sm:p-4 lg:p-6'>
        {/* Header */}
        <div className='space-y-1'>
          <div className='flex items-center space-x-3'>
            <SettingsIcon className='h-8 w-8 text-blue-600' />
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl'>
              Settings
            </h1>
          </div>
          <p className='text-sm text-gray-600 dark:text-gray-400 sm:text-base'>
            Manage your account settings and printer configurations
          </p>
        </div>

        {/* Settings Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className='space-y-6'
        >
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger
              value='profile'
              className='flex items-center space-x-2'
            >
              <User className='h-4 w-4' />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger
              value='printers'
              className='flex items-center space-x-2'
            >
              <Printer className='h-4 w-4' />
              <span>Printers</span>
            </TabsTrigger>
            <TabsTrigger
              value='database'
              className='flex items-center space-x-2'
            >
              <Database className='h-4 w-4' />
              <span>Database</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value='profile'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center space-x-2'>
                  <User className='h-5 w-5' />
                  <span>User Profile</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UserProfileSettings />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='printers'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center space-x-2'>
                  <Printer className='h-5 w-5' />
                  <span>Printer Configuration</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PrinterSettings />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='database'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center space-x-2'>
                  <Database className='h-5 w-5' />
                  <span>Database Management</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DatabaseSettings />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </POSLayout>
  );
}

export default function SettingsPage() {
  // ProtectedRoute is already applied in the (auth) layout
  return <SettingsContent />;
}
