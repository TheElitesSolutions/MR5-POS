'use client';

import React, { useState, memo } from 'react';
import { UIMenuItem } from '@/types/menu';
import { useMenuStore } from '@/stores/menuStore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Edit,
  Trash2,
  DollarSign,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
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
import { getCategoryColor } from '@/utils/categoryColors';

interface MenuItemCardProps {
  item: UIMenuItem;
  onEdit: (item: UIMenuItem) => void;
}

const MenuItemCard = ({ item, onEdit }: MenuItemCardProps) => {
  const { deleteMenuItem, toggleMenuItemAvailability } = useMenuStore();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggleAvailability = async () => {
    try {
      setIsToggling(true);
      await toggleMenuItemAvailability(item.id);
      toast({
        title: 'Availability Updated',
        description: `${item.name} is now ${
          item.isAvailable ? 'unavailable' : 'available'
        }`,
      });
    } catch (error) {
      console.error('Failed to toggle availability:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update item availability. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteMenuItem(item.id);
      toast({
        title: 'Menu Item Deleted',
        description: `${item.name} has been removed from the menu`,
      });
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      toast({
        title: 'Deletion Failed',
        description: 'Failed to delete menu item. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = () => {
    onEdit(item);
    toast({
      title: 'Edit Mode',
      description: `Editing ${item.name}`,
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  // Using the shared utility for consistent category colors across the application
  const itemColor = (item as any).color;

  return (
    <Card
      className={cn(
        'transition-shadow hover:shadow-md overflow-hidden bg-white dark:bg-gray-800',
        !item.isAvailable && 'opacity-75'
      )}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between'>
          <div className='flex-1'>
            <div className='flex items-center gap-2 mb-2'>
              {itemColor && (
                <div
                  className='h-3 w-3 rounded-full flex-shrink-0'
                  style={{ backgroundColor: itemColor }}
                  title='Item color'
                />
              )}
              <CardTitle className='text-lg font-semibold text-gray-900 dark:text-white'>
                {item.name}
              </CardTitle>
            </div>
            <Badge
              variant='outline'
              className={cn(
                'text-xs',
                getCategoryColor(item.category)
              )}
            >
              {item.category}
            </Badge>
          </div>
          <div className='flex items-center space-x-2'>
            <Button
              variant='ghost'
              size='sm'
              onClick={handleToggleAvailability}
              disabled={isToggling}
              className={item.isAvailable ? 'text-green-600' : 'text-gray-400'}
            >
              {item.isAvailable ? (
                <Eye className='h-4 w-4' />
              ) : (
                <EyeOff className='h-4 w-4' />
              )}
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={handleEdit}
              className='text-blue-600'
            >
              <Edit className='h-4 w-4' />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant='ghost' size='sm' className='text-red-600'>
                  <Trash2 className='h-4 w-4' />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className='flex items-center space-x-2'>
                    <AlertTriangle className='h-5 w-5 text-red-600' />
                    <span>Delete Menu Item</span>
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;{item.name}&quot;?
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className='bg-red-600 hover:bg-red-700'
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className='mb-4 line-clamp-3 text-sm text-gray-600 dark:text-gray-400'>
          {item.description}
        </p>

        <div className='flex items-center justify-between'>
          <div className='flex items-center'>
            <div className='flex items-center text-green-600'>
              {/* Remove the DollarSign icon since formatPrice() already includes the $ symbol */}
              <span className='font-semibold'>{formatPrice(item.price)}</span>
            </div>
          </div>

          <div className='flex items-center space-x-2'>
            <Badge
              variant={item.isAvailable ? 'default' : 'secondary'}
              className={
                item.isAvailable
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }
            >
              {item.isAvailable ? 'Available' : 'Unavailable'}
            </Badge>
            {!item.isAvailable && (
              <Badge variant='destructive' className='text-xs'>
                Inactive
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default memo(MenuItemCard);
