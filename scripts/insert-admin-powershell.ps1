# PowerShell script to create admin user directly in SQLite database
# This script uses .NET SQLite libraries which are available on Windows

param(
    [string]$Password = "admin"
)

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  MR5 POS - Direct SQLite Admin User Creation" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""

# Determine database path
$appData = $env:APPDATA
$devDbPath = Join-Path $appData "my-nextron-app (development)\mr5-pos.db"
$prodDbPath = Join-Path $appData "my-nextron-app\mr5-pos.db"

$dbPath = ""
if (Test-Path $devDbPath) {
    $dbPath = $devDbPath
    Write-Host "[Step 1/6] Found development database" -ForegroundColor Green
} elseif (Test-Path $prodDbPath) {
    $dbPath = $prodDbPath
    Write-Host "[Step 1/6] Found production database" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Database not found!" -ForegroundColor Red
    Write-Host "Expected locations:" -ForegroundColor Yellow
    Write-Host "  - $devDbPath"
    Write-Host "  - $prodDbPath"
    Write-Host ""
    Write-Host "Please run the application first to create the database." -ForegroundColor Yellow
    exit 1
}

Write-Host "Database path: $dbPath" -ForegroundColor Gray
Write-Host ""

# Function to hash password with bcrypt
function Get-BcryptHash {
    param([string]$plaintext)

    # Use Node.js to hash the password
    $nodeScript = @"
const bcrypt = require('bcryptjs');
bcrypt.hash('$plaintext', 10).then(hash => console.log(hash));
"@

    $tempFile = [System.IO.Path]::GetTempFileName() + ".js"
    Set-Content -Path $tempFile -Value $nodeScript

    try {
        $hash = & node $tempFile 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $hash.Trim()
        } else {
            throw "Failed to hash password"
        }
    } finally {
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
}

Write-Host "[Step 2/6] Hashing password..." -ForegroundColor Cyan
try {
    $hashedPassword = Get-BcryptHash -plaintext $Password
    Write-Host "SUCCESS: Password hashed" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "ERROR: Failed to hash password: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Falling back to pre-generated hash for 'admin'..." -ForegroundColor Yellow
    # Pre-generated hash for "admin" with bcrypt cost 10
    $hashedPassword = '$2b$10$9BJFPucG7v7sKc8m74iOH.CtA3ovgShPx7hDsrXwgKNBnKdCqQRgS'
    Write-Host ""
}

# Generate user ID and timestamp
$userId = "admin-user-$(Get-Date -Format 'yyyyMMddHHmmss')"
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

Write-Host "[Step 3/6] Preparing SQL statements..." -ForegroundColor Cyan

# SQL statements
$checkAdminSQL = "SELECT id, username, email, role FROM users WHERE username = 'admin';"

$insertSQL = @"
INSERT INTO users (id, username, email, password, role, firstName, lastName, isActive, createdAt, updatedAt)
VALUES ('$userId', 'admin', 'admin@mr5pos.local', '$hashedPassword', 'ADMIN', 'Admin', 'User', 1, '$timestamp', '$timestamp');
"@

$updateSQL = @"
UPDATE users SET password = '$hashedPassword', updatedAt = '$timestamp' WHERE username = 'admin';
"@

Write-Host "SUCCESS: SQL prepared" -ForegroundColor Green
Write-Host ""

# Try to use sqlite3.exe if available
Write-Host "[Step 4/6] Looking for SQLite command-line tool..." -ForegroundColor Cyan

$sqlite3Paths = @(
    "sqlite3.exe",
    "C:\Program Files\SQLite\sqlite3.exe",
    "C:\sqlite\sqlite3.exe",
    "$env:LOCALAPPDATA\Programs\SQLite\sqlite3.exe"
)

$sqlite3 = $null
foreach ($path in $sqlite3Paths) {
    if (Get-Command $path -ErrorAction SilentlyContinue) {
        $sqlite3 = $path
        break
    }
}

if ($sqlite3) {
    Write-Host "SUCCESS: Found SQLite at $sqlite3" -ForegroundColor Green
    Write-Host ""

    Write-Host "[Step 5/6] Checking if admin exists..." -ForegroundColor Cyan
    $existing = & $sqlite3 $dbPath $checkAdminSQL 2>&1

    if ($existing -and $existing -match "admin") {
        Write-Host "WARNING: Admin user already exists" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "[Step 6/6] Updating admin password..." -ForegroundColor Cyan
        & $sqlite3 $dbPath $updateSQL 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "SUCCESS: Admin password updated!" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Failed to update password" -ForegroundColor Red
        }
    } else {
        Write-Host "SUCCESS: No existing admin found" -ForegroundColor Green
        Write-Host ""
        Write-Host "[Step 6/6] Creating admin user..." -ForegroundColor Cyan
        & $sqlite3 $dbPath $insertSQL 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "SUCCESS: Admin user created!" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Failed to create admin" -ForegroundColor Red
        }
    }
} else {
    Write-Host "WARNING: SQLite command-line tool not found" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "MANUAL INSTRUCTIONS:" -ForegroundColor Cyan
    Write-Host "=============================================================" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Since SQLite tools are not installed, please run ONE of these SQL statements" -ForegroundColor White
    Write-Host "using DB Browser for SQLite (https://sqlitebrowser.org/):" -ForegroundColor White
    Write-Host ""
    Write-Host "1. Open DB Browser for SQLite" -ForegroundColor Yellow
    Write-Host "2. Open database file: $dbPath" -ForegroundColor Yellow
    Write-Host "3. Go to 'Execute SQL' tab" -ForegroundColor Yellow
    Write-Host "4. Copy and paste ONE of the SQL statements below" -ForegroundColor Yellow
    Write-Host "5. Click 'Execute' (Play button)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "IF ADMIN DOES NOT EXIST YET, use INSERT:" -ForegroundColor Cyan
    Write-Host "=============================================================" -ForegroundColor Gray
    Write-Host $insertSQL -ForegroundColor White
    Write-Host ""
    Write-Host "IF ADMIN ALREADY EXISTS, use UPDATE:" -ForegroundColor Cyan
    Write-Host "=============================================================" -ForegroundColor Gray
    Write-Host $updateSQL -ForegroundColor White
    Write-Host ""

    # Save SQL to file
    $sqlFile = Join-Path $PSScriptRoot "admin-user-manual.sql"
    $sqlContent = @"
-- Admin User Creation SQL
-- Database: $dbPath
-- Generated: $(Get-Date)

-- Check if admin exists:
$checkAdminSQL

-- If admin does NOT exist, run this INSERT:
$insertSQL

-- If admin EXISTS, run this UPDATE:
$updateSQL

-- Verify:
SELECT id, username, email, role, isActive FROM users WHERE username = 'admin';
"@

    Set-Content -Path $sqlFile -Value $sqlContent
    Write-Host "SQL statements saved to: $sqlFile" -ForegroundColor Green
    Write-Host ""
}

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  Login Credentials" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Username: admin" -ForegroundColor White
Write-Host "  Password: $Password" -ForegroundColor White
Write-Host ""
Write-Host "WARNING: Change this password after first login!" -ForegroundColor Yellow
Write-Host ""
