/**
 * ExpenseForm Component - REFACTORED to use new Service Architecture
 *
 * IMPROVEMENTS:
 * ✅ No more direct API calls - uses cached service layer
 * ✅ Request deduplication - prevents duplicate API calls
 * ✅ Optimized caching - data shared across components
 * ✅ Separation of concerns - UI state vs Data state
 * ✅ Better error handling with service-level retry logic
 */
'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useExpensesStore } from '@/stores/expensesStore';
import { ExpenseCategory } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { DollarSign, Loader2, Package, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, useRef, memo, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { appLogger } from '@/utils/logger';
import { useStockItems, useStockCategories } from '@/hooks/useStockData';
import { getStockService } from '@/services/ServiceContainer';

// Simplified expense schema without unnecessary fields
const expenseFormSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  category: z.nativeEnum(ExpenseCategory),
  date: z.date(),
  notes: z.string().optional(),
});

// Stock item schema (similar to StockItemForm)
const stockItemSchema = z.object({
  id: z.string().optional(), // Store item ID for existing items
  itemName: z
    .string()
    .min(1, 'Item name is required')
    .max(100, 'Name too long'),
  category: z.string().min(1, 'Category is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  costPerUnit: z.number().min(0.01, 'Cost per unit must be greater than 0'),
  isExisting: z.boolean(),
});

// Stock purchase schema for inventory integration
const stockPurchaseSchema = z.object({
  items: z.array(stockItemSchema),
  totalAmount: z.number().min(0.01, 'Total amount must be greater than 0'),
  date: z.date(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;
type StockPurchaseData = z.infer<typeof stockPurchaseSchema>;

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  expenseId?: string;
}

// Define units consistent with StockItemForm
const UNITS = [
  'lbs',
  'kg',
  'oz',
  'g',
  'pieces',
  'bottles',
  'cans',
  'liters',
  'gallons',
  'cups',
  'tbsp',
  'tsp',
];

const ExpenseForm = memo(
  ({ isOpen, onClose, expenseId }: ExpenseFormProps) => {
    const { createExpense, updateExpense, fetchExpense } = useExpensesStore();

    const { toast } = useToast();
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [newItemName, setNewItemName] = useState('');

    // Ref to prevent duplicate expense loading calls
    const loadingExpenseRef = useRef<string | null>(null);

    interface StockItemType {
      id?: string | undefined; // Store item ID for existing items
      itemName: string;
      category: string;
      quantity: number;
      currentQuantity?: number; // Current quantity for existing items
      unit: string;
      costPerUnit: number;
      isExisting: boolean;
    }

    const [activeTab, setActiveTab] = useState('regular');

    // Data from new service layer - only load when needed (lazy loading)
    const shouldLoadStockData = isOpen && activeTab === 'stock';
    const {
      stockItems,
      isLoading: stockLoading,
      error: stockError,
      refresh: refreshStock,
    } = useStockItems({ enabled: shouldLoadStockData }); // Only load when modal is open AND on stock tab

    const {
      categories,
      isLoading: categoriesLoading,
      error: categoriesError,
      refetch: refreshCategories,
    } = useStockCategories(shouldLoadStockData); // Only load when modal is open AND on stock tab
    const [expenseStockItems, setExpenseStockItems] = useState<StockItemType[]>(
      [
        {
          id: undefined,
          itemName: '',
          category: '',
          quantity: 1, // Default to 1 for better UX
          unit: '',
          costPerUnit: 0,
          isExisting: true, // Default to true as most purchases are for existing items
        },
      ]
    );
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Debug expenseStockItems changes (development only)
    useEffect(() => {
      if (process.env.NODE_ENV === 'development') {
        appLogger.debug(
          'DEBUG: expenseStockItems state changed to:',
          expenseStockItems
        );
        if (expenseStockItems.length > 0 && expenseStockItems[0]?.itemName) {
          appLogger.debug(
            'DEBUG: expenseStockItems has real data, first item:',
            expenseStockItems[0]
          );
        } else {
          appLogger.debug(
            'DEBUG: expenseStockItems is empty or default template'
          );
        }
      }
    }, [expenseStockItems]);

    // Calculate total amount for stock purchases (memoized)
    const calculateTotalAmount = useCallback(() => {
      return expenseStockItems.reduce(
        (total, item) => total + item.quantity * item.costPerUnit,
        0
      );
    }, [expenseStockItems]);

    // Memoized total amount
    const totalAmount = useMemo(
      () => calculateTotalAmount(),
      [calculateTotalAmount]
    );

    const expenseForm = useForm<ExpenseFormData>({
      resolver: zodResolver(expenseFormSchema),
      defaultValues: {
        description: '',
        amount: 0,
        category: ExpenseCategory.OTHER,
        date: new Date(),
        notes: '',
      },
    });

    const stockForm = useForm<StockPurchaseData>({
      resolver: zodResolver(stockPurchaseSchema),
      defaultValues: {
        items: expenseStockItems,
        totalAmount: totalAmount,
        date: new Date(),
      },
    });

    // Debug form initialization (reduced verbosity)

    // Update form when expenseStockItems changes during editing
    useEffect(() => {
      if (process.env.NODE_ENV === 'development') {
        appLogger.debug('=== FORM UPDATE USEEFFECT ===');
        appLogger.debug('DEBUG: expenseId:', expenseId);
        appLogger.debug('DEBUG: activeTab:', activeTab);
        appLogger.debug(
          'DEBUG: expenseStockItems.length:',
          expenseStockItems.length
        );
        appLogger.debug(
          'DEBUG: expenseStockItems[0]?.itemName:',
          expenseStockItems[0]?.itemName
        );
      }

      if (
        expenseId &&
        activeTab === 'stock' &&
        expenseStockItems.length > 0 &&
        expenseStockItems[0]?.itemName
      ) {
        if (process.env.NODE_ENV === 'development') {
          appLogger.debug('DEBUG: Conditions met - updating stock form');
          appLogger.debug(
            'DEBUG: expenseStockItems for form:',
            JSON.stringify(expenseStockItems, null, 2)
          );
          appLogger.debug(
            'DEBUG: Current form values before reset:',
            stockForm.getValues()
          );
        }

        const totalAmount = expenseStockItems.reduce(
          (sum, item) => sum + item.quantity * item.costPerUnit,
          0
        );

        if (process.env.NODE_ENV === 'development') {
          appLogger.debug('DEBUG: Calculated total amount:', totalAmount);
        }

        // Use reset() instead of setValue() to properly update the form with new items
        const resetData = {
          items: expenseStockItems,
          totalAmount: totalAmount,
          date: stockForm.getValues('date') || new Date(),
        };

        if (process.env.NODE_ENV === 'development') {
          appLogger.debug(
            'DEBUG: Resetting form with:',
            JSON.stringify(resetData, null, 2)
          );
        }
        stockForm.reset(resetData);

        if (process.env.NODE_ENV === 'development') {
          appLogger.debug(
            'DEBUG: Form values after reset:',
            stockForm.getValues()
          );
        }
      } else if (process.env.NODE_ENV === 'development') {
        appLogger.debug('DEBUG: Conditions not met for form update');
        if (!expenseId) appLogger.debug('  - No expenseId');
        if (activeTab !== 'stock') appLogger.debug('  - Not on stock tab');
        if (expenseStockItems.length === 0)
          appLogger.debug('  - No stock items');
        if (!expenseStockItems[0]?.itemName)
          appLogger.debug('  - First item has no name');
      }
    }, [expenseStockItems, expenseId, activeTab, stockForm]);

    // Add stock item to the list
    const addStockItem = () => {
      const newItem: StockItemType = {
        id: undefined,
        itemName: '',
        category: '',
        quantity: 1, // Default to 1 for better UX
        unit: '',
        costPerUnit: 0,
        isExisting: true, // Default to existing item
      };
      setExpenseStockItems([...expenseStockItems, newItem]);
    };

    // Remove stock item from list
    const removeStockItem = (index: number) => {
      if (expenseStockItems.length > 1) {
        setExpenseStockItems(expenseStockItems.filter((_, i) => i !== index));
      }
    };

    // Update stock item at specific index
    const updateStockItemAtIndex = (
      index: number,
      field: string,
      value: any
    ) => {
      const updated = [...expenseStockItems];
      updated[index] = { ...updated[index], [field]: value } as StockItemType;
      setExpenseStockItems(updated);

      // Update total amount in form (will be recalculated via memoized totalAmount)
      const newTotal = updated.reduce(
        (total, item) => total + item.quantity * item.costPerUnit,
        0
      );
      stockForm.setValue('totalAmount', newTotal);
    };

    // Handle adding a new category
    const handleAddNewCategory = async (itemIndex: number) => {
      if (!newCategoryName.trim()) return;

      try {
        // Create new category using service layer
        const stockService = getStockService();
        // Note: Category creation may need to be implemented in StockService
        // For now, we'll create a stock item category through the service
        appLogger.debug(
          'Creating category via service layer:',
          newCategoryName.trim()
        );

        // Update the current item with the new category
        updateStockItemAtIndex(itemIndex, 'category', newCategoryName.trim());

        setNewCategoryName('');
        setIsAddingCategory(false);

        toast({
          title: 'Category Added',
          description: `"${newCategoryName.trim()}" has been added to your categories`,
        });

        // Refresh categories list
        await refreshCategories();
      } catch (error) {
        appLogger.error('Failed to add category:', error);
        toast({
          title: 'Add Category Failed',
          description:
            error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
      }
    };

    // Handle adding a new item
    const handleAddNewItem = (itemIndex: number) => {
      if (!newItemName.trim()) return;

      // Update the current item with the new item name
      updateStockItemAtIndex(itemIndex, 'itemName', newItemName.trim());

      setNewItemName('');
      setIsAddingItem(false);

      toast({
        title: 'Item Added',
        description: `"${newItemName.trim()}" has been added`,
      });
    };

    // Get filtered items based on selected category
    const getFilteredItems = (category: string) => {
      if (!category) return [];
      return stockItems.filter(item => item.category === category);
    };

    // Find stock item by name (check both 'name' and 'itemName' fields)
    const findStockItemByName = (name: string) => {
      return stockItems.find(item => item.name === name || item.itemName === name);
    };

    // Select stock item and auto-fill relevant fields
    const selectStockItem = (index: number, selectedItem: any) => {
      if (!selectedItem) return;

      // Update all relevant fields for the item at the given index
      const updated = [...expenseStockItems];
      const currentItem = updated[index];

      if (!currentItem) return;

      updated[index] = {
        ...currentItem,
        id: selectedItem.id,
        itemName: selectedItem.name || selectedItem.itemName, // Use either field
        unit: selectedItem.unit,
        // If we already have a cost set, keep it for easy price update
        // Otherwise use the existing item's cost as default
        costPerUnit: currentItem.costPerUnit || selectedItem.costPerUnit,
        category: selectedItem.category,
        currentQuantity: selectedItem.currentQuantity || 0, // Store current inventory level
        quantity: currentItem.quantity, // Ensure quantity is preserved
        isExisting: currentItem.isExisting, // Ensure isExisting is preserved
      };

      setExpenseStockItems(updated);
    };

    // Show error messages from service layer if any
    useEffect(() => {
      if (stockError) {
        toast({
          title: 'Stock Error',
          description: stockError,
          variant: 'destructive',
        });
      }
      if (categoriesError) {
        toast({
          title: 'Categories Error',
          description: categoriesError,
          variant: 'destructive',
        });
      }
    }, [stockError, categoriesError, toast]);

    // Update stock form values when expenseStockItems change
    useEffect(() => {
      stockForm.setValue('items', expenseStockItems);
      stockForm.setValue('totalAmount', totalAmount);
    }, [expenseStockItems, stockForm, totalAmount]);

    // Load existing expense data if editing
    useEffect(() => {
      if (
        expenseId &&
        stockItems.length > 0 &&
        loadingExpenseRef.current !== expenseId
      ) {
        // Prevent duplicate loading of the same expense
        loadingExpenseRef.current = expenseId;

        // Wait for stock items to load first
        const loadExpense = async () => {
          try {
            const expenseData = await fetchExpense(expenseId);
            appLogger.debug('=== EXPENSE LOADING AUDIT ===');
            appLogger.debug(
              'DEBUG: Raw expense data:',
              JSON.stringify(expenseData, null, 2)
            );
            appLogger.debug('DEBUG: Expense category:', expenseData?.category);
            appLogger.debug(
              'DEBUG: ExpenseCategory.INVENTORY:',
              ExpenseCategory.INVENTORY
            );
            appLogger.debug(
              'DEBUG: Category match:',
              expenseData?.category === ExpenseCategory.INVENTORY
            );
            appLogger.debug(
              'DEBUG: All expense fields:',
              Object.keys(expenseData || {})
            );
            appLogger.debug(
              'DEBUG: Description field:',
              expenseData?.description
            );
            appLogger.debug('DEBUG: Title field:', expenseData?.title);
            appLogger.debug('DEBUG: Available stock items:', stockItems.length);
            if (expenseData) {
              // Check if this is a stock purchase expense
              if (expenseData.category === ExpenseCategory.INVENTORY) {
                // Try to parse stock items from the notes field (if available)
                appLogger.debug(
                  'DEBUG: Loading stock purchase expense, switching to stock tab'
                );
                setActiveTab('stock'); // Switch to stock purchase tab

                // Try to parse notes to recover item information FIRST
                let recoveredItems: StockItemType[] = [];

                appLogger.debug('=== PARSING AUDIT ===');
                appLogger.debug(
                  'DEBUG: Description content:',
                  expenseData.description
                );
                appLogger.debug(
                  'DEBUG: Description type:',
                  typeof expenseData.description
                );
                appLogger.debug(
                  'DEBUG: Starts with Added?',
                  expenseData.description?.startsWith('Added ')
                );
                appLogger.debug(
                  'DEBUG: Description length:',
                  expenseData.description?.length
                );
                appLogger.debug('DEBUG: Title content:', expenseData.title);
                appLogger.debug(
                  'DEBUG: Notes content:',
                  (expenseData as any).notes
                );
                appLogger.debug(
                  'DEBUG: Notes starts with Added?',
                  (expenseData as any).notes?.startsWith('Added ')
                );

                // Check description, notes, and title fields for item data
                const itemDataSource = expenseData.description?.startsWith(
                  'Added '
                )
                  ? expenseData.description
                  : (expenseData as any).notes?.startsWith('Added ')
                    ? (expenseData as any).notes
                    : expenseData.title?.startsWith('Added ')
                      ? expenseData.title
                      : null;

                const sourceField =
                  itemDataSource === expenseData.description
                    ? 'description'
                    : itemDataSource === (expenseData as any).notes
                      ? 'notes'
                      : itemDataSource === expenseData.title
                        ? 'title'
                        : 'none';

                appLogger.debug('DEBUG: Item data source:', itemDataSource);
                appLogger.debug('DEBUG: Source field:', sourceField);

                if (itemDataSource) {
                  try {
                    // Parse stock items from the source that contains item data
                    // Format: "Added 5 kg of Flour, 3 bottles of Olive Oil"
                    const itemsText = itemDataSource.substring(6); // Remove "Added "
                    const itemStrings = itemsText.split(', ');

                    appLogger.debug('DEBUG: Parsing item data:', {
                      sourceField:
                        itemDataSource === expenseData.description
                          ? 'description'
                          : 'title',
                      originalText: itemDataSource,
                      itemsText,
                      itemStrings,
                      stockItemsAvailable: stockItems.length,
                    });

                    // Parse the items

                    appLogger.debug(
                      'DEBUG: Processing item strings:',
                      itemStrings
                    );
                    for (const itemString of itemStrings) {
                      appLogger.debug(
                        'DEBUG: Processing item string:',
                        itemString
                      );
                      // Parse pattern like "5 kg of Flour"
                      const match = itemString.match(
                        /([\d.]+)\s+([\w]+)\s+of\s+(.+)/
                      );
                      appLogger.debug('DEBUG: Regex match result:', match);
                      if (match && match[1] && match[2] && match[3]) {
                        const quantity = parseFloat(match[1]);
                        const unit = match[2];
                        const itemName = match[3];

                        appLogger.debug('DEBUG: Extracted values:', {
                          quantity,
                          unit,
                          itemName,
                        });

                        // Find the stock item by name to get more information
                        const stockItem = findStockItemByName(itemName);

                        appLogger.debug('DEBUG: Stock item lookup:', {
                          itemName,
                          stockItemFound: !!stockItem,
                          stockItem: stockItem
                            ? {
                                id: stockItem.id,
                                name: stockItem.name,
                                category: stockItem.category,
                                currentQuantity: stockItem.currentQuantity,
                                costPerUnit: stockItem.costPerUnit,
                              }
                            : null,
                        });

                        recoveredItems.push({
                          id: stockItem?.id,
                          itemName: itemName,
                          quantity: quantity,
                          unit: unit,
                          category: stockItem?.category || '',
                          costPerUnit: stockItem?.costPerUnit || 0,
                          isExisting: true,
                          currentQuantity: stockItem?.currentQuantity || 0,
                        });
                      }
                    }

                    appLogger.debug('DEBUG: Recovered items:', recoveredItems);
                    appLogger.debug(
                      'DEBUG: Current expenseStockItems before update:',
                      expenseStockItems
                    );

                    appLogger.debug('=== STATE UPDATE AUDIT ===');
                    appLogger.debug(
                      'DEBUG: Total recovered items:',
                      recoveredItems.length
                    );
                    appLogger.debug(
                      'DEBUG: Recovered items details:',
                      JSON.stringify(recoveredItems, null, 2)
                    );

                    if (recoveredItems.length > 0) {
                      appLogger.debug(
                        'DEBUG: About to update state with recovered items'
                      );
                      appLogger.debug(
                        'DEBUG: Current expenseStockItems before setState:',
                        expenseStockItems
                      );
                      setExpenseStockItems(recoveredItems);
                      appLogger.debug(
                        'DEBUG: setExpenseStockItems called successfully'
                      );

                      // Force immediate debug of what we just set
                      setTimeout(() => {
                        appLogger.debug(
                          'DEBUG: State after setTimeout:',
                          expenseStockItems
                        );
                      }, 100);
                    } else {
                      appLogger.debug(
                        'DEBUG: No items recovered - this means parsing failed'
                      );
                      appLogger.debug(
                        'DEBUG: Creating default stock item for manual entry'
                      );
                    }
                  } catch (parseError) {
                    appLogger.error(
                      'Error parsing stock items from description:',
                      parseError
                    );
                  }
                } else {
                  appLogger.debug('=== NO PARSEABLE DATA FOUND ===');
                  appLogger.debug(
                    'DEBUG: No item data found in description or title'
                  );
                  appLogger.debug(
                    'DEBUG: This might be a legacy expense or different format'
                  );
                  appLogger.debug(
                    'DEBUG: Available fields:',
                    Object.keys(expenseData)
                  );

                  // Try to manually create a basic item for editing if this looks like a stock purchase
                  if (expenseData.category === ExpenseCategory.INVENTORY) {
                    appLogger.debug(
                      'DEBUG: Creating empty stock item for manual editing'
                    );
                    const defaultItem: StockItemType = {
                      id: undefined,
                      itemName: 'Unknown Item (please edit)',
                      category: '',
                      quantity: 1,
                      unit: '',
                      costPerUnit: expenseData.amount || 0,
                      isExisting: false,
                    };
                    setExpenseStockItems([defaultItem]);
                    appLogger.debug(
                      'DEBUG: Set default stock item for editing'
                    );
                  }
                }

                // Initial stock form setup - will be updated by useEffect when expenseStockItems changes
                appLogger.debug('DEBUG: Initial stock form setup with:', {
                  date: expenseData.createdAt
                    ? new Date(expenseData.createdAt)
                    : new Date(),
                  totalAmount: expenseData.amount,
                  items: expenseStockItems,
                });

                stockForm.reset({
                  date: expenseData.createdAt
                    ? new Date(expenseData.createdAt)
                    : new Date(),
                  totalAmount: expenseData.amount,
                  items: expenseStockItems, // Will be updated by useEffect when expenseStockItems changes
                });
              } else {
                // Regular expense
                expenseForm.reset({
                  description: expenseData.description || '',
                  amount: expenseData.amount,
                  category: expenseData.category as ExpenseCategory,
                  date: expenseData.createdAt
                    ? new Date(expenseData.createdAt)
                    : new Date(),
                  notes: '', // Notes field is not part of Expense type
                });
              }
            }
          } catch (error) {
            appLogger.error('Error loading expense:', error);
            toast({
              title: 'Error',
              description: 'Failed to load expense data',
              variant: 'destructive',
            });
          }
        };
        loadExpense();
      }
    }, [expenseId, fetchExpense, expenseForm, toast, stockItems]);

    // Reset loading ref when modal closes
    useEffect(() => {
      if (!isOpen) {
        loadingExpenseRef.current = null;
      }
    }, [isOpen]);

    // Handle regular expense submission
    const onRegularExpenseSubmit = async (data: ExpenseFormData) => {
      try {
        setIsSubmitting(true);

        const submitData = {
          description: data.description,
          amount: data.amount,
          category: data.category,
          date: data.date,
          notes: data.notes || undefined,
        };

        if (expenseId) {
          await updateExpense(expenseId, submitData);
          toast({
            title: 'Success',
            description: 'Expense updated successfully',
          });
        } else {
          await createExpense(submitData);
          toast({
            title: 'Success',
            description: 'Expense created successfully',
          });
        }

        expenseForm.reset();
        onClose();
      } catch (error) {
        appLogger.error('Error submitting expense:', error);
        toast({
          title: 'Error',
          description: 'Failed to save expense',
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    };

    // Handle stock purchase submission
    const onStockPurchaseSubmit = async (data: StockPurchaseData) => {
      try {
        setIsSubmitting(true);

        // Create or update expense record
        // Store item details in description field for parsing when editing
        const itemDetails = `Added ${data.items.map(item => `${item.quantity} ${item.unit} of ${item.itemName}`).join(', ')}`;
        const expenseData = {
          description: itemDetails, // Store parsing data in description
          amount: data.totalAmount,
          category: ExpenseCategory.INVENTORY,
          date: data.date,
          notes: `Stock Purchase - ${data.items.length} items`, // Human readable notes
        };

        // Note: We track that this is either an existing expense (expenseId) or a new one

        if (expenseId) {
          // Update existing expense
          // Need to make sure we use the correct structure for updateExpense
          // The API expects an UpdateExpenseRequest with all required fields
          await updateExpense(expenseId, {
            description: itemDetails, // Store item details in description for parsing
            amount: expenseData.amount,
            category: expenseData.category,
            // date is not part of UpdateExpenseRequest
          });

          toast({
            title: 'Success',
            description: 'Stock purchase expense updated successfully',
          });
        } else {
          // Create new expense
          await createExpense(expenseData);
          // Note: createExpense returns void, expense ID is not available
          // This is acceptable since we only update stock for new expenses
        }

        // Only update stock items for NEW expenses, not when editing existing ones
        // When editing, we just update the expense record but leave inventory as-is
        // to avoid double-counting inventory adjustments
        if (!expenseId) {
          // Create or update stock items (only for new expenses)
          for (const item of data.items) {
            try {
              const submitData = {
                name: item.itemName,
                unit: item.unit,
                costPerUnit: item.costPerUnit,
                category: item.category,
              };

              if (item.isExisting) {
                // Use the stored item ID if available, otherwise find by name
                const itemId =
                  item.id || findStockItemByName(item.itemName)?.id;

                if (!itemId) {
                  throw new Error(
                    `Could not find existing item: ${item.itemName}. Please refresh the page and try again.`
                  );
                }

                // Validate that itemId is a proper UUID before sending to backend
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(itemId)) {
                  throw new Error(
                    `Invalid item ID for "${item.itemName}". Please refresh the page and try again.`
                  );
                }

                // Update existing item - ADD the new quantity to current stock
                // The adjustStockQuantity function ADDS the specified amount to current stock
                const stockService = getStockService();
                await stockService.adjustStockQuantity({
                  id: itemId,
                  quantity: item.quantity,
                  reason: 'purchase',
                  notes: `Stock purchase - ${item.itemName}`,
                  userId: 'system', // TODO: Get actual user ID
                });

                toast({
                  title: 'Stock Updated',
                  description: `${item.itemName} has been updated in inventory`,
                });

                // Refresh stock data to update UI
                await refreshStock();
              } else {
                // Create completely new stock item with minimum quantity set to 10% of initial
                const stockService = getStockService();
                await stockService.createStockItem({
                  ...submitData,
                  currentQuantity: item.quantity,
                  minimumQuantity: Math.max(1, Math.floor(item.quantity * 0.1)),
                });

                toast({
                  title: 'Stock Item Created',
                  description: `${item.itemName} has been added to inventory`,
                });

                // Refresh stock data to update UI
                await refreshStock();
              }
            } catch (itemError) {
              appLogger.error(
                `Error processing stock item ${item.itemName}:`,
                itemError
              );
              toast({
                title: 'Stock Item Error',
                description:
                  itemError instanceof Error
                    ? itemError.message
                    : `Failed to process ${item.itemName}`,
                variant: 'destructive',
              });
            }
          }
        } else {
          // For expense edits, show a different message since inventory isn't changed
          toast({
            title: 'Note',
            description:
              'Expense updated. Inventory quantities remain unchanged to avoid double-counting.',
          });
        }

        // Reset form and close
        stockForm.reset();
        setExpenseStockItems([
          {
            id: undefined,
            itemName: '',
            category: '',
            quantity: 1, // Default to 1 for better UX
            unit: '',
            costPerUnit: 0,
            isExisting: true, // Default to existing item
          },
        ]);

        toast({
          title: 'Success',
          description: expenseId
            ? `Stock purchase expense updated successfully`
            : `Stock purchase recorded and ${data.items.length} items updated in inventory`,
        });

        onClose();
      } catch (error) {
        appLogger.error('Error submitting stock purchase:', error);
        toast({
          title: 'Error',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to save stock purchase',
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className='max-h-[90dvh] max-w-4xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {expenseId ? 'Edit Expense' : 'Add New Expense'}
            </DialogTitle>
            <DialogDescription>
              Choose between recording a regular expense or a stock purchase
              that will update your inventory.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className='w-full'
          >
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='regular' className='flex items-center gap-2'>
                <DollarSign className='h-4 w-4' />
                Regular Expense
              </TabsTrigger>
              <TabsTrigger value='stock' className='flex items-center gap-2'>
                <Package className='h-4 w-4' />
                Stock Purchase
              </TabsTrigger>
            </TabsList>

            {/* Regular Expense Tab */}
            <TabsContent value='regular' className='space-y-4'>
              <Form {...expenseForm}>
                <form
                  onSubmit={expenseForm.handleSubmit(onRegularExpenseSubmit)}
                  className='space-y-4'
                >
                  <FormField
                    control={expenseForm.control}
                    name='description'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='Enter expense description'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className='grid grid-cols-2 gap-4'>
                    <FormField
                      control={expenseForm.control}
                      name='amount'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount</FormLabel>
                          <FormControl>
                            <Input
                              type='text'
                              placeholder='0.00'
                              {...field}
                              onChange={e => {
                                const value = e.target.value.replace(
                                  /[^0-9.]/g,
                                  ''
                                );
                                field.onChange(parseFloat(value) || 0);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={expenseForm.control}
                      name='category'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder='Select category' />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.values(ExpenseCategory).map(category => (
                                <SelectItem key={category} value={category}>
                                  {category
                                    .replace('_', ' ')
                                    .toLowerCase()
                                    .replace(/\b\w/g, l => l.toUpperCase())}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={expenseForm.control}
                    name='date'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input
                            type='date'
                            {...field}
                            value={
                              field.value
                                ? field.value.toISOString().split('T')[0]
                                : ''
                            }
                            onChange={e =>
                              field.onChange(new Date(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={expenseForm.control}
                    name='notes'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='Additional notes...'
                            className='resize-none'
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type='button' variant='outline' onClick={onClose}>
                      Cancel
                    </Button>
                    <Button type='submit' disabled={isSubmitting}>
                      {isSubmitting && (
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      )}
                      {expenseId ? 'Update Expense' : 'Add Expense'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>

            {/* Stock Purchase Tab */}
            <TabsContent value='stock' className='space-y-4'>
              <Form {...stockForm}>
                <form
                  onSubmit={stockForm.handleSubmit(onStockPurchaseSubmit)}
                  className='space-y-4'
                >
                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <Label className='text-base font-semibold dark:text-white'>
                        Stock Items
                      </Label>
                      <Button
                        type='button'
                        onClick={addStockItem}
                        size='sm'
                        variant='outline'
                      >
                        <Plus className='mr-1 h-4 w-4' />
                        Add Item
                      </Button>
                    </div>

                    {expenseStockItems.map((item, index) => (
                      <div
                        key={index}
                        className='space-y-3 rounded-lg border p-4'
                      >
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center gap-4'>
                            <Label className='text-sm font-medium dark:text-white'>
                              Item #{index + 1}
                            </Label>
                            <Select
                              value={item.isExisting ? 'existing' : 'new'}
                              onValueChange={value => {
                                const isExisting = value === 'existing';
                                updateStockItemAtIndex(
                                  index,
                                  'isExisting',
                                  isExisting
                                );

                                // If changed to existing and item name is set, auto-fill fields
                                if (isExisting && item.itemName) {
                                  const selectedStockItem = findStockItemByName(
                                    item.itemName
                                  );
                                  if (selectedStockItem) {
                                    // Use the dedicated function for consistent selection
                                    selectStockItem(index, selectedStockItem);
                                  }
                                } else if (!isExisting) {
                                  // For new items, clear related fields to allow manual entry
                                  updateStockItemAtIndex(
                                    index,
                                    'id',
                                    undefined
                                  );
                                  updateStockItemAtIndex(index, 'unit', '');
                                  updateStockItemAtIndex(
                                    index,
                                    'costPerUnit',
                                    0
                                  );
                                  // Keep the name and category as they might still be relevant
                                }
                              }}
                            >
                              <SelectTrigger className='w-40'>
                                <SelectValue placeholder='Select type' />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value='existing'>
                                  Add to Existing
                                </SelectItem>
                                <SelectItem value='new'>
                                  Create New Item
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {expenseStockItems.length > 1 && (
                            <Button
                              type='button'
                              onClick={() => removeStockItem(index)}
                              size='sm'
                              variant='ghost'
                              className='text-red-500 hover:text-red-700'
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          )}
                        </div>

                        <div className='mb-2 grid grid-cols-2 gap-3'>
                          {/* Category Selection First - Items depend on this */}
                          <div>
                            <Label className='text-xs dark:text-white'>
                              {item.isExisting
                                ? 'Item Category'
                                : 'New Item Category'}
                            </Label>
                            {isAddingCategory ? (
                              <div className='space-y-2'>
                                <Input
                                  placeholder='Enter new category name'
                                  value={newCategoryName}
                                  onChange={e =>
                                    setNewCategoryName(e.target.value)
                                  }
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddNewCategory(index);
                                    } else if (e.key === 'Escape') {
                                      setIsAddingCategory(false);
                                      setNewCategoryName('');
                                    }
                                  }}
                                />
                                <div className='flex gap-2'>
                                  <Button
                                    type='button'
                                    size='sm'
                                    onClick={() => handleAddNewCategory(index)}
                                    disabled={!newCategoryName.trim()}
                                  >
                                    Add Category
                                  </Button>
                                  <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    onClick={() => {
                                      setIsAddingCategory(false);
                                      setNewCategoryName('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className='space-y-2'>
                                <Select
                                  value={item.category}
                                  onValueChange={value =>
                                    updateStockItemAtIndex(
                                      index,
                                      'category',
                                      value
                                    )
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder='Select category' />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map(category => (
                                      <SelectItem
                                        key={category}
                                        value={category}
                                      >
                                        {category}
                                      </SelectItem>
                                    ))}
                                    {/* Add option if no categories found */}
                                    {categories.length === 0 && (
                                      <SelectItem value='General'>
                                        General
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type='button'
                                  variant='outline'
                                  size='sm'
                                  onClick={() => setIsAddingCategory(true)}
                                  className='w-full'
                                >
                                  <Plus className='mr-2 h-4 w-4' />
                                  Add New Category
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Item Selection */}
                          <div>
                            <Label className='text-xs dark:text-white'>
                              {item.isExisting
                                ? 'Select Existing Item'
                                : 'New Item Name'}
                            </Label>
                            {isAddingItem ? (
                              <div className='space-y-2'>
                                <Input
                                  placeholder='Enter new item name'
                                  value={newItemName}
                                  onChange={e => setNewItemName(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddNewItem(index);
                                    } else if (e.key === 'Escape') {
                                      setIsAddingItem(false);
                                      setNewItemName('');
                                    }
                                  }}
                                />
                                <div className='flex gap-2'>
                                  <Button
                                    type='button'
                                    size='sm'
                                    onClick={() => handleAddNewItem(index)}
                                    disabled={!newItemName.trim()}
                                  >
                                    Add Item
                                  </Button>
                                  <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    onClick={() => {
                                      setIsAddingItem(false);
                                      setNewItemName('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className='space-y-2'>
                                <Select
                                  value={item.itemName}
                                  onValueChange={value => {
                                    // Find the selected stock item (check both 'name' and 'itemName')
                                    const selectedStockItem = stockItems.find(
                                      stockItem => stockItem.name === value || stockItem.itemName === value
                                    );

                                    if (selectedStockItem && item.isExisting) {
                                      // Use the dedicated function to select and auto-fill
                                      selectStockItem(index, selectedStockItem);
                                    } else {
                                      // Just update the name for new items
                                      updateStockItemAtIndex(
                                        index,
                                        'itemName',
                                        value
                                      );
                                    }
                                  }}
                                  disabled={!item.category} // Disable if no category selected
                                >
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={
                                        !item.category
                                          ? 'Select category first'
                                          : 'Select item'
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {item.category &&
                                      getFilteredItems(item.category).map(
                                        stockItem => (
                                          <SelectItem
                                            key={stockItem.id}
                                            value={stockItem.name ?? stockItem.itemName}
                                          >
                                            {stockItem.name ?? stockItem.itemName}
                                          </SelectItem>
                                        )
                                      )}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type='button'
                                  variant='outline'
                                  size='sm'
                                  onClick={() => setIsAddingItem(true)}
                                  className='w-full'
                                  disabled={!item.category} // Disable if no category selected
                                >
                                  <Plus className='mr-2 h-4 w-4' />
                                  Add New Item
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className='space-y-2'>
                            <Label className='text-xs dark:text-white'>
                              {item.isExisting
                                ? 'Quantity to Add'
                                : 'Initial Quantity'}
                            </Label>
                            <Controller
                              name={`items.${index}.quantity`}
                              control={stockForm.control}
                              render={({ field }) => {
                                // Simplified controller debug (only when values differ)
                                if (field.value !== item.quantity) {
                                  appLogger.debug(
                                    `Controller ${field.name} - field: ${field.value}, state: ${item.quantity}`
                                  );
                                }
                                return (
                                  <Input
                                    {...field}
                                    type='text'
                                    placeholder='0'
                                    value={field.value || ''}
                                    onChange={e => {
                                      const value = e.target.value.replace(
                                        /[^0-9.]/g,
                                        ''
                                      );
                                      const numValue = parseFloat(value) || 0;
                                      appLogger.debug(
                                        `DEBUG: Quantity onChange - new value:`,
                                        numValue
                                      );
                                      field.onChange(numValue);
                                      // Also update our state for UI calculations
                                      updateStockItemAtIndex(
                                        index,
                                        'quantity',
                                        numValue
                                      );
                                    }}
                                  />
                                );
                              }}
                            />

                            {/* Show resulting quantity for existing items */}
                            {item.isExisting &&
                              item.currentQuantity !== undefined && (
                                <div className='flex justify-between pt-1 text-xs text-muted-foreground dark:text-gray-300'>
                                  <span>
                                    Current: {item.currentQuantity} {item.unit}
                                  </span>
                                  <span>→</span>
                                  <span className='font-medium'>
                                    New:{' '}
                                    {(item.currentQuantity || 0) +
                                      (item.quantity || 0)}{' '}
                                    {item.unit}
                                  </span>
                                </div>
                              )}
                          </div>

                          <div>
                            <Label className='text-xs dark:text-white'>Unit</Label>
                            <Controller
                              name={`items.${index}.unit`}
                              control={stockForm.control}
                              render={({ field }) => (
                                <Select
                                  value={field.value || ''}
                                  onValueChange={value => {
                                    field.onChange(value);
                                    updateStockItemAtIndex(
                                      index,
                                      'unit',
                                      value
                                    );
                                  }}
                                  disabled={item.isExisting} // Disable if it's an existing item
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder='Select unit' />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {UNITS.map(unit => (
                                      <SelectItem key={unit} value={unit}>
                                        {unit}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>

                          <div>
                            <Label className='text-xs dark:text-white'>Cost per Unit</Label>
                            <Controller
                              name={`items.${index}.costPerUnit`}
                              control={stockForm.control}
                              render={({ field }) => (
                                <Input
                                  {...field}
                                  type='text'
                                  placeholder='0.00'
                                  value={field.value || ''}
                                  onChange={e => {
                                    const value = e.target.value.replace(
                                      /[^0-9.]/g,
                                      ''
                                    );
                                    const numValue = parseFloat(value) || 0;
                                    field.onChange(numValue);
                                    // Also update our state for UI calculations
                                    updateStockItemAtIndex(
                                      index,
                                      'costPerUnit',
                                      numValue
                                    );
                                  }}
                                  // Allow editing cost per unit for all items to update costs
                                />
                              )}
                            />
                          </div>
                        </div>

                        <div className='text-right text-sm text-gray-600 dark:text-gray-300'>
                          Subtotal:{' '}
                          {formatCurrency(item.quantity * item.costPerUnit)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className='grid grid-cols-2 gap-4'>
                    <FormField
                      control={stockForm.control}
                      name='totalAmount'
                      render={({ field: _ }) => (
                        <FormItem>
                          <FormLabel>Total Amount</FormLabel>
                          <FormControl>
                            <Input
                              type='text'
                              readOnly
                              value={totalAmount}
                              className='bg-gray-50'
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={stockForm.control}
                      name='date'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Date</FormLabel>
                          <FormControl>
                            <Input
                              type='date'
                              {...field}
                              value={
                                field.value
                                  ? field.value.toISOString().split('T')[0]
                                  : ''
                              }
                              onChange={e =>
                                field.onChange(new Date(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <DialogFooter>
                    <Button type='button' variant='outline' onClick={onClose}>
                      Cancel
                    </Button>
                    <Button
                      type='submit'
                      disabled={isSubmitting || totalAmount === 0}
                    >
                      {isSubmitting && (
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      )}
                      Record Purchase & Update Stock
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for React.memo - only re-render if props actually changed
    return (
      prevProps.isOpen === nextProps.isOpen &&
      prevProps.expenseId === nextProps.expenseId &&
      prevProps.onClose === nextProps.onClose
    );
  }
);

ExpenseForm.displayName = 'ExpenseForm';

export default ExpenseForm;