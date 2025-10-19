'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Filter, X } from 'lucide-react';
import {
  format,
  subDays,
  startOfWeek,
  startOfMonth,
  startOfYear,
} from 'date-fns';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

const ReportFilters = () => {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [selectedPreset, setSelectedPreset] = useState('week');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const datePresets = [
    {
      value: 'today',
      label: 'Today',
      getDates: () => ({ from: new Date(), to: new Date() }),
    },
    {
      value: 'yesterday',
      label: 'Yesterday',
      getDates: () => ({
        from: subDays(new Date(), 1),
        to: subDays(new Date(), 1),
      }),
    },
    {
      value: 'week',
      label: 'This Week',
      getDates: () => ({ from: startOfWeek(new Date()), to: new Date() }),
    },
    {
      value: 'month',
      label: 'This Month',
      getDates: () => ({ from: startOfMonth(new Date()), to: new Date() }),
    },
    {
      value: 'quarter',
      label: 'This Quarter',
      getDates: () => ({ from: startOfYear(new Date()), to: new Date() }),
    },
    {
      value: 'last7',
      label: 'Last 7 Days',
      getDates: () => ({ from: subDays(new Date(), 7), to: new Date() }),
    },
    {
      value: 'last30',
      label: 'Last 30 Days',
      getDates: () => ({ from: subDays(new Date(), 30), to: new Date() }),
    },
    {
      value: 'custom',
      label: 'Custom Range',
      getDates: () => ({ from: undefined, to: undefined }),
    },
  ];

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    const selectedPresetObj = datePresets.find(p => p.value === preset);
    if (selectedPresetObj && preset !== 'custom') {
      const dates = selectedPresetObj.getDates();
      setDateRange(dates);
    }
  };

  const clearFilters = () => {
    setDateRange({ from: subDays(new Date(), 7), to: new Date() });
    setSelectedPreset('week');
    setSearchTerm('');
  };

  const hasActiveFilters = searchTerm || selectedPreset !== 'week';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='flex items-center space-x-2'
        >
          <Filter className='h-4 w-4' />
          <span>Filters</span>
          {hasActiveFilters && (
            <div className='h-2 w-2 rounded-full bg-blue-500'></div>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className='w-80 p-4' align='end'>
        <div className='space-y-4'>
          {/* Header */}
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-medium'>Report Filters</h3>
            {hasActiveFilters && (
              <Button
                variant='ghost'
                size='sm'
                onClick={clearFilters}
                className='h-6 px-2 text-xs'
              >
                <X className='mr-1 h-3 w-3' />
                Clear
              </Button>
            )}
          </div>

          {/* Search */}
          <div className='space-y-2'>
            <Label htmlFor='search' className='text-xs font-medium'>
              Search Reports
            </Label>
            <Input
              id='search'
              placeholder='Search by report name...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='h-8'
            />
          </div>

          {/* Date Range Preset */}
          <div className='space-y-2'>
            <Label className='text-xs font-medium'>Date Range</Label>
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger className='h-8'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {datePresets.map(preset => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range */}
          {selectedPreset === 'custom' && (
            <div className='space-y-2'>
              <Label className='text-xs font-medium'>Custom Date Range</Label>
              <div className='grid grid-cols-2 gap-2'>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      className='h-8 justify-start px-3 text-xs'
                    >
                      <CalendarIcon className='mr-2 h-3 w-3' />
                      {dateRange.from
                        ? format(dateRange.from, 'MMM d')
                        : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0' align='start'>
                    <Calendar
                      mode='single'
                      selected={dateRange.from}
                      onSelect={date =>
                        setDateRange(prev => ({ ...prev, from: date }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      className='h-8 justify-start px-3 text-xs'
                    >
                      <CalendarIcon className='mr-2 h-3 w-3' />
                      {dateRange.to ? format(dateRange.to, 'MMM d') : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0' align='start'>
                    <Calendar
                      mode='single'
                      selected={dateRange.to}
                      onSelect={date =>
                        setDateRange(prev => ({ ...prev, to: date }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Current Selection Display */}
          <div className='border-t border-gray-200 pt-2 dark:border-gray-700'>
            <div className='text-xs text-gray-600 dark:text-gray-400'>
              <div className='flex items-center justify-between'>
                <span>Current range:</span>
                <span className='font-medium'>
                  {dateRange.from && dateRange.to
                    ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`
                    : 'Select dates'}
                </span>
              </div>
            </div>
          </div>

          {/* Apply Filters */}
          <div className='flex space-x-2 pt-2'>
            <Button
              size='sm'
              className='h-8 flex-1'
              onClick={() => setIsOpen(false)}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ReportFilters;
