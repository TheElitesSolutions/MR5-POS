'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';
export function SegmentedControl({ options, value, onValueChange, fullWidth = false, size = 'md', className, ...props }) {
    return (<div className={cn('relative flex h-fit rounded-lg border bg-muted p-1 shadow-sm', fullWidth ? 'w-full' : 'w-fit', className)} {...props}>
      {options.map(option => {
            const isActive = option.value === value;
            return (<button key={option.value} type='button' onClick={() => onValueChange(option.value)} className={cn('relative flex items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-all', fullWidth ? 'flex-1' : '', size === 'sm'
                    ? 'h-8 text-xs'
                    : size === 'lg'
                        ? 'h-11 px-4 text-base'
                        : 'h-9', isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background/50 hover:text-foreground')} aria-current={isActive ? 'page' : undefined}>
            {option.icon && (<span className={cn('mr-2', size === 'sm'
                        ? 'h-3.5 w-3.5'
                        : size === 'lg'
                            ? 'h-5 w-5'
                            : 'h-4 w-4')}>
                {option.icon}
              </span>)}
            {option.label}
          </button>);
        })}
    </div>);
}
