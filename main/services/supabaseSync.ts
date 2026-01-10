import { PrismaClient } from '../db/prisma-wrapper';
import { getDatabase } from '../db/index';
import { logInfo, logError } from '../error-handler';
import Decimal from 'decimal.js';
import { getCurrentLocalDateTime } from '../utils/dateTime';
import https from 'https';

// Hardcoded Supabase credentials
const SUPABASE_URL = 'https://buivobulqaryifxesvqo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aXZvYnVscWFyeWlmeGVzdnFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDcyNDUxNSwiZXhwIjoyMDY2MzAwNTE1fQ.-G0GXB57aRlD9VldrkTeBb_l5lDlkXl385-qYpgdpoE';

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
class SupabaseHTTPClient {
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
              resolve(data ? JSON.parse(data) : null);
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
          // Note: 'resolution' parameter does NOT exist - removed to fix PGRST100 error
          const queryString = params.toString() ? `?${params.toString()}` : '';

          // Add Prefer header for upsert to work correctly (merge on conflict)
          const data = await this.request('POST', `/rest/v1/${table}${queryString}`, records, {
            'Prefer': 'resolution=merge-duplicates'
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
    };
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
   * Sync all active menu items to Supabase
   */
  public async syncAll(): Promise<{
    success: boolean;
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
      logInfo('🔄 Starting full sync to Supabase...');

      // 1. Sync Categories (only active ones)
      const categoriesSynced = await this.syncCategories();

      // 2. Sync Active Menu Items
      const itemsSynced = await this.syncMenuItems();

      // 3. Sync Active Add-ons
      const addOnsSynced = await this.syncAddOns();

      const duration = Date.now() - startTime;
      this.lastSyncTime = new Date();
      this.lastSyncStatus = 'success';
      this.lastSyncError = null;

      logInfo(
        `✅ Sync completed successfully in ${duration}ms - ` +
          `Categories: ${categoriesSynced}, Items: ${itemsSynced}, Add-ons: ${addOnsSynced}`
      );

      return {
        success: true,
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
   * Sync categories to Supabase using UUID-based upsert with soft deletes
   * Phase 1: Get Supabase snapshot (UUIDs of non-deleted records)
   * Phase 2: Get local active categories (SQLite UUIDs)
   * Phase 3: Classify into upsert vs soft delete
   * Phase 4: Execute batch operations
   * Phase 5: Validate sync (implicit via logging)
   */
  private async syncCategories(): Promise<number> {
    if (!this.supabase) throw new Error('Supabase not initialized');
    const db = getDatabase();

    // Phase 1: Get Supabase snapshot (non-deleted UUIDs)
    const { data: existingCategories, error: selectError } = await this.supabase
      .from('category')
      .select('uuid, id, deleted_at, name');

    if (selectError) throw selectError;

    // Filter to only non-deleted (if deleted_at column exists, filter it; otherwise all are non-deleted)
    const supabaseUUIDs = new Set(
      (existingCategories || [])
        .filter((c: any) => !c.deleted_at)  // Filter out soft-deleted
        .map((c: any) => c.uuid)
    );

    // Phase 2: Get local active categories (SQLite id IS the UUID)
    const localCategories = db.prepare(`
      SELECT id as uuid, name
      FROM categories
      WHERE isActive = 1
        AND name IS NOT NULL
      ORDER BY sortOrder
    `).all() as Array<{ uuid: string; name: string }>;

    // Format local hex IDs to UUID format for PostgreSQL
    const formattedLocalCategories = localCategories
      .map(cat => ({
        ...cat,
        uuid: formatHexAsUuid(cat.uuid)
      }))
      .filter(cat => {
        // Double-check: filter out any categories with NULL or empty names
        if (!cat.name || cat.name.trim() === '') {
          logInfo(`⚠️ Skipping category with invalid name: UUID=${cat.uuid}`);
          return false;
        }
        return true;
      });

    const localUUIDs = new Set(formattedLocalCategories.map(c => c.uuid));

    // Phase 3: Classify records with hybrid matching and adoption
    const toUpsert: any[] = [];
    const adoptions: Array<{ oldUuid: string; newUuid: string; name: string }> = [];

    for (const localCat of formattedLocalCategories) {
      // Check UUID match (standard behavior)
      const existingByUuid = (existingCategories || []).find(
        (c: any) => c.uuid === localCat.uuid && !c.deleted_at
      );

      if (existingByUuid) {
        // UUID match → normal upsert
        toUpsert.push({
          uuid: localCat.uuid,
          name: localCat.name,
          deleted_at: null
        });
      } else {
        // No UUID match → try name matching (case-insensitive)
        const existingByName = (existingCategories || []).find(
          (c: any) => c.name && c.name.toLowerCase() === localCat.name.toLowerCase() && !c.deleted_at
        );

        if (existingByName) {
          // Name match → ADOPT (update Supabase UUID to match local)
          logInfo(`🔄 ADOPTING category "${localCat.name}": ${existingByName.uuid} → ${localCat.uuid}`);
          adoptions.push({
            oldUuid: existingByName.uuid,
            newUuid: localCat.uuid,
            name: localCat.name
          });

          // Include Supabase PK to force UPDATE not INSERT
          toUpsert.push({
            id: existingByName.id,  // ← CRITICAL: Supabase primary key
            uuid: localCat.uuid,     // ← New UUID from local
            name: localCat.name,
            deleted_at: null
          });
        } else {
          // No match → new record
          toUpsert.push({
            uuid: localCat.uuid,
            name: localCat.name,
            deleted_at: null
          });
        }
      }
    }

    // Audit log
    if (adoptions.length > 0) {
      logInfo(`📋 Category Adoptions: ${adoptions.length} records linked`);
      adoptions.forEach(a => logInfo(`   "${a.name}": ${a.oldUuid} → ${a.newUuid}`));
    }

    // Get existing Supabase records to soft delete (with their names to avoid NULL constraint)
    const toMarkDeleted = (existingCategories || [])
      .filter((c: any) => !c.deleted_at && !localUUIDs.has(c.uuid))
      .map((c: any) => ({
        uuid: c.uuid,
        name: c.name || 'Deleted Category', // Ensure name is not NULL
        deleted_at: new Date().toISOString()
      }));

    // Phase 4: Execute batch operations
    let syncedCount = 0;

    if (toUpsert.length > 0) {
      const { data, error } = await this.supabase
        .from('category')
        .upsert(toUpsert, { onConflict: 'uuid' });

      if (error) throw error;
      syncedCount = toUpsert.length;
      logInfo(`✅ Upserted ${toUpsert.length} categories`);
    }

    if (toMarkDeleted.length > 0) {
      const { error } = await this.supabase
        .from('category')
        .upsert(toMarkDeleted, { onConflict: 'uuid' });

      if (error) throw error;
      logInfo(`🗑️ Soft deleted ${toMarkDeleted.length} categories`);
    }

    // Phase 5: Log validation
    logInfo(`Synced ${syncedCount} active categories (${toMarkDeleted.length} soft deleted)`);
    return syncedCount;
  }

  /**
   * Sync menu items to Supabase using UUID-based upsert with soft deletes
   * Includes FK resolution (category UUID → Supabase ID)
   * Phase 1: Get category UUID → ID mapping
   * Phase 2: Get Supabase snapshot (UUIDs of non-deleted items)
   * Phase 3: Get local active items with FK resolution
   * Phase 4: Classify into upsert vs soft delete
   * Phase 5: Execute batch operations
   */
  private async syncMenuItems(): Promise<number> {
    if (!this.supabase) throw new Error('Supabase not initialized');
    const db = getDatabase();

    // Phase 1: Get category UUID → Supabase ID mapping
    const { data: supabaseCategories, error: catError } = await this.supabase
      .from('category')
      .select('id, uuid');

    if (catError) throw catError;

    const categoryMap = new Map(
      (supabaseCategories || [])
        .filter((c: any) => !c.deleted_at)  // Only non-deleted categories
        .map((c: any) => [c.uuid, c.id])
    );

    // Phase 2: Get Supabase snapshot (non-deleted UUIDs)
    const { data: existingItems, error: selectError } = await this.supabase
      .from('item')
      .select('uuid, id, deleted_at, name, price, category_id');

    if (selectError) throw selectError;

    const supabaseUUIDs = new Set(
      (existingItems || [])
        .filter((i: any) => !i.deleted_at)  // Filter out soft-deleted
        .map((i: any) => i.uuid)
    );

    // Phase 3: Get local active items (SQLite id IS the UUID)
    const localItems = db.prepare(`
      SELECT
        m.id as uuid,
        m.name,
        m.price,
        m.categoryId as category_uuid,
        m.isVisibleOnWebsite
      FROM menu_items m
      WHERE m.isActive = 1
        AND m.name IS NOT NULL
        AND m.price IS NOT NULL
    `).all() as Array<{
      uuid: string;
      name: string;
      price: string;
      category_uuid: string;
      isVisibleOnWebsite: number;
    }>;

    // Format local hex IDs to UUID format for PostgreSQL
    const formattedLocalItems = localItems
      .map(item => ({
        ...item,
        uuid: formatHexAsUuid(item.uuid),
        category_uuid: formatHexAsUuid(item.category_uuid)
      }))
      .filter(item => {
        // Double-check: filter out any items with NULL or empty names/prices
        if (!item.name || item.name.trim() === '' || !item.price) {
          logInfo(`⚠️ Skipping menu item with invalid name or price: UUID=${item.uuid}`);
          return false;
        }
        return true;
      });

    const localUUIDs = new Set(formattedLocalItems.map(i => i.uuid));

    // Phase 4: Classify and adopt with name+category fallback, add is_special field
    const toUpsert: any[] = [];
    const adoptions: Array<{ oldUuid: string; newUuid: string; name: string }> = [];

    for (const localItem of formattedLocalItems) {
      const category_id = categoryMap.get(localItem.category_uuid);
      if (!category_id) {
        logInfo(`⚠️ Skipping item "${localItem.name}" - category UUID ${localItem.category_uuid} not found in Supabase`);
        continue;
      }

      // Check UUID match (standard behavior)
      const existingByUuid = (existingItems || []).find(
        (i: any) => i.uuid === localItem.uuid && !i.deleted_at
      );

      if (existingByUuid) {
        // UUID match → normal upsert
        toUpsert.push({
          uuid: localItem.uuid,
          name: localItem.name,
          price: localItem.price,
          is_special: false,  // ✅ FIX: Add required field
          category_id: category_id,
          isVisibleOnWebsite: localItem.isVisibleOnWebsite === 1,
          deleted_at: null
        });
      } else {
        // No UUID match → try name+category matching
        const existingByName = (existingItems || []).find(
          (i: any) =>
            i.name && i.name.toLowerCase() === localItem.name.toLowerCase() &&
            i.category_id === category_id &&
            !i.deleted_at
        );

        if (existingByName) {
          // Name+category match → ADOPT
          logInfo(`🔄 ADOPTING item "${localItem.name}": ${existingByName.uuid} → ${localItem.uuid}`);
          adoptions.push({
            oldUuid: existingByName.uuid,
            newUuid: localItem.uuid,
            name: localItem.name
          });

          toUpsert.push({
            id: existingByName.id,  // ← CRITICAL: Supabase PK
            uuid: localItem.uuid,    // ← New UUID from local
            name: localItem.name,
            price: localItem.price,
            is_special: existingByName.is_special ?? false,  // Preserve existing value
            category_id: category_id,
            isVisibleOnWebsite: localItem.isVisibleOnWebsite === 1,
            deleted_at: null
          });
        } else {
          // No match → new record
          toUpsert.push({
            uuid: localItem.uuid,
            name: localItem.name,
            price: localItem.price,
            is_special: false,  // ✅ FIX: Required field with default value
            category_id: category_id,
            isVisibleOnWebsite: localItem.isVisibleOnWebsite === 1,
            deleted_at: null
          });
        }
      }
    }

    // Audit log
    if (adoptions.length > 0) {
      logInfo(`📋 Item Adoptions: ${adoptions.length} records linked`);
      adoptions.forEach(a => logInfo(`   "${a.name}": ${a.oldUuid} → ${a.newUuid}`));
    }

    // Get existing Supabase items to soft delete (with required fields to avoid NULL constraint)
    const toMarkDeleted = (existingItems || [])
      .filter((i: any) => !i.deleted_at && !localUUIDs.has(i.uuid))
      .map((i: any) => ({
        uuid: i.uuid,
        name: i.name || 'Deleted Item', // Ensure name is not NULL
        price: i.price || '0', // Ensure price is not NULL
        category_id: i.category_id, // Preserve category_id
        is_special: false,  // Required field for soft delete
        deleted_at: new Date().toISOString()
      }));

    // Phase 5: Execute batch operations
    let syncedCount = 0;

    if (toUpsert.length > 0) {
      const { data, error } = await this.supabase
        .from('item')
        .upsert(toUpsert, { onConflict: 'uuid' });

      if (error) throw error;
      syncedCount = toUpsert.length;
      logInfo(`✅ Upserted ${toUpsert.length} menu items`);
    }

    if (toMarkDeleted.length > 0) {
      const { error } = await this.supabase
        .from('item')
        .upsert(toMarkDeleted, { onConflict: 'uuid' });

      if (error) throw error;
      logInfo(`🗑️ Soft deleted ${toMarkDeleted.length} menu items`);
    }

    logInfo(`Synced ${syncedCount} active menu items (${toMarkDeleted.length} soft deleted)`);
    return syncedCount;
  }

  /**
   * Sync add-ons to Supabase using UUID-based upsert with soft deletes
   * Note: Each local addon can have multiple category assignments
   *       = multiple Supabase records (one per addon-category pair)
   * Uses composite key matching: addon_uuid + category_id
   */
  private async syncAddOns(): Promise<number> {
    if (!this.supabase) throw new Error('Supabase not initialized');
    const db = getDatabase();

    // Phase 1: Get category UUID → Supabase ID mapping
    const { data: supabaseCategories, error: catError } = await this.supabase
      .from('category')
      .select('id, uuid');

    if (catError) throw catError;

    const categoryMap = new Map(
      (supabaseCategories || [])
        .filter((c: any) => !c.deleted_at)  // Only non-deleted categories
        .map((c: any) => [c.uuid, c.id])
    );

    // Phase 2: Get local active add-ons (SQLite id IS the UUID)
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

    // Format local hex IDs to UUID format for PostgreSQL
    const formattedAddOns = addOns
      .map(addon => ({
        ...addon,
        uuid: formatHexAsUuid(addon.uuid)
      }))
      .filter(addon => {
        // Double-check: filter out any addons with invalid data
        const hasValidName = addon.name && addon.name.trim() !== '';
        const hasValidDescription = addon.description && addon.description.trim() !== '';
        const hasValidPrice = addon.price !== null && addon.price !== undefined;

        if (!hasValidPrice || (!hasValidName && !hasValidDescription)) {
          logInfo(`⚠️ Skipping addon with invalid data: UUID=${addon.uuid}`);
          return false;
        }
        return true;
      });

    // Get addon category assignments with category UUIDs
    const addonIds = addOns.map(a => a.uuid);  // Use original hex IDs for SQL query
    if (addonIds.length === 0) {
      logInfo('No active add-ons to sync');
      return 0;
    }

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

    // Format assignment UUIDs and build addon-to-categories mapping
    const formattedAssignments = addonAssignments.map(a => ({
      addonUuid: formatHexAsUuid(a.addonUuid),
      category_uuid: formatHexAsUuid(a.category_uuid)
    }));

    const addonCategoryMap = new Map<string, number[]>();
    for (const assignment of formattedAssignments) {
      const supabaseCategoryId = categoryMap.get(assignment.category_uuid);
      if (supabaseCategoryId) {
        if (!addonCategoryMap.has(assignment.addonUuid)) {
          addonCategoryMap.set(assignment.addonUuid, []);
        }
        addonCategoryMap.get(assignment.addonUuid)!.push(supabaseCategoryId);
      } else {
        logInfo(`⚠️ Addon assignment category UUID ${assignment.category_uuid} not in Supabase (addonId: ${assignment.addonUuid})`);
      }
    }

    // Phase 3: Get Supabase snapshot (needed for adoption logic)
    const { data: existingAddOns, error: selectError } = await this.supabase
      .from('add_on')
      .select('addon_uuid, category_id, id, deleted_at, description, price');

    if (selectError) throw selectError;

    // Phase 4: Create Supabase records with adoption logic (one per addon-category pair)
    // Each has addon UUID + category_id for composite uniqueness
    const toUpsert: any[] = [];
    const activeCompositeKeys = new Set<string>();
    const adoptions: Array<{ oldUuid: string; newUuid: string; desc: string }> = [];

    for (const addon of formattedAddOns) {
      const categoryIds = addonCategoryMap.get(addon.uuid) || [null];

      for (const categoryId of categoryIds) {
        const compositeKey = `${addon.uuid}|${categoryId || 'null'}`;
        activeCompositeKeys.add(compositeKey);

        const description = addon.name || addon.description || '';

        // Check UUID+category match (standard behavior)
        const existingByUuid = (existingAddOns || []).find(
          (a: any) =>
            a.addon_uuid === addon.uuid &&
            a.category_id === categoryId &&
            !a.deleted_at
        );

        if (existingByUuid) {
          // UUID match → normal upsert
          toUpsert.push({
            addon_uuid: addon.uuid,
            description: description,
            price: addon.price?.toString() || '0',
            category_id: categoryId,
            deleted_at: null
          });
        } else {
          // No UUID match → try description+category matching
          const existingByDesc = (existingAddOns || []).find(
            (a: any) =>
              a.description && a.description.toLowerCase() === description.toLowerCase() &&
              a.category_id === categoryId &&
              !a.deleted_at
          );

          if (existingByDesc) {
            // Description match → ADOPT
            logInfo(`🔄 ADOPTING addon "${description}" (cat: ${categoryId}): ${existingByDesc.addon_uuid} → ${addon.uuid}`);
            adoptions.push({
              oldUuid: existingByDesc.addon_uuid,
              newUuid: addon.uuid,
              desc: description
            });

            toUpsert.push({
              id: existingByDesc.id,  // ← CRITICAL: Supabase PK
              addon_uuid: addon.uuid,  // ← New UUID
              description: description,
              price: addon.price?.toString() || '0',
              category_id: categoryId,
              deleted_at: null
            });
          } else {
            // No match → new record
            toUpsert.push({
              addon_uuid: addon.uuid,
              description: description,
              price: addon.price?.toString() || '0',
              category_id: categoryId,
              deleted_at: null
            });
          }
        }
      }
    }

    // Audit log
    if (adoptions.length > 0) {
      logInfo(`📋 Addon Adoptions: ${adoptions.length} records linked`);
    }

    // Find records to soft delete (exist in Supabase but not in local active)
    const toMarkDeleted: any[] = [];
    for (const existing of existingAddOns || []) {
      if (existing.deleted_at) continue;  // Already soft-deleted

      const compositeKey = `${existing.addon_uuid}|${existing.category_id || 'null'}`;
      if (!activeCompositeKeys.has(compositeKey)) {
        toMarkDeleted.push({
          addon_uuid: existing.addon_uuid,
          category_id: existing.category_id,
          description: existing.description || 'Deleted Addon', // Ensure description is not NULL
          price: existing.price || '0', // Ensure price is not NULL
          deleted_at: new Date().toISOString()
        });
      }
    }

    // Phase 5: Execute batch operations
    let syncedCount = 0;

    if (toUpsert.length > 0) {
      // Note: onConflict would need composite key support
      // For now, use addon_uuid (may need schema adjustment)
      const { data, error } = await this.supabase
        .from('add_on')
        .upsert(toUpsert, { onConflict: 'addon_uuid,category_id' });

      if (error) throw error;
      syncedCount = toUpsert.length;
      logInfo(`✅ Upserted ${toUpsert.length} add-on assignments`);
    }

    if (toMarkDeleted.length > 0) {
      const { error } = await this.supabase
        .from('add_on')
        .upsert(toMarkDeleted, { onConflict: 'addon_uuid,category_id' });

      if (error) throw error;
      logInfo(`🗑️ Soft deleted ${toMarkDeleted.length} add-on assignments`);
    }

    logInfo(`Synced ${syncedCount} active add-on assignments (${toMarkDeleted.length} soft deleted)`);
    return syncedCount;
  }

  /**
   * Sync single menu item (for real-time updates)
   */
  public async syncMenuItem(itemId: string): Promise<void> {
    if (!this.isConfigured()) {
      logInfo('Supabase not configured, skipping item sync');
      return;
    }

    if (!this.supabase) return;

    try {
      const item = await this.prisma.menuItem.findUnique({
        where: { id: itemId },
        include: {
          category: true,
        },
      });

      if (!item || !item.isActive || !item.category.isActive) {
        // Item deleted, inactive, or category inactive - remove from Supabase
        await this.supabase.from('item').delete().eq('id', itemId);
        logInfo(`Removed item ${itemId} from Supabase`);
        return;
      }

      // Validate item has required fields before syncing
      if (!item.name || item.name.trim() === '' || !item.price) {
        logInfo(`⚠️ Skipping menu item sync - invalid name or price: id=${item.id}`);
        return;
      }

      // Item is active - upsert to Supabase
      const { error } = await this.supabase.from('item').upsert({
        id: item.id,
        name: item.name,
        price: item.price.toString(),
        is_special: false,
        category_id: item.categoryId,
      });

      if (error) throw error;
      logInfo(`Synced menu item: ${item.name}`);
    } catch (error) {
      logError(error as Error, 'syncMenuItem');
    }
  }

  /**
   * Sync single category (for real-time updates)
   */
  public async syncCategory(categoryId: string): Promise<void> {
    if (!this.isConfigured()) {
      logInfo('Supabase not configured, skipping category sync');
      return;
    }

    if (!this.supabase) return;

    try {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category || !category.isActive) {
        // Category deleted or inactive - remove from Supabase
        if (category && category.name) {
          // Delete category by name (Supabase should handle cascading deletes or orphaned items)
          await this.supabase.from('category').delete().eq('name', category.name);
          logInfo(`Removed category ${category.name} from Supabase`);
        }
        return;
      }

      // Validate category has a non-NULL name before syncing
      if (!category.name || category.name.trim() === '') {
        logInfo(`⚠️ Skipping category sync - invalid name: id=${category.id}`);
        return;
      }

      // Category is active - upsert to Supabase
      // Using 'columns' parameter to bypass PostgREST schema validation
      const { error } = await this.supabase.from('category').upsert({
        name: category.name,
      }, { onConflict: 'name', columns: 'name' });

      if (error) throw error;
      logInfo(`Synced category: ${category.name}`);

      // Re-sync all items in this category
      const items = await this.prisma.menuItem.findMany({
        where: { categoryId: category.id },
      });

      for (const item of items) {
        await this.syncMenuItem(item.id);
      }
    } catch (error) {
      logError(error as Error, 'syncCategory');
    }
  }
}