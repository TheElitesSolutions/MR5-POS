# Manual Admin User Creation Guide

## Problem

The Node.js better-sqlite3 module version mismatch prevents the automated scripts from working. This guide shows you how to create the admin user manually using SQL.

---

## ✅ **Quick Solution: Use DB Browser for SQLite** (Recommended)

### Step 1: Download DB Browser for SQLite

Download from: **https://sqlitebrowser.org/**

It's free, open-source, and works on Windows/Mac/Linux.

### Step 2: Open Your Database

1. Launch DB Browser for SQLite
2. Click "Open Database"
3. Navigate to:
   ```
   C:\Users\<YourUsername>\AppData\Roaming\my-nextron-app (development)\mr5-pos.db
   ```

   **Quick way to get there:**
   - Press `Windows + R`
   - Type: `%APPDATA%\my-nextron-app (development)`
   - Press Enter
   - You should see `mr5-pos.db`

### Step 3: Run the SQL

1. Click the "Execute SQL" tab
2. Copy the INSERT statement below and paste it into the SQL editor
3. Click the "Execute" button (▶️ Play icon)
4. You should see "Query executed successfully"

---

## 📋 **SQL Statement to Create Admin User**

### First, check if admin exists:

```sql
SELECT * FROM users WHERE username = 'admin';
```

### If admin does NOT exist (no results), run this INSERT:

```sql
INSERT INTO users (id, username, email, password, role, firstName, lastName, isActive, createdAt, updatedAt)
VALUES (
    'admin-user-001',
    'admin',
    'admin@mr5pos.local',
    '$2b$10$9BJFPucG7v7sKc8m74iOH.CtA3ovgShPx7hDsrXwgKNBnKdCqQRgS',
    'ADMIN',
    'Admin',
    'User',
    1,
    datetime('now'),
    datetime('now')
);
```

### If admin EXISTS (you see a row), run this UPDATE instead:

```sql
UPDATE users
SET password = '$2b$10$9BJFPucG7v7sKc8m74iOH.CtA3ovgShPx7hDsrXwgKNBnKdCqQRgS',
    updatedAt = datetime('now')
WHERE username = 'admin';
```

### Verify it worked:

```sql
SELECT id, username, email, role, isActive FROM users WHERE username = 'admin';
```

You should see one row with:
- `username`: admin
- `role`: ADMIN
- `isActive`: 1

---

## 🔑 **Login Credentials**

After creating the admin user:

- **Username:** `admin`
- **Password:** `admin`

⚠️ **IMPORTANT: Change this password after first login!**

---

## 📝 **What That Password Hash Means**

The password hash `$2b$10$9BJFPucG7v7sKc8m74iOH.CtA3ovgShPx7hDsrXwgKNBnKdCqQRgS` is:
- The bcrypt hash of the password "admin"
- Salt rounds: 10
- This is secure and cannot be reversed

When you login with "admin", the app will hash your input and compare it to this stored hash.

---

## 🔧 **Alternative: PowerShell Script**

If you have PowerShell, you can run:

```powershell
.\scripts\insert-admin-powershell.ps1
```

This will:
1. Generate a fresh password hash
2. Create SQL statements
3. Try to execute them automatically (if SQLite CLI is installed)
4. Otherwise, provide you with the SQL to run manually

---

## 🆘 **Troubleshooting**

### "Table users doesn't exist"

This means the database schema hasn't been initialized.

**Solution:** Run the application once:
```bash
yarn dev
```

Let it start up completely (you'll see the window), then close it. The schema will be created. Then try the SQL INSERT again.

### "Database is locked"

The application is currently running and has the database open.

**Solution:** Close the MR5 POS application completely, then try again.

### "Cannot find database file"

**Solution:** The database hasn't been created yet. Run:
```bash
yarn dev
```

Let the app start, then close it. The database will be created at:
```
C:\Users\<YourUsername>\AppData\Roaming\my-nextron-app (development)\mr5-pos.db
```

### "Duplicate entry" or "UNIQUE constraint failed"

The admin user already exists!

**Solution:** Use the UPDATE statement instead of INSERT to change the password.

---

## 📱 **DB Browser for SQLite Quick Reference**

### Where to Find Things:

1. **"Open Database"** button - Top left, folder icon
2. **"Execute SQL"** tab - Third tab at the top
3. **Execute button** - Play icon (▶️) or F5 key
4. **Results** - Shows below the SQL editor after execution

### How to Execute SQL:

1. Paste your SQL in the text area
2. Press F5 or click the ▶️ Play button
3. Check the "Results" area below - should say "Query executed successfully"
4. Click "Write Changes" button (top toolbar) to save

---

## ✅ **Verification**

After creating the admin user, verify it worked:

1. **In DB Browser:**
   - Go to "Browse Data" tab
   - Select "users" table from dropdown
   - You should see an admin row

2. **In the App:**
   - Start the app: `yarn dev`
   - Try logging in with username `admin` and password `admin`
   - Should work!

---

## 🎯 **Summary**

1. Download [DB Browser for SQLite](https://sqlitebrowser.org/)
2. Open database file (in AppData/Roaming)
3. Go to "Execute SQL" tab
4. Run the INSERT statement (or UPDATE if admin exists)
5. Click "Write Changes"
6. Login with `admin`/`admin`

**That's it!** 🎉
