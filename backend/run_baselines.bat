@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" -c "import numpy, sklearn, fastapi" >nul 2>&1
if errorlevel 1 (
  echo Setup is not finished yet. Double-click setup.bat and wait until it says SETUP DONE.
  pause
  exit /b 1
)
set "CSV="
for %%f in ("data\Bitext*.csv") do set "CSV=%%f"
if not defined CSV (
  echo Copy the Bitext CSV into the "data" folder first.
  pause
  exit /b 1
)
echo Step 1 of 2: building the knowledge base and intent results (1-3 minutes)...
".venv\Scripts\python.exe" scripts\bitext_eval.py "%CSV%" 1500 > results\last_run.txt 2>&1
echo Step 2 of 2: baseline comparison and refusal test (1-3 minutes)...
".venv\Scripts\python.exe" scripts\baselines_eval.py "%CSV%" 1500 > results\baselines_run.txt 2>&1
type results\baselines_run.txt
echo.
echo ===== FINISHED. Results are in the results folder. =====
pause
