@echo off
REM Script para iniciar backend y frontend (requiere dependencias ya instaladas)
REM Este script solo inicia los servicios sin instalar dependencias

echo ========================================
echo   Iniciando Servicios del Proyecto
echo ========================================
echo.

REM Obtener la ruta del script actual
set SCRIPT_PATH=%~dp0
set BACKEND_PATH=%SCRIPT_PATH%reclutamiento-backend
set FRONTEND_PATH=%SCRIPT_PATH%reclutamiento-frontend

REM Verificar que las carpetas existan
if not exist "%BACKEND_PATH%" (
    echo ERROR: No se encontró la carpeta del backend: %BACKEND_PATH%
    pause
    exit /b 1
)

if not exist "%FRONTEND_PATH%" (
    echo ERROR: No se encontró la carpeta del frontend: %FRONTEND_PATH%
    pause
    exit /b 1
)

REM Verificar que node_modules existan
if not exist "%BACKEND_PATH%\node_modules" (
    echo ERROR: Las dependencias del backend no están instaladas.
    echo Ejecuta primero: setup-and-start.bat
    pause
    exit /b 1
)

if not exist "%FRONTEND_PATH%\node_modules" (
    echo ERROR: Las dependencias del frontend no están instaladas.
    echo Ejecuta primero: setup-and-start.bat
    pause
    exit /b 1
)

REM Iniciar backend
echo Iniciando Backend en http://localhost:5000...
start "Backend - Reclutamiento" cmd /k "cd /d %BACKEND_PATH% && npm start"

REM Esperar un poco antes de iniciar el frontend
timeout /t 3 /nobreak >nul

REM Iniciar frontend
echo Iniciando Frontend en http://localhost:3000...
start "Frontend - Reclutamiento" cmd /k "cd /d %FRONTEND_PATH% && npm start"

echo.
echo ========================================
echo   Servicios iniciados correctamente!
echo ========================================
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Los servicios se han abierto en ventanas separadas.
echo Presiona Ctrl+C en cada ventana para detener los servicios.
echo.
pause

