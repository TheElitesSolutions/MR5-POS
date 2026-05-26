'use client';

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, GripVertical, Loader2, RefreshCw, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore, useUserPermissions } from '@/stores/authStore';
import { ImageUploadField } from './ImageUploadField';
import { ResetWebsiteDialog } from './ResetWebsiteDialog';
import { websiteApi, websiteQueryKeys } from './api';
import type { WebsiteAddOn, WebsiteCategory, WebsiteItem } from './types';

function actorName(): string {
  try {
    const u = useAuthStore.getState().currentUser as any;
    return u?.username || u?.email || 'unknown';
  } catch {
    return 'unknown';
  }
}

interface RowProps {
  item: WebsiteItem;
  selected: boolean;
  onSelectChange: (next: boolean) => void;
  onPatched: (next: WebsiteItem) => void;
}

function ItemRow({ item, selected, onSelectChange, onPatched }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.uuid,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const featuredMutation = useMutation({
    mutationFn: (next: boolean) =>
      websiteApi.setFeatured(item.uuid, next, actorName(), item.updated_at),
    onSuccess: (updated) => onPatched(updated),
    onError: (e: any) => toast({ title: 'Featured toggle failed', description: e?.message, variant: 'destructive' }),
  });

  const visibilityMutation = useMutation({
    mutationFn: (visible: boolean) =>
      websiteApi.setVisibility(item.uuid, visible, actorName(), item.updated_at),
    onSuccess: (updated) => onPatched(updated),
    onError: (e: any) => toast({ title: 'Visibility toggle failed', description: e?.message, variant: 'destructive' }),
  });

  const [descDraft, setDescDraft] = useState(item.description ?? '');
  const descMutation = useMutation({
    mutationFn: (description: string | null) =>
      websiteApi.updateItemContent(item.uuid, { description }, actorName()),
    onSuccess: (updated) => {
      onPatched(updated);
      toast({ title: 'Description saved' });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e?.message, variant: 'destructive' }),
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-start gap-3 rounded-lg border bg-card p-3 ${
        selected ? 'ring-2 ring-primary/40' : ''
      }`}
    >
      <div className='flex h-12 items-center pl-1'>
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onSelectChange(!!v)}
          aria-label={`Select ${item.name}`}
        />
      </div>
      <button
        type='button'
        {...attributes}
        {...listeners}
        className='flex h-12 w-8 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing'
        aria-label={`Drag to reorder ${item.name}`}
      >
        <GripVertical className='h-5 w-5' />
      </button>

      <ImageUploadField
        itemUuid={item.uuid}
        currentUrl={item.image_url}
        currentLqip={item.image_lqip}
        actor={actorName()}
        onUploaded={(r) => onPatched({ ...item, image_url: r.image_url, image_lqip: r.image_lqip })}
      />

      <div className='min-w-[200px] flex-1'>
        <div className='flex items-center gap-2 font-medium'>
          {item.name}
          {item.is_featured && <Star className='h-4 w-4 text-amber-500' />}
        </div>
        <div className='text-xs text-muted-foreground'>${item.price}</div>
        <div className='mt-2 flex items-center gap-2'>
          <Input
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            placeholder='Short description (shown on website)'
            className='min-h-[40px]'
          />
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={() => descMutation.mutate(descDraft || null)}
            disabled={descMutation.isPending || descDraft === (item.description ?? '')}
            className='min-h-[40px]'
          >
            Save
          </Button>
        </div>
      </div>

      <div className='flex flex-col items-stretch gap-3'>
        <label className='flex items-center gap-2 text-sm'>
          <Switch
            checked={item.is_featured}
            onCheckedChange={(v) => featuredMutation.mutate(v)}
            disabled={featuredMutation.isPending}
          />
          <span>Featured</span>
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <Switch
            checked={item.isVisibleOnWebsite}
            onCheckedChange={(v) => visibilityMutation.mutate(v)}
            disabled={visibilityMutation.isPending}
          />
          <span>Visible</span>
        </label>
      </div>
    </div>
  );
}

interface CategoryGroupProps {
  category: WebsiteCategory;
  items: WebsiteItem[];
  addOns: WebsiteAddOn[];
  selectedUuids: Set<string>;
  onToggleSelect: (uuid: string, next: boolean) => void;
  onItemsChanged: (next: WebsiteItem[]) => void;
  onCategoryVisibilityChanged: (uuid: string, next: WebsiteCategory) => void;
}

function CategoryGroup({
  category,
  items,
  addOns,
  selectedUuids,
  onToggleSelect,
  onItemsChanged,
  onCategoryVisibilityChanged,
}: CategoryGroupProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorderMutation = useMutation({
    mutationFn: (orderedUuids: string[]) =>
      websiteApi.reorderItems(category.uuid, orderedUuids, actorName()),
    onError: (e: any) => {
      toast({ title: 'Reorder failed', description: e?.message, variant: 'destructive' });
      // Force refetch to recover server truth
      queryClient.invalidateQueries({ queryKey: websiteQueryKeys.items() });
    },
    onSuccess: () => toast({ title: 'Order saved' }),
  });

  const categoryVisibilityMutation = useMutation({
    mutationFn: (visible: boolean) =>
      websiteApi.setCategoryVisibility(category.uuid, visible, actorName()),
    onSuccess: (updated) => {
      onCategoryVisibilityChanged(category.uuid, updated);
      toast({
        title: updated.is_visible ? 'Category shown on website' : 'Category hidden from website',
      });
    },
    onError: (e: any) =>
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' }),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.uuid === active.id);
    const newIndex = items.findIndex((i) => i.uuid === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex).map((it, idx) => ({ ...it, display_order: idx }));
    // Optimistic
    onItemsChanged(next);
    reorderMutation.mutate(next.map((i) => i.uuid));
  }

  const [expanded, setExpanded] = useState(true);

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className={`space-y-2 ${!category.is_visible ? 'opacity-60' : ''}`}
    >
      <header className='flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3'>
        <CollapsibleTrigger asChild>
          <button
            type='button'
            className='flex flex-1 items-center gap-3 text-left hover:text-primary'
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${category.name}`}
          >
            <ChevronDown
              className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform ${expanded ? '' : '-rotate-90'}`}
            />
            <h2 className='text-lg font-semibold'>{category.name}</h2>
            {!category.is_visible && (
              <span className='rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'>
                Hidden from website
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        <div className='flex items-center gap-4'>
          <span className='text-xs text-muted-foreground'>
            {items.length} item{items.length === 1 ? '' : 's'}
            {addOns.length > 0 && ` · ${addOns.length} add-on${addOns.length === 1 ? '' : 's'}`}
          </span>
          <label
            className='flex items-center gap-2 text-sm'
            onClick={(e) => e.stopPropagation()}
          >
            <Switch
              checked={category.is_visible}
              onCheckedChange={(v) => categoryVisibilityMutation.mutate(v)}
              disabled={categoryVisibilityMutation.isPending}
              aria-label={`Show category ${category.name} on website`}
            />
            <span>Show on website</span>
          </label>
        </div>
      </header>
      <CollapsibleContent>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.filter((i) => i?.uuid).map((i) => i.uuid)} strategy={verticalListSortingStrategy}>
          <div className='space-y-2'>
            {items.length === 0 ? (
              <div className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>
                No items in this category.
              </div>
            ) : (
              items.map((item) => (
                <ItemRow
                  key={item.uuid}
                  item={item}
                  selected={selectedUuids.has(item.uuid)}
                  onSelectChange={(v) => onToggleSelect(item.uuid, v)}
                  onPatched={(next) => onItemsChanged(items.map((i) => (i.uuid === next.uuid ? next : i)))}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {addOns.length > 0 && (
        <details className='ml-4 rounded-md border bg-muted/30 p-3 text-sm'>
          <summary className='cursor-pointer font-medium'>
            Add-ons in this category ({addOns.length})
          </summary>
          <ul className='mt-2 space-y-1 text-muted-foreground'>
            {addOns.map((a) => (
              <li key={a.addon_uuid} className='flex justify-between'>
                <span>{a.description}</span>
                <span className='font-mono'>+${a.price}</span>
              </li>
            ))}
          </ul>
          <p className='mt-2 text-xs italic'>
            Add-ons are managed under POS → Menu. They appear under this category on the public site
            when the category is visible.
          </p>
        </details>
      )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function WebsiteItemsTable() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());
  const [resetOpen, setResetOpen] = useState(false);
  const permissions = useUserPermissions();
  const isAdmin = permissions.isAdmin;
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const itemsQ = useQuery({
    queryKey: websiteQueryKeys.items(),
    queryFn: () => websiteApi.listItems(),
  });
  const categoriesQ = useQuery({
    queryKey: websiteQueryKeys.categories(),
    queryFn: () => websiteApi.listCategories(),
  });
  const addOnsQ = useQuery({
    queryKey: websiteQueryKeys.addons(),
    queryFn: () => websiteApi.listAddOns(),
  });

  // Auto-syncing on mount/focus was removed: sync is now a destructive
  // wipe-and-replace that deletes every Website Manager customization. It must
  // never run implicitly. Admins press the explicit Sync button below, which
  // requires confirmation. `autoSyncing` is kept (always false) only so the
  // spinner / disabled-state expressions in the JSX don't need to change.
  const [autoSyncing] = useState(false);

  const [manualSyncing, setManualSyncing] = useState(false);
  async function manualSync() {
    const ok = window.confirm(
      'Replace the website menu with your POS data?\n\n' +
        'This will delete every category, item, and add-on currently on the ' +
        'website and re-insert them from the POS. Website customizations ' +
        '(descriptions, uploaded images, featured / visibility settings) will ' +
        'be lost. This cannot be undone.',
    );
    if (!ok) return;

    setManualSyncing(true);
    try {
      const result = await websiteApi.syncFromPos({ confirmed: true });
      await queryClient.invalidateQueries({ queryKey: websiteQueryKeys.all });
      const wipedSummary = result.wiped
        ? `Wiped ${result.wiped.categories_wiped} categories, ${result.wiped.items_wiped} items, ${result.wiped.addons_wiped} add-ons. `
        : '';
      toast({
        title: 'Website menu replaced from POS',
        description: `${wipedSummary}Inserted ${result.categoriesSynced} categories, ${result.itemsSynced} items, ${result.addOnsSynced} add-ons.`,
        duration: 8000,
      });
    } catch (e: any) {
      toast({ title: 'Sync failed', description: e?.message, variant: 'destructive', duration: 15000 });
    } finally {
      setManualSyncing(false);
    }
  }

  // Local optimistic state derived from query data, mutable for reorder/patch
  const [overrides, setOverrides] = useState<Record<string, WebsiteItem>>({});
  const [orderOverrides, setOrderOverrides] = useState<Record<number, string[]>>({}); // category_id → uuids order

  const grouped = useMemo(() => {
    if (!itemsQ.data || !categoriesQ.data) return [];
    // Defensive: skip any Supabase row with a missing uuid / id. These can
    // exist as orphan leftovers from the pre-fix sync state, and they crash
    // @dnd-kit's SortableContext (which does `'id' in item` internally) with
    // a confusing "Cannot use 'in' operator to search for 'id' in null" error.
    // After a clean wipe-and-replace sync this filter is a no-op.
    const validItems = itemsQ.data.filter(
      (i): i is WebsiteItem => !!i && typeof i.uuid === 'string' && typeof i.category_id === 'number',
    );
    const validCategories = categoriesQ.data.filter(
      (c): c is WebsiteCategory => !!c && typeof c.uuid === 'string' && typeof c.id === 'number',
    );
    const validAddOns = (addOnsQ.data || []).filter(
      (a): a is WebsiteAddOn => !!a && typeof a.category_id === 'number',
    );

    const itemsByCategoryId = new Map<number, WebsiteItem[]>();
    for (const raw of validItems) {
      const item = overrides[raw.uuid] ?? raw;
      const list = itemsByCategoryId.get(item.category_id) || [];
      list.push(item);
      itemsByCategoryId.set(item.category_id, list);
    }
    const addOnsByCategoryId = new Map<number, WebsiteAddOn[]>();
    for (const a of validAddOns) {
      const list = addOnsByCategoryId.get(a.category_id) || [];
      list.push(a);
      addOnsByCategoryId.set(a.category_id, list);
    }
    // Manager UI shows ALL categories regardless of website visibility, so the
    // user can manage hidden ones too. The Menu side enforces visibility via RLS.
    return validCategories
      .map((cat) => {
        let items = (itemsByCategoryId.get(cat.id) || []).slice();
        const customOrder = orderOverrides[cat.id];
        if (customOrder) {
          const map = new Map(items.map((i) => [i.uuid, i] as const));
          items = customOrder.map((u) => map.get(u)!).filter(Boolean);
        } else {
          items.sort((a, b) => a.display_order - b.display_order || a.id - b.id);
        }
        const addOns = (addOnsByCategoryId.get(cat.id) || []).slice();
        return { category: cat, items, addOns };
      });
  }, [itemsQ.data, categoriesQ.data, addOnsQ.data, overrides, orderOverrides]);

  const bulkVisibilityMutation = useMutation<
    { count: number },
    Error,
    { visible: boolean; uuids: string[] }
  >({
    mutationFn: ({ visible, uuids }) =>
      websiteApi.bulkSetVisibility(uuids, visible, actorName()),
    onSuccess: ({ count }, { visible, uuids }) => {
      const verb = visible ? 'Showed' : 'Hid';
      toast({
        title: `${verb} ${count} item${count === 1 ? '' : 's'} on website`,
        duration: 30_000,
        action: (
          <ToastAction
            altText='Undo'
            onClick={() => {
              websiteApi
                .bulkSetVisibility(uuids, !visible, actorName())
                .then(() => {
                  toast({ title: 'Undone' });
                  queryClient.invalidateQueries({ queryKey: websiteQueryKeys.items() });
                })
                .catch((e: any) =>
                  toast({ title: 'Undo failed', description: e?.message, variant: 'destructive' }),
                );
            }}
          >
            Undo
          </ToastAction>
        ),
      });
      setSelectedUuids(new Set());
      queryClient.invalidateQueries({ queryKey: websiteQueryKeys.items() });
    },
    onError: (e: any) =>
      toast({ title: 'Bulk update failed', description: e?.message, variant: 'destructive' }),
  });

  function bulkSet(visible: boolean) {
    const uuids = Array.from(selectedUuids);
    if (uuids.length === 0) return;
    if (uuids.length > 5) {
      const ok = window.confirm(`Apply to ${uuids.length} items?`);
      if (!ok) return;
    }
    bulkVisibilityMutation.mutate({ visible, uuids });
  }

  function toggleSelect(uuid: string, next: boolean) {
    setSelectedUuids((prev) => {
      const out = new Set(prev);
      if (next) out.add(uuid);
      else out.delete(uuid);
      return out;
    });
  }

  if (itemsQ.isLoading || categoriesQ.isLoading) {
    return (
      <div className='flex items-center gap-2 p-6 text-muted-foreground'>
        <Loader2 className='h-4 w-4 animate-spin' /> Loading items…
      </div>
    );
  }
  if (itemsQ.error || categoriesQ.error || addOnsQ.error) {
    return (
      <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-destructive'>
        Failed to load website data:{' '}
        {(itemsQ.error || categoriesQ.error || addOnsQ.error)?.toString()}
        <Button
          variant='outline'
          size='sm'
          className='ml-3'
          onClick={() => {
            itemsQ.refetch();
            categoriesQ.refetch();
            addOnsQ.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-muted-foreground'>
          All POS categories, items, and add-ons are listed here. Toggle{' '}
          <strong>Show on website</strong> per category and item to publish them.
          {(autoSyncing || manualSyncing) && (
            <span className='ml-2 inline-flex items-center gap-1 text-xs italic'>
              <Loader2 className='h-3 w-3 animate-spin' /> syncing latest POS changes…
            </span>
          )}
        </p>
        <Button
          variant='outline'
          size='sm'
          onClick={manualSync}
          disabled={manualSyncing || autoSyncing}
          className='min-h-[40px]'
          title='Push any newly-created or edited POS items / categories / add-ons to Supabase, then refresh.'
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${manualSyncing || autoSyncing ? 'animate-spin' : ''}`} />
          {manualSyncing || autoSyncing ? 'Syncing…' : 'Sync from POS'}
        </Button>
      </div>

      {selectedUuids.size > 0 && (
        <div className='sticky top-0 z-10 flex items-center gap-2 rounded-md border bg-muted/60 p-2 backdrop-blur'>
          <span className='text-sm font-medium'>{selectedUuids.size} selected</span>
          <Button size='sm' variant='outline' onClick={() => bulkSet(true)} disabled={bulkVisibilityMutation.isPending}>
            Show on website
          </Button>
          <Button size='sm' variant='outline' onClick={() => bulkSet(false)} disabled={bulkVisibilityMutation.isPending}>
            Hide from website
          </Button>
          <Button size='sm' variant='ghost' onClick={() => setSelectedUuids(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {grouped.length === 0 && (
        <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
          <p className='font-medium'>No categories returned from Supabase.</p>
          <p className='mt-2'>
            Items: <strong>{itemsQ.data?.length ?? 0}</strong>
            {' · '}
            Categories: <strong>{categoriesQ.data?.length ?? 0}</strong>
            {' · '}
            Add-ons: <strong>{addOnsQ.data?.length ?? 0}</strong>
          </p>
          <p className='mt-2 text-xs'>
            If you just created data in POS → Menu, click <strong>Sync from POS</strong> above.
            If counts stay at 0, the migration may not have applied or the WebsiteController
            failed to start. Check the dev console and main-process logs.
          </p>
          <Button
            variant='outline'
            size='sm'
            className='mt-3'
            onClick={() => {
              itemsQ.refetch();
              categoriesQ.refetch();
              addOnsQ.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {grouped.map(({ category, items, addOns }) => (
        <CategoryGroup
          key={category.uuid}
          category={category}
          items={items}
          addOns={addOns}
          selectedUuids={selectedUuids}
          onToggleSelect={toggleSelect}
          onCategoryVisibilityChanged={(uuid, updated) => {
            queryClient.setQueryData(websiteQueryKeys.categories(), (prev: any) => {
              if (!Array.isArray(prev)) return prev;
              return prev.map((c: WebsiteCategory) => (c.uuid === uuid ? updated : c));
            });
          }}
          onItemsChanged={(next) => {
            // Persist order locally
            setOrderOverrides((prev) => ({ ...prev, [category.id]: next.map((i) => i.uuid) }));
            // Persist any per-item field changes
            setOverrides((prev) => {
              const updated = { ...prev };
              for (const it of next) updated[it.uuid] = it;
              return updated;
            });
          }}
        />
      ))}

      {isAdmin && (
        <div className='mt-12 rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4'>
          <div className='flex flex-wrap items-start gap-3'>
            <AlertTriangle className='mt-0.5 h-5 w-5 flex-shrink-0 text-destructive' />
            <div className='flex-1 min-w-[240px]'>
              <h3 className='font-semibold text-destructive'>Danger Zone</h3>
              <p className='mt-1 text-sm text-muted-foreground'>
                Reset the website to a blank slate. Hides every item and category, wipes
                descriptions / images / featured flags / ordering. POS data is unaffected.
                You'll start a fresh configuration from scratch.
              </p>
            </div>
            <Button
              variant='destructive'
              onClick={() => setResetOpen(true)}
              disabled={!online}
              title={!online ? 'Reset requires an internet connection' : undefined}
              className='min-h-[44px]'
            >
              <Trash2 className='mr-2 h-4 w-4' />
              Reset Website
            </Button>
          </div>
        </div>
      )}

      <ResetWebsiteDialog open={resetOpen} onOpenChange={setResetOpen} />
    </div>
  );
}
