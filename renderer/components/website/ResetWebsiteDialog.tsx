'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import { websiteApi, websiteQueryKeys } from './api';

const CONFIRM_TEXT = 'CLEAR';

function actorName(): string {
  try {
    const u = useAuthStore.getState().currentUser as any;
    return u?.username || u?.email || 'unknown';
  } catch {
    return 'unknown';
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetWebsiteDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [typed, setTyped] = useState('');

  const resetMutation = useMutation({
    mutationFn: () => websiteApi.resetWebsite(actorName()),
    onSuccess: ({ items_reset, categories_reset }) => {
      toast({
        title: 'Website reset complete',
        description: `${items_reset} item${items_reset === 1 ? '' : 's'} and ${categories_reset} categor${categories_reset === 1 ? 'y' : 'ies'} cleared.`,
      });
      queryClient.invalidateQueries({ queryKey: websiteQueryKeys.all });
      setTyped('');
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({
        title: 'Reset failed',
        description: e?.message ?? 'Unknown error',
        variant: 'destructive',
      }),
  });

  const canConfirm = typed.trim() === CONFIRM_TEXT && !resetMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!resetMutation.isPending) onOpenChange(v); }}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-destructive'>
            <AlertTriangle className='h-5 w-5' />
            Reset website to a blank slate
          </DialogTitle>
          <DialogDescription>
            This is destructive. Continue only if you want a fresh configuration.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 text-sm'>
          <div className='rounded-md border border-destructive/30 bg-destructive/5 p-3'>
            <p className='font-semibold text-destructive'>Will be wiped:</p>
            <ul className='ml-5 mt-1 list-disc space-y-0.5'>
              <li>Visibility for every item and every category (all hidden)</li>
              <li>Featured flags on items</li>
              <li>Item descriptions, photos, and ordering</li>
              <li>Category ordering and category images</li>
            </ul>
          </div>
          <div className='rounded-md border bg-muted/40 p-3'>
            <p className='font-semibold'>Untouched:</p>
            <ul className='ml-5 mt-1 list-disc space-y-0.5 text-muted-foreground'>
              <li>POS item names, prices, and category assignments</li>
              <li>Add-ons themselves (they hide automatically with their categories)</li>
              <li>Restaurant info (phone, address, hours, branding)</li>
              <li>Order history, sales, stock</li>
            </ul>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='reset-confirm'>
              Type <code className='rounded bg-muted px-1.5 py-0.5 font-mono'>{CONFIRM_TEXT}</code> to enable the button:
            </Label>
            <Input
              id='reset-confirm'
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={CONFIRM_TEXT}
              autoComplete='off'
              spellCheck={false}
              className='min-h-[44px] font-mono'
              disabled={resetMutation.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => { setTyped(''); onOpenChange(false); }}
            disabled={resetMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant='destructive'
            disabled={!canConfirm}
            onClick={() => resetMutation.mutate()}
          >
            {resetMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Reset website
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
