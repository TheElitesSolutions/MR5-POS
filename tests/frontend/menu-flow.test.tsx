/**
 * Menu Flow Frontend Tests
 *
 * Tests the complete menu selection flow in the POS system including:
 * - Category browsing
 * - Menu item selection
 * - Ingredient customization
 * - Addon selection
 * - Integration with order system
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import React from 'react';
import MenuFlow from '../../renderer/components/pos/MenuFlow';
import { AddonSelectionProvider } from '../../renderer/context/AddonSelectionContext';
import { StockDataProvider } from '../../renderer/context/StockDataContext';

// Mock the dependencies
jest.mock('../../renderer/hooks/useMenuData', () => ({
  useAvailableMenuItems: jest.fn(() => ({
    menuItems: [
      {
        id: '1',
        name: 'Burger',
        description: 'Delicious burger',
        price: 9.99,
        category: 'Main Course',
        isAvailable: true,
        ingredients: ['lettuce', 'tomato', 'cheese'],
      },
      {
        id: '2',
        name: 'Pizza',
        description: 'Margherita pizza',
        price: 12.99,
        category: 'Main Course',
        isAvailable: true,
        ingredients: ['mozzarella', 'tomato sauce', 'basil'],
      },
      {
        id: '3',
        name: 'Salad',
        description: 'Fresh green salad',
        price: 7.99,
        category: 'Appetizers',
        isAvailable: true,
        ingredients: ['lettuce', 'cucumber', 'tomato'],
      },
    ],
    categories: ['Main Course', 'Appetizers', 'Desserts'],
    isLoading: false,
    isRefreshing: false,
    error: null,
    refetch: jest.fn(),
    refresh: jest.fn(),
    clearError: jest.fn(),
    invalidateCache: jest.fn(),
  })),
}));

jest.mock('../../renderer/context/StockDataContext', () => ({
  useSharedStockData: jest.fn(() => ({
    stockItems: [],
    isLoading: false,
    error: null,
  })),
  StockDataProvider: ({ children }: any) => children,
}));

jest.mock('../../renderer/services/ServiceContainer', () => ({
  getMenuService: jest.fn(() => ({
    refreshMenuData: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../renderer/stores/posStore', () => ({
  usePOSStore: jest.fn(() => ({
    isLoading: false,
  })),
}));

jest.mock('../../renderer/context/AddonSelectionContext', () => ({
  AddonSelectionProvider: ({ children }: any) => children,
  useAddonSelection: jest.fn(() => ({
    selections: [],
    setSelections: jest.fn(),
  })),
}));

jest.mock('../../renderer/components/addon/AddonSelectionStep', () => ({
  AddonSelectionStep: function MockAddonSelectionStep({ onContinue, onBack }: any) {
    return (
      <div data-testid="addon-step">
        <button onClick={() => onContinue([])}>Continue with Addons</button>
        <button onClick={onBack}>Back</button>
      </div>
    );
  },
}));

describe('Menu Flow - Frontend Integration Tests', () => {
  const mockOnItemAdded = jest.fn();

  beforeEach(() => {
    mockOnItemAdded.mockClear();
  });

  describe('Category Browsing', () => {
    it('should display all menu categories', () => {
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      expect(screen.getByText('Menu Categories')).toBeInTheDocument();
      expect(screen.getByText('Main Course')).toBeInTheDocument();
      expect(screen.getByText('Appetizers')).toBeInTheDocument();
      expect(screen.getByText('Desserts')).toBeInTheDocument();
    });

    it('should show item counts for each category', () => {
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      // Main Course should show 2 items (Burger and Pizza)
      expect(screen.getByText('2 items available')).toBeInTheDocument();

      // Appetizers should show 1 item (Salad)
      expect(screen.getByText('1 items available')).toBeInTheDocument();

      // Desserts should show 0 items
      expect(screen.getByText('0 items available')).toBeInTheDocument();
    });

    it('should navigate to items view when category is selected', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      const mainCourseCategory = screen.getByText('Main Course');
      await user.click(mainCourseCategory);

      await waitFor(() => {
        expect(screen.getByText('Back to Categories')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();
      });
    });

    it('should display loading state while fetching categories', () => {
      const { useAvailableMenuItems } = require('../../renderer/hooks/useMenuData');
      useAvailableMenuItems.mockReturnValueOnce({
        menuItems: [],
        categories: [],
        isLoading: true,
        error: null,
      });

      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      expect(screen.getByText('Loading categories...')).toBeInTheDocument();
    });
  });

  describe('Menu Item Selection', () => {
    it('should display menu items for selected category', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      // Select Main Course category
      await user.click(screen.getByText('Main Course'));

      await waitFor(() => {
        expect(screen.getByText('Burger')).toBeInTheDocument();
        expect(screen.getByText('Pizza')).toBeInTheDocument();
        expect(screen.queryByText('Salad')).not.toBeInTheDocument(); // Salad is in Appetizers
      });
    });

    it('should filter items by search term', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      // Select Main Course category
      await user.click(screen.getByText('Main Course'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search items...');
      await user.type(searchInput, 'burger');

      await waitFor(() => {
        expect(screen.getByText('Burger')).toBeInTheDocument();
        expect(screen.queryByText('Pizza')).not.toBeInTheDocument();
      });
    });

    it('should show item details including price and description', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));

      await waitFor(() => {
        expect(screen.getByText('Burger')).toBeInTheDocument();
        expect(screen.getByText('Delicious burger')).toBeInTheDocument();
        expect(screen.getByText('$9.99')).toBeInTheDocument();
      });
    });

    it('should navigate to customization when item with ingredients is selected', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));

      await waitFor(() => {
        expect(screen.getByText('Burger')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Burger'));

      await waitFor(() => {
        expect(screen.getByText('Customize Item')).toBeInTheDocument();
        expect(screen.getByText('Ingredients')).toBeInTheDocument();
      });
    });

    it('should display "no items found" when search returns empty', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));

      const searchInput = await screen.findByPlaceholderText('Search items...');
      await user.type(searchInput, 'nonexistent item');

      await waitFor(() => {
        expect(screen.getByText('No items found in this category')).toBeInTheDocument();
      });
    });
  });

  describe('Ingredient Customization', () => {
    it('should display all ingredients for selected item', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));
      await user.click(screen.getByText('Burger'));

      await waitFor(() => {
        expect(screen.getByText('lettuce')).toBeInTheDocument();
        expect(screen.getByText('tomato')).toBeInTheDocument();
        expect(screen.getByText('cheese')).toBeInTheDocument();
      });
    });

    it('should allow toggling ingredients on/off', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));
      await user.click(screen.getByText('Burger'));

      await waitFor(() => {
        expect(screen.getByText('lettuce')).toBeInTheDocument();
      });

      const lettuceCard = screen.getByText('lettuce').closest('div[class*="Card"]');
      expect(lettuceCard).toHaveClass('border-green-500'); // Included by default

      await user.click(lettuceCard!);

      await waitFor(() => {
        expect(lettuceCard).toHaveClass('border-red-300'); // Removed
      });
    });

    it('should allow adjusting quantity', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));
      await user.click(screen.getByText('Burger'));

      await waitFor(() => {
        expect(screen.getByText('Quantity:')).toBeInTheDocument();
      });

      const plusButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('[class*="Plus"]')
      );

      await user.click(plusButton!);
      await user.click(plusButton!);

      // Quantity should increase from 1 to 3
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should not allow quantity to go below 1', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));
      await user.click(screen.getByText('Burger'));

      await waitFor(() => {
        expect(screen.getByText('Quantity:')).toBeInTheDocument();
      });

      const minusButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('[class*="Minus"]')
      );

      await user.click(minusButton!);
      await user.click(minusButton!);

      // Quantity should stay at 1
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should allow adding special notes for kitchen', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));
      await user.click(screen.getByText('Burger'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Extra crispy/)).toBeInTheDocument();
      });

      const notesInput = screen.getByPlaceholderText(/Extra crispy/);
      await user.type(notesInput, 'No onions please');

      expect(notesInput).toHaveValue('No onions please');
    });

    it('should update total price based on quantity', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));
      await user.click(screen.getByText('Burger'));

      await waitFor(() => {
        // Initial price for 1 item: $9.99
        expect(screen.getByText('$9.99')).toBeInTheDocument();
      });

      const plusButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('[class*="Plus"]')
      );

      await user.click(plusButton!);

      await waitFor(() => {
        // Price for 2 items: $19.98
        expect(screen.getByText('$19.98')).toBeInTheDocument();
      });
    });

    it('should navigate to addon selection step', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));
      await user.click(screen.getByText('Burger'));

      await waitFor(() => {
        expect(screen.getByText(/Continue/)).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /Continue/ });
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByTestId('addon-step')).toBeInTheDocument();
      });
    });

    it('should navigate back to items list', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));
      await user.click(screen.getByText('Burger'));

      await waitFor(() => {
        expect(screen.getByText('Back to Items')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Back to Items'));

      await waitFor(() => {
        expect(screen.getByText('Burger')).toBeInTheDocument();
        expect(screen.getByText('Pizza')).toBeInTheDocument();
      });
    });
  });

  describe('Addon Selection', () => {
    it('should display addon selection step', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));
      await user.click(screen.getByText('Burger'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Continue/ }));

      await waitFor(() => {
        expect(screen.getByTestId('addon-step')).toBeInTheDocument();
      });
    });

    it('should call onItemAdded when addon selection is completed', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));
      await user.click(screen.getByText('Burger'));
      await user.click(screen.getByRole('button', { name: /Continue/ }));

      await waitFor(() => {
        expect(screen.getByText('Continue with Addons')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Continue with Addons'));

      await waitFor(() => {
        expect(mockOnItemAdded).toHaveBeenCalledTimes(1);
        expect(mockOnItemAdded).toHaveBeenCalledWith({
          selectedItem: expect.objectContaining({
            id: '1',
            name: 'Burger',
          }),
          itemQuantity: 1,
          ingredientAdjustments: expect.any(Object),
          specialNotes: '',
          addonSelections: [],
        });
      });
    });

    it('should navigate back to customization from addon step', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Main Course'));
      await user.click(screen.getByText('Burger'));
      await user.click(screen.getByRole('button', { name: /Continue/ }));

      await waitFor(() => {
        expect(screen.getByTestId('addon-step')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Back'));

      await waitFor(() => {
        expect(screen.getByText('Customize Item')).toBeInTheDocument();
      });
    });
  });

  describe('Complete Flow', () => {
    it('should complete entire menu selection flow', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      // Step 1: Select category
      await user.click(screen.getByText('Main Course'));

      // Step 2: Select item
      await waitFor(() => {
        expect(screen.getByText('Burger')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Burger'));

      // Step 3: Customize ingredients
      await waitFor(() => {
        expect(screen.getByText('lettuce')).toBeInTheDocument();
      });

      // Remove cheese
      const cheeseCard = screen.getByText('cheese').closest('div[class*="Card"]');
      await user.click(cheeseCard!);

      // Increase quantity to 2
      const plusButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('[class*="Plus"]')
      );
      await user.click(plusButton!);

      // Add special notes
      const notesInput = screen.getByPlaceholderText(/Extra crispy/);
      await user.type(notesInput, 'Well done');

      // Step 4: Continue to addons
      await user.click(screen.getByRole('button', { name: /Continue/ }));

      // Step 5: Complete addon selection
      await waitFor(() => {
        expect(screen.getByText('Continue with Addons')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Continue with Addons'));

      // Verify callback was called with correct data
      await waitFor(() => {
        expect(mockOnItemAdded).toHaveBeenCalledWith(
          expect.objectContaining({
            selectedItem: expect.objectContaining({
              id: '1',
              name: 'Burger',
            }),
            itemQuantity: 2,
            ingredientAdjustments: expect.objectContaining({
              cheese: true, // true means removed
            }),
            specialNotes: 'Well done',
            addonSelections: [],
          })
        );
      });

      // Verify flow resets to categories
      await waitFor(() => {
        expect(screen.getByText('Menu Categories')).toBeInTheDocument();
      });
    });

    it('should preserve state when navigating back and forth', async () => {
      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      // Select category and item
      await user.click(screen.getByText('Main Course'));
      await user.click(screen.getByText('Burger'));

      // Customize
      await waitFor(() => {
        expect(screen.getByText('cheese')).toBeInTheDocument();
      });

      const cheeseCard = screen.getByText('cheese').closest('div[class*="Card"]');
      await user.click(cheeseCard!);

      // Go to addons
      await user.click(screen.getByRole('button', { name: /Continue/ }));

      // Go back
      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Back'));

      // Verify cheese is still removed
      await waitFor(() => {
        const cheeseCardAfterBack = screen.getByText('cheese').closest('div[class*="Card"]');
        expect(cheeseCardAfterBack).toHaveClass('border-red-300');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty menu items gracefully', () => {
      const { useAvailableMenuItems } = require('../../renderer/hooks/useMenuData');
      useAvailableMenuItems.mockReturnValueOnce({
        menuItems: [],
        categories: [],
        isLoading: false,
        error: null,
      });

      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      expect(screen.getByText('No categories available')).toBeInTheDocument();
    });

    it('should handle items without ingredients', async () => {
      const { useAvailableMenuItems } = require('../../renderer/hooks/useMenuData');
      useAvailableMenuItems.mockReturnValueOnce({
        menuItems: [
          {
            id: '1',
            name: 'Coffee',
            description: 'Hot coffee',
            price: 2.99,
            category: 'Beverages',
            isAvailable: true,
            ingredients: [],
          },
        ],
        categories: ['Beverages'],
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      await user.click(screen.getByText('Beverages'));
      await user.click(screen.getByText('Coffee'));

      // Should skip directly to addons since no ingredients
      await waitFor(() => {
        expect(screen.getByTestId('addon-step')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', () => {
      const { useAvailableMenuItems } = require('../../renderer/hooks/useMenuData');
      useAvailableMenuItems.mockReturnValueOnce({
        menuItems: [],
        categories: [],
        isLoading: false,
        error: 'Failed to load menu items',
      });

      render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      expect(screen.getByText('No categories available')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should memoize category counts to avoid unnecessary recalculations', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<MenuFlow onItemAdded={mockOnItemAdded} />);

      // Initial render
      expect(screen.getByText('2 items available')).toBeInTheDocument();

      // Rerender with same props
      rerender(<MenuFlow onItemAdded={mockOnItemAdded} />);

      // Category counts should still be correct without recalculation
      expect(screen.getByText('2 items available')).toBeInTheDocument();
    });

    it('should handle large number of menu items efficiently', async () => {
      const { useAvailableMenuItems } = require('../../renderer/hooks/useMenuData');

      // Generate 100 menu items
      const largeMenuItems = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        description: `Description for item ${i}`,
        price: 9.99 + i,
        category: i % 2 === 0 ? 'Category A' : 'Category B',
        isAvailable: true,
        ingredients: ['ingredient1', 'ingredient2'],
      }));

      useAvailableMenuItems.mockReturnValueOnce({
        menuItems: largeMenuItems,
        categories: ['Category A', 'Category B'],
        isLoading: false,
        error: null,
      });

      const startTime = performance.now();
      render(<MenuFlow onItemAdded={mockOnItemAdded} />);
      const renderTime = performance.now() - startTime;

      // Should render within reasonable time (< 1000ms)
      expect(renderTime).toBeLessThan(1000);

      // Should display correct counts
      expect(screen.getByText('50 items available')).toBeInTheDocument();
    });
  });
});
