/**
 * Layout Primitives
 *
 * This module exports reusable layout components that enforce
 * the MR5 POS design system. These components ensure:
 *
 * - Consistent 8-point grid spacing
 * - Proper scrolling behavior (no nested scrolling)
 * - Semantic HTML structure
 * - Responsive design patterns
 *
 * @example
 * ```tsx
 * import { PageContainer, PageHeader, PageContent } from '@/components/layout';
 *
 * export default function MyPage() {
 *   return (
 *     <POSLayout>
 *       <PageContainer>
 *         <PageHeader withBorder>
 *           <h1>My Page</h1>
 *         </PageHeader>
 *         <PageContent>
 *           <Card>Content here</Card>
 *         </PageContent>
 *       </PageContainer>
 *     </POSLayout>
 *   );
 * }
 * ```
 */

export {
  PageContainer,
  PageHeader,
  PageContent,
  PageSection,
} from './PageContainer';

export {
  ScrollableArea,
  Grid,
  Flex,
  Stack,
} from './ScrollableArea';
