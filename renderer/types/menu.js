// Helper to convert from API format to UI format
export function convertToUIMenuItem(item) {
    return {
        ...item,
        createdAt: typeof item.createdAt === 'string'
            ? item.createdAt
            : item.createdAt instanceof Date
                ? item.createdAt.toISOString()
                : new Date().toISOString(),
        updatedAt: typeof item.updatedAt === 'string'
            ? item.updatedAt
            : item.updatedAt instanceof Date
                ? item.updatedAt.toISOString()
                : new Date().toISOString(),
        isAvailable: item.isAvailable ?? true,
        isCustomizable: item.isCustomizable ?? false,
        isVisibleOnWebsite: item.isVisibleOnWebsite ?? true,
    };
}
// Helper to convert from UI format to API format
export function convertToAPIMenuItem(item) {
    return {
        ...item,
        createdAt: item.createdAt, // Keep as string for API
        updatedAt: item.updatedAt, // Keep as string for API
    };
}
