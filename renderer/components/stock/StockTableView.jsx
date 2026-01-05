'use client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Pagination } from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { usePagination } from '@/hooks/usePagination';
import { AlertTriangle, Check, DollarSign, Edit, Package, TrendingDown, TrendingUp, Trash2, X, } from 'lucide-react';
import { memo, useState } from 'react';
const StockTableView = memo(({ items, onEdit, onDelete, onQuickAdjust, onQuickEdit, isAdjusting = false, }) => {
    // State for inline editing
    const [editingState, setEditingState] = useState(null);
    // Pagination hook
    const { currentPage, itemsPerPage, paginatedItems, goToPage, } = usePagination({
        totalItems: items.length,
        itemsPerPage: 10,
        initialPage: 1,
    });
    // Get paginated items
    const displayItems = paginatedItems(items);
    const formatCurrency = (value) => {
        // Format without the $ sign since we're adding it separately with the icon
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        })
            .format(value)
            .replace('$', ''); // Remove the currency symbol
    };
    const getStockLevel = (item) => {
        const currentQty = item.currentQuantity ?? item.currentStock ?? 0;
        const minQty = item.minimumQuantity ?? item.minimumStock ?? 0;
        if (currentQty <= minQty)
            return 'low';
        if (currentQty <= minQty * 2)
            return 'medium';
        return 'high';
    };
    const getStockLevelColor = (level) => {
        switch (level) {
            case 'low':
                return 'bg-red-500';
            case 'medium':
                return 'bg-yellow-500';
            case 'high':
                return 'bg-green-500';
            default:
                return 'bg-gray-500';
        }
    };
    // Helper functions for inline editing
    const startEditing = (itemId, field, currentValue) => {
        setEditingState({ itemId, field, value: currentValue });
    };
    const cancelEditing = () => {
        setEditingState(null);
    };
    const saveEditing = () => {
        if (editingState && onQuickEdit) {
            onQuickEdit(editingState.itemId, editingState.field, editingState.value);
            setEditingState(null);
        }
    };
    const handleEditingChange = (value) => {
        if (editingState) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                setEditingState({
                    ...editingState,
                    value: numValue,
                });
            }
        }
    };
    const getCategoryColor = (category) => {
        const colors = {
            Meat: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
            Seafood: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
            Vegetables: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
            Dairy: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
            Spices: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
            Beverages: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
            Grains: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
            Condiments: 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-300',
        };
        return (colors[category] ||
            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300');
    };
    if (items.length === 0) {
        return (<div className='py-12 text-center'>
          <Package className='mx-auto mb-4 h-12 w-12 text-gray-400'/>
          <h3 className='mb-2 text-lg font-medium text-gray-900 dark:text-white'>
            No stock items found
          </h3>
          <p className='text-gray-600 dark:text-gray-400'>
            No items match your current filter criteria.
          </p>
        </div>);
    }
    return (<div className='space-y-4'>
        <div className='rounded-md border bg-white dark:bg-gray-800'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[250px]'>Item Details</TableHead>
                <TableHead className='w-[120px]'>Category</TableHead>
                <TableHead className='w-[150px]'>Stock Level</TableHead>
                <TableHead className='w-[120px]'>Quantity</TableHead>
                <TableHead className='w-[120px]'>Cost/Unit</TableHead>
                <TableHead className='w-[120px]'>Total Value</TableHead>
                <TableHead className='w-[100px]'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.map(item => {
            const currentQty = item.currentQuantity ?? item.currentStock ?? 0;
            const minQty = item.minimumQuantity ?? item.minimumStock ?? 0;
            const stockLevel = getStockLevel(item);
            const stockPercentage = Math.min((currentQty / Math.max(minQty, 1)) * 100, 100);
            const totalValue = currentQty * item.costPerUnit;
            return (<TableRow key={item.id} className='hover:bg-gray-50 dark:hover:bg-gray-700'>
                    <TableCell>
                      <div className='flex items-start space-x-3'>
                        <Package className='mt-1 h-4 w-4 flex-shrink-0 text-gray-400'/>
                        <div className='min-w-0 flex-1'>
                          <div className='flex items-center space-x-2'>
                            <p className='font-medium text-gray-900 dark:text-white'>
                              {item.name}
                            </p>
                            {stockLevel === 'low' && (<TrendingDown className='h-3 w-3 text-red-500'/>)}
                            {stockLevel === 'high' && (<TrendingUp className='h-3 w-3 text-green-500'/>)}
                          </div>
                          <p className='text-sm text-gray-600 dark:text-gray-400'>
                            Unit: {item.unit}
                          </p>
                          {stockLevel === 'low' && (<div className='mt-1 flex items-center space-x-1'>
                              <AlertTriangle className='h-3 w-3 text-red-500'/>
                              <span className='text-xs font-medium text-red-600 dark:text-red-400'>
                                Low Stock Alert
                              </span>
                            </div>)}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant='outline' className={`${getCategoryColor(item.category || 'Other')}`}>
                        {item.category || 'Other'}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className='space-y-2'>
                        <div className='flex items-center justify-between'>
                          <span className='text-sm text-gray-600 dark:text-gray-400'>
                            {currentQty} / {minQty}
                          </span>
                          <Badge variant='outline' className={`text-xs ${stockLevel === 'low'
                    ? 'border-red-500 text-red-600 dark:text-red-400'
                    : stockLevel === 'medium'
                        ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                        : 'border-green-500 text-green-600 dark:text-green-400'}`}>
                            {stockLevel}
                          </Badge>
                        </div>
                        <Progress value={stockPercentage} className='h-1.5' style={{
                    '--progress-background': getStockLevelColor(stockLevel),
                }}/>
                        {editingState?.itemId === item.id &&
                    editingState?.field === 'minimumQuantity' ? (<div className='mt-1 flex items-center space-x-1'>
                            <span className='text-xs text-gray-500 dark:text-gray-400'>
                              Min:
                            </span>
                            <Input type='number' className='h-6 w-16 text-xs' value={editingState.value} onChange={e => handleEditingChange(e.target.value)} autoFocus/>
                            <div className='flex space-x-1'>
                              <Button variant='ghost' size='sm' className='h-4 w-4 p-0 text-green-600' onClick={saveEditing}>
                                <Check className='h-2 w-2'/>
                              </Button>
                              <Button variant='ghost' size='sm' className='h-4 w-4 p-0 text-red-600' onClick={cancelEditing}>
                                <X className='h-2 w-2'/>
                              </Button>
                            </div>
                          </div>) : (<p className='cursor-pointer rounded p-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700' onClick={() => onQuickEdit &&
                        startEditing(item.id, 'minimumQuantity', minQty)} title='Click to edit minimum quantity'>
                            Min: {minQty}
                          </p>)}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className='text-center'>
                        {editingState?.itemId === item.id &&
                    editingState?.field === 'currentQuantity' ? (<div className='flex items-center space-x-1'>
                            <Input type='number' className='h-8 w-20 text-center' value={editingState.value} onChange={e => handleEditingChange(e.target.value)} autoFocus/>
                            <div className='flex flex-col space-y-1'>
                              <Button variant='ghost' size='sm' className='h-4 w-4 p-0 text-green-600' onClick={saveEditing}>
                                <Check className='h-3 w-3'/>
                              </Button>
                              <Button variant='ghost' size='sm' className='h-4 w-4 p-0 text-red-600' onClick={cancelEditing}>
                                <X className='h-3 w-3'/>
                              </Button>
                            </div>
                          </div>) : (<div className='cursor-pointer rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700' onClick={() => onQuickEdit &&
                        startEditing(item.id, 'currentQuantity', currentQty)} title='Click to edit quantity'>
                            <p className='font-semibold text-gray-900 dark:text-white'>
                              {currentQty}
                            </p>
                            <p className='text-xs text-gray-600 dark:text-gray-400'>
                              {item.unit}
                            </p>
                          </div>)}
                      </div>
                    </TableCell>

                    <TableCell>
                      {editingState?.itemId === item.id &&
                    editingState?.field === 'costPerUnit' ? (<div className='flex items-center space-x-1'>
                          <div className='relative'>
                            <DollarSign className='absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-500'/>
                            <Input type='number' step='0.01' className='h-8 w-24 pl-7 text-right' value={editingState.value} onChange={e => handleEditingChange(e.target.value)} autoFocus/>
                          </div>
                          <div className='flex flex-col space-y-1'>
                            <Button variant='ghost' size='sm' className='h-4 w-4 p-0 text-green-600' onClick={saveEditing}>
                              <Check className='h-3 w-3'/>
                            </Button>
                            <Button variant='ghost' size='sm' className='h-4 w-4 p-0 text-red-600' onClick={cancelEditing}>
                              <X className='h-3 w-3'/>
                            </Button>
                          </div>
                        </div>) : (<div className='cursor-pointer rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700' onClick={() => onQuickEdit &&
                        startEditing(item.id, 'costPerUnit', item.costPerUnit)} title='Click to edit cost per unit'>
                          <div className='flex items-center space-x-1'>
                            <DollarSign className='h-3 w-3 text-gray-500'/>
                            <p className='font-medium text-gray-900 dark:text-white'>
                              {isNaN(item.costPerUnit)
                        ? '0.00'
                        : formatCurrency(item.costPerUnit)}
                            </p>
                          </div>
                          <p className='text-xs text-gray-600 dark:text-gray-400'>
                            per {item.unit}
                          </p>
                        </div>)}
                    </TableCell>

                    <TableCell>
                      <div className='flex items-center space-x-1'>
                        <DollarSign className='h-3 w-3 text-green-600'/>
                        <p className='font-bold text-green-600'>
                          {isNaN(totalValue)
                    ? '0.00'
                    : formatCurrency(totalValue)}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className='flex items-center space-x-1'>
                        <Button variant='ghost' size='sm' onClick={() => onEdit(item.id)} className='h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950' title='Edit item'>
                          <Edit className='h-3 w-3'/>
                        </Button>
                        {onDelete && (<Button variant='ghost' size='sm' onClick={() => {
                        if (window.confirm(`Are you sure you want to delete ${item.name}?`)) {
                            onDelete(item.id);
                        }
                    }} className='h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950' title='Delete item'>
                            <Trash2 className='h-3 w-3'/>
                          </Button>)}
                      </div>
                    </TableCell>
                  </TableRow>);
        })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <Pagination currentPage={currentPage} totalItems={items.length} pageSize={itemsPerPage} onPageChange={goToPage}/>
      </div>);
});
StockTableView.displayName = 'StockTableView';
export default StockTableView;
