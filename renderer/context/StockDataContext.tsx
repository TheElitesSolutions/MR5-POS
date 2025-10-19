import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useStockItems } from '@/hooks/useStockData';
import { clearIngredientNameCache } from '@/utils/ingredientUtils';

// Create context for stock data
type StockDataContextType = ReturnType<typeof useStockItems>;

const StockDataContext = createContext<StockDataContextType | undefined>(
  undefined
);

interface StockDataProviderProps {
  children: ReactNode;
}

export const StockDataProvider = ({ children }: StockDataProviderProps) => {
  // Single instance of the stock data hook - no prefetch, just rely on the hook's behavior
  const stockData = useStockItems();

  // Clear ingredient name cache when stock data changes to ensure fresh lookups
  useEffect(() => {
    if (stockData.stockItems && stockData.stockItems.length > 0) {
      clearIngredientNameCache();
    }
  }, [stockData.stockItems]);

  return (
    <StockDataContext.Provider value={stockData}>
      {children}
    </StockDataContext.Provider>
  );
};

// Custom hook to use the stock data context
export const useSharedStockData = () => {
  const context = useContext(StockDataContext);
  if (context === undefined) {
    console.warn('useSharedStockData must be used within a StockDataProvider');
    // Fallback to direct hook in case provider is missing
    return useStockItems();
  }
  return context;
};
