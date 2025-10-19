/**
 * Backup type definitions
 */

export interface BackupInfo {
  id: string;
  timestamp: string;
  filename: string;
  size: number; // in bytes
  path: string;
  isAutomatic: boolean;
}
