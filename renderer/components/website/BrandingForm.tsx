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
import { websiteApi, websiteQueryKeys } from './api';

const handleSchema = z.string().trim().max(80).optional().nullable();
const schema = z.object({
  hero_tagline: z.string().trim().max(160).optional().nullable(),
  header_subtitle: z.string().trim().max(160).optional().nullable(),
  social_instagram: handleSchema,
  social_facebook: handleSchema,
  social_tiktok: handleSchema,
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

export function BrandingForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const settingsQ = useQuery({
    queryKey: websiteQueryKeys.settings(),
    queryFn: () => websiteApi.getSettings(),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      hero_tagline: '',
      header_subtitle: '',
      social_instagram: '',
      social_facebook: '',
      social_tiktok: '',
    },
  });

  useEffect(() => {
    if (settingsQ.data) {
      form.reset({
        hero_tagline: settingsQ.data.hero_tagline ?? '',
        header_subtitle: settingsQ.data.header_subtitle ?? '',
        social_instagram: settingsQ.data.social?.instagram ?? '',
        social_facebook: settingsQ.data.social?.facebook ?? '',
        social_tiktok: settingsQ.data.social?.tiktok ?? '',
      });
    }
  }, [settingsQ.data, form]);

  const saveMutation = useMutation({
    mutationFn: (v: FormValues) =>
      websiteApi.updateSettings(
        {
          hero_tagline: v.hero_tagline || null,
          header_subtitle: v.header_subtitle || null,
          social: {
            instagram: v.social_instagram || undefined,
            facebook: v.social_facebook || undefined,
            tiktok: v.social_tiktok || undefined,
          },
        },
        actorName(),
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(websiteQueryKeys.settings(), updated);
      toast({ title: 'Branding saved' });
    },
    onError: (e: any) =>
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' }),
  });

  if (settingsQ.isLoading) {
    return (
      <div className='flex items-center gap-2 p-6 text-muted-foreground'>
        <Loader2 className='h-4 w-4 animate-spin' /> Loading…
      </div>
    );
  }

  return (
    <form className='space-y-6' onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}>
      <div className='grid gap-4 md:grid-cols-2'>
        <div className='space-y-1 md:col-span-2'>
          <Label htmlFor='hero_tagline'>Hero tagline</Label>
          <Input id='hero_tagline' {...form.register('hero_tagline')} placeholder='GRILLED TO PERFECTION' className='min-h-[44px]' />
        </div>
        <div className='space-y-1 md:col-span-2'>
          <Label htmlFor='header_subtitle'>Header subtitle</Label>
          <Input id='header_subtitle' {...form.register('header_subtitle')} placeholder='mr 5' className='min-h-[44px]' />
        </div>

        <div className='md:col-span-2 mt-2 border-t pt-4'>
          <h3 className='mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground'>Social</h3>
        </div>
        <div className='space-y-1'>
          <Label htmlFor='social_instagram'>Instagram</Label>
          <Input id='social_instagram' {...form.register('social_instagram')} placeholder='@yourhandle or full URL' className='min-h-[44px]' />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='social_facebook'>Facebook</Label>
          <Input id='social_facebook' {...form.register('social_facebook')} placeholder='@yourhandle or full URL' className='min-h-[44px]' />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='social_tiktok'>TikTok</Label>
          <Input id='social_tiktok' {...form.register('social_tiktok')} placeholder='@yourhandle or full URL' className='min-h-[44px]' />
        </div>
      </div>

      <div className='flex justify-end'>
        <Button type='submit' disabled={saveMutation.isPending} className='min-h-[44px]'>
          {saveMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          Save branding
        </Button>
      </div>
    </form>
  );
}
