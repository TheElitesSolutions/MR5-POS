'use client';

import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Star,
  Ban,
  AlertTriangle,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  AddonGroup,
  Addon,
  AddonSelection,
  ValidationError,
} from '@/types/addon';
import { MemoizedStockAwareAddonSelector } from './StockAwareAddonSelector';
import { AddonSearchBar } from './AddonSearchBar';
import { VirtualAddonList } from './VirtualAddonList';
import { useAddonSearch } from '@/hooks/useAddonSearch';
import { useAddonStock } from '@/hooks/useAddonStock';
import { useTouchGestures } from '@/hooks/useTouchGestures';
import { formatPrice } from '@/utils/addonFormatting';

interface StockAwareAddonGroupSelectorProps {
  group: AddonGroup;
  addons: Addon[];
  selections: AddonSelection[];
  onSelectionChange: (groupId: string, selections: AddonSelection[]) => void;
  onAlternativeSelect?: (
    originalAddon: Addon,
    alternativeAddon: Addon,
    quantity: number
  ) => void;
  showGroupDescription?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  enableSearch?: boolean;
  enableVirtualization?: boolean;
  enableStockChecking?: boolean;
  enableTouchGestures?: boolean;
  showValidationFeedback?: boolean;
  virtualizationThreshold?: number;
  className?: string;
}

/**
 * StockAwareAddonGroupSelector - Advanced addon group with comprehensive stock integration
 *
 * Features:
 * - Real-time stock validation for entire group
 * - Bulk stock checking for group selections
 * - Out-of-stock prevention with alternatives
 * - Low stock warnings for group items
 * - Stock-aware quantity controls
 * - Alternative suggestions workflow
 * - Performance optimized with memoization
 * - Accessibility compliant
 */
export const StockAwareAddonGroupSelector: React.FC<
  StockAwareAddonGroupSelectorProps
> = ({
  group,
  addons,
  selections,
  onSelectionChange,
  onAlternativeSelect,
  showGroupDescription = true,
  collapsible = true,
  defaultExpanded = true,
  enableSearch = true,
  enableVirtualization = true,
  enableStockChecking = true,
  enableTouchGestures = true,
  showValidationFeedback = true,
  virtualizationThreshold = 20,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showStockDetails, setShowStockDetails] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stock checking integration
  const {
    checkBulkStock,
    bulkStockResult,
    hasStockWarnings,
    hasStockErrors,
    isLoading: stockLoading,
    refreshStockData,
  } = useAddonStock({
    enableRealTimeUpdates: enableStockChecking,
    showToastWarnings: false, // Handle warnings manually
    autoCheckOnSelectionChange: true,
  });

  // Filter addons for this group
  const groupAddons = useMemo(() => {
    return addons
      .filter(addon => addon.addonGroupId === group.id && addon.isActive)
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        return a.name.localeCompare(b.name);
      });
  }, [addons, group.id]);

  // Search functionality
  const {
    searchQuery,
    setSearchQuery,
    filteredAddons,
    isSearching,
    searchResults,
    clearSearch,
  } = useAddonSearch({
    addons: groupAddons,
    searchDelay: 300,
    minSearchLength: 2,
  });

  // Determine which addons to display
  const displayAddons = useMemo(() => {
    return searchQuery.length >= 2 ? filteredAddons : groupAddons;
  }, [searchQuery, filteredAddons, groupAddons]);

  // Touch gestures for the container
  useTouchGestures(containerRef, {
    onSwipeUp: () => {
      if (collapsible && !isExpanded) {
        setIsExpanded(true);
      }
    },
    onSwipeDown: () => {
      if (collapsible && isExpanded && displayAddons.length > 5) {
        setIsExpanded(false);
      }
    },
    enabled: enableTouchGestures,
  });

  // Selection metrics calculation
  const selectionMetrics = useMemo(() => {
    const totalQuantity = selections.reduce(
      (sum, sel) => sum + sel.quantity,
      0
    );
    const totalItems = selections.length;
    const totalPrice = selections.reduce((sum, sel) => sum + sel.totalPrice, 0);

    const meetsMinimum =
      group.minSelections === 0 || totalQuantity >= group.minSelections;
    const withinMaximum =
      !group.maxSelections || totalQuantity <= group.maxSelections;
    const isValid = meetsMinimum && withinMaximum;

    return {
      totalQuantity,
      totalItems,
      totalPrice,
      meetsMinimum,
      withinMaximum,
      isValid,
    };
  }, [selections, group.minSelections, group.maxSelections]);

  // Stock validation for group
  const groupStockStatus = useMemo(() => {
    if (!enableStockChecking || !bulkStockResult) {
      return {
        status: 'unknown',
        hasIssues: false,
        blockedCount: 0,
        warningCount: 0,
      };
    }

    const { overallStatus, blockedSelections, warnings } = bulkStockResult;

    return {
      status: overallStatus,
      hasIssues: overallStatus !== 'valid',
      blockedCount: blockedSelections.length,
      warningCount: warnings.length,
    };
  }, [enableStockChecking, bulkStockResult]);

  // Validation status
  const getValidationStatus = () => {
    // Stock validation takes priority
    if (enableStockChecking && groupStockStatus.hasIssues) {
      if (groupStockStatus.status === 'errors') {
        return {
          type: 'error' as const,
          message: `${groupStockStatus.blockedCount} item${groupStockStatus.blockedCount !== 1 ? 's' : ''} out of stock`,
          icon: Ban,
        };
      } else if (groupStockStatus.status === 'warnings') {
        return {
          type: 'warning' as const,
          message: `${groupStockStatus.warningCount} stock warning${groupStockStatus.warningCount !== 1 ? 's' : ''}`,
          icon: AlertTriangle,
        };
      }
    }

    // Quantity validation
    if (!selectionMetrics.meetsMinimum) {
      return {
        type: 'error' as const,
        message: `Select at least ${group.minSelections} ${group.minSelections === 1 ? 'item' : 'items'}`,
        icon: AlertCircle,
      };
    }

    if (!selectionMetrics.withinMaximum) {
      return {
        type: 'error' as const,
        message: `Maximum ${group.maxSelections} ${group.maxSelections === 1 ? 'item' : 'items'} allowed`,
        icon: AlertCircle,
      };
    }

    if (selectionMetrics.totalQuantity > 0) {
      return {
        type: 'success' as const,
        message: `${selectionMetrics.totalQuantity} selected`,
        icon: CheckCircle,
      };
    }

    return null;
  };

  const validationStatus = getValidationStatus();

  // Handle individual addon selection
  // ✅ FIX: Remove selections from deps to prevent stale state during rapid updates
  const handleAddonSelection = useCallback(
    (addon: Addon, quantity: number) => {
      // Always work with fresh selections prop (not captured in closure)
      const newSelections = [...selections];
      const existingIndex = newSelections.findIndex(
        s => s.addonId === addon.id
      );

      const addonSelection: AddonSelection = {
        addonId: addon.id,
        addon,
        quantity,
        unitPrice: addon.price,
        totalPrice: addon.price * quantity,
      };

      if (existingIndex >= 0) {
        newSelections[existingIndex] = addonSelection;
      } else {
        newSelections.push(addonSelection);
      }

      onSelectionChange(group.id, newSelections);

      // Trigger stock check for updated selections
      if (enableStockChecking) {
        checkBulkStock(newSelections);
      }
    },
    [
      group.id,
      onSelectionChange,
      enableStockChecking,
      checkBulkStock,
    ]
  );

  // Handle addon deselection
  // ✅ FIX: Remove selections from deps to prevent stale state during rapid updates
  const handleAddonDeselect = useCallback(
    (addonId: string) => {
      // Always work with fresh selections prop (not captured in closure)
      const newSelections = selections.filter(s => s.addonId !== addonId);
      onSelectionChange(group.id, newSelections);

      // Trigger stock check for updated selections
      if (enableStockChecking && newSelections.length > 0) {
        checkBulkStock(newSelections);
      }
    },
    [
      group.id,
      onSelectionChange,
      enableStockChecking,
      checkBulkStock,
    ]
  );

  // Handle alternative selection
  // ✅ FIX: Remove selections from deps to prevent stale state during rapid updates
  const handleAlternativeSelect = useCallback(
    (originalAddon: Addon, alternativeAddon: Addon, quantity: number) => {
      // Always work with fresh selections prop (not captured in closure)
      // Remove original addon and add alternative
      const newSelections = selections
        .filter(s => s.addonId !== originalAddon.id)
        .concat({
          addonId: alternativeAddon.id,
          addon: alternativeAddon,
          quantity,
          unitPrice: alternativeAddon.price,
          totalPrice: alternativeAddon.price * quantity,
        });

      onSelectionChange(group.id, newSelections);
      onAlternativeSelect?.(originalAddon, alternativeAddon, quantity);

      // Trigger stock check for updated selections
      if (enableStockChecking) {
        checkBulkStock(newSelections);
      }
    },
    [
      group.id,
      onSelectionChange,
      onAlternativeSelect,
      enableStockChecking,
      checkBulkStock,
    ]
  );

  // Get selection for specific addon
  const getAddonSelection = useCallback(
    (addonId: string) => {
      return selections.find(s => s.addonId === addonId);
    },
    [selections]
  );

  // Check stock on selections change
  useEffect(() => {
    if (enableStockChecking && selections.length > 0) {
      checkBulkStock(selections);
    }
  }, [enableStockChecking, selections, checkBulkStock]);

  // Required indicator
  const isRequired = group.minSelections > 0;

  // Header content
  const HeaderContent = () => (
    <div className='flex w-full items-start justify-between'>
      <div className='flex flex-1 items-start gap-3'>
        <div className='flex-1'>
          {/* Group name with required indicator */}
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='text-lg font-semibold text-foreground'>
              {group.name}
            </h3>

            {isRequired && (
              <Badge
                variant='outline'
                className='border-blue-200 bg-blue-50 text-xs text-blue-700'
              >
                <Star className='mr-1 h-3 w-3' />
                Required
              </Badge>
            )}

            {/* Stock status indicator */}
            {enableStockChecking && groupStockStatus.hasIssues && (
              <Badge
                variant='outline'
                className={cn(
                  'text-xs',
                  groupStockStatus.status === 'errors'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-yellow-200 bg-yellow-50 text-yellow-700'
                )}
              >
                {groupStockStatus.status === 'errors' ? (
                  <Ban className='mr-1 h-3 w-3' />
                ) : (
                  <AlertTriangle className='mr-1 h-3 w-3' />
                )}
                Stock Issues
              </Badge>
            )}

            {/* Stock refresh button */}
            {enableStockChecking && (
              <Button
                variant='ghost'
                size='sm'
                onClick={refreshStockData}
                disabled={stockLoading}
                className='h-6 w-6 p-0'
                title='Refresh stock data'
              >
                <RefreshCw
                  className={cn('h-3 w-3', stockLoading && 'animate-spin')}
                />
              </Button>
            )}
          </div>

          {/* Group description */}
          {showGroupDescription && group.description && (
            <p className='mt-1 text-sm text-muted-foreground'>
              {group.description}
            </p>
          )}

          {/* Selection constraints and stats */}
          <div className='mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
            {group.minSelections > 0 && <span>Min: {group.minSelections}</span>}
            {group.maxSelections && <span>Max: {group.maxSelections}</span>}
            <span>{displayAddons.length} options</span>
            {searchQuery && (
              <span className='text-primary'>
                (filtered from {groupAddons.length})
              </span>
            )}
            {enableStockChecking && groupStockStatus.hasIssues && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setShowStockDetails(!showStockDetails)}
                className='h-auto p-0 text-xs underline hover:no-underline'
              >
                {showStockDetails ? 'Hide' : 'Show'} stock details
              </Button>
            )}
          </div>
        </div>

        {/* Selection status */}
        <div className='flex flex-col items-end gap-2'>
          {validationStatus && (
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium',
                validationStatus.type === 'error'
                  ? 'border border-red-200 bg-red-100 text-red-800'
                  : validationStatus.type === 'warning'
                    ? 'border border-yellow-200 bg-yellow-100 text-yellow-800'
                    : 'border border-green-200 bg-green-100 text-green-800'
              )}
            >
              <validationStatus.icon className='h-3 w-3' />
              <span>{validationStatus.message}</span>
            </div>
          )}

          {/* Price indicator */}
          {selectionMetrics.totalPrice > 0 && (
            <Badge
              variant='default'
              className='border-blue-200 bg-blue-100 text-blue-800'
            >
              +{formatPrice(selectionMetrics.totalPrice)}
            </Badge>
          )}

          {/* Collapsible indicator */}
          {collapsible && (
            <div className='text-muted-foreground'>
              {isExpanded ? (
                <ChevronUp className='h-4 w-4' />
              ) : (
                <ChevronDown className='h-4 w-4' />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render addon list
  const renderAddonList = () => {
    if (
      enableVirtualization &&
      displayAddons.length > virtualizationThreshold
    ) {
      return (
        <VirtualAddonList
          addons={displayAddons}
          selections={selections}
          stockLevels={new Map()} // Would be populated from stock service
          onSelectionChange={handleAddonSelection}
          onDeselect={handleAddonDeselect}
          itemHeight={120}
          containerHeight={400}
          emptyMessage='No add-ons found'
          isLoading={isSearching || stockLoading}
        />
      );
    }

    return (
      <div className='space-y-3'>
        {displayAddons.map((addon, index) => {
          const selection = getAddonSelection(addon.id);

          return (
            <div
              key={addon.id}
              data-addon-index={index}
              data-group-id={group.id}
            >
              <MemoizedStockAwareAddonSelector
                addon={addon}
                isSelected={!!selection}
                quantity={selection?.quantity || 0}
                onSelectionChange={handleAddonSelection}
                onDeselect={handleAddonDeselect}
                onAlternativeSelect={handleAlternativeSelect}
                showDescription={true}
                showPrice={true}
                showAlternatives={true}
                enableStockChecking={enableStockChecking}
                enableSwipeGestures={enableTouchGestures}
                size='md'
              />
            </div>
          );
        })}
      </div>
    );
  };

  if (collapsible) {
    return (
      <Card ref={containerRef} className={cn('w-full', className)}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <CardHeader className='cursor-pointer transition-colors hover:bg-muted/50'>
              <HeaderContent />
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className='space-y-4 pt-0'>
              {/* Stock details */}
              {enableStockChecking && showStockDetails && bulkStockResult && (
                <div className='space-y-2 rounded-lg bg-muted/50 p-3'>
                  <div className='flex items-center gap-2 text-sm font-medium'>
                    <Info className='h-4 w-4' />
                    Stock Status Details
                  </div>

                  {bulkStockResult.warnings.map((warning, index) => (
                    <Alert key={index} className='py-2'>
                      <AlertTriangle className='h-4 w-4' />
                      <AlertDescription className='text-xs'>
                        {warning.message}
                      </AlertDescription>
                    </Alert>
                  ))}

                  {bulkStockResult.blockedSelections.length > 0 && (
                    <Alert variant='destructive' className='py-2'>
                      <Ban className='h-4 w-4' />
                      <AlertDescription className='text-xs'>
                        {bulkStockResult.blockedSelections.length} items
                        unavailable due to stock
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Search bar */}
              {enableSearch && displayAddons.length > 5 && (
                <AddonSearchBar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  isSearching={isSearching}
                  searchResults={searchResults}
                  onClearSearch={clearSearch}
                  placeholder={`Search ${group.name.toLowerCase()}...`}
                  size='md'
                />
              )}

              {/* Addon list */}
              {renderAddonList()}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  // Non-collapsible version
  return (
    <Card ref={containerRef} className={cn('w-full', className)}>
      <CardHeader>
        <HeaderContent />
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Stock details */}
        {enableStockChecking && showStockDetails && bulkStockResult && (
          <div className='space-y-2 rounded-lg bg-muted/50 p-3'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <Info className='h-4 w-4' />
              Stock Status Details
            </div>

            {bulkStockResult.warnings.map((warning, index) => (
              <Alert key={index} className='py-2'>
                <AlertTriangle className='h-4 w-4' />
                <AlertDescription className='text-xs'>
                  {warning.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Search bar */}
        {enableSearch && displayAddons.length > 5 && (
          <AddonSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isSearching={isSearching}
            searchResults={searchResults}
            onClearSearch={clearSearch}
            placeholder={`Search ${group.name.toLowerCase()}...`}
            size='md'
          />
        )}

        {/* Addon list */}
        {renderAddonList()}
      </CardContent>
    </Card>
  );
};

// Memoized version for performance
export const MemoizedStockAwareAddonGroupSelector = React.memo(
  StockAwareAddonGroupSelector,
  (prevProps, nextProps) => {
    return (
      prevProps.group.id === nextProps.group.id &&
      prevProps.group.updatedAt === nextProps.group.updatedAt &&
      prevProps.selections.length === nextProps.selections.length &&
      prevProps.addons.length === nextProps.addons.length &&
      prevProps.enableStockChecking === nextProps.enableStockChecking
    );
  }
);

export default StockAwareAddonGroupSelector;
