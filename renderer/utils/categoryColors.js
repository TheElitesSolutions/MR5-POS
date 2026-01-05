/**
 * Utility for consistent category color management across the application
 */
// Define a consistent color palette with dark mode support
export const CATEGORY_COLORS = [
    'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
    'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    'bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-400',
    'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400',
];
// Fallback color when no category is provided
export const DEFAULT_CATEGORY_COLOR = 'bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-400';
/**
 * Generate a deterministic color for a given category name
 * This ensures the same category always gets the same color, regardless of order
 *
 * @param category The category name
 * @returns A consistent TailwindCSS class string for this category
 */
export function getCategoryColor(category) {
    if (!category || category.trim() === '') {
        return DEFAULT_CATEGORY_COLOR;
    }
    // Create a deterministic index based on the string content
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
        hash = (hash << 5) - hash + category.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    // Make sure it's a positive index within the color array bounds
    const index = Math.abs(hash) % CATEGORY_COLORS.length;
    return CATEGORY_COLORS[index];
}
/**
 * Generate a color map for an array of categories
 *
 * @param categories Array of category names
 * @returns An object mapping category names to color classes
 */
export function getCategoryColorMap(categories) {
    return categories.reduce((map, category) => {
        map[category] = getCategoryColor(category);
        return map;
    }, {});
}
export default getCategoryColor;
