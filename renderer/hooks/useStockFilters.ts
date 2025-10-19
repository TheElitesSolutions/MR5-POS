'use client';

import { useMemo, useState } from 'react';
import { StockItem } from '@/types';

export interface StockFilters {
  searchTerm: string;
  categoryFilter: string;
  stockLevelFilter: 'all' | 'low' | 'medium' | 'high';
  sortBy: 'name' | 'quantity' | 'value' | 'category' | 'lastUpdated';
  sortOrder: 'asc' | 'desc';
  valueRange: { min: number; max: number } | null;
}

export interface UseStockFiltersReturn {
  filters: StockFilters;
  filteredItems: StockItem[];
  updateFilter: <K extends keyof StockFilters>(
    key: K,
    value: StockFilters[K]
  ) => void;
  resetFilters: () => void;
  totalValue: number;
  lowStockCount: number;
  categoryStats: Array<{
    name: string;
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
  }>;
}

const defaultFilters: StockFilters = {
  searchTerm: '',
  categoryFilter: 'all',
  stockLevelFilter: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
  valueRange: null,
};

export const useStockFilters = (
  stockItems: StockItem[]
): UseStockFiltersReturn => {
  const [filters, setFilters] = useState<StockFilters>(defaultFilters);

  const updateFilter = <K extends keyof StockFilters>(
    key: K,
    value: StockFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const getStockLevel = (item: StockItem): 'low' | 'medium' | 'high' => {
    const currentQty = item.currentQuantity ?? item.currentStock ?? 0;
    const minQty = item.minimumQuantity ?? item.minimumStock ?? 0;
    if (currentQty <= minQty) return 'low';
    if (currentQty <= minQty * 2) return 'medium';
    return 'high';
  };

  const filteredItems = useMemo(() => {
    let items = [...stockItems];

    // Filter out system-generated placeholder items from main view
    // These are created to maintain category structure but shouldn't be visible to users
    items = items.filter(item => item.supplier !== 'System-Generated Category');

    // Search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      items = items.filter(
        item =>
          (item.name ?? item.itemName ?? '').toLowerCase().includes(term) ||
          (item.category && item.category.toLowerCase().includes(term))
      );
    }

    // Category filter
    if (filters.categoryFilter !== 'all') {
      items = items.filter(item => {
        const itemCategory = item.category || 'Uncategorized';
        return itemCategory === filters.categoryFilter;
      });
    }

    // Stock level filter
    if (filters.stockLevelFilter !== 'all') {
      items = items.filter(
        item => getStockLevel(item) === filters.stockLevelFilter
      );
    }

    // Value range filter
    if (filters.valueRange) {
      items = items.filter(item => {
        const currentQty = item.currentQuantity ?? item.currentStock ?? 0;
        const value = currentQty * item.costPerUnit;
        return (
          value >= filters.valueRange!.min && value <= filters.valueRange!.max
        );
      });
    }

    // Sort items
    items.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'name':
          const aName = a.name ?? a.itemName ?? '';
          const bName = b.name ?? b.itemName ?? '';
          comparison = aName.localeCompare(bName);
          break;
        case 'quantity':
          const aQty = a.currentQuantity ?? a.currentStock ?? 0;
          const bQty = b.currentQuantity ?? b.currentStock ?? 0;
          comparison = aQty - bQty;
          break;
        case 'value':
          const aCurrentQty = a.currentQuantity ?? a.currentStock ?? 0;
          const bCurrentQty = b.currentQuantity ?? b.currentStock ?? 0;
          comparison =
            aCurrentQty * a.costPerUnit -
            bCurrentQty * b.costPerUnit;
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
        case 'lastUpdated':
          comparison =
            new Date(a.lastUpdated || 0).getTime() -
            new Date(b.lastUpdated || 0).getTime();
          break;
      }

      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return items;
  }, [stockItems, filters]);

  const stats = useMemo(() => {
    // Filter out placeholder items for stats calculations
    const realItems = stockItems.filter(
      item => item.supplier !== 'System-Generated Category'
    );

    const totalValue = realItems.reduce((sum, item) => {
      const currentQty = item.currentQuantity ?? item.currentStock ?? 0;
      return sum + currentQty * item.costPerUnit;
    }, 0);

    const lowStockCount = realItems.filter(item => {
      const currentQty = item.currentQuantity ?? item.currentStock ?? 0;
      const minQty = item.minimumQuantity ?? item.minimumStock ?? 0;
      return currentQty <= minQty;
    }).length;

    // Get categories from all items (including placeholders) to maintain category structure
    const categories = Array.from(
      new Set(stockItems.map(item => item.category || 'Uncategorized'))
    ).sort();

    const categoryStats = categories.map(category => {
      // Only count real items for category stats
      const categoryItems = realItems.filter(
        item => (item.category || 'Uncategorized') === category
      );
      const categoryValue = categoryItems.reduce((sum, item) => {
        const currentQty = item.currentQuantity ?? item.currentStock ?? 0;
        return sum + currentQty * item.costPerUnit;
      }, 0);
      const lowStockInCategory = categoryItems.filter(item => {
        const currentQty = item.currentQuantity ?? item.currentStock ?? 0;
        const minQty = item.minimumQuantity ?? item.minimumStock ?? 0;
        return currentQty <= minQty;
      }).length;

      return {
        name: category,
        totalItems: categoryItems.length,
        totalValue: categoryValue,
        lowStockCount: lowStockInCategory,
      };
    });

    return {
      totalValue,
      lowStockCount,
      categoryStats,
    };
  }, [stockItems]);

  return {
    filters,
    filteredItems,
    updateFilter,
    resetFilters,
    ...stats,
  };
};
