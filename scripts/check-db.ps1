# PowerShell script to check database state
$dbPath = Join-Path $env:APPDATA "my-nextron-app\mr5-pos.db"

Write-Host "🔍 Checking Database: $dbPath" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $dbPath)) {
    Write-Host "❌ Database not found!" -ForegroundColor Red
    exit 1
}

# Download sqlite3.exe if not present
$sqlite3Path = Join-Path $PSScriptRoot "sqlite3.exe"

if (-not (Test-Path $sqlite3Path)) {
    Write-Host "📥 Downloading sqlite3.exe..." -ForegroundColor Yellow
    $url = "https://www.sqlite.org/2024/sqlite-tools-win-x64-3470000.zip"
    $zipPath = Join-Path $env:TEMP "sqlite-tools.zip"

    try {
        Invoke-WebRequest -Uri $url -OutFile $zipPath
        Expand-Archive -Path $zipPath -DestinationPath $PSScriptRoot -Force
        $extractedFolder = Join-Path $PSScriptRoot "sqlite-tools-win-x64-3470000"
        $extractedSqlite = Join-Path $extractedFolder "sqlite3.exe"
        Move-Item $extractedSqlite $sqlite3Path -Force
        Remove-Item -Path $extractedFolder -Recurse -Force
        Remove-Item $zipPath
        Write-Host "✅ sqlite3.exe downloaded" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Failed to download sqlite3.exe" -ForegroundColor Red
        Write-Host "Please install DB Browser for SQLite instead: https://sqlitebrowser.org/" -ForegroundColor Yellow
        exit 1
    }
}

# Check menu_item_inventory links
Write-Host "=== Checking Menu Item Inventory Links ===" -ForegroundColor Cyan
$query1 = "SELECT COUNT(*) as count FROM menu_item_inventory;"
$result1 = & $sqlite3Path $dbPath $query1

Write-Host "Total links: $result1" -ForegroundColor $(if ($result1 -eq "0") { "Red" } else { "Green" })

if ($result1 -ne "0") {
    Write-Host ""
    Write-Host "📋 Sample Links:" -ForegroundColor Cyan
    $query2 = "SELECT mi.name as menu_item, inv.itemName as inventory_item, mii.quantity as qty_needed, inv.unit, inv.currentStock as available FROM menu_item_inventory mii JOIN menu_items mi ON mii.menuItemId = mi.id JOIN inventory inv ON mii.inventoryId = inv.id LIMIT 10;"
    & $sqlite3Path $dbPath -header -column $query2
}
else {
    Write-Host ""
    Write-Host "NO LINKS FOUND - This is why stock isn't changing!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Run this to see available data:" -ForegroundColor Yellow
    Write-Host "1. Menu Items:" -ForegroundColor Cyan
    $query3 = "SELECT id, name, price FROM menu_items WHERE isActive = 1 LIMIT 5;"
    & $sqlite3Path $dbPath -header -column $query3

    Write-Host ""
    Write-Host "2. Inventory Items:" -ForegroundColor Cyan
    $query4 = "SELECT id, itemName, currentStock, unit FROM inventory LIMIT 5;"
    & $sqlite3Path $dbPath -header -column $query4

    Write-Host ""
    Write-Host "To fix: Link menu items to inventory items in the admin panel" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Checking Addon Inventory Links ===" -ForegroundColor Cyan
$query5 = "SELECT COUNT(*) as count FROM addon_inventory_items;"
$result5 = & $sqlite3Path $dbPath $query5
Write-Host "Total addon links: $result5" -ForegroundColor $(if ($result5 -eq "0") { "Yellow" } else { "Green" })

Write-Host ""
Write-Host ("=" * 60)
