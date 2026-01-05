import { cn } from '@/lib/utils';
/**
 * ScrollableArea - Properly configured scrolling container
 *
 * This component ensures correct scrolling behavior and prevents
 * nested scrolling anti-patterns. Use this instead of manual
 * overflow-y-auto + height combinations.
 *
 * IMPORTANT: Only use ONE ScrollableArea per page. Let the parent
 * layout (POSLayout, AdminLayout, etc.) handle the main scrolling.
 *
 * @example
 * ```tsx
 * // GOOD: Single scrollable area in parent layout
 * <POSLayout>
 *   <PageContainer>
 *     <Card>Content naturally scrolls with page</Card>
 *   </PageContainer>
 * </POSLayout>
 *
 * // BAD: Nested scrolling (avoid this!)
 * <POSLayout>
 *   <ScrollableArea>
 *     <ScrollableArea>...</ScrollableArea>
 *   </ScrollableArea>
 * </POSLayout>
 * ```
 */
export function ScrollableArea({ children, className, maxHeight = '90dvh', }) {
    return (<div className={cn('overflow-y-auto', className)} style={{ maxHeight }}>
      {children}
    </div>);
}
/**
 * Grid - Responsive grid layout with 8-point grid spacing
 *
 * Provides consistent grid layouts across the application.
 * Automatically handles responsive breakpoints.
 *
 * @example
 * ```tsx
 * <Grid cols={3} gap={6} responsive>
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </Grid>
 * ```
 */
export function Grid({ children, className, cols = 3, gap = 6, responsive = true, }) {
    const gridCols = responsive
        ? `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${cols}`
        : `grid-cols-${cols}`;
    return (<div className={cn('grid', gridCols, `gap-${gap}`, className)}>
      {children}
    </div>);
}
/**
 * Flex - Flexible box layout with 8-point grid spacing
 *
 * Provides consistent flexbox layouts with semantic props.
 * All spacing values align to the 8-point grid system.
 *
 * @example
 * ```tsx
 * <Flex direction="row" gap={4} align="center" justify="between">
 *   <h1>Title</h1>
 *   <Button>Action</Button>
 * </Flex>
 * ```
 */
export function Flex({ children, className, direction = 'row', gap = 4, align = 'stretch', justify = 'start', wrap = false, }) {
    const directionClass = direction === 'row' ? 'flex-row' : 'flex-col';
    const alignClass = `items-${align}`;
    const justifyClass = `justify-${justify}`;
    const wrapClass = wrap ? 'flex-wrap' : '';
    return (<div className={cn('flex', directionClass, alignClass, justifyClass, wrapClass, `gap-${gap}`, className)}>
      {children}
    </div>);
}
/**
 * Stack - Vertical stack layout with consistent spacing
 *
 * Provides vertical stacking with optional dividers.
 * Uses the 8-point grid system for spacing.
 *
 * @example
 * ```tsx
 * <Stack spacing={4} divider>
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </Stack>
 * ```
 */
export function Stack({ children, className, spacing = 4, divider = false, }) {
    return (<div className={cn('flex flex-col', `space-y-${spacing}`, divider && 'divide-y', className)}>
      {children}
    </div>);
}
