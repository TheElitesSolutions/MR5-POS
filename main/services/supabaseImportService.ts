import { PrismaClient } from '../db/prisma-wrapper';
import { getDatabase } from '../db/index';
import { logInfo, logError } from '../error-handler';
import Decimal from 'decimal.js';
import https from 'https';

// Hardcoded Supabase credentials
const SUPABASE_URL = 'https://buivobulqaryifxesvqo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aXZvYnVscWFyeWlmeGVzdnFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDcyNDUxNSwiZXhwIjoyMDY2MzAwNTE1fQ.-G0GXB57aRlD9VldrkTeBb_l5lDlkXl385-qYpgdpoE';

/**
 * Simple HTTP client for Supabase REST API
 * This bypasses the need for the @supabase/supabase-js SDK which has loading issues in production
 */
class SupabaseHTTPClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(url: string, apiKey: string) {
    this.baseUrl = url;
    this.apiKey = apiKey;
  }

  async query(table: string, select = '*', limit?: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const path = `/rest/v1/${table}?select=${select}${limit ? `&limit=${limit}` : ''}`;
      const url = new URL(path, this.baseUrl);

      // LOG REQUEST
      logInfo(`[Import HTTP] GET ${url.pathname}${url.search}`);
      console.log(`[Import HTTP] 🔍 GET ${url.pathname}${url.search}`);

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          // LOG RESPONSE
          logInfo(`[Import HTTP] Response ${res.statusCode} for ${table}`);
          console.log(`[Import HTTP] 📥 Response ${res.statusCode} for ${table}`);

          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              const errorMsg = `Failed to parse JSON: ${e}`;
              logError(new Error(errorMsg), 'query');
              console.error(`[Import HTTP] ❌ ${errorMsg}`);
              reject(new Error(errorMsg));
            }
          } else {
            const errorMsg = `HTTP ${res.statusCode}: ${data}`;
            logError(new Error(errorMsg), 'query');
            console.error(`[Import HTTP] ❌ ${errorMsg}`);
            reject(new Error(errorMsg));
          }
        });
      });

      req.on('error', (e) => {
        logError(e, 'query');
        console.error(`[Import HTTP] ❌ Request error:`, e.message);
        reject(e);
      });
      req.end();
    });
  }
}

/**
 * Enhanced import result with diff reporting
 */
interface ImportResult {
  success: boolean;
  importedCounts?: {
    categories: number;
    items: number;
    addons: number;
    assignments: number;
  };
  diff?: {
    categoriesAdded: number;
    categoriesUpdated: number;
    itemsAdded: number;
    itemsUpdated: number;
    itemsSkipped: number;
    addonsAdded: number;
    addonsUpdated: number;
    assignmentsAdded: number;
  };
  error?: string;
}

/**
 * Supabase Import Service
 * Imports menu data from Supabase into local database using non-destructive merge strategy
 */
export class SupabaseImportService {
  private supabase: SupabaseHTTPClient;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    // CRITICAL: Ensure Prisma client is fully initialized before use
    // This triggers lazy initialization of all model properties (menuItem, category, etc.)
    this.prisma.ensureInitialized();
    this.supabase = new SupabaseHTTPClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    logInfo('Supabase HTTP client initialized with hardcoded credentials');
    logInfo('✅ Prisma client initialized for import service');
    console.log('[Supabase] ✅ HTTP client initialized with hardcoded credentials');
  }

  public isConfigured(): boolean {
    return this.supabase !== null;
  }

  /**
   * Import all data from Supabase to local database using non-destructive merge
   * Updates existing items, creates new ones, preserves local-only data
   */
  async importFromSupabase(): Promise<ImportResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Supabase not configured',
      };
    }

    try {
      logInfo('📥 Starting non-destructive import from Supabase...');

      // Fetch existing local data for comparison using direct SQL (bypasses wrapper)
      logInfo('Fetching existing local data...');
      const db = getDatabase();
      const existingCategories = db.prepare('SELECT * FROM categories').all() as Array<any>;
      const existingItems = db.prepare('SELECT * FROM menu_items').all() as Array<any>;
      const existingAddons = db.prepare('SELECT * FROM addons').all() as Array<any>;
      const existingAddonGroups = db.prepare('SELECT * FROM addon_groups').all() as Array<any>;

      // Use transaction for atomic all-or-nothing operation
      return await this.prisma.$transaction(async (tx) => {
        // Counters for diff reporting
        let categoriesAdded = 0;
        let categoriesUpdated = 0;
        let itemsAdded = 0;
        let itemsUpdated = 0;
        let itemsSkipped = 0;
        let addonsAdded = 0;
        let addonsUpdated = 0;
        let assignmentsAdded = 0;

        // Create lookup maps for matching (case-insensitive name matching)
        const categoryMap = new Map(
          existingCategories
            .filter(c => c.name) // Filter out null/undefined names
            .map(c => [c.name.toLowerCase(), c])
        );
        const itemMap = new Map(
          existingItems
            .filter(i => i.name) // Filter out null/undefined names
            .map(i => [i.name.toLowerCase(), i])
        );
        const addonMap = new Map(
          existingAddons
            .filter(a => a.description) // Filter out null/undefined descriptions
            .map(a => [a.description.toLowerCase(), a])
        );

        // Log filtered records
        const invalidCats = existingCategories.filter(c => !c.name);
        const invalidItems = existingItems.filter(i => !i.name);
        const invalidAddons = existingAddons.filter(a => !a.description);
        if (invalidCats.length > 0) {
          logInfo(`⚠️ Skipped ${invalidCats.length} categories with missing names`);
        }
        if (invalidItems.length > 0) {
          logInfo(`⚠️ Skipped ${invalidItems.length} items with missing names`);
        }
        if (invalidAddons.length > 0) {
          logInfo(`⚠️ Skipped ${invalidAddons.length} addons with missing descriptions`);
        }

        // Step 1: Import/Update categories from Supabase
        logInfo('Syncing categories...');
        const supabaseCategories = await this.supabase.query('category', 'id,name');
        const localCategoryMap = new Map<number, string>(); // Supabase ID -> Local ID

        for (const supaCat of supabaseCategories || []) {
          // NULL SAFETY: Validate category has required fields
          if (!supaCat.name || typeof supaCat.name !== 'string') {
            logInfo(`⚠️ Skipping Supabase category - invalid name: ${JSON.stringify(supaCat)}`);
            continue;
          }

          const existingCategory = categoryMap.get(supaCat.name.toLowerCase());

          if (existingCategory) {
            // UPDATE existing category
            await tx.category.update({
              where: { id: existingCategory.id },
              data: {
                isActive: true,
                sortOrder: supaCat.id,
              },
            });
            localCategoryMap.set(supaCat.id, existingCategory.id);
            categoriesUpdated++;
          } else {
            // CREATE new category
            const localCategory = await tx.category.create({
              data: {
                name: supaCat.name,
                isActive: true,
                sortOrder: supaCat.id,
              },
            });
            localCategoryMap.set(supaCat.id, localCategory.id);
            categoriesAdded++;
          }
        }

        logInfo(`Categories: ${categoriesAdded} added, ${categoriesUpdated} updated`);

        // Step 2: Import/Update menu items from Supabase
        logInfo('Syncing menu items...');
        const supabaseItems = await this.supabase.query('item', 'id,name,price,is_special,category_id');

        for (const supaItem of supabaseItems || []) {
          const localCategoryId = localCategoryMap.get(supaItem.category_id);
          if (!localCategoryId) {
            logInfo(`Skipping item "${supaItem.name}" - category not found`);
            itemsSkipped++;
            continue;
          }

          // Validate required fields
          if (!supaItem.name || supaItem.price === null || supaItem.price === undefined) {
            logInfo(`Skipping item - missing name or price: ${JSON.stringify(supaItem)}`);
            itemsSkipped++;
            continue;
          }

          const existingItem = itemMap.get(supaItem.name.toLowerCase());

          if (existingItem) {
            // UPDATE existing item - only update fields from Supabase
            await tx.menuItem.update({
              where: { id: existingItem.id },
              data: {
                price: new Decimal(supaItem.price),
                categoryId: localCategoryId,
                sortOrder: supaItem.id,
                // PRESERVE local-only fields: description, imageUrl, isActive,
                // isPrintableInKitchen, isCustomizable (don't overwrite from Supabase)
                // Note: is_special from Supabase is not used locally
              },
            });
            itemsUpdated++;
          } else {
            // CREATE new item - provide defaults for all local-only fields
            await tx.menuItem.create({
              data: {
                name: supaItem.name,
                description: '', // Local-only field - default to empty
                price: new Decimal(supaItem.price),
                categoryId: localCategoryId,
                imageUrl: null, // Local-only field - no image from website
                isActive: true, // Local-only field - new items active by default
                isCustomizable: false, // Local-only field - default not customizable
                isPrintableInKitchen: true, // Local-only field - default printable
                sortOrder: supaItem.id,
                // Note: is_special from Supabase is not stored locally
                // Note: isVisibleOnWebsite column not yet added to schema
              },
            });
            itemsAdded++;
          }
        }

        logInfo(`Items: ${itemsAdded} added, ${itemsUpdated} updated, ${itemsSkipped} skipped`);

        // Step 3: Import Add-ons with Smart Grouping
        logInfo('📦 Step 3: Importing add-ons with smart grouping...');
        const supabaseAddons = await this.supabase.query('add_on', 'description,price,category_id');

        if (!supabaseAddons || supabaseAddons.length === 0) {
          logInfo('No add-ons found in Supabase');
        } else {
          // Step 3.1: Build category sets per addon
          logInfo('Building category sets per addon...');
          const addonCategorySets = new Map<string, Set<number>>();
          const addonPriceMap = new Map<string, number>();

          for (const record of supabaseAddons) {
            // Skip addons without description or price
            if (!record.description || record.price === null || record.price === undefined) {
              logInfo(`Skipping addon - missing description or price: ${JSON.stringify(record)}`);
              continue;
            }

            const key = record.description.toLowerCase();
            if (!addonCategorySets.has(key)) {
              addonCategorySets.set(key, new Set());
              addonPriceMap.set(key, record.price);
            }
            addonCategorySets.get(key)!.add(record.category_id);
          }

          // Step 3.2: Create category set signatures
          logInfo('Creating category set signatures...');
          const addonSignatures = new Map<string, string>();
          for (const [addon, categorySet] of addonCategorySets) {
            const signature = Array.from(categorySet).sort().join(',');
            addonSignatures.set(addon, signature);
          }

          // Step 3.3: Group addons by signature
          logInfo('Grouping addons by category signature...');
          const signatureGroups = new Map<string, string[]>();
          for (const [addon, signature] of addonSignatures) {
            if (!signatureGroups.has(signature)) {
              signatureGroups.set(signature, []);
            }
            signatureGroups.get(signature)!.push(addon);
          }

          // Step 3.4: Generate group names helper
          const generateGroupName = (signature: string): string => {
            const categoryIds = signature.split(',').map(Number);
            const totalCategories = localCategoryMap.size;

            // Universal add-ons (assigned to 80%+ of categories)
            if (categoryIds.length >= totalCategories * 0.8) {
              return "Universal Add-ons";
            }

            // Named groups for 1-2 categories
            if (categoryIds.length <= 2) {
              const categoryNames = categoryIds
                .map(id => {
                  const localId = localCategoryMap.get(id);
                  return existingCategories.find(c => c.id === localId)?.name;
                })
                .filter(Boolean)
                .join(' & ');
              return categoryNames ? `${categoryNames} Add-ons` : `Imported Add-ons (Group ${signature})`;
            }

            // Multi-category groups (3+ categories)
            return `Multi-Category Add-ons (${categoryIds.length} categories)`;
          };

          // Step 3.5: Create addon groups and addons
          logInfo('Creating addon groups and addons...');
          const groupSignatureMap = new Map<string, string>(); // signature → groupId
          let groupIndex = 0;
          let addonIndex = 0;

          for (const [signature, addonNames] of signatureGroups) {
            const groupName = generateGroupName(signature);
            const categoryIds = signature.split(',').map(Number);

            // Create addon group
            const addonGroup = await tx.addonGroup.create({
              data: {
                name: groupName,
                description: `Imported from website - ${categoryIds.length} ${categoryIds.length === 1 ? 'category' : 'categories'}`,
                isActive: true,
                sortOrder: groupIndex++,
              },
            });

            // Create addons in this group
            for (const addonName of addonNames) {
              // Find original record to preserve casing and get price
              const originalRecord = supabaseAddons.find(
                r => r.description.toLowerCase() === addonName
              );

              if (!originalRecord) continue;

              const existingAddon = addonMap.get(addonName);

              if (existingAddon) {
                // UPDATE existing addon
                await tx.addon.update({
                  where: { id: existingAddon.id },
                  data: {
                    price: new Decimal(originalRecord.price),
                    addonGroupId: addonGroup.id,
                    isActive: true,
                    sortOrder: addonIndex++,
                  },
                });
                addonsUpdated++;
              } else {
                // CREATE new addon
                await tx.addon.create({
                  data: {
                    addonGroupId: addonGroup.id,
                    name: originalRecord.description,
                    description: originalRecord.description,
                    price: new Decimal(originalRecord.price),
                    isActive: true,
                    sortOrder: addonIndex++,
                  },
                });
                addonsAdded++;
              }
            }

            // Track for assignment later
            groupSignatureMap.set(signature, addonGroup.id);
          }

          logInfo(`Add-ons: ${addonsAdded} added, ${addonsUpdated} updated in ${groupSignatureMap.size} groups`);

          // Step 3.6: Create category-group assignments
          logInfo('Creating category-addon group assignments...');
          for (const [signature, groupId] of groupSignatureMap) {
            const categoryIds = signature.split(',').map(Number);

            for (const supaCategoryId of categoryIds) {
              const localCategoryId = localCategoryMap.get(supaCategoryId);
              if (!localCategoryId) continue;

              // Check if assignment already exists
              const existingAssignment = await tx.categoryAddonGroup.findFirst({
                where: {
                  categoryId: localCategoryId,
                  addonGroupId: groupId,
                },
              });

              if (!existingAssignment) {
                await tx.categoryAddonGroup.create({
                  data: {
                    categoryId: localCategoryId,
                    addonGroupId: groupId,
                    isActive: true,
                    sortOrder: 0,
                  },
                });
                assignmentsAdded++;
              }
            }
          }

          logInfo(`✅ Imported ${addonsAdded + addonsUpdated} add-ons in ${groupSignatureMap.size} groups with ${assignmentsAdded} category assignments`);
        }

        const totalCategories = categoriesAdded + categoriesUpdated;
        const totalItems = itemsAdded + itemsUpdated;
        const totalAddons = addonsAdded + addonsUpdated;

        logInfo('✅ Non-destructive import completed successfully', {
          categories: totalCategories,
          items: totalItems,
          addons: totalAddons,
          assignments: assignmentsAdded,
        });

        return {
          success: true,
          importedCounts: {
            categories: totalCategories,
            items: totalItems,
            addons: totalAddons,
            assignments: assignmentsAdded,
          },
          diff: {
            categoriesAdded,
            categoriesUpdated,
            itemsAdded,
            itemsUpdated,
            itemsSkipped,
            addonsAdded,
            addonsUpdated,
            assignmentsAdded,
          },
        };
      });
    } catch (error) {
      logError(error as Error, 'importFromSupabase');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
