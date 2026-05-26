import type {
  WebsiteAddOn,
  WebsiteCategory,
  WebsiteItem,
  WebsiteSettings,
  WebsiteSettingsPatch,
} from './types';

interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface ElectronWebsiteAPI {
  listItems: () => Promise<IPCResponse<WebsiteItem[]>>;
  listCategories: () => Promise<IPCResponse<WebsiteCategory[]>>;
  listAddOns: () => Promise<IPCResponse<WebsiteAddOn[]>>;
  getSettings: () => Promise<IPCResponse<WebsiteSettings>>;
  updateSettings: (p: { patch: WebsiteSettingsPatch; actor: string }) => Promise<IPCResponse<WebsiteSettings>>;
  reorderItems: (p: { categoryUuid: string; orderedUuids: string[]; actor: string }) => Promise<IPCResponse<{ ok: true }>>;
  setFeatured: (p: { itemUuid: string; value: boolean; actor: string; expectedUpdatedAt?: string }) => Promise<IPCResponse<WebsiteItem>>;
  setVisibility: (p: { itemUuid: string; visible: boolean; actor: string; expectedUpdatedAt?: string }) => Promise<IPCResponse<WebsiteItem>>;
  setCategoryVisibility: (p: { categoryUuid: string; visible: boolean; actor: string }) => Promise<IPCResponse<WebsiteCategory>>;
  bulkSetVisibility: (p: { itemUuids: string[]; visible: boolean; actor: string }) => Promise<IPCResponse<{ count: number }>>;
  updateItemContent: (p: { itemUuid: string; patch: { description?: string | null }; actor: string }) => Promise<IPCResponse<WebsiteItem>>;
  uploadItemImage: (p: { itemUuid: string; bytes: ArrayBuffer; mime: string; actor: string }) => Promise<IPCResponse<{ image_url: string; image_lqip: string }>>;
  resetWebsite: (p: { actor: string }) => Promise<IPCResponse<{ items_reset: number; categories_reset: number }>>;
  // Destructive: wipe Supabase + re-insert from POS. Requires `confirmed: true`
  // — calling without it returns `{ success: true, data: { requiresConfirmation: true } }`.
  syncFromPos: (opts?: { confirmed?: boolean }) => Promise<IPCResponse<SyncResult>>;
}

interface SyncResult {
  requiresConfirmation?: boolean;
  wiped?: { categories_wiped: number; items_wiped: number; addons_wiped: number };
  categoriesSynced: number;
  itemsSynced: number;
  addOnsSynced: number;
}

function getApi(): ElectronWebsiteAPI {
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  const api = w?.electronAPI?.website as ElectronWebsiteAPI | undefined;
  if (!api) {
    // Surface this loudly — without the preload bridge, every Website Manager
    // call will fail and the page will look broken.
    // eslint-disable-next-line no-console
    console.error('[Website Manager] electronAPI.website is not available.', {
      hasWindow: !!w,
      hasElectronAPI: !!w?.electronAPI,
      electronAPIKeys: w?.electronAPI ? Object.keys(w.electronAPI) : null,
    });
    throw new Error(
      'electronAPI.website is not available. Restart the POS dev server (preload changes require a full restart, not just hot reload).',
    );
  }
  return api;
}

function unwrap<T>(r: IPCResponse<T>): T {
  if (r.success && r.data !== undefined) return r.data;
  const msg = r.error || r.message || 'Unknown IPC error';
  if (msg === 'STALE_WRITE') {
    const e = new Error('Stale write — the item was changed elsewhere. Reload and retry.') as Error & { code: 'STALE_WRITE' };
    (e as any).code = 'STALE_WRITE';
    throw e;
  }
  throw new Error(msg);
}

export const websiteApi = {
  listItems: () => getApi().listItems().then(unwrap),
  listCategories: () => getApi().listCategories().then(unwrap),
  listAddOns: () => getApi().listAddOns().then(unwrap),
  getSettings: () => getApi().getSettings().then(unwrap),
  updateSettings: (patch: WebsiteSettingsPatch, actor: string) =>
    getApi().updateSettings({ patch, actor }).then(unwrap),
  reorderItems: (categoryUuid: string, orderedUuids: string[], actor: string) =>
    getApi().reorderItems({ categoryUuid, orderedUuids, actor }).then(unwrap),
  setFeatured: (itemUuid: string, value: boolean, actor: string, expectedUpdatedAt?: string) =>
    getApi().setFeatured({ itemUuid, value, actor, expectedUpdatedAt }).then(unwrap),
  setVisibility: (itemUuid: string, visible: boolean, actor: string, expectedUpdatedAt?: string) =>
    getApi().setVisibility({ itemUuid, visible, actor, expectedUpdatedAt }).then(unwrap),
  bulkSetVisibility: (itemUuids: string[], visible: boolean, actor: string) =>
    getApi().bulkSetVisibility({ itemUuids, visible, actor }).then(unwrap),
  updateItemContent: (itemUuid: string, patch: { description?: string | null }, actor: string) =>
    getApi().updateItemContent({ itemUuid, patch, actor }).then(unwrap),
  uploadItemImage: (itemUuid: string, bytes: ArrayBuffer, mime: string, actor: string) =>
    getApi().uploadItemImage({ itemUuid, bytes, mime, actor }).then(unwrap),
  resetWebsite: (actor: string) =>
    getApi().resetWebsite({ actor }).then(unwrap),
  setCategoryVisibility: (categoryUuid: string, visible: boolean, actor: string) =>
    getApi().setCategoryVisibility({ categoryUuid, visible, actor }).then(unwrap),
  // Destructive wipe-and-replace. Callers MUST pass `{ confirmed: true }`
  // after gathering explicit user consent — without it, the IPC layer returns
  // `requiresConfirmation: true` and the wrapper throws so the UI can react.
  syncFromPos: async (opts?: { confirmed?: boolean }): Promise<SyncResult> => {
    const r = await getApi().syncFromPos(opts);
    if (!r.success) {
      throw new Error(r.error || r.message || 'Sync failed');
    }
    if (!r.data) {
      throw new Error('Sync returned no data');
    }
    if (r.data.requiresConfirmation) {
      throw new Error('Sync requires confirmation but was called without one');
    }
    return r.data;
  },
};

export const websiteQueryKeys = {
  all: ['website'] as const,
  items: () => ['website', 'items'] as const,
  categories: () => ['website', 'categories'] as const,
  addons: () => ['website', 'addons'] as const,
  settings: () => ['website', 'settings'] as const,
};
