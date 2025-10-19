/**
 * Addon Stock Service - Comprehensive stock availability management for add-ons
 *
 * Features:
 * - Real-time stock checking for add-ons
 * - Low-stock warnings and thresholds
 * - Out-of-stock prevention logic
 * - Alternative add-on suggestions
 * - Stock level categorization
 * - Performance optimized with caching
 */

import { Addon, AddonSelection } from '@/types/addon';

export interface StockStatus {
  level: 'available' | 'low' | 'critical' | 'out_of_stock';
  currentStock: number;
  minimumStock: number;
  isAvailable: boolean;
  canSelect: (quantity: number) => boolean;
  maxQuantity: number;
  warningMessage?: string;
  criticality: 'none' | 'warning' | 'error';
}

export interface StockCheckRequest {
  addonId: string;
  requestedQuantity: number;
  existingSelections?: AddonSelection[];
}

export interface StockCheckResult {
  addonId: string;
  status: StockStatus;
  alternatives: AddonAlternative[];
  recommendation: 'allow' | 'warn' | 'block';
}

export interface AddonAlternative {
  addon: Addon;
  reason: 'same_group' | 'similar_price' | 'similar_name' | 'popular';
  similarity: number; // 0-1 score
  stockStatus: StockStatus;
}

export interface BulkStockCheckRequest {
  selections: Array<{
    addonId: string;
    quantity: number;
  }>;
  categoryId?: string;
}

export interface BulkStockCheckResult {
  overallStatus: 'valid' | 'warnings' | 'errors';
  results: StockCheckResult[];
  blockedSelections: string[];
  warnings: Array<{
    addonId: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  alternatives: Array<{
    forAddonId: string;
    suggestions: AddonAlternative[];
  }>;
}

/**
 * AddonStockService - Manages stock availability for add-ons
 */
export class AddonStockService {
  private static instance: AddonStockService;
  private stockCache = new Map<
    string,
    { status: StockStatus; timestamp: number }
  >();
  private alternativeCache = new Map<
    string,
    { alternatives: AddonAlternative[]; timestamp: number }
  >();
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly LOW_STOCK_THRESHOLD = 0.2; // 20% of minimum stock
  private readonly CRITICAL_STOCK_THRESHOLD = 0.1; // 10% of minimum stock

  static getInstance(): AddonStockService {
    if (!AddonStockService.instance) {
      AddonStockService.instance = new AddonStockService();
    }
    return AddonStockService.instance;
  }

  /**
   * Get stock status for a single add-on
   */
  async getStockStatus(addon: Addon): Promise<StockStatus> {
    // Check cache first
    const cacheKey = `stock_${addon.id}`;
    const cached = this.stockCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.status;
    }

    // Calculate stock status
    const status = this.calculateStockStatus(addon);

    // Update cache
    this.stockCache.set(cacheKey, {
      status,
      timestamp: Date.now(),
    });

    return status;
  }

  /**
   * Check if specific quantity can be selected
   */
  async checkStockAvailability(
    request: StockCheckRequest
  ): Promise<StockCheckResult> {
    const addon = await this.getAddonById(request.addonId);
    if (!addon) {
      throw new Error(`Addon ${request.addonId} not found`);
    }

    const status = await this.getStockStatus(addon);

    // Calculate existing allocations
    const existingAllocated =
      request.existingSelections
        ?.filter(s => s.addonId === request.addonId)
        .reduce((sum, s) => sum + s.quantity, 0) || 0;

    const totalNeeded = existingAllocated + request.requestedQuantity;
    const recommendation = this.getRecommendation(status, totalNeeded);

    // Get alternatives if needed
    const alternatives =
      recommendation !== 'allow'
        ? await this.getAlternatives(addon, request.requestedQuantity)
        : [];

    return {
      addonId: request.addonId,
      status,
      alternatives,
      recommendation,
    };
  }

  /**
   * Check stock for multiple add-ons at once
   */
  async checkBulkStock(
    request: BulkStockCheckRequest
  ): Promise<BulkStockCheckResult> {
    const results = await Promise.all(
      request.selections.map(selection =>
        this.checkStockAvailability({
          addonId: selection.addonId,
          requestedQuantity: selection.quantity,
        })
      )
    );

    const blockedSelections: string[] = [];
    const warnings: BulkStockCheckResult['warnings'] = [];
    const alternatives: BulkStockCheckResult['alternatives'] = [];

    let hasErrors = false;
    let hasWarnings = false;

    for (const result of results) {
      if (result.recommendation === 'block') {
        hasErrors = true;
        blockedSelections.push(result.addonId);
      } else if (result.recommendation === 'warn') {
        hasWarnings = true;
        const addon = await this.getAddonById(result.addonId);
        warnings.push({
          addonId: result.addonId,
          message:
            result.status.warningMessage ||
            `Low stock for ${addon?.name || 'this add-on'}`,
          severity: result.status.level === 'critical' ? 'high' : 'medium',
        });
      }

      if (result.alternatives.length > 0) {
        alternatives.push({
          forAddonId: result.addonId,
          suggestions: result.alternatives,
        });
      }
    }

    const overallStatus = hasErrors
      ? 'errors'
      : hasWarnings
        ? 'warnings'
        : 'valid';

    return {
      overallStatus,
      results,
      blockedSelections,
      warnings,
      alternatives,
    };
  }

  /**
   * Get alternative add-ons for out-of-stock items
   */
  async getAlternatives(
    addon: Addon,
    requestedQuantity: number
  ): Promise<AddonAlternative[]> {
    // Check cache first
    const cacheKey = `alternatives_${addon.id}`;
    const cached = this.alternativeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.alternatives.filter(alt =>
        alt.stockStatus.canSelect(requestedQuantity)
      );
    }

    // Get all addons in the same group
    const groupAddons = await this.getAddonsByGroup(addon.addonGroupId);

    const alternatives: AddonAlternative[] = [];

    for (const alternative of groupAddons) {
      if (alternative.id === addon.id || !alternative.isActive) continue;

      const stockStatus = await this.getStockStatus(alternative);
      if (!stockStatus.canSelect(requestedQuantity)) continue;

      const similarity = this.calculateSimilarity(addon, alternative);
      const reason = this.getAlternativeReason(addon, alternative);

      alternatives.push({
        addon: alternative,
        reason,
        similarity,
        stockStatus,
      });
    }

    // Sort by similarity and stock availability
    alternatives.sort((a, b) => {
      if (a.stockStatus.level !== b.stockStatus.level) {
        const levelPriority = {
          available: 4,
          low: 3,
          critical: 2,
          out_of_stock: 1,
        };
        return (
          levelPriority[b.stockStatus.level] -
          levelPriority[a.stockStatus.level]
        );
      }
      return b.similarity - a.similarity;
    });

    // Cache the results
    this.alternativeCache.set(cacheKey, {
      alternatives: alternatives.slice(0, 5), // Top 5 alternatives
      timestamp: Date.now(),
    });

    return alternatives.slice(0, 3); // Return top 3 for UI
  }

  /**
   * Update stock levels (called after successful orders)
   */
  async updateStockLevels(
    updates: Array<{ addonId: string; newStock: number }>
  ): Promise<void> {
    for (const update of updates) {
      // Invalidate cache for this addon
      this.stockCache.delete(`stock_${update.addonId}`);
      this.alternativeCache.delete(`alternatives_${update.addonId}`);
    }
  }

  /**
   * Get real-time stock updates for multiple add-ons
   */
  async subscribeToStockUpdates(
    addonIds: string[],
    callback: (updates: Map<string, StockStatus>) => void
  ): Promise<() => void> {
    const interval = setInterval(async () => {
      const updates = new Map<string, StockStatus>();

      for (const addonId of addonIds) {
        try {
          const addon = await this.getAddonById(addonId);
          if (addon) {
            const status = await this.getStockStatus(addon);
            updates.set(addonId, status);
          }
        } catch (error) {
          console.error(
            `Failed to get stock status for addon ${addonId}:`,
            error
          );
        }
      }

      callback(updates);
    }, 10000); // Update every 10 seconds

    // Return unsubscribe function
    return () => clearInterval(interval);
  }

  /**
   * Clear all caches (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.stockCache.clear();
    this.alternativeCache.clear();
  }

  // Private helper methods
  private calculateStockStatus(addon: Addon): StockStatus {
    // If addon has no inventory link, it's always available
    if (!addon.inventory) {
      return {
        level: 'available',
        currentStock: Infinity,
        minimumStock: 0,
        isAvailable: true,
        canSelect: () => true,
        maxQuantity: 999,
        criticality: 'none',
      };
    }

    const { currentStock, minimumStock } = addon.inventory;
    const stockRatio = minimumStock > 0 ? currentStock / minimumStock : 1;

    let level: StockStatus['level'];
    let criticality: StockStatus['criticality'];
    let warningMessage: string | undefined;

    if (currentStock <= 0) {
      level = 'out_of_stock';
      criticality = 'error';
      warningMessage = `${addon.name} is out of stock`;
    } else if (stockRatio <= this.CRITICAL_STOCK_THRESHOLD) {
      level = 'critical';
      criticality = 'error';
      warningMessage = `${addon.name} is critically low (${currentStock} remaining)`;
    } else if (stockRatio <= this.LOW_STOCK_THRESHOLD) {
      level = 'low';
      criticality = 'warning';
      warningMessage = `${addon.name} is running low (${currentStock} remaining)`;
    } else {
      level = 'available';
      criticality = 'none';
    }

    return {
      level,
      currentStock,
      minimumStock,
      isAvailable: currentStock > 0,
      canSelect: (quantity: number) => currentStock >= quantity,
      maxQuantity: Math.max(0, currentStock),
      warningMessage: warningMessage || '',
      criticality,
    };
  }

  private getRecommendation(
    status: StockStatus,
    totalNeeded: number
  ): 'allow' | 'warn' | 'block' {
    if (!status.canSelect(totalNeeded)) {
      return 'block';
    }
    if (status.level === 'critical' || status.level === 'low') {
      return 'warn';
    }
    return 'allow';
  }

  private calculateSimilarity(addon1: Addon, addon2: Addon): number {
    let similarity = 0;

    // Same group (base similarity)
    if (addon1.addonGroupId === addon2.addonGroupId) {
      similarity += 0.5;
    }

    // Similar price (within 20%)
    const priceDiff = Math.abs(addon1.price - addon2.price);
    const avgPrice = (addon1.price + addon2.price) / 2;
    if (avgPrice > 0 && priceDiff / avgPrice <= 0.2) {
      similarity += 0.3;
    }

    // Similar name (basic string similarity)
    const name1 = addon1.name.toLowerCase();
    const name2 = addon2.name.toLowerCase();
    const nameWords1 = name1.split(/\s+/);
    const nameWords2 = name2.split(/\s+/);
    const commonWords = nameWords1.filter(word => nameWords2.includes(word));
    const nameScore =
      commonWords.length / Math.max(nameWords1.length, nameWords2.length);
    similarity += nameScore * 0.2;

    return Math.min(1, similarity);
  }

  private getAlternativeReason(
    original: Addon,
    alternative: Addon
  ): AddonAlternative['reason'] {
    if (original.addonGroupId === alternative.addonGroupId) {
      return 'same_group';
    }
    const priceDiff = Math.abs(original.price - alternative.price);
    const avgPrice = (original.price + alternative.price) / 2;
    if (avgPrice > 0 && priceDiff / avgPrice <= 0.1) {
      return 'similar_price';
    }
    if (this.calculateSimilarity(original, alternative) > 0.3) {
      return 'similar_name';
    }
    return 'popular'; // Default fallback
  }

  // Mock methods - these would be replaced with actual API calls
  private async getAddonById(id: string): Promise<Addon | null> {
    try {
      const response = await (window as any).electron.ipc.invoke(
        'addon:getById',
        {
          id,
        }
      );
      return response.success ? response.data : null;
    } catch (error) {
      console.error(`Failed to get addon ${id}:`, error);
      return null;
    }
  }

  private async getAddonsByGroup(groupId: string): Promise<Addon[]> {
    try {
      const response = await (window as any).electron.ipc.invoke(
        'addon:getByGroup',
        {
          groupId,
        }
      );
      return response.success ? response.data : [];
    } catch (error) {
      console.error(`Failed to get addons for group ${groupId}:`, error);
      return [];
    }
  }
}

// Singleton instance
export const addonStockService = AddonStockService.getInstance();
