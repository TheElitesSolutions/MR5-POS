/**
 * supabaseSync.ts — bidirectional sync between local SQLite (POS) and Supabase.
 *
 * NAMING POLICY: POS TypeScript interfaces use camelCase; Supabase columns are
 * snake_case, except a few legacy mixed-case identifiers like "isVisibleOnWebsite"
 * which are preserved for backward compatibility. This file is the ONLY place
 * that translates between the two — keep all mapping logic localized here.
 *
 * WEBSITE MANAGER FIELDS — DO NOT ADD TO THIS FILE:
 *   item:     "isVisibleOnWebsite", display_order, is_featured, image_url,
 *             image_lqip, description, updated_at
 *   category: display_order, is_visible, image_url, updated_at
 *   tables:   website_settings, website_audit
 * These fields are Supabase-authoritative. They are read and written directly by
 * `services/websiteManagerService.ts` over the same HTTP client. They MUST NOT be
 * added to the upsert payloads below or to the local SQLite mirror — doing so
 * would race with Website Manager edits and silently clobber them.
 *
 * NOTE on isVisibleOnWebsite: this column was previously pushed by the sync
 * (race-fix in iter 2 removed it). The Supabase column default is `true`, so
 * newly created POS items still appear on the public Menu by default. Admins
 * use the Website Manager to hide them — and the "Reset Website" Danger Zone
 * action to wipe everything in one click.
 */

import { PrismaClient } from '../db/prisma-wrapper';
import { getDatabase } from '../db/index';
import { logInfo, logError } from '../error-handler';
import Decimal from 'decimal.js';
import { getCurrentLocalDateTime } from '../utils/dateTime';
import https from 'https';

// Hardcoded Supabase credentials.
// NOTE: re-exported below so services in this folder can reuse the same
// project + service-role key without duplicating the literal. Replacing this
// with secure storage is tracked as a separate ticket (see plan §"Deferred").
export const SUPABASE_URL = 'https://buivobulqaryifxesvqo.supabase.co';
export const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aXZvYnVscWFyeWlmeGVzdnFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDcyNDUxNSwiZXhwIjoyMDY2MzAwNTE1fQ.-G0GXB57aRlD9VldrkTeBb_l5lDlkXl385-qYpgdpoE';

/**
 * Convert SQLite hex ID to PostgreSQL UUID format
 * Input: 32 hex characters (e.g., "550e8400e29b41d4a716446655440000")
 * Output: UUID format (e.g., "550e8400-e29b-41d4-a716-446655440000")
 *
 * If input is not 32 characters, pads with zeros
 * If input contains invalid hex characters, sanitizes them
 */
function formatHexAsUuid(hexId: string): string {
  if (!hexId || typeof hexId !== 'string') {
    throw new Error(`Invalid hex ID: ${hexId}`);
  }

  // Remove any existing hyphens
  let cleanHex = hexId.replace(/-/g, '').toLowerCase();

  // Check for invalid hex characters and sanitize
  if (!/^[0-9a-f]*$/i.test(cleanHex)) {
    const invalidChars = cleanHex.match(/[^0-9a-f]/gi);
    logInfo(`⚠️ Invalid hex ID detected: "${hexId}" - contains non-hex characters: ${invalidChars?.join(', ')}`);
    logInfo(`   This is likely a test record. Sanitizing by replacing invalid chars with '0'`);

    // Sanitize: replace invalid hex chars with '0'
    cleanHex = cleanHex.replace(/[^0-9a-f]/gi, '0');
    logInfo(`   Sanitized to: "${cleanHex}"`);
  }

  // If too short, pad with zeros on the right
  let paddedHex = cleanHex;
  if (cleanHex.length < 32) {
    logInfo(`⚠️ Short hex ID detected (${cleanHex.length} chars): "${hexId}" - padding to 32 chars`);
    paddedHex = cleanHex.padEnd(32, '0');
  } else if (cleanHex.length > 32) {
    // If too long, truncate (shouldn't happen but handle it)
    logInfo(`⚠️ Long hex ID detected (${cleanHex.length} chars): "${hexId}" - truncating to 32 chars`);
    paddedHex = cleanHex.substring(0, 32);
  }

  // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuid = [
    paddedHex.substring(0, 8),
    paddedHex.substring(8, 12),
    paddedHex.substring(12, 16),
    paddedHex.substring(16, 20),
    paddedHex.substring(20, 32)
  ].join('-');

  return uuid;
}

/**
 * Simple HTTP client for Supabase REST API
 * This bypasses the need for the @supabase/supabase-js SDK which has loading issues in Electron
 */
export class SupabaseHTTPClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(url: string, apiKey: string) {
    this.baseUrl = url;
    this.apiKey = apiKey;
  }

  private async request(method: string, path: string, body?: any, customHeaders?: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);

      // LOG REQUEST
      logInfo(`[Sync HTTP] ${method} ${url.pathname}${url.search}`);
      console.log(`[Sync HTTP] 🔍 ${method} ${url.pathname}${url.search}`);
      if (body) {
        logInfo(`[Sync HTTP] Body: ${JSON.stringify(body)}`);
        console.log(`[Sync HTTP] 📦 Body:`, body);
      }

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
          ...customHeaders,  // Merge custom headers (can override Prefer)
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          // LOG RESPONSE
          logInfo(`[Sync HTTP] Response ${res.statusCode}`);
          console.log(`[Sync HTTP] 📥 Response ${res.statusCode}`);

          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsedData = data ? JSON.parse(data) : null;

              // ✅ FIX: Log upsert details for debugging
              if (method === 'POST' && path.includes('/rest/v1/')) {
                const recordCount = Array.isArray(parsedData) ? parsedData.length : (parsedData ? 1 : 0);
                console.log(`[Sync HTTP] 📊 Upserted ${recordCount} record(s)`);
              }

              resolve(parsedData);
            } catch (e) {
              const errorMsg = `Failed to parse JSON: ${e}`;
              logError(new Error(errorMsg), 'request');
              console.error(`[Sync HTTP] ❌ ${errorMsg}`);
              reject(new Error(errorMsg));
            }
          } else {
            const errorMsg = `HTTP ${res.statusCode}: ${data}`;
            logError(new Error(errorMsg), 'request');
            console.error(`[Sync HTTP] ❌ ${errorMsg}`);
            reject(new Error(errorMsg));
          }
        });
      });

      req.on('error', (e) => {
        logError(e, 'request');
        console.error(`[Sync HTTP] ❌ Request error:`, e.message);
        reject(e);
      });
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  from(table: string) {
    return {
      select: (columns: string = '*') => {
        // Return a query builder that is properly awaitable
        let url = `/rest/v1/${table}?select=${columns}`;
        const self = this;
        
        const builder: any = {
          eq: (column: string, value: any) => {
            url += `&${column}=eq.${value}`;
            return {
              single: async () => {
                const data = await self.request('GET', url);
                return { data: Array.isArray(data) ? data[0] : data, error: null };
              }
            };
          }
        };
        
        // Make the builder awaitable
        builder.then = function(resolve: any, reject: any) {
          return self.request('GET', url)
            .then(data => resolve({ data, error: null }))
            .catch(err => reject ? reject(err) : resolve({ data: null, error: err }));
        };
        
        return builder;
      },
      insert: async (records: any | any[]) => {
        try {
          const data = await this.request('POST', `/rest/v1/${table}`, records);
          return { data, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
      upsert: async (records: any | any[], options?: { onConflict?: string }) => {
        try {
          // Build query params - onConflict must be string, not array
          // columns parameter does NOT exist in Supabase API
          const params = new URLSearchParams();
          if (options?.onConflict) {
            params.append('on_conflict', options.onConflict);  // ✅ String param
          }
          const queryString = params.toString() ? `?${params.toString()}` : '';

          // PostgREST upsert: 'resolution=merge-duplicates' tells the server to
          // run INSERT ... ON CONFLICT DO UPDATE; without it, conflicts on the
          // on_conflict target may be silently ignored (no UPDATE applied).
          // 'return=representation' returns the upserted rows in the body.
          const data = await this.request('POST', `/rest/v1/${table}${queryString}`, records, {
            'Prefer': 'resolution=merge-duplicates,return=representation'
          });
          return { data, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
      delete: () => ({
        eq: async (column: string, value: any) => {
          try {
            const data = await this.request('DELETE', `/rest/v1/${table}?${column}=eq.${value}`);
            return { data, error: null };
          } catch (err) {
            return { data: null, error: err };
          }
        },
        in: async (column: string, values: any[]) => {
          try {
            const data = await this.request('DELETE', `/rest/v1/${table}?${column}=in.(${values.map(v => `"${v}"`).join(',')})`);
            return { data, error: null };
          } catch (err) {
            return { data: null, error: err };
          }
        },
      }),
      // PATCH a single existing row by a unique column (typically `id`).
      // Retained for the per-action `syncMenuItem`/`syncCategory` paths that
      // still need to update single rows by primary key. The bulk wipe-replace
      // sync no longer uses this — it deletes-then-inserts via the RPC.
      patch: async (
        filterColumn: string,
        filterValue: any,
        payload: Record<string, any>,
      ) => {
        try {
          const data = await this.request(
            'PATCH',
            `/rest/v1/${table}?${filterColumn}=eq.${filterValue}`,
            payload,
            { Prefer: 'return=representation' },
          );
          return { data, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
    };
  }

  /**
   * Invoke a Postgres function via PostgREST's /rpc endpoint.
   * Errors throw (no { data, error } wrapping) so callers can let them
   * propagate up to the sync abort-on-error policy.
   */
  async rpc(functionName: string, args: Record<string, any> = {}): Promise<any> {
    return this.request('POST', `/rest/v1/rpc/${functionName}`, args);
  }
}

/**
 * Supabase Sync Service
 * Syncs active menu items from PostgreSQL to Supabase for public website
 * Only syncs items where isActive = true
 */
export class SupabaseSyncService {
  private supabase: SupabaseHTTPClient;
  private prisma: PrismaClient;
  private isSyncing: boolean = false;
  private lastSyncTime: Date | null = null;
  private lastSyncStatus: 'success' | 'error' | 'pending' = 'pending';
  private lastSyncError: string | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    // CRITICAL: Ensure Prisma client is fully initialized before use
    // This triggers lazy initialization of all model properties (menuItem, category, etc.)
    this.prisma.ensureInitialized();
    this.supabase = new SupabaseHTTPClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    logInfo('✅ Supabase HTTP client initialized with hardcoded credentials');
    logInfo('✅ Prisma client initialized for sync service');
  }

  /**
   * Check if Supabase is configured and available
   */
  public isConfigured(): boolean {
    return true; // Always configured with hardcoded credentials
  }

  /**
   * Get sync status information
   */
  public getSyncStatus() {
    return {
      isConfigured: this.isConfigured(),
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      lastSyncStatus: this.lastSyncStatus,
      lastSyncError: this.lastSyncError,
    };
  }

  /**
   * Wipe-and-replace sync. The POS is the single source of truth: this calls
   * the `wipe_menu_state` Supabase RPC to delete every category/item/add-on
   * server-side in one transaction, then re-inserts the full local menu state.
   *
   * Destructive — Website Manager fields (description, image_url, is_featured,
   * display_order, visibility) are lost on every sync by design. Callers MUST
   * gather explicit user confirmation before invoking with `confirmed: true`.
   * Without `confirmed: true`, this returns `{ requiresConfirmation: true }`
   * and does NOT touch Supabase.
   *
   * Error policy: abort on first hard error. The surface error string carries
   * the underlying Supabase / PostgREST message so the UI toast is actionable.
   */
  public async syncAll(opts?: { confirmed?: boolean }): Promise<{
    success: boolean;
    requiresConfirmation?: boolean;
    wiped?: { categories_wiped: number; items_wiped: number; addons_wiped: number };
    categoriesSynced: number;
    itemsSynced: number;
    addOnsSynced: number;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      const error = 'Supabase not configured';
      logError(new Error(error), 'SupabaseSync');
      return {
        success: false,
        categoriesSynced: 0,
        itemsSynced: 0,
        addOnsSynced: 0,
        error,
      };
    }

    if (!opts?.confirmed) {
      // Destructive operation — refuse without explicit confirmation.
      return {
        success: false,
        categoriesSynced: 0,
        itemsSynced: 0,
        addOnsSynced: 0,
        requiresConfirmation: true,
      };
    }

    if (this.isSyncing) {
      logInfo('Sync already in progress, skipping...');
      return {
        success: false,
        categoriesSynced: 0,
        itemsSynced: 0,
        addOnsSynced: 0,
        error: 'Sync already in progress',
      };
    }

    this.isSyncing = true;
    this.lastSyncStatus = 'pending';
    const startTime = Date.now();

    try {
      logInfo('🔄 Starting wipe-and-replace sync to Supabase...');

      // 1. Wipe ALL menu state server-side in one transaction.
      const wiped = await this.wipeRemote();
      logInfo(
        `🗑️  Wiped — categories: ${wiped.categories_wiped}, ` +
          `items: ${wiped.items_wiped}, addons: ${wiped.addons_wiped}`
      );

      // 2. Insert the POS's full local menu state, in FK order.
      const categoriesSynced = await this.insertCategories();
      const itemsSynced = await this.insertMenuItems();
      const addOnsSynced = await this.insertAddOns();

      const duration = Date.now() - startTime;
      this.lastSyncTime = new Date();
      this.lastSyncStatus = 'success';
      this.lastSyncError = null;

      logInfo(
        `✅ Sync completed in ${duration}ms — ` +
          `wiped: ${wiped.categories_wiped}/${wiped.items_wiped}/${wiped.addons_wiped}, ` +
          `inserted: ${categoriesSynced}/${itemsSynced}/${addOnsSynced}`
      );

      return {
        success: true,
        wiped,
        categoriesSynced,
        itemsSynced,
        addOnsSynced,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.lastSyncStatus = 'error';
      this.lastSyncError = errorMessage;
      logError(error as Error, 'SupabaseSync');

      return {
        success: false,
        categoriesSynced: 0,
        itemsSynced: 0,
        addOnsSynced: 0,
        error: errorMessage,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Call the server-side `wipe_menu_state` RPC. Deletes all rows from
   * add_on → item → category in a single transaction.
   */
  private async wipeRemote(): Promise<{
    categories_wiped: number;
    items_wiped: number;
    addons_wiped: number;
  }> {
    if (!this.supabase) throw new Error('Supabase not initialized');
    const data = await this.supabase.rpc('wipe_menu_state', {});
    // PostgREST may return the jsonb directly or wrap it in a single-element
    // array depending on the function's return type. Handle both.
    const result = (Array.isArray(data) ? data[0] : data) ?? {};
    return {
      categories_wiped: Number(result.categories_wiped) || 0,
      items_wiped: Number(result.items_wiped) || 0,
      addons_wiped: Number(result.addons_wiped) || 0,
    };
  }

  /**
   * Insert all local active categories into Supabase.
   * Pre-condition: `wipe_menu_state` RPC has already run, so the `category`
   * table is empty. No adoption, no upsert, no conflict resolution needed.
   */
  private async insertCategories(): Promise<number> {
    if (!this.supabase) throw new Error('Supabase not initialized');
    const db = getDatabase();

    const localCategories = db.prepare(`
      SELECT id as uuid, name
      FROM categories
      WHERE isActive = 1
        AND name IS NOT NULL
      ORDER BY sortOrder
    `).all() as Array<{ uuid: string; name: string }>;

    const rows = localCategories
      .map(cat => ({ uuid: formatHexAsUuid(cat.uuid), name: cat.name }))
      .filter(cat => {
        if (!cat.name || cat.name.trim() === '') {
          logInfo(`⚠️ Skipping category with invalid name: UUID=${cat.uuid}`);
          return false;
        }
        return true;
      })
      .map(cat => ({ uuid: cat.uuid, name: cat.name, deleted_at: null }));

    if (rows.length === 0) {
      logInfo('No active categories to insert');
      return 0;
    }

    const { error } = await this.supabase.from('category').insert(rows);
    if (error) throw error;
    logInfo(`✅ Inserted ${rows.length} categories`);
    return rows.length;
  }

  /**
   * Insert all local active menu items into Supabase.
   * Pre-condition: `insertCategories` has already populated the `category`
   * table — we re-fetch it to build the local-UUID → integer-FK map.
   *
   * isVisibleOnWebsite is intentionally omitted from the payload — the
   * Supabase column default is `true`, so newly inserted items appear on the
   * public Menu by default. Admins use Website Manager (post-sync) to hide
   * individual items.
   */
  private async insertMenuItems(): Promise<number> {
    if (!this.supabase) throw new Error('Supabase not initialized');
    const db = getDatabase();

    const { data: supabaseCategories, error: catError } = await this.supabase
      .from('category')
      .select('id, uuid');

    if (catError) throw catError;

    const categoryMap = new Map<string, number>(
      (supabaseCategories || []).map((c: any) => [c.uuid as string, c.id as number])
    );

    const localItems = db.prepare(`
      SELECT
        m.id as uuid,
        m.name,
        m.price,
        m.categoryId as category_uuid
      FROM menu_items m
      WHERE m.isActive = 1
        AND m.name IS NOT NULL
        AND m.price IS NOT NULL
    `).all() as Array<{
      uuid: string;
      name: string;
      price: string;
      category_uuid: string;
    }>;

    const rows: any[] = [];
    for (const item of localItems) {
      if (!item.name || item.name.trim() === '' || !item.price) {
        logInfo(`⚠️ Skipping menu item with invalid name/price: UUID=${item.uuid}`);
        continue;
      }
      const itemUuid = formatHexAsUuid(item.uuid);
      const categoryUuid = formatHexAsUuid(item.category_uuid);
      const category_id = categoryMap.get(categoryUuid);
      if (!category_id) {
        logInfo(
          `⚠️ Skipping item "${item.name}" — category UUID ${categoryUuid} not found in Supabase`,
        );
        continue;
      }
      rows.push({
        uuid: itemUuid,
        name: item.name,
        price: item.price,
        is_special: false,
        category_id,
        deleted_at: null,
      });
    }

    if (rows.length === 0) {
      logInfo('No active menu items to insert');
      return 0;
    }

    const { error } = await this.supabase.from('item').insert(rows);
    if (error) throw error;
    logInfo(`✅ Inserted ${rows.length} menu items`);
    return rows.length;
  }

  /**
   * Insert all local active add-on assignments into Supabase.
   * Pre-condition: `insertCategories` has populated `category`. Each local
   * addon may have N category assignments → N rows in `add_on` (one per pair).
   * An addon with no assignments is inserted once with `category_id = null`.
   */
  private async insertAddOns(): Promise<number> {
    if (!this.supabase) throw new Error('Supabase not initialized');
    const db = getDatabase();

    const { data: supabaseCategories, error: catError } = await this.supabase
      .from('category')
      .select('id, uuid');
    if (catError) throw catError;

    const categoryMap = new Map<string, number>(
      (supabaseCategories || []).map((c: any) => [c.uuid as string, c.id as number])
    );

    const addOns = db.prepare(`
      SELECT id as uuid, name, description, price
      FROM addons
      WHERE isActive = 1
        AND (name IS NOT NULL OR description IS NOT NULL)
        AND price IS NOT NULL
      ORDER BY sortOrder ASC
    `).all() as Array<{
      uuid: string;
      name: string;
      description: string | null;
      price: string;
    }>;

    if (addOns.length === 0) {
      logInfo('No active add-ons to insert');
      return 0;
    }

    const addonIds = addOns.map(a => a.uuid);
    const placeholders = addonIds.map(() => '?').join(',');
    const addonAssignments = db.prepare(`
      SELECT
        a.id as addonUuid,
        aca.categoryId as category_uuid
      FROM addons a
      INNER JOIN category_addon_groups aca ON a.addonGroupId = aca.addonGroupId
      WHERE a.id IN (${placeholders})
        AND aca.isActive = 1
    `).all(...addonIds) as Array<{
      addonUuid: string;
      category_uuid: string;
    }>;

    const addonCategoryMap = new Map<string, number[]>();
    for (const a of addonAssignments) {
      const addonUuid = formatHexAsUuid(a.addonUuid);
      const categoryUuid = formatHexAsUuid(a.category_uuid);
      const supabaseCategoryId = categoryMap.get(categoryUuid);
      if (!supabaseCategoryId) {
        logInfo(
          `⚠️ Addon assignment category UUID ${categoryUuid} not in Supabase (addonId: ${addonUuid})`,
        );
        continue;
      }
      if (!addonCategoryMap.has(addonUuid)) addonCategoryMap.set(addonUuid, []);
      addonCategoryMap.get(addonUuid)!.push(supabaseCategoryId);
    }

    const rows: any[] = [];
    for (const addon of addOns) {
      const hasValidName = addon.name && addon.name.trim() !== '';
      const hasValidDescription = addon.description && addon.description.trim() !== '';
      const hasValidPrice = addon.price !== null && addon.price !== undefined;
      if (!hasValidPrice || (!hasValidName && !hasValidDescription)) {
        logInfo(`⚠️ Skipping addon with invalid data: UUID=${addon.uuid}`);
        continue;
      }

      const addonUuid = formatHexAsUuid(addon.uuid);
      const description = addon.name || addon.description || '';
      const categoryIds = addonCategoryMap.get(addonUuid) || [null];

      for (const categoryId of categoryIds) {
        rows.push({
          addon_uuid: addonUuid,
          description,
          price: addon.price?.toString() || '0',
          category_id: categoryId,
          deleted_at: null,
        });
      }
    }

    if (rows.length === 0) {
      logInfo('No add-on assignments to insert');
      return 0;
    }

    const { error } = await this.supabase.from('add_on').insert(rows);
    if (error) throw error;
    logInfo(`✅ Inserted ${rows.length} add-on assignments`);
    return rows.length;
  }

  /**
   * Per-action sync — INTENTIONALLY DISABLED under the wipe-and-replace model.
   *
   * Previously this pushed a single item delta to Supabase using the adoption
   * logic (PATCH by name+category match). That logic was the root cause of
   * the orphan-row bug: a failed adoption PATCH would silently leave Supabase
   * in a state Website Manager couldn't address by uuid anymore.
   *
   * The website is now mirrored from POS state on each explicit Sync press
   * (full wipe + re-insert). Per-item live syncs would either re-introduce
   * the adoption bug or (worse) trigger a full destructive wipe on every menu
   * edit. Both are wrong; both are gone. The method is kept as a no-op so the
   * call sites in menuItemController don't need to be touched.
   */
  public async syncMenuItem(itemId: string): Promise<void> {
    logInfo(`syncMenuItem(${itemId}): skipped — press Sync to publish to website`);
  }

  /** Per-action sync — disabled. See `syncMenuItem`. */
  public async syncCategory(
    categoryId: string,
    _skipItemRecursion = false,
  ): Promise<void> {
    logInfo(`syncCategory(${categoryId}): skipped — press Sync to publish to website`);
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton accessor.
//
// Why this exists: MenuItemController and AddonController are constructed
// BEFORE startup-manager creates the SupabaseSyncService. They cannot resolve
// the service from the ServiceRegistry at construction time (it isn't there
// yet). They look it up lazily via getSupabaseSyncService() at each sync call
// instead. startup-manager-nextron.ts calls setSupabaseSyncService() right
// after `new SupabaseSyncService(prisma)`.
// ---------------------------------------------------------------------------
let _syncServiceInstance: SupabaseSyncService | null = null;

export function setSupabaseSyncService(svc: SupabaseSyncService): void {
  _syncServiceInstance = svc;
  logInfo('[supabaseSync] Module singleton set — controllers can now sync per-action');
}

export function getSupabaseSyncService(): SupabaseSyncService | null {
  return _syncServiceInstance;
}