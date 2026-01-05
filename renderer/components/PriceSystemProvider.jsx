'use client';
import { useEffect } from 'react';
import { initializePriceMonitoring } from '@/utils/priceCacheUtils';
/**
 * PriceSystemProvider - Manages price persistence across application sessions
 *
 * This component initializes the price monitoring and caching system
 * to ensure prices are preserved across system restarts
 */
export default function PriceSystemProvider({ children, }) {
    // Initialize price monitoring on component mount
    useEffect(() => {
        try {
            initializePriceMonitoring();
            console.log('PriceSystemProvider: Price monitoring initialized');
        }
        catch (error) {
            console.error('Failed to initialize price monitoring:', error);
        }
    }, []);
    // This component doesn't render anything additional
    return <>{children}</>;
}
