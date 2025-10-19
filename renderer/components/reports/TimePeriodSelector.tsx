'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useReportsStore, type DateRange, getDateRangePreset } from '@/stores/reportsStore';

const TimePeriodSelector = () => {
  const { dateRange, setDateRange, fetchSalesReport, fetchInventoryReport } = useReportsStore();
  const [selectedPreset, setSelectedPreset] = useState<DateRange['preset']>(dateRange.preset);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(dateRange.startDate);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(dateRange.endDate);

  const presets = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const handlePresetChange = (preset: string) => {
    const typedPreset = preset as DateRange['preset'];
    setSelectedPreset(typedPreset);

    if (typedPreset !== 'custom') {
      const newDateRange = getDateRangePreset(typedPreset);
      setDateRange(newDateRange);
      
      // Refresh both reports
      fetchSalesReport(newDateRange);
      fetchInventoryReport(newDateRange);
    }
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      const newDateRange: DateRange = {
        startDate: customStartDate,
        endDate: customEndDate,
        preset: 'custom',
      };
      setDateRange(newDateRange);
      
      // Refresh both reports
      fetchSalesReport(newDateRange);
      fetchInventoryReport(newDateRange);
    }
  };

  return (
    <div className='flex items-center space-x-4'>
      <div className='flex items-center space-x-2'>
        <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          Time Period:
        </span>
        <Select value={selectedPreset} onValueChange={handlePresetChange}>
          <SelectTrigger className='w-[180px]'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presets.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPreset === 'custom' && (
        <div className='flex items-center space-x-2'>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant='outline'
                className='w-[140px] justify-start text-left font-normal'
              >
                <CalendarIcon className='mr-2 h-4 w-4' />
                {customStartDate ? format(customStartDate, 'MMM d, yyyy') : 'Start Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0' align='start'>
              <Calendar
                mode='single'
                selected={customStartDate}
                onSelect={setCustomStartDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <span className='text-gray-500'>to</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant='outline'
                className='w-[140px] justify-start text-left font-normal'
              >
                <CalendarIcon className='mr-2 h-4 w-4' />
                {customEndDate ? format(customEndDate, 'MMM d, yyyy') : 'End Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0' align='start'>
              <Calendar
                mode='single'
                selected={customEndDate}
                onSelect={setCustomEndDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button
            onClick={handleCustomDateApply}
            disabled={!customStartDate || !customEndDate}
            size='sm'
          >
            Apply
          </Button>
        </div>
      )}

      <div className='text-sm text-gray-600 dark:text-gray-400'>
        {dateRange.startDate.toLocaleDateString()} -{' '}
        {dateRange.endDate.toLocaleDateString()}
      </div>
    </div>
  );
};

export default TimePeriodSelector;

