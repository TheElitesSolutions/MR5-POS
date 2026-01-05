'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel, } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, MoreHorizontal, Edit, Trash2, ShoppingCart, Tag, Eye, EyeOff, ArrowUpDown, RefreshCw, Link, AlertCircle, TrendingUp, Grid, List, } from 'lucide-react';
// Import our modals
import { CategoryAssignmentFormModal } from './CategoryAssignmentFormModal';
import { CategoryAssignmentDeleteModal } from './CategoryAssignmentDeleteModal';
export function CategoryAssignmentManagement() {
    // State
    const [assignments, setAssignments] = useState([]);
    const [categories, setCategories] = useState([]);
    const [addonGroups, setAddonGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterGroup, setFilterGroup] = useState('all');
    const [sortField, setSortField] = useState('sortOrder');
    const [sortDirection, setSortDirection] = useState('asc');
    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const { toast } = useToast();
    // Load data on component mount
    useEffect(() => {
        loadData();
    }, []);
    const loadData = async () => {
        setIsLoading(true);
        try {
            // Mock data for development - in production these would be API calls
            const mockCategories = [
                {
                    id: 'cat-1',
                    name: 'Pizza',
                    description: 'Traditional and specialty pizzas',
                    isActive: true,
                    _count: { items: 12, categoryAddonGroups: 2 },
                },
                {
                    id: 'cat-2',
                    name: 'Beverages',
                    description: 'Drinks and refreshments',
                    isActive: true,
                    _count: { items: 8, categoryAddonGroups: 1 },
                },
                {
                    id: 'cat-3',
                    name: 'Desserts',
                    description: 'Sweet treats and desserts',
                    isActive: false,
                    _count: { items: 5, categoryAddonGroups: 0 },
                },
                {
                    id: 'cat-4',
                    name: 'Appetizers',
                    description: 'Starters and small plates',
                    isActive: true,
                    _count: { items: 6, categoryAddonGroups: 1 },
                },
            ];
            const mockAddonGroups = [
                {
                    id: 'group-1',
                    name: 'Pizza Toppings',
                    description: 'Additional toppings for pizzas',
                    minSelections: 0,
                    maxSelections: 5,
                    isActive: true,
                    _count: { addons: 12, categoryAddonGroups: 1 },
                },
                {
                    id: 'group-2',
                    name: 'Drink Sizes',
                    description: 'Size options for beverages',
                    minSelections: 1,
                    maxSelections: 1,
                    isActive: true,
                    _count: { addons: 3, categoryAddonGroups: 1 },
                },
                {
                    id: 'group-3',
                    name: 'Crust Options',
                    description: 'Different crust types',
                    minSelections: 1,
                    maxSelections: 1,
                    isActive: true,
                    _count: { addons: 4, categoryAddonGroups: 1 },
                },
                {
                    id: 'group-4',
                    name: 'Sauce Extras',
                    description: 'Additional sauces and dips',
                    minSelections: 0,
                    maxSelections: 3,
                    isActive: true,
                    _count: { addons: 6, categoryAddonGroups: 1 },
                },
            ];
            const mockAssignments = [
                {
                    id: 'assign-1',
                    categoryId: 'cat-1',
                    addonGroupId: 'group-1',
                    isActive: true,
                    sortOrder: 1,
                    createdAt: '2024-01-15T10:00:00Z',
                    updatedAt: '2024-01-15T10:00:00Z',
                    category: mockCategories.find(c => c.id === 'cat-1'),
                    addonGroup: mockAddonGroups.find(g => g.id === 'group-1'),
                },
                {
                    id: 'assign-2',
                    categoryId: 'cat-1',
                    addonGroupId: 'group-3',
                    isActive: true,
                    sortOrder: 2,
                    createdAt: '2024-01-10T14:30:00Z',
                    updatedAt: '2024-01-20T16:45:00Z',
                    category: mockCategories.find(c => c.id === 'cat-1'),
                    addonGroup: mockAddonGroups.find(g => g.id === 'group-3'),
                },
                {
                    id: 'assign-3',
                    categoryId: 'cat-2',
                    addonGroupId: 'group-2',
                    isActive: true,
                    sortOrder: 1,
                    createdAt: '2024-01-05T09:15:00Z',
                    updatedAt: '2024-01-25T11:20:00Z',
                    category: mockCategories.find(c => c.id === 'cat-2'),
                    addonGroup: mockAddonGroups.find(g => g.id === 'group-2'),
                },
                {
                    id: 'assign-4',
                    categoryId: 'cat-4',
                    addonGroupId: 'group-4',
                    isActive: false,
                    sortOrder: 1,
                    createdAt: '2024-01-08T12:00:00Z',
                    updatedAt: '2024-01-28T14:30:00Z',
                    category: mockCategories.find(c => c.id === 'cat-4'),
                    addonGroup: mockAddonGroups.find(g => g.id === 'group-4'),
                },
            ];
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 500));
            setCategories(mockCategories);
            setAddonGroups(mockAddonGroups);
            setAssignments(mockAssignments);
        }
        catch (error) {
            console.error('Error loading data:', error);
            toast({
                title: 'Error',
                description: 'Failed to load assignment data',
                variant: 'destructive',
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    // Filter and sort assignments
    const filteredAndSortedAssignments = useMemo(() => {
        let filtered = assignments.filter(assignment => {
            // Search filter
            const matchesSearch = searchQuery === '' ||
                assignment.category.name
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                assignment.addonGroup.name
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                (assignment.category.description &&
                    assignment.category.description
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())) ||
                (assignment.addonGroup.description &&
                    assignment.addonGroup.description
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()));
            // Status filter
            const matchesStatus = filterStatus === 'all' ||
                (filterStatus === 'active' && assignment.isActive) ||
                (filterStatus === 'inactive' && !assignment.isActive);
            // Category filter
            const matchesCategory = filterCategory === 'all' || assignment.categoryId === filterCategory;
            // Group filter
            const matchesGroup = filterGroup === 'all' || assignment.addonGroupId === filterGroup;
            return matchesSearch && matchesStatus && matchesCategory && matchesGroup;
        });
        // Sort
        filtered.sort((a, b) => {
            let aValue;
            let bValue;
            switch (sortField) {
                case 'category':
                    aValue = a.category.name.toLowerCase();
                    bValue = b.category.name.toLowerCase();
                    break;
                case 'group':
                    aValue = a.addonGroup.name.toLowerCase();
                    bValue = b.addonGroup.name.toLowerCase();
                    break;
                case 'createdAt':
                    aValue = new Date(a.createdAt).getTime();
                    bValue = new Date(b.createdAt).getTime();
                    break;
                case 'sortOrder':
                    aValue = a.sortOrder;
                    bValue = b.sortOrder;
                    break;
                default:
                    aValue = a[sortField];
                    bValue = b[sortField];
            }
            if (sortDirection === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            }
            else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });
        return filtered;
    }, [
        assignments,
        searchQuery,
        filterStatus,
        filterCategory,
        filterGroup,
        sortField,
        sortDirection,
    ]);
    // Group assignments by category for grid view
    const assignmentsByCategory = useMemo(() => {
        const grouped = new Map();
        filteredAndSortedAssignments.forEach(assignment => {
            const categoryId = assignment.categoryId;
            if (!grouped.has(categoryId)) {
                grouped.set(categoryId, []);
            }
            grouped.get(categoryId).push(assignment);
        });
        return grouped;
    }, [filteredAndSortedAssignments]);
    // Handle CRUD operations
    const handleCreateAssignment = async (data) => {
        try {
            const category = categories.find(c => c.id === data.categoryId);
            const addonGroup = addonGroups.find(g => g.id === data.addonGroupId);
            const newAssignment = {
                id: `assign-${Date.now()}`,
                ...data,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                category,
                addonGroup,
            };
            setAssignments(prev => [...prev, newAssignment]);
            setIsCreateModalOpen(false);
            toast({
                title: 'Success',
                description: 'Category assignment created successfully',
            });
        }
        catch (error) {
            console.error('Error creating assignment:', error);
            toast({
                title: 'Error',
                description: 'Failed to create assignment',
                variant: 'destructive',
            });
        }
    };
    const handleEditAssignment = async (data) => {
        if (!selectedAssignment)
            return;
        try {
            const updatedAssignment = {
                ...selectedAssignment,
                ...data,
                updatedAt: new Date().toISOString(),
            };
            setAssignments(prev => prev.map(assignment => assignment.id === selectedAssignment.id
                ? updatedAssignment
                : assignment));
            setIsEditModalOpen(false);
            setSelectedAssignment(null);
            toast({
                title: 'Success',
                description: 'Assignment updated successfully',
            });
        }
        catch (error) {
            console.error('Error updating assignment:', error);
            toast({
                title: 'Error',
                description: 'Failed to update assignment',
                variant: 'destructive',
            });
        }
    };
    const handleDeleteAssignment = async (assignmentId) => {
        try {
            setAssignments(prev => prev.filter(assignment => assignment.id !== assignmentId));
            setIsDeleteModalOpen(false);
            setSelectedAssignment(null);
            toast({
                title: 'Success',
                description: 'Assignment removed successfully',
            });
        }
        catch (error) {
            console.error('Error deleting assignment:', error);
            toast({
                title: 'Error',
                description: 'Failed to remove assignment',
                variant: 'destructive',
            });
        }
    };
    const handleToggleActive = async (assignment) => {
        try {
            const updatedAssignment = {
                ...assignment,
                isActive: !assignment.isActive,
                updatedAt: new Date().toISOString(),
            };
            setAssignments(prev => prev.map(a => (a.id === assignment.id ? updatedAssignment : a)));
            toast({
                title: 'Success',
                description: `Assignment ${updatedAssignment.isActive ? 'activated' : 'deactivated'}`,
            });
        }
        catch (error) {
            console.error('Error toggling assignment:', error);
            toast({
                title: 'Error',
                description: 'Failed to update assignment status',
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
    // Calculate statistics
    const stats = useMemo(() => {
        const totalAssignments = assignments.length;
        const activeAssignments = assignments.filter(a => a.isActive).length;
        const categoriesWithAssignments = new Set(assignments.map(a => a.categoryId)).size;
        const groupsInUse = new Set(assignments.map(a => a.addonGroupId)).size;
        const requiredGroups = assignments.filter(a => a.addonGroup.minSelections > 0).length;
        return {
            totalAssignments,
            activeAssignments,
            categoriesWithAssignments,
            groupsInUse,
            requiredGroups,
        };
    }, [assignments]);
    return (<div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
        <div>
          <h1 className='text-2xl font-bold'>Category Assignment Interface</h1>
          <p className='text-muted-foreground'>
            Assign add-on groups to menu categories to control availability
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/>
            Refresh
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className='mr-2 h-4 w-4'/>
            Create Assignment
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Total Assignments
            </CardTitle>
            <Link className='h-4 w-4 text-muted-foreground'/>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.totalAssignments}</div>
            <p className='text-xs text-muted-foreground'>
              {stats.activeAssignments} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Categories Connected
            </CardTitle>
            <ShoppingCart className='h-4 w-4 text-muted-foreground'/>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {stats.categoriesWithAssignments}
            </div>
            <p className='text-xs text-muted-foreground'>
              Of {categories.length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Groups In Use</CardTitle>
            <Tag className='h-4 w-4 text-muted-foreground'/>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.groupsInUse}</div>
            <p className='text-xs text-muted-foreground'>
              Of {addonGroups.length} available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Required Groups
            </CardTitle>
            <AlertCircle className='h-4 w-4 text-orange-500'/>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-orange-600'>
              {stats.requiredGroups}
            </div>
            <p className='text-xs text-muted-foreground'>
              Mandatory selections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Coverage</CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground'/>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {Math.round((stats.categoriesWithAssignments / categories.length) * 100)}
              %
            </div>
            <p className='text-xs text-muted-foreground'>Categories assigned</p>
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
                <Input placeholder='Search assignments...' value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className='pl-9'/>
              </div>
            </div>

            {/* Filters */}
            <div className='flex flex-wrap gap-2'>
              {/* View Mode Toggle */}
              <div className='flex rounded-lg border'>
                <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size='sm' onClick={() => setViewMode('grid')} className='rounded-r-none'>
                  <Grid className='h-4 w-4'/>
                </Button>
                <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size='sm' onClick={() => setViewMode('list')} className='rounded-l-none'>
                  <List className='h-4 w-4'/>
                </Button>
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

              {/* Category Filter */}
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className='w-40'>
                  <SelectValue placeholder='All Categories'/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Categories</SelectItem>
                  {categories
            .filter(category => category && category.id && category.id.trim() !== '')
            .map(category => (<SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>))}
                </SelectContent>
              </Select>

              {/* Group Filter */}
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger className='w-40'>
                  <SelectValue placeholder='All Groups'/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Groups</SelectItem>
                  {addonGroups
            .filter(group => group && group.id && group.id.trim() !== '')
            .map(group => (<SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>))}
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
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleSort('category')}>
                    Category{' '}
                    {sortField === 'category' &&
            (sortDirection === 'asc' ? '↑' : '↓')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('group')}>
                    Group{' '}
                    {sortField === 'group' &&
            (sortDirection === 'asc' ? '↑' : '↓')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('sortOrder')}>
                    Order{' '}
                    {sortField === 'sortOrder' &&
            (sortDirection === 'asc' ? '↑' : '↓')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSort('createdAt')}>
                    Created{' '}
                    {sortField === 'createdAt' &&
            (sortDirection === 'asc' ? '↑' : '↓')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignments Display */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Link className='h-5 w-5'/>
            Category Assignments ({filteredAndSortedAssignments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (<div className='flex items-center justify-center py-8'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground'/>
              <span className='ml-2 text-muted-foreground'>
                Loading assignments...
              </span>
            </div>) : filteredAndSortedAssignments.length === 0 ? (<div className='py-8 text-center'>
              <Link className='mx-auto mb-4 h-12 w-12 text-muted-foreground'/>
              <h3 className='mb-2 text-lg font-medium'>No assignments found</h3>
              <p className='mb-4 text-muted-foreground'>
                {searchQuery ||
                filterStatus !== 'all' ||
                filterCategory !== 'all' ||
                filterGroup !== 'all'
                ? 'No assignments match your current filters'
                : 'Get started by creating your first category assignment'}
              </p>
              {!searchQuery &&
                filterStatus === 'all' &&
                filterCategory === 'all' &&
                filterGroup === 'all' && (<Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className='mr-2 h-4 w-4'/>
                    Create First Assignment
                  </Button>)}
            </div>) : (<div className='space-y-6'>
              {viewMode === 'grid' ? (
            // Grid View - Group by Category
            <div className='space-y-6'>
                  {Array.from(assignmentsByCategory.entries()).map(([categoryId, categoryAssignments]) => {
                    const category = categories.find(c => c.id === categoryId);
                    return (<Card key={categoryId} className='border-2'>
                          <CardHeader className='bg-muted/30'>
                            <div className='flex items-center justify-between'>
                              <div className='flex items-center gap-3'>
                                <ShoppingCart className='h-5 w-5 text-muted-foreground'/>
                                <div>
                                  <CardTitle className='text-lg'>
                                    {category.name}
                                  </CardTitle>
                                  {category.description && (<CardDescription>
                                      {category.description}
                                    </CardDescription>)}
                                </div>
                                <Badge variant={category.isActive ? 'default' : 'secondary'}>
                                  {category.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <div className='text-sm text-muted-foreground'>
                                {categoryAssignments.length} assignment
                                {categoryAssignments.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className='pt-4'>
                            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
                              {categoryAssignments.map(assignment => (<Card key={assignment.id} className='transition-shadow hover:shadow-md'>
                                  <CardContent className='pt-4'>
                                    <div className='space-y-3'>
                                      <div className='flex items-center justify-between'>
                                        <div className='flex items-center gap-2'>
                                          <Tag className='h-4 w-4 text-muted-foreground'/>
                                          <span className='font-medium'>
                                            {assignment.addonGroup.name}
                                          </span>
                                        </div>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant='ghost' size='icon'>
                                              <MoreHorizontal className='h-4 w-4'/>
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align='end'>
                                            <DropdownMenuItem onClick={() => {
                                setSelectedAssignment(assignment);
                                setIsEditModalOpen(true);
                            }}>
                                              <Edit className='mr-2 h-4 w-4'/>
                                              Edit Assignment
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleToggleActive(assignment)}>
                                              {assignment.isActive ? (<>
                                                  <EyeOff className='mr-2 h-4 w-4'/>
                                                  Deactivate
                                                </>) : (<>
                                                  <Eye className='mr-2 h-4 w-4'/>
                                                  Activate
                                                </>)}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => {
                                setSelectedAssignment(assignment);
                                setIsDeleteModalOpen(true);
                            }} className='text-destructive'>
                                              <Trash2 className='mr-2 h-4 w-4'/>
                                              Remove Assignment
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>

                                      {assignment.addonGroup.description && (<p className='text-sm text-muted-foreground'>
                                          {assignment.addonGroup.description}
                                        </p>)}

                                      <div className='flex items-center justify-between'>
                                        <div className='flex items-center gap-2'>
                                          <Badge variant={assignment.isActive
                                ? 'default'
                                : 'secondary'}>
                                            {assignment.isActive
                                ? 'Active'
                                : 'Inactive'}
                                          </Badge>
                                          {assignment.addonGroup.minSelections >
                                0 && (<Badge variant='outline' className='text-xs'>
                                              Required
                                            </Badge>)}
                                        </div>
                                        <Badge variant='outline' className='text-xs'>
                                          Order: {assignment.sortOrder}
                                        </Badge>
                                      </div>

                                      <div className='text-xs text-muted-foreground'>
                                        {assignment.addonGroup._count.addons}{' '}
                                        add-ons • Min:{' '}
                                        {assignment.addonGroup.minSelections} •
                                        Max:{' '}
                                        {assignment.addonGroup.maxSelections ||
                                'Unlimited'}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>))}
                            </div>
                          </CardContent>
                        </Card>);
                })}
                </div>) : (
            // List View
            <div className='space-y-4'>
                  {filteredAndSortedAssignments.map(assignment => (<Card key={assignment.id} className='transition-shadow hover:shadow-md'>
                      <CardContent className='pt-4'>
                        <div className='flex items-center justify-between'>
                          <div className='flex-1 space-y-3'>
                            <div className='flex items-center gap-4'>
                              <div className='flex items-center gap-2'>
                                <ShoppingCart className='h-4 w-4 text-blue-500'/>
                                <span className='font-medium text-blue-600'>
                                  {assignment.category.name}
                                </span>
                              </div>
                              <div className='text-muted-foreground'>→</div>
                              <div className='flex items-center gap-2'>
                                <Tag className='h-4 w-4 text-green-500'/>
                                <span className='font-medium text-green-600'>
                                  {assignment.addonGroup.name}
                                </span>
                              </div>
                            </div>

                            <div className='flex items-center gap-4 text-sm text-muted-foreground'>
                              <div className='flex items-center gap-2'>
                                <Badge variant={assignment.isActive
                        ? 'default'
                        : 'secondary'}>
                                  {assignment.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                                {assignment.addonGroup.minSelections > 0 && (<Badge variant='outline' className='text-xs'>
                                    Required:{' '}
                                    {assignment.addonGroup.minSelections}
                                  </Badge>)}
                                <Badge variant='outline' className='text-xs'>
                                  Order: {assignment.sortOrder}
                                </Badge>
                              </div>
                              <div>
                                {assignment.addonGroup._count.addons} add-ons
                                available
                              </div>
                              <div>
                                Max selections:{' '}
                                {assignment.addonGroup.maxSelections ||
                        'Unlimited'}
                              </div>
                            </div>

                            {(assignment.category.description ||
                        assignment.addonGroup.description) && (<div className='text-sm text-muted-foreground'>
                                {assignment.category.description && (<div>
                                    Category: {assignment.category.description}
                                  </div>)}
                                {assignment.addonGroup.description && (<div>
                                    Group: {assignment.addonGroup.description}
                                  </div>)}
                              </div>)}
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
                        setSelectedAssignment(assignment);
                        setIsEditModalOpen(true);
                    }}>
                                <Edit className='mr-2 h-4 w-4'/>
                                Edit Assignment
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(assignment)}>
                                {assignment.isActive ? (<>
                                    <EyeOff className='mr-2 h-4 w-4'/>
                                    Deactivate
                                  </>) : (<>
                                    <Eye className='mr-2 h-4 w-4'/>
                                    Activate
                                  </>)}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                        setSelectedAssignment(assignment);
                        setIsDeleteModalOpen(true);
                    }} className='text-destructive'>
                                <Trash2 className='mr-2 h-4 w-4'/>
                                Remove Assignment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>))}
                </div>)}
            </div>)}
        </CardContent>
      </Card>

      {/* Modals */}
      <CategoryAssignmentFormModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={handleCreateAssignment} title='Create Category Assignment' mode='create' categories={categories.filter(c => c.isActive)} addonGroups={addonGroups.filter(g => g.isActive)} existingAssignments={assignments}/>

      <CategoryAssignmentFormModal open={isEditModalOpen} onClose={() => {
            setIsEditModalOpen(false);
            setSelectedAssignment(null);
        }} onSubmit={handleEditAssignment} initialData={selectedAssignment} title='Edit Category Assignment' mode='edit' categories={categories} addonGroups={addonGroups} existingAssignments={assignments}/>

      <CategoryAssignmentDeleteModal open={isDeleteModalOpen} onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedAssignment(null);
        }} onConfirm={handleDeleteAssignment} assignment={selectedAssignment}/>
    </div>);
}
