'use client';

import { useMemo, useState } from 'react';

export interface UsePaginationProps {
  totalItems: number;
  itemsPerPage?: number;
  initialPage?: number;
}

export interface UsePaginationReturn {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  startIndex: number;
  endIndex: number;
  paginatedItems: <T>(items: T[]) => T[];
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  setItemsPerPage: (count: number) => void;
  getPageNumbers: () => number[];
}

export const usePagination = ({
  totalItems,
  itemsPerPage = 10,
  initialPage = 1,
}: UsePaginationProps): UsePaginationReturn => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPageState, setItemsPerPageState] = useState(itemsPerPage);

  const totalPages = Math.ceil(totalItems / itemsPerPageState);

  // Ensure current page is valid when total pages change
  const validCurrentPage = Math.min(currentPage, Math.max(1, totalPages));

  const startIndex = (validCurrentPage - 1) * itemsPerPageState;
  const endIndex = Math.min(startIndex + itemsPerPageState, totalItems);

  const paginatedItems = useMemo(() => {
    return <T>(items: T[]): T[] => {
      return items.slice(startIndex, endIndex);
    };
  }, [startIndex, endIndex]);

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => {
    if (validCurrentPage < totalPages) {
      setCurrentPage(validCurrentPage + 1);
    }
  };

  const previousPage = () => {
    if (validCurrentPage > 1) {
      setCurrentPage(validCurrentPage - 1);
    }
  };

  const canGoNext = validCurrentPage < totalPages;
  const canGoPrevious = validCurrentPage > 1;

  const setItemsPerPage = (count: number) => {
    setItemsPerPageState(count);
    // Reset to first page when changing items per page
    setCurrentPage(1);
  };

  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      const startPage = Math.max(1, validCurrentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  return {
    currentPage: validCurrentPage,
    totalPages,
    itemsPerPage: itemsPerPageState,
    startIndex,
    endIndex,
    paginatedItems,
    goToPage,
    nextPage,
    previousPage,
    canGoNext,
    canGoPrevious,
    setItemsPerPage,
    getPageNumbers,
  };
};
