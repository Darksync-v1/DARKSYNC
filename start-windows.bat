@echo off
chcp 65001 >nul
title DARKSYNC V2
echo ====================================
echo          DARKSYNC V2
echo ====================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден.
  echo Установи Node.js LTS с официального сайта https://nodejs.org/
  echo Затем закрой это окно и снова запусти start-windows.bat
  pause
  exit /b 1
)
if not exist node_modules (
  echo Первый запуск: устанавливаем компоненты...
  call npm install
  if errorlevel 1 (
    echo Не удалось установить компоненты. Проверь интернет и Node.js.
    pause
    exit /b 1
  )
)
echo Запускаем DARKSYNC...
call npm start
pause
