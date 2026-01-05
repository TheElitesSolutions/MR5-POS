@echo off
echo ========================================
echo Migration: Add isVisibleOnWebsite Column
echo ========================================
echo.
echo IMPORTANT: Close the POS app first!
echo Press Ctrl+C to cancel if app is running.
echo.
pause

cd /d "%~dp0"
set DB_PATH=%APPDATA%\my-nextron-app\mr5pos.db

echo.
echo Running migration...
node scripts/migrate-add-isVisibleOnWebsite.js

echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================
    echo Migration Complete!
    echo ========================================
    echo.
    echo You can now restart the POS app.
    echo The "Show on Website" toggle will work.
) else (
    echo ========================================
    echo Migration Failed!
    echo ========================================
    echo.
    echo Check the error message above.
)
echo.
pause
