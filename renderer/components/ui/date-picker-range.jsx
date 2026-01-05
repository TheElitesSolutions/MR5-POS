'use client';
import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger, } from '@/components/ui/popover';
export function DatePickerWithRange({ date, setDate, className, }) {
    return (<div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button id='date' variant={'outline'} size={'sm'} className={cn('h-9 w-auto min-w-[240px] max-w-[340px] justify-start gap-1.5 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground', !date && 'text-muted-foreground')}>
            <CalendarIcon className='h-3.5 w-3.5 text-muted-foreground'/>
            {date?.from ? (date.to ? (<span className='truncate'>
                  {format(date.from, 'MMM d')} -{' '}
                  {format(date.to, 'MMM d, yyyy')}
                </span>) : (format(date.from, 'MMM d, yyyy'))) : (<span className='text-muted-foreground'>Select date range</span>)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0 shadow-md' align='start'>
          <div className='border-b border-border p-2'>
            <h4 className='text-sm font-medium'>Select date range</h4>
          </div>
          <Calendar initialFocus mode='range' defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2}/>
          <div className='flex items-center justify-end gap-2 border-t border-border p-2'>
            <Button variant='outline' size='sm' className='h-7 text-xs' onClick={() => {
            const today = new Date();
            setDate({
                from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30),
                to: today,
            });
        }}>
              Last 30 days
            </Button>
            <Button size='sm' className='h-7 text-xs' onClick={() => {
            if (date?.from && date?.to) {
                // Close the popover
                document.body.click();
            }
        }}>
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>);
}
