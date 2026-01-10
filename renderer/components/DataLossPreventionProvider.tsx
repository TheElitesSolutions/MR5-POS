'use client';

import { useEffect } from 'react';
import { usePOSStore } from '@/stores/posStore';
import { useToast } from '@/hooks/use-toast';

/**
 * 🚨 TEMPORARY DISABLE: Auto-save feature flag
 *
 * ISSUE: 60-second auto-save causes race condition with manual "Done Adding Items"
 * button, resulting in duplicate order items.
 *
 * IMPACT: Disabling auto-save prevents duplications. Manual saves (Done Adding Items
 * button) continue to work normally.
 *
 * STATUS: Disabled on 2026-01-10 pending architectural fix
 * TODO: Re-enable after implementing mutex/lock mechanism for save operations
 *
 * Related commits: 24be3f5, dce6b6f
 */
const ENABLE_AUTO_SAVE = false; // Set to true to re-enable auto-save

/**
 * DataLossPreventionProvider - Prevents order data loss on app close and tab switches
 *
 * This component:
 * 1. Saves pending order changes when the app/window is closed
 * 2. Shows warnings for unsaved changes
 * 3. Provides recovery mechanisms from localStorage backups
 * 4. Handles system sleep/resume scenarios
 *
 * ⚠️ NOTE: Periodic auto-save (60s) is TEMPORARILY DISABLED via ENABLE_AUTO_SAVE flag
 *    to prevent race condition duplications. Manual saves via "Done Adding Items"
 *    button continue to work normally.
 */
export default function DataLossPreventionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    hasUnsavedChanges,
    savePendingChanges,
    currentOrder,
    orderChanges,
    restoreFromLocalStorage,
  } = usePOSStore();
  const { toast } = useToast();

  useEffect(() => {
    // Handle app/window close - save pending changes
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && currentOrder?.id) {
        // Prevent default browser behavior
        event.preventDefault();

        try {
          console.log('🚨 APP CLOSING: Saving pending changes before exit');

          // Attempt to save pending changes with minimal retries (fast shutdown)
          const saveSuccess = await savePendingChanges(currentOrder.id, {
            silent: true,
            maxRetries: 1,
          });

          if (!saveSuccess) {
            // Show warning to user that data may be lost
            event.returnValue =
              'You have unsaved order changes. Are you sure you want to close?';
            return event.returnValue;
          }

          console.log('✅ APP CLOSING: Pending changes saved successfully');
        } catch (error) {
          console.error(
            '❌ APP CLOSING: Failed to save pending changes',
            error
          );
          event.returnValue =
            'Failed to save your order changes. Are you sure you want to close?';
          return event.returnValue;
        }
      }
    };

    // Handle visibility changes (minimize, sleep, etc.)
    const handleVisibilityChange = async () => {
      if (document.hidden && hasUnsavedChanges && currentOrder?.id) {
        console.log('🔄 APP HIDDEN: Auto-saving pending changes');
        try {
          await savePendingChanges(currentOrder.id, {
            silent: true,
            maxRetries: 2,
          });
        } catch (error) {
          console.error('❌ Failed to save on visibility change:', error);
        }
      } else if (!document.hidden) {
        // App became visible again - check for recovery opportunities
        checkForDataRecovery();
      }
    };

    // Check for data recovery opportunities
    const checkForDataRecovery = () => {
      if (!currentOrder?.id) return;

      const backup = restoreFromLocalStorage(currentOrder.id);
      if (backup && backup.newItems?.length > 0) {
        toast({
          title: 'Unsaved Changes Detected',
          description:
            'We found unsaved order changes from a previous session. They have been restored.',
          duration: 5000,
        });
      }
    };

    // Handle unhandled promise rejections that might indicate save failures
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.message?.includes('save') ||
        event.reason?.message?.includes('order')
      ) {
        console.error('🚨 UNHANDLED SAVE ERROR:', event.reason);

        // Backup current state immediately
        if (currentOrder?.id && orderChanges.has(currentOrder.id)) {
          usePOSStore.getState().backupToLocalStorage(currentOrder.id);

          toast({
            title: 'Save Error Detected',
            description:
              'Your order changes have been backed up locally for recovery.',
            variant: 'destructive',
            duration: 8000,
          });
        }
      }
    };

    // Handle page load - check for recovery
    const handlePageLoad = () => {
      // Small delay to ensure stores are initialized
      setTimeout(checkForDataRecovery, 1000);
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('load', handlePageLoad);

    // Initial recovery check
    handlePageLoad();

    // Cleanup event listeners
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection
      );
      window.removeEventListener('load', handlePageLoad);
    };
  }, [
    hasUnsavedChanges,
    currentOrder,
    savePendingChanges,
    orderChanges,
    restoreFromLocalStorage,
    toast,
  ]);

  // 🚨 TEMPORARY DISABLED: Periodic auto-save (see ENABLE_AUTO_SAVE flag above)
  // Periodic auto-save for extra safety (every 60 seconds, coordinated with fetch)
  useEffect(() => {
    // 🚨 FEATURE FLAG: Auto-save temporarily disabled to prevent race condition duplications
    if (!ENABLE_AUTO_SAVE) {
      console.log('⏭️ AUTO-SAVE DISABLED: Feature flag ENABLE_AUTO_SAVE is false');
      return; // Early return - no interval created
    }

    const intervalId = setInterval(() => {
      if (hasUnsavedChanges && currentOrder?.id) {
        // Check if a fetch is in progress before saving to avoid conflicts
        const { fetchInProgress } = usePOSStore.getState();

        if (!fetchInProgress) {
          console.log('⏰ PERIODIC AUTO-SAVE: Saving pending changes');
          savePendingChanges(currentOrder.id, { silent: true, maxRetries: 1 })
            .then(success => {
              if (!success) {
                console.warn(
                  '⚠️ PERIODIC AUTO-SAVE: Failed to save, changes backed up'
                );
              }
            })
            .catch(error => {
              console.error('❌ PERIODIC AUTO-SAVE: Error occurred', error);
            });
        } else {
          console.log('⏭️ PERIODIC AUTO-SAVE: Skipping - fetch in progress');
        }
      }
    }, 60000); // 60 seconds (increased from 30s to reduce frequency)

    return () => clearInterval(intervalId);
  }, [hasUnsavedChanges, currentOrder, savePendingChanges]);

  return <>{children}</>;
}
