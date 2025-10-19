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

    // Run the cleanup operation on component mount
    performCleanup();

    // Also set up a listener for window focus to handle system sleep/resume
    const handleFocus = () => {
      // Check if the document was hidden for a significant period (system sleep/hibernate)
      if (document.visibilityState === 'visible') {
        const lastInteraction = parseInt(
          localStorage.getItem('lastInteractionTime') || '0',
          10
        );
        const now = Date.now();

        // If last interaction was more than 30 minutes ago, perform cleanup
        if (now - lastInteraction > 30 * 60 * 1000) {
          console.log(
            'Application resumed after extended period, performing state cleanup'
          );
          performCleanup();
        }

        // Update last interaction time
        localStorage.setItem('lastInteractionTime', now.toString());
      }
    };

    // Set initial last interaction time
    localStorage.setItem('lastInteractionTime', Date.now().toString());

    // Add event listeners
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    // Cleanup function
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [toast]);

  return <>{children}</>;
}
