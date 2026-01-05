'use client';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useReportsStore, getDateRangePreset } from '@/stores/reportsStore';
import { Input } from '@/components/ui/input';
const TimePeriodSelector = () => {
    const { dateRange, setDateRange, fetchSalesReport, fetchInventoryReport, fetchProfitReport } = useReportsStore();
    const [selectedPreset, setSelectedPreset] = useState(dateRange.preset);
    const [customStartDate, setCustomStartDate] = useState(dateRange.startDate);
    const [customEndDate, setCustomEndDate] = useState(dateRange.endDate);
    const [startHour, setStartHour] = useState(dateRange.startDate.getHours().toString().padStart(2, '0'));
    const [startMinute, setStartMinute] = useState(dateRange.startDate.getMinutes().toString().padStart(2, '0'));
    const [endHour, setEndHour] = useState(dateRange.endDate.getHours().toString().padStart(2, '0'));
    const [endMinute, setEndMinute] = useState(dateRange.endDate.getMinutes().toString().padStart(2, '0'));
    const presets = [
        { value: 'today', label: 'Today' },
        { value: 'week', label: 'This Week' },
        { value: 'month', label: 'This Month' },
        { value: 'year', label: 'This Year' },
        { value: 'custom', label: 'Custom Range' },
    ];
    const handlePresetChange = (preset) => {
        const typedPreset = preset;
        setSelectedPreset(typedPreset);
        if (typedPreset !== 'custom') {
            const newDateRange = getDateRangePreset(typedPreset);
            setDateRange(newDateRange);
            // Update time states to match the preset
            setStartHour(newDateRange.startDate.getHours().toString().padStart(2, '0'));
            setStartMinute(newDateRange.startDate.getMinutes().toString().padStart(2, '0'));
            setEndHour(newDateRange.endDate.getHours().toString().padStart(2, '0'));
            setEndMinute(newDateRange.endDate.getMinutes().toString().padStart(2, '0'));
            // Refresh all reports
            fetchSalesReport(newDateRange);
            fetchInventoryReport(newDateRange);
            fetchProfitReport(newDateRange);
        }
    };
    const handleTimeInputChange = (value, setter, max) => {
        // Remove non-numeric characters
        const numericValue = value.replace(/\D/g, '');
        // Limit to 2 digits and max value
        let finalValue = numericValue.slice(0, 2);
        const numValue = parseInt(finalValue) || 0;
        if (numValue > max) {
            finalValue = max.toString();
        }
        setter(finalValue);
    };
    const handleTimeBlur = (value, setter) => {
        // Pad with zero on blur if needed
        if (value.length === 1) {
            setter(value.padStart(2, '0'));
        }
        else if (value === '') {
            setter('00');
        }
    };
    const handleCustomDateApply = () => {
        if (customStartDate && customEndDate) {
            // Create new dates with the selected time
            const startWithTime = new Date(customStartDate);
            startWithTime.setHours(parseInt(startHour) || 0);
            startWithTime.setMinutes(parseInt(startMinute) || 0);
            startWithTime.setSeconds(0);
            startWithTime.setMilliseconds(0);
            const endWithTime = new Date(customEndDate);
            endWithTime.setHours(parseInt(endHour) || 23);
            endWithTime.setMinutes(parseInt(endMinute) || 59);
            endWithTime.setSeconds(59);
            endWithTime.setMilliseconds(999);
            const newDateRange = {
                startDate: startWithTime,
                endDate: endWithTime,
                preset: 'custom',
            };
            setDateRange(newDateRange);
            // Refresh all reports
            fetchSalesReport(newDateRange);
            fetchInventoryReport(newDateRange);
            fetchProfitReport(newDateRange);
        }
    };
    return (<div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4'>
      <div className='flex items-center space-x-2'>
        <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          Time Period:
        </span>
        <Select value={selectedPreset} onValueChange={handlePresetChange}>
          <SelectTrigger className='w-[180px]'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presets.map((preset) => (<SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {selectedPreset === 'custom' && (<div className='flex flex-wrap items-center gap-3'>
          {/* Start Date & Time */}
          <div className='flex items-center gap-2'>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant='outline' className='w-[140px] justify-start text-left font-normal'>
                  <CalendarIcon className='mr-2 h-4 w-4'/>
                  {customStartDate ? format(customStartDate, 'MMM d, yyyy') : 'Start Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0' align='start'>
                <Calendar mode='single' selected={customStartDate} onSelect={setCustomStartDate} initialFocus/>
              </PopoverContent>
            </Popover>

            <div className='flex items-center gap-1'>
              <Clock className='h-4 w-4 text-gray-500'/>
              <Input type='text' inputMode='numeric' value={startHour} onChange={(e) => handleTimeInputChange(e.target.value, setStartHour, 23)} onBlur={() => handleTimeBlur(startHour, setStartHour)} className='w-14 text-center' placeholder='HH' maxLength={2}/>
              <span className='text-gray-500'>:</span>
              <Input type='text' inputMode='numeric' value={startMinute} onChange={(e) => handleTimeInputChange(e.target.value, setStartMinute, 59)} onBlur={() => handleTimeBlur(startMinute, setStartMinute)} className='w-14 text-center' placeholder='MM' maxLength={2}/>
            </div>
          </div>

          <span className='text-gray-500'>to</span>

          {/* End Date & Time */}
          <div className='flex items-center gap-2'>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant='outline' className='w-[140px] justify-start text-left font-normal'>
                  <CalendarIcon className='mr-2 h-4 w-4'/>
                  {customEndDate ? format(customEndDate, 'MMM d, yyyy') : 'End Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0' align='start'>
                <Calendar mode='single' selected={customEndDate} onSelect={setCustomEndDate} initialFocus/>
              </PopoverContent>
            </Popover>

            <div className='flex items-center gap-1'>
              <Clock className='h-4 w-4 text-gray-500'/>
              <Input type='text' inputMode='numeric' value={endHour} onChange={(e) => handleTimeInputChange(e.target.value, setEndHour, 23)} onBlur={() => handleTimeBlur(endHour, setEndHour)} className='w-14 text-center' placeholder='HH' maxLength={2}/>
              <span className='text-gray-500'>:</span>
              <Input type='text' inputMode='numeric' value={endMinute} onChange={(e) => handleTimeInputChange(e.target.value, setEndMinute, 59)} onBlur={() => handleTimeBlur(endMinute, setEndMinute)} className='w-14 text-center' placeholder='MM' maxLength={2}/>
            </div>
          </div>

          <Button onClick={handleCustomDateApply} disabled={!customStartDate || !customEndDate} size='sm'>
            Apply
          </Button>
        </div>)}

      <div className='rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300'>
        <span className='text-gray-500 dark:text-gray-400'>Selected: </span>
        {format(dateRange.startDate, 'MMM d, yyyy HH:mm')}
        <span className='mx-2 text-gray-400'>→</span>
        {format(dateRange.endDate, 'MMM d, yyyy HH:mm')}
      </div>
    </div>);
};
export default TimePeriodSelector;
