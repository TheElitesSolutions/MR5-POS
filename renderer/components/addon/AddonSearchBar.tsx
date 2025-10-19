'use client';

import React, { useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Search, X, Loader2, FilterX } from 'lucide-react';

interface AddonSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearching: boolean;
  searchResults: {
    total: number;
    filtered: number;
    hasResults: boolean;
  };
  onClearSearch: () => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * AddonSearchBar - Enhanced search interface for add-ons
 *
 * Features:
 * - Real-time search with loading indicator
 * - Search result statistics
 * - Clear search functionality
 * - Keyboard shortcuts (Escape to clear)
 * - Accessibility compliant
 * - Touch-optimized controls
 */
export const AddonSearchBar: React.FC<AddonSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  isSearching,
  searchResults,
  onClearSearch,
  placeholder = 'Search add-ons...',
  size = 'md',
  className,
  autoFocus = false,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Size configurations - Touch-optimized with 44px minimum touch targets
  const sizeConfig = {
    sm: {
      input: 'h-8 text-sm',
      button: 'min-h-[44px] min-w-[44px]', // Touch-optimized
      icon: 'h-3 w-3',
      badge: 'text-xs px-2 py-0.5',
    },
    md: {
      input: 'h-10 text-sm',
      button: 'min-h-[44px] min-w-[44px]', // Touch-optimized
      icon: 'h-4 w-4',
      badge: 'text-xs px-2 py-1',
    },
    lg: {
      input: 'h-12 text-base',
      button: 'min-h-[48px] min-w-[48px]', // Larger for lg size
      icon: 'h-5 w-5',
      badge: 'text-sm px-3 py-1',
    },
  };

  const config = sizeConfig[size];

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClearSearch();
      inputRef.current?.blur();
    }
  };

  // Show clear button when there's a search query
  const showClearButton = searchQuery.length > 0;

  // Show results info when searching or have results
  const showResultsInfo = searchQuery.length > 0 && !isSearching;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Search Input */}
      <div className='relative'>
        {/* Search Icon */}
        <div className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'>
          {isSearching ? (
            <Loader2 className={cn(config.icon, 'animate-spin')} />
          ) : (
            <Search className={config.icon} />
          )}
        </div>

        {/* Input Field */}
        <Input
          ref={inputRef}
          type='text'
          placeholder={placeholder}
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            'pl-10',
            showClearButton && 'pr-10',
            config.input,
            'touch-manipulation'
          )}
          aria-label='Search add-ons'
          aria-describedby={showResultsInfo ? 'search-results-info' : undefined}
        />

        {/* Clear Button */}
        {showClearButton && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={onClearSearch}
            className={cn(
              'absolute right-1 top-1/2 -translate-y-1/2 hover:bg-transparent',
              config.button,
              'touch-manipulation'
            )}
            aria-label='Clear search'
          >
            <X className={config.icon} />
          </Button>
        )}
      </div>

      {/* Search Results Info */}
      {showResultsInfo && (
        <div
          id='search-results-info'
          className='flex items-center justify-between text-sm text-muted-foreground'
        >
          <div className='flex items-center gap-2'>
            {searchResults.hasResults ? (
              <>
                <Badge variant='outline' className={config.badge}>
                  {searchResults.filtered} of {searchResults.total} results
                </Badge>
                <span>for "{searchQuery}"</span>
              </>
            ) : (
              <>
                <Badge
                  variant='outline'
                  className={cn(
                    config.badge,
                    'border-orange-200 bg-orange-50 text-orange-700'
                  )}
                >
                  No results
                </Badge>
                <span>for "{searchQuery}"</span>
              </>
            )}
          </div>

          {/* Clear Filter Button */}
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={onClearSearch}
            className='h-auto p-1 text-xs hover:bg-transparent hover:text-foreground'
          >
            <FilterX className='mr-1 h-3 w-3' />
            Clear
          </Button>
        </div>
      )}

      {/* No Results Message */}
      {showResultsInfo && !searchResults.hasResults && (
        <div className='py-4 text-center text-muted-foreground'>
          <div className='space-y-2'>
            <Search className='mx-auto h-8 w-8 opacity-50' />
            <div className='space-y-1'>
              <p className='text-sm font-medium'>No add-ons found</p>
              <p className='text-xs'>
                Try adjusting your search terms or{' '}
                <Button
                  variant='link'
                  className='h-auto p-0 text-xs underline'
                  onClick={onClearSearch}
                >
                  browse all add-ons
                </Button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Accessibility helper text */}
      <div className='sr-only'>
        {isSearching && 'Searching add-ons...'}
        {showResultsInfo &&
          searchResults.hasResults &&
          `Search found ${searchResults.filtered} results out of ${searchResults.total} total add-ons`}
        {showResultsInfo &&
          !searchResults.hasResults &&
          'No add-ons found for your search. Press Escape or click clear to show all add-ons.'}
      </div>
    </div>
  );
};

// Memoized version for performance
export const MemoizedAddonSearchBar = React.memo(AddonSearchBar);

export default AddonSearchBar;
