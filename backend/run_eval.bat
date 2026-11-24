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
  for /f "delims=" %%f in ('dir /s /b "%USERPROFILE%\Downloads\Bitext*.csv" 2^>nul') do set "CSV=%%f"
  if defined CSV (
    echo Copying the dataset into the data folder so you never have to find it again...
    copy /Y "%CSV%" "data\" >nul
  )
)
if not defined CSV (
  echo Could not find the Bitext CSV. Copy it into the "data" folder and run this again.
  pause
  exit /b 1
)
echo Running the evaluation (1-3 minutes)...
".venv\Scripts\python.exe" scripts\bitext_eval.py "%CSV%" 1500 > results\last_run.txt 2>&1
type results\last_run.txt
echo.
echo ===== FINISHED. Results are saved in the results folder. =====
pause
