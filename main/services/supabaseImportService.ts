import { PrismaClient } from '../db/prisma-wrapper';
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
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`Failed to parse JSON: ${e}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (e) => reject(e));
      req.end();
    });
  }
}

/**
 * Supabase Import Service
 * Imports menu data from Supabase into local database
 */
export class SupabaseImportService {
  private supabase: SupabaseHTTPClient;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.supabase = new SupabaseHTTPClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    logInfo('Supabase HTTP client initialized with hardcoded credentials');
    console.log('[Supabase] ✅ HTTP client initialized with hardcoded credentials');
  }

  public isConfigured(): boolean {
    return this.supabase !== null;
  }

  /**
   * Import all data from Supabase to local database
   * Deletes existing categories/items/addons first (full replace)
   */
  async importFromSupabase(): Promise<{
    success: boolean;
    importedCounts?: {
      categories: number;
      items: number;
      addons: number;
      assignments: number;
    };
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Supabase not configured',
      };
    }

    try {
      logInfo('📥 Starting import from Supabase...');

      // Step 1: Clear existing menu data
      logInfo('Clearing existing menu data...');
      await this.prisma.categoryAddonGroup.deleteMany({});
      await this.prisma.menuItemInventory.deleteMany({});
      await this.prisma.addon.deleteMany({});
      await this.prisma.addonGroup.deleteMany({});
      await this.prisma.menuItem.deleteMany({});
      await this.prisma.category.deleteMany({});

      // Step 2: Import categories from Supabase
      logInfo('Importing categories...');
      const supabaseCategories = await this.supabase.query('category');

      const categoryMap = new Map<number, string>(); // Supabase ID -> Local ID

      for (const supaCat of supabaseCategories || []) {
        const localCategory = await this.prisma.category.create({
          data: {
            name: supaCat.name,
            isActive: true,
            sortOrder: supaCat.id, // Use Supabase ID as sort order
          },
        });
        categoryMap.set(supaCat.id, localCategory.id);
      }

      logInfo(`Imported ${categoryMap.size} categories`);

      // Step 3: Import items from Supabase
      logInfo('Importing menu items...');
      const supabaseItems = await this.supabase.query('item');

      let itemCount = 0;
      for (const supaItem of supabaseItems || []) {
        const localCategoryId = categoryMap.get(supaItem.category_id);
        if (!localCategoryId) {
          logInfo(`Skipping item "${supaItem.name}" - category not found`);
          continue;
        }

        // Validate required fields
        if (!supaItem.name || supaItem.price === null || supaItem.price === undefined) {
          logInfo(`Skipping item - missing name or price: ${JSON.stringify(supaItem)}`);
          continue;
        }

        await this.prisma.menuItem.create({
          data: {
            name: supaItem.name,
            description: supaItem.description || '',
            price: new Decimal(supaItem.price),
            categoryId: localCategoryId,
            imageUrl: supaItem.image_url || null,
            isActive: supaItem.is_active !== undefined ? Boolean(supaItem.is_active) : true,
            isCustomizable: false,
            sortOrder: supaItem.id, // Use Supabase ID as sort order
          },
        });
        itemCount++;
      }

      logInfo(`Imported ${itemCount} menu items`);

      // Step 4: Import add-ons from Supabase
      logInfo('Importing add-ons...');
      const supabaseAddons = await this.supabase.query('add_on');

      // Group addons by description (since description is used as name)
      const addonsByName = new Map<string, any[]>();
      for (const supaAddon of supabaseAddons || []) {
        // Skip addons without a description or price
        if (!supaAddon.description || supaAddon.price === null || supaAddon.price === undefined) {
          logInfo(`Skipping addon - missing description or price: ${JSON.stringify(supaAddon)}`);
          continue;
        }

        if (!addonsByName.has(supaAddon.description)) {
          addonsByName.set(supaAddon.description, []);
        }
        addonsByName.get(supaAddon.description)!.push(supaAddon);
      }

      // Create a default addon group
      const defaultGroup = await this.prisma.addonGroup.create({
        data: {
          name: 'Imported Add-ons',
          description: 'Add-ons imported from Supabase',
          isActive: true,
          sortOrder: 0,
        },
      });

      let addonCount = 0;

      for (const [addonName, supabaseAddonRecords] of addonsByName) {
        // Use the first record for addon data
        const firstRecord = supabaseAddonRecords[0];

        // Create the addon
        await this.prisma.addon.create({
          data: {
            name: addonName,
            description: addonName,
            price: new Decimal(firstRecord.price),
            addonGroupId: defaultGroup.id,
            isActive: true,
            sortOrder: firstRecord.id,
          },
        });
        addonCount++;
      }

      // Assign the addon group to all categories that have addons
      const categoriesWithAddons = [
        ...new Set(
          (supabaseAddons || [])
            .map(addon => addon.category_id)
            .filter(id => id !== null)
        ),
      ];

      let assignmentCount = 0;
      for (const supaCategoryId of categoriesWithAddons) {
        const localCategoryId = categoryMap.get(supaCategoryId);
        if (localCategoryId) {
          await this.prisma.categoryAddonGroup.create({
            data: {
              categoryId: localCategoryId,
              addonGroupId: defaultGroup.id,
              isActive: true,
              sortOrder: 0,
            },
          });
          assignmentCount++;
        }
      }

      logInfo(`Imported ${addonCount} add-ons with ${assignmentCount} category assignments`);

      const importedCounts = {
        categories: categoryMap.size,
        items: itemCount,
        addons: addonCount,
        assignments: assignmentCount,
      };

      logInfo('✅ Import completed successfully', importedCounts);

      return {
        success: true,
        importedCounts,
      };
    } catch (error) {
      logError(error as Error, 'importFromSupabase');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

