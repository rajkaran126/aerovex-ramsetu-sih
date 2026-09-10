@echo off
echo ==============================================
echo  AERO-TWIN — AI-Enabled Digital Twin System
echo ==============================================
echo.

:: Check Python
where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.10+
    pause
    exit /b 1
)

:: Backend
echo [1/2] Starting AERO-TWIN Backend (FastAPI)...
cd backend
pip install -r requirements.txt -q
start cmd /k "title AERO-TWIN Backend & python run_backend.py"
cd ..

:: Wait for backend to start
timeout /t 3 /nobreak > nul

:: Frontend
echo [2/2] Starting AERO-TWIN Frontend (Vite)...
cd frontend
start cmd /k "title AERO-TWIN Frontend & npm run dev"
cd ..

echo.
echo ==============================================
echo  AERO-TWIN is starting up...
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:5173
echo  API Docs: http://localhost:8000/docs
echo ==============================================
echo.
timeout /t 3 /nobreak > nul
start http://localhost:5173
