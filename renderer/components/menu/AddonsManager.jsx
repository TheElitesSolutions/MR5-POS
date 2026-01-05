'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Package, DollarSign, Tag, Settings, ArrowRight, } from 'lucide-react';
import { AddonGroupFormModal } from '@/components/admin/AddonGroupFormModal';
import { AddonFormModal } from '@/components/admin/AddonFormModal';
export function AddonsManager() {
    const [activeTab, setActiveTab] = useState('groups');
    const [addonGroups, setAddonGroups] = useState([]);
    const [addons, setAddons] = useState([]);
    const [categories, setCategories] = useState([]);
    const [categoryAssignments, setCategoryAssignments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const { toast } = useToast();
    const router = useRouter();
    // Assignment dialog state
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [assignCategoryId, setAssignCategoryId] = useState('');
    const [assignGroupId, setAssignGroupId] = useState('');
    // Delete confirmation state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    // Edit dialog state
    const [editGroupDialogOpen, setEditGroupDialogOpen] = useState(false);
    const [editAddonDialogOpen, setEditAddonDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    // Modal state for create/edit operations
    const [groupFormOpen, setGroupFormOpen] = useState(false);
    const [addonFormOpen, setAddonFormOpen] = useState(false);
    const [groupFormMode, setGroupFormMode] = useState('create');
    const [addonFormMode, setAddonFormMode] = useState('create');
    const [editingGroup, setEditingGroup] = useState(null);
    const [editingAddon, setEditingAddon] = useState(null);
    const [inventoryItems, setInventoryItems] = useState([]);
    // Load data on component mount
    useEffect(() => {
        loadData();
    }, []);
    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load addon data using the new addon APIs
            console.log('Loading addon data for menu management...');
            const [groupsResponse, categoriesResponse, assignmentsResponse, inventoryResponse] = await Promise.all([
                window.electronAPI?.ipc.invoke('addon:getGroups'),
                window.electronAPI?.ipc.invoke('mr5pos:menu-items:get-categories'), // Get categories from menu API
                window.electronAPI?.ipc.invoke('addon:getCategoryAssignments'),
                window.electronAPI?.ipc.invoke('mr5pos:inventory:get-all'),
            ]);
            console.log('API Responses:', {
                groupsResponse,
                categoriesResponse,
                assignmentsResponse,
            });
            // Set addon groups
            if (groupsResponse?.success && groupsResponse.data) {
                setAddonGroups(groupsResponse.data);
            }
            else {
                setAddonGroups([]);
            }
            // Load all addons by getting them for each group
            let allAddons = [];
            if (groupsResponse?.success && groupsResponse.data) {
                for (const group of groupsResponse.data) {
                    try {
                        const groupAddons = await window.electronAPI?.ipc.invoke('addon:getByGroup', group.id);
                        if (groupAddons?.success && groupAddons.data) {
                            allAddons.push(...groupAddons.data);
                        }
                    }
                    catch (error) {
                        console.warn(`Failed to load addons for group ${group.id}:`, error);
                    }
                }
            }
            setAddons(allAddons);
            // Set categories from menu API
            if (categoriesResponse?.success && categoriesResponse.data) {
                setCategories(categoriesResponse.data.map((cat) => ({
                    id: cat.id,
                    name: cat.name,
                    isActive: cat.isActive ?? true,
                })));
            }
            else {
                setCategories([]);
            }
            // Set category assignments
            if (assignmentsResponse?.success && assignmentsResponse.data) {
                setCategoryAssignments(assignmentsResponse.data);
            }
            else {
                setCategoryAssignments([]);
            }
            // Set inventory items for addon form
            if (inventoryResponse?.success && inventoryResponse.data) {
                setInventoryItems(inventoryResponse.data);
            }
            else {
                setInventoryItems([]);
            }
        }
        catch (error) {
            console.error('Failed to load addon data:', error);
            toast({
                title: 'Error Loading Add-ons',
                description: 'Failed to load add-on data. Please try again.',
                variant: 'destructive',
            });
            // Set empty arrays to show empty states
            setAddonGroups([]);
            setAddons([]);
            setCategories([]);
            setCategoryAssignments([]);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleCreateAddonGroup = () => {
        setEditingGroup(null);
        setGroupFormMode('create');
        setGroupFormOpen(true);
    };
    const handleCreateAddon = () => {
        setEditingAddon(null);
        setAddonFormMode('create');
        setAddonFormOpen(true);
    };
    const handleEditGroup = (group) => {
        setEditingGroup(group);
        setGroupFormMode('edit');
        setGroupFormOpen(true);
    };
    const handleEditAddon = (addon) => {
        setEditingAddon(addon);
        setAddonFormMode('edit');
        setAddonFormOpen(true);
    };
    const confirmDelete = (type, id, name, categoryId) => {
        setDeleteTarget({ type, id, name, categoryId });
        setDeleteConfirmOpen(true);
    };
    const handleDeleteGroup = async (id) => {
        try {
            const res = await window.electronAPI?.ipc.invoke('addon:deleteGroup', id);
            if (res?.success === false)
                throw new Error(res?.error || 'Delete failed');
            toast({ title: 'Group deleted successfully' });
            await loadData();
        }
        catch (error) {
            console.error('Failed to delete group:', error);
            toast({ title: 'Failed to delete group', variant: 'destructive' });
        }
    };
    const handleDeleteAddon = async (id) => {
        try {
            const res = await window.electronAPI?.ipc.invoke('addon:delete', id);
            if (res?.success === false)
                throw new Error(res?.error || 'Delete failed');
            toast({ title: 'Add-on deleted successfully' });
            await loadData();
        }
        catch (error) {
            console.error('Failed to delete add-on:', error);
            toast({ title: 'Failed to delete add-on', variant: 'destructive' });
        }
    };
    const executeDelete = async () => {
        if (!deleteTarget)
            return;
        if (deleteTarget.type === 'group') {
            await handleDeleteGroup(deleteTarget.id);
        }
        else if (deleteTarget.type === 'addon') {
            await handleDeleteAddon(deleteTarget.id);
        }
        else if (deleteTarget.type === 'assignment' && deleteTarget.categoryId) {
            await handleUnassign(deleteTarget.categoryId, deleteTarget.id);
        }
        setDeleteConfirmOpen(false);
        setDeleteTarget(null);
    };
    const handleManageAssignments = () => {
        setAssignDialogOpen(true);
    };
    const handleAssignToCategory = async () => {
        if (!assignCategoryId || !assignGroupId) {
            toast({
                title: 'Select both category and group',
                variant: 'destructive',
            });
            return;
        }
        try {
            const res = await window.electronAPI?.ipc.invoke('addon:assignToCategory', assignCategoryId, assignGroupId);
            if (res?.success === false)
                throw new Error(res?.error || 'Assign failed');
            toast({ title: 'Assigned successfully' });
            setAssignDialogOpen(false);
            setAssignCategoryId('');
            setAssignGroupId('');
            await loadData();
        }
        catch (error) {
            console.error('Failed to assign group to category:', error);
            toast({ title: 'Failed to assign', variant: 'destructive' });
        }
    };
    const handleUnassign = async (categoryId, groupId) => {
        try {
            const res = await window.electronAPI?.ipc.invoke('addon:unassignFromCategory', categoryId, groupId);
            if (res?.success === false)
                throw new Error(res?.error || 'Unassign failed');
            toast({ title: 'Unassigned successfully' });
            await loadData();
        }
        catch (error) {
            console.error('Failed to unassign group from category:', error);
            toast({ title: 'Failed to unassign', variant: 'destructive' });
        }
    };
    const handleOpenAdminPanel = () => {
        // Open the dedicated admin panel for full addon management
        window.location.href = '/admin';
    };
    const handleGroupFormSubmit = async (data) => {
        try {
            const endpoint = groupFormMode === 'create' ? 'addon:createGroup' : 'addon:updateGroup';
            // Ensure data types are correct
            const cleanedData = {
                name: data.name,
                description: data.description || '',
                minSelections: Number(data.minSelections),
                maxSelections: data.maxSelections ? Number(data.maxSelections) : null,
                isActive: Boolean(data.isActive),
                sortOrder: Number(data.sortOrder),
            };
            const payload = groupFormMode === 'edit'
                ? { id: editingGroup?.id, ...cleanedData }
                : cleanedData;
            const response = await window.electronAPI?.ipc.invoke(endpoint, payload);
            if (response?.success === false) {
                throw new Error(response?.error || 'Operation failed');
            }
            toast({
                title: groupFormMode === 'create' ? 'Group created successfully' : 'Group updated successfully',
            });
            setGroupFormOpen(false);
            setEditingGroup(null);
            await loadData();
        }
        catch (error) {
            console.error('Failed to save group:', error);
            toast({
                title: 'Failed to save group',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        }
    };
    const handleAddonFormSubmit = async (data) => {
        try {
            const endpoint = addonFormMode === 'create' ? 'addon:create' : 'addon:update';
            // Ensure data types are correct
            const cleanedData = {
                name: data.name,
                description: data.description || '',
                price: Number(data.price),
                addonGroupId: data.addonGroupId,
                inventoryId: data.inventoryId || null,
                isActive: Boolean(data.isActive),
                sortOrder: Number(data.sortOrder),
            };
            const payload = addonFormMode === 'edit'
                ? { id: editingAddon?.id, ...cleanedData }
                : cleanedData;
            const response = await window.electronAPI?.ipc.invoke(endpoint, payload);
            if (response?.success === false) {
                throw new Error(response?.error || 'Operation failed');
            }
            toast({
                title: addonFormMode === 'create' ? 'Add-on created successfully' : 'Add-on updated successfully',
            });
            setAddonFormOpen(false);
            setEditingAddon(null);
            await loadData();
        }
        catch (error) {
            console.error('Failed to save add-on:', error);
            toast({
                title: 'Failed to save add-on',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        }
    };
    const renderTabContent = () => {
        if (isLoading) {
            return (<div className='flex h-64 items-center justify-center'>
          <div className='text-center'>
            <Package className='mx-auto mb-4 h-12 w-12 text-gray-400'/>
            <p>Loading add-ons...</p>
          </div>
        </div>);
        }
        switch (activeTab) {
            case 'groups':
                return (<div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <h3 className='text-lg font-medium'>Add-on Groups</h3>
                <p className='text-sm text-gray-600'>
                  Organize add-ons into logical groups (e.g., Pizza Toppings,
                  Burger Extras)
                </p>
              </div>
              <Button onClick={handleCreateAddonGroup}>
                <Plus className='mr-2 h-4 w-4'/>
                New Group
              </Button>
            </div>

            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {addonGroups.length === 0 ? (<Card className='col-span-full'>
                  <CardContent className='pt-6'>
                    <div className='text-center'>
                      <Tag className='mx-auto mb-4 h-12 w-12 text-gray-400'/>
                      <h3 className='mb-2 text-lg font-medium'>
                        No Add-on Groups
                      </h3>
                      <p className='mb-4 text-gray-600'>
                        Create your first add-on group to get started
                      </p>
                      <Button onClick={handleCreateAddonGroup}>
                        <Plus className='mr-2 h-4 w-4'/>
                        Create Add-on Group
                      </Button>
                    </div>
                  </CardContent>
                </Card>) : (addonGroups.map(group => (<Card key={group.id} className='transition-shadow hover:shadow-md'>
                    <CardContent className='pt-4'>
                      <div className='mb-2 flex items-start justify-between'>
                        <h4 className='font-medium'>{group.name}</h4>
                        <Badge variant={group.isActive ? 'default' : 'secondary'}>
                          {group.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {group.description && (<p className='mb-3 text-sm text-gray-600'>
                          {group.description}
                        </p>)}
                      <div className='flex items-center justify-between text-sm text-gray-500'>
                        <span>
                          {addons.filter(a => a.addonGroupId === group.id && a.isActive).length}{' '}
                          add-ons
                        </span>
                        <div className='flex space-x-1'>
                          <Button variant='ghost' size='sm' onClick={() => handleEditGroup(group)}>
                            <Edit className='h-4 w-4'/>
                          </Button>
                          <Button variant='ghost' size='sm' onClick={() => confirmDelete('group', group.id, group.name)}>
                            <Trash2 className='h-4 w-4'/>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>)))}
            </div>
          </div>);
            case 'addons':
                return (<div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <h3 className='text-lg font-medium'>Individual Add-ons</h3>
                <p className='text-sm text-gray-600'>
                  Manage individual add-on items and their pricing
                </p>
              </div>
              <Button onClick={handleCreateAddon}>
                <Plus className='mr-2 h-4 w-4'/>
                New Add-on
              </Button>
            </div>

            <div className='mb-4 flex space-x-4'>
              <div className='flex-1'>
                <Input placeholder='Search add-ons...' value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className='max-w-sm'/>
              </div>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className='w-48'>
                  <SelectValue placeholder='Filter by group'/>
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
            </div>

            {(() => {
                        // Apply filters to addons
                        const filteredAddons = addons.filter(addon => {
                            // Filter by search query
                            const matchesSearch = !searchQuery ||
                                addon.name
                                    .toLowerCase()
                                    .includes(searchQuery.toLowerCase()) ||
                                addon.description
                                    ?.toLowerCase()
                                    .includes(searchQuery.toLowerCase());
                            // Filter by selected group
                            const matchesGroup = selectedGroup === 'all' ||
                                addon.addonGroupId === selectedGroup;
                            return matchesSearch && matchesGroup;
                        });
                        return filteredAddons.length === 0 ? (<Card>
                  <CardContent className='pt-6'>
                    <div className='text-center'>
                      <Package className='mx-auto mb-4 h-12 w-12 text-gray-400'/>
                      <h3 className='mb-2 text-lg font-medium'>
                        {addons.length === 0
                                ? 'No Add-ons'
                                : 'No Matching Add-ons'}
                      </h3>
                      <p className='mb-4 text-gray-600'>
                        {addons.length === 0
                                ? 'Create your first add-on to get started'
                                : 'Try adjusting your search or filter criteria'}
                      </p>
                      {addons.length === 0 && (<Button onClick={handleCreateAddon}>
                          <Plus className='mr-2 h-4 w-4'/>
                          Create Add-on
                        </Button>)}
                    </div>
                  </CardContent>
                </Card>) : (<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                  {filteredAddons.map(addon => (<Card key={addon.id} className='transition-shadow hover:shadow-md'>
                      <CardContent className='pt-4'>
                        <div className='mb-2 flex items-start justify-between'>
                          <h4 className='font-medium'>{addon.name}</h4>
                          <Badge variant={addon.isActive ? 'default' : 'secondary'}>
                            {addon.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {addon.description && (<p className='mb-3 text-sm text-gray-600'>
                            {addon.description}
                          </p>)}
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center text-sm text-gray-500'>
                            <DollarSign className='mr-1 h-4 w-4'/>$
                            {addon.price.toFixed(2)}
                          </div>
                          <div className='flex space-x-1'>
                            <Button variant='ghost' size='sm' onClick={() => handleEditAddon(addon)}>
                              <Edit className='h-4 w-4'/>
                            </Button>
                            <Button variant='ghost' size='sm' onClick={() => confirmDelete('addon', addon.id, addon.name)}>
                              <Trash2 className='h-4 w-4'/>
                            </Button>
                          </div>
                        </div>
                        <div className='mt-2 text-xs text-gray-400'>
                          Group: {addon.addonGroup?.name || 'Unknown'}
                        </div>
                      </CardContent>
                    </Card>))}
                </div>);
                    })()}
          </div>);
            case 'assignments':
                return (<div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <h3 className='text-lg font-medium'>Category Assignments</h3>
                <p className='text-sm text-gray-600'>
                  Assign add-on groups to menu categories
                </p>
              </div>
              <Button onClick={handleManageAssignments}>
                <Settings className='mr-2 h-4 w-4'/>
                Manage Assignments
              </Button>
            </div>

            <div className='mb-4'>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className='w-48'>
                  <SelectValue placeholder='Filter by category'/>
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
            </div>

            {(() => {
                        // Apply category filter to assignments
                        const filteredAssignments = categoryAssignments.filter(assignment => selectedCategory === 'all' ||
                            assignment.categoryId === selectedCategory);
                        return filteredAssignments.length === 0 ? (<Card>
                  <CardContent className='pt-6'>
                    <div className='text-center'>
                      <ArrowRight className='mx-auto mb-4 h-12 w-12 text-gray-400'/>
                      <h3 className='mb-2 text-lg font-medium'>
                        {categoryAssignments.length === 0
                                ? 'No Assignments'
                                : 'No Matching Assignments'}
                      </h3>
                      <p className='mb-4 text-gray-600'>
                        {categoryAssignments.length === 0
                                ? 'Assign add-on groups to categories to make them available in POS'
                                : 'Try adjusting your filter criteria'}
                      </p>
                      {categoryAssignments.length === 0 && (<Button onClick={handleManageAssignments}>
                          <Settings className='mr-2 h-4 w-4'/>
                          Create Assignment
                        </Button>)}
                    </div>
                  </CardContent>
                </Card>) : (<div className='space-y-3'>
                  {filteredAssignments.map(assignment => (<Card key={assignment.id}>
                      <CardContent className='pt-4'>
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center space-x-4'>
                            <div>
                              <p className='font-medium'>
                                {assignment.category?.name ||
                                    'Unknown Category'}
                              </p>
                              <p className='text-sm text-gray-600'>
                                {assignment.addonGroup?.name || 'Unknown Group'}{' '}
                                ({assignment.addonGroup?._count?.addons || 0}{' '}
                                add-ons)
                              </p>
                            </div>
                          </div>
                          <div className='flex items-center space-x-2'>
                            <Badge variant={assignment.isActive ? 'default' : 'secondary'}>
                              {assignment.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <Button variant='ghost' size='sm' onClick={() => confirmDelete('assignment', assignment.addonGroupId, `${assignment.category?.name} - ${assignment.addonGroup?.name}`, assignment.categoryId)}>
                              <Trash2 className='h-4 w-4'/>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>))}
                </div>);
                    })()}
          </div>);
        }
    };
    return (<div className='space-y-6'>
      {/* Tab Navigation */}
      <div className='border-b border-gray-200'>
        <nav className='-mb-px flex space-x-8'>
          <button onClick={() => setActiveTab('groups')} className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${activeTab === 'groups'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
            <Tag className='mr-2 inline h-4 w-4'/>
            Groups
          </button>
          <button onClick={() => setActiveTab('addons')} className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${activeTab === 'addons'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
            <Package className='mr-2 inline h-4 w-4'/>
            Add-ons
          </button>
          <button onClick={() => setActiveTab('assignments')} className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${activeTab === 'assignments'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
            <ArrowRight className='mr-2 inline h-4 w-4'/>
            Assignments
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Quick Actions */}
      <Card className='border-blue-200 bg-blue-50'>
        <CardContent className='pt-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h4 className='font-medium text-blue-900'>Need Help?</h4>
              <p className='text-sm text-blue-700'>
                Add-ons are managed separately from menu items. For full add-on
                management features, visit the dedicated admin panel.
              </p>
            </div>
            <Button variant='outline' className='border-blue-300 text-blue-700 hover:bg-blue-100' onClick={handleOpenAdminPanel}>
              Open Admin Panel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Group to Category</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700'>
                Category
              </label>
              <Select value={assignCategoryId} onValueChange={setAssignCategoryId}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select a category'/>
                </SelectTrigger>
                <SelectContent>
                  {categories
            .filter(cat => cat && cat.id && cat.id.trim() !== '')
            .map(cat => (<SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700'>
                Add-on Group
              </label>
              <Select value={assignGroupId} onValueChange={setAssignGroupId}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select an add-on group'/>
                </SelectTrigger>
                <SelectContent>
                  {addonGroups
            .filter(g => g && g.id && g.id.trim() !== '')
            .map(g => (<SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className='flex justify-end space-x-2'>
              <Button variant='ghost' onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignToCategory}>Assign</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'group' && (<>
                  This will delete the add-on group &quot;
                  <strong>{deleteTarget.name}</strong>&quot; and all its
                  add-ons. This action cannot be undone.
                </>)}
              {deleteTarget?.type === 'addon' && (<>
                  This will delete the add-on &quot;
                  <strong>{deleteTarget.name}</strong>&quot;. This action cannot
                  be undone.
                </>)}
              {deleteTarget?.type === 'assignment' && (<>
                  This will unassign &quot;<strong>{deleteTarget.name}</strong>
                  &quot;. This action cannot be undone.
                </>)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className='bg-red-600 hover:bg-red-700'>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Addon Group Form Modal */}
      <AddonGroupFormModal open={groupFormOpen} onClose={() => {
            setGroupFormOpen(false);
            setEditingGroup(null);
        }} onSubmit={handleGroupFormSubmit} initialData={editingGroup} title={groupFormMode === 'create' ? 'Create Add-on Group' : 'Edit Add-on Group'} mode={groupFormMode}/>

      {/* Addon Form Modal */}
      <AddonFormModal open={addonFormOpen} onClose={() => {
            setAddonFormOpen(false);
            setEditingAddon(null);
        }} onSubmit={handleAddonFormSubmit} initialData={editingAddon} title={addonFormMode === 'create' ? 'Create Add-on' : 'Edit Add-on'} mode={addonFormMode} addonGroups={addonGroups} inventoryItems={inventoryItems}/>
    </div>);
}
export default AddonsManager;
