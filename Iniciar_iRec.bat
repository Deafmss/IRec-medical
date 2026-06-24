@echo off
title Iniciar iRec - MVP
echo =======================================================
echo              INICIANDO A PLATAFORMA iREC
echo =======================================================
echo.
echo [1/2] Abrindo o prototipo no seu navegador padrao...
start http://localhost:5173
echo.
echo [2/2] Iniciando o servidor local do React...
echo (Para desligar o servidor, feche esta janela ou aperte Ctrl+C)
echo.
npm run dev -- --host
pause
