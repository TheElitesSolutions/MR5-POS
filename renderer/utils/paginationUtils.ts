/**
 * Pagination utility functions
 */

/**
 * Calculate pagination metadata based on total items, current page and page size
 *
 * @param totalItems Total number of items
 * @param currentPage Current page (1-based)
 * @param pageSize Number of items per page
 * @returns Object with pagination metadata
 */
export function calculatePaginationMetadata(
  totalItems: number,
  currentPage: number,
  pageSize: number
) {
  // Ensure page is at least 1
  const page = Math.max(1, currentPage);

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / pageSize);

  // Calculate start and end item
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  // Determine if we have previous and next pages
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return {
    page,
    totalPages,
    startItem,
    endItem,
    hasPrev,
    hasNext,
  };
}

/**
 * Generate page numbers for pagination with ellipsis for large ranges
 *
 * @param currentPage Current page (1-based)
 * @param totalPages Total number of pages
 * @param maxButtons Maximum number of page buttons to show
 * @returns Array of page numbers with null representing ellipsis
 */
export function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  maxButtons: number = 5
): (number | null)[] {
  // If we have fewer pages than max buttons, just return all pages
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  // We need to show ellipsis, so calculate which pages to show
  const pageNumbers: (number | null)[] = [];

  // Always show first page
  pageNumbers.push(1);

  // Calculate start and end of middle section
  const sideButtonCount = Math.floor((maxButtons - 3) / 2); // -3 for first, last, and one ellipsis
  let startPage = Math.max(2, currentPage - sideButtonCount);
  let endPage = Math.min(totalPages - 1, currentPage + sideButtonCount);

  // Adjust if we're close to the start or end
  if (currentPage - 1 <= sideButtonCount) {
    // Close to start, show more pages at the end
    endPage = Math.min(totalPages - 1, maxButtons - 2); // -2 for first and last page
  } else if (totalPages - currentPage <= sideButtonCount) {
    // Close to end, show more pages at the start
    startPage = Math.max(2, totalPages - maxButtons + 2); // +2 for first and last page
  }

  // Add ellipsis after first page if needed
  if (startPage > 2) {
    pageNumbers.push(null); // Ellipsis
  }

  // Add middle pages
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  // Add ellipsis before last page if needed
  if (endPage < totalPages - 1) {
    pageNumbers.push(null); // Ellipsis
  }

  // Always show last page
  if (totalPages > 1) {
    pageNumbers.push(totalPages);
  }

  return pageNumbers;
}

export default {
  calculatePaginationMetadata,
  generatePageNumbers,
};
