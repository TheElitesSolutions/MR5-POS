'use client';

import { ImagePlus, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { websiteApi } from './api';

interface Props {
  itemUuid: string;
  currentUrl: string | null;
  currentLqip: string | null;
  actor: string;
  onUploaded: (result: { image_url: string; image_lqip: string }) => void;
}

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

export function ImageUploadField({ itemUuid, currentUrl, currentLqip, actor, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const { toast } = useToast();

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast({ title: 'Image too large', description: `Max 5MB; got ${(file.size / 1024 / 1024).toFixed(1)}MB.`, variant: 'destructive' });
      return;
    }
    setBusy(true);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    try {
      const bytes = await file.arrayBuffer();
      const result = await websiteApi.uploadItemImage(itemUuid, bytes, file.type, actor);
      onUploaded(result);
      setPreviewUrl(result.image_url);
      toast({ title: 'Image uploaded' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message ?? 'Unknown error', variant: 'destructive' });
      setPreviewUrl(currentUrl);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
      URL.revokeObjectURL(localPreview);
    }
  }

  const placeholderBg = currentLqip || undefined;

  return (
    <div className='flex items-center gap-3'>
      <div
        className='h-14 w-14 flex-shrink-0 overflow-hidden rounded border bg-muted bg-cover bg-center'
        style={placeholderBg ? { backgroundImage: `url(${placeholderBg})` } : undefined}
      >
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt='Item' className='h-full w-full object-cover' />
        )}
      </div>
      <input
        ref={inputRef}
        type='file'
        accept={ACCEPT}
        className='hidden'
        onChange={handleChange}
      />
      <Button
        type='button'
        size='sm'
        variant='outline'
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className='min-h-[44px]'
      >
        {busy ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <ImagePlus className='mr-2 h-4 w-4' />}
        {currentUrl ? 'Replace' : 'Upload'}
      </Button>
    </div>
  );
}
