'use client';

import { useEffect } from 'react';
import { applyStateCleanup } from '@/utils/stateCleanupUtils';
import { useToast } from '@/hooks/use-toast';

/**
 * StateCleanupProvider - Manages application state cleanup on startup and restarts
 *
 * This component runs at application startup and handles:
 * 1. Detecting stale data conditions that might indicate database inconsistency
 * 2. Cleaning up store state when necessary
 * 3. Preventing data corruption issues from persisting across sessions
 */
export default function StateCleanupProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { toast } = useToast();

  useEffect(() => {
    // Function to perform cleanup operations
    const performCleanup = async () => {
      try {
        await applyStateCleanup();
      } catch (error) {
        console.error('Failed to perform state cleanup:', error);
        toast({
          title: 'System Recovery',
          description:
            'Application state has been reset to prevent data inconsistency.',
          variant: 'default',
        });
      }
    };

    // ⚠️ CRITICAL FIX: Only run cleanup once on component mount (app startup)
    // Previous implementation was too aggressive:
    // - Triggered on every window focus (e.g., switching browser tabs)
    // - Triggered on visibility changes (e.g., minimizing/maximizing window)
    // - Caused false positives due to race conditions with store initialization
    //
    // NEW BEHAVIOR: Only runs on actual app startup
    performCleanup();

    // ⚠️ REMOVED: Aggressive focus/visibility listeners
    // These caused order data loss during normal navigation
    //
    // If you need to handle system sleep/hibernate in the future:
    // 1. Increase the inactivity threshold significantly (e.g., 4+ hours)
    // 2. Add a flag to track if initial data load has completed
    // 3. Don't run cleanup if user has an active order in progress
    // 4. Add a user confirmation dialog before resetting state
    //
    // Example (DISABLED):
    // const handleFocus = () => {
    //   if (document.visibilityState === 'visible') {
    //     const lastInteraction = parseInt(
    //       localStorage.getItem('lastInteractionTime') || '0',
    //       10
    //     );
    //     const now = Date.now();
    //
    //     // Only after 4+ hours AND if no active order
    //     if (now - lastInteraction > 4 * 60 * 60 * 1000) {
    //       const posStore = usePOSStore.getState();
    //       if (!posStore.currentOrder) {
    //         console.log('Application resumed after extended period, performing state cleanup');
    //         performCleanup();
    //       }
    //     }
    //     localStorage.setItem('lastInteractionTime', now.toString());
    //   }
    // };
    //
    // window.addEventListener('focus', handleFocus);
    // document.addEventListener('visibilitychange', handleFocus);

    // No cleanup needed since we removed the event listeners
  }, [toast]);

  return <>{children}</>;
}
