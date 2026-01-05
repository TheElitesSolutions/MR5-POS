'use client';
import { useState, useEffect, useMemo } from 'react';
import { getResponsiveConfig, getAddonCardSize, getAddonItemsPerRow, shouldShowAddonDescriptions, getInitialExpandedGroups, getVirtualizationThreshold, getVirtualListHeight, getTouchTargetSize, shouldExpandByDefault, getResponsiveSpacing, getAddonGridClasses, shouldEnableSearch, getKeyboardNavigationConfig, getPerformanceConfig, createResponsiveObserver, } from '@/utils/responsiveAddonDisplay';
/**
 * Custom hook for responsive add-on display management
 *
 * Features:
 * - Automatic responsive configuration detection
 * - Real-time screen size monitoring
 * - Performance optimization settings
 * - Accessibility configurations
 * - Component-specific responsive helpers
 */
export const useResponsiveAddonDisplay = () => {
    const [config, setConfig] = useState(() => getResponsiveConfig());
    // Update config on resize
    useEffect(() => {
        const cleanup = createResponsiveObserver(setConfig, 250);
        return cleanup;
    }, []);
    // Memoize derived configurations for performance
    const responsiveSettings = useMemo(() => {
        const performanceConfig = getPerformanceConfig(config);
        const keyboardConfig = getKeyboardNavigationConfig(config);
        return {
            // Basic device info
            ...config,
            // Component sizing
            cardSize: getAddonCardSize(config),
            itemsPerRow: getAddonItemsPerRow(config),
            touchTargetSize: getTouchTargetSize(config),
            // Display preferences
            showDescriptions: shouldShowAddonDescriptions(config),
            initialExpandedGroups: getInitialExpandedGroups(config),
            // Performance settings
            virtualizationThreshold: getVirtualizationThreshold(config),
            virtualListHeight: getVirtualListHeight(config),
            performance: performanceConfig,
            // Keyboard navigation
            keyboard: keyboardConfig,
            // Helper functions with config pre-applied
            shouldExpandByDefault: (priority, index) => shouldExpandByDefault(config, priority, index),
            getSpacing: (element) => getResponsiveSpacing(config, element),
            getGridClasses: () => getAddonGridClasses(config),
            shouldEnableSearch: (itemCount) => shouldEnableSearch(config, itemCount),
        };
    }, [config]);
    return responsiveSettings;
};
/**
 * Hook for addon group specific responsive behavior
 */
export const useAddonGroupResponsive = (groupId, addonCount) => {
    const responsive = useResponsiveAddonDisplay();
    const groupSettings = useMemo(() => {
        return {
            ...responsive,
            // Group-specific settings
            shouldCollapse: responsive.isMobile && addonCount > 5,
            shouldVirtualize: addonCount > responsive.virtualizationThreshold,
            enableSearch: responsive.shouldEnableSearch(addonCount),
            // Grid layout for this group
            gridClasses: responsive.getGridClasses(),
            // Container spacing
            containerClasses: responsive.getSpacing('container'),
        };
    }, [responsive, groupId, addonCount]);
    return groupSettings;
};
/**
 * Hook for addon selector responsive behavior
 */
export const useAddonSelectorResponsive = () => {
    const responsive = useResponsiveAddonDisplay();
    const selectorSettings = useMemo(() => {
        return {
            ...responsive,
            // Selector-specific settings
            size: responsive.cardSize,
            showPrice: !responsive.isMobile, // Hide price on mobile to save space
            showDescription: responsive.showDescriptions,
            // Touch optimization
            minTouchHeight: responsive.touchTargetSize,
            // Button sizing
            buttonClasses: responsive.getSpacing('button'),
            // Quantity controls
            quantityButtonSize: responsive.touchDevice ? 'lg' : 'md',
        };
    }, [responsive]);
    return selectorSettings;
};
/**
 * Hook for order display responsive behavior
 */
export const useOrderDisplayResponsive = (itemCount) => {
    const responsive = useResponsiveAddonDisplay();
    const orderSettings = useMemo(() => {
        return {
            ...responsive,
            // Order display settings
            compactMode: responsive.isMobile,
            showFilters: itemCount > 3 && !responsive.isMobile,
            showSearch: responsive.shouldEnableSearch(itemCount),
            showSummaryDetails: !responsive.isMobile,
            // Layout
            listHeight: responsive.isMobile ? 300 : 500,
            itemsPerPage: responsive.isMobile ? 5 : 10,
            // Card settings
            cardPadding: responsive.getSpacing('card'),
        };
    }, [responsive, itemCount]);
    return orderSettings;
};
/**
 * Hook for addon validation responsive behavior
 */
export const useAddonValidationResponsive = () => {
    const responsive = useResponsiveAddonDisplay();
    const validationSettings = useMemo(() => {
        return {
            ...responsive,
            // Validation display settings
            showProgress: !responsive.isMobile, // Hide detailed progress on mobile
            showSuggestions: true,
            collapseDetails: responsive.isMobile,
            // Toast/notification settings
            toastPosition: responsive.isMobile ? 'bottom' : 'top-right',
            toastDuration: responsive.isMobile ? 3000 : 5000, // Shorter on mobile
        };
    }, [responsive]);
    return validationSettings;
};
/**
 * Hook for managing breakpoint-specific component states
 */
export const useBreakpointState = (mobileValue, tabletValue, desktopValue) => {
    const responsive = useResponsiveAddonDisplay();
    return useMemo(() => {
        if (responsive.isMobile)
            return mobileValue;
        if (responsive.isTablet)
            return tabletValue;
        return desktopValue;
    }, [
        responsive.isMobile,
        responsive.isTablet,
        mobileValue,
        tabletValue,
        desktopValue,
    ]);
};
/**
 * Hook for performance monitoring and optimization
 */
export const useAddonPerformanceOptimization = () => {
    const responsive = useResponsiveAddonDisplay();
    const [performanceMetrics, setPerformanceMetrics] = useState({
        renderTime: 0,
        componentCount: 0,
        memoryUsage: 0,
    });
    const startPerformanceMeasure = (name) => {
        if (typeof performance !== 'undefined') {
            performance.mark(`${name}-start`);
        }
    };
    const endPerformanceMeasure = (name) => {
        if (typeof performance !== 'undefined') {
            performance.mark(`${name}-end`);
            performance.measure(name, `${name}-start`, `${name}-end`);
            const measure = performance.getEntriesByName(name)[0];
            if (measure) {
                setPerformanceMetrics(prev => ({
                    ...prev,
                    renderTime: measure.duration,
                }));
            }
        }
    };
    const optimizationSettings = useMemo(() => {
        return {
            ...responsive.performance,
            // Performance monitoring
            startMeasure: startPerformanceMeasure,
            endMeasure: endPerformanceMeasure,
            metrics: performanceMetrics,
            // Optimization recommendations
            shouldMemoize: responsive.performance.enableMemorization,
            shouldDebounce: responsive.performance.enableDebouncing,
            shouldVirtualize: responsive.performance.enableVirtualization,
        };
    }, [responsive.performance, performanceMetrics]);
    return optimizationSettings;
};
export default useResponsiveAddonDisplay;
