# PowerShell script to create admin user in SQLite database
# Run this script to create an admin user with credentials: admin/admin

$dbPath = "$env:APPDATA\my-nextron-app\mr5-pos.db"

Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  MR5 POS - Admin User Creation Script" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if database exists
if (-Not (Test-Path $dbPath)) {
    Write-Host "ERROR: Database not found at: $dbPath" -ForegroundColor Red
    Write-Host "       Please run the application at least once to create the database." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "SUCCESS: Database found: $dbPath" -ForegroundColor Green
Write-Host ""

# Read the SQL from file
$sqlFile = Join-Path $PSScriptRoot "admin-user-sql.txt"

if (Test-Path $sqlFile) {
    Write-Host "SQL commands have been generated in:" -ForegroundColor Cyan
    Write-Host "  $sqlFile" -ForegroundColor White
    Write-Host ""
    Write-Host "Please execute the SQL commands using one of these methods:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "OPTION 1: Use DB Browser for SQLite (Recommended)" -ForegroundColor Green
    Write-Host "  1. Download from: https://sqlitebrowser.org/" -ForegroundColor White
    Write-Host "  2. Open the database file:" -ForegroundColor White
    Write-Host "     $dbPath" -ForegroundColor Gray
    Write-Host "  3. Go to 'Execute SQL' tab" -ForegroundColor White
    Write-Host "  4. Copy and paste the SQL from: $sqlFile" -ForegroundColor White
    Write-Host "  5. Click 'Execute'" -ForegroundColor White
    Write-Host ""
    Write-Host "OPTION 2: The application will auto-create on next startup" -ForegroundColor Green
    Write-Host "  Simply start the MR5 POS application and the admin user" -ForegroundColor White
    Write-Host "  will be created automatically if it does not exist." -ForegroundColor White
    Write-Host ""
    Write-Host "Credentials:" -ForegroundColor Cyan
    Write-Host "  Username: admin" -ForegroundColor White
    Write-Host "  Password: admin" -ForegroundColor White
    Write-Host ""
    Write-Host "WARNING: Please change the password after first login!" -ForegroundColor Yellow
} else {
    Write-Host "ERROR: SQL file not found. Please run:" -ForegroundColor Red
    Write-Host "       node scripts/insert-admin-raw.js" -ForegroundColor White
}

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""
