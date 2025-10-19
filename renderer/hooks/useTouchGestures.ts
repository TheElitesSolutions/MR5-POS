'use client';

import { useRef, useCallback, useEffect } from 'react';

interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: (event: TouchEvent) => void;
  onDoubleTap?: (event: TouchEvent) => void;
  onLongPress?: (event: TouchEvent) => void;
  onPinch?: (scale: number) => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
  enabled?: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startTime: number;
  endTime: number;
  touchCount: number;
  lastTapTime: number;
  longPressTimer?: NodeJS.Timeout | undefined;
  initialDistance?: number;
}

/**
 * Advanced touch gesture hook for mobile POS interactions
 *
 * Features:
 * - Swipe gestures (left, right, up, down)
 * - Tap, double-tap, and long-press
 * - Pinch-to-zoom detection
 * - Touch-optimized for POS tablets
 * - Configurable thresholds
 * - Performance optimized
 */
export const useTouchGestures = (
  element: React.RefObject<HTMLElement | null>,
  options: TouchGestureOptions = {}
) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    onLongPress,
    onPinch,
    swipeThreshold = 50,
    longPressDelay = 500,
    doubleTapDelay = 300,
    enabled = true,
  } = options;

  const touchStateRef = useRef<TouchState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    startTime: 0,
    endTime: 0,
    touchCount: 0,
    lastTapTime: 0,
  });

  // Calculate distance between two touch points
  const getDistance = useCallback((touches: TouchList) => {
    if (touches.length < 2) return 0;

    const touch1 = touches[0];
    const touch2 = touches[1];
    if (!touch1 || !touch2) return 0;

    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;

    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return;

      const touch = event.touches[0];
      if (!touch) return;
      const touchState = touchStateRef.current;

      // Clear any existing long press timer
      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer);
      }

      touchState.startX = touch.clientX;
      touchState.startY = touch.clientY;
      touchState.startTime = Date.now();
      touchState.touchCount = event.touches.length;

      // Initialize pinch detection for multi-touch
      if (event.touches.length === 2) {
        touchState.initialDistance = getDistance(event.touches);
      }

      // Set up long press detection for single touch
      if (event.touches.length === 1 && onLongPress) {
        touchState.longPressTimer = setTimeout(() => {
          onLongPress(event);
        }, longPressDelay);
      }
    },
    [enabled, onLongPress, longPressDelay, getDistance]
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return;

      const touch = event.touches[0];
      if (!touch) return;
      const touchState = touchStateRef.current;

      // Update current position
      touchState.endX = touch.clientX;
      touchState.endY = touch.clientY;

      // Cancel long press if user moves too much
      if (touchState.longPressTimer) {
        const moveDistance = Math.sqrt(
          Math.pow(touchState.endX - touchState.startX, 2) +
            Math.pow(touchState.endY - touchState.startY, 2)
        );

        if (moveDistance > 10) {
          clearTimeout(touchState.longPressTimer);
          touchState.longPressTimer = undefined;
        }
      }

      // Handle pinch gesture
      if (event.touches.length === 2 && touchState.initialDistance && onPinch) {
        const currentDistance = getDistance(event.touches);
        const scale = currentDistance / touchState.initialDistance;
        onPinch(scale);
      }
    },
    [enabled, onPinch, getDistance]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return;

      const touchState = touchStateRef.current;
      touchState.endTime = Date.now();

      // Clear long press timer
      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer);
        touchState.longPressTimer = undefined;
      }

      // Only process single touch gestures
      if (touchState.touchCount !== 1) {
        return;
      }

      const deltaX = touchState.endX - touchState.startX;
      const deltaY = touchState.endY - touchState.startY;
      const deltaTime = touchState.endTime - touchState.startTime;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Determine if this is a swipe gesture
      if (distance > swipeThreshold && deltaTime < 500) {
        const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;

        // Determine swipe direction
        if (Math.abs(angle) <= 45) {
          // Right swipe
          onSwipeRight?.();
        } else if (Math.abs(angle) >= 135) {
          // Left swipe
          onSwipeLeft?.();
        } else if (angle > 45 && angle < 135) {
          // Down swipe
          onSwipeDown?.();
        } else if (angle < -45 && angle > -135) {
          // Up swipe
          onSwipeUp?.();
        }
      }
      // Tap detection
      else if (distance < 10 && deltaTime < 300) {
        const currentTime = Date.now();
        const timeSinceLastTap = currentTime - touchState.lastTapTime;

        // Double tap detection
        if (timeSinceLastTap < doubleTapDelay && onDoubleTap) {
          onDoubleTap(event);
          touchState.lastTapTime = 0; // Reset to prevent triple tap
        } else {
          // Single tap
          touchState.lastTapTime = currentTime;

          // Delay single tap to allow for potential double tap
          if (onTap && !onDoubleTap) {
            onTap(event);
          } else if (onTap && onDoubleTap) {
            setTimeout(() => {
              const finalTimeDiff = Date.now() - touchState.lastTapTime;
              if (finalTimeDiff >= doubleTapDelay) {
                onTap(event);
              }
            }, doubleTapDelay);
          }
        }
      }
    },
    [
      enabled,
      swipeThreshold,
      doubleTapDelay,
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
      onTap,
      onDoubleTap,
    ]
  );

  // Set up event listeners
  useEffect(() => {
    const el = element.current;
    if (!el || !enabled) return;

    // Add passive listeners for better performance
    const options = { passive: false };

    el.addEventListener('touchstart', handleTouchStart, options);
    el.addEventListener('touchmove', handleTouchMove, options);
    el.addEventListener('touchend', handleTouchEnd, options);

    // Prevent default touch behaviors that might interfere
    const preventDefault = (e: TouchEvent) => {
      // Allow scrolling, but prevent other default behaviors
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    el.addEventListener('touchstart', preventDefault);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchstart', preventDefault);

      // Clean up any remaining timers
      if (touchStateRef.current.longPressTimer) {
        clearTimeout(touchStateRef.current.longPressTimer);
      }
    };
  }, [element, enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    touchState: touchStateRef.current,
  };
};

// Hook for swipe-to-select behavior on addon items
export const useSwipeToSelect = (
  element: React.RefObject<HTMLElement | null>,
  onSelect: () => void,
  onDeselect: () => void,
  isSelected: boolean
) => {
  return useTouchGestures(element, {
    onSwipeRight: () => {
      if (!isSelected) {
        onSelect();
      }
    },
    onSwipeLeft: () => {
      if (isSelected) {
        onDeselect();
      }
    },
    swipeThreshold: 60,
    enabled: true,
  });
};

// Hook for quantity adjustment via swipe
export const useSwipeQuantity = (
  element: React.RefObject<HTMLElement | null>,
  onIncrease: () => void,
  onDecrease: () => void
) => {
  return useTouchGestures(element, {
    onSwipeUp: onIncrease,
    onSwipeDown: onDecrease,
    swipeThreshold: 40,
    enabled: true,
  });
};

export default useTouchGestures;
