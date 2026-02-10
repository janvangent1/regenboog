@echo off
REM Regenboog Spellen Launcher - Windows batch script
REM Activeert venv en start de Python GUI launcher

setlocal

cd /d "%~dp0"

REM Check if venv exists
if not exist "venv\Scripts\activate.bat" (
    echo Virtual environment niet gevonden!
    echo.
    echo Maak eerst de venv aan met:
    echo   python setup_venv.py
    echo.
    pause
    exit /b 1
)

REM Activate venv
call venv\Scripts\activate.bat

REM Check if activation worked
if errorlevel 1 (
    echo Fout bij activeren van virtual environment.
    pause
    exit /b 1
)

REM Run the launcher
python start_regenboog.py

REM Deactivate venv when done (optional, window closes anyway)
deactivate

endlocal
