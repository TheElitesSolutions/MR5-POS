'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, Download, RefreshCw, X } from 'lucide-react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
  updateInfo: UpdateInfo | null;
  progress: { percent: number } | null;
  isDev: boolean;
}

/**
 * UpdateNotification Component
 * Displays auto-update notifications and progress
 */
export function UpdateNotification() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    // Only run in Electron environment
    if (typeof window === 'undefined' || !window.electronAPI?.updater) {
      return;
    }

    const { updater } = window.electronAPI;

    // Get initial status
    updater.getStatus().then((response: any) => {
      if (response?.success && response?.data) {
        setStatus(response.data);
      }
    });

    // Listen for update events
    const unsubscribeChecking = updater.onUpdateChecking(() => {
      setVisible(true);
      setStatus(prev => (prev ? { ...prev, checking: true } : null));
    });

    const unsubscribeAvailable = updater.onUpdateAvailable((info: UpdateInfo) => {
      setVisible(true);
      setStatus(prev =>
        prev
          ? {
              ...prev,
              checking: false,
              available: true,
              updateInfo: info,
            }
          : null
      );
    });

    const unsubscribeNotAvailable = updater.onUpdateNotAvailable(() => {
      setVisible(false);
      setStatus(prev =>
        prev
          ? {
              ...prev,
              checking: false,
              available: false,
            }
          : null
      );
    });

    const unsubscribeProgress = updater.onDownloadProgress((progressInfo: { percent: number }) => {
      setVisible(true);
      setProgress(Math.round(progressInfo.percent));
      setStatus(prev =>
        prev
          ? {
              ...prev,
              downloading: true,
              progress: progressInfo,
            }
          : null
      );
    });

    const unsubscribeDownloaded = updater.onUpdateDownloaded((info: UpdateInfo) => {
      setVisible(true);
      setStatus(prev =>
        prev
          ? {
              ...prev,
              downloading: false,
              downloaded: true,
              updateInfo: info,
            }
          : null
      );
    });

    const unsubscribeError = updater.onUpdateError((error: { message: string }) => {
      setVisible(true);
      setStatus(prev =>
        prev
          ? {
              ...prev,
              checking: false,
              downloading: false,
              error: error.message,
            }
          : null
      );
    });

    // Cleanup listeners on unmount
    return () => {
      if (unsubscribeChecking) unsubscribeChecking();
      if (unsubscribeAvailable) unsubscribeAvailable();
      if (unsubscribeNotAvailable) unsubscribeNotAvailable();
      if (unsubscribeProgress) unsubscribeProgress();
      if (unsubscribeDownloaded) unsubscribeDownloaded();
      if (unsubscribeError) unsubscribeError();
    };
  }, []);

  const handleDownload = async () => {
    if (window.electronAPI?.updater) {
      await window.electronAPI.updater.downloadUpdate();
    }
  };

  const handleInstall = async () => {
    if (window.electronAPI?.updater) {
      await window.electronAPI.updater.installUpdate();
    }
  };

  const handleSkip = async () => {
    if (window.electronAPI?.updater && status?.updateInfo?.version) {
      await window.electronAPI.updater.skipVersion(status.updateInfo.version);
      setVisible(false);
    }
  };

  const handleClose = () => {
    setVisible(false);
  };

  // Don't show anything if not visible or in dev mode
  if (!visible || !status || status.isDev) {
    return null;
  }

  return (
    <div className='fixed bottom-4 right-4 z-50 w-96'>
      <div className='rounded-lg border border-gray-200 bg-white p-4 shadow-lg'>
        {/* Header */}
        <div className='mb-3 flex items-start justify-between'>
          <div className='flex items-center gap-2'>
            {status.checking && (
              <RefreshCw className='h-5 w-5 animate-spin text-blue-500' />
            )}
            {status.error && <AlertCircle className='h-5 w-5 text-red-500' />}
            {(status.available || status.downloading || status.downloaded) && (
              <Download className='h-5 w-5 text-green-500' />
            )}
            <h3 className='font-semibold text-gray-900 dark:text-white'>
              New Update Available!
            </h3>
          </div>
          <button
            onClick={handleClose}
            className='text-gray-400 hover:text-gray-600'
            aria-label='Close'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        {/* Content */}
        <div className='mb-3 text-sm text-gray-600'>
          {status.checking && <p>Looking for the latest version...</p>}

          {status.available && !status.downloading && !status.downloaded && (
            <div>
              <p className='mb-1'>
                Version {status.updateInfo?.version} is available.
              </p>
              {status.updateInfo?.releaseNotes && (
                <p className='text-xs text-gray-500'>
                  {status.updateInfo.releaseNotes.substring(0, 100)}...
                </p>
              )}
            </div>
          )}

          {status.downloading && (
            <div>
              <p className='mb-2'>Downloading update...</p>
              <div className='h-2 w-full overflow-hidden rounded-full bg-gray-200'>
                <div
                  className='h-full bg-blue-500 transition-all duration-300'
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className='mt-1 text-xs text-gray-500'>{progress}%</p>
            </div>
          )}

          {status.downloaded && (
            <p>
              Update to version {status.updateInfo?.version} has been downloaded
              and is ready to install.
            </p>
          )}

          {status.error && <p className='text-red-600'>{status.error}</p>}
        </div>

        {/* Actions */}
        <div className='flex gap-2'>
          {status.available && !status.downloading && !status.downloaded && (
            <>
              <button
                onClick={handleDownload}
                className='flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              >
                Download
              </button>
              <button
                onClick={handleSkip}
                className='rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              >
                Skip
              </button>
            </>
          )}

          {status.downloaded && (
            <>
              <button
                onClick={handleInstall}
                className='flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
              >
                Restart & Install
              </button>
              <button
                onClick={handleClose}
                className='rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
              >
                Later
              </button>
            </>
          )}

          {status.error && (
            <button
              onClick={handleClose}
              className='w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default UpdateNotification;