# MR5 POS Release Process

This document describes the complete process for releasing new versions of MR5 POS with automatic updates.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Release Checklist](#release-checklist)
- [Creating a Release](#creating-a-release)
- [Post-Release Verification](#post-release-verification)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Setup

1. **GitHub Repository Access**
   - Admin access to the MR5-POS-v2 repository
   - GitHub Personal Access Token with `repo` scope

2. **GitHub Secrets Configuration**
   Navigate to: `Repository Settings → Secrets and variables → Actions`

   Required secrets:
   - `GH_TOKEN`: GitHub Personal Access Token for publishing releases
   - `CERTIFICATE_PASSWORD`: (Optional, for code signing) Password for code signing certificate

3. **Code Signing Certificate** (Recommended for Production)
   - Windows: DigiCert/Sectigo Standard or EV Code Signing Certificate
   - Store certificate file in a secure location (NOT in repository)
   - Configure certificate path in `electron-builder.yml`

4. **Local Development Setup**
   ```bash
   # Install dependencies
   yarn install

   # Verify build works locally
   yarn build:draft
   ```

---

## Release Checklist

### Before Creating a Release

- [ ] All features are tested and working
- [ ] Database migrations (if any) are tested
- [ ] All tests pass: `yarn test`
- [ ] Type checking passes: `yarn type-check`
- [ ] Code is merged to `main` branch
- [ ] CHANGELOG.md is updated with release notes
- [ ] Version number follows semantic versioning

### Semantic Versioning Guide

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, database schema changes
- **MINOR** (1.0.0 → 1.1.0): New features, backwards compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, small improvements

---

## Creating a Release

### Step 1: Update Version Number

Edit `package.json`:
```json
{
  "version": "1.0.1"
}
```

### Step 2: Commit Version Change

```bash
git add package.json
git commit -m "chore: bump version to v1.0.1"
git push origin main
```

### Step 3: Create and Push Git Tag

```bash
# Create annotated tag
git tag -a v1.0.1 -m "Release v1.0.1"

# Push tag to GitHub (this triggers the build)
git push origin v1.0.1
```

### Step 4: Monitor GitHub Actions

1. Go to: `Repository → Actions`
2. Watch the "Build and Release" workflow
3. Verify all steps complete successfully
4. Check for any errors in the logs

### Step 5: Verify GitHub Release

1. Go to: `Repository → Releases`
2. Verify the new release appears
3. Check that installer files are attached:
   - `MR5-POS-Setup-{version}.exe`
   - `latest.yml` (update metadata file)

---

## Post-Release Verification

### Immediate Checks (Within 5 minutes)

- [ ] GitHub Release is published
- [ ] Installer files are downloadable
- [ ] `latest.yml` file contains correct version number

### Auto-Update Testing (Within 1 hour)

1. **Test on Development Machine**
   ```bash
   # Install PREVIOUS version
   # Run the app
   # Wait for update notification (should appear within minutes)
   # Verify update downloads and installs correctly
   ```

2. **Verify Update Flow**
   - Update notification appears
   - Download progress shows
   - Update installs on app restart
   - Database remains intact
   - App opens successfully after update

### Production Monitoring (Within 6-24 hours)

- [ ] Monitor user update adoption rate
- [ ] Check for crash reports or error logs
- [ ] Verify no database corruption reports
- [ ] Monitor rollback occurrences (should be 0)

---

## Update Distribution Timeline

| Time After Release | Expected Behavior |
|-------------------|-------------------|
| Immediate | GitHub Release published |
| 5-10 minutes | First users check for updates |
| Within 1 hour | ~10-20% of active users notified |
| Within 6 hours | ~50-70% of active users notified |
| Within 24 hours | ~90-95% of active users notified |
| Within 1 week | ~99% of users updated |

*Note: Users must be connected to the internet and have the app running for auto-update to work.*

---

## Troubleshooting

### Build Fails in GitHub Actions

**Problem:** Workflow fails with error

**Solutions:**
1. Check GitHub Actions logs for specific error
2. Verify `GH_TOKEN` secret is configured
3. Test build locally: `yarn build:draft`
4. Check `electron-builder.yml` syntax

### Release Not Appearing

**Problem:** Tag pushed but no release created

**Solutions:**
1. Verify tag format is `v*` (e.g., v1.0.1)
2. Check GitHub Actions workflow completed
3. Verify `publish: always` in build command
4. Check repository permissions for GitHub token

### Users Not Receiving Updates

**Problem:** Auto-update not working for users

**Solutions:**
1. Verify `latest.yml` exists in release assets
2. Check user is running production build (not dev)
3. Verify app is code-signed (required for macOS)
4. Check user's internet connection
5. Review auto-updater logs on user machine

### Update Download Fails

**Problem:** Update downloads but fails to install

**Solutions:**
1. Verify installer file is not corrupted
2. Check disk space on user machine
3. Review backup creation logs
4. Verify code signing certificate is valid

### Database Issues After Update

**Problem:** Database corruption or data loss

**Solutions:**
1. Check pre-update backup was created
2. Restore from latest backup (see ROLLBACK.md)
3. Run database integrity check
4. Review migration scripts if schema changed

---

## Emergency Procedures

### Pulling a Bad Release

If a critical bug is discovered after release:

```bash
# 1. Delete the problematic release from GitHub
# Go to: Repository → Releases → Delete release

# 2. Delete the tag
git push --delete origin v1.0.1
git tag -d v1.0.1

# 3. Fix the issue and create a new patch release
# Update version to v1.0.2
# Follow normal release process
```

**Important:** Users who already downloaded the bad version will need manual intervention.

### Rolling Back Users

See [ROLLBACK.md](./ROLLBACK.md) for detailed rollback procedures.

---

## Best Practices

### Testing Strategy

1. **Always test locally first**
   ```bash
   yarn build:draft
   # Install and test the generated installer
   ```

2. **Use draft releases for testing**
   - Create draft release on GitHub
   - Test update flow with draft
   - Publish when verified

3. **Staged Rollout** (Advanced)
   - Release to 10% of users first
   - Monitor for 24-48 hours
   - Gradually increase to 100%

### Database Migrations

If your release includes database schema changes:

1. **Always include migration scripts**
2. **Test migration on backup database first**
3. **Make migrations backwards-compatible when possible**
4. **Document migration in CHANGELOG**

### Release Notes

Good release notes should include:
- What's new
- What's fixed
- What's changed
- Any breaking changes
- Migration instructions (if needed)

Example:
```markdown
## v1.0.1

### New Features
- Added automatic backup before updates
- Improved update notification UI

### Bug Fixes
- Fixed crash on startup for Windows 11 users
- Corrected calculation error in tax totals

### Changes
- Updated minimum Windows version to Windows 10

### Database Changes
- Added new column for update tracking (automatic migration)
```

---

## Support

For issues with the release process:
1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Review GitHub Actions logs
3. Contact the development team

For critical production issues:
1. Follow [ROLLBACK.md](./ROLLBACK.md) immediately
2. Document the issue
3. Create hotfix release ASAP
