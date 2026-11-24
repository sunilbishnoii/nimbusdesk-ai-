@echo off
cd /d "%~dp0"
echo ===== ONE-TIME SETUP (run this once) =====
py -3.12 --version >nul 2>&1
if errorlevel 1 (
  echo.
  echo Python 3.12 was not found. Install Python 3.12 from python.org, then run this file again.
  pause
  exit /b 1
)
if not exist ".venv" py -3.12 -m venv .venv
echo Installing packages (needs internet, may take a few minutes)...
".venv\Scripts\python.exe" -m pip install --default-timeout=100 --retries 10 -r requirements.txt
if errorlevel 1 (
  echo.
  echo Download failed - usually the internet. Just double-click setup.bat again.
  pause
  exit /b 1
)
echo.
echo Running self-check...
".venv\Scripts\python.exe" -m pytest -q tests
echo.
echo ===== SETUP DONE. You never need to run this again. =====
pause
