'use client';
import { NavigationLoader } from '@/components/ui/loading-spinner';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
const LoadingContext = createContext({
    isLoading: false,
    setLoading: () => { },
    loadingText: 'Loading...',
});
export const useLoading = () => useContext(LoadingContext);
export function LoadingProvider({ children }) {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('Loading...');
    const pathname = usePathname();
    // DISABLED: Route-based loading to prevent conflicts with ProtectedRoute and Next.js loading files
    // The LoadingProvider should only be used for manual loading states, not automatic route loading
    useEffect(() => {
        // Set appropriate loading text based on the route (for manual usage)
        const getLoadingText = (path) => {
            if (path.includes('/dashboard'))
                return 'Loading Dashboard...';
            if (path.includes('/pos'))
                return 'Loading POS...';
            if (path.includes('/menu'))
                return 'Loading Menu...';
            if (path.includes('/stock'))
                return 'Loading Stock...';
            if (path.includes('/orders'))
                return 'Loading Orders...';
            if (path.includes('/expenses'))
                return 'Loading Expenses...';
            if (path.includes('/reports'))
                return 'Loading Reports...';
            if (path.includes('/settings'))
                return 'Loading Settings...';
            if (path.includes('/login'))
                return 'Loading Login...';
            if (path.includes('/register'))
                return 'Loading Register...';
            return 'Loading...';
        };
        setLoadingText(getLoadingText(pathname || '/'));
        // Don't show loading automatically - only when manually triggered
        setIsLoading(false);
    }, [pathname]);
    const setLoading = (loading, text = 'Loading...') => {
        setIsLoading(loading);
        setLoadingText(text);
    };
    return (<LoadingContext.Provider value={{ isLoading, setLoading, loadingText }}>
      {children}
      {isLoading && <NavigationLoader text={loadingText}/>}
    </LoadingContext.Provider>);
}
