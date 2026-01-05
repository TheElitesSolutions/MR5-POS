'use client';
import React, { useState } from 'react';
import { AdminLayout, AdminOverview } from './AdminLayout';
import { AddonGroupsManagement } from './AddonGroupsManagement';
import { AddonsManagement } from './AddonsManagement';
import { CategoryAssignmentManagement } from './CategoryAssignmentManagement';
import { AddonAnalyticsDashboard } from './AddonAnalyticsDashboard';
export function AdminApp() {
    const [currentPage, setCurrentPage] = useState('overview');
    const handleNavigation = (page) => {
        setCurrentPage(page);
    };
    const renderCurrentPage = () => {
        switch (currentPage) {
            case 'groups':
                return <AddonGroupsManagement />;
            case 'addons':
                return <AddonsManagement />;
            case 'assignments':
                return <CategoryAssignmentManagement />;
            case 'analytics':
                return <AddonAnalyticsDashboard />;
            case 'overview':
            default:
                return <AdminOverview onNavigate={handleNavigation}/>;
        }
    };
    return (<AdminLayout currentPage={currentPage} onNavigate={handleNavigation}>
      {renderCurrentPage()}
    </AdminLayout>);
}
export default AdminApp;
