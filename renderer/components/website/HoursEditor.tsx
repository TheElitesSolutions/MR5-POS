'use client';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { DayHours, WeeklyHours } from './types';

const DAYS: Array<{ key: keyof WeeklyHours; label: string }> = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const DEFAULT_DAY: DayHours = { open: '11:00', close: '23:00', closed: false };

interface Props {
  value: WeeklyHours;
  onChange: (next: WeeklyHours) => void;
}

export function HoursEditor({ value, onChange }: Props) {
  function update(day: keyof WeeklyHours, patch: Partial<DayHours>) {
    const current = value[day] || DEFAULT_DAY;
    onChange({ ...value, [day]: { ...current, ...patch } });
  }

  return (
    <div className='space-y-2'>
      {DAYS.map(({ key, label }) => {
        const day = (value[key] || DEFAULT_DAY) as DayHours;
        const closed = !!day.closed;
        return (
          <div
            key={key}
            className='flex items-center gap-3 rounded-md border bg-card p-3'
          >
            <div className='w-12 font-medium'>{label}</div>
            <div className='flex items-center gap-2'>
              <Switch
                checked={!closed}
                onCheckedChange={(open) => update(key, { closed: !open })}
                aria-label={`${label} open`}
              />
              <span className='text-xs text-muted-foreground'>
                {closed ? 'Closed' : 'Open'}
              </span>
            </div>
            <div className='ml-auto flex items-center gap-2'>
              <Input
                type='time'
                value={day.open}
                onChange={(e) => update(key, { open: e.target.value })}
                disabled={closed}
                className='w-28 min-h-[44px]'
              />
              <span className='text-muted-foreground'>–</span>
              <Input
                type='time'
                value={day.close}
                onChange={(e) => update(key, { close: e.target.value })}
                disabled={closed}
                className='w-28 min-h-[44px]'
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
