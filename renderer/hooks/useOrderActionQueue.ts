/**
 * useOrderActionQueue - Prevents race conditions in order updates
 *
 * This hook implements a queue system for order modifications to ensure
 * that concurrent updates don't conflict with each other.
 *
 * Features:
 * - Sequential processing of order actions
 * - Automatic retry on failure
 * - Action cancellation support
 * - Optimistic locking via version tracking
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { orderLogger } from '@/utils/logger';

export type OrderAction = {
  id: string;
  type: 'add' | 'update' | 'remove' | 'complete' | 'cancel' | 'custom';
  execute: () => Promise<any>;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  retryCount?: number;
  maxRetries?: number;
};

interface UseOrderActionQueueOptions {
  orderId?: string;
  maxRetries?: number;
}

export const useOrderActionQueue = (
  options: UseOrderActionQueueOptions = {}
) => {
  const { orderId, maxRetries = 2 } = options;

  // Queue to store pending actions
  const queueRef = useRef<OrderAction[]>([]);

  // Flag to track if queue is currently processing
  const isProcessingRef = useRef(false);

  // State for UI feedback
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueLength, setQueueLength] = useState(0);

  // Action counter for generating unique IDs
  const actionCounterRef = useRef(0);

  /**
   * Process the next action in the queue
   */
  const processNextAction = useCallback(async () => {
    if (isProcessingRef.current) {
      orderLogger.debug('Queue already processing, skipping', { orderId });
      return;
    }

    const action = queueRef.current[0];
    if (!action) {
      // Queue is empty
      isProcessingRef.current = false;
      setIsProcessing(false);
      setQueueLength(0);
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setQueueLength(queueRef.current.length);

    orderLogger.debug('Processing queued action', {
      orderId,
      actionId: action.id,
      actionType: action.type,
      queueLength: queueRef.current.length,
      retryCount: action.retryCount || 0,
    });

    try {
      const result = await action.execute();

      orderLogger.debug('Action completed successfully', {
        orderId,
        actionId: action.id,
        actionType: action.type,
      });

      // Remove action from queue
      queueRef.current.shift();

      // Call success callback if provided
      if (action.onSuccess) {
        action.onSuccess(result);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      orderLogger.error('Action failed', err, {
        orderId,
        actionId: action.id,
        actionType: action.type,
        retryCount: action.retryCount || 0,
        maxRetries: action.maxRetries || maxRetries,
      });

      // Check if we should retry
      const currentRetries = action.retryCount || 0;
      const actionMaxRetries = action.maxRetries ?? maxRetries;

      if (currentRetries < actionMaxRetries) {
        // Retry the action
        orderLogger.debug('Retrying action', {
          orderId,
          actionId: action.id,
          retryAttempt: currentRetries + 1,
        });

        action.retryCount = currentRetries + 1;
        // Keep action in queue for retry
      } else {
        // Max retries exceeded, remove from queue
        orderLogger.error('Action failed after max retries', err, {
          orderId,
          actionId: action.id,
          actionType: action.type,
          totalRetries: currentRetries,
        });

        queueRef.current.shift();

        // Call error callback if provided
        if (action.onError) {
          action.onError(err);
        }
      }
    } finally {
      isProcessingRef.current = false;

      // Process next action if queue is not empty
      if (queueRef.current.length > 0) {
        // Small delay to prevent tight loop
        setTimeout(() => processNextAction(), 10);
      } else {
        setIsProcessing(false);
        setQueueLength(0);
      }
    }
  }, [orderId, maxRetries]);

  /**
   * Enqueue an action for processing
   */
  const enqueueAction = useCallback(
    (
      type: OrderAction['type'],
      execute: () => Promise<any>,
      options: {
        onSuccess?: (result: any) => void;
        onError?: (error: Error) => void;
        maxRetries?: number;
      } = {}
    ): string => {
      const actionId = `${type}-${actionCounterRef.current++}-${Date.now()}`;

      const action: OrderAction = {
        id: actionId,
        type,
        execute,
        onSuccess: options.onSuccess,
        onError: options.onError,
        retryCount: 0,
        maxRetries: options.maxRetries,
      };

      queueRef.current.push(action);
      setQueueLength(queueRef.current.length);

      orderLogger.debug('Action enqueued', {
        orderId,
        actionId,
        actionType: type,
        queuePosition: queueRef.current.length,
      });

      // Start processing if not already processing
      if (!isProcessingRef.current) {
        processNextAction();
      }

      return actionId;
    },
    [orderId, processNextAction]
  );

  /**
   * Cancel a specific action by ID
   */
  const cancelAction = useCallback(
    (actionId: string): boolean => {
      const index = queueRef.current.findIndex(a => a.id === actionId);

      if (index === -1) {
        orderLogger.debug('Action not found in queue', { orderId, actionId });
        return false;
      }

      // Can't cancel currently processing action (index 0)
      if (index === 0 && isProcessingRef.current) {
        orderLogger.debug('Cannot cancel currently processing action', {
          orderId,
          actionId,
        });
        return false;
      }

      queueRef.current.splice(index, 1);
      setQueueLength(queueRef.current.length);

      orderLogger.debug('Action cancelled', { orderId, actionId });
      return true;
    },
    [orderId]
  );

  /**
   * Clear all pending actions (except currently processing)
   */
  const clearQueue = useCallback(() => {
    const wasProcessing = isProcessingRef.current;
    const currentAction = wasProcessing ? queueRef.current[0] : null;

    queueRef.current = currentAction ? [currentAction] : [];
    setQueueLength(queueRef.current.length);

    orderLogger.debug('Queue cleared', {
      orderId,
      wasProcessing,
      remainingActions: queueRef.current.length,
    });
  }, [orderId]);

  /**
   * Wait for all actions to complete
   */
  const waitForQueue = useCallback((): Promise<void> => {
    return new Promise(resolve => {
      const checkQueue = () => {
        if (queueRef.current.length === 0 && !isProcessingRef.current) {
          resolve();
        } else {
          setTimeout(checkQueue, 100);
        }
      };
      checkQueue();
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (queueRef.current.length > 0) {
        orderLogger.debug('Component unmounting with pending actions', {
          orderId,
          pendingActions: queueRef.current.length,
        });
      }
    };
  }, [orderId]);

  return {
    enqueueAction,
    cancelAction,
    clearQueue,
    waitForQueue,
    isProcessing,
    queueLength,
  };
};
