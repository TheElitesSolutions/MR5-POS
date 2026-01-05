'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Download, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
export default function DatabaseSettings() {
    const { user } = useAuthStore();
    const [showClearDialog, setShowClearDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [password, setPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const handleClearDatabase = async () => {
        if (!window.electronAPI?.ipc || !user) {
            return;
        }
        setIsProcessing(true);
        setError('');
        try {
            // First verify password
            const verifyResponse = await window.electronAPI.ipc.invoke('mr5pos:db:verify-password', user.username, password);
            if (!verifyResponse.success || !verifyResponse.data.valid) {
                setError('Invalid password');
                setIsProcessing(false);
                return;
            }
            // Password valid, proceed with clear
            const response = await window.electronAPI.ipc.invoke('mr5pos:db:clear', user.username);
            if (response.success) {
                const counts = response.data.deletedCounts;
                alert(`✅ Database cleared successfully!\n\n` +
                    `Deleted:\n` +
                    `- ${counts.orders} orders\n` +
                    `- ${counts.orderItems} order items\n` +
                    `- ${counts.customers} customers\n` +
                    `- ${counts.menuItems} menu items\n` +
                    `- ${counts.categories} categories\n` +
                    `- ${counts.addons} add-ons\n` +
                    `- ${counts.inventory} inventory items\n` +
                    `- ${counts.expenses} expenses\n` +
                    `- ${counts.tables} tables\n` +
                    `- ${counts.users} users\n\n` +
                    `Admin user '${user.username}' was preserved.`);
                setShowClearDialog(false);
                setPassword('');
            }
            else {
                setError(response.error || 'Failed to clear database');
            }
        }
        catch (error) {
            setError(error.message || 'An error occurred');
            console.error('Clear database error:', error);
        }
        finally {
            setIsProcessing(false);
        }
    };
    const handleImportFromSupabase = async () => {
        if (!window.electronAPI?.ipc || !user) {
            return;
        }
        setIsProcessing(true);
        setError('');
        try {
            // First verify password
            const verifyResponse = await window.electronAPI.ipc.invoke('mr5pos:db:verify-password', user.username, password);
            if (!verifyResponse.success || !verifyResponse.data.valid) {
                setError('Invalid password');
                setIsProcessing(false);
                return;
            }
            // Password valid, proceed with import
            const response = await window.electronAPI.ipc.invoke('mr5pos:db:import-from-supabase');
            if (response.success) {
                const counts = response.data.importedCounts;
                alert(`✅ Data imported successfully from Supabase!\n\n` +
                    `Imported:\n` +
                    `- ${counts.categories} categories\n` +
                    `- ${counts.items} menu items\n` +
                    `- ${counts.addons} add-ons\n` +
                    `- ${counts.assignments} addon-category assignments`);
                setShowImportDialog(false);
                setPassword('');
            }
            else {
                setError(response.error || 'Failed to import from Supabase');
            }
        }
        catch (error) {
            setError(error.message || 'An error occurred');
            console.error('Import from Supabase error:', error);
        }
        finally {
            setIsProcessing(false);
        }
    };
    const resetDialog = () => {
        setPassword('');
        setError('');
        setIsProcessing(false);
    };
    return (<div className='space-y-6'>
      {/* Warning Banner */}
      <div className='flex items-start space-x-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950'>
        <AlertCircle className='h-5 w-5 text-amber-600 dark:text-amber-400'/>
        <div className='flex-1'>
          <h3 className='font-semibold text-amber-900 dark:text-amber-100'>
            Danger Zone
          </h3>
          <p className='text-sm text-amber-800 dark:text-amber-200'>
            These operations are irreversible and require admin password
            confirmation. Use with extreme caution.
          </p>
        </div>
      </div>

      {/* Database Operations */}
      <div className='space-y-4'>
        {/* Clear Database */}
        <div className='flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700'>
          <div className='flex-1'>
            <div className='flex items-center space-x-2'>
              <Trash2 className='h-5 w-5 text-red-600'/>
              <h4 className='font-semibold text-gray-900 dark:text-white'>
                Clear Database
              </h4>
            </div>
            <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
              Delete all data except the admin user. Orders, menu items,
              inventory, and all other data will be permanently removed.
            </p>
          </div>
          <Button variant='destructive' onClick={() => {
            resetDialog();
            setShowClearDialog(true);
        }} className='ml-4'>
            <Trash2 className='mr-2 h-4 w-4'/>
            Clear Database
          </Button>
        </div>

        {/* Import from Supabase */}
        <div className='flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700'>
          <div className='flex-1'>
            <div className='flex items-center space-x-2'>
              <Download className='h-5 w-5 text-blue-600'/>
              <h4 className='font-semibold text-gray-900 dark:text-white'>
                Import from Supabase
              </h4>
            </div>
            <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
              Replace all menu data (categories, items, add-ons) with data from
              Supabase. Existing menu data will be deleted first.
            </p>
          </div>
          <Button variant='default' onClick={() => {
            resetDialog();
            setShowImportDialog(true);
        }} className='ml-4'>
            <Download className='mr-2 h-4 w-4'/>
            Import Data
          </Button>
        </div>
      </div>

      {/* Clear Database Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className='flex items-center space-x-2 text-red-600'>
              <Trash2 className='h-5 w-5'/>
              <span>Clear Database</span>
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All data will be permanently
              deleted except your admin account.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950'>
              <p className='text-sm font-semibold text-red-900 dark:text-red-100'>
                ⚠️ This will delete:
              </p>
              <ul className='mt-2 space-y-1 text-sm text-red-800 dark:text-red-200'>
                <li>• All orders and sales history</li>
                <li>• All customers</li>
                <li>• All menu items, categories, and add-ons</li>
                <li>• All inventory and expenses</li>
                <li>• All tables</li>
                <li>• All users except '{user?.username}'</li>
              </ul>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='clear-password'>
                Enter your password to confirm
              </Label>
              <Input id='clear-password' type='password' placeholder='Enter admin password' value={password} onChange={e => setPassword(e.target.value)} disabled={isProcessing}/>
              {error && (<p className='text-sm text-red-600 dark:text-red-400'>
                  {error}
                </p>)}
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => {
            setShowClearDialog(false);
            resetDialog();
        }} disabled={isProcessing}>
              Cancel
            </Button>
            <Button variant='destructive' onClick={handleClearDatabase} disabled={isProcessing || !password}>
              {isProcessing ? 'Clearing...' : 'Yes, Clear Database'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import from Supabase Confirmation Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className='flex items-center space-x-2 text-blue-600'>
              <Download className='h-5 w-5'/>
              <span>Import from Supabase</span>
            </DialogTitle>
            <DialogDescription>
              This will replace all existing menu data with data from Supabase.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950'>
              <p className='text-sm font-semibold text-blue-900 dark:text-blue-100'>
                ℹ️ This will:
              </p>
              <ul className='mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200'>
                <li>• Delete all existing categories, menu items, and add-ons</li>
                <li>• Import categories from Supabase</li>
                <li>• Import menu items from Supabase</li>
                <li>• Import add-ons with category assignments</li>
                <li>• Preserve orders, customers, and other data</li>
              </ul>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='import-password'>
                Enter your password to confirm
              </Label>
              <Input id='import-password' type='password' placeholder='Enter admin password' value={password} onChange={e => setPassword(e.target.value)} disabled={isProcessing}/>
              {error && (<p className='text-sm text-red-600 dark:text-red-400'>
                  {error}
                </p>)}
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => {
            setShowImportDialog(false);
            resetDialog();
        }} disabled={isProcessing}>
              Cancel
            </Button>
            <Button variant='default' onClick={handleImportFromSupabase} disabled={isProcessing || !password}>
              {isProcessing ? 'Importing...' : 'Yes, Import Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
