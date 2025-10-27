'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { posLogger } from '@/utils/logger';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/stores/authStore';
import { usePOSStore } from '@/stores/posStore';
import { Table } from '@/types';
import { Clock, DollarSign, MapPin, Plus, Trash2, Timer } from 'lucide-react';
import React, { memo, useCallback, useState } from 'react';

const TableGrid = memo(() => {
  // Parse SQLite datetime as local time (not UTC)
  const parseLocalDateTime = (dateString: string): Date => {
    // SQLite format: "YYYY-MM-DD HH:MM:SS"
    // We need to parse this as local time, not UTC
    const [datePart, timePart] = dateString.replace('T', ' ').split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = (timePart || '00:00:00').split(':').map(Number);

    // Create date in local timezone (month is 0-indexed)
    return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
  };

  // Atomic selectors to prevent unnecessary re-renders
  const tables = usePOSStore(state => state.tables);
  const selectedTable = usePOSStore(state => state.selectedTable);
  const selectTable = usePOSStore(state => state.selectTable);
  const createTable = usePOSStore(state => state.createTable);
  const deleteTable = usePOSStore(state => state.deleteTable);
  const isLoading = usePOSStore(state => state.isLoading);
  const getTableStatus = usePOSStore(state => state.getTableStatus);
  const tableTab = usePOSStore(state => state.tableTab);
  const toggleTablePayLater = usePOSStore(state => state.toggleTablePayLater);

  const permissions = useUserPermissions();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTable, setNewTable] = useState({ name: '' });
  const [isCreating, setIsCreating] = useState(false);

  const handleTableClick = useCallback(
    async (table: Table) => {
      try {
        // Just select the table - don't create an order automatically
        await selectTable(table);

        toast({
          title: 'Table Selected',
          description: `${table.name} is now active`,
        });
      } catch (error) {
        posLogger.error('Failed to handle table selection:', error);
        toast({
          title: 'Error',
          description: 'Failed to select table',
          variant: 'destructive',
        });
      }
    },
    [selectTable, toast, getTableStatus]
  );

  const handleDeleteTable = useCallback(
    async (tableId: string) => {
      try {
        const table = tables.find(t => t.id === tableId);
        const hasActiveOrder = table?.activeOrder;
        await deleteTable(tableId);
        toast({
          title: hasActiveOrder ? 'Table & Order Deleted' : 'Table Deleted',
          description: hasActiveOrder
            ? `${table?.name} and its active order have been removed successfully`
            : `${table?.name} has been removed successfully`,
        });
      } catch (error) {
        posLogger.error('Failed to delete table:', error);
        toast({
          title: 'Deletion Failed',
          description: 'Failed to delete table. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [deleteTable, tables, toast]
  );

  const getTableBadgeColor = (table: Table) => {
    const status = getTableStatus(table.id);
    if (status === 'occupied') {
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
    }
    return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
  };

  const getTableBadgeText = (table: Table) => {
    const status = getTableStatus(table.id);
    return status === 'occupied' ? 'In Use' : 'Available';
  };

  const formatElapsedTime = (createdAt: string | Date) => {
    const now = new Date();
    const created =
      typeof createdAt === 'string' ? parseLocalDateTime(createdAt) : createdAt;
    const diffInMinutes = Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      const minutes = diffInMinutes % 60;
      return `${hours}h ${minutes}m ago`;
    }
  };

  const getTotalItemQuantity = (table: Table) => {
    if (!table.activeOrder?.items) return 0;
    return table.activeOrder.items.reduce(
      (total, item) => total + (item.quantity || 0),
      0
    );
  };

  const handleSubmitNewTable = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isCreating) return;

      setIsCreating(true);
      try {
        await createTable(newTable.name);
        setNewTable({ name: '' });
        setShowCreateDialog(false);
        toast({
          title: 'Table Created',
          description: `${newTable.name} has been added successfully`,
        });
      } catch (error: unknown) {
        posLogger.error('Failed to create table:', error);
        toast({
          title: 'Creation Failed',
          description: 'Failed to create table. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsCreating(false);
      }
    },
    [createTable, newTable.name, toast, isCreating]
  );

  const handleTogglePayLater = useCallback(
    async (tableId: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent table selection when clicking the button
      try {
        await toggleTablePayLater(tableId);
        toast({
          title: 'Pay Later Status Updated',
          description: 'Table has been moved to the other tab',
        });
      } catch (error) {
        posLogger.error('Failed to toggle pay later status:', error);
        toast({
          title: 'Update Failed',
          description: 'Failed to update pay later status',
          variant: 'destructive',
        });
      }
    },
    [toggleTablePayLater, toast]
  );

  // Filter tables based on the current tab
  const filteredTables = tables.filter(table => {
    if (tableTab === 'NOT_PAID') {
      return table.isPayLater === true;
    } else {
      return table.isPayLater !== true; // Show tables that are false or undefined in DINE_IN tab
    }
  });

  if (isLoading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <div className='text-center'>
          <div className='mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600'></div>
          <p className='text-gray-500 dark:text-gray-400'>Loading tables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Single Dialog Component - Controlled by state */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className='mx-4 sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Create New Table</DialogTitle>
            <DialogDescription>
              Add a new table to your restaurant floor plan with a unique
              number or name.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitNewTable} className='space-y-4'>
            <div className='grid gap-4 py-4'>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label htmlFor='name' className='text-right'>
                  Table Name
                </Label>
                <Input
                  id='name'
                  type='text'
                  placeholder='Enter name or number (e.g., Table 1, VIP, Corner)'
                  value={newTable.name}
                  onChange={e =>
                    setNewTable({ ...newTable, name: e.target.value })
                  }
                  className='col-span-3'
                  required
                  autoFocus
                />
              </div>
              <p className='col-span-4 text-xs text-gray-500 dark:text-gray-400'>
                Use any name or number that makes sense for your layout
              </p>
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setShowCreateDialog(false)}
                className='touch-manipulation'
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={!newTable.name.trim() || isCreating}
                className='touch-manipulation'
              >
                {isCreating ? 'Creating...' : 'Create Table'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Header with Create Table Button */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-2'>
          <span className='text-sm text-gray-600 dark:text-gray-400'>
            {filteredTables.length} {filteredTables.length === 1 ? 'table' : 'tables'} total
          </span>
          {filteredTables.filter(t => getTableStatus(t.id) === 'occupied').length >
            0 && (
            <Badge variant='outline' className='text-xs'>
              {filteredTables.filter(t => getTableStatus(t.id) === 'occupied').length}{' '}
              occupied
            </Badge>
          )}
        </div>

        {(permissions.isAdmin || permissions.isManager) && (
          <Button
            size='sm'
            className='touch-manipulation'
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className='mr-1 h-4 w-4' /> Add Table
          </Button>
        )}
      </div>

      {/* Tables Grid - Responsive grid with better mobile spacing */}
      <div className='grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6 xl:grid-cols-5 2xl:grid-cols-6'>
        {filteredTables.map(table => (
          <Card
            key={table.id}
            className={cn(
              'group cursor-pointer touch-manipulation p-3 transition-all duration-200 sm:p-4',
              'transform hover:shadow-lg active:scale-95',
              'min-h-[140px] border-2 sm:min-h-[160px]',
              selectedTable?.id === table.id
                ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-500 dark:border-blue-700 dark:bg-blue-950/30'
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
            )}
            onClick={() => handleTableClick(table)}
          >
            <div className='flex h-full flex-col space-y-3'>
              {/* Table Header with Name and Action Buttons */}
              <div className='flex items-start justify-between'>
                <div className='min-w-0 flex-1 pr-2'>
                  <h3 className='break-words text-sm font-bold leading-tight text-gray-900 dark:text-white sm:text-base'>
                    {table.name}
                  </h3>
                </div>

                <div className='flex items-center gap-1'>
                  {/* Pay Later toggle button */}
                  {(permissions.isAdmin || permissions.isManager) && (
                    <Button
                      variant='ghost'
                      size='icon'
                      className={cn(
                        'h-8 w-8 flex-shrink-0',
                        table.isPayLater
                          ? 'text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/20 dark:hover:text-amber-300'
                          : 'text-gray-400 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-500 dark:hover:bg-blue-950/20 dark:hover:text-blue-400'
                      )}
                      onClick={(e) => handleTogglePayLater(table.id, e)}
                      title={table.isPayLater ? 'Move to Dine In tab' : 'Move to Not Paid tab'}
                    >
                      <Timer className='h-4 w-4' />
                    </Button>
                  )}

                  {/* Delete button - show for all tables if user has permissions */}
                  {(permissions.isAdmin || permissions.isManager) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        className={cn(
                          'h-8 w-8 flex-shrink-0 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20 dark:hover:text-red-400',
                          table.activeOrder
                            ? 'text-red-500 dark:text-red-400' // More visible for occupied tables
                            : 'text-gray-400 dark:text-gray-500' // Less visible for available tables
                        )}
                        onClick={e => e.stopPropagation()}
                        title={
                          table.activeOrder
                            ? 'Delete table and its active order'
                            : 'Delete table'
                        }
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete Table & Orders
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {table.name}?
                          {table.activeOrder ? (
                            <>
                              <br />
                              <br />
                              <strong className='text-red-600 dark:text-red-400'>
                                ⚠️ WARNING: This table has an active order ($
                                {(table.activeOrder.totalAmount || 0).toFixed(
                                  2
                                )}
                                ) with {getTotalItemQuantity(table)} items that
                                will also be permanently deleted.
                              </strong>
                            </>
                          ) : (
                            <>
                              <br />
                              <br />
                              Any future orders associated with this table will
                              also be deleted.
                            </>
                          )}
                          <br />
                          <br />
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteTable(table.id);
                          }}
                          className='bg-red-600 text-white hover:bg-red-700'
                        >
                          {table.activeOrder
                            ? 'Delete Table & Order'
                            : 'Delete Table'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <div className='flex justify-start'>
                <Badge
                  variant='outline'
                  className={cn(
                    'px-3 py-1 text-xs font-medium',
                    getTableBadgeColor(table)
                  )}
                >
                  {getTableBadgeText(table)}
                </Badge>
              </div>

              {/* Active Order Info */}
              {table.activeOrder ? (
                <div className='flex-1 space-y-2'>
                  <div className='flex items-center text-xs text-gray-600 dark:text-gray-400'>
                    <Clock className='mr-1 h-3 w-3 flex-shrink-0' />
                    <span className='truncate'>
                      {formatElapsedTime(table.activeOrder.createdAt)}
                    </span>
                  </div>

                  <div className='border-t border-gray-200 pt-2 dark:border-gray-700'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center text-sm font-semibold text-gray-900 dark:text-white'>
                        <DollarSign className='mr-1 h-3 w-3' />
                        <span>
                          {(
                            table.activeOrder?.totalAmount ||
                            table.activeOrder?.total ||
                            0
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div className='text-xs text-gray-500 dark:text-gray-400'>
                        {getTotalItemQuantity(table)} items
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className='flex flex-1 items-end justify-center pb-2'>
                  <span className='text-center text-sm font-medium text-gray-500 dark:text-gray-400'>
                    {getTableStatus(table.id) === 'occupied'
                      ? 'Order in progress'
                      : 'Ready for orders'}
                  </span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredTables.length === 0 && (
        <div className='py-12 text-center sm:py-16'>
          <div className='mb-6 text-gray-500 dark:text-gray-400'>
            <MapPin className='mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600' />
            <h3 className='mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300 sm:text-xl'>
              No Tables Created
            </h3>
            <p className='mx-auto max-w-md text-sm leading-relaxed sm:text-base'>
              Start by creating your first table. You can assign any number and
              position them as needed for your restaurant layout.
            </p>
          </div>
          {(permissions.isAdmin || permissions.isManager) && (
            <Button
              className='mt-4 touch-manipulation'
              size='lg'
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className='mr-2 h-5 w-5' />
              Create Your First Table
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

TableGrid.displayName = 'TableGrid';

export default TableGrid;
