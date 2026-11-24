@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" -c "import numpy, sklearn, fastapi" >nul 2>&1
if errorlevel 1 (
  echo Setup is not finished yet. Double-click setup.bat and wait until it says SETUP DONE.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m pytest -q tests
pause
