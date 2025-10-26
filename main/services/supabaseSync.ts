// @supabase/supabase-js is optional - only needed if syncing to Supabase
let createClient: any;
let SupabaseClient: any;
try {
  const supabase = require('@supabase/supabase-js');
  createClient = supabase.createClient;
  SupabaseClient = supabase.SupabaseClient;
} catch (e) {
  // Supabase package not installed - sync functionality will be disabled
  createClient = null;
  SupabaseClient = null;
}

import { PrismaClient } from '../db/prisma-wrapper';
import { logInfo, logError } from '../error-handler';
import Decimal from 'decimal.js';
import { getCurrentLocalDateTime } from '../utils/dateTime';

/**
 * Supabase Sync Service
 * Syncs active menu items from PostgreSQL to Supabase for public website
 * Only syncs items where isActive = true
 */
export class SupabaseSyncService {
  private supabase: any | null = null;
  private prisma: PrismaClient;
  private isSyncing: boolean = false;
  private lastSyncTime: Date | null = null;
  private lastSyncStatus: 'success' | 'error' | 'pending' = 'pending';
  private lastSyncError: string | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.initializeSupabase();
  }

  /**
   * Initialize Supabase client
   */
  private initializeSupabase(): void {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        logError(
          new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY not configured'),
          'SupabaseSync'
        );
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      logInfo('Supabase client initialized successfully');
    } catch (error) {
      logError(error as Error, 'SupabaseSync initialization');
    }
  }

  /**
   * Check if Supabase is configured and available
   */
  public isConfigured(): boolean {
    return this.supabase !== null;
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
   * Sync categories to Supabase (only active ones)
   * Note: Supabase uses auto-incrementing IDs, so we don't send local UUIDs
   */
  private async syncCategories(): Promise<number> {
    if (!this.supabase) throw new Error('Supabase not initialized');

    // Get only active categories from local DB
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: {
        name: true, // Only sync name, let Supabase generate IDs
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Get all category names from Supabase
    const { data: existingCategories } = await this.supabase
      .from('category')
      .select('name');

    const existingNames = new Set(
      existingCategories?.map((c: any) => c.name) || []
    );
    const activeNames = new Set(categories.map(c => c.name));

    // Delete categories that are no longer active
    const namesToDelete = Array.from(existingNames).filter(
      name => !activeNames.has(name)
    );
    if (namesToDelete.length > 0) {
      await this.supabase.from('category').delete().in('name', namesToDelete);
      logInfo(
        `Removed ${namesToDelete.length} inactive categories from Supabase`
      );
    }

    // Upsert active categories (using name as unique key)
    if (categories.length > 0) {
      const { error } = await this.supabase
        .from('category')
        .upsert(categories, { onConflict: 'name' });

      if (error) throw error;
    }

    logInfo(`Synced ${categories.length} active categories`);
    return categories.length;
  }

  /**
   * Sync active menu items only
   * Note: Supabase uses auto-incrementing IDs, we map by name + category lookup
   */
  private async syncMenuItems(): Promise<number> {
    if (!this.supabase) throw new Error('Supabase not initialized');

    // Get ONLY active items from local DB
    const items = await this.prisma.menuItem.findMany({
      where: {
        isActive: true,
        category: { isActive: true }, // Also ensure category is active
      },
      select: {
        name: true,
        price: true,
        description: true,
        category: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Get category name-to-ID mapping from Supabase
    const { data: supabaseCategories } = await this.supabase
      .from('category')
      .select('id, name');
    
    const categoryMap = new Map(
      (supabaseCategories || []).map((c: any) => [c.name, c.id])
    );

    // Transform to Supabase format
    const supabaseItems = items
      .map(item => {
        const categoryId = categoryMap.get(item.category.name);
        if (!categoryId) {
          logInfo(`Skipping item "${item.name}" - category "${item.category.name}" not found in Supabase`);
          return null;
        }
        return {
          name: item.name,
          price: item.price.toString(), // Convert Decimal to string
          is_special: false,
          category_id: categoryId,
        };
      })
      .filter(item => item !== null);

    // Get all existing item names from Supabase
    const { data: existingItems } = await this.supabase
      .from('item')
      .select('name');

    const existingNames = new Set(
      existingItems?.map((i: any) => i.name) || []
    );
    const activeNames = new Set(supabaseItems.map((i: any) => i.name));

    // Delete items that are no longer active
    const namesToDelete = Array.from(existingNames).filter(
      name => !activeNames.has(name)
    );
    if (namesToDelete.length > 0) {
      await this.supabase.from('item').delete().in('name', namesToDelete);
      logInfo(`Removed ${namesToDelete.length} inactive items from Supabase`);
    }

    // Upsert active items (name must be unique in Supabase)
    if (supabaseItems.length > 0) {
      const { error } = await this.supabase
        .from('item')
        .upsert(supabaseItems, { onConflict: 'name' });

      if (error) throw error;
    }

    logInfo(`Synced ${supabaseItems.length} active menu items`);
    return supabaseItems.length;
  }

  /**
   * Sync active add-ons with category assignments
   * Note: Supabase schema has description (no name field) and category_id
   */
  private async syncAddOns(): Promise<number> {
    if (!this.supabase) throw new Error('Supabase not initialized');

    // Get active add-ons from local DB
    const addOns = await this.prisma.addon.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Get addon category assignments
    const addonIds = addOns.map(a => a.id);
    const addonAssignments = await this.prisma.addonCategoryAssignment.findMany({
      where: {
        addonId: { in: addonIds },
        isActive: true,
      },
      include: {
        category: {
          select: {
            name: true,
          },
        },
      },
    });

    // Get category name-to-ID mapping from Supabase
    const { data: supabaseCategories } = await this.supabase
      .from('category')
      .select('id, name');
    
    const categoryMap = new Map(
      (supabaseCategories || []).map((c: any) => [c.name, c.id])
    );

    // Build addon-to-categories mapping
    const addonCategoryMap = new Map<string, number[]>();
    for (const assignment of addonAssignments) {
      const supabaseCategoryId = categoryMap.get(assignment.category.name);
      if (supabaseCategoryId) {
        if (!addonCategoryMap.has(assignment.addonId)) {
          addonCategoryMap.set(assignment.addonId, []);
        }
        addonCategoryMap.get(assignment.addonId)!.push(supabaseCategoryId);
      }
    }

    // Transform to Supabase format
    // Each addon can have multiple category assignments = multiple records
    const supabaseAddOns: any[] = [];
    for (const addon of addOns) {
      const categoryIds = addonCategoryMap.get(addon.id) || [null];
      for (const categoryId of categoryIds) {
        supabaseAddOns.push({
          description: addon.name || addon.description || '', // Use name as description
          price: addon.price?.toString() || '0',
          category_id: categoryId,
        });
      }
    }

    // Get all existing addon descriptions from Supabase
    const { data: existingAddOns } = await this.supabase
      .from('add_on')
      .select('description');

    const existingDescriptions = new Set(
      existingAddOns?.map((a: any) => a.description) || []
    );
    const activeDescriptions = new Set(supabaseAddOns.map(a => a.description));

    // Delete add-ons that are no longer active
    const descriptionsToDelete = Array.from(existingDescriptions).filter(
      desc => !activeDescriptions.has(desc)
    );
    if (descriptionsToDelete.length > 0) {
      await this.supabase.from('add_on').delete().in('description', descriptionsToDelete);
      logInfo(`Removed ${descriptionsToDelete.length} inactive add-ons from Supabase`);
    }

    // Upsert active add-ons (description as unique key)
    if (supabaseAddOns.length > 0) {
      const { error } = await this.supabase
        .from('add_on')
        .upsert(supabaseAddOns, { onConflict: 'description' });

      if (error) throw error;
    }

    logInfo(`Synced ${supabaseAddOns.length} active add-on assignments`);
    return supabaseAddOns.length;
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
        // Also remove all items in this category
        await this.supabase.from('item').delete().eq('category_id', categoryId);
        await this.supabase.from('category').delete().eq('id', categoryId);
        logInfo(`Removed category ${categoryId} from Supabase`);
        return;
      }

      // Category is active - upsert to Supabase
      const { error } = await this.supabase.from('category').upsert({
        id: category.id,
        name: category.name,
      });

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
