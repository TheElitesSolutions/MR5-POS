import { IpcMainInvokeEvent } from 'electron';
import { EXPENSE_CHANNELS } from '../../shared/ipc-channels';
import { CreateExpenseSchema } from '../../shared/validation-schemas';
import { validateWithSchema } from '../utils/validation-helpers';
import { AppError, logInfo } from '../error-handler';
import { ExpenseModel } from '../models/Expense';
import {
  Expense,
  IPCResponse,
  ExpenseFilters,
  // Removed unused imports: PaymentMethod, RecurringType
} from '../types/index';

// Define missing types locally
interface ExpenseAnalytics {
  totalExpenses: number;
  categoryBreakdown: Record<string, number>;
  averageExpense: number;
  monthlyTrend: Array<{ month: string; amount: number }>;
}

import { toDecimal } from '../utils/decimal';
import { BaseController } from './baseController';

export class ExpenseController extends BaseController {
  constructor() {
    super();
    // this.initialize(); // Removed: StartupManager calls initialize() explicitly
  }

  protected registerHandlers(): void {
    // Get all expenses with filtering and pagination
    this.registerHandler(
      EXPENSE_CHANNELS.GET_ALL,
      async (
        _event: IpcMainInvokeEvent,
        params?: { filters?: ExpenseFilters; page?: number; limit?: number }
      ): Promise<
        IPCResponse<{
          expenses: Expense[];
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        }>
      > => {
        try {
          const { filters, page = 1, limit = 20 } = params || {};
          
          console.log('[ExpenseController] GET_ALL called with:', { filters, page, limit });
          
          const result = await ExpenseModel.getAllExpenses(
            filters,
            page,
            limit
          );
          logInfo(`Retrieved ${result.expenses.length} expenses with filters:`, filters);

          return this.createSuccessResponse(
            result,
            'Expenses retrieved successfully'
          );
        } catch (error) {
          console.error('[ExpenseController] Error in GET_ALL:', error);
          return this.createErrorResponse(
            error instanceof Error ? error : String(error)
          );
        }
      }
    );

    // Get expense by ID
    this.registerHandler(
      EXPENSE_CHANNELS.GET_BY_ID,
      async (
        _event: IpcMainInvokeEvent,
        expenseId: string
      ): Promise<IPCResponse<Expense | null>> => {
        try {
          if (!expenseId) {
            throw new AppError('Expense ID is required', true);
          }

          const expense = await ExpenseModel.getExpenseById(expenseId);
          return this.createSuccessResponse(
            expense,
            expense ? 'Expense retrieved successfully' : 'Expense not found'
          );
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : String(error)
          );
        }
      }
    );

    // Create expense
    this.registerHandler(
      EXPENSE_CHANNELS.CREATE,
      async (
        _event: IpcMainInvokeEvent,
        ...args: any[]
      ): Promise<IPCResponse<Expense>> => {
        try {
          // Extract the first argument
          const expenseDataWithUserId = args[0];

          // Runtime validation with Zod
          const validation = validateWithSchema(
            CreateExpenseSchema,
            expenseDataWithUserId,
            'CreateExpense'
          );

          if (!validation.success) {
            logInfo(`CreateExpense: Validation failed - ${validation.error}`);
            return this.createErrorResponse(new Error(validation.error));
          }

          const validatedData = validation.data!;
          const { userId, ...expenseData } = validatedData as any;

          // Convert amount to Decimal for type safety
          const expenseDataWithDecimal = {
            ...expenseData,
            amount: toDecimal(expenseData.amount),
          };

          const expense = await ExpenseModel.createExpense(
            expenseDataWithDecimal,
            userId
          );
          logInfo(`Expense created successfully: ${expense.id}`);

          return this.createSuccessResponse(
            expense,
            'Expense created successfully'
          );
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : String(error)
          );
        }
      }
    );

    // Update expense
    this.registerHandler(
      EXPENSE_CHANNELS.UPDATE,
      async (
        _event: IpcMainInvokeEvent,
        payload: { id: string; updateData: any }
      ): Promise<IPCResponse<Expense>> => {
        try {
          const { id: expenseId, updateData } = payload;

          if (!expenseId) {
            throw new AppError('Expense ID is required', true);
          }

          if (updateData.amount !== undefined && updateData.amount <= 0) {
            throw new AppError('Amount must be positive', true);
          }

          // Convert amount to Decimal if provided
          const { amount, ...restUpdateData } = updateData;
          const updateDataWithDecimal = {
            ...restUpdateData,
            ...(amount !== undefined && {
              amount: toDecimal(amount),
            }),
          };

          const expense = await ExpenseModel.updateExpense(
            expenseId,
            updateDataWithDecimal
          );
          logInfo(`Expense updated successfully: ${expenseId}`);

          return this.createSuccessResponse(
            expense,
            'Expense updated successfully'
          );
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : String(error)
          );
        }
      }
    );

    // Delete expense
    this.registerHandler(
      EXPENSE_CHANNELS.DELETE,
      async (
        _event: IpcMainInvokeEvent,
        expenseId: string
      ): Promise<IPCResponse<boolean>> => {
        try {
          if (!expenseId) {
            throw new AppError('Expense ID is required', true);
          }

          await ExpenseModel.deleteExpense(expenseId);
          logInfo(`Expense deleted successfully: ${expenseId}`);

          return this.createSuccessResponse(
            true,
            'Expense deleted successfully'
          );
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : String(error)
          );
        }
      }
    );

    // Get expenses by category
    this.registerHandler(
      EXPENSE_CHANNELS.GET_BY_CATEGORY,
      async (
        _event: IpcMainInvokeEvent,
        category: string
      ): Promise<IPCResponse<Expense[]>> => {
        try {
          if (!category) {
            throw new AppError('Category is required', true);
          }

          const expenses = await ExpenseModel.getExpensesByCategory(category);
          logInfo(
            `Retrieved ${expenses.length} expenses for category: ${category}`
          );

          return this.createSuccessResponse(
            expenses,
            'Expenses retrieved successfully'
          );
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : String(error)
          );
        }
      }
    );

    // Get expenses by date range
    this.registerHandler(
      EXPENSE_CHANNELS.GET_BY_DATE_RANGE,
      async (
        _event: IpcMainInvokeEvent,
        startDate: string,
        endDate: string
      ): Promise<IPCResponse<Expense[]>> => {
        try {
          if (!startDate || !endDate) {
            throw new AppError('Start date and end date are required', true);
          }

          const expenses = await ExpenseModel.getExpensesByDateRange(
            new Date(startDate),
            new Date(endDate)
          );
          logInfo(
            `Retrieved ${expenses.length} expenses for date range: ${startDate} to ${endDate}`
          );

          return this.createSuccessResponse(
            expenses,
            'Expenses retrieved successfully'
          );
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : String(error)
          );
        }
      }
    );

    // Get expense statistics
    this.registerHandler(
      EXPENSE_CHANNELS.GET_STATS,
      async (
        _event: IpcMainInvokeEvent,
        startDate?: string,
        endDate?: string
      ): Promise<
        IPCResponse<{
          totalExpenses: number;
          averageExpense: number;
          expensesByCategory: Record<string, number>;
          expensesByMonth: Record<string, number>;
        }>
      > => {
        try {
          const stats = await ExpenseModel.getExpenseStats(
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined
          );
          logInfo('Retrieved expense statistics');

          return this.createSuccessResponse(
            stats,
            'Expense statistics retrieved successfully'
          );
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : String(error)
          );
        }
      }
    );

    // Approve expense
    this.registerHandler(
      EXPENSE_CHANNELS.APPROVE,
      async (
        _event: IpcMainInvokeEvent,
        expenseId: string,
        approverId: string
      ): Promise<IPCResponse<Expense>> => {
        try {
          if (!expenseId) {
            throw new AppError('Expense ID is required', true);
          }

          if (!approverId) {
            throw new AppError('Approver ID is required', true);
          }

          const expense = await ExpenseModel.approveExpense(
            expenseId,
            approverId
          );
          logInfo(`Expense approved successfully: ${expenseId}`);

          return this.createSuccessResponse(
            expense,
            'Expense approved successfully'
          );
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : String(error)
          );
        }
      }
    );

    // Get expense analytics
    this.registerHandler(
      EXPENSE_CHANNELS.GET_ANALYTICS,
      async (
        _event: IpcMainInvokeEvent,
        options?: {
          startDate?: string;
          endDate?: string;
          groupBy?: 'day' | 'week' | 'month' | 'category' | 'vendor';
        }
      ): Promise<IPCResponse<ExpenseAnalytics>> => {
        try {
          // Create filters object from options
          const filters: ExpenseFilters = {};
          if (options?.startDate) filters.dateFrom = options.startDate;
          if (options?.endDate) filters.dateTo = options.endDate;

          // Use getAnalytics instead of getExpenseAnalytics
          const analytics = await ExpenseModel.getAnalytics(filters);
          logInfo('Retrieved expense analytics');

          return this.createSuccessResponse(
            analytics as unknown as ExpenseAnalytics,
            'Expense analytics retrieved successfully'
          );
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : String(error)
          );
        }
      }
    );

    logInfo('Expense IPC handlers registered');
  }
}
