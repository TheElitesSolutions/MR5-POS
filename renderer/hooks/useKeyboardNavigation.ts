'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

interface KeyboardNavigationOptions {
  enabled?: boolean;
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSelect?: (index?: number) => void;
  onEscape?: () => void;
  onSearch?: () => void;
  itemCount?: number;
  currentIndex?: number;
  allowWrap?: boolean;
}

interface KeyboardShortcuts {
  navigate: {
    up: string[];
    down: string[];
    left: string[];
    right: string[];
  };
  actions: {
    select: string[];
    escape: string[];
    search: string[];
    clear: string[];
    toggleAll: string[];
  };
}

/**
 * Advanced keyboard navigation hook for add-on selection interfaces
 *
 * Features:
 * - Arrow key navigation
 * - Keyboard shortcuts (/, Escape, Enter, Space)
 * - Focus management
 * - Screen reader announcements
 * - Customizable key bindings
 */
export const useKeyboardNavigation = ({
  enabled = true,
  onNavigate,
  onSelect,
  onEscape,
  onSearch,
  itemCount = 0,
  currentIndex = -1,
  allowWrap = true,
}: KeyboardNavigationOptions) => {
  const [focusedIndex, setFocusedIndex] = useState(currentIndex);
  const isNavigatingRef = useRef(false);

  // Default keyboard shortcuts
  const shortcuts: KeyboardShortcuts = {
    navigate: {
      up: ['ArrowUp', 'k'],
      down: ['ArrowDown', 'j'],
      left: ['ArrowLeft', 'h'],
      right: ['ArrowRight', 'l'],
    },
    actions: {
      select: ['Enter', ' '], // Space and Enter
      escape: ['Escape'],
      search: ['/'],
      clear: ['Backspace', 'Delete'],
      toggleAll: ['a'],
    },
  };

  // Handle navigation
  const navigate = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!enabled || itemCount === 0) return;

      let newIndex = focusedIndex;

      switch (direction) {
        case 'up':
          newIndex =
            focusedIndex <= 0
              ? allowWrap
                ? itemCount - 1
                : 0
              : focusedIndex - 1;
          break;
        case 'down':
          newIndex =
            focusedIndex >= itemCount - 1
              ? allowWrap
                ? 0
                : itemCount - 1
              : focusedIndex + 1;
          break;
        case 'left':
          // Custom left navigation logic
          break;
        case 'right':
          // Custom right navigation logic
          break;
      }

      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
        onNavigate?.(direction);

        // Announce to screen readers
        announceNavigation(newIndex, itemCount);
      }
    },
    [enabled, itemCount, focusedIndex, allowWrap, onNavigate]
  );

  // Screen reader announcements
  const announceNavigation = useCallback((index: number, total: number) => {
    const announcement = `Item ${index + 1} of ${total}`;

    // Create or update live region for screen reader announcements
    let liveRegion = document.getElementById('addon-navigation-announcer');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'addon-navigation-announcer';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = announcement;
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const { key, ctrlKey, metaKey, altKey } = event;
      const hasModifier = ctrlKey || metaKey || altKey;

      // Prevent default for navigation keys
      const isNavigationKey = Object.values(shortcuts.navigate)
        .flat()
        .includes(key);
      const isActionKey = Object.values(shortcuts.actions).flat().includes(key);

      if (isNavigationKey || isActionKey) {
        // Allow default behavior for certain keys in input fields
        const activeElement = document.activeElement;
        const isInInput =
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.getAttribute('contenteditable') === 'true';

        // Allow typing in search fields
        if (isInInput && key === '/' && !hasModifier) {
          return;
        }

        // Prevent default for most navigation keys
        if (isNavigationKey && !isInInput) {
          event.preventDefault();
        }
      }

      // Handle navigation
      if (shortcuts.navigate.up.includes(key) && !hasModifier) {
        event.preventDefault();
        navigate('up');
      } else if (shortcuts.navigate.down.includes(key) && !hasModifier) {
        event.preventDefault();
        navigate('down');
      } else if (shortcuts.navigate.left.includes(key) && !hasModifier) {
        event.preventDefault();
        navigate('left');
      } else if (shortcuts.navigate.right.includes(key) && !hasModifier) {
        event.preventDefault();
        navigate('right');
      }

      // Handle actions
      else if (shortcuts.actions.select.includes(key) && !hasModifier) {
        event.preventDefault();
        onSelect?.(focusedIndex >= 0 ? focusedIndex : undefined);
      } else if (shortcuts.actions.escape.includes(key) && !hasModifier) {
        onEscape?.();
      } else if (shortcuts.actions.search.includes(key) && !hasModifier) {
        event.preventDefault();
        onSearch?.();
      }
    },
    [enabled, navigate, onSelect, onEscape, onSearch, focusedIndex, shortcuts]
  );

  // Focus management
  const focusItem = useCallback((index: number) => {
    const element = document.querySelector(
      `[data-addon-index="${index}"]`
    ) as HTMLElement;
    if (element) {
      element.focus();
      setFocusedIndex(index);
    }
  }, []);

  // Set up keyboard event listeners
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  // Update focused index when currentIndex changes
  useEffect(() => {
    setFocusedIndex(currentIndex);
  }, [currentIndex]);

  // Cleanup live region on unmount
  useEffect(() => {
    return () => {
      const liveRegion = document.getElementById('addon-navigation-announcer');
      if (liveRegion) {
        liveRegion.remove();
      }
    };
  }, []);

  return {
    focusedIndex,
    setFocusedIndex,
    navigate,
    focusItem,
    shortcuts,
    isNavigating: isNavigatingRef.current,
  };
};

// Hook for managing focus within addon groups
export const useAddonGroupFocus = (groupId: string, addonCount: number) => {
  const [focusedAddonIndex, setFocusedAddonIndex] = useState(-1);

  const focusAddon = useCallback(
    (index: number) => {
      const addonElement = document.querySelector(
        `[data-group-id="${groupId}"] [data-addon-index="${index}"]`
      ) as HTMLElement;

      if (addonElement) {
        addonElement.focus();
        setFocusedAddonIndex(index);
      }
    },
    [groupId]
  );

  const navigateWithinGroup = useCallback(
    (direction: 'next' | 'previous') => {
      let newIndex = focusedAddonIndex;

      if (direction === 'next') {
        newIndex =
          focusedAddonIndex >= addonCount - 1 ? 0 : focusedAddonIndex + 1;
      } else {
        newIndex =
          focusedAddonIndex <= 0 ? addonCount - 1 : focusedAddonIndex - 1;
      }

      focusAddon(newIndex);
    },
    [focusedAddonIndex, addonCount, focusAddon]
  );

  return {
    focusedAddonIndex,
    focusAddon,
    navigateWithinGroup,
  };
};

export default useKeyboardNavigation;
