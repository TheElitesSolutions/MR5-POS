'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Target,
  TrendingUp,
} from 'lucide-react';
import { ValidationError, AddonGroup, AddonSelection } from '@/types/addon';

interface ValidationProgressProps {
  group: AddonGroup;
  selections: AddonSelection[];
  className?: string;
}

interface ValidationFeedbackProps {
  validationErrors: ValidationError[];
  groups: AddonGroup[];
  allSelections: AddonSelection[];
  showProgress?: boolean;
  showSuggestions?: boolean;
  className?: string;
}

/**
 * ValidationProgress - Shows progress towards group selection requirements
 */
const ValidationProgress: React.FC<ValidationProgressProps> = ({
  group,
  selections,
  className,
}) => {
  const groupSelections = selections.filter(
    s => s.addon.addonGroupId === group.id
  );
  const currentCount = groupSelections.reduce(
    (sum, sel) => sum + sel.quantity,
    0
  );

  const minRequired = group.minSelections;
  const maxAllowed = group.maxSelections || Infinity;

  // Calculate progress percentage
  const progress =
    minRequired > 0 ? Math.min((currentCount / minRequired) * 100, 100) : 100;

  // Determine status
  const isComplete = currentCount >= minRequired;
  const isOverLimit = group.maxSelections && currentCount > group.maxSelections;
  const isPartial = currentCount > 0 && currentCount < minRequired;

  const getStatusColor = () => {
    if (isOverLimit) return 'destructive';
    if (isComplete) return 'success';
    if (isPartial) return 'warning';
    return 'secondary';
  };

  const getStatusIcon = () => {
    if (isOverLimit) return AlertCircle;
    if (isComplete) return CheckCircle;
    if (isPartial) return AlertTriangle;
    return Target;
  };

  const StatusIcon = getStatusIcon();
  const statusColor = getStatusColor();

  return (
    <div className={cn('space-y-2', className)}>
      {/* Group header with status */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <StatusIcon
            className={cn(
              'h-4 w-4',
              statusColor === 'success' && 'text-green-600',
              statusColor === 'warning' && 'text-yellow-600',
              statusColor === 'destructive' && 'text-red-600',
              statusColor === 'secondary' && 'text-muted-foreground'
            )}
          />
          <span className='text-sm font-medium'>{group.name}</span>
        </div>

        <Badge
          variant='outline'
          className={cn(
            'text-xs',
            statusColor === 'success' &&
              'border-green-200 bg-green-50 text-green-700',
            statusColor === 'warning' &&
              'border-yellow-200 bg-yellow-50 text-yellow-700',
            statusColor === 'destructive' &&
              'border-red-200 bg-red-50 text-red-700'
          )}
        >
          {currentCount}
          {group.maxSelections ? `/${group.maxSelections}` : ''}
          {minRequired > 0 && ` (min ${minRequired})`}
        </Badge>
      </div>

      {/* Progress bar for groups with minimum requirements */}
      {minRequired > 0 && (
        <div className='space-y-1'>
          <Progress
            value={progress}
            className={cn(
              'h-2',
              isOverLimit && '[&>div]:bg-red-500',
              isComplete && '[&>div]:bg-green-500',
              isPartial && '[&>div]:bg-yellow-500'
            )}
          />
          <div className='flex justify-between text-xs text-muted-foreground'>
            <span>
              {isComplete
                ? 'Complete'
                : `${minRequired - currentCount} more needed`}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      )}

      {/* Status message */}
      <div className='text-xs text-muted-foreground'>
        {isOverLimit && `Too many selected (max ${group.maxSelections})`}
        {isComplete && !isOverLimit && 'Selection requirements met'}
        {isPartial &&
          `Select ${minRequired - currentCount} more to meet minimum`}
        {currentCount === 0 &&
          minRequired === 0 &&
          'Optional - select as desired'}
        {currentCount === 0 &&
          minRequired > 0 &&
          'Required - please make selections'}
      </div>
    </div>
  );
};

/**
 * AddonValidationFeedback - Advanced validation UX with progressive disclosure
 *
 * Features:
 * - Real-time validation feedback
 * - Progress indicators for group requirements
 * - Smart suggestions for corrections
 * - Progressive disclosure of details
 * - Accessible error messages
 * - Visual hierarchy for error severity
 */
export const AddonValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  validationErrors,
  groups,
  allSelections,
  showProgress = true,
  showSuggestions = true,
  className,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Group errors by type and severity
  const errorsByType = useMemo(() => {
    const grouped = {
      critical: validationErrors.filter(
        e =>
          e.severity === 'error' &&
          (e.type === 'MIN_SELECTION' || e.type === 'OUT_OF_STOCK')
      ),
      warnings: validationErrors.filter(
        e => e.severity === 'warning' || e.type === 'MAX_SELECTION'
      ),
      info: validationErrors.filter(
        e => e.severity !== 'error' && e.type !== 'MAX_SELECTION'
      ),
    };

    return grouped;
  }, [validationErrors]);

  // Calculate overall completion status
  const completionStatus = useMemo(() => {
    const requiredGroups = groups.filter(g => g.minSelections > 0);
    const completedGroups = requiredGroups.filter(group => {
      const groupSelections = allSelections.filter(
        s => s.addon.addonGroupId === group.id
      );
      const totalQuantity = groupSelections.reduce(
        (sum, sel) => sum + sel.quantity,
        0
      );
      return totalQuantity >= group.minSelections;
    });

    return {
      total: requiredGroups.length,
      completed: completedGroups.length,
      percentage:
        requiredGroups.length > 0
          ? (completedGroups.length / requiredGroups.length) * 100
          : 100,
    };
  }, [groups, allSelections]);

  // Generate smart suggestions
  const suggestions = useMemo(() => {
    if (!showSuggestions) return [];

    const tips: string[] = [];

    // Suggest completing required groups first
    const incompleteRequiredGroups = groups.filter(group => {
      const groupSelections = allSelections.filter(
        s => s.addon.addonGroupId === group.id
      );
      const totalQuantity = groupSelections.reduce(
        (sum, sel) => sum + sel.quantity,
        0
      );
      return group.minSelections > 0 && totalQuantity < group.minSelections;
    });

    if (incompleteRequiredGroups.length > 0) {
      tips.push(
        `Complete ${incompleteRequiredGroups.length} required ${incompleteRequiredGroups.length === 1 ? 'group' : 'groups'} first`
      );
    }

    // Suggest removing excess selections
    const overLimitGroups = groups.filter(group => {
      const groupSelections = allSelections.filter(
        s => s.addon.addonGroupId === group.id
      );
      const totalQuantity = groupSelections.reduce(
        (sum, sel) => sum + sel.quantity,
        0
      );
      return group.maxSelections && totalQuantity > group.maxSelections;
    });

    if (overLimitGroups.length > 0) {
      tips.push(
        `Remove excess items from ${overLimitGroups.length} ${overLimitGroups.length === 1 ? 'group' : 'groups'}`
      );
    }

    return tips;
  }, [groups, allSelections, showSuggestions]);

  // Don't render if no errors and progress is complete
  if (
    validationErrors.length === 0 &&
    completionStatus.percentage === 100 &&
    !showProgress
  ) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Overall progress (for required groups) */}
      {showProgress && completionStatus.total > 0 && (
        <div className='rounded-lg border bg-card p-4'>
          <div className='mb-2 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <TrendingUp className='h-4 w-4 text-primary' />
              <span className='font-medium'>Selection Progress</span>
            </div>
            <Badge variant='outline'>
              {completionStatus.completed}/{completionStatus.total} complete
            </Badge>
          </div>

          <Progress value={completionStatus.percentage} className='mb-2' />

          <p className='text-sm text-muted-foreground'>
            {completionStatus.percentage === 100
              ? 'All required selections complete'
              : `${completionStatus.total - completionStatus.completed} required ${completionStatus.total - completionStatus.completed === 1 ? 'group' : 'groups'} remaining`}
          </p>
        </div>
      )}

      {/* Critical errors */}
      {errorsByType.critical.length > 0 && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            <div className='space-y-2'>
              <div className='font-medium'>Required selections missing</div>
              <ul className='list-inside list-disc space-y-1 text-sm'>
                {errorsByType.critical.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {errorsByType.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className='h-4 w-4' />
          <AlertDescription>
            <div className='space-y-2'>
              <div className='font-medium'>Selection limits exceeded</div>
              <ul className='list-inside list-disc space-y-1 text-sm'>
                {errorsByType.warnings.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Smart suggestions */}
      {suggestions.length > 0 && (
        <Alert>
          <Info className='h-4 w-4' />
          <AlertDescription>
            <div className='space-y-2'>
              <div className='font-medium'>Suggestions</div>
              <ul className='list-inside list-disc space-y-1 text-sm'>
                {suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed progress for each group */}
      {showProgress && groups.length > 0 && (
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button variant='outline' className='w-full justify-between'>
              Group Details
              {showDetails ? (
                <ChevronUp className='h-4 w-4' />
              ) : (
                <ChevronDown className='h-4 w-4' />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className='mt-3 space-y-3'>
            {groups.map(group => (
              <ValidationProgress
                key={group.id}
                group={group}
                selections={allSelections}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Accessibility announcements */}
      <div className='sr-only' aria-live='polite' aria-atomic='true'>
        {errorsByType.critical.length > 0 &&
          `${errorsByType.critical.length} critical validation errors need attention`}
        {errorsByType.warnings.length > 0 &&
          `${errorsByType.warnings.length} selection warnings`}
        {completionStatus.percentage < 100 &&
          `${completionStatus.total - completionStatus.completed} required groups still need selections`}
      </div>
    </div>
  );
};

// Memoized version for performance
export const MemoizedAddonValidationFeedback = React.memo(
  AddonValidationFeedback
);

export default AddonValidationFeedback;
