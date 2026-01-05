'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Filter, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { memo } from 'react';
const StockFilters = memo(({ filters, categories, onUpdateFilter, onResetFilters, resultCount, }) => {
    const hasActiveFilters = filters.searchTerm ||
        filters.categoryFilter !== 'all' ||
        filters.stockLevelFilter !== 'all' ||
        filters.valueRange;
    return (<div className='space-y-3'>
        {/* Search and Quick Filters */}
        <div className='flex flex-col gap-3 sm:flex-row'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400'/>
            <Input placeholder='Search stock items by name or category...' value={filters.searchTerm} onChange={e => onUpdateFilter('searchTerm', e.target.value)} className='pl-10'/>
          </div>

          {/* Category Filter */}
          <div className='flex items-center space-x-2'>
            <Filter className='h-4 w-4 text-gray-400'/>
            <Select value={filters.categoryFilter} onValueChange={value => onUpdateFilter('categoryFilter', value)}>
              <SelectTrigger className='w-48'>
                <SelectValue placeholder='All Categories'/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Categories</SelectItem>
                {(categories || [])
            .filter(category => category && category.trim() !== '')
            .map(category => (<SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {/* Stock Level Filter */}
          <div className='flex items-center space-x-2'>
            <SlidersHorizontal className='h-4 w-4 text-gray-400'/>
            <Select value={filters.stockLevelFilter} onValueChange={value => onUpdateFilter('stockLevelFilter', value)}>
              <SelectTrigger className='w-32'>
                <SelectValue placeholder='Stock Level'/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Levels</SelectItem>
                <SelectItem value='low'>Low Stock</SelectItem>
                <SelectItem value='medium'>Medium Stock</SelectItem>
                <SelectItem value='high'>High Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sort and Advanced Options */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center space-x-2'>
            <span className='text-sm text-gray-600 dark:text-gray-400'>
              Sort by:
            </span>
            <Select value={filters.sortBy} onValueChange={value => onUpdateFilter('sortBy', value)}>
              <SelectTrigger className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='name'>Name</SelectItem>
                <SelectItem value='quantity'>Quantity</SelectItem>
                <SelectItem value='value'>Value</SelectItem>
                <SelectItem value='category'>Category</SelectItem>
                <SelectItem value='lastUpdated'>Last Updated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.sortOrder} onValueChange={value => onUpdateFilter('sortOrder', value)}>
              <SelectTrigger className='w-24'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='asc'>A-Z</SelectItem>
                <SelectItem value='desc'>Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-center space-x-4'>
            <span className='text-sm text-gray-600 dark:text-gray-400'>
              {resultCount} item{resultCount !== 1 ? 's' : ''} found
            </span>
            {hasActiveFilters && (<Button variant='outline' size='sm' onClick={onResetFilters} className='flex items-center space-x-1'>
                <RotateCcw className='h-3 w-3'/>
                <span>Reset</span>
              </Button>)}
          </div>
        </div>
      </div>);
});
StockFilters.displayName = 'StockFilters';
export default StockFilters;
