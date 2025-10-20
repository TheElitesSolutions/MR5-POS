'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { menuLogger } from '@/utils/logger';
import { usePOSStore } from '@/stores/posStore';
import { getIngredientNameSafe } from '@/utils/ingredientUtils';
import { useSharedStockData } from '@/context/StockDataContext';
import { useAvailableMenuItems } from '@/hooks/useMenuData';
import { Customization, MenuItem } from '@/types';
import { AlertTriangle, Minus, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MenuSelectorProps {
  onClose: () => void;
}

interface IngredientAvailability {
  ingredient: {
    stockItemId: string;
    quantityNeeded: number;
  };
  isAvailable: boolean;
  currentStock: number;
  requiredStock: number;
  isLowStock: boolean;
}

const MenuSelector = ({ onClose }: MenuSelectorProps) => {
  // UI state only from POS store
  const { addOrderItem, isLoading: posLoading } = usePOSStore();

  // Data from new service layer - automatically cached and deduplicated
  const {
    menuItems,
    categories,
    isLoading: menuLoading,
    error: menuError,
  } = useAvailableMenuItems();

  // Use shared stock data from context - no direct API calls
  const {
    stockItems,
    isLoading: stockLoading,
    error: stockError,
  } = useSharedStockData();

  const { toast } = useToast();

  // Local component state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [customizations, setCustomizations] = useState<Customization[]>([]);
  const [ingredientAvailability, setIngredientAvailability] = useState<
    IngredientAvailability[]
  >([]);
  const [showStockWarning, setShowStockWarning] = useState(false);
  const [isLoadingIngredients, setIsLoadingIngredients] = useState(false);

  // Combined loading state
  const isLoading = posLoading || menuLoading || stockLoading;

  // Show error messages if any
  useEffect(() => {
    if (menuError) {
      toast({
        title: 'Menu Error',
        description: menuError,
        variant: 'destructive',
      });
    }
    if (stockError) {
      toast({
        title: 'Stock Error',
        description: stockError,
        variant: 'destructive',
      });
    }
  }, [menuError, stockError, toast]);

  const filteredItems = menuItems.filter(item => {
    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description &&
        item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch && item.isAvailable;
  });

  const checkIngredientAvailability = async (
    menuItemId: string,
    orderQuantity: number
  ) => {
    setIsLoadingIngredients(true);
    try {
      // Get the selected menu item and its ingredients
      const menuItem = menuItems.find(item => item.id === menuItemId);
      if (
        !menuItem ||
        !menuItem.ingredients ||
        menuItem.ingredients.length === 0
      ) {
        // No ingredients to check
        setIngredientAvailability([]);
        setIsLoadingIngredients(false);
        return true;
      }

      // Convert ingredient objects from menu item to simplified ingredient objects
      const ingredients: Array<{
        stockItemId: string;
        quantityNeeded: number;
      }> = menuItem.ingredients.map(ingredient => ({
        stockItemId: ingredient.id, // ✅ Use ingredient.id instead of treating ingredient as ID
        quantityNeeded: ingredient.quantityRequired || 1, // ✅ Use quantityRequired from ingredient object
      }));

      const availability: IngredientAvailability[] = ingredients.map(
        ingredient => {
          const stockItem = stockItems.find(
            stock => stock.id === ingredient.stockItemId
          );
          const requiredQuantity = ingredient.quantityNeeded * orderQuantity;
          const currentStock = stockItem?.currentQuantity || 0;
          const isAvailable = currentStock >= requiredQuantity;
          const minimumQty = stockItem?.minimumQuantity ?? stockItem?.minimumStock ?? 0;
          const isLowStock = stockItem
            ? currentStock <= minimumQty
            : true;

          return {
            ingredient,
            isAvailable,
            currentStock,
            requiredStock: requiredQuantity,
            isLowStock,
          };
        }
      );

      setIngredientAvailability(availability);

      // Check if any ingredients are unavailable or low stock
      const unavailableIngredients = availability.filter(
        item => !item.isAvailable
      );
      const lowStockIngredients = availability.filter(
        item => item.isLowStock && item.isAvailable
      );

      if (unavailableIngredients.length > 0) {
        // Show toast for unavailable ingredients
        toast({
          title: 'Insufficient Stock',
          description: `Not enough stock for: ${unavailableIngredients
            .map(item =>
              getIngredientNameSafe(
                item.ingredient.stockItemId,
                stockItems,
                'Unknown'
              )
            )
            .filter(name => name !== 'Unknown')
            .join(', ')}`,
          variant: 'destructive',
        });
        setShowStockWarning(true);
        return false;
      } else if (lowStockIngredients.length > 0) {
        // Show warning for low stock ingredients
        toast({
          title: 'Low Stock Warning',
          description: `Low stock for: ${lowStockIngredients
            .map(item =>
              getIngredientNameSafe(
                item.ingredient.stockItemId,
                stockItems,
                'Unknown'
              )
            )
            .filter(name => name !== 'Unknown')
            .join(', ')}`,
          variant: 'default',
        });
        setShowStockWarning(true);
        return true;
      }

      return true;
    } catch (error) {
      menuLogger.error('Failed to check ingredient availability:', error);
      toast({
        title: 'Stock Check Failed',
        description:
          'Unable to verify ingredient availability. Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoadingIngredients(false);
    }
  };

  const handleItemSelect = async (item: MenuItem) => {
    setSelectedItem(item);
    setQuantity(1);
    setSpecialInstructions('');
    setCustomizations([]);
    setShowStockWarning(false);

    // Check ingredient availability for the selected item
    await checkIngredientAvailability(item.id, 1);
  };

  const handleQuantityChange = async (newQuantity: number) => {
    setQuantity(newQuantity);
    if (selectedItem) {
      await checkIngredientAvailability(selectedItem.id, newQuantity);
    }
  };

  const handleAddToOrder = async () => {
    if (!selectedItem) return;

    // Final stock check before adding to order
    const canProceed = await checkIngredientAvailability(
      selectedItem.id,
      quantity
    );

    if (!canProceed) {
      return; // Don't proceed if stock is insufficient
    }

    try {
      await addOrderItem(
        selectedItem.id,
        quantity,
        customizations,
        specialInstructions || undefined
      );

      // Reset form
      setSelectedItem(null);
      setQuantity(1);
      setSpecialInstructions('');
      setCustomizations([]);
      setIngredientAvailability([]);
      setShowStockWarning(false);

      toast({
        title: 'Item Added',
        description: `${selectedItem.name} has been added to the order`,
      });

      onClose();
    } catch (error: unknown) {
      menuLogger.error('Failed to add item to order:', error);

      // Check if it's a stock-related error from the backend
      if (
        (error as any).response?.status === 409 &&
        (error as any).response?.data?.error?.includes('Insufficient stock')
      ) {
        toast({
          title: 'Insufficient Stock',
          description: (error as any).response.data.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Failed to Add Item',
          description: 'Unable to add item to order. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const calculateItemTotal = () => {
    if (!selectedItem) return 0;

    const basePrice = selectedItem.price * quantity;
    const customizationPrice = customizations.reduce(
      (total, custom) => total + custom.priceAdjustment * quantity,
      0
    );

    return basePrice + customizationPrice;
  };

  const getStockStatusBadge = (availability: IngredientAvailability) => {
    if (!availability.isAvailable) {
      return (
        <Badge variant='destructive' className='text-xs'>
          Out of Stock
        </Badge>
      );
    } else if (availability.isLowStock) {
      return (
        <Badge
          variant='outline'
          className='border-yellow-600 text-xs text-yellow-600'
        >
          Low Stock
        </Badge>
      );
    } else {
      return (
        <Badge
          variant='outline'
          className='border-green-600 text-xs text-green-600'
        >
          Available
        </Badge>
      );
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className='max-h-[90dvh] max-w-4xl overflow-hidden'>
        <DialogHeader>
          <DialogTitle>Add Items to Order</DialogTitle>
        </DialogHeader>

        <div className='flex h-[70vh]'>
          {/* Left Panel - Menu Items */}
          <div className='flex flex-1 flex-col pr-4'>
            {/* Search and Filters */}
            <div className='mb-4 space-y-4'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400' />
                <Input
                  placeholder='Search menu items...'
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className='pl-10'
                />
              </div>

              <div className='flex flex-wrap gap-2'>
                <Button
                  size='sm'
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('all')}
                >
                  All Items
                </Button>
                {categories.map(category => (
                  <Button
                    key={category}
                    size='sm'
                    variant={
                      selectedCategory === category ? 'default' : 'outline'
                    }
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className='flex-1 overflow-y-auto'>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                {filteredItems.map(item => (
                  <Card
                    key={item.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedItem?.id === item.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => handleItemSelect(item)}
                  >
                    <CardContent className='p-4'>
                      <div className='space-y-2'>
                        <div className='flex items-start justify-between'>
                          <h4 className='text-sm font-medium'>{item.name}</h4>
                          <Badge variant='outline'>
                            ${item.price.toFixed(2)}
                          </Badge>
                        </div>

                        <p className='line-clamp-2 text-xs text-gray-600'>
                          {item.description}
                        </p>

                        <div className='flex items-center justify-between text-xs text-gray-500'>
                          <span>{item.category}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredItems.length === 0 && (
                <div className='py-8 text-center'>
                  <p className='text-gray-500'>No items found</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Item Details */}
          <div className='w-80 border-l pl-4'>
            {selectedItem ? (
              <div className='space-y-4'>
                <div>
                  <h3 className='text-lg font-semibold'>{selectedItem.name}</h3>
                  <p className='mt-1 text-sm text-gray-600'>
                    {selectedItem.description}
                  </p>
                  <div className='mt-2 flex items-center justify-between'>
                    <Badge>{selectedItem.category}</Badge>
                    <span className='text-lg font-bold'>
                      ${selectedItem.price.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <Label>Quantity</Label>
                  <div className='mt-1 flex items-center space-x-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() =>
                        handleQuantityChange(Math.max(1, quantity - 1))
                      }
                      disabled={isLoadingIngredients}
                    >
                      <Minus className='h-3 w-3' />
                    </Button>
                    <span className='w-12 text-center'>{quantity}</span>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={isLoadingIngredients}
                    >
                      <Plus className='h-3 w-3' />
                    </Button>
                  </div>
                  {isLoadingIngredients && (
                    <div className='mt-1 text-xs text-gray-500'>
                      Checking stock availability...
                    </div>
                  )}
                </div>

                {/* Ingredient Availability */}
                {ingredientAvailability.length > 0 && (
                  <div>
                    <Label>Ingredient Availability</Label>
                    <div className='mt-1 max-h-32 space-y-2 overflow-y-auto'>
                      {ingredientAvailability.map((availability, index) => (
                        <div
                          key={index}
                          className='flex items-center justify-between rounded bg-gray-50 p-2 text-xs'
                        >
                          <span className='font-medium'>
                            {getIngredientNameSafe(
                              availability.ingredient.stockItemId,
                              stockItems,
                              'Loading...'
                            )}
                          </span>
                          <div className='flex items-center space-x-2'>
                            <span className='text-gray-600'>
                              {availability.currentStock} /{' '}
                              {availability.requiredStock}
                            </span>
                            {getStockStatusBadge(availability)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Special Instructions */}
                <div>
                  <Label htmlFor='instructions'>Special Instructions</Label>
                  <Textarea
                    id='instructions'
                    placeholder='Any special requests...'
                    value={specialInstructions}
                    onChange={e => setSpecialInstructions(e.target.value)}
                    className='mt-1'
                    rows={3}
                  />
                </div>

                {/* Stock Status Warning */}
                {showStockWarning &&
                  ingredientAvailability.some(item => !item.isAvailable) && (
                    <div className='rounded-lg border border-red-200 bg-red-50 p-3'>
                      <div className='flex items-center space-x-2'>
                        <AlertTriangle className='h-4 w-4 text-red-500' />
                        <span className='text-sm font-medium text-red-700'>
                          Stock Alert
                        </span>
                      </div>
                      <p className='mt-1 text-xs text-red-600'>
                        Some ingredients are out of stock. This item cannot be
                        prepared.
                      </p>
                    </div>
                  )}

                {showStockWarning &&
                  ingredientAvailability.some(
                    item => item.isLowStock && item.isAvailable
                  ) &&
                  !ingredientAvailability.some(item => !item.isAvailable) && (
                    <div className='rounded-lg border border-yellow-200 bg-yellow-50 p-3'>
                      <div className='flex items-center space-x-2'>
                        <AlertTriangle className='h-4 w-4 text-yellow-500' />
                        <span className='text-sm font-medium text-yellow-700'>
                          Low Stock Warning
                        </span>
                      </div>
                      <p className='mt-1 text-xs text-yellow-600'>
                        Some ingredients are running low on stock.
                      </p>
                    </div>
                  )}

                {/* Total */}
                <div className='border-t pt-4'>
                  <div className='flex items-center justify-between text-lg font-semibold'>
                    <span>Total:</span>
                    <span>${calculateItemTotal().toFixed(2)}</span>
                  </div>
                </div>

                {/* Add to Order Button */}
                <Button
                  onClick={handleAddToOrder}
                  className='w-full'
                  disabled={isLoading}
                >
                  {isLoading ? 'Adding...' : 'Add to Order'}
                </Button>
              </div>
            ) : (
              <div className='flex h-full items-center justify-center'>
                <p className='text-gray-500'>Select an item to view details</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MenuSelector;
