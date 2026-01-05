import { EXPENSE_CHANNELS } from '../../shared/ipc-channels';
import { electronAPI } from '../utils/electron-api';
import { useAuthStore } from '@/stores/authStore';
// Helper function to validate IPC responses
function validateIPCResponse(response) {
    if (response && typeof response === 'object' && 'success' in response) {
        return response;
    }
    throw new Error('Invalid IPC response format');
}
/**
 * IPC-based Expense API Client
 * Replaces HTTP requests with proper Electron IPC communication
 */
export class ExpenseAPIClient {
    // Get all expenses with filtering and pagination
    async getExpenses(filters, page = 1, limit = 20) {
        const rawResponse = await electronAPI.invoke(EXPENSE_CHANNELS.GET_ALL, {
            filters,
            page,
            limit,
        });
        const response = validateIPCResponse(rawResponse);
        if (!response.success) {
            throw new Error(response.error || 'Failed to fetch expenses');
        }
        return response.data;
    }
    // Get single expense by ID
    async getExpense(id) {
        const rawResponse = await electronAPI.invoke(EXPENSE_CHANNELS.GET_BY_ID, id);
        const response = validateIPCResponse(rawResponse);
        if (!response.success) {
            throw new Error(response.error || 'Failed to fetch expense');
        }
        return response.data;
    }
    // Create new expense
    async createExpense(expenseData) {
        // Get current user ID from auth store
        const { user, isAuthenticated } = useAuthStore.getState();
        if (!user?.id) {
            console.error('DEBUG: User authentication failed:', {
                user,
                isAuthenticated,
            });
            throw new Error('User must be authenticated to create expenses');
        }
        // Include userId in the expenseData to avoid IPC parameter issues
        const expenseDataWithUserId = {
            ...expenseData,
            userId: user.id,
        };
        const rawResponse = await electronAPI.invoke(EXPENSE_CHANNELS.CREATE, expenseDataWithUserId);
        const response = validateIPCResponse(rawResponse);
        if (!response.success) {
            throw new Error(response.error || 'Failed to create expense');
        }
        return response.data;
    }
    // Update existing expense
    async updateExpense(id, updateData) {
        // Get current user ID from auth store
        const { user, isAuthenticated } = useAuthStore.getState();
        if (!user?.id) {
            console.error('DEBUG: User authentication failed in updateExpense:', {
                user,
                isAuthenticated,
            });
            throw new Error('User must be authenticated to update expenses');
        }
        // Include userId in the updateData to avoid IPC parameter issues
        const updateDataWithUserId = {
            ...updateData,
            userId: user.id,
        };
        const rawResponse = await electronAPI.invoke(EXPENSE_CHANNELS.UPDATE, {
            id,
            updateData: updateDataWithUserId,
        });
        const response = validateIPCResponse(rawResponse);
        if (!response.success) {
            throw new Error(response.error || 'Failed to update expense');
        }
        return response.data;
    }
    // Delete expense
    async deleteExpense(id) {
        const rawResponse = await electronAPI.invoke(EXPENSE_CHANNELS.DELETE, id);
        const response = validateIPCResponse(rawResponse);
        if (!response.success) {
            throw new Error(response.error || 'Failed to delete expense');
        }
        return response.data;
    }
    // Approve expense
    async approveExpense(id) {
        const rawResponse = await electronAPI.invoke(EXPENSE_CHANNELS.APPROVE, {
            id,
            approverId: 'current-user', // TODO: Get from auth store
        });
        const response = validateIPCResponse(rawResponse);
        if (!response.success) {
            throw new Error(response.error || 'Failed to approve expense');
        }
        return response.data;
    }
    // Reject expense
    async rejectExpense(id, reason) {
        const rawResponse = await electronAPI.invoke(EXPENSE_CHANNELS.UPDATE, {
            id,
            updateData: {
                status: 'REJECTED',
                notes: reason,
            },
            approverId: 'current-user', // TODO: Get from auth store
        });
        const response = validateIPCResponse(rawResponse);
        if (!response.success) {
            throw new Error(response.error || 'Failed to reject expense');
        }
        return response.data;
    }
    // Get expense analytics
    async getAnalytics(filters) {
        const rawResponse = await electronAPI.invoke(EXPENSE_CHANNELS.GET_ANALYTICS, filters);
        const response = validateIPCResponse(rawResponse);
        if (!response.success) {
            throw new Error(response.error || 'Failed to fetch analytics');
        }
        return response.data;
    }
}
// Export singleton instance
export const expenseAPI = new ExpenseAPIClient();
