import { expenseAPI } from '@/lib/expense-api';
import {
  CreateExpenseRequest,
  Expense,
  ExpenseAnalytics,
  ExpenseFilters,
  ExpenseStatus,
  UpdateExpenseRequest,
} from '@/types';
import { create } from 'zustand';

interface ExpensesState {
  expenses: Expense[];
  totalExpenses: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  analytics: ExpenseAnalytics | null;
  filters: ExpenseFilters;
  _lastFetchTime: number;
  _fetchInProgress: boolean;

  // Actions
  fetchExpenses: (
    filters?: ExpenseFilters,
    page?: number,
    limit?: number
  ) => Promise<void>;
  fetchExpense: (id: string) => Promise<Expense | null>;
  createExpense: (expense: CreateExpenseRequest) => Promise<Expense>;
  updateExpense: (id: string, updates: UpdateExpenseRequest) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  approveExpense: (id: string) => Promise<void>;
  rejectExpense: (id: string, reason: string) => Promise<void>;
  fetchAnalytics: (filters?: ExpenseFilters) => Promise<void>;
  setFilters: (filters: ExpenseFilters) => void;
  clearError: () => void;
}

export const useExpensesStore = create<ExpensesState>((set, get) => ({
  expenses: [],
  totalExpenses: 0,
  currentPage: 1,
  totalPages: 1,
  isLoading: false,
  error: null,
  analytics: null,
  filters: {},
  _lastFetchTime: 0,
  _fetchInProgress: false,

  fetchExpenses: async (filters = {}, page = 1, limit = 20) => {
    try {
      const currentState = get();
      
      // Debounce rapid successive calls (within 500ms)
      const now = Date.now();
      if (currentState._fetchInProgress || 
          (now - currentState._lastFetchTime < 500)) {
        console.log('ExpensesStore: Debouncing duplicate fetch call');
        return;
      }

      set({ isLoading: true, error: null, _fetchInProgress: true, _lastFetchTime: now });

      const response = await expenseAPI.getExpenses(filters, page, limit);

      set({
        expenses: response.expenses,
        totalExpenses: response.total,
        currentPage: response.page,
        totalPages: response.totalPages,
        isLoading: false,
        _fetchInProgress: false,
      });
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to fetch expenses',
        isLoading: false,
        _fetchInProgress: false,
      });
    }
  },

  fetchExpense: async (id: string) => {
    try {
      set({ isLoading: true, error: null });

      const expense = await expenseAPI.getExpense(id);

      set({ isLoading: false });
      return expense;
    } catch (error) {
      console.error(`Failed to fetch expense ${id}:`, error);
      set({
        error:
          error instanceof Error
            ? error.message
            : `Failed to fetch expense ${id}`,
        isLoading: false,
      });
      return null;
    }
  },

  createExpense: async (expense: CreateExpenseRequest) => {
    try {
      set({ isLoading: true, error: null });

      // Get the created expense from the API
      const createdExpense = await expenseAPI.createExpense(expense);

      // Refresh the expenses list
      const { filters, currentPage } = get();
      await get().fetchExpenses(filters, currentPage);

      set({ isLoading: false });

      // Return the created expense to the caller
      return createdExpense;
    } catch (error) {
      console.error('Failed to create expense:', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to create expense',
        isLoading: false,
      });
      throw error;
    }
  },

  updateExpense: async (id: string, updates: UpdateExpenseRequest) => {
    try {
      set({ isLoading: true, error: null });

      await expenseAPI.updateExpense(id, updates);

      // Update the expense in the local state
      const { expenses } = get();
      const updatedExpenses = expenses.map(expense =>
        expense.id === id ? { ...expense, ...updates } : expense
      );

      set({ expenses: updatedExpenses, isLoading: false });
    } catch (error) {
      console.error(`Failed to update expense ${id}:`, error);
      set({
        error:
          error instanceof Error
            ? error.message
            : `Failed to update expense ${id}`,
        isLoading: false,
      });
      throw error;
    }
  },

  deleteExpense: async (id: string) => {
    try {
      set({ isLoading: true, error: null });

      await expenseAPI.deleteExpense(id);

      // Remove the expense from the local state
      const { expenses } = get();
      const updatedExpenses = expenses.filter(expense => expense.id !== id);

      set({ expenses: updatedExpenses, isLoading: false });
    } catch (error) {
      console.error(`Failed to delete expense ${id}:`, error);
      set({
        error:
          error instanceof Error
            ? error.message
            : `Failed to delete expense ${id}`,
        isLoading: false,
      });
      throw error;
    }
  },

  approveExpense: async (id: string) => {
    try {
      set({ isLoading: true, error: null });

      await expenseAPI.approveExpense(id);

      // Update the expense status in the local state
      const { expenses } = get();
      const updatedExpenses = expenses.map(expense =>
        expense.id === id
          ? { ...expense, status: ExpenseStatus.APPROVED }
          : expense
      );

      set({ expenses: updatedExpenses, isLoading: false });
    } catch (error) {
      console.error(`Failed to approve expense ${id}:`, error);
      set({
        error:
          error instanceof Error
            ? error.message
            : `Failed to approve expense ${id}`,
        isLoading: false,
      });
      throw error;
    }
  },

  rejectExpense: async (id: string, reason: string) => {
    try {
      set({ isLoading: true, error: null });

      await expenseAPI.rejectExpense(id, reason);

      // Update the expense status in the local state
      const { expenses } = get();
      const updatedExpenses = expenses.map(expense =>
        expense.id === id
          ? { ...expense, status: ExpenseStatus.REJECTED, notes: reason }
          : expense
      );

      set({ expenses: updatedExpenses, isLoading: false });
    } catch (error) {
      console.error(`Failed to reject expense ${id}:`, error);
      set({
        error:
          error instanceof Error
            ? error.message
            : `Failed to reject expense ${id}`,
        isLoading: false,
      });
      throw error;
    }
  },

  fetchAnalytics: async (filters = {}) => {
    try {
      set({ isLoading: true, error: null });

      const analytics = await expenseAPI.getAnalytics(filters);

      set({ analytics, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch expense analytics:', error);
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch expense analytics',
        isLoading: false,
      });
    }
  },

  setFilters: (filters: ExpenseFilters) => {
    set({ filters });
  },

  clearError: () => {
    set({ error: null });
  },
}));
