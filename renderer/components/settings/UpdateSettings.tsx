'use client';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useUpdater } from '@/hooks/useUpdater';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  RotateCw,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function UpdateSettings() {
  const { toast } = useToast();
  const {
    status,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    cancelUpdate,
    skipVersion,
  } = useUpdater();

  const [appVersion, setAppVersion] = useState<string>('Loading...');

  // Get app version from Electron main process
  useEffect(() => {
    const fetchVersion = async () => {
      if (typeof window !== 'undefined' && (window as any).electron) {
        try {
          const systemInfo = await (window as any).electron.ipcRenderer.invoke('mr5pos:system:get-info');
          if (systemInfo && systemInfo.appVersion) {
            setAppVersion(systemInfo.appVersion);
          } else {
            setAppVersion('2.3.0'); // Fallback version
          }
        } catch (error) {
          console.error('Failed to fetch app version:', error);
          setAppVersion('2.3.0'); // Fallback version
        }
      } else {
        setAppVersion('2.3.0'); // Development fallback
      }
    };

    fetchVersion();
  }, []);

  const handleCheckForUpdates = async () => {
    const result = await checkForUpdates();
    if (result && result.success) {
      if (!status.available) {
        toast({
          title: 'No updates available',
          description: 'You are running the latest version.',
        });
      }
    } else {
      toast({
        title: 'Update check failed',
        description: result?.error || 'Failed to check for updates',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadUpdate = async () => {
    const result = await downloadUpdate();
    if (result && result.success) {
      toast({
        title: 'Download started',
        description: 'Downloading update... A backup will be created automatically.',
      });
    } else {
      toast({
        title: 'Download failed',
        description: result?.error || 'Failed to start download',
        variant: 'destructive',
      });
    }
  };

  const handleInstallUpdate = async () => {
    const result = await installUpdate();
    if (!result || !result.success) {
      toast({
        title: 'Installation failed',
        description: result?.error || 'Failed to install update',
        variant: 'destructive',
      });
    }
    // If successful, app will restart automatically
  };

  const handleCancelUpdate = async () => {
    const result = await cancelUpdate();
    if (result && result.success) {
      toast({
        title: 'Update cancelled',
        description: 'The update has been cancelled.',
      });
    } else {
      toast({
        title: 'Cancellation failed',
        description: result?.error || 'Failed to cancel update',
        variant: 'destructive',
      });
    }
  };

  const handleSkipVersion = async () => {
    if (!status.updateInfo?.version) return;

    const result = await skipVersion(status.updateInfo.version);
    if (result && result.success) {
      toast({
        title: 'Version skipped',
        description: `Version ${status.updateInfo.version} will be ignored.`,
      });
    } else {
      toast({
        title: 'Skip failed',
        description: result?.error || 'Failed to skip version',
        variant: 'destructive',
      });
    }
  };

  // Format bytes to human-readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Format speed
  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  if (status.isDev) {
    return (
      <div className='space-y-4'>
        <div className='rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
          <div className='flex items-start space-x-3'>
            <AlertCircle className='h-5 w-5 text-yellow-600' />
            <div>
              <h3 className='font-medium text-yellow-900'>Development Mode</h3>
              <p className='text-sm text-yellow-700'>
                Auto-update is disabled in development mode.
              </p>
            </div>
          </div>
        </div>
        <div className='text-sm text-gray-600'>
          <p>Current Version: {appVersion}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Current Version */}
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='font-medium text-gray-900 dark:text-white'>Current Version</h3>
          <p className='text-sm text-gray-600'>{appVersion}</p>
        </div>
        <Button
          onClick={handleCheckForUpdates}
          disabled={status.checking || status.downloading}
          variant='outline'
          size='sm'
        >
          {status.checking ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className='mr-2 h-4 w-4' />
              Check for Updates
            </>
          )}
        </Button>
      </div>

      {/* Error Message */}
      {status.error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <div className='flex items-start space-x-3'>
            <AlertCircle className='h-5 w-5 text-red-600' />
            <div className='flex-1'>
              <h3 className='font-medium text-red-900'>Update Error</h3>
              <p className='text-sm text-red-700'>{status.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Update Available */}
      {status.available && !status.downloaded && (
        <div className='rounded-lg border border-blue-200 bg-blue-50 p-4'>
          <div className='flex items-start space-x-3'>
            <Download className='h-5 w-5 text-blue-600' />
            <div className='flex-1'>
              <h3 className='font-medium text-blue-900'>Update Available</h3>
              <p className='text-sm text-blue-700'>
                Version {status.updateInfo?.version} is available for download.
              </p>
              {status.updateInfo?.releaseNotes && (
                <p className='mt-2 text-sm text-blue-700'>
                  {status.updateInfo.releaseNotes}
                </p>
              )}
              <div className='mt-4 flex items-center space-x-3'>
                <Button onClick={handleDownloadUpdate} size='sm' disabled={status.downloading}>
                  {status.downloading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className='mr-2 h-4 w-4' />
                      Download Update
                    </>
                  )}
                </Button>
                <Button onClick={handleSkipVersion} variant='ghost' size='sm'>
                  <X className='mr-2 h-4 w-4' />
                  Skip This Version
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Download Progress */}
      {status.downloading && status.progress && (
        <div className='space-y-3'>
          <div className='flex items-center justify-between text-sm'>
            <span className='font-medium text-gray-900 dark:text-white'>Downloading Update...</span>
            <span className='text-gray-600'>{Math.round(status.progress.percent)}%</span>
          </div>
          <Progress value={status.progress.percent} className='h-2' />
          <div className='flex items-center justify-between text-xs text-gray-600'>
            <span>
              {formatBytes(status.progress.transferred)} of {formatBytes(status.progress.total)}
            </span>
            <span>{formatSpeed(status.progress.bytesPerSecond)}</span>
          </div>
          <Button onClick={handleCancelUpdate} variant='outline' size='sm'>
            <X className='mr-2 h-4 w-4' />
            Cancel Download
          </Button>
        </div>
      )}

      {/* Update Downloaded */}
      {status.downloaded && (
        <div className='rounded-lg border border-green-200 bg-green-50 p-4'>
          <div className='flex items-start space-x-3'>
            <CheckCircle2 className='h-5 w-5 text-green-600' />
            <div className='flex-1'>
              <h3 className='font-medium text-green-900'>Update Ready to Install</h3>
              <p className='text-sm text-green-700'>
                Version {status.updateInfo?.version} has been downloaded and is ready to install.
              </p>
              <p className='mt-2 text-sm text-green-700'>
                The application will restart to complete the installation.
              </p>
              <div className='mt-4'>
                <Button onClick={handleInstallUpdate} size='sm'>
                  <RotateCw className='mr-2 h-4 w-4' />
                  Install and Restart
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Updates */}
      {!status.checking &&
        !status.available &&
        !status.downloading &&
        !status.downloaded &&
        !status.error && (
          <div className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
            <div className='flex items-start space-x-3'>
              <CheckCircle2 className='h-5 w-5 text-gray-600' />
              <div>
                <h3 className='font-medium text-gray-900 dark:text-white'>Up to Date</h3>
                <p className='text-sm text-gray-600'>
                  You are running the latest version of MR5 POS.
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Auto-Update Info */}
      <div className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
        <div className='space-y-2'>
          <h3 className='font-medium text-gray-900 dark:text-white'>Automatic Updates</h3>
          <p className='text-sm text-gray-600'>
            The application automatically checks for updates every 6 hours. When an update is
            available, you'll be notified and can choose to download and install it.
          </p>
          <p className='text-sm text-gray-600'>
            A backup is automatically created before each update for safety.
          </p>
        </div>
      </div>
    </div>
  );
}