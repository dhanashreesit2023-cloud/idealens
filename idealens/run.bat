@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python is not installed or not on PATH. Install Python 3.10+ from python.org and tick "Add Python to PATH".
  pause
  exit /b 1
)
if not exist venv python -m venv venv
call venv\Scripts\activate
python -m pip install -q -r requirements.txt
if errorlevel 1 (
  echo Package install failed. Check your internet connection and run this file again.
  pause
  exit /b 1
)
echo.
echo IdeaLens is starting. Open http://localhost:8000 in Chrome. Press Ctrl+C to stop.
echo.
python -m uvicorn backend.main:app --reload --port 8000
pause
