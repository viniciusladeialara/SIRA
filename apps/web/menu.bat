@echo off
setlocal EnableDelayedExpansion
title Macro Micro Schedule - Menu de Operacoes

:: Timeout estendido (120s) para analise das Cloud Functions no Windows
set FUNCTIONS_DISCOVERY_TIMEOUT=120000

:: Suporte a argumento direto (ex: menu.bat 1, menu.bat dev, menu.bat hosting)
if "%1"=="1" goto DEV
if /i "%1"=="dev" goto DEV
if "%1"=="2" goto BUILD_FRONT
if /i "%1"=="build" goto BUILD_FRONT
if "%1"=="3" goto BUILD_FUNCS
if "%1"=="4" goto BUILD_ALL
if "%1"=="5" goto DEPLOY_HOSTING
if /i "%1"=="hosting" goto DEPLOY_HOSTING
if "%1"=="6" goto DEPLOY_FUNCTIONS
if /i "%1"=="functions" goto DEPLOY_FUNCTIONS
if "%1"=="7" goto DEPLOY_RULES
if /i "%1"=="rules" goto DEPLOY_RULES
if "%1"=="8" goto DEPLOY_ALL
if /i "%1"=="deploy" goto DEPLOY_ALL
if "%1"=="9" goto GIT_STATUS
if "%1"=="0" goto SAIR

:MENU
cls
echo ====================================================================
echo             MACRO MICRO SCHEDULE - MENU DE OPERACOES
echo ====================================================================
echo.
echo   [1] Iniciar Ambiente de Desenvolvimento Local (npm run dev)
echo   [2] Executar Build do Frontend (npm run build)
echo   [3] Compilar Cloud Functions (npm --prefix functions run build)
echo   [4] Executar Build Completo (Frontend + Functions)
echo.
echo   --- OPCOES DE DEPLOY (FIREBASE) ---
echo   [5] Deploy Apenas HOSTING (Site / Frontend)
echo   [6] Deploy Apenas FUNCTIONS (Cloud Functions)
echo   [7] Deploy Apenas REGRAS (Firestore Rules + Storage)
echo   [8] Deploy COMPLETO (Hosting + Functions + Regras)
echo.
echo   --- UTILITARIOS ---
echo   [9] Verificar Status do Git (git status)
echo   [0] Sair
echo.
echo ====================================================================
set "OPT="
set /p "OPT=Digite o numero da opcao desejada [0-9]: "

if not defined OPT goto MENU
if "%OPT%"=="1" goto DEV
if "%OPT%"=="2" goto BUILD_FRONT
if "%OPT%"=="3" goto BUILD_FUNCS
if "%OPT%"=="4" goto BUILD_ALL
if "%OPT%"=="5" goto DEPLOY_HOSTING
if "%OPT%"=="6" goto DEPLOY_FUNCTIONS
if "%OPT%"=="7" goto DEPLOY_RULES
if "%OPT%"=="8" goto DEPLOY_ALL
if "%OPT%"=="9" goto GIT_STATUS
if "%OPT%"=="0" goto SAIR

echo.
echo [AVISO] Opcao invalida! Escolha um numero de 0 a 9.
ping 127.0.0.1 -n 2 >nul
goto MENU

:DEV
cls
echo ====================================================================
echo Iniciando servidor de desenvolvimento local (npm run dev)...
echo Pressione Ctrl+C para encerrar o servidor.
echo ====================================================================
echo.
call npm run dev
echo.
if not "%1"=="" exit /b 0
pause
goto MENU

:BUILD_FRONT
cls
echo ====================================================================
echo Gerando Build do Frontend (npm run build)...
echo ====================================================================
echo.
call npm run build
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCESSO] Build do Frontend concluido com exito!
) else (
    echo [ERRO] Ocorreu uma falha durante o build do Frontend.
)
echo.
if not "%1"=="" exit /b %ERRORLEVEL%
pause
goto MENU

:BUILD_FUNCS
cls
echo ====================================================================
echo Compilando Cloud Functions (npm --prefix functions run build)...
echo ====================================================================
echo.
call npm --prefix functions run build
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCESSO] Compilacao das Cloud Functions concluida com exito!
) else (
    echo [ERRO] Ocorreu uma falha na compilacao das Cloud Functions.
)
echo.
if not "%1"=="" exit /b %ERRORLEVEL%
pause
goto MENU

:BUILD_ALL
cls
echo ====================================================================
echo Executando Build Completo (Frontend + Cloud Functions)...
echo ====================================================================
echo.
echo [1/2] Compilando Cloud Functions...
call npm --prefix functions run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha na compilacao das Cloud Functions. Operacao cancelada.
    echo.
    if not "%1"=="" exit /b 1
    pause
    goto MENU
)
echo.
echo [2/2] Gerando Build do Frontend...
call npm run build
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCESSO] Build Completo finalizado com sucesso!
) else (
    echo.
    echo [ERRO] Falha durante o build do Frontend.
)
echo.
if not "%1"=="" exit /b %ERRORLEVEL%
pause
goto MENU

:DEPLOY_HOSTING
cls
echo ====================================================================
echo Iniciando Deploy Apenas do HOSTING (Frontend)...
echo ====================================================================
echo.
echo [Passo 1/2] Gerando build atualizado do Frontend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Build do frontend falhou. O deploy foi cancelado.
    echo.
    if not "%1"=="" exit /b 1
    pause
    goto MENU
)
echo.
echo [Passo 2/2] Enviando arquivos para o Firebase Hosting...
call firebase deploy --only hosting
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCESSO] Deploy do Hosting concluido com sucesso!
) else (
    echo [ERRO] Falha no deploy do Hosting.
)
echo.
if not "%1"=="" exit /b %ERRORLEVEL%
pause
goto MENU

:DEPLOY_FUNCTIONS
cls
echo ====================================================================
echo Iniciando Deploy Apenas das CLOUD FUNCTIONS...
echo ====================================================================
echo.
echo [Passo 1/2] Compilando Cloud Functions...
call npm --prefix functions run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Compilacao das Functions falhou. O deploy foi cancelado.
    echo.
    if not "%1"=="" exit /b 1
    pause
    goto MENU
)
echo.
echo [Passo 2/2] Enviando para o Firebase Functions...
call firebase deploy --only functions
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCESSO] Deploy das Cloud Functions concluido com sucesso!
) else (
    echo [ERRO] Falha no deploy das Cloud Functions.
)
echo.
if not "%1"=="" exit /b %ERRORLEVEL%
pause
goto MENU

:DEPLOY_RULES
cls
echo ====================================================================
echo Iniciando Deploy Apenas de REGRAS (Firestore + Storage)...
echo ====================================================================
echo.
call firebase deploy --only firestore:rules,storage
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCESSO] Deploy das regras concluido com sucesso!
) else (
    echo [ERRO] Falha no deploy das regras.
)
echo.
if not "%1"=="" exit /b %ERRORLEVEL%
pause
goto MENU

:DEPLOY_ALL
cls
echo ====================================================================
echo Iniciando Deploy COMPLETO (Hosting + Functions + Regras)...
echo ====================================================================
echo.
echo [Passo 1/3] Compilando Cloud Functions...
call npm --prefix functions run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha na compilacao das Functions. O deploy foi cancelado.
    echo.
    if not "%1"=="" exit /b 1
    pause
    goto MENU
)
echo.
echo [Passo 2/3] Gerando Build do Frontend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha no build do Frontend. O deploy foi cancelado.
    echo.
    if not "%1"=="" exit /b 1
    pause
    goto MENU
)
echo.
echo [Passo 3/3] Enviando tudo para o Firebase...
call firebase deploy
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCESSO] Deploy Completo finalizado com sucesso!
) else (
    echo [ERRO] Ocorreu uma falha no deploy completo.
)
echo.
if not "%1"=="" exit /b %ERRORLEVEL%
pause
goto MENU

:GIT_STATUS
cls
echo ====================================================================
echo Status do Git:
echo ====================================================================
echo.
git status
echo.
if not "%1"=="" exit /b 0
pause
goto MENU

:SAIR
cls
echo Finalizando... Ate logo!
exit /b 0
