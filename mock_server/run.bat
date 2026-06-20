@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo [Mock API] http://localhost:8000 에서 실행 중...
echo 이 창을 닫으면 Mock API 서버가 종료됩니다.
echo.
"%APPDATA%\Python\Python37\Scripts\uvicorn.exe" main:app --port 8000 --reload
pause
