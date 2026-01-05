/**
 * Audit trail utilities for tracking changes
 */
/**
 * Record a change for audit purposes
 *
 * @param entry The audit entry to record
 * @returns A promise that resolves when the audit entry is recorded
 */
export async function recordAudit(entry) {
    try {
        // In a real implementation, we would send this to an API endpoint
        // For now, we'll just log it to the console
        console.log('Audit Trail:', entry);
        // In a production app, we would also:
        // 1. Store in local storage/IndexedDB if offline
        // 2. Sync with server when online
        // 3. Potentially batch multiple audit entries together
        // Store in local storage for now
        const audits = JSON.parse(localStorage.getItem('audit_trail') || '[]');
        audits.push({
            ...entry,
            timestamp: entry.timestamp || new Date().toISOString(),
        });
        // Keep only the last 1000 audit entries to prevent excessive storage usage
        if (audits.length > 1000) {
            audits.splice(0, audits.length - 1000);
        }
        localStorage.setItem('audit_trail', JSON.stringify(audits));
    }
    catch (error) {
        console.error('Failed to record audit entry:', error);
        // Don't throw - audit trail should never break the main flow
    }
}
/**
 * Get audit trail entries for a specific entity
 *
 * @param entityId The ID of the entity to get audit entries for
 * @param entityType The type of the entity
 * @returns Array of audit entries for the entity
 */
export function getEntityAuditTrail(entityId, entityType) {
    try {
        const audits = JSON.parse(localStorage.getItem('audit_trail') || '[]');
        return audits.filter((entry) => entry.entityId === entityId && entry.entityType === entityType);
    }
    catch (error) {
        console.error('Failed to get audit trail:', error);
        return [];
    }
}
/**
 * Calculate what fields have changed between two objects
 *
 * @param oldObj The old version of the object
 * @param newObj The new version of the object
 * @param ignoredFields Array of field names to ignore
 * @returns Record of changes with old and new values
 */
export function calculateChanges(oldObj, newObj, ignoredFields = ['updatedAt', 'isOptimisticallyUpdated']) {
    const changes = {};
    // Get all unique field names from both objects
    const allFields = [
        ...new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]),
    ];
    for (const field of allFields) {
        // Skip ignored fields
        if (ignoredFields.includes(field)) {
            continue;
        }
        const oldValue = oldObj?.[field];
        const newValue = newObj?.[field];
        // Only include fields that have changed
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changes[field] = {
                old: oldValue,
                new: newValue,
            };
        }
    }
    return changes;
}
export default {
    recordAudit,
    getEntityAuditTrail,
    calculateChanges,
};
