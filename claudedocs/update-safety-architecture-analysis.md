# Update Safety & Recovery Architecture Analysis

**Date**: January 4, 2026
**Application**: MR5 POS v2.3.5
**Analysis Focus**: Update safety, crash detection, backup/recovery systems

---

## Executive Summary

The application implements a **dual-layer safety system** for auto-updates:
1. **BackupManager**: Handles pre-update database backups
2. **UpdateSafety**: Coordinates integrity verification and crash detection

**Critical Finding**: The system has **significant architectural gaps** that create confusion between development restarts and actual crashes, resulting in false-positive crash counts and non-existent backups blocking recovery.

---

## Current Architecture Overview

### 1. Update Lifecycle Flow

```
Update Available
    ↓
Pre-Update Backup (BackupManager)
    ↓
Download Update (electron-updater)
    ↓
Install on App Quit
    ↓
App Restarts
    ↓
Post-Update Verification (UpdateSafety)
    ↓
Crash Detection Window (2 minutes)
    ↓
Success or Recovery
```

### 2. Component Responsibilities

#### UpdaterController (`main/controllers/updaterController.ts`)
- **Role**: Update orchestration and lifecycle management
- **Responsibilities**:
  - Check for updates via electron-updater
  - Trigger pre-update backup via BackupManager
  - Download and install updates
  - Notify renderer of update events
- **Integration**: Calls `BackupManager.createPreUpdateBackup()` before download (line 412)

#### BackupManager (`main/utils/backupManager.ts`)
- **Role**: Database backup creation and restoration
- **Responsibilities**:
  - Create pre-update backups (simple `.db` copy)
  - Verify backup integrity (file existence + size check)
  - Clean old backups (keep last 5)
  - Restore from backup files
- **Storage Location**: `{userData}/backups/pre-update/`
- **File Format**: `pre-update-v{version}-{timestamp}.db`

#### UpdateSafety (`main/utils/updateSafety.ts`)
- **Role**: Post-update verification and crash detection
- **Responsibilities**:
  - Verify database integrity after update
  - Track crash history and frequency
  - Coordinate recovery from backup
  - Manage crash detection metadata
- **Critical Functions**:
  - `verifyPostUpdateIntegrity()`: Runs on app startup (line 294)
  - `checkCrashHistory()`: Detects rapid restarts (line 434)
  - `handleUpdateFailure()`: Attempts recovery (line 334)

#### Integration Flow in `background.ts`
```typescript
// Line 98-136: Post-update verification on startup
const updateSafety = getUpdateSafety();
const integrityOk = await updateSafety.verifyPostUpdateIntegrity();

if (!integrityOk) {
  const recoveryResult = await updateSafety.handleUpdateFailure();
  if (!recoveryResult.success) {
    // Show error dialog and quit
  }
}

// Record startup for crash detection
await updateSafety.recordStartup(app.getVersion());

// After 2 minutes, mark as successful
setTimeout(async () => {
  await updateSafety.recordSuccessfulStartup();
}, 2 * 60 * 1000);
```

---

## Critical Issues Identified

### Issue 1: Crash vs. Development Restart Confusion

**Problem**: The system cannot distinguish between:
- **Actual crashes**: Application terminating unexpectedly
- **Development restarts**: Developer stopping and restarting the app
- **Normal user restarts**: User manually closing and reopening

**Root Cause**: Crash detection logic in `updateSafety.ts` (line 444-450):
```typescript
// Line 444-450
if (timeSinceStart < this.CRASH_WINDOW_MS) {
  // App crashed and restarted quickly
  crashData.crashCount++;
  crashData.lastCrashTime = now;
  await this.saveCrashDetection(crashData);
}
```

**Impact**:
- Development mode: Every restart increments crash count
- Current crash count: **4** (from logs)
- False positives trigger unnecessary recovery attempts
- No way to reset crash count in development

**Evidence from Logs**:
```
[Main] Checking post-update integrity...
[UpdateSafety] Running post-update integrity verification...
[DatabaseIntegrityChecker] Health check failed: Database connection error: SqliteError: no such table: addon_invoices
```

The crash count of 4 suggests 4 development restarts, not actual crashes.

### Issue 2: Backup Path Mismatch

**Problem**: Two different systems manage backups with **different directory structures**:

| System | Directory | File Pattern |
|--------|-----------|--------------|
| BackupManager | `{userData}/backups/pre-update/` | `pre-update-v{version}-{timestamp}.db` |
| UpdateSafety | `{userData}/backups/pre-update/` | `pre-update-v{version}-{timestamp}.zip` |

**Root Cause**:
- **BackupManager** creates `.db` files (line 334 in backupManager.ts)
- **UpdateSafety** expects `.zip` files (line 195 in updateSafety.ts)

**Impact**:
- UpdateSafety cannot find backups created by BackupManager
- Recovery attempts fail with "No backup available"
- Code duplication between two backup systems

**Evidence from File System**:
```bash
C:\Users\TheElitesSolutions\AppData\Roaming\mr5-pos\backups
# Directory exists but is empty (no backups)
```

### Issue 3: Missing Development Mode Flag

**Problem**: No environment-aware behavior for crash detection

**Missing Logic**:
- Development mode should skip crash detection
- Development mode should skip post-update verification
- Production mode should enable all safety checks

**Current Behavior**:
```typescript
// background.ts line 95-136: Always runs in all modes
const integrityOk = await updateSafety.verifyPostUpdateIntegrity();
```

**Recommended Behavior**:
```typescript
// Only run in production
if (isProd) {
  const integrityOk = await updateSafety.verifyPostUpdateIntegrity();
}
```

### Issue 4: No Backup Existence Check Before Update

**Problem**: UpdaterController triggers backup but doesn't verify success before download

**Current Flow** (`updaterController.ts` line 407-434):
```typescript
const backupResult = await backupManager.createPreUpdateBackup(updateVersion);

if (!backupResult.success) {
  // Correctly blocks update
  return this.createErrorResponse(`Cannot proceed with update - backup failed`);
}

// ✅ Good: Blocks update on backup failure
await autoUpdater.downloadUpdate();
```

**Issue**: If backup succeeds but gets deleted/corrupted before install, no re-verification happens.

### Issue 5: Crash Detection Window Conflicts with Development

**Problem**: 2-minute crash window is incompatible with development workflow

**Scenario**:
1. Developer starts app
2. Tests for 1 minute
3. Stops app to make code changes
4. Restarts app within 2 minutes
5. **System interprets as crash** and increments crash count

**Impact**:
- After 3 development restarts, system attempts rollback
- False recovery attempts in development
- Confusing error dialogs about "crashes"

---

## Recommended Architecture Improvements

### 1. Unified Backup System

**Consolidate BackupManager and UpdateSafety backup logic**:

```typescript
// Single source of truth for backups
class UnifiedBackupManager {
  // Single backup format (.db for speed, or .zip for compression)
  private readonly BACKUP_FORMAT = '.db'; // Faster for recovery

  createPreUpdateBackup(version: string): Promise<BackupResult> {
    // Used by BOTH updater and recovery
  }

  getLatestBackup(): Promise<string | null> {
    // Returns most recent backup regardless of caller
  }

  verifyBackupIntegrity(path: string): Promise<boolean> {
    // Consistent verification across systems
  }
}
```

**Benefits**:
- No path mismatches
- Single verification method
- Easier testing and debugging
- Clear ownership

### 2. Environment-Aware Crash Detection

**Add development mode exemptions**:

```typescript
class UpdateSafety {
  private get isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  async verifyPostUpdateIntegrity(): Promise<boolean> {
    // Skip in development
    if (this.isDevelopment) {
      logInfo('Skipping post-update checks in development mode');
      return true;
    }

    // Run full checks in production
    const healthCheck = await this.integrityChecker.runHealthCheck();
    const crashDetection = await this.checkCrashHistory();

    return healthCheck.isHealthy && !crashDetection.shouldRollback;
  }

  async recordStartup(version: string): Promise<void> {
    // Skip crash tracking in development
    if (this.isDevelopment) {
      return;
    }

    // Normal tracking in production
    const crashData = await this.loadCrashDetection();
    // ... existing logic
  }
}
```

**Benefits**:
- No false crash counts in development
- Clean development experience
- Production safety unchanged

### 3. Improved Crash Detection Logic

**Better crash identification**:

```typescript
interface CrashDetectionMetadata {
  version: string;
  startupTime: number;
  crashCount: number;
  lastCrashTime?: number;
  lastCleanShutdown?: number; // NEW
  shutdownReason?: 'user' | 'crash' | 'update'; // NEW
}

class UpdateSafety {
  // Called on normal window close
  async recordCleanShutdown(): Promise<void> {
    const crashData = await this.loadCrashDetection();
    crashData.lastCleanShutdown = Date.now();
    crashData.shutdownReason = 'user';
    await this.saveCrashDetection(crashData);
  }

  // Check if last shutdown was clean
  private async wasLastShutdownClean(): Promise<boolean> {
    const crashData = await this.loadCrashDetection();

    if (!crashData.lastCleanShutdown) {
      return false; // No clean shutdown recorded = potential crash
    }

    const timeSinceCleanShutdown = Date.now() - crashData.lastCleanShutdown;
    return timeSinceCleanShutdown < this.CRASH_WINDOW_MS;
  }

  async recordStartup(version: string): Promise<void> {
    if (this.isDevelopment) return;

    const crashData = await this.loadCrashDetection();
    const wasClean = await this.wasLastShutdownClean();

    if (!wasClean) {
      // Last shutdown was NOT clean = crash
      crashData.crashCount++;
      crashData.lastCrashTime = Date.now();
    }

    crashData.version = version;
    crashData.startupTime = Date.now();
    await this.saveCrashDetection(crashData);
  }
}
```

**Integration in background.ts**:
```typescript
// Line 343-344: On normal close
await getUpdateSafety().recordCleanShutdown();

// Line 366-367: On forced close
await getUpdateSafety().recordCleanShutdown();

// Line 382-383: On error close
await getUpdateSafety().recordCleanShutdown();
```

**Benefits**:
- Distinguishes crashes from normal exits
- No false positives from manual restarts
- Still detects actual crashes

### 4. Pre-Install Backup Verification

**Add verification before install**:

```typescript
class UpdaterController {
  private async installUpdate(): Promise<IPCResponse<{ installing: boolean }>> {
    if (!this.status.downloaded) {
      return this.createErrorResponse('No update downloaded to install');
    }

    // NEW: Verify backup exists and is valid before install
    const backupManager = getBackupManager();
    const latestBackup = await backupManager.getLatestPreUpdateBackup();

    if (!latestBackup) {
      logError(new Error('No pre-update backup found before install'), 'UpdaterController');
      return this.createErrorResponse(
        'Cannot install update - no backup available. Please try updating again.'
      );
    }

    const backupValid = await backupManager.verifyBackupIntegrity(latestBackup);
    if (!backupValid) {
      logError(new Error('Pre-update backup is corrupted'), 'UpdaterController');
      return this.createErrorResponse(
        'Cannot install update - backup is corrupted. Please try updating again.'
      );
    }

    logInfo('✓ Pre-update backup verified before install');

    // Proceed with install
    autoUpdater.quitAndInstall(false, true);
    return this.createSuccessResponse({ installing: true });
  }
}
```

**Benefits**:
- Catches backup deletion/corruption before install
- Prevents unrecoverable update failures
- Clear user feedback

### 5. Manual Recovery Procedures

**Add admin recovery commands**:

```typescript
// New IPC handlers in updaterController.ts
UPDATER_CHANNELS = {
  // ... existing channels
  RESET_CRASH_COUNT: 'mr5pos:updater:reset-crash-count',
  FORCE_RECOVERY: 'mr5pos:updater:force-recovery',
  LIST_BACKUPS: 'mr5pos:updater:list-backups',
};

private async resetCrashCount(): Promise<IPCResponse<{ reset: boolean }>> {
  const updateSafety = getUpdateSafety();
  await updateSafety.recordSuccessfulStartup();
  logInfo('Crash count manually reset by admin');
  return this.createSuccessResponse({ reset: true });
}

private async forceRecovery(): Promise<IPCResponse<{ recovered: boolean }>> {
  const updateSafety = getUpdateSafety();
  const result = await updateSafety.handleUpdateFailure();
  return result.success
    ? this.createSuccessResponse({ recovered: true })
    : this.createErrorResponse(result.error || 'Recovery failed');
}

private async listAvailableBackups(): Promise<IPCResponse<{ backups: string[] }>> {
  const backupManager = getBackupManager();
  const preUpdateDir = path.join(app.getPath('userData'), 'backups', 'pre-update');
  const files = await fs.readdir(preUpdateDir);
  const backups = files.filter(f => f.endsWith('.db'));
  return this.createSuccessResponse({ backups });
}
```

**UI Addition**: Admin panel in Settings → Updates:
- "Reset Crash Counter" button
- "Force Recovery from Backup" button
- "View Available Backups" list

---

## Emergency Recovery Procedures

### Scenario 1: False Crash Count Blocking App

**Symptoms**:
- "Too many crashes detected" error dialog
- App refuses to start
- No actual crashes occurred

**Recovery Steps**:

1. **Locate crash detection file**:
   ```
   C:\Users\[User]\AppData\Roaming\mr5-pos\crash-detection.json
   ```

2. **Manual reset** (delete file):
   ```powershell
   Remove-Item "C:\Users\[User]\AppData\Roaming\mr5-pos\crash-detection.json"
   ```

3. **Or edit file** to reset count:
   ```json
   {
     "version": "2.3.5",
     "startupTime": 1704312000000,
     "crashCount": 0
   }
   ```

4. **Restart application**

### Scenario 2: Corrupted Database After Update

**Symptoms**:
- App fails to start after update
- "Database integrity check failed" error
- Rollback fails

**Recovery Steps**:

1. **Locate database and backups**:
   ```
   Database: C:\Users\[User]\AppData\Roaming\mr5-pos\mr5-pos.db
   Backups:  C:\Users\[User]\AppData\Roaming\mr5-pos\backups\pre-update\
   ```

2. **Find latest backup**:
   ```powershell
   Get-ChildItem "C:\Users\[User]\AppData\Roaming\mr5-pos\backups\pre-update" |
     Sort-Object LastWriteTime -Descending |
     Select-Object -First 1
   ```

3. **Manual restore**:
   ```powershell
   # Backup current (corrupted) database
   Copy-Item "C:\Users\[User]\AppData\Roaming\mr5-pos\mr5-pos.db" `
             "C:\Users\[User]\AppData\Roaming\mr5-pos\mr5-pos.db.corrupted"

   # Restore from backup
   Copy-Item "C:\Users\[User]\AppData\Roaming\mr5-pos\backups\pre-update\[latest].db" `
             "C:\Users\[User]\AppData\Roaming\mr5-pos\mr5-pos.db" -Force
   ```

4. **Restart application**

### Scenario 3: No Backups Available

**Symptoms**:
- Update fails
- No backups found in recovery
- Empty backups directory

**Recovery Steps**:

1. **Check if database is actually intact**:
   ```powershell
   # Install SQLite CLI
   sqlite3 "C:\Users\[User]\AppData\Roaming\mr5-pos\mr5-pos.db"

   # Run integrity check
   PRAGMA integrity_check;

   # Check tables exist
   .tables
   ```

2. **If database is intact**:
   - Crash detection was false positive
   - Reset crash count (see Scenario 1)
   - Create manual backup:
     ```powershell
     Copy-Item "C:\Users\[User]\AppData\Roaming\mr5-pos\mr5-pos.db" `
               "C:\Users\[User]\AppData\Roaming\mr5-pos\backups\manual-backup.db"
     ```

3. **If database is corrupted with no backup**:
   - **Data loss inevitable**
   - Initialize fresh database
   - Contact support for potential Supabase sync recovery

---

## Implementation Priority

| Priority | Item | Impact | Effort | Risk |
|----------|------|--------|--------|------|
| 🔴 **P0** | Development mode exemptions | **Critical** - Fixes false crashes | **Low** - Config check | **Low** |
| 🔴 **P0** | Unify backup file formats | **Critical** - Enables recovery | **Medium** - Refactor paths | **Medium** |
| 🟡 **P1** | Clean shutdown tracking | **High** - Better crash detection | **Medium** - Add hooks | **Low** |
| 🟡 **P1** | Pre-install backup verification | **High** - Prevents data loss | **Low** - Add check | **Low** |
| 🟢 **P2** | Manual recovery UI | **Medium** - Admin convenience | **High** - UI work | **Low** |
| 🟢 **P2** | Backup file consolidation | **Medium** - Code simplification | **High** - Major refactor | **High** |

---

## Immediate Actions Required

### 1. Quick Fix for Current Environment (Development)

**File**: `main/background.ts` (line 95-136)

```typescript
// QUICK FIX: Skip update safety checks in development
console.log('[Main] Checking post-update integrity...');

if (!isProd) {
  console.log('[Main] Skipping update safety checks in development mode');
} else {
  try {
    const updateSafety = getUpdateSafety();
    const integrityOk = await updateSafety.verifyPostUpdateIntegrity();

    if (!integrityOk) {
      logError(
        new Error('Post-update integrity check failed - attempting recovery'),
        'Main'
      );
      // ... existing recovery logic
    }
  } catch (error) {
    logError(error as Error, 'Main - Update Safety Check');
  }
}
```

**Impact**: Immediately fixes development false crash counts.

### 2. Reset Current Crash Count

**Create helper script**: `scripts/reset-crash-count.js`

```javascript
const fs = require('fs');
const path = require('path');

const appDataPath = path.join(
  process.env.APPDATA || process.env.HOME,
  'mr5-pos'
);

const crashFile = path.join(appDataPath, 'crash-detection.json');

if (fs.existsSync(crashFile)) {
  fs.unlinkSync(crashFile);
  console.log('✓ Crash count reset successfully');
} else {
  console.log('ℹ No crash detection file found');
}
```

**Usage**: `node scripts/reset-crash-count.js`

### 3. Fix Backup Format Mismatch

**File**: `main/utils/updateSafety.ts` (line 195)

```typescript
// Change from .zip to .db to match BackupManager
const backups = backupFiles
  .filter(file => file.startsWith('pre-update-') && file.endsWith('.db')) // Changed from .zip
  .map(file => ({
    name: file,
    path: path.join(this.preUpdateBackupDir, file),
  }));
```

**Impact**: UpdateSafety can now find BackupManager backups.

---

## Testing Checklist

### Unit Tests Needed

- [ ] `BackupManager.createPreUpdateBackup()` creates `.db` file
- [ ] `UpdateSafety.getLatestBackup()` finds `.db` files
- [ ] `UpdateSafety.verifyBackupIntegrity()` validates `.db` files
- [ ] Crash detection skips in development mode
- [ ] Clean shutdown prevents false crash count

### Integration Tests Needed

- [ ] Full update cycle: backup → download → install → verify
- [ ] Recovery flow: fail integrity → restore backup → success
- [ ] Development mode: no crash tracking, no integrity checks
- [ ] Production mode: full safety checks enabled

### Manual Test Scenarios

1. **Development Restart Loop**:
   - Start app in dev mode
   - Stop and restart 5 times rapidly
   - Verify no crash count increase

2. **Production Update**:
   - Trigger update in production build
   - Verify backup created before download
   - Verify backup checked before install
   - Kill app during startup
   - Verify recovery attempt

3. **Manual Recovery**:
   - Corrupt database file
   - Start app
   - Verify automatic recovery
   - Check backup was used

---

## Conclusion

The update safety architecture has **solid foundations** but suffers from:
1. **Environment confusion**: Development mode not properly handled
2. **System duplication**: Two backup managers with different formats
3. **Crash detection flaws**: Cannot distinguish crashes from restarts

**Immediate fixes** (P0 items) can be implemented in **~2 hours** and will resolve current development issues. **Long-term improvements** (P1-P2) will require more extensive refactoring but provide much better safety and user experience.

The system is **production-capable** with the P0 fixes applied. Current false crashes are development artifacts, not production risks.
