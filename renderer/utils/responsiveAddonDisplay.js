/**
 * Determines the appropriate display configuration based on screen size
 */
export function getResponsiveConfig() {
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const touchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
    return {
        isMobile: screenWidth < 768,
        isTablet: screenWidth >= 768 && screenWidth < 1024,
        isDesktop: screenWidth >= 1024,
        screenWidth,
        screenHeight,
        touchDevice,
    };
}
/**
 * Gets the optimal number of addon items to display per row based on screen size
 */
export function getAddonItemsPerRow(config) {
    if (config.isMobile)
        return 1;
    if (config.isTablet)
        return 2;
    return 3; // Desktop
}
/**
 * Gets the appropriate addon card size for the current screen
 */
export function getAddonCardSize(config) {
    if (config.isMobile)
        return 'sm';
    if (config.isTablet)
        return 'md';
    return 'lg';
}
/**
 * Determines if addon descriptions should be shown based on screen size
 */
export function shouldShowAddonDescriptions(config) {
    return !config.isMobile; // Hide descriptions on mobile to save space
}
/**
 * Gets the maximum number of addon groups to show expanded on initial load
 */
export function getInitialExpandedGroups(config) {
    if (config.isMobile)
        return 1; // Only expand first group
    if (config.isTablet)
        return 2;
    return 3; // Desktop can handle more
}
/**
 * Calculates the optimal virtualization threshold for addon lists
 */
export function getVirtualizationThreshold(config) {
    if (config.isMobile)
        return 10; // Lower threshold for mobile performance
    if (config.isTablet)
        return 20;
    return 50; // Desktop can handle larger lists
}
/**
 * Gets the appropriate container height for virtualized addon lists
 */
export function getVirtualListHeight(config) {
    if (config.isMobile)
        return 300; // Smaller height for mobile
    if (config.isTablet)
        return 400;
    return 500; // Larger height for desktop
}
/**
 * Determines the touch target size for interactive elements
 */
export function getTouchTargetSize(config) {
    return config.touchDevice ? 44 : 32; // 44px minimum for touch devices (iOS HIG)
}
/**
 * Creates a compact addon summary for mobile displays
 */
export function createMobileAddonSummary(addons, maxItems = 2) {
    if (addons.length === 0)
        return '';
    const displayAddons = addons.slice(0, maxItems);
    const remaining = addons.length - maxItems;
    let summary = displayAddons
        .map(addon => {
        // Handle different addon types (AddonSelection vs OrderItemAddon)
        const name = 'addonName' in addon
            ? addon.addonName
            : 'addon' in addon && addon.addon
                ? addon.addon.name
                : 'Unknown Add-on';
        const qty = addon.quantity > 1 ? `x${addon.quantity}` : '';
        return `${qty} ${name}`.trim();
    })
        .join(', ');
    if (remaining > 0) {
        summary += ` +${remaining} more`;
    }
    return summary;
}
/**
 * Determines if a collapsible section should be expanded by default
 */
export function shouldExpandByDefault(config, priority, index) {
    const maxExpanded = getInitialExpandedGroups(config);
    if (priority === 'high')
        return true;
    if (priority === 'medium')
        return index < maxExpanded;
    return false; // Low priority items collapsed by default
}
/**
 * Gets responsive spacing classes for Tailwind CSS
 */
export function getResponsiveSpacing(config, element) {
    const spacing = {
        container: {
            mobile: 'p-3 space-y-3',
            tablet: 'p-4 space-y-4',
            desktop: 'p-6 space-y-6',
        },
        card: {
            mobile: 'p-3',
            tablet: 'p-4',
            desktop: 'p-6',
        },
        button: {
            mobile: 'px-3 py-2',
            tablet: 'px-4 py-2',
            desktop: 'px-6 py-3',
        },
        text: {
            mobile: 'text-sm',
            tablet: 'text-base',
            desktop: 'text-base',
        },
    };
    if (config.isMobile)
        return spacing[element].mobile;
    if (config.isTablet)
        return spacing[element].tablet;
    return spacing[element].desktop;
}
/**
 * Gets responsive grid classes for addon layouts
 */
export function getAddonGridClasses(config) {
    if (config.isMobile) {
        return 'grid grid-cols-1 gap-3'; // Single column on mobile
    }
    if (config.isTablet) {
        return 'grid grid-cols-2 gap-4'; // Two columns on tablet
    }
    return 'grid grid-cols-3 gap-6'; // Three columns on desktop
}
/**
 * Determines if search functionality should be enabled based on screen size and list length
 */
export function shouldEnableSearch(config, itemCount) {
    // Enable search for smaller lists on mobile to save space
    if (config.isMobile)
        return itemCount > 5;
    if (config.isTablet)
        return itemCount > 8;
    return itemCount > 12; // Desktop can handle larger lists without search
}
/**
 * Gets the appropriate keyboard navigation behavior for the device
 */
export function getKeyboardNavigationConfig(config) {
    return {
        enabled: !config.touchDevice, // Disable keyboard nav on touch devices
        allowWrap: config.isDesktop, // Only allow wrapping on desktop
        showShortcuts: config.isDesktop, // Only show keyboard shortcuts on desktop
    };
}
/**
 * Creates a responsive breakpoint observer for dynamic layout updates
 */
export function createResponsiveObserver(callback, debounceMs = 250) {
    if (typeof window === 'undefined') {
        return () => { }; // No-op for SSR
    }
    let timeoutId;
    const handleResize = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            callback(getResponsiveConfig());
        }, debounceMs);
    };
    window.addEventListener('resize', handleResize);
    // Return cleanup function
    return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', handleResize);
    };
}
/**
 * Optimizes addon data for mobile display by reducing unnecessary information
 */
export function optimizeAddonsForMobile(addons, config) {
    if (!config.isMobile)
        return addons;
    // On mobile, prioritize most expensive add-ons and group similar ones
    return addons
        .sort((a, b) => b.totalPrice - a.totalPrice) // Most expensive first
        .slice(0, 10); // Limit to top 10 on mobile for performance
}
/**
 * Gets the appropriate modal/dialog size for addon selection
 */
export function getAddonModalSize(config) {
    if (config.isMobile)
        return 'sm'; // Smaller modal on mobile
    if (config.isTablet)
        return 'md';
    return 'lg'; // Larger modal on desktop
}
/**
 * Determines if addon images should be loaded based on device capabilities
 */
export function shouldLoadAddonImages(config) {
    // Load images on desktop and tablet, but be conservative on mobile
    return !config.isMobile || config.screenWidth > 480;
}
export function getPerformanceConfig(config) {
    return {
        enableVirtualization: config.isMobile, // Enable on mobile for better performance
        enableImageLazyLoading: true, // Always enable
        enableDebouncing: config.touchDevice, // Enable on touch devices
        enableMemorization: true, // Always enable
        batchSize: config.isMobile ? 5 : 10, // Smaller batches on mobile
        debounceMs: config.isMobile ? 300 : 200, // Longer debounce on mobile
    };
}
export default {
    getResponsiveConfig,
    getAddonItemsPerRow,
    getAddonCardSize,
    shouldShowAddonDescriptions,
    getInitialExpandedGroups,
    getVirtualizationThreshold,
    getVirtualListHeight,
    getTouchTargetSize,
    createMobileAddonSummary,
    shouldExpandByDefault,
    getResponsiveSpacing,
    getAddonGridClasses,
    shouldEnableSearch,
    getKeyboardNavigationConfig,
    createResponsiveObserver,
    optimizeAddonsForMobile,
    getAddonModalSize,
    shouldLoadAddonImages,
    getPerformanceConfig,
};
