@echo off
REM CEKAS Quick Demo Launcher (Pure Python)
cd /d "%~dp0"

IF EXIST ".venv\Scripts\python.exe" (
    .venv\Scripts\python.exe cekas_demo.py --demo %*
) ELSE (
    python cekas_demo.py --demo %*
)
