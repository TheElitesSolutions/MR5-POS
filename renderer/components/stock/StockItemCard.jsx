'use client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { useStockStore } from '@/stores/stockStore';
import { AlertTriangle, DollarSign, Edit, Minus, Package, Plus, TrendingDown, TrendingUp, } from 'lucide-react';
import { memo, useState } from 'react';
const StockItemCard = ({ item, onEdit, showLowStockWarning, }) => {
    const { adjustStockQuantity } = useStockStore();
    const [showAdjustDialog, setShowAdjustDialog] = useState(false);
    const [adjustmentQuantity, setAdjustmentQuantity] = useState(0);
    const [adjustmentType, setAdjustmentType] = useState('PURCHASE');
    const [isAdjusting, setIsAdjusting] = useState(false);
    const handleQuickAdjust = async (amount, type) => {
        try {
            setIsAdjusting(true);
            await adjustStockQuantity(item.id, {
                quantity: amount,
                type,
            });
        }
        catch (error) {
            console.error('Failed to adjust stock:', error);
        }
        finally {
            setIsAdjusting(false);
        }
    };
    const handleAdjustmentSubmit = async () => {
        if (adjustmentQuantity === 0)
            return;
        try {
            setIsAdjusting(true);
            await adjustStockQuantity(item.id, {
                quantity: adjustmentQuantity,
                type: adjustmentType,
            });
            setShowAdjustDialog(false);
            setAdjustmentQuantity(0);
        }
        catch (error) {
            console.error('Failed to adjust stock:', error);
        }
        finally {
            setIsAdjusting(false);
        }
    };
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(value);
    };
    const getStockLevel = () => {
        const currentQty = item.currentQuantity ?? item.currentStock ?? 0;
        const minQty = item.minimumQuantity ?? item.minimumStock ?? 0;
        if (currentQty <= minQty) {
            return 'low';
        }
        else if (currentQty <= minQty * 2) {
            return 'medium';
        }
        return 'high';
    };
    const stockLevel = getStockLevel();
    const currentQty = item.currentQuantity ?? item.currentStock ?? 0;
    const minQty = item.minimumQuantity ?? item.minimumStock ?? 0;
    const stockPercentage = Math.min((currentQty / (minQty * 3)) * 100, 100);
    const totalValue = currentQty * item.costPerUnit;
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
    const getStockLevelColor = () => {
        switch (stockLevel) {
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
    const getStockTrendIcon = () => {
        if (stockLevel === 'low') {
            return <TrendingDown className='h-3 w-3 text-red-500'/>;
        }
        else if (stockLevel === 'high') {
            return <TrendingUp className='h-3 w-3 text-green-500'/>;
        }
        return null;
    };
    return (<>
      <Card className={`border transition-shadow hover:shadow-md ${showLowStockWarning ? 'border-red-200 bg-red-50' : ''}`}>
        <CardHeader className='pb-2'>
          <div className='flex items-start justify-between'>
            <div className='min-w-0 flex-1'>
              <CardTitle className='mb-1 flex items-center space-x-1 truncate text-sm font-semibold text-gray-900 dark:text-white'>
                <Package className='h-3 w-3 flex-shrink-0'/>
                <span className='truncate'>{item.name}</span>
                {getStockTrendIcon()}
              </CardTitle>
              <div className='mb-1 flex items-center space-x-1'>
                <Badge variant='outline' className={`px-1 py-0 text-xs ${getCategoryColor(item.category || 'Other')}`}>
                  {item.category || 'Other'}
                </Badge>
                <Badge variant='outline' className='px-1 py-0 text-xs'>
                  {item.unit}
                </Badge>
              </div>
            </div>
            <Button variant='ghost' size='sm' onClick={onEdit} className='h-6 w-6 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950'>
              <Edit className='h-3 w-3'/>
            </Button>
          </div>
        </CardHeader>

        <CardContent className='pt-0'>
          {/* Stock Level Warning - Compact */}
          {stockLevel === 'low' && (<div className='mb-2 rounded border border-red-200 bg-red-50 p-2 dark:border-red-800 dark:bg-red-950/30'>
              <div className='flex items-center space-x-1'>
                <AlertTriangle className='h-3 w-3 text-red-600'/>
                <span className='text-xs font-medium text-red-800 dark:text-red-400'>
                  Low Stock
                </span>
              </div>
            </div>)}

          {/* Current Quantity - Compact */}
          <div className='mb-3 space-y-2'>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-medium text-gray-600 dark:text-gray-400'>
                Current Stock
              </span>
              <span className='text-sm font-bold text-gray-900 dark:text-white'>
                {currentQty} {item.unit}
              </span>
            </div>

            <div className='space-y-1'>
              <Progress value={stockPercentage} className='h-1.5' style={{
            '--progress-background': getStockLevelColor(),
        }}/>
              <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
                <span>Min: {minQty}</span>
                <span className={`font-medium ${stockLevel === 'low'
            ? 'text-red-600'
            : stockLevel === 'medium'
                ? 'text-yellow-600'
                : 'text-green-600'}`}>
                  {stockLevel.charAt(0).toUpperCase() + stockLevel.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Adjust Controls */}
          <div className='mb-3 space-y-2 rounded bg-gray-50 p-2 dark:bg-gray-800'>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-medium text-gray-600 dark:text-gray-400'>
                Quick Adjust
              </span>
              <div className='flex items-center space-x-1'>
                <Button variant='outline' size='sm' onClick={() => handleQuickAdjust(-1, 'ADJUSTMENT')} disabled={isAdjusting || currentQty <= 0} className='h-6 w-6 p-0'>
                  <Minus className='h-3 w-3'/>
                </Button>
                <Button variant='outline' size='sm' onClick={() => handleQuickAdjust(1, 'PURCHASE')} disabled={isAdjusting} className='h-6 w-6 p-0'>
                  <Plus className='h-3 w-3'/>
                </Button>
                <Button variant='outline' size='sm' onClick={() => setShowAdjustDialog(true)} disabled={isAdjusting} className='h-6 px-2 text-xs'>
                  Adjust
                </Button>
              </div>
            </div>
          </div>

          {/* Financial Info - Compact */}
          <div className='space-y-1 border-t border-gray-100 pt-2 dark:border-gray-700'>
            <div className='flex items-center justify-between'>
              <span className='text-xs text-gray-600 dark:text-gray-400'>
                Cost per {item.unit}
              </span>
              <span className='text-xs font-medium text-gray-900 dark:text-white'>
                {formatCurrency(item.costPerUnit)}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400'>
                <DollarSign className='h-2 w-2'/>
                <span>Total Value</span>
              </span>
              <span className='text-xs font-bold text-green-600'>
                {formatCurrency(totalValue)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock Adjustment Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock - {item.name}</DialogTitle>
            <DialogDescription>
              Current quantity: {currentQty} {item.unit}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div>
              <Label htmlFor='quantity'>Adjustment Quantity</Label>
              <Input id='quantity' type='text' value={adjustmentQuantity} onChange={e => {
            const value = e.target.value.replace(/[^0-9.-]/g, '');
            setAdjustmentQuantity(Number(value) || 0);
        }} placeholder='Enter quantity (positive to add, negative to subtract)'/>
            </div>

            <div>
              <Label htmlFor='type'>Adjustment Type</Label>
              <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='PURCHASE'>Purchase</SelectItem>
                  <SelectItem value='ADJUSTMENT'>Manual Adjustment</SelectItem>
                  <SelectItem value='WASTE'>Waste/Loss</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => {
            setShowAdjustDialog(false);
            setAdjustmentQuantity(0);
        }}>
              Cancel
            </Button>
            <Button onClick={handleAdjustmentSubmit} disabled={isAdjusting || adjustmentQuantity === 0}>
              {isAdjusting ? 'Adjusting...' : 'Adjust Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);
};
export default memo(StockItemCard);
