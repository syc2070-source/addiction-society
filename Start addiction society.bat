@echo off
title Addiction Society Launcher
echo ========================================
echo    중독사회 (Addiction Society) 시작
echo ========================================
echo.

:: 백엔드 서버 실행 (새 창)
echo [1/2] 백엔드 서버 시작 중... (포트 3001)
start "Addiction Society - Backend" cmd /k "cd /d C:\addiction-society\backend && npm run start:dev"

:: 잠시 대기 (백엔드가 먼저 시작되도록)
timeout /t 3 /nobreak > nul

:: 프론트엔드 서버 실행 (새 창)
echo [2/2] 프론트엔드 서버 시작 중... (포트 3000)
start "Addiction Society - Frontend" cmd /k "cd /d C:\addiction-society\frontend && npm start"

echo.
echo ========================================
echo    서버 시작 완료!
echo ========================================
echo.
echo    - 백엔드 API:  http://localhost:3001
echo    - 프론트엔드:   http://localhost:3000
echo.
echo    각 창을 닫으면 해당 서버가 종료됩니다.
echo ========================================
pause