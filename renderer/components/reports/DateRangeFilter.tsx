'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from '@/stores/reportsStore';
import { CalendarIcon, Check } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
// import { cn } from '@/lib/utils';

interface DateRangeFilterProps {
  dateRange: DateRange;
  onDateRangeChange: (dateRange: DateRange) => void;
}

const DateRangeFilter = ({
  dateRange,
  onDateRangeChange,
}: DateRangeFilterProps) => {
  const [date, setDate] = useState<{
    from: Date;
    to: Date;
  }>({
    from: dateRange.startDate,
    to: dateRange.endDate,
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handlePresetChange = (preset: DateRange['preset']) => {
    // Create a new date range based on the preset
    const today = new Date();
    let startDate: Date;
    let endDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59
    );

    switch (preset) {
      case 'today':
        startDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );
        break;
      case 'week':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );
    }

    setDate({ from: startDate, to: endDate });
    onDateRangeChange({
      startDate,
      endDate,
      preset,
    });
  };

  const handleCustomDateChange = (range: { from: Date; to?: Date }) => {
    if (range.from && range.to) {
      // Set time to end of day for the end date
      const endDate = new Date(range.to);
      endDate.setHours(23, 59, 59, 999);

      setDate({ from: range.from, to: endDate });
      onDateRangeChange({
        startDate: range.from,
        endDate,
        preset: 'custom',
      });
      setIsCalendarOpen(false);
    } else {
      setDate({ from: range.from, to: date.to });
    }
  };

  const formatDateRange = () => {
    if (dateRange.preset !== 'custom') {
      switch (dateRange.preset) {
        case 'today':
          return 'Today';
        case 'week':
          return 'Last 7 Days';
        case 'month':
          return 'This Month';
        case 'quarter':
          return 'This Quarter';
        case 'year':
          return 'This Year';
        default:
          return 'Custom Range';
      }
    }

    return `${format(dateRange.startDate, 'MMM d, yyyy')} - ${format(
      dateRange.endDate,
      'MMM d, yyyy'
    )}`;
  };

  return (
    <div className='flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-2 sm:space-y-0'>
      <div className='flex space-x-1'>
        <Button
          variant={dateRange.preset === 'today' ? 'default' : 'outline'}
          size='sm'
          onClick={() => handlePresetChange('today')}
        >
          Today
          {dateRange.preset === 'today' && <Check className='ml-1 h-4 w-4' />}
        </Button>
        <Button
          variant={dateRange.preset === 'week' ? 'default' : 'outline'}
          size='sm'
          onClick={() => handlePresetChange('week')}
        >
          Week
          {dateRange.preset === 'week' && <Check className='ml-1 h-4 w-4' />}
        </Button>
        <Button
          variant={dateRange.preset === 'month' ? 'default' : 'outline'}
          size='sm'
          onClick={() => handlePresetChange('month')}
        >
          Month
          {dateRange.preset === 'month' && <Check className='ml-1 h-4 w-4' />}
        </Button>
        <Button
          variant={dateRange.preset === 'year' ? 'default' : 'outline'}
          size='sm'
          onClick={() => handlePresetChange('year')}
        >
          Year
          {dateRange.preset === 'year' && <Check className='ml-1 h-4 w-4' />}
        </Button>
      </div>

      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={dateRange.preset === 'custom' ? 'default' : 'outline'}
            size='sm'
            className='ml-auto flex items-center'
          >
            <CalendarIcon className='mr-2 h-4 w-4' />
            {formatDateRange()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='end'>
          <Calendar
            initialFocus
            mode='range'
            defaultMonth={date.from}
            selected={{
              from: date.from,
              to: date.to,
            }}
            onSelect={range => {
              if (range?.from && range?.to) {
                handleCustomDateChange(range as { from: Date; to: Date });
              }
            }}
            numberOfMonths={2}
            className='rounded-md border'
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DateRangeFilter;
