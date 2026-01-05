/**
 * Utility functions for restoring deleted entities
 */
import { getEntityAuditTrail } from './auditUtils';
/**
 * Get the last deleted instance of an entity from the audit trail
 *
 * @param entityId ID of the entity to restore
 * @param entityType Type of the entity
 * @returns The deleted entity data or null if not found
 */
export function getLastDeletedEntity(entityId, entityType) {
    try {
        // Get all audit entries for this entity
        const auditTrail = getEntityAuditTrail(entityId, entityType);
        // Find the most recent delete action
        const deleteActions = auditTrail
            .filter(entry => entry.action === 'delete')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (deleteActions.length === 0) {
            return null;
        }
        // Get the most recent delete action
        const lastDelete = deleteActions[0];
        // Extract the deleted entity data from the metadata
        if (lastDelete.metadata?.deletedItem) {
            return JSON.parse(lastDelete.metadata.deletedItem);
        }
        return null;
    }
    catch (error) {
        console.error('Failed to get deleted entity:', error);
        return null;
    }
}
/**
 * Check if an entity can be restored
 *
 * @param entityId ID of the entity to check
 * @param entityType Type of the entity
 * @returns True if the entity can be restored, false otherwise
 */
export function canRestoreEntity(entityId, entityType) {
    return getLastDeletedEntity(entityId, entityType) !== null;
}
export default {
    getLastDeletedEntity,
    canRestoreEntity,
};
