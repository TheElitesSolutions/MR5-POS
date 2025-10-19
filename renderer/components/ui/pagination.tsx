'use client';

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import * as React from 'react';
import {
  calculatePaginationMetadata,
  generatePageNumbers,
} from '@/utils/paginationUtils';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface PaginationProps {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
  maxPageButtons?: number;
}

export function Pagination({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  className,
  maxPageButtons = 5,
}: PaginationProps) {
  const { totalPages, hasNext, hasPrev, startItem, endItem } =
    calculatePaginationMetadata(totalItems, currentPage, pageSize);

  const pageNumbers = generatePageNumbers(
    currentPage,
    totalPages,
    maxPageButtons
  );

  return (
    <div
      className={cn(
        'flex flex-col items-center space-y-2 md:flex-row md:justify-between',
        className
      )}
    >
      <div className='text-sm text-gray-500 dark:text-gray-400'>
        {totalItems > 0 ? (
          <>
            Showing <span className='font-medium'>{startItem}</span> to{' '}
            <span className='font-medium'>{endItem}</span> of{' '}
            <span className='font-medium'>{totalItems}</span> items
          </>
        ) : (
          'No items found'
        )}
      </div>

      <nav className='flex items-center space-x-1' aria-label='Pagination'>
        <Button
          variant='outline'
          size='sm'
          className='h-8 w-8 p-0'
          disabled={!hasPrev}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label='Go to previous page'
        >
          <ChevronLeft className='h-4 w-4' />
        </Button>

        <div className='hidden md:flex md:items-center md:space-x-1'>
          {pageNumbers.map((pageNumber, index) =>
            pageNumber === null ? (
              <Button
                key={`ellipsis-${index}`}
                variant='ghost'
                size='sm'
                className='h-8 w-8 p-0'
                disabled
              >
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            ) : (
              <Button
                key={pageNumber}
                variant={pageNumber === currentPage ? 'default' : 'outline'}
                size='sm'
                className='h-8 w-8 p-0'
                onClick={() => onPageChange(pageNumber)}
                aria-current={pageNumber === currentPage ? 'page' : undefined}
                aria-label={`Go to page ${pageNumber}`}
              >
                {pageNumber}
              </Button>
            )
          )}
        </div>

        <div className='mx-2 text-sm md:hidden'>
          Page {currentPage} of {totalPages}
        </div>

        <Button
          variant='outline'
          size='sm'
          className='h-8 w-8 p-0'
          disabled={!hasNext}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label='Go to next page'
        >
          <ChevronRight className='h-4 w-4' />
        </Button>
      </nav>
    </div>
  );
}
