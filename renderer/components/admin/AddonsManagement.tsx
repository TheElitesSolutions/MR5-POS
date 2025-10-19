'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Tag,
  Package,
  DollarSign,
  TrendingUp,
  Eye,
  EyeOff,
  ArrowUpDown,
  RefreshCw,
  Download,
  Upload,
  Warehouse,
  AlertCircle,
  Copy,
  ShoppingCart,
} from 'lucide-react';

// Import our modals
import { AddonFormModal } from './AddonFormModal';
import { AddonDeleteModal } from './AddonDeleteModal';
import { AddonBulkImportModal } from './AddonBulkImportModal';

interface AddonInventoryItem {
  inventoryId: string;
  quantity: number;
}

interface Addon {
  id: string;
  name: string;
  description: string | null;
  price: number;
  addonGroupId: string;
  inventoryItems?: AddonInventoryItem[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  addonGroup: {
    id: string;
    name: string;
    isActive: boolean;
  };
  _count?: {
    orderItemAddons: number;
  };
}

interface AddonGroup {
  id: string;
  name: string;
  isActive: boolean;
}

interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  costPerUnit: number;
  isActive: boolean;
}

type SortField =
  | 'name'
  | 'price'
  | 'sortOrder'
  | 'createdAt'
  | 'stock'
  | 'usage';
type SortDirection = 'asc' | 'desc';
type FilterStatus = 'all' | 'active' | 'inactive';
type FilterGroup = 'all' | string; // group ID
type FilterStock = 'all' | 'linked' | 'unlinked' | 'low' | 'out';

export function AddonsManagement() {
  // State
  const [addons, setAddons] = useState<Addon[]>([]);
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterGroup, setFilterGroup] = useState<FilterGroup>('all');
  const [filterStock, setFilterStock] = useState<FilterStock>('all');
  const [sortField, setSortField] = useState<SortField>('sortOrder');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [selectedAddon, setSelectedAddon] = useState<Addon | null>(null);

  const { toast } = useToast();

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Mock data for development - in production these would be API calls
      const mockGroups: AddonGroup[] = [
        { id: 'group-1', name: 'Drink Sizes', isActive: true },
        { id: 'group-2', name: 'Pizza Toppings', isActive: true },
        { id: 'group-3', name: 'Dessert Extras', isActive: false },
      ];

      const mockInventory: InventoryItem[] = [
        {
          id: 'inv-1',
          name: 'Mozzarella Cheese',
          currentStock: 50,
          costPerUnit: 2.5,
          isActive: true,
        },
        {
          id: 'inv-2',
          name: 'Pepperoni Slices',
          currentStock: 30,
          costPerUnit: 3.0,
          isActive: true,
        },
        { 
          id: 'inv-3', 
          name: 'Mushrooms', 
          currentStock: 0, 
          costPerUnit: 1.5,
          isActive: true 
        },
        { 
          id: 'inv-4', 
          name: 'Bell Peppers', 
          currentStock: 15, 
          costPerUnit: 1.75,
          isActive: true 
        },
      ];

      const mockAddons: Addon[] = [
        {
          id: 'addon-1',
          name: 'Extra Cheese',
          description: 'Additional mozzarella cheese',
          price: 2.5,
          addonGroupId: 'group-2',
          inventoryItems: [{ inventoryId: 'inv-1', quantity: 1 }],
          isActive: true,
          sortOrder: 1,
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
          addonGroup: { id: 'group-2', name: 'Pizza Toppings', isActive: true },
          _count: { orderItemAddons: 45 },
        },
        {
          id: 'addon-2',
          name: 'Pepperoni',
          description: 'Premium pepperoni slices',
          price: 3.0,
          addonGroupId: 'group-2',
          inventoryItems: [{ inventoryId: 'inv-2', quantity: 0.5 }],
          isActive: true,
          sortOrder: 2,
          createdAt: '2024-01-10T14:30:00Z',
          updatedAt: '2024-01-20T16:45:00Z',
          addonGroup: { id: 'group-2', name: 'Pizza Toppings', isActive: true },
          _count: { orderItemAddons: 67 },
        },
        {
          id: 'addon-3',
          name: 'Large Size',
          description: 'Upgrade to large size',
          price: 1.5,
          addonGroupId: 'group-1',
          inventoryItems: [],
          isActive: true,
          sortOrder: 1,
          createdAt: '2024-01-05T09:15:00Z',
          updatedAt: '2024-01-25T11:20:00Z',
          addonGroup: { id: 'group-1', name: 'Drink Sizes', isActive: true },
          _count: { orderItemAddons: 89 },
        },
        {
          id: 'addon-4',
          name: 'Mushrooms',
          description: 'Fresh sliced mushrooms',
          price: 2.0,
          addonGroupId: 'group-2',
          inventoryItems: [{ inventoryId: 'inv-3', quantity: 0.25 }],
          isActive: false,
          sortOrder: 3,
          createdAt: '2024-01-08T12:00:00Z',
          updatedAt: '2024-01-28T14:30:00Z',
          addonGroup: { id: 'group-2', name: 'Pizza Toppings', isActive: true },
          _count: { orderItemAddons: 12 },
        },
      ];

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setAddonGroups(mockGroups);
      setInventoryItems(mockInventory);
      setAddons(mockAddons);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load addon data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort addons
  const filteredAndSortedAddons = useMemo(() => {
    let filtered = addons.filter(addon => {
      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        addon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (addon.description &&
          addon.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase())) ||
        addon.addonGroup.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && addon.isActive) ||
        (filterStatus === 'inactive' && !addon.isActive);

      // Group filter
      const matchesGroup =
        filterGroup === 'all' || addon.addonGroupId === filterGroup;

      // Stock filter
      const matchesStock =
        filterStock === 'all' ||
        (filterStock === 'linked' && addon.inventoryId !== null) ||
        (filterStock === 'unlinked' && addon.inventoryId === null) ||
        (filterStock === 'low' &&
          addon.inventory &&
          addon.inventory.currentStock > 0 &&
          addon.inventory.currentStock <= 10) ||
        (filterStock === 'out' &&
          addon.inventory &&
          addon.inventory.currentStock === 0);

      return matchesSearch && matchesStatus && matchesGroup && matchesStock;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'sortOrder':
          aValue = a.sortOrder;
          bValue = b.sortOrder;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'stock':
          aValue = a.inventory?.currentStock || 0;
          bValue = b.inventory?.currentStock || 0;
          break;
        case 'usage':
          aValue = a._count?.orderItemAddons || 0;
          bValue = b._count?.orderItemAddons || 0;
          break;
        default:
          aValue = a[sortField];
          bValue = b[sortField];
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [
    addons,
    searchQuery,
    filterStatus,
    filterGroup,
    filterStock,
    sortField,
    sortDirection,
  ]);

  // Handle CRUD operations
  const handleCreateAddon = async (data: any) => {
    try {
      const addonGroup = addonGroups.find(g => g.id === data.addonGroupId);
      const inventory = data.inventoryId
        ? inventoryItems.find(i => i.id === data.inventoryId)
        : undefined;

      const newAddon: Addon = {
        id: `addon-${Date.now()}`,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        addonGroup: addonGroup!,
        inventory,
        _count: { orderItemAddons: 0 },
      };

      setAddons(prev => [...prev, newAddon]);
      setIsCreateModalOpen(false);

      toast({
        title: 'Success',
        description: 'Add-on created successfully',
      });
    } catch (error) {
      console.error('Error creating addon:', error);
      toast({
        title: 'Error',
        description: 'Failed to create add-on',
        variant: 'destructive',
      });
    }
  };

  const handleEditAddon = async (data: any) => {
    if (!selectedAddon) return;

    try {
      const addonGroup = addonGroups.find(g => g.id === data.addonGroupId);
      const inventory = data.inventoryId
        ? inventoryItems.find(i => i.id === data.inventoryId)
        : undefined;

      const updatedAddon: Addon = {
        ...selectedAddon,
        ...data,
        updatedAt: new Date().toISOString(),
        addonGroup: addonGroup!,
        inventory,
      };

      setAddons(prev =>
        prev.map(addon =>
          addon.id === selectedAddon.id ? updatedAddon : addon
        )
      );
      setIsEditModalOpen(false);
      setSelectedAddon(null);

      toast({
        title: 'Success',
        description: 'Add-on updated successfully',
      });
    } catch (error) {
      console.error('Error updating addon:', error);
      toast({
        title: 'Error',
        description: 'Failed to update add-on',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAddon = async (addonId: string) => {
    try {
      setAddons(prev => prev.filter(addon => addon.id !== addonId));
      setIsDeleteModalOpen(false);
      setSelectedAddon(null);

      toast({
        title: 'Success',
        description: 'Add-on deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting addon:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete add-on',
        variant: 'destructive',
      });
    }
  };

  const handleBulkImport = async (items: any[]) => {
    try {
      const newAddons: Addon[] = items.map((item, index) => {
        const addonGroup = addonGroups.find(
          g => g.name === item.addonGroupName
        )!;

        return {
          id: `addon-${Date.now()}-${index}`,
          name: item.name,
          description: item.description || null,
          price: item.price,
          addonGroupId: addonGroup.id,
          inventoryId: null,
          isActive: item.isActive ?? true,
          sortOrder: item.sortOrder || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          addonGroup,
          _count: { orderItemAddons: 0 },
        };
      });

      setAddons(prev => [...prev, ...newAddons]);
      setIsBulkImportModalOpen(false);
    } catch (error) {
      console.error('Error bulk importing addons:', error);
      throw error;
    }
  };

  const handleToggleActive = async (addon: Addon) => {
    try {
      const updatedAddon = {
        ...addon,
        isActive: !addon.isActive,
        updatedAt: new Date().toISOString(),
      };

      setAddons(prev => prev.map(a => (a.id === addon.id ? updatedAddon : a)));

      toast({
        title: 'Success',
        description: `Add-on ${updatedAddon.isActive ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      console.error('Error toggling addon:', error);
      toast({
        title: 'Error',
        description: 'Failed to update add-on status',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicateAddon = async (addon: Addon) => {
    try {
      const newAddon: Addon = {
        ...addon,
        id: `addon-${Date.now()}`,
        name: `${addon.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: { orderItemAddons: 0 },
      };

      setAddons(prev => [...prev, newAddon]);

      toast({
        title: 'Success',
        description: 'Add-on duplicated successfully',
      });
    } catch (error) {
      console.error('Error duplicating addon:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate add-on',
        variant: 'destructive',
      });
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalAddons = addons.length;
    const activeAddons = addons.filter(a => a.isActive).length;
    const totalRevenue = addons.reduce(
      (sum, a) => sum + a.price * (a._count?.orderItemAddons || 0),
      0
    );
    const linkedToInventory = addons.filter(a => a.inventoryId !== null).length;
    const outOfStock = addons.filter(
      a => a.inventory && a.inventory.currentStock === 0
    ).length;

    return {
      totalAddons,
      activeAddons,
      totalRevenue,
      linkedToInventory,
      outOfStock,
    };
  }, [addons]);

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
        <div>
          <h1 className='text-2xl font-bold'>Individual Add-ons</h1>
          <p className='text-muted-foreground'>
            Manage individual add-on items and their inventory linkage
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' onClick={loadData} disabled={isLoading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            variant='outline'
            onClick={() => setIsBulkImportModalOpen(true)}
          >
            <Upload className='mr-2 h-4 w-4' />
            Bulk Import
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className='mr-2 h-4 w-4' />
            Create Add-on
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Add-ons</CardTitle>
            <Tag className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.totalAddons}</div>
            <p className='text-xs text-muted-foreground'>
              {stats.activeAddons} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Revenue Generated
            </CardTitle>
            <DollarSign className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              ${stats.totalRevenue.toFixed(2)}
            </div>
            <p className='text-xs text-muted-foreground'>
              From add-on selections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Inventory Linked
            </CardTitle>
            <Warehouse className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.linkedToInventory}</div>
            <p className='text-xs text-muted-foreground'>Stock managed items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Out of Stock</CardTitle>
            <AlertCircle className='h-4 w-4 text-destructive' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-destructive'>
              {stats.outOfStock}
            </div>
            <p className='text-xs text-muted-foreground'>Need restocking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Groups</CardTitle>
            <Package className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {addonGroups.filter(g => g.isActive).length}
            </div>
            <p className='text-xs text-muted-foreground'>Active groups</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className='pt-6'>
          <div className='flex flex-col gap-4 sm:flex-row'>
            {/* Search */}
            <div className='flex-1'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  placeholder='Search add-ons...'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className='pl-9'
                />
              </div>
            </div>

            {/* Filters */}
            <div className='flex flex-wrap gap-2'>
              {/* Status Filter */}
              <Select
                value={filterStatus}
                onValueChange={(value: FilterStatus) => setFilterStatus(value)}
              >
                <SelectTrigger className='w-32'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Status</SelectItem>
                  <SelectItem value='active'>Active</SelectItem>
                  <SelectItem value='inactive'>Inactive</SelectItem>
                </SelectContent>
              </Select>

              {/* Group Filter */}
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger className='w-40'>
                  <SelectValue placeholder='All Groups' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Groups</SelectItem>
                  {addonGroups
                    .filter(group => group && group.id && group.id.trim() !== '')
                    .map(group => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {/* Stock Filter */}
              <Select
                value={filterStock}
                onValueChange={(value: FilterStock) => setFilterStock(value)}
              >
                <SelectTrigger className='w-32'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Stock</SelectItem>
                  <SelectItem value='linked'>Linked</SelectItem>
                  <SelectItem value='unlinked'>Unlinked</SelectItem>
                  <SelectItem value='low'>Low Stock</SelectItem>
                  <SelectItem value='out'>Out of Stock</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='icon'>
                    <ArrowUpDown className='h-4 w-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleSort('name')}>
                    Name{' '}
                    {sortField === 'name' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('price')}>
                    Price{' '}
                    {sortField === 'price' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('sortOrder')}>
                    Order{' '}
                    {sortField === 'sortOrder' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('usage')}>
                    Usage{' '}
                    {sortField === 'usage' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('stock')}>
                    Stock{' '}
                    {sortField === 'stock' &&
                      (sortDirection === 'asc' ? '↑' : '↓')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add-ons List */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Tag className='h-5 w-5' />
            Add-ons ({filteredAndSortedAddons.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center py-8'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
              <span className='ml-2 text-muted-foreground'>
                Loading add-ons...
              </span>
            </div>
          ) : filteredAndSortedAddons.length === 0 ? (
            <div className='py-8 text-center'>
              <Tag className='mx-auto mb-4 h-12 w-12 text-muted-foreground' />
              <h3 className='mb-2 text-lg font-medium'>No add-ons found</h3>
              <p className='mb-4 text-muted-foreground'>
                {searchQuery ||
                filterStatus !== 'all' ||
                filterGroup !== 'all' ||
                filterStock !== 'all'
                  ? 'No add-ons match your current filters'
                  : 'Get started by creating your first add-on'}
              </p>
              {!searchQuery &&
                filterStatus === 'all' &&
                filterGroup === 'all' &&
                filterStock === 'all' && (
                  <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className='mr-2 h-4 w-4' />
                    Create First Add-on
                  </Button>
                )}
            </div>
          ) : (
            <div className='space-y-4'>
              {filteredAndSortedAddons.map(addon => (
                <Card
                  key={addon.id}
                  className='transition-shadow hover:shadow-md'
                >
                  <CardContent className='pt-4'>
                    <div className='flex items-center justify-between'>
                      <div className='flex-1'>
                        <div className='mb-2 flex items-center gap-3'>
                          <h3 className='text-lg font-semibold'>
                            {addon.name}
                          </h3>
                          <Badge
                            variant={addon.isActive ? 'default' : 'secondary'}
                          >
                            {addon.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge
                            variant='outline'
                            className='flex items-center gap-1'
                          >
                            <DollarSign className='h-3 w-3' />
                            {addon.price.toFixed(2)}
                          </Badge>
                          <Badge variant='outline' className='text-xs'>
                            Order: {addon.sortOrder}
                          </Badge>
                        </div>

                        {addon.description && (
                          <p className='mb-3 text-sm text-muted-foreground'>
                            {addon.description}
                          </p>
                        )}

                        <div className='flex items-center gap-4 text-sm text-muted-foreground'>
                          <div className='flex items-center gap-1'>
                            <Package className='h-3 w-3' />
                            {addon.addonGroup.name}
                          </div>

                          {addon.inventory ? (
                            <div className='flex items-center gap-1'>
                              <Warehouse className='h-3 w-3' />
                              <span>{addon.inventory.name}</span>
                              <Badge
                                variant={
                                  addon.inventory.currentStock > 0
                                    ? 'default'
                                    : 'destructive'
                                }
                                className='text-xs'
                              >
                                {addon.inventory.currentStock} stock
                              </Badge>
                            </div>
                          ) : (
                            <div className='flex items-center gap-1'>
                              <Warehouse className='h-3 w-3' />
                              <span>No inventory tracking</span>
                            </div>
                          )}

                          <div className='flex items-center gap-1'>
                            <ShoppingCart className='h-3 w-3' />
                            {addon._count?.orderItemAddons || 0} orders
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='icon'>
                            <MoreHorizontal className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedAddon(addon);
                              setIsEditModalOpen(true);
                            }}
                          >
                            <Edit className='mr-2 h-4 w-4' />
                            Edit Add-on
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicateAddon(addon)}
                          >
                            <Copy className='mr-2 h-4 w-4' />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(addon)}
                          >
                            {addon.isActive ? (
                              <>
                                <EyeOff className='mr-2 h-4 w-4' />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Eye className='mr-2 h-4 w-4' />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedAddon(addon);
                              setIsDeleteModalOpen(true);
                            }}
                            className='text-destructive'
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            Delete Add-on
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AddonFormModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateAddon}
        title='Create Add-on'
        mode='create'
        addonGroups={addonGroups.filter(g => g.isActive)}
        inventoryItems={inventoryItems.filter(i => i.isActive)}
      />

      <AddonFormModal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedAddon(null);
        }}
        onSubmit={handleEditAddon}
        initialData={selectedAddon}
        title='Edit Add-on'
        mode='edit'
        addonGroups={addonGroups.filter(g => g.isActive)}
        inventoryItems={inventoryItems.filter(i => i.isActive)}
      />

      <AddonDeleteModal
        open={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedAddon(null);
        }}
        onConfirm={handleDeleteAddon}
        addon={selectedAddon}
      />

      <AddonBulkImportModal
        open={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        onImport={handleBulkImport}
        addonGroups={addonGroups.filter(g => g.isActive)}
      />
    </div>
  );
}
