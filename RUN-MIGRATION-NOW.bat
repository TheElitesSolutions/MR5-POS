@echo off
echo ================================================
echo  Fix Historical Orders - Add Delivery Fee to Totals
echo ================================================
echo.
echo This will fix ALL existing orders with $0 totals
echo or incorrect totals missing the delivery fee.
echo.
echo IMPORTANT: Close the POS application before running this!
echo.
pause

cd /d "%~dp0"

echo.
echo Running migration script...
echo.

node scripts\fix-zero-totals.js

echo.
echo ================================================
echo  Migration Complete!
echo ================================================
echo.
echo Please verify:
echo 1. Old orders now show correct totals
echo 2. Delivery orders include delivery fee in total
echo.
pause
