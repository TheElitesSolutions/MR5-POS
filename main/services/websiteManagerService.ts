/**
 * websiteManagerService.ts
 *
 * Backend service powering the POS "Website Manager" UI. Reads and writes
 * directly against Supabase (over the same HTTPS pattern as supabaseSync.ts);
 * the local SQLite database is intentionally NOT involved.
 *
 * Owned tables/columns (Supabase-only):
 *   item.{display_order, is_featured, image_url, image_lqip, description, updated_at}
 *   category.{display_order, is_visible, image_url, updated_at}
 *   website_settings (singleton, id=1)
 *   website_audit (append-only)
 * Storage bucket: menu-images (public read, service-role write)
 */

import https from 'https';
import { logInfo, logError } from '../error-handler';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './supabaseSync';

// Lazy-loaded so a sharp/native-binding failure can't prevent the rest of the
// service (and the IPC channels it powers) from initializing.
let _sharp: typeof import('sharp') | null = null;
function getSharp(): typeof import('sharp') {
  if (!_sharp) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _sharp = require('sharp');
  }
  return _sharp!;
}

// ---------------------------------------------------------------------------
// Types (mirror MR5-POS/shared/database.types.ts once `supabase gen types` runs)
// ---------------------------------------------------------------------------

export interface WebsiteItem {
  uuid: string;
  id: number;
  name: string;
  description: string | null;
  price: string;
  category_id: number;
  category_uuid: string | null;
  display_order: number;
  is_featured: boolean;
  is_special: boolean;
  isVisibleOnWebsite: boolean;
  image_url: string | null;
  image_lqip: string | null;
  updated_at: string;
}

export interface WebsiteCategory {
  uuid: string;
  id: number;
  name: string;
  display_order: number;
  is_visible: boolean;
  image_url: string | null;
  updated_at: string;
}

export interface WebsiteAddOn {
  addon_uuid: string;
  id: number;
  description: string;
  price: string;
  category_id: number;
}

export interface WebsiteSettings {
  id: 1;
  phone: string | null;
  address: string | null;
  google_maps_url: string | null;
  hero_tagline: string | null;
  header_subtitle: string | null;
  hours: Record<string, { open: string; close: string; closed?: boolean } | null>;
  social: Record<string, string>;
  updated_at: string;
}

export type WebsiteSettingsPatch = Partial<Omit<WebsiteSettings, 'id' | 'updated_at'>>;

export interface ConcurrencyError extends Error {
  code: 'STALE_WRITE';
  current_updated_at?: string;
}

const STORAGE_BUCKET = 'menu-images';
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const IMAGE_MAX_WIDTH = 1600;
const IMAGE_QUALITY = 82;

// ---------------------------------------------------------------------------
// HTTPS helper (PostgREST + Storage)
// ---------------------------------------------------------------------------

interface RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  bodyBuffer?: Buffer;
  contentType?: string;
  headers?: Record<string, string>;
  expectStatus?: number[];
}

function supabaseRequest(opts: RequestOptions): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, SUPABASE_URL);

    const headers: Record<string, string> = {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Accept: 'application/json',
      ...opts.headers,
    };

    let payload: Buffer | string | undefined;
    if (opts.bodyBuffer) {
      payload = opts.bodyBuffer;
      headers['Content-Type'] = opts.contentType || 'application/octet-stream';
      headers['Content-Length'] = String(opts.bodyBuffer.length);
    } else if (opts.body !== undefined) {
      payload = JSON.stringify(opts.body);
      headers['Content-Type'] = opts.contentType || 'application/json';
    }

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: opts.method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode || 0;
          const ok = opts.expectStatus
            ? opts.expectStatus.includes(status)
            : status >= 200 && status < 300;
          if (!ok) {
            const err = new Error(`Supabase HTTP ${status} for ${opts.method} ${opts.path}: ${raw}`);
            logError(err, 'websiteManagerService.request');
            reject(err);
            return;
          }
          try {
            const data = raw ? JSON.parse(raw) : null;
            resolve({ status, data });
          } catch {
            resolve({ status, data: raw });
          }
        });
      },
    );
    req.on('error', (e) => {
      logError(e, 'websiteManagerService.request');
      reject(e);
    });
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WebsiteManagerService {
  // ---------------- Read paths ----------------

  async listItems(): Promise<WebsiteItem[]> {
    const select = [
      'uuid',
      'id',
      'name',
      'description',
      'price',
      'category_id',
      'display_order',
      'is_featured',
      'is_special',
      '"isVisibleOnWebsite"',
      'image_url',
      'image_lqip',
      'updated_at',
    ].join(',');
    const { data } = await supabaseRequest({
      method: 'GET',
      path: `/rest/v1/item?select=${encodeURIComponent(select)}&deleted_at=is.null&order=category_id.asc,display_order.asc,id.asc`,
    });
    return (data || []) as WebsiteItem[];
  }

  async listCategories(): Promise<WebsiteCategory[]> {
    const { data } = await supabaseRequest({
      method: 'GET',
      path: `/rest/v1/category?select=uuid,id,name,display_order,is_visible,image_url,updated_at&deleted_at=is.null&order=display_order.asc,id.asc`,
    });
    return (data || []) as WebsiteCategory[];
  }

  /**
   * Read-only listing of add-ons grouped by category. Add-on CRUD stays in
   * the existing POS /menu page; the Website Manager just shows them so
   * admins can see what extras will appear under each category on the site.
   */
  async listAddOns(): Promise<WebsiteAddOn[]> {
    const { data } = await supabaseRequest({
      method: 'GET',
      path: `/rest/v1/add_on?select=addon_uuid,id,description,price,category_id&deleted_at=is.null&order=category_id.asc,id.asc`,
    });
    return (data || []) as WebsiteAddOn[];
  }

  async getSettings(): Promise<WebsiteSettings> {
    const { data } = await supabaseRequest({
      method: 'GET',
      path: `/rest/v1/website_settings?id=eq.1&select=*`,
    });
    if (!data || data.length === 0) {
      throw new Error('website_settings row missing — run the migration');
    }
    return data[0] as WebsiteSettings;
  }

  // ---------------- Write paths ----------------

  async updateSettings(patch: WebsiteSettingsPatch, actor: string): Promise<WebsiteSettings> {
    const { data } = await supabaseRequest({
      method: 'PATCH',
      path: `/rest/v1/website_settings?id=eq.1`,
      body: patch,
      headers: { Prefer: 'return=representation' },
    });
    const updated = (data && data[0]) as WebsiteSettings;
    await this.audit(actor, 'website_settings', '1', 'update', patch);
    return updated;
  }

  async setFeatured(itemUuid: string, value: boolean, actor: string, expectedUpdatedAt?: string): Promise<WebsiteItem> {
    return this.patchItem(itemUuid, { is_featured: value }, actor, 'set_featured', expectedUpdatedAt);
  }

  async setVisibility(itemUuid: string, visible: boolean, actor: string, expectedUpdatedAt?: string): Promise<WebsiteItem> {
    return this.patchItem(itemUuid, { isVisibleOnWebsite: visible }, actor, 'set_visibility', expectedUpdatedAt);
  }

  /**
   * Toggle a category's visibility on the public Menu. Without this, after a
   * Reset (which sets all `is_visible=false`) the admin has no way to bring
   * categories back even if they re-enable individual items.
   */
  async setCategoryVisibility(categoryUuid: string, visible: boolean, actor: string): Promise<WebsiteCategory> {
    const { data } = await supabaseRequest({
      method: 'PATCH',
      path: `/rest/v1/category?uuid=eq.${categoryUuid}`,
      body: { is_visible: visible },
      headers: { Prefer: 'return=representation' },
    });
    if (!data || data.length === 0) {
      throw new Error('Category not found or update did not return a row');
    }
    const updated = data[0] as WebsiteCategory;
    await this.audit(actor, 'category', categoryUuid, 'set_category_visibility', { is_visible: visible });
    return updated;
  }

  async updateItemContent(itemUuid: string, patch: { description?: string | null }, actor: string): Promise<WebsiteItem> {
    return this.patchItem(itemUuid, patch, actor, 'update_content');
  }

  async bulkSetVisibility(itemUuids: string[], visible: boolean, actor: string): Promise<number> {
    if (itemUuids.length === 0) return 0;
    const inList = itemUuids.map((u) => `"${u}"`).join(',');
    const { data } = await supabaseRequest({
      method: 'PATCH',
      path: `/rest/v1/item?uuid=in.(${inList})`,
      body: { isVisibleOnWebsite: visible },
      headers: { Prefer: 'return=representation' },
    });
    const count = Array.isArray(data) ? data.length : 0;
    await this.audit(actor, 'item', itemUuids.join(','), 'bulk_set_visibility', { isVisibleOnWebsite: visible, count });
    return count;
  }

  /**
   * Atomic per-category reorder via the reorder_items RPC.
   * Sends the full ordered UUID list — last write wins.
   */
  async reorderItems(categoryUuid: string, orderedUuids: string[], actor: string): Promise<void> {
    await supabaseRequest({
      method: 'POST',
      path: `/rest/v1/rpc/reorder_items`,
      body: { p_category: categoryUuid, p_ids: orderedUuids },
    });
    await this.audit(actor, 'item', categoryUuid, 'reorder', { orderedUuids });
  }

  /**
   * Resize via sharp → upload to Storage → write image_url + image_lqip back to item.
   */
  async uploadItemImage(
    itemUuid: string,
    buffer: Buffer,
    mime: string,
    actor: string,
  ): Promise<{ image_url: string; image_lqip: string }> {
    if (buffer.length > IMAGE_MAX_BYTES) {
      throw new Error(`Image too large (${buffer.length} bytes); max ${IMAGE_MAX_BYTES}`);
    }
    if (!/^image\/(jpeg|png|webp)$/i.test(mime)) {
      throw new Error(
        `Unsupported image type: ${mime}. Allowed: JPEG, PNG, WebP. ` +
          `(Convert HEIC/HEIF iPhone photos to JPEG before uploading.)`,
      );
    }

    const sharp = getSharp();
    const main = await sharp(buffer)
      .rotate() // honor EXIF orientation, then strip metadata
      .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: IMAGE_QUALITY })
      .toBuffer();

    const lqipBuffer = await sharp(buffer)
      .resize({ width: 32 })
      .webp({ quality: 40 })
      .toBuffer();
    const lqip = `data:image/webp;base64,${lqipBuffer.toString('base64')}`;

    const objectPath = `items/${itemUuid}.webp`;
    await supabaseRequest({
      method: 'PUT',
      path: `/storage/v1/object/${STORAGE_BUCKET}/${objectPath}`,
      bodyBuffer: main,
      contentType: 'image/webp',
      headers: {
        'x-upsert': 'true',
        'Cache-Control': '31536000',
      },
    });

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}?v=${Date.now()}`;

    const updated = await this.patchItem(
      itemUuid,
      { image_url: publicUrl, image_lqip: lqip },
      actor,
      'upload_image',
    );

    return { image_url: updated.image_url || publicUrl, image_lqip: updated.image_lqip || lqip };
  }

  /**
   * Destructive: hides ALL items + categories AND wipes website-display fields
   * (description, image_url, image_lqip, is_featured, display_order). Used by
   * the "Reset Website" Danger Zone action so the admin can reconfigure fresh.
   * POS-side data (name, price, category) is untouched.
   */
  async resetWebsite(actor: string): Promise<{ items_reset: number; categories_reset: number }> {
    const { data } = await supabaseRequest({
      method: 'POST',
      path: `/rest/v1/rpc/reset_website_state`,
      body: {},
    });
    // PostgREST returns the table-returning RPC as an array of one row.
    const row = (Array.isArray(data) ? data[0] : data) ?? {};
    const result = {
      items_reset: Number(row.items_reset) || 0,
      categories_reset: Number(row.categories_reset) || 0,
    };
    await this.audit(actor, 'website', 'reset', 'reset_website', result);
    return result;
  }

  // ---------------- Internal helpers ----------------

  private async patchItem(
    itemUuid: string,
    patch: Record<string, unknown>,
    actor: string,
    action: string,
    expectedUpdatedAt?: string,
  ): Promise<WebsiteItem> {
    let path = `/rest/v1/item?uuid=eq.${itemUuid}`;
    if (expectedUpdatedAt) {
      path += `&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}`;
    }
    const { data } = await supabaseRequest({
      method: 'PATCH',
      path,
      body: patch,
      headers: { Prefer: 'return=representation' },
    });
    if (!data || data.length === 0) {
      const err = new Error('Stale write — item was modified elsewhere. Reload and retry.') as ConcurrencyError;
      err.code = 'STALE_WRITE';
      throw err;
    }
    const updated = data[0] as WebsiteItem;
    await this.audit(actor, 'item', itemUuid, action, patch);
    return updated;
  }

  private async audit(
    actor: string,
    table_name: string,
    row_id: string,
    action: string,
    diff: unknown,
  ): Promise<void> {
    try {
      await supabaseRequest({
        method: 'POST',
        path: `/rest/v1/website_audit`,
        body: { actor, table_name, row_id, action, diff },
        headers: { Prefer: 'return=minimal' },
      });
    } catch (e) {
      // Audit failures must never block the user-facing op
      logInfo(`[WebsiteManager] audit log skipped: ${(e as Error).message}`);
    }
  }
}

let _instance: WebsiteManagerService | null = null;
export function getWebsiteManagerService(): WebsiteManagerService {
  if (!_instance) _instance = new WebsiteManagerService();
  return _instance;
}
