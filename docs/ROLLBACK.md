# MR5 POS Rollback & Recovery Guide

This document provides emergency procedures for rolling back failed updates and recovering from update-related issues.

## Table of Contents
- [Emergency Contact](#emergency-contact)
- [When to Rollback](#when-to-rollback)
- [Automatic Recovery](#automatic-recovery)
- [Manual Rollback Procedures](#manual-rollback-procedures)
- [Database Recovery](#database-recovery)
- [Prevention Measures](#prevention-measures)

---

## Emergency Contact

**Before proceeding with manual rollback, assess the severity:**

- **Critical (app won't start, data at risk):** Follow [Emergency Database Recovery](#emergency-database-recovery) immediately
- **High (major features broken):** Follow [Manual Rollback](#manual-rollback-procedures)
- **Medium (minor bugs):** Wait for hotfix release
- **Low (cosmetic issues):** Wait for next scheduled update

---

## When to Rollback

### Indicators That Rollback is Needed

✅ **Rollback immediately if:**
- App crashes on startup repeatedly (within 2 minutes)
- Database errors preventing app from loading
- Critical features completely non-functional
- Data corruption detected
- Multiple users reporting same critical issue

⚠️ **Consider rollback if:**
- Important features not working
- Performance significantly degraded
- Security vulnerability introduced
- Compliance requirements broken

❌ **Do NOT rollback for:**
- Minor UI glitches
- Single isolated crash
- Non-critical features not working
- Issues that can be fixed with hotfix

---

## Automatic Recovery

### Built-in Safety Features

MR5 POS includes automatic recovery mechanisms:

#### 1. Crash Detection (Automatic)

If the app crashes **3 times within 2 minutes** after an update:
- System automatically detects repeated crashes
- Triggers automatic rollback to previous version
- Restores database from pre-update backup
- Shows recovery notification to user

**User action required:** None - automatic

#### 2. Database Integrity Check (Automatic)

On every app startup after an update:
- Verifies database is readable
- Runs SQLite integrity check
- Verifies all required tables exist
- Tests database write capability

**If check fails:**
- Automatically restores from pre-update backup
- Shows recovery notification
- Logs error details for investigation

**User action required:** None - automatic

#### 3. Pre-Update Backup (Automatic)

Before **every** update download:
- Creates timestamped database backup
- Stores in `userData/backups/pre-update/`
- Keeps last 5 pre-update backups
- Verifies backup integrity

**Location:**
```
Windows: C:\Users\{Username}\AppData\Roaming\my-nextron-app\backups\pre-update\
```

---

## Manual Rollback Procedures

### Scenario 1: Rollback Single User Machine

**When:** User reports issues after update, but app still runs

**Steps:**

1. **Locate Pre-Update Backup**
   ```
   Navigate to:
   C:\Users\{Username}\AppData\Roaming\my-nextron-app\backups\pre-update\

   Find latest backup (sorted by date):
   pre-update-v1.0.1-2025-01-15-143022.db
   ```

2. **Close MR5 POS Application**
   - Ensure app is completely closed
   - Check Task Manager if needed

3. **Backup Current Database**
   ```
   Navigate to:
   C:\Users\{Username}\AppData\Roaming\my-nextron-app\

   Copy: mr5-pos.db
   Rename to: mr5-pos.db.backup-{date}
   ```

4. **Restore Pre-Update Backup**
   ```
   Copy: pre-update-v1.0.1-{timestamp}.db
   Paste to: C:\Users\{Username}\AppData\Roaming\my-nextron-app\
   Rename to: mr5-pos.db
   ```

5. **Uninstall Current Version**
   - Open Windows Settings → Apps
   - Find "MR5 POS"
   - Click Uninstall

6. **Install Previous Version**
   - Download previous version installer from GitHub Releases
   - Install as normal
   - Launch app and verify it works

7. **Disable Auto-Update (Temporarily)**
   - Open MR5 POS
   - Go to Settings → System → Updates
   - Disable automatic updates
   - Wait for fixed version release

**Estimated Time:** 10-15 minutes

---

### Scenario 2: Rollback All Users (Pull Bad Release)

**When:** Critical bug discovered affecting all users

**Steps:**

1. **Delete GitHub Release**
   ```
   1. Go to: https://github.com/{username}/MR5-POS-v2/releases
   2. Find the problematic release (e.g., v1.0.1)
   3. Click "Delete" on the release
   4. Confirm deletion
   ```

2. **Delete Git Tag**
   ```bash
   # Delete remote tag
   git push --delete origin v1.0.1

   # Delete local tag
   git tag -d v1.0.1
   ```

3. **Notify Users**
   - Send notification about the issue
   - Provide manual rollback instructions
   - ETA for fixed version

4. **Create Hotfix Release**
   ```bash
   # Fix the issue in code
   # Bump version to v1.0.2
   # Create new release (see RELEASE_PROCESS.md)
   ```

**Important:** Users who already installed v1.0.1 will need to manually rollback or wait for v1.0.2.

**Estimated Time:** 30-60 minutes + fix development time

---

## Database Recovery

### Emergency Database Recovery

**When:** Database is corrupted and app won't start

#### Option 1: Restore from Pre-Update Backup (Recommended)

```bash
# 1. Navigate to backup directory
cd C:\Users\{Username}\AppData\Roaming\my-nextron-app\backups\pre-update\

# 2. Find latest backup
dir /O-D

# 3. Copy backup to main location
copy pre-update-v1.0.1-{timestamp}.db ..\mr5-pos.db

# 4. Restart app
```

#### Option 2: Restore from Manual Backup

If you created manual backups:

```bash
# Navigate to backup location
cd C:\Users\{Username}\AppData\Roaming\my-nextron-app\backups\

# List available backups
dir /O-D

# Copy chosen backup
copy backup-2025-01-15-120000.zip ..\

# Extract and restore
# (use 7-Zip or Windows built-in extraction)
```

#### Option 3: Database Repair (Last Resort)

If no backup available:

```bash
# 1. Install SQLite tools
# Download from: https://www.sqlite.org/download.html

# 2. Navigate to database location
cd C:\Users\{Username}\AppData\Roaming\my-nextron-app\

# 3. Run integrity check
sqlite3 mr5-pos.db "PRAGMA integrity_check;"

# 4. Attempt repair
sqlite3 mr5-pos.db ".recover" | sqlite3 mr5-pos-recovered.db

# 5. Replace corrupted database
del mr5-pos.db
ren mr5-pos-recovered.db mr5-pos.db
```

**⚠️ Warning:** Database repair may result in partial data loss.

---

### Database Backup Best Practices

#### Automated Backups (Built-in)

✅ Pre-update backups (automatic before each update)
✅ Crash recovery backups (automatic on failures)

#### Recommended Manual Backups

For critical business operations, also implement:

1. **Daily Backups**
   - Scheduled task to copy database
   - Store on separate drive or cloud storage
   - Retain last 30 days

2. **Pre-Critical Operations**
   - Before bulk data imports
   - Before manual database changes
   - Before training sessions

3. **Cloud Backup Integration**
   - Sync backups to cloud storage
   - Enable versioning
   - Test restore procedures regularly

---

## Prevention Measures

### For Developers

1. **Always Test Updates Thoroughly**
   - Test on clean install
   - Test upgrade from previous version
   - Test with real production data copy
   - Test all critical features

2. **Use Staged Rollouts**
   - Release to 10% of users first
   - Monitor for 24-48 hours
   - Gradually increase if stable

3. **Monitor Post-Release**
   - Track update success rate
   - Monitor crash reports
   - Check error logs
   - User feedback channels

4. **Database Migrations**
   - Always test migrations thoroughly
   - Make migrations reversible
   - Include rollback scripts
   - Test on production data copy

### For Users

1. **Enable Auto-Updates**
   - Keep app up-to-date automatically
   - Benefits from automatic safety features

2. **Create Manual Backups**
   - Before major operations
   - Store in safe location
   - Test restore occasionally

3. **Report Issues Immediately**
   - Don't wait if something breaks
   - Provide detailed information
   - Include steps to reproduce

---

## Recovery Verification Checklist

After any rollback or recovery, verify:

- [ ] App starts successfully
- [ ] Database opens without errors
- [ ] All core features work
  - [ ] Create new order
  - [ ] Process payment
  - [ ] Generate report
  - [ ] User login
- [ ] Data integrity
  - [ ] Recent orders present
  - [ ] Inventory counts correct
  - [ ] User accounts intact
- [ ] No error messages in logs
- [ ] Performance is normal

---

## Rollback Decision Matrix

| Issue Severity | Affected Users | Action | Timeline |
|---------------|---------------|---------|----------|
| **Critical** | All/Most | Pull release + Emergency fix | Immediate (< 1 hour) |
| **Critical** | Single | Manual rollback + Investigation | < 2 hours |
| **High** | All/Most | Pull release + Hotfix | < 4 hours |
| **High** | Few | Provide manual rollback + Hotfix | < 24 hours |
| **Medium** | Any | Hotfix in next release | < 48 hours |
| **Low** | Any | Fix in scheduled release | Next sprint |

---

## Post-Rollback Actions

### Immediate (Within 1 Hour)

1. Verify rollback successful
2. Notify affected users
3. Document the issue
4. Begin root cause analysis

### Short-term (Within 24 Hours)

1. Identify exact cause of failure
2. Develop fix and test thoroughly
3. Create hotfix release
4. Update test procedures to catch similar issues

### Long-term (Within 1 Week)

1. Post-mortem analysis
2. Update testing procedures
3. Improve monitoring/alerting
4. Share lessons learned with team

---

## Support Resources

**User Backups Location:**
```
Windows: C:\Users\{Username}\AppData\Roaming\my-nextron-app\backups\
```

**Logs Location:**
```
Windows: C:\Users\{Username}\AppData\Roaming\my-nextron-app\logs\
```

**Configuration:**
```
Windows: C:\Users\{Username}\AppData\Roaming\my-nextron-app\config.json
```

**Database Location:**
```
Windows: C:\Users\{Username}\AppData\Roaming\my-nextron-app\mr5-pos.db
```

---

## Emergency Contacts

When manual intervention is needed:

1. **Document the issue** with screenshots and logs
2. **Contact development team** with details
3. **Follow provided instructions** carefully
4. **Verify recovery** before resuming operations

**Remember:** The automatic safety features are designed to handle most update issues. Manual rollback should only be needed for edge cases.
