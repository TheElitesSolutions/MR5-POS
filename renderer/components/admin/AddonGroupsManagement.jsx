'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, MoreHorizontal, Edit, Trash2, Package, Tag, ShoppingCart, Eye, EyeOff, ArrowUpDown, RefreshCw, } from 'lucide-react';
// Import our modals
import { AddonGroupFormModal } from './AddonGroupFormModal';
import { AddonGroupDeleteModal } from './AddonGroupDeleteModal';
export function AddonGroupsManagement() {
    // State
    const [addonGroups, setAddonGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortField, setSortField] = useState('sortOrder');
    const [sortDirection, setSortDirection] = useState('asc');
    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const { toast } = useToast();
    // Load addon groups on component mount
    useEffect(() => {
        loadAddonGroups();
    }, []);
    const loadAddonGroups = async () => {
        setIsLoading(true);
        try {
            // Mock data for development - in production this would be an API call
            const mockGroups = [
                {
                    id: 'group-1',
                    name: 'Drink Sizes',
                    description: 'Size options for beverages',
                    minSelections: 1,
                    maxSelections: 1,
                    isActive: true,
                    sortOrder: 0,
                    createdAt: '2024-01-15T10:00:00Z',
                    updatedAt: '2024-01-15T10:00:00Z',
                    _count: { addons: 3, categoryAddonGroups: 2 },
                },
                {
                    id: 'group-2',
                    name: 'Pizza Toppings',
                    description: 'Additional toppings for pizzas',
                    minSelections: 0,
                    maxSelections: 5,
                    isActive: true,
                    sortOrder: 1,
                    createdAt: '2024-01-10T14:30:00Z',
                    updatedAt: '2024-01-20T16:45:00Z',
                    _count: { addons: 12, categoryAddonGroups: 1 },
                },
                {
                    id: 'group-3',
                    name: 'Dessert Extras',
                    description: null,
                    minSelections: 0,
                    maxSelections: null,
                    isActive: false,
                    sortOrder: 2,
                    createdAt: '2024-01-05T09:15:00Z',
                    updatedAt: '2024-01-25T11:20:00Z',
                    _count: { addons: 5, categoryAddonGroups: 0 },
                },
            ];
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 500));
            setAddonGroups(mockGroups);
        }
        catch (error) {
            console.error('Error loading addon groups:', error);
            toast({
                title: 'Error',
                description: 'Failed to load add-on groups',
                variant: 'destructive',
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    // Filter and sort addon groups
    const filteredAndSortedGroups = useMemo(() => {
        let filtered = addonGroups.filter(group => {
            // Search filter
            const matchesSearch = searchQuery === '' ||
                group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (group.description &&
                    group.description.toLowerCase().includes(searchQuery.toLowerCase()));
            // Status filter
            const matchesStatus = filterStatus === 'all' ||
                (filterStatus === 'active' && group.isActive) ||
                (filterStatus === 'inactive' && !group.isActive);
            return matchesSearch && matchesStatus;
        });
        // Sort
        filtered.sort((a, b) => {
            let aValue = a[sortField === 'addonsCount' ? '_count' : sortField];
            let bValue = b[sortField === 'addonsCount' ? '_count' : sortField];
            if (sortField === 'addonsCount') {
                aValue = a._count.addons;
                bValue = b._count.addons;
            }
            else if (sortField === 'categoriesCount') {
                aValue = a._count.categoryAddonGroups;
                bValue = b._count.categoryAddonGroups;
            }
            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }
            if (sortDirection === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            }
            else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });
        return filtered;
    }, [addonGroups, searchQuery, filterStatus, sortField, sortDirection]);
    // Handle CRUD operations
    const handleCreateGroup = async (data) => {
        try {
            // Mock API call - in production this would call the backend
            const newGroup = {
                id: `group-${Date.now()}`,
                ...data,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                _count: { addons: 0, categoryAddonGroups: 0 },
            };
            setAddonGroups(prev => [...prev, newGroup]);
            setIsCreateModalOpen(false);
            toast({
                title: 'Success',
                description: 'Add-on group created successfully',
            });
        }
        catch (error) {
            console.error('Error creating addon group:', error);
            toast({
                title: 'Error',
                description: 'Failed to create add-on group',
                variant: 'destructive',
            });
        }
    };
    const handleEditGroup = async (data) => {
        if (!selectedGroup)
            return;
        try {
            const updatedGroup = {
                ...selectedGroup,
                ...data,
                updatedAt: new Date().toISOString(),
            };
            setAddonGroups(prev => prev.map(group => group.id === selectedGroup.id ? updatedGroup : group));
            setIsEditModalOpen(false);
            setSelectedGroup(null);
            toast({
                title: 'Success',
                description: 'Add-on group updated successfully',
            });
        }
        catch (error) {
            console.error('Error updating addon group:', error);
            toast({
                title: 'Error',
                description: 'Failed to update add-on group',
                variant: 'destructive',
            });
        }
    };
    const handleDeleteGroup = async (groupId) => {
        try {
            setAddonGroups(prev => prev.filter(group => group.id !== groupId));
            setIsDeleteModalOpen(false);
            setSelectedGroup(null);
            toast({
                title: 'Success',
                description: 'Add-on group deleted successfully',
            });
        }
        catch (error) {
            console.error('Error deleting addon group:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete add-on group',
                variant: 'destructive',
            });
        }
    };
    const handleToggleActive = async (group) => {
        try {
            const updatedGroup = {
                ...group,
                isActive: !group.isActive,
                updatedAt: new Date().toISOString(),
            };
            setAddonGroups(prev => prev.map(g => (g.id === group.id ? updatedGroup : g)));
            toast({
                title: 'Success',
                description: `Add-on group ${updatedGroup.isActive ? 'activated' : 'deactivated'}`,
            });
        }
        catch (error) {
            console.error('Error toggling addon group:', error);
            toast({
                title: 'Error',
                description: 'Failed to update add-on group status',
                variant: 'destructive',
            });
        }
    };
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        }
        else {
            setSortField(field);
            setSortDirection('asc');
        }
    };
    return (<div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
        <div>
          <h1 className='text-2xl font-bold'>Add-On Groups</h1>
          <p className='text-muted-foreground'>
            Manage add-on groups and their configuration settings
          </p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={loadAddonGroups} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/>
            Refresh
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className='mr-2 h-4 w-4'/>
            Create Group
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Groups</CardTitle>
            <Package className='h-4 w-4 text-muted-foreground'/>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{addonGroups.length}</div>
            <p className='text-xs text-muted-foreground'>
              {addonGroups.filter(g => g.isActive).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Add-ons</CardTitle>
            <Tag className='h-4 w-4 text-muted-foreground'/>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {addonGroups.reduce((sum, g) => sum + g._count.addons, 0)}
            </div>
            <p className='text-xs text-muted-foreground'>Across all groups</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Category Assignments
            </CardTitle>
            <ShoppingCart className='h-4 w-4 text-muted-foreground'/>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {addonGroups.reduce((sum, g) => sum + g._count.categoryAddonGroups, 0)}
            </div>
            <p className='text-xs text-muted-foreground'>Total assignments</p>
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
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'/>
                <Input placeholder='Search add-on groups...' value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className='pl-9'/>
              </div>
            </div>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value)}>
              <SelectTrigger className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Status</SelectItem>
                <SelectItem value='active'>Active</SelectItem>
                <SelectItem value='inactive'>Inactive</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='icon'>
                  <ArrowUpDown className='h-4 w-4'/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => handleSort('name')}>
                  Sort by Name{' '}
                  {sortField === 'name' &&
            (sortDirection === 'asc' ? '↑' : '↓')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort('sortOrder')}>
                  Sort by Order{' '}
                  {sortField === 'sortOrder' &&
            (sortDirection === 'asc' ? '↑' : '↓')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort('addonsCount')}>
                  Sort by Add-ons{' '}
                  {sortField === 'addonsCount' &&
            (sortDirection === 'asc' ? '↑' : '↓')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSort('categoriesCount')}>
                  Sort by Categories{' '}
                  {sortField === 'categoriesCount' &&
            (sortDirection === 'asc' ? '↑' : '↓')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Groups List */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Package className='h-5 w-5'/>
            Add-On Groups ({filteredAndSortedGroups.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (<div className='flex items-center justify-center py-8'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground'/>
              <span className='ml-2 text-muted-foreground'>
                Loading add-on groups...
              </span>
            </div>) : filteredAndSortedGroups.length === 0 ? (<div className='py-8 text-center'>
              <Package className='mx-auto mb-4 h-12 w-12 text-muted-foreground'/>
              <h3 className='mb-2 text-lg font-medium'>
                No add-on groups found
              </h3>
              <p className='mb-4 text-muted-foreground'>
                {searchQuery || filterStatus !== 'all'
                ? 'No groups match your current filters'
                : 'Get started by creating your first add-on group'}
              </p>
              {!searchQuery && filterStatus === 'all' && (<Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className='mr-2 h-4 w-4'/>
                  Create First Group
                </Button>)}
            </div>) : (<div className='space-y-4'>
              {filteredAndSortedGroups.map(group => (<Card key={group.id} className='transition-shadow hover:shadow-md'>
                  <CardContent className='pt-4'>
                    <div className='flex items-center justify-between'>
                      <div className='flex-1'>
                        <div className='mb-2 flex items-center gap-3'>
                          <h3 className='text-lg font-semibold'>
                            {group.name}
                          </h3>
                          <Badge variant={group.isActive ? 'default' : 'secondary'}>
                            {group.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant='outline' className='text-xs'>
                            Order: {group.sortOrder}
                          </Badge>
                        </div>

                        {group.description && (<p className='mb-3 text-muted-foreground'>
                            {group.description}
                          </p>)}

                        <div className='flex items-center gap-4 text-sm text-muted-foreground'>
                          <div className='flex items-center gap-1'>
                            <Tag className='h-3 w-3'/>
                            {group._count.addons} add-on
                            {group._count.addons !== 1 ? 's' : ''}
                          </div>
                          <div className='flex items-center gap-1'>
                            <ShoppingCart className='h-3 w-3'/>
                            {group._count.categoryAddonGroups} categor
                            {group._count.categoryAddonGroups !== 1
                    ? 'ies'
                    : 'y'}
                          </div>
                          <div className='flex items-center gap-1'>
                            <span>Min: {group.minSelections}</span>
                            <span>
                              Max: {group.maxSelections || 'Unlimited'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='icon'>
                            <MoreHorizontal className='h-4 w-4'/>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem onClick={() => {
                    setSelectedGroup(group);
                    setIsEditModalOpen(true);
                }}>
                            <Edit className='mr-2 h-4 w-4'/>
                            Edit Group
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(group)}>
                            {group.isActive ? (<>
                                <EyeOff className='mr-2 h-4 w-4'/>
                                Deactivate
                              </>) : (<>
                                <Eye className='mr-2 h-4 w-4'/>
                                Activate
                              </>)}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                    setSelectedGroup(group);
                    setIsDeleteModalOpen(true);
                }} className='text-destructive'>
                            <Trash2 className='mr-2 h-4 w-4'/>
                            Delete Group
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>))}
            </div>)}
        </CardContent>
      </Card>

      {/* Modals */}
      <AddonGroupFormModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={handleCreateGroup} title='Create Add-On Group' mode='create'/>

      <AddonGroupFormModal open={isEditModalOpen} onClose={() => {
            setIsEditModalOpen(false);
            setSelectedGroup(null);
        }} onSubmit={handleEditGroup} initialData={selectedGroup} title='Edit Add-On Group' mode='edit'/>

      <AddonGroupDeleteModal open={isDeleteModalOpen} onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedGroup(null);
        }} onConfirm={handleDeleteGroup} group={selectedGroup}/>
    </div>);
}
