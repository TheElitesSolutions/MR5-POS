# Auto-Update Setup Guide

Quick guide to configure auto-updates for MR5 POS.

## Quick Setup (5 Minutes)

### 1. Configure GitHub Repository Information

Edit `electron-builder.yml`:
```yaml
publish:
  provider: github
  owner: YourGitHubUsername  # ← Change this
  repo: MR5-POS-v2           # ← Verify repository name
  private: true              # ← Set to false if public repo
```

Edit `package.json`:
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/YourGitHubUsername/MR5-POS-v2.git"  // ← Change this
  }
}
```

### 2. Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: `MR5-POS-Release`
4. Scopes: Select `repo` (all repo permissions)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)

### 3. Configure GitHub Secret

1. Go to your repository on GitHub
2. Navigate to: `Settings → Secrets and variables → Actions`
3. Click "New repository secret"
4. Name: `GH_TOKEN`
5. Value: Paste the token from step 2
6. Click "Add secret"

### 4. Test the Setup

```bash
# 1. Update version in package.json
# Change "version": "1.0.0" to "version": "1.0.1"

# 2. Commit and tag
git add package.json
git commit -m "chore: bump version to v1.0.1"
git tag v1.0.1
git push origin main
git push origin v1.0.1

# 3. Watch GitHub Actions
# Go to: Repository → Actions
# Verify "Build and Release" workflow runs successfully

# 4. Check Release
# Go to: Repository → Releases
# Verify v1.0.1 appears with installer files
```

### 5. Verify Auto-Update Works

1. Install the **previous version** (v1.0.0) on a test machine
2. Run the app
3. Wait 5-10 minutes
4. Update notification should appear
5. Click "Download" and verify update works

---

## Configuration Options

### electron-builder.yml

```yaml
# Auto-download updates (recommended)
autoUpdater.autoDownload = true

# Auto-install on app quit (recommended)
autoUpdater.autoInstallOnAppQuit = true

# Allow downgrades (for rollback, recommended)
autoUpdater.allowDowngrade = true

# Update check interval (in background.ts)
updaterController.startAutoUpdateCheck(6) // Check every 6 hours
```

### main/background.ts

```typescript
// Enable/disable auto-updates
updaterController.setAutoUpdate(true);

// Change update check interval (hours)
updaterController.startAutoUpdateCheck(6);
```

---

## Code Signing (Production Requirement)

### Why Code Signing is Important

- **Windows**: Required for auto-updates to work smoothly
- **macOS**: **MANDATORY** - auto-updates won't work without it
- **User Trust**: Prevents "Unknown Publisher" warnings
- **Security**: Proves updates are from you

### Getting a Code Signing Certificate

#### Windows

**Option 1: Standard Code Signing (~$100-300/year)**
- Providers: DigiCert, Sectigo, GlobalSign
- Delivered as .pfx file
- Good for most use cases

**Option 2: EV Code Signing (~$300-500/year)**
- Higher trust level
- Immediate SmartScreen reputation
- Requires hardware USB token
- Best for commercial software

**Setup:**
```yaml
# electron-builder.yml
win:
  certificateFile: "./certs/certificate.pfx"
  certificatePassword: "${CERTIFICATE_PASSWORD}"
  signingHashAlgorithms: ['sha256']
```

```bash
# Add secret in GitHub
CERTIFICATE_PASSWORD=YourCertPassword
```

#### macOS

**Requirements:**
- Apple Developer Account ($99/year)
- Developer ID Application certificate
- Notarization setup

**Setup:**
```yaml
# electron-builder.yml
mac:
  identity: "Developer ID Application: Your Company Name (TEAM_ID)"
  hardenedRuntime: true
  gatekeeperAssess: false
```

---

## Monitoring & Maintenance

### Check Update Status

```bash
# View recent releases
gh release list

# View specific release
gh release view v1.0.1

# Check download stats
gh api repos/{owner}/{repo}/releases/latest
```

### Monitor User Adoption

Track in GitHub:
- Release download counts
- Asset download counts per version

### Update Logs Location

**User machines:**
```
Windows: C:\Users\{User}\AppData\Roaming\my-nextron-app\logs\
```

**Check for:**
- Update check failures
- Download errors
- Installation issues

---

## Troubleshooting

### "Update check failed" in logs

**Cause:** Network issue or GitHub API rate limit

**Solution:**
- Check internet connection
- Verify GH_TOKEN is valid
- Check GitHub API status

### "No update available" but newer version exists

**Cause:** latest.yml not found or version mismatch

**Solution:**
- Verify latest.yml exists in release assets
- Check version in latest.yml matches release tag
- Clear app cache and restart

### Users not receiving updates

**Checklist:**
- [ ] User is running **production** build (not dev)
- [ ] User has **internet connection**
- [ ] App has been **running for >5 minutes**
- [ ] GitHub release is **published** (not draft)
- [ ] `latest.yml` exists in release assets
- [ ] App is **code-signed** (especially macOS)

---

## Best Practices

### Version Numbering

Follow Semantic Versioning (semver):
```
MAJOR.MINOR.PATCH
1.0.0

MAJOR: Breaking changes
MINOR: New features (backwards compatible)
PATCH: Bug fixes
```

### Release Frequency

**Recommended:**
- Patch releases: As needed for critical bugs
- Minor releases: Monthly or bi-weekly
- Major releases: Quarterly or when breaking changes needed

### Testing Before Release

Always test on clean install:
```bash
# Build installer
yarn build:draft

# Install on test machine
# Test all core features
# Test update from previous version
# Only then create real release
```

### Communication

Notify users about:
- Major updates (breaking changes)
- Critical security updates
- Large feature additions

Don't notify for:
- Minor bug fixes
- Internal improvements
- Patch releases

---

## Advanced: Staged Rollout

Release to subset of users first:

1. **Edit latest.yml manually:**
```yaml
version: 1.0.1
stagingPercentage: 10  # Only 10% of users get update
```

2. **Monitor for 24-48 hours**
3. **Increase gradually:** 10% → 50% → 100%

---

## Support

**Documentation:**
- [Release Process](./RELEASE_PROCESS.md) - Detailed release steps
- [Rollback Guide](./ROLLBACK.md) - Emergency procedures
- [electron-updater docs](https://www.electron.build/auto-update)

**Issues:**
- Create issue in GitHub repository
- Include logs from `AppData\Roaming\my-nextron-app\logs\`
- Provide steps to reproduce

---

## Summary Checklist

✅ **Initial Setup** (one-time)
- [ ] Configure repository info in electron-builder.yml
- [ ] Configure repository info in package.json
- [ ] Create GitHub Personal Access Token
- [ ] Add GH_TOKEN secret to repository
- [ ] Test release workflow
- [ ] Obtain code signing certificate (for production)

✅ **Each Release** (ongoing)
- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Test build locally
- [ ] Create git tag and push
- [ ] Verify GitHub Actions succeeds
- [ ] Verify release appears with assets
- [ ] Test auto-update on test machine
- [ ] Monitor user adoption

✅ **Maintenance** (ongoing)
- [ ] Monitor update success rates
- [ ] Review error logs
- [ ] Keep code signing certificate valid
- [ ] Respond to user feedback
- [ ] Plan next release

---

**You're all set! Auto-updates are now configured for MR5 POS.**

Users will automatically receive updates within 6 hours of release, with full data safety protection.
