import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

/**
 * PageContainer - Main container for application pages
 *
 * Enforces consistent spacing and layout structure across the application.
 * Uses the 8-point grid system with standardized padding.
 *
 * @example
 * ```tsx
 * <PageContainer>
 *   <PageHeader>...</PageHeader>
 *   <PageContent>...</PageContent>
 * </PageContainer>
 * ```
 */
export function PageContainer({
  children,
  className,
  noPadding = false,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'w-full h-full',
        !noPadding && 'p-6 space-y-6',
        className
      )}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
  withBorder?: boolean;
}

/**
 * PageHeader - Standard page header with optional border
 *
 * Provides consistent header styling across pages.
 * Automatically includes proper spacing and border when needed.
 *
 * @example
 * ```tsx
 * <PageHeader withBorder>
 *   <h1 className="text-2xl font-bold">Page Title</h1>
 *   <p className="text-muted-foreground">Page description</p>
 * </PageHeader>
 * ```
 */
export function PageHeader({
  children,
  className,
  withBorder = true,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'space-y-4',
        withBorder && 'border-b pb-6',
        className
      )}
    >
      {children}
    </div>
  );
}

interface PageContentProps {
  children: ReactNode;
  className?: string;
}

/**
 * PageContent - Main content area for pages
 *
 * Provides consistent content spacing using the 8-point grid system.
 * Use this for the main content area of your pages.
 *
 * @example
 * ```tsx
 * <PageContent>
 *   <Card>...</Card>
 *   <Card>...</Card>
 * </PageContent>
 * ```
 */
export function PageContent({
  children,
  className,
}: PageContentProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {children}
    </div>
  );
}

interface PageSectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  action?: ReactNode;
}

/**
 * PageSection - Semantic section wrapper with optional title
 *
 * Use this to create well-defined sections within your pages.
 * Automatically handles spacing and typography hierarchy.
 *
 * @example
 * ```tsx
 * <PageSection
 *   title="Sales Overview"
 *   description="Last 30 days"
 *   action={<Button>View All</Button>}
 * >
 *   <SalesChart />
 * </PageSection>
 * ```
 */
export function PageSection({
  children,
  title,
  description,
  className,
  action,
}: PageSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || description || action) && (
        <div className='flex items-center justify-between'>
          <div className='space-y-1'>
            {title && (
              <h2 className='text-lg font-semibold leading-none tracking-tight'>
                {title}
              </h2>
            )}
            {description && (
              <p className='text-sm text-muted-foreground'>{description}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
