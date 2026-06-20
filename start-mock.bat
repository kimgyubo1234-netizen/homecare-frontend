@echo off
chcp 65001 > nul
echo =============================================
echo  어르신 안전 돌봄 - 로컬 Mock 모드 시작
echo =============================================
echo.

echo [1/2] Mock API 서버 (port 8000) 시작...
start "Mock API Server" "%~dp0mock_server\run.bat"

echo [2/2] 2초 후 Vite 시작...
timeout /t 2 /nobreak > nul

cd /d "%~dp0"
call npm run dev:mock
