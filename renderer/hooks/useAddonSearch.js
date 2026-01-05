'use client';
import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
/**
 * Advanced search hook for add-ons with fuzzy matching and debouncing
 *
 * Features:
 * - Debounced search to prevent excessive filtering
 * - Fuzzy matching for name and description
 * - Search result statistics
 * - Performance optimized for large lists
 */
export const useAddonSearch = ({ addons, searchDelay = 300, minSearchLength = 2, }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedQuery = useDebounce(searchQuery, searchDelay);
    // Simple fuzzy matching function
    const fuzzyMatch = useCallback((text, query) => {
        const normalizedText = text.toLowerCase();
        const normalizedQuery = query.toLowerCase();
        // Exact match gets highest priority
        if (normalizedText.includes(normalizedQuery)) {
            return true;
        }
        // Fuzzy match: check if all characters in query exist in text in order
        let textIndex = 0;
        let queryIndex = 0;
        while (textIndex < normalizedText.length &&
            queryIndex < normalizedQuery.length) {
            if (normalizedText[textIndex] === normalizedQuery[queryIndex]) {
                queryIndex++;
            }
            textIndex++;
        }
        return queryIndex === normalizedQuery.length;
    }, []);
    // Advanced scoring function for search results
    const scoreAddon = useCallback((addon, query) => {
        const normalizedQuery = query.toLowerCase();
        const name = addon.name.toLowerCase();
        const description = (addon.description || '').toLowerCase();
        let score = 0;
        // Exact name match (highest score)
        if (name === normalizedQuery) {
            score += 100;
        }
        // Name starts with query
        else if (name.startsWith(normalizedQuery)) {
            score += 80;
        }
        // Name contains query
        else if (name.includes(normalizedQuery)) {
            score += 60;
        }
        // Fuzzy match in name
        else if (fuzzyMatch(name, normalizedQuery)) {
            score += 40;
        }
        // Description matches (lower priority)
        if (description.includes(normalizedQuery)) {
            score += 20;
        }
        else if (fuzzyMatch(description, normalizedQuery)) {
            score += 10;
        }
        // Boost score for shorter names (more specific matches)
        if (score > 0) {
            score += Math.max(0, 50 - addon.name.length);
        }
        return score;
    }, [fuzzyMatch]);
    // Filter and sort addons based on search query
    const filteredAddons = useMemo(() => {
        // Return all addons if query is too short
        if (!debouncedQuery || debouncedQuery.length < minSearchLength) {
            return addons.filter(addon => addon.isActive);
        }
        // Score all addons and filter by minimum score
        const scoredAddons = addons
            .filter(addon => addon.isActive)
            .map(addon => ({
            addon,
            score: scoreAddon(addon, debouncedQuery),
        }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score) // Sort by score descending
            .map(({ addon }) => addon);
        return scoredAddons;
    }, [addons, debouncedQuery, minSearchLength, scoreAddon]);
    // Search state
    const isSearching = searchQuery !== debouncedQuery;
    // Search statistics
    const searchResults = useMemo(() => {
        const total = addons.filter(addon => addon.isActive).length;
        const filtered = filteredAddons.length;
        return {
            total,
            filtered,
            hasResults: filtered > 0,
        };
    }, [addons, filteredAddons]);
    // Clear search function
    const clearSearch = useCallback(() => {
        setSearchQuery('');
    }, []);
    return {
        searchQuery,
        setSearchQuery,
        debouncedQuery,
        filteredAddons,
        isSearching,
        searchResults,
        clearSearch,
    };
};
export default useAddonSearch;
