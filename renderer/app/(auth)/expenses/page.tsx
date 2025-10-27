'use client';

import POSLayout from '@/components/pos/POSLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore, useUserPermissions } from '@/stores/authStore';
import { useExpensesStore } from '@/stores/expensesStore';
import { Expense, ExpenseCategory, ExpenseStatus } from '@/types';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  DollarSign,
  Edit,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState, useRef } from 'react';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ExpensesPage() {
  const { isAuthenticated } = useAuthStore();
  const permissions = useUserPermissions();
  const {
    expenses,
    isLoading,
    error,
    filters,
    currentPage,
    totalPages,
    totalExpenses,
    fetchExpenses,
    deleteExpense,
    approveExpense,
    rejectExpense,
    setFilters,
    clearError,
  } = useExpensesStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | undefined>(
    undefined
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  
  // Ref to track if initial fetch has been performed
  const initialFetchPerformed = useRef(false);

  // Load expenses on mount
  useEffect(() => {
    if (isAuthenticated && (permissions.isManager || permissions.isAdmin) && !initialFetchPerformed.current) {
      initialFetchPerformed.current = true;
      fetchExpenses();
    }
  }, [
    isAuthenticated,
    permissions.isManager,
    permissions.isAdmin,
    fetchExpenses,
  ]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated && (permissions.isManager || permissions.isAdmin)) {
        const newFilters = { ...filters, searchTerm: searchTerm || '' };
        setFilters(newFilters);
        fetchExpenses(newFilters, 1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Pagination handler
  const handlePageChange = useCallback(
    (page: number) => {
      fetchExpenses(filters, page);
    },
    [filters, fetchExpenses]
  );

  // removed unused status badge helper

  const handleDeleteClick = (expense: Expense) => {
    setExpenseToDelete(expense);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (expenseToDelete) {
      try {
        await deleteExpense(expenseToDelete.id);
        setShowDeleteDialog(false);
        setExpenseToDelete(null);
      } catch {
        // Error is handled by the store
      }
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveExpense(id);
    } catch {
      // Error is handled by the store
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectExpense(id, 'Rejected by manager');
    } catch {
      // Error is handled by the store
    }
  };

  const handleEdit = (expenseId: string) => {
    setEditingExpenseId(expenseId);
    setIsExpenseFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsExpenseFormOpen(false);
    setEditingExpenseId(undefined);
  };

  if (!isAuthenticated || !(permissions.isManager || permissions.isAdmin)) {
    return (
      <POSLayout>
        <div className='flex min-h-[400px] items-center justify-center'>
          <div className='text-center'>
            <AlertCircle className='mx-auto mb-4 h-16 w-16 text-red-500' />
            <h2 className='mb-2 text-xl font-semibold'>Access Denied</h2>
            <p className='text-gray-600'>
              You don&apos;t have permission to view expenses.
            </p>
          </div>
        </div>
      </POSLayout>
    );
  }

  return (
    <POSLayout>
      {/* Fixed Header Section */}
      <div className='border-b border-gray-200 dark:border-gray-700'>
        <div className='space-y-3 p-3 sm:p-4'>
          {/* Header */}
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-xl font-bold text-gray-900 dark:text-white'>
                Expenses Management
              </h1>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Manage restaurant expenses and approvals
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingExpenseId(undefined);
                setIsExpenseFormOpen(true);
              }}
              size='sm'
              className='flex items-center space-x-2'
            >
              <Plus className='h-4 w-4' />
              <span>Add Expense</span>
            </Button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <AlertCircle className='h-5 w-5 text-red-500' />
                  <span className='text-red-700 dark:text-red-200'>
                    {error}
                  </span>
                </div>
                <Button variant='ghost' size='sm' onClick={clearError}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardContent className='p-4'>
              <div className='flex flex-col gap-4 sm:flex-row'>
                <div className='flex-1'>
                  <div className='relative'>
                    <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400' />
                    <Input
                      placeholder='Search expenses...'
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className='pl-10'
                    />
                  </div>
                </div>
                <Select
                  value={filters.category || 'all'}
                  onValueChange={value => {
                    const newFilters = { ...filters, searchTerm };
                    if (value === 'all') {
                      delete newFilters.category;
                    } else {
                      newFilters.category = value as ExpenseCategory;
                    }
                    setFilters(newFilters);
                    fetchExpenses(newFilters, 1);
                  }}
                >
                  <SelectTrigger className='w-[180px]'>
                    <SelectValue placeholder='Category' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Categories</SelectItem>
                    {Object.values(ExpenseCategory).map(category => (
                      <SelectItem key={category} value={category}>
                        {String(category).replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className='flex-1 overflow-hidden'>
        <div className='h-full overflow-y-auto'>
          <div className='space-y-3 p-3 sm:p-4'>
            {/* Expenses Table */}
            {isLoading ? (
              <div className='flex items-center justify-center py-12'>
                <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600'></div>
              </div>
            ) : (
              <Card>
                <CardContent className='p-0'>
                  <div className='overflow-x-auto'>
                    <table className='w-full'>
                      <thead className='border-b bg-gray-50 dark:bg-gray-800'>
                        <tr>
                          <th className='px-6 py-4 text-left text-sm font-medium text-gray-900 dark:text-white'>
                            Title & Description
                          </th>
                          <th className='px-6 py-4 text-left text-sm font-medium text-gray-900 dark:text-white'>
                            Amount
                          </th>
                          <th className='px-6 py-4 text-left text-sm font-medium text-gray-900 dark:text-white'>
                            Category
                          </th>
                          <th className='px-6 py-4 text-left text-sm font-medium text-gray-900 dark:text-white'>
                            Date
                          </th>
                          <th className='px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white'>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                        {expenses.map((expense: Expense) => (
                          <tr
                            key={expense.id}
                            className='transition-colors hover:bg-gray-50 dark:hover:bg-gray-800'
                          >
                            {/* Title & Description */}
                            <td className='px-6 py-4'>
                              <div className='space-y-1'>
                                <div className='text-sm font-semibold text-gray-900 dark:text-white'>
                                  {expense.title}
                                </div>
                                {expense.description && (
                                  <div className='max-w-xs truncate text-sm text-gray-600 dark:text-gray-400'>
                                    {expense.description}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Amount */}
                            <td className='px-6 py-4'>
                              <div className='flex items-center gap-1'>
                                <DollarSign className='h-4 w-4 text-green-600' />
                                <span className='text-sm font-semibold text-gray-900 dark:text-white'>
                                  {formatCurrency(expense.amount)}
                                </span>
                              </div>
                            </td>

                            {/* Category */}
                            <td className='px-6 py-4'>
                              <span className='text-sm text-gray-900 dark:text-white'>
                                {expense.category.replace(/_/g, ' ')}
                              </span>
                            </td>

                            {/* Date */}
                            <td className='px-6 py-4'>
                              <div className='flex items-center gap-2'>
                                <Calendar className='h-4 w-4 text-gray-400 dark:text-gray-600' />
                                <span className='text-sm text-gray-900 dark:text-white'>
                                  {formatDate(expense.createdAt)}
                                </span>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className='px-6 py-4'>
                              <div className='flex items-center justify-end gap-2'>
                                {/* Edit Button - Available for managers and admins */}
                                {(permissions.isManager ||
                                  permissions.isAdmin) && (
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={() => handleEdit(expense.id)}
                                    title='Edit'
                                  >
                                    <Edit className='h-4 w-4' />
                                  </Button>
                                )}

                                {/* Approve/Reject buttons - Only for pending expenses and admins */}
                                {permissions.isAdmin &&
                                  expense.status === ExpenseStatus.PENDING && (
                                    <>
                                      <Button
                                        size='sm'
                                        variant='outline'
                                        className='border-green-600 text-green-600 hover:bg-green-50'
                                        onClick={() =>
                                          handleApprove(expense.id)
                                        }
                                        title='Approve'
                                      >
                                        <CheckCircle className='h-4 w-4' />
                                      </Button>
                                      <Button
                                        size='sm'
                                        variant='outline'
                                        className='border-red-600 text-red-600 hover:bg-red-50'
                                        onClick={() => handleReject(expense.id)}
                                        title='Reject'
                                      >
                                        <XCircle className='h-4 w-4' />
                                      </Button>
                                    </>
                                  )}

                                {/* Delete Button - Only for admins */}
                                {permissions.isAdmin && (
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    className='border-red-600 text-red-600 hover:bg-red-50'
                                    onClick={() => handleDeleteClick(expense)}
                                    title='Delete'
                                  >
                                    <Trash2 className='h-4 w-4' />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Empty State */}
                    {expenses.length === 0 && (
                      <div className='flex flex-col items-center justify-center py-12'>
                        <DollarSign className='mb-4 h-12 w-12 text-gray-400 dark:text-gray-600' />
                        <h3 className='mb-2 text-lg font-medium text-gray-900 dark:text-white'>
                          No expenses found
                        </h3>
                        <p className='mb-4 text-gray-600 dark:text-gray-400'>
                          Get started by adding your first expense.
                        </p>
                        <Button
                          onClick={() => {
                            setEditingExpenseId(undefined);
                            setIsExpenseFormOpen(true);
                          }}
                        >
                          <Plus className='mr-2 h-4 w-4' />
                          Add Expense
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className='flex items-center justify-between p-4'>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  Showing {expenses.length} of {totalExpenses} expenses
                </p>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <span className='text-sm'>
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Expense Form Modal - Only render when needed */}
      {isExpenseFormOpen && (
        <ExpenseForm
          isOpen={isExpenseFormOpen}
          onClose={handleCloseForm}
          expenseId={editingExpenseId}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "
              {expenseToDelete?.title || expenseToDelete?.description}"? This
              action cannot be undone and will permanently remove this expense
              record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className='bg-red-600 text-white hover:bg-red-700'
            >
              Delete Expense
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </POSLayout>
  );
}