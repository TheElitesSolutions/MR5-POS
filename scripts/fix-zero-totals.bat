@echo off
REM Migration script to fix orders with $0.00 totals
REM Uses sqlite3 CLI to execute the SQL migration

SET DB_PATH=%APPDATA%\my-nextron-app\mr5-pos.db
SET SCRIPT_DIR=%~dp0

echo Database path: %DB_PATH%
echo.

if not exist "%DB_PATH%" (
    echo ERROR: Database not found at %DB_PATH%
    pause
    exit /b 1
)

echo Running migration to fix $0.00 orders...
echo.

sqlite3 "%DB_PATH%" < "%SCRIPT_DIR%fix-zero-totals.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Migration completed successfully!
) else (
    echo.
    echo Migration failed with error code %ERRORLEVEL%
)

echo.
pause
