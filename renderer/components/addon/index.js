/**
 * Add-On Components - Comprehensive Collection with Stock Integration
 *
 * This module exports all add-on related components including:
 * - Core selection components
 * - Stock-aware enhanced components (Task 3.4)
 * - Advanced UI components (Task 3.2)
 * - Validation and feedback components
 * - Utility components
 */
// Core addon selection components
export { AddonSelectionStep } from './AddonSelectionStep';
export { AddonSelector, MemoizedAddonSelector } from './AddonSelector';
export { AddonGroupSelector } from './AddonGroupSelector';
// Enhanced addon group components (Task 3.2)
export { EnhancedAddonGroupSelector, MemoizedEnhancedAddonGroupSelector, } from './EnhancedAddonGroupSelector';
// Stock-aware components (Task 3.4)
export { StockAwareAddonSelector, MemoizedStockAwareAddonSelector, } from './StockAwareAddonSelector';
export { StockAwareAddonGroupSelector, MemoizedStockAwareAddonGroupSelector, } from './StockAwareAddonGroupSelector';
export { EnhancedStockIndicator, MemoizedEnhancedStockIndicator, } from './EnhancedStockIndicator';
export { AlternativeSuggestions, MemoizedAlternativeSuggestions, } from './AlternativeSuggestions';
// Basic components
export { StockIndicator, MemoizedStockIndicator } from './StockIndicator';
export { PriceImpactIndicator, MemoizedPriceImpactIndicator, } from './PriceImpactIndicator';
// Advanced UI components (Task 3.2)
export { AddonSearchBar, MemoizedAddonSearchBar } from './AddonSearchBar';
export { VirtualAddonList, MemoizedVirtualAddonList } from './VirtualAddonList';
export { AddonValidationFeedback, MemoizedAddonValidationFeedback, } from './AddonValidationFeedback';
// Re-export addon context and types for convenience
export { AddonSelectionProvider, useAddonSelection, } from '@/context/AddonSelectionContext';
// Stock service and hooks (Task 3.4)
export { addonStockService } from '@/services/addonStockService';
export { useAddonStock, useAddonStockStatus } from '@/hooks/useAddonStock';
