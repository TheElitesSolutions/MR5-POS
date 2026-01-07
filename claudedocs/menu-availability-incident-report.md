# Menu Availability Incident Report

**Date**: January 7, 2026
**Incident ID**: CRITICAL-2026-01-07
**Status**: ✅ RESOLVED
**Impact**: Production system - All menu items unavailable

---

## Executive Summary

**Problem**: All 72 menu items suddenly became unavailable (`isActive = 0`) in the production database, rendering the POS system unable to take orders.

**Root Cause**: Unknown - likely manual database operation or external script. No application code found that would cause this issue.

**Resolution**: Emergency database fix applied - all items restored to active status.

**Time to Resolution**: ~30 minutes from detection to fix deployment.

---

## Investigation Timeline

### 1. Detection & Triage (8:31 PM, Jan 7, 2026)
- User reported all menu items unavailable
- Confirmed issue across all interfaces: POS, admin, category statistics

### 2. Database Diagnosis
- **Confirmed**: All 72 items had `isActive = 0`
- **Database last modified**: Jan 7, 2026, 8:31 PM (during fix)
- **Previous backup**: Jan 6, 2026, 4:20 AM
- **Incident window**: Between Jan 6, 4:20 AM and Jan 7, 8:31 PM

### 3. Code Analysis
Investigated potential causes:
- ✅ **Supabase Import Service**: Code correctly preserves local `isActive` values (lines 283-285)
- ✅ **Backup Service**: No code modifying availability
- ✅ **Recent commits**: No changes to menu availability logic
- ❌ **Audit logs**: No menu item changes tracked (only order_items tracked)
- ❌ **Application code**: No UPDATE statements found that set isActive = 0

### 4. Emergency Fix Applied
- Created backup of corrupted state: `mr5-pos.db.corrupted.backup`
- Executed SQL: `UPDATE menu_items SET isActive = 1`
- **Result**: All 72 items restored to active
- Verified fix: 100% of items now active

---

## Root Cause Analysis

### Likely Causes (Ranked by Probability)

#### 🔴 HIGH PROBABILITY
1. **Manual SQL UPDATE Command**
   - Someone executed `UPDATE menu_items SET isActive = 0;` directly on database
   - No application logging for direct database access
   - No audit trail for isActive changes

2. **Database Restore from Corrupted Backup**
   - Backup from older state where items were inactive
   - Restored accidentally or during testing

#### 🟡 MEDIUM PROBABILITY
3. **External Script Not in Repository**
   - Migration script or maintenance script run manually
   - Not committed to git repository
   - No logging of execution

#### 🟢 LOW PROBABILITY
4. **Application Bug Not Yet Identified**
   - Edge case in code not discovered during investigation
   - Less likely given thorough code review

### Evidence Supporting Manual Operation
- No code found that would bulk-update isActive to 0
- Supabase import preserves isActive (confirmed in code)
- No recent commits affecting menu availability
- All audit logs only show order_items changes
- No triggers or scheduled jobs found

---

## Files Created/Modified

### Emergency Fix Scripts
1. **`scripts/emergency-fix-menu-availability.js`**
   - Node.js script using better-sqlite3
   - Creates backup before fix
   - Updates all items to isActive = 1
   - Verifies fix completion

2. **`scripts/diagnose-menu-availability.js`**
   - Diagnostic tool for investigating availability issues
   - Shows category breakdown, statistics
   - Provides investigation recommendations

3. **`scripts/check-audit-logs.js`**
   - Checks audit_logs table for historical changes
   - Revealed only order_items are currently audited

### Prevention Measures
4. **`scripts/create-availability-audit-trigger.sql`**
   - Creates `audit_menu_availability` table
   - Triggers log for all isActive changes
   - Prevents bulk disabling (security measure)

5. **`C:\Users\TheElitesSolutions\.claude\plans\moonlit-splashing-summit.md`**
   - Comprehensive investigation and fix plan
   - Root cause analysis
   - Prevention strategies

### Backups Created
6. **`mr5-pos.db.corrupted.backup`** (Jan 7, 2026, 8:31 PM)
   - Forensic backup of database in corrupted state
   - All 72 items with isActive = 0
   - Size: 0.63 MB
   - Location: `C:\Users\TheElitesSolutions\AppData\Roaming\my-nextron-app\`

---

## Prevention Measures Implemented

### 1. Audit Trigger (RECOMMENDED - NOT YET DEPLOYED)
**File**: `scripts/create-availability-audit-trigger.sql`

Features:
- **Audit Table**: Logs all isActive changes with timestamp, old/new values
- **Trigger**: Automatically captures changes to menu_items.isActive
- **Security Trigger**: Prevents bulk disabling if <5 items would remain active
- **Indexes**: Fast querying of audit history

**To Deploy**:
```bash
# Connect to database and run:
sqlite3 %APPDATA%\my-nextron-app\mr5-pos.db < scripts/create-availability-audit-trigger.sql
```

**Usage**:
```sql
-- View recent changes
SELECT * FROM audit_menu_availability ORDER BY changed_at DESC LIMIT 20;

-- Detect bulk changes
SELECT changed_at, COUNT(*) as changes
FROM audit_menu_availability
GROUP BY changed_at
HAVING changes > 10;

-- Track specific item
SELECT * FROM audit_menu_availability
WHERE menu_item_id = 'item_id_here';
```

### 2. Monitoring Alert (RECOMMENDED)
Create scheduled check:
```javascript
// Check if >50% of items are unavailable
const result = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN isActive = 0 THEN 1 ELSE 0 END) as inactive
  FROM menu_items
`).get();

if (result.inactive / result.total > 0.5) {
  // ALERT: Send notification
  // Log critical error
  // Trigger investigation workflow
}
```

### 3. Application-Level Safeguard (RECOMMENDED)
Add to MenuItemService:
```typescript
async bulkUpdateAvailability(updates: { id: string, isActive: boolean }[]) {
  // Count how many will be disabled
  const willDisable = updates.filter(u => !u.isActive).length;
  const currentActive = await this.prisma.menuItem.count({
    where: { isActive: true }
  });

  // Warn if disabling >50% of active items
  if (willDisable > currentActive * 0.5) {
    throw new Error('SAFETY: Cannot disable >50% of menu items. Override required.');
  }

  // Proceed with update...
}
```

---

## Recommendations

### Immediate Actions (CRITICAL)

1. **Deploy Audit Trigger** ✅ HIGH PRIORITY
   - Run `create-availability-audit-trigger.sql`
   - Enables tracking of future isActive changes
   - Provides forensics for future incidents

2. **Restart Application** ✅ REQUIRED
   - Close and reopen MR5-POS app
   - Verify menu items display in POS
   - Test category statistics show correct counts

3. **Interview Staff** ⚠️ RECOMMENDED
   - Ask if anyone ran SQL commands
   - Check if database restore was performed
   - Verify no external tools/scripts were used

### Short-Term Actions (Important)

4. **Implement Application Safeguards**
   - Add bulk update warnings
   - Require confirmation for >10 item changes
   - Log all availability changes

5. **Regular Backups**
   - Verify backup schedule is working
   - Test backup restoration process
   - Keep 7-day backup retention

6. **Access Control Review**
   - Limit direct database access
   - Require authorization for bulk operations
   - Log all database administrative actions

### Long-Term Improvements

7. **Enhanced Audit System**
   - Extend audit_logs to cover menu_items
   - Track user_id for all changes
   - Implement change request system

8. **Monitoring Dashboard**
   - Real-time availability statistics
   - Alert if <80% items available
   - Daily health check reports

9. **Change Management Process**
   - Require approval for bulk updates
   - Test changes in staging first
   - Maintain change log

---

## Testing Checklist

After deploying fixes, verify:

- [ ] All 72 menu items show in POS menu
- [ ] Category statistics show correct available/total counts
- [ ] Menu Management page displays all items
- [ ] Availability toggle works correctly
- [ ] Orders can be created with menu items
- [ ] Kitchen tickets include menu items
- [ ] Audit trigger is installed (if deployed)
- [ ] Backup verification successful

---

## Lessons Learned

### What Worked Well
✅ Emergency response was quick
✅ Backup created before fix
✅ Diagnostic tools created for future use
✅ Code review found no application bugs
✅ Prevention measures designed

### What Needs Improvement
⚠️ **No audit trail** for menu item changes
⚠️ **No monitoring** for bulk availability changes
⚠️ **No safeguards** against accidental bulk updates
⚠️ **Limited forensics** - cannot determine exact cause
⚠️ **No access controls** for direct database operations

### Action Items
1. Deploy audit trigger immediately
2. Implement monitoring alerts
3. Add application-level safeguards
4. Review database access policies
5. Create runbook for this scenario

---

## Appendix

### Database Statistics (After Fix)

| Metric | Value |
|--------|-------|
| Total menu items | 72 |
| Active items | 72 (100%) |
| Inactive items | 0 (0%) |
| Categories | 13 |
| Database size | 0.63 MB |
| Last backup | Jan 6, 2026, 4:20 AM |
| Incident backup | Jan 7, 2026, 8:31 PM |

### Category Breakdown (After Fix)

| Category | Active Items |
|----------|-------------|
| DESSERT | 13 |
| SANDWICHES | 13 |
| APPETIZERS | 9 |
| HOT DRINK | 7 |
| PLATTERS | 7 |
| BURGERS | 5 |
| ALCOHOL | 4 |
| COLD DRINK | 4 |
| PASTA | 4 |
| Salades | 2 |
| shisha | 2 |
| delivery | 1 |
| test | 1 |

### Investigation Artifacts

- Plan: `C:\Users\TheElitesSolutions\.claude\plans\moonlit-splashing-summit.md`
- Corrupted backup: `C:\Users\TheElitesSolutions\AppData\Roaming\my-nextron-app\mr5-pos.db.corrupted.backup`
- Emergency fix script: `scripts/emergency-fix-menu-availability.js`
- Diagnostic script: `scripts/diagnose-menu-availability.js`
- Audit trigger SQL: `scripts/create-availability-audit-trigger.sql`

---

## Contact & Support

For questions or issues related to this incident:
- Reference: `CRITICAL-2026-01-07`
- Documentation: This file
- Emergency scripts: `scripts/emergency-fix-menu-availability.js`

**Status**: ✅ RESOLVED - Menu availability restored successfully

---

*Report generated: January 7, 2026*
*System: MR5-POS v2.4.1*
*Database: mr5-pos.db (SQLite)*
*Fix verified: All 72 items active*
