'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Users,
  DollarSign,
  Tag,
  Star,
  ArrowRight,
  CheckCircle,
  Lightbulb,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  AddonAlternative,
  addonStockService,
} from '@/services/addonStockService';
import { useAddonStock } from '@/hooks/useAddonStock';
import { Addon, AddonSelection } from '@/types/addon';
import { MemoizedEnhancedStockIndicator } from './EnhancedStockIndicator';
import { formatPrice } from '@/utils/addonFormatting';

interface AlternativeSuggestionsProps {
  originalAddon: Addon;
  requestedQuantity: number;
  onAlternativeSelect: (addon: Addon, quantity: number) => void;
  onClose?: () => void;
  className?: string;
  trigger?: React.ReactNode;
  autoOpen?: boolean;
  maxSuggestions?: number;
}

interface AlternativeCardProps {
  alternative: AddonAlternative;
  requestedQuantity: number;
  onSelect: (addon: Addon, quantity: number) => void;
  isSelected?: boolean;
  disabled?: boolean;
}

/**
 * AlternativeCard - Individual alternative addon suggestion
 */
const AlternativeCard: React.FC<AlternativeCardProps> = ({
  alternative,
  requestedQuantity,
  onSelect,
  isSelected = false,
  disabled = false,
}) => {
  const { addon, reason, similarity, stockStatus } = alternative;

  // Reason configurations
  const reasonConfig = {
    same_group: {
      icon: Tag,
      label: 'Same Category',
      description: 'From the same add-on group',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    similar_price: {
      icon: DollarSign,
      label: 'Similar Price',
      description: 'Similar pricing to original',
      color: 'bg-green-100 text-green-800 border-green-200',
    },
    similar_name: {
      icon: Users,
      label: 'Similar Item',
      description: 'Similar name or type',
      color: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    popular: {
      icon: Star,
      label: 'Popular Choice',
      description: 'Frequently selected alternative',
      color: 'bg-orange-100 text-orange-800 border-orange-200',
    },
  };

  const reasonInfo = reasonConfig[reason];
  const ReasonIcon = reasonInfo.icon;

  // Calculate price difference
  const priceDifference = addon.price - (alternative.addon.price || 0);
  const isPriceDifferent = Math.abs(priceDifference) > 0.01;

  return (
    <Card
      className={cn(
        'cursor-pointer border-2 transition-all duration-200 hover:shadow-md',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      onClick={() => !disabled && onSelect(addon, requestedQuantity)}
      role='button'
      tabIndex={disabled ? -1 : 0}
      onKeyDown={e => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          onSelect(addon, requestedQuantity);
        }
      }}
    >
      <CardContent className='p-4'>
        <div className='space-y-3'>
          {/* Header with name and reason */}
          <div className='flex items-start justify-between'>
            <div className='flex-1'>
              <h4 className='text-sm font-medium leading-tight'>
                {addon.name}
              </h4>
              {addon.description && (
                <p className='mt-0.5 line-clamp-2 text-xs text-muted-foreground'>
                  {addon.description}
                </p>
              )}
            </div>

            {/* Similarity score */}
            <div className='ml-2 flex items-center'>
              <div className='text-xs font-medium text-muted-foreground'>
                {Math.round(similarity * 100)}% match
              </div>
            </div>
          </div>

          {/* Reason badge */}
          <div className='flex items-center gap-2'>
            <Badge
              variant='outline'
              className={cn('text-xs', reasonInfo.color)}
            >
              <ReasonIcon className='mr-1 h-3 w-3' />
              {reasonInfo.label}
            </Badge>

            {/* Stock status */}
            <MemoizedEnhancedStockIndicator
              addon={addon}
              required={requestedQuantity}
              variant='compact'
              size='sm'
            />
          </div>

          {/* Price comparison */}
          <div className='flex items-center justify-between text-sm'>
            <div className='flex items-center gap-2'>
              <span className='font-medium'>{formatPrice(addon.price)}</span>
              {isPriceDifferent && (
                <Badge
                  variant='outline'
                  className={cn(
                    'text-xs',
                    priceDifference > 0
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-green-200 bg-green-50 text-green-600'
                  )}
                >
                  {priceDifference > 0 ? '+' : ''}
                  {formatPrice(priceDifference)}
                </Badge>
              )}
            </div>

            {/* Max quantity available */}
            <div className='text-xs text-muted-foreground'>
              Max: {stockStatus.maxQuantity}
            </div>
          </div>

          {/* Selection indicator */}
          {isSelected && (
            <div className='flex items-center justify-center rounded-md bg-primary/10 py-2'>
              <CheckCircle className='mr-2 h-4 w-4 text-primary' />
              <span className='text-sm font-medium text-primary'>Selected</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * AlternativeSuggestions - Intelligent alternative suggestions for out-of-stock add-ons
 *
 * Features:
 * - Real-time alternative suggestions based on multiple criteria
 * - Stock status validation for alternatives
 * - Price comparison and difference indicators
 * - Reason-based categorization (same group, similar price, similar name, popular)
 * - Similarity scoring and matching
 * - Accessibility compliant with keyboard navigation
 * - Responsive dialog interface
 * - Performance optimized with memoization
 */
export const AlternativeSuggestions: React.FC<AlternativeSuggestionsProps> = ({
  originalAddon,
  requestedQuantity,
  onAlternativeSelect,
  onClose,
  className,
  trigger,
  autoOpen = false,
  maxSuggestions = 5,
}) => {
  const [open, setOpen] = useState(autoOpen);
  const [selectedAlternative, setSelectedAlternative] = useState<Addon | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<AddonAlternative[]>([]);

  const { getAlternatives } = useAddonStock();

  // Load alternatives when dialog opens
  const loadAlternatives = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await getAlternatives(originalAddon, requestedQuantity);
      setAlternatives(results.slice(0, maxSuggestions));
    } catch (error) {
      console.error('Failed to load alternatives:', error);
    } finally {
      setIsLoading(false);
    }
  }, [originalAddon, requestedQuantity, getAlternatives, maxSuggestions]);

  // Load alternatives when dialog opens
  React.useEffect(() => {
    if (open && alternatives.length === 0) {
      loadAlternatives();
    }
  }, [open, alternatives.length, loadAlternatives]);

  // Handle alternative selection
  const handleSelect = useCallback(
    (addon: Addon, quantity: number) => {
      setSelectedAlternative(addon);
      onAlternativeSelect(addon, quantity);
    },
    [onAlternativeSelect]
  );

  // Handle dialog close
  const handleClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  // Group alternatives by reason for better organization
  const groupedAlternatives = useMemo(() => {
    const groups: Record<string, AddonAlternative[]> = {};
    alternatives.forEach(alt => {
      if (!groups[alt.reason]) {
        groups[alt.reason] = [];
      }
      groups[alt.reason].push(alt);
    });
    return groups;
  }, [alternatives]);

  // Default trigger if none provided
  const defaultTrigger = (
    <Button variant='outline' size='sm' className='h-8'>
      <Lightbulb className='mr-1 h-3 w-3' />
      Alternatives
    </Button>
  );

  const triggerElement = trigger || defaultTrigger;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerElement}</DialogTrigger>

      <DialogContent
        className={cn('max-h-[80vh] max-w-2xl overflow-hidden', className)}
      >
        <DialogHeader className='pb-2'>
          <div className='flex items-start justify-between'>
            <div className='flex-1'>
              <DialogTitle className='text-lg'>
                Alternative Suggestions
              </DialogTitle>
              <p className='mt-1 text-sm text-muted-foreground'>
                <span className='font-medium'>{originalAddon.name}</span> is
                currently unavailable.
                <br />
                Here are some alternatives you might like:
              </p>
            </div>
            <Button
              variant='ghost'
              size='sm'
              onClick={loadAlternatives}
              disabled={isLoading}
              className='ml-2'
            >
              <RefreshCw
                className={cn('h-4 w-4', isLoading && 'animate-spin')}
              />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className='flex-1'>
          <div className='space-y-4 pr-4'>
            {/* Loading state */}
            {isLoading && alternatives.length === 0 && (
              <div className='flex items-center justify-center py-8'>
                <RefreshCw className='mr-2 h-6 w-6 animate-spin' />
                <span>Finding alternatives...</span>
              </div>
            )}

            {/* No alternatives found */}
            {!isLoading && alternatives.length === 0 && (
              <div className='py-8 text-center text-muted-foreground'>
                <Lightbulb className='mx-auto mb-3 h-12 w-12 opacity-50' />
                <p className='font-medium'>No alternatives available</p>
                <p className='text-sm'>Try refreshing or check back later</p>
              </div>
            )}

            {/* Grouped alternatives */}
            {Object.entries(groupedAlternatives).map(
              ([reason, groupAlts], groupIndex) => (
                <div key={reason} className='space-y-2'>
                  {groupIndex > 0 && <Separator />}

                  {/* Group header */}
                  <div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
                    <span className='capitalize'>
                      {reason.replace('_', ' ')}
                    </span>
                    <Badge variant='outline' className='text-xs'>
                      {groupAlts.length}
                    </Badge>
                  </div>

                  {/* Group alternatives */}
                  <div className='grid gap-2'>
                    {groupAlts.map((alternative, index) => (
                      <AlternativeCard
                        key={`${reason}-${index}`}
                        alternative={alternative}
                        requestedQuantity={requestedQuantity}
                        onSelect={handleSelect}
                        isSelected={
                          selectedAlternative?.id === alternative.addon.id
                        }
                        disabled={
                          !alternative.stockStatus.canSelect(requestedQuantity)
                        }
                      />
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </ScrollArea>

        {/* Footer actions */}
        <div className='flex items-center justify-between border-t pt-4'>
          <div className='text-xs text-muted-foreground'>
            {alternatives.length > 0 && (
              <span>
                Showing {alternatives.length} of available alternatives
              </span>
            )}
          </div>

          <div className='flex gap-2'>
            <Button variant='outline' onClick={handleClose}>
              Close
            </Button>
            {selectedAlternative && (
              <Button onClick={handleClose} className='bg-primary'>
                <CheckCircle className='mr-2 h-4 w-4' />
                Use Selected
              </Button>
            )}
          </div>
        </div>

        {/* Accessibility announcements */}
        <div className='sr-only' aria-live='polite'>
          {isLoading && 'Loading alternative suggestions'}
          {alternatives.length > 0 &&
            `Found ${alternatives.length} alternative options`}
          {selectedAlternative &&
            `Selected ${selectedAlternative.name} as alternative`}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Memoized version for performance
export const MemoizedAlternativeSuggestions = React.memo(
  AlternativeSuggestions
);

export default AlternativeSuggestions;
