'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import { HoursEditor } from './HoursEditor';
import { websiteApi, websiteQueryKeys } from './api';
import type { WeeklyHours } from './types';

const schema = z.object({
  phone: z.string().trim().min(1, 'Phone is required').max(40),
  address: z.string().trim().max(500).optional().nullable(),
  google_maps_url: z
    .string()
    .trim()
    .url({ message: 'Must be a URL' })
    .or(z.literal(''))
    .optional()
    .nullable(),
});
type FormValues = z.infer<typeof schema>;

function actorName(): string {
  try {
    const u = useAuthStore.getState().currentUser as any;
    return u?.username || u?.email || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function RestaurantInfoForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const settingsQ = useQuery({
    queryKey: websiteQueryKeys.settings(),
    queryFn: () => websiteApi.getSettings(),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', address: '', google_maps_url: '' },
  });

  // Hours managed outside RHF (custom editor with non-trivial shape)
  const hours: WeeklyHours = (settingsQ.data?.hours ?? {}) as WeeklyHours;
  const setHours = (next: WeeklyHours) =>
    queryClient.setQueryData(websiteQueryKeys.settings(), (prev: any) =>
      prev ? { ...prev, hours: next } : prev,
    );

  useEffect(() => {
    if (settingsQ.data) {
      form.reset({
        phone: settingsQ.data.phone ?? '',
        address: settingsQ.data.address ?? '',
        google_maps_url: settingsQ.data.google_maps_url ?? '',
      });
    }
  }, [settingsQ.data, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      return websiteApi.updateSettings(
        {
          phone: values.phone,
          address: values.address || null,
          google_maps_url: values.google_maps_url || null,
          hours,
        },
        actorName(),
      );
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(websiteQueryKeys.settings(), updated);
      toast({ title: 'Restaurant info saved' });
    },
    onError: (e: any) =>
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' }),
  });

  if (settingsQ.isLoading) {
    return (
      <div className='flex items-center gap-2 p-6 text-muted-foreground'>
        <Loader2 className='h-4 w-4 animate-spin' /> Loading settings…
      </div>
    );
  }
  if (settingsQ.error) {
    return (
      <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-destructive'>
        Failed to load settings: {(settingsQ.error as Error)?.message}
        <Button variant='outline' size='sm' className='ml-3' onClick={() => settingsQ.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <form
      className='space-y-6'
      onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
    >
      <div className='grid gap-4 md:grid-cols-2'>
        <div className='space-y-1'>
          <Label htmlFor='phone'>Phone</Label>
          <Input id='phone' {...form.register('phone')} placeholder='+961 70 143 784' className='min-h-[44px]' />
          {form.formState.errors.phone && (
            <p className='text-xs text-destructive'>{form.formState.errors.phone.message}</p>
          )}
        </div>
        <div className='space-y-1'>
          <Label htmlFor='google_maps_url'>Google Maps URL</Label>
          <Input id='google_maps_url' {...form.register('google_maps_url')} placeholder='https://maps.app.goo.gl/...' className='min-h-[44px]' />
          {form.formState.errors.google_maps_url && (
            <p className='text-xs text-destructive'>{form.formState.errors.google_maps_url.message}</p>
          )}
        </div>
        <div className='md:col-span-2 space-y-1'>
          <Label htmlFor='address'>Address</Label>
          <Input id='address' {...form.register('address')} placeholder='Street, City, Country' className='min-h-[44px]' />
        </div>
      </div>

      <div className='space-y-2'>
        <Label>Hours</Label>
        <HoursEditor value={hours} onChange={setHours} />
        <p className='text-xs text-muted-foreground'>
          Toggle the switch to mark a day closed. Times are in 24-hour format.
        </p>
      </div>

      <div className='flex justify-end gap-2'>
        <Button type='submit' disabled={saveMutation.isPending} className='min-h-[44px]'>
          {saveMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
