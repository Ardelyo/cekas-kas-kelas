@echo off
title Hentikan Layanan CEKAS (Pure Python)
chcp 65001 >nul
echo ==========================================================
echo   Menghentikan semua proses CEKAS Python...
echo ==========================================================

powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*run.py*' -or $_.CommandLine -like '*cekas_app*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo.
echo [OK] Semua proses Web dan Bot CEKAS telah dihentikan.
timeout /t 2 >nul
