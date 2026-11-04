@echo off
title CEKAS • Catatan Keuangan Kelas XI-F2 (Pure Python Edition)
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================================
echo   CEKAS (Catatan Keuangan Kelas XI-F2) - PURE PYTHON
echo   SMA Kartika XIX-1 Bandung
echo ==========================================================
echo.
echo [*] Memulai Web Dashboard Python (http://127.0.0.1:8000)
echo [*] dan Telegram Bot (@kacekasbot)...
echo [*] Tekan Ctrl+C untuk menghentikan semua layanan.
echo.

IF EXIST ".venv\Scripts\python.exe" (
    .venv\Scripts\python.exe run.py all
) ELSE (
    python run.py all
)

pause
