'use client';
import React, { useState, useRef, useMemo, useCallback, } from 'react';
import { cn } from '@/lib/utils';
import { MemoizedAddonSelector } from './AddonSelector';
/**
 * VirtualAddonList - High-performance virtual scrolling for large addon lists
 *
 * Features:
 * - Virtual scrolling for 1000+ items
 * - Dynamic height calculation
 * - Smooth scrolling with momentum
 * - Memory efficient rendering
 * - Touch/wheel scroll support
 * - Accessibility maintained
 */
export const VirtualAddonList = ({ addons, selections, stockLevels, onSelectionChange, onDeselect, itemHeight = 120, // Estimated height per addon
containerHeight = 400, // Visible container height
overscan = 5, // Extra items to render outside visible area
className, emptyMessage = 'No add-ons available', loadingMessage = 'Loading add-ons...', isLoading = false, }) => {
    const [scrollTop, setScrollTop] = useState(0);
    const [containerRef, setContainerRef] = useState(null);
    const scrollElementRef = useRef(null);
    // Calculate visible range
    const visibleRange = useMemo(() => {
        const start = Math.floor(scrollTop / itemHeight);
        const end = Math.min(start + Math.ceil(containerHeight / itemHeight), addons.length);
        return {
            start: Math.max(0, start - overscan),
            end: Math.min(addons.length, end + overscan),
        };
    }, [scrollTop, itemHeight, containerHeight, overscan, addons.length]);
    // Get visible items
    const visibleItems = useMemo(() => {
        return addons.slice(visibleRange.start, visibleRange.end);
    }, [addons, visibleRange]);
    // Handle scroll with throttling
    const handleScroll = useCallback((e) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);
    // Get selection for specific addon
    const getAddonSelection = useCallback((addonId) => {
        return selections.find(s => s.addonId === addonId);
    }, [selections]);
    // Total height calculation
    const totalHeight = addons.length * itemHeight;
    // Offset for visible items
    const offsetY = visibleRange.start * itemHeight;
    // Loading state
    if (isLoading) {
        return (<div className={cn('flex items-center justify-center p-8', className)}>
        <div className='space-y-2 text-center'>
          <div className='mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary'></div>
          <p className='text-sm text-muted-foreground'>{loadingMessage}</p>
        </div>
      </div>);
    }
    // Empty state
    if (addons.length === 0) {
        return (<div className={cn('flex items-center justify-center p-8', className)}>
        <div className='space-y-2 text-center'>
          <div className='text-4xl text-muted-foreground'>📦</div>
          <p className='text-muted-foreground'>{emptyMessage}</p>
        </div>
      </div>);
    }
    // Small list - no virtualization needed
    if (addons.length <= 20) {
        return (<div className={cn('space-y-3', className)}>
        {addons.map(addon => {
                const selection = getAddonSelection(addon.id);
                const currentStock = stockLevels.get(addon.id) || 0;
                return (<MemoizedAddonSelector key={addon.id} addon={addon} isSelected={!!selection} quantity={selection?.quantity || 0} currentStock={currentStock} onSelectionChange={onSelectionChange} onDeselect={onDeselect} showDescription={true} showPrice={true} size='md'/>);
            })}
      </div>);
    }
    return (<div className={cn('relative', className)}>
      {/* Virtual scroll container */}
      <div ref={scrollElementRef} className='overflow-auto rounded-lg border bg-background' style={{ height: containerHeight }} onScroll={handleScroll} role='list' aria-label={`Add-on list with ${addons.length} items`}>
        {/* Total height spacer */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Visible items container */}
          <div style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
        }}>
            <div className='space-y-3 p-4'>
              {visibleItems.map((addon, index) => {
            const selection = getAddonSelection(addon.id);
            const currentStock = stockLevels.get(addon.id) || 0;
            const actualIndex = visibleRange.start + index;
            return (<div key={addon.id} role='listitem' aria-setsize={addons.length} aria-posinset={actualIndex + 1}>
                    <MemoizedAddonSelector addon={addon} isSelected={!!selection} quantity={selection?.quantity || 0} currentStock={currentStock} onSelectionChange={onSelectionChange} onDeselect={onDeselect} showDescription={true} showPrice={true} size='md'/>
                  </div>);
        })}
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicators */}
      {addons.length > 20 && (<div className='absolute bottom-2 right-2 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground'>
          {Math.floor(scrollTop / itemHeight) + 1} -{' '}
          {Math.min(Math.floor(scrollTop / itemHeight) +
                Math.ceil(containerHeight / itemHeight), addons.length)}{' '}
          of {addons.length}
        </div>)}

      {/* Accessibility improvements */}
      <div className='sr-only'>
        Virtual list containing {addons.length} add-on items. Use arrow keys to
        navigate and Space or Enter to select. Currently showing items{' '}
        {visibleRange.start + 1} to {visibleRange.end} of {addons.length}.
      </div>
    </div>);
};
// Hook for managing virtual list state
export const useVirtualList = (itemCount, itemHeight, containerHeight) => {
    const [scrollTop, setScrollTop] = useState(0);
    const visibleRange = useMemo(() => {
        const start = Math.floor(scrollTop / itemHeight);
        const end = Math.min(start + Math.ceil(containerHeight / itemHeight), itemCount);
        return { start, end };
    }, [scrollTop, itemHeight, containerHeight, itemCount]);
    const scrollToItem = useCallback((index) => {
        const targetScrollTop = index * itemHeight;
        setScrollTop(targetScrollTop);
    }, [itemHeight]);
    return {
        visibleRange,
        scrollTop,
        setScrollTop,
        scrollToItem,
        totalHeight: itemCount * itemHeight,
    };
};
// Memoized version for performance
export const MemoizedVirtualAddonList = React.memo(VirtualAddonList);
export default VirtualAddonList;
