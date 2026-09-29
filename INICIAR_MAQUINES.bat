@echo off
setlocal
title Maquines Sur Mallorca
cd /d "%~dp0"

echo.
echo ==========================================
echo       MAQUINES SUR MALLORCA - LOCAL
echo ==========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado en este ordenador.
  echo.
  echo Instala Node.js LTS y vuelve a ejecutar este archivo.
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Primera ejecucion: instalando dependencias...
  echo Esto solo es necesario la primera vez.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] No se pudieron instalar las dependencias.
    pause
    exit /b 1
  )
)

echo.
echo Iniciando MaquinesSurMall...
echo La aplicacion se abrira en http://localhost:5173
echo.
echo IMPORTANTE: no cierres esta ventana mientras uses la aplicacion.
echo Para apagarla, pulsa Ctrl+C.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5173"
call npm run dev -- --host 127.0.0.1

endlocal
