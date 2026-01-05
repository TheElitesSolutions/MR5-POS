/**
 * Version and conflict resolution utilities
 */
/**
 * Types of conflicts that can occur during updates
 */
export var ConflictType;
(function (ConflictType) {
    // The item was deleted on the server
    ConflictType["DELETED"] = "deleted";
    // The item was modified by another user
    ConflictType["MODIFIED"] = "modified";
    // The item has validation errors
    ConflictType["VALIDATION"] = "validation";
    // Another type of conflict
    ConflictType["OTHER"] = "other";
})(ConflictType || (ConflictType = {}));
/**
 * Check for version conflicts between local and server data
 *
 * @param localVersion The local version of the entity
 * @param serverVersion The server version of the entity
 * @returns A conflict object if a conflict is detected, null otherwise
 */
export function detectVersionConflict(localVersion, serverVersion) {
    if (!serverVersion) {
        return {
            type: ConflictType.DELETED,
            message: 'This item has been deleted on the server',
            localVersion,
        };
    }
    // Compare updatedAt timestamps
    const localUpdatedAt = new Date(localVersion.updatedAt).getTime();
    const serverUpdatedAt = new Date(serverVersion.updatedAt).getTime();
    if (serverUpdatedAt > localUpdatedAt) {
        return {
            type: ConflictType.MODIFIED,
            message: 'This item has been modified by another user',
            localVersion,
            serverVersion,
        };
    }
    return null;
}
/**
 * Detect field-level conflicts between local and server versions
 *
 * @param localVersion The local version of the entity
 * @param serverVersion The server version of the entity
 * @param fields Optional array of field names to check
 * @returns A record of field-level conflicts
 */
export function detectFieldConflicts(localVersion, serverVersion, fields) {
    const conflicts = {};
    // Determine which fields to check
    const fieldsToCheck = fields || Object.keys(localVersion);
    for (const field of fieldsToCheck) {
        // Skip non-existent fields
        if (!(field in localVersion) || !(field in serverVersion)) {
            continue;
        }
        // Skip fields that don't conflict
        if (JSON.stringify(localVersion[field]) ===
            JSON.stringify(serverVersion[field])) {
            continue;
        }
        // Record the conflict
        conflicts[field] = {
            local: localVersion[field],
            server: serverVersion[field],
        };
    }
    return conflicts;
}
/**
 * Merge local and server versions with conflict resolution strategy
 *
 * @param localVersion The local version of the entity
 * @param serverVersion The server version of the entity
 * @param strategy The merge strategy to use
 * @param fieldOverrides Optional field-specific overrides
 * @returns The merged entity
 */
export function mergeVersions(localVersion, serverVersion, strategy = 'smart', fieldOverrides = {}) {
    if (strategy === 'local') {
        // Local wins for all fields
        return { ...serverVersion, ...localVersion };
    }
    if (strategy === 'server') {
        // Server wins for all fields
        return { ...localVersion, ...serverVersion };
    }
    // Smart strategy - merge field by field
    const result = { ...serverVersion };
    const conflicts = detectFieldConflicts(localVersion, serverVersion);
    for (const [field, values] of Object.entries(conflicts)) {
        // Field override takes precedence
        if (field in fieldOverrides) {
            result[field] =
                fieldOverrides[field] === 'local' ? values.local : values.server;
            continue;
        }
        // Default field-specific strategies
        switch (field) {
            case 'updatedAt':
                // Take the most recent
                result[field] =
                    new Date(values.local) > new Date(values.server)
                        ? values.local
                        : values.server;
                break;
            case 'isAvailable':
            case 'isActive':
                // Boolean flags - take the most restrictive (false)
                result[field] =
                    values.local === false || values.server === false ? false : true;
                break;
            case 'price':
                // For prices, prefer the server version to avoid financial issues
                result[field] = values.server;
                break;
            default:
                // Default to server version
                result[field] = values.server;
        }
    }
    return result;
}
export default {
    detectVersionConflict,
    detectFieldConflicts,
    mergeVersions,
    ConflictType,
};
