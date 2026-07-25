@echo off
title JARVIS Edge AI — Single-Click Launcher
echo ========================================================
echo   Starting JARVIS Edge AI Copilot Backend & Dashboard
echo ========================================================
echo.

cd /d "%~dp0backend"

if not exist ".env" (
    echo [WARNING] .env file not found in backend directory.
    echo Creating default .env file...
    echo GEMMA_API_KEY=YOUR_API_KEY_HERE > .env
)

echo Starting FastAPI Server on http://localhost:8001 ...
start "" http://localhost:8001/

.\venv\Scripts\python.exe server.py
pause
