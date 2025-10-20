# MR5 POS - Auto-Update System Setup Guide

This guide will help you set up and test the auto-update system.

## Prerequisites

- [x] Application built and tested locally
- [x] GitHub repository with releases
- [ ] Repository visibility set to **Public** (required for auto-updates)

## Step 1: Make Repository Public

**Why?** Auto-updates work best with public repositories. Users can download updates without authentication.

1. Go to: https://github.com/TheElitesSolutions/MR5-POS/settings
2. Scroll down to **"Danger Zone"**
3. Click **"Change visibility"**
4. Select **"Make public"**
5. Type the repository name to confirm
6. Click **"I understand, make this repository public"**

## Step 2: Run Test Script

The test script verifies your update system configuration:

```bash
node test-update-system.js
```

**What it checks:**
- ✓ GitHub repository accessibility
- ✓ Latest release availability
- ✓ Required release assets (exe, blockmap, latest.yml)
- ✓ latest.yml content validity
- ✓ electron-builder.yml configuration
- ✓ package.json version

**Expected output:**
```
╔════════════════════════════════════════════════════╗
║   MR5 POS - Auto-Update System Test Suite        ║
╚════════════════════════════════════════════════════╝

✓ Test 1: Repository accessible
✓ Test 2: Latest release found (v2.1.0)
✓ Test 3: All required assets present
✓ Test 4: latest.yml valid
✓ Test 5: Builder config correct
✓ Test 6: Package version matches

6/6 tests passed
🎉 All tests passed! Auto-update system is ready.
```

## Step 3: Rebuild Application

After making the repository public, rebuild the app:

```bash
# Close any running instances
taskkill //F //IM "MR5 POS.exe"

# Clean and rebuild
yarn build
```

## Step 4: Test Update Check

1. **Run the application:**
   ```bash
   cd dist/win-unpacked
   start "" "MR5 POS.exe"
   ```

2. **Open Developer Tools** (F12 or Ctrl+Shift+I)

3. **Navigate to Settings → Updates tab**

4. **Click "Check for Updates"**

5. **Verify in console:**
   ```
   [useUpdater] Invoking check for updates...
   [useUpdater] Check for updates response: { success: true, ... }
   [AutoUpdater] Update not available
   ```

## Step 5: Test Full Update Workflow

To test the complete update process:

### 5.1 Create a Test Release (v2.1.1)

1. **Update version in package.json:**
   ```json
   "version": "2.1.1"
   ```

2. **Commit and tag:**
   ```bash
   git add package.json
   git commit -m "Bump version to 2.1.1 for update test"
   git push origin main
   git tag -a v2.1.1 -m "Test release v2.1.1"
   git push origin v2.1.1
   ```

3. **Build and upload:**
   ```bash
   yarn build
   gh release create v2.1.1 \
     "dist/MR5 POS Setup 2.1.1.exe" \
     "dist/MR5 POS Setup 2.1.1.exe.blockmap" \
     "dist/latest.yml" \
     --title "v2.1.1 - Update Test" \
     --notes "Test release for auto-update system"
   ```

### 5.2 Test Update Detection

1. **Run v2.1.0** (from previous build)
2. **Click "Check for Updates"**
3. **Should see:** "Update Available - Version 2.1.1"
4. **Click "Download Update"**
5. **Monitor progress bar**
6. **When complete, click "Install and Restart"**
7. **App should restart with v2.1.1**

## Expected Behaviors

### ✅ No Update Available
- Message: "No updates available"
- Toast: "You are running the latest version"

### ✅ Update Available
- Blue notification box appears
- Shows new version number
- Download button enabled
- Skip button available

### ✅ Downloading
- Progress bar shows percentage
- Download speed displayed
- Cancel button available
- Backup created automatically

### ✅ Ready to Install
- Green success notification
- "Install and Restart" button
- Warning about app restart

### ❌ Error States

**"An unknown error occurred"**
- Cause: Repository is private
- Fix: Make repository public

**"Update check failed"**
- Cause: No internet connection or GitHub is down
- Fix: Check network connection

**"No releases found"**
- Cause: No releases published on GitHub
- Fix: Create at least one release

## Troubleshooting

### Issue: "Update Error - An unknown error occurred"

**Solution:**
1. Verify repository is public
2. Run test script: `node test-update-system.js`
3. Check console logs in DevTools (F12)
4. Look for detailed error messages

### Issue: "TypeError: Cannot read properties of undefined"

**Solution:**
Already fixed in latest version. Make sure you're running the rebuilt app.

### Issue: Download fails

**Possible causes:**
1. Firewall blocking downloads
2. Insufficient disk space
3. Antivirus blocking executable

**Solution:**
- Check firewall settings
- Ensure 200MB+ free space
- Add app to antivirus exceptions

### Issue: Update downloads but won't install

**Possible causes:**
1. App running from USB drive (can't replace itself)
2. Admin permissions required
3. Backup failed

**Solution:**
- Install app to C:\Program Files or AppData
- Run as administrator
- Check disk space for backup

## Monitoring

### Check Auto-Update Logs

Logs are written to:
```
C:\Users\{username}\AppData\Roaming\my-nextron-app\logs\
```

Look for messages from `AutoUpdater` and `UpdaterController`.

### Console Messages

Open DevTools (F12) to see:
- `[useUpdater]` - Frontend update state
- `[AutoUpdater]` - Electron updater events
- `[UpdaterController]` - Backend controller logs

## Production Checklist

Before deploying to users:

- [ ] Repository is public
- [ ] All tests pass (`node test-update-system.js`)
- [ ] Latest release (v2.1.0) is available
- [ ] latest.yml is correctly formatted
- [ ] All assets uploaded to release
- [ ] Test update from v2.0.0 → v2.1.0 works
- [ ] Backup system tested
- [ ] Rollback tested (if update fails)

## Automatic Update Checks

The app automatically checks for updates:
- **First check:** 5 minutes after launch
- **Recurring:** Every 6 hours
- **Manual:** Settings → Updates → "Check for Updates"

Users will see a notification when updates are available.

## Security

### Code Signing (Future Enhancement)

For better security and fewer Windows warnings:

1. Get a code signing certificate
2. Update `electron-builder.yml`:
   ```yaml
   win:
     certificateFile: "./certs/certificate.pfx"
     certificatePassword: "${CERTIFICATE_PASSWORD}"
     signingHashAlgorithms: ['sha256']
   ```
3. Rebuild and test

### Private Repository Alternative

If you need to keep the repo private:

1. Set `GH_TOKEN` environment variable
2. Bundle token with app (see updaterController.ts)
3. Test thoroughly

**Note:** Public repos are recommended for desktop apps.

## Support

If you encounter issues:
1. Run `node test-update-system.js`
2. Check console logs (F12)
3. Review `UPDATE_SYSTEM_SETUP.md`
4. Check GitHub release assets

## Next Steps

Once auto-update is working:
1. Monitor update success rates
2. Consider staged rollouts (release to subset of users first)
3. Implement update notifications
4. Add release notes display
5. Track update metrics

---

**Need Help?** Check the console logs and run the test script for diagnostics.
