@echo off
REM CEKAS Interactive Menu Launcher (Pure Python)
cd /d "%~dp0"

IF EXIST ".venv\Scripts\python.exe" (
    .venv\Scripts\python.exe cekas_demo.py %*
) ELSE (
    python cekas_demo.py %*
)
