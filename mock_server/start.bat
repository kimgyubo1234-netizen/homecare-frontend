@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo [Mock Server] 시작합니다...
echo [Mock Server] 주소: http://localhost:8000
echo [Mock Server] 종료: Ctrl+C
echo.
py -m uvicorn main:app --reload --port 8000
