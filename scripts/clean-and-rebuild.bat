@echo off
echo ========================================
echo Clean and Rebuild Script
echo ========================================
echo.

REM Step 1: Kill any running Node processes
echo [1/5] Stopping all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
timeout /t 3 /nobreak >nul
echo Done.
echo.

REM Step 2: Clean dist folder
echo [2/5] Cleaning dist folder...
if exist "dist" (
    rmdir /s /q "dist" 2>nul
    timeout /t 2 /nobreak >nul
)
echo Done.
echo.

REM Step 3: Clean .next folder
echo [3/5] Cleaning .next folder...
if exist "renderer\.next" (
    rmdir /s /q "renderer\.next" 2>nul
    timeout /t 2 /nobreak >nul
)
echo Done.
echo.

REM Step 4: Clean app folder
echo [4/5] Cleaning app folder...
if exist "app" (
    rmdir /s /q "app" 2>nul
    timeout /t 2 /nobreak >nul
)
echo Done.
echo.

REM Step 5: Rebuild
echo [5/5] Rebuilding application...
call yarn build
echo.

echo ========================================
echo Rebuild complete!
echo ========================================
pause
