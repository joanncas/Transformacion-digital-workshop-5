@echo off
REM Script de instalación e inicialización para Windows 11
REM Este script instala/actualiza dependencias e inicia backend y frontend

echo ========================================
echo   Setup e Inicialización del Proyecto
echo ========================================
echo.

REM Verificar Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js no está instalado.
    echo Por favor, instala Node.js desde https://nodejs.org/
    pause
    exit /b 1
)

REM Obtener versiones
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo Verificando Node.js y npm...
echo [OK] Node.js version: %NODE_VERSION%
echo [OK] npm version: %NPM_VERSION%
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

REM Instalar dependencias del backend
echo ========================================
echo === BACKEND ===
echo ========================================
echo Instalando/Actualizando dependencias del Backend...
echo Ruta: %BACKEND_PATH%
echo.

cd /d "%BACKEND_PATH%"
if not exist "package.json" (
    echo ERROR: package.json no encontrado en %BACKEND_PATH%
    pause
    exit /b 1
)

call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install falló para el Backend
    pause
    exit /b 1
)

echo [OK] Dependencias del Backend instaladas/actualizadas correctamente
echo.

REM Verificar archivo .env en el backend
if not exist ".env" (
    echo ADVERTENCIA: No se encontró el archivo .env en el backend
    echo Por favor, crea un archivo .env con las siguientes variables:
    echo   PORT=5000
    echo   OPENAI_API_KEY=tu_api_key_de_openai_aqui
    echo   OPENAI_TEMPERATURE=0.2
    echo.
)

REM Instalar dependencias del frontend
echo ========================================
echo === FRONTEND ===
echo ========================================
echo Instalando/Actualizando dependencias del Frontend...
echo Ruta: %FRONTEND_PATH%
echo.

cd /d "%FRONTEND_PATH%"
if not exist "package.json" (
    echo ERROR: package.json no encontrado en %FRONTEND_PATH%
    pause
    exit /b 1
)

call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install falló para el Frontend
    pause
    exit /b 1
)

echo [OK] Dependencias del Frontend instaladas/actualizadas correctamente
echo.

echo ========================================
echo   Todas las dependencias instaladas!
echo ========================================
echo.

REM Preguntar si desea iniciar los servicios
set /p RESPONSE="Deseas iniciar los servicios ahora? (S/N): "

if /i "%RESPONSE%"=="S" goto start_services
if /i "%RESPONSE%"=="Y" goto start_services
if "%RESPONSE%"=="" goto start_services

echo.
echo Para iniciar los servicios manualmente:
echo   Backend:  cd reclutamiento-backend ^&^& npm start
echo   Frontend: cd reclutamiento-frontend ^&^& npm start
echo.
goto end

:start_services
echo.
echo Iniciando servicios...
echo.

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

:end
echo Script completado!
pause

