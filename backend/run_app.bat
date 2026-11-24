@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" -c "import numpy, sklearn, fastapi" >nul 2>&1
if errorlevel 1 (
  echo Setup is not finished yet. Double-click setup.bat and wait until it says SETUP DONE.
  pause
  exit /b 1
)
echo Starting the app. Your browser will open. Close this window to stop it.
start "" "http://127.0.0.1:8000"
".venv\Scripts\python.exe" -m uvicorn app.main:app --port 8000
pause
