'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Globe, Check, AlertCircle, Clock } from 'lucide-react';

/**
 * Menu Sync Settings Component
 * Allows users to sync menu data to the public Supabase website
 * and configure automatic sync intervals
 */
export function MenuSyncSettings() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState(60); // minutes
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState<
    'success' | 'error' | 'pending'
  >('pending');
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Load sync status on mount
  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    if (!window.electronAPI?.ipc) {
      return;
    }

    try {
      const response = await window.electronAPI.ipc.invoke('mr5pos:sync:status');
      if (response.success && response.data) {
        const { syncStatus, schedulerStatus, isConfigured } = response.data;
        setIsConfigured(isConfigured);
        setIsSyncing(syncStatus.isSyncing);
        setLastSyncTime(
          syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime) : null
        );
        setLastSyncStatus(syncStatus.lastSyncStatus);
        setLastSyncError(syncStatus.lastSyncError);
        setAutoSyncEnabled(schedulerStatus.isRunning);
        if (schedulerStatus.intervalMinutes) {
          setSyncInterval(schedulerStatus.intervalMinutes);
        }
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const handleManualSync = async () => {
    if (!window.electronAPI?.ipc || isSyncing) {
      return;
    }

    setIsSyncing(true);
    setMessage({ type: 'info', text: 'Syncing menu to website...' });

    try {
      const response = await window.electronAPI.ipc.invoke('mr5pos:sync:manual');
      if (response.success) {
        const { categoriesSynced, itemsSynced, addOnsSynced } = response.data;
        setMessage({
          type: 'success',
          text: `✅ Sync successful! ${categoriesSynced} categories, ${itemsSynced} items, ${addOnsSynced} add-ons synced.`,
        });
        setLastSyncStatus('success');
        setLastSyncTime(new Date());
        setLastSyncError(null);
      } else {
        setMessage({
          type: 'error',
          text: `Sync failed: ${response.error || 'Unknown error'}`,
        });
        setLastSyncStatus('error');
        setLastSyncError(response.error || 'Unknown error');
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: `Sync failed: ${error.message || 'Unknown error'}`,
      });
      setLastSyncStatus('error');
      setLastSyncError(error.message || 'Unknown error');
    } finally {
      setIsSyncing(false);
      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleToggleAutoSync = async () => {
    if (!window.electronAPI?.ipc) {
      return;
    }

    try {
      const newState = !autoSyncEnabled;
      const response = await window.electronAPI.ipc.invoke('mr5pos:sync:set-auto', newState);
      if (response.success) {
        setAutoSyncEnabled(newState);
        setMessage({
          type: 'success',
          text: `Auto-sync ${newState ? 'enabled' : 'disabled'}`,
        });
      } else {
        setMessage({
          type: 'error',
          text: `Failed to toggle auto-sync: ${response.error}`,
        });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: `Failed to toggle auto-sync: ${error.message}`,
      });
    } finally {
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleIntervalChange = async (newInterval: number) => {
    if (!window.electronAPI?.ipc || newInterval < 5 || newInterval > 1440) {
      return;
    }

    try {
      const response = await window.electronAPI.ipc.invoke('mr5pos:sync:set-interval', newInterval);
      if (response.success) {
        setSyncInterval(newInterval);
        setMessage({
          type: 'success',
          text: `Sync interval updated to ${newInterval} minutes`,
        });
      } else {
        setMessage({
          type: 'error',
          text: `Failed to update interval: ${response.error}`,
        });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: `Failed to update interval: ${error.message}`,
      });
    } finally {
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return 'Never';
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  if (!isConfigured) {
    return (
      <div className='rounded-lg border border-yellow-300 bg-yellow-50 p-6'>
        <div className='flex items-start gap-3'>
          <AlertCircle className='mt-1 h-5 w-5 text-yellow-600' />
          <div>
            <h3 className='text-lg font-semibold text-yellow-900'>
              Supabase Not Configured
            </h3>
            <p className='mt-2 text-sm text-yellow-700'>
              To enable menu syncing to your public website, you need to
              configure your Supabase credentials in the environment variables:
            </p>
            <ul className='mt-3 space-y-1 text-sm text-yellow-700'>
              <li className='font-mono'>• SUPABASE_URL=your_supabase_url</li>
              <li className='font-mono'>
                • SUPABASE_SERVICE_KEY=your_service_key
              </li>
            </ul>
            <p className='mt-3 text-xs text-yellow-600'>
              Restart the application after adding these to your .env file.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <Globe className='h-6 w-6 text-blue-600' />
          <div>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Menu Synchronization
            </h3>
            <p className='text-sm text-gray-500'>
              Sync active menu items to your public website
            </p>
          </div>
        </div>

        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
            isSyncing
              ? 'cursor-not-allowed bg-gray-400'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : message.type === 'error'
                ? 'bg-red-50 text-red-800'
                : 'bg-blue-50 text-blue-800'
          }`}
        >
          <div className='flex items-center gap-2'>
            {message.type === 'success' ? (
              <Check className='h-5 w-5' />
            ) : message.type === 'error' ? (
              <AlertCircle className='h-5 w-5' />
            ) : (
              <RefreshCw className='h-5 w-5 animate-spin' />
            )}
            <p className='text-sm font-medium'>{message.text}</p>
          </div>
        </div>
      )}

      {/* Last Sync Status */}
      <div className='space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium text-gray-700 dark:text-white'>
            Sync Status
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
              lastSyncStatus === 'success'
                ? 'bg-green-100 text-green-800'
                : lastSyncStatus === 'error'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
            }`}
          >
            {lastSyncStatus === 'success' ? (
              <>
                <Check className='h-3 w-3' /> Success
              </>
            ) : lastSyncStatus === 'error' ? (
              <>
                <AlertCircle className='h-3 w-3' /> Error
              </>
            ) : (
              'Pending'
            )}
          </span>
        </div>
        <div className='flex items-center gap-2 text-sm text-gray-600'>
          <Clock className='h-4 w-4' />
          <span>{formatLastSyncTime()}</span>
        </div>
        {lastSyncError && (
          <p className='text-xs text-red-600'>{lastSyncError}</p>
        )}
      </div>

      {/* Auto-Sync Settings */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h4 className='text-sm font-medium text-gray-900 dark:text-white'>
              Automatic Sync
            </h4>
            <p className='text-xs text-gray-500'>
              Sync menu changes automatically at set intervals
            </p>
          </div>
          <label className='relative inline-flex cursor-pointer items-center'>
            <input
              type='checkbox'
              checked={autoSyncEnabled}
              onChange={handleToggleAutoSync}
              className='peer sr-only'
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300"></div>
          </label>
        </div>

        {/* Sync Interval Selector */}
        {autoSyncEnabled && (
          <div className='space-y-2'>
            <label className='text-sm font-medium text-gray-700 dark:text-white'>
              Sync Interval
            </label>
            <select
              value={syncInterval}
              onChange={e => handleIntervalChange(Number(e.target.value))}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every hour (recommended)</option>
              <option value={120}>Every 2 hours</option>
              <option value={360}>Every 6 hours</option>
              <option value={720}>Every 12 hours</option>
              <option value={1440}>Every 24 hours</option>
            </select>
            <p className='text-xs text-gray-500'>
              More frequent syncing keeps your website up-to-date but uses more
              resources
            </p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className='rounded-lg border border-blue-200 bg-blue-50 p-4'>
        <h4 className='text-sm font-semibold text-blue-900'>How it works</h4>
        <ul className='mt-2 space-y-1 text-xs text-blue-800'>
          <li>• Only active menu items are synced to the public website</li>
          <li>
            • Changes are synced automatically when you add, edit, or delete
            items
          </li>
          <li>
            • Automatic sync runs in the background at your chosen interval
          </li>
          <li>• Your internal POS data is always the source of truth</li>
        </ul>
      </div>
    </div>
  );
}

export default MenuSyncSettings;