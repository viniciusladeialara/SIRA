@echo off
setlocal EnableDelayedExpansion
title SIRA - Painel de Controle e Inicializacao (SENAI)

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

if "%1"=="1" goto INICIAR_TUDO
if "%1"=="2" goto INICIAR_DOCKER
if "%1"=="3" goto INICIAR_BACKEND
if "%1"=="4" goto INICIAR_FRONTEND
if "%1"=="5" goto PARAR_TUDO
if "%1"=="6" goto PARAR_DOCKER
if "%1"=="7" goto STATUS
if "%1"=="8" goto ABRIR_NAVEGADOR
if "%1"=="9" goto EXECUTAR_TESTES
if "%1"=="10" goto COMPILAR_TUDO
if "%1"=="11" goto SEED_CARGA
if "%1"=="12" goto SEED_PRODUCAO
if "%1"=="13" goto RESET_BANCO
if "%1"=="14" goto ESPELHAR_BANCO
if "%1"=="15" goto PROMOVER_TESTE
if "%1"=="0" goto SAIR

:MENU
cls
color 0B
echo ===============================================================================
echo        SIRA - SISTEMA INTEGRADO DE RECURSOS ACADEMICOS (SENAI MT)
echo                        PAINEL DE OPERACOES LOCAL
echo ===============================================================================
echo.
echo   [1]  INICIAR SISTEMA COMPLETO (Docker + Delay Seguro + Backend + Frontend)
echo.
echo   --- INICIALIZACAO INDIVIDUAL ---
echo   [2]  Iniciar Apenas Infraestrutura Docker (PostgreSQL 16, Redis 7, pgAdmin 4)
echo   [3]  Iniciar Apenas Backend API (NestJS na porta 3000)
echo   [4]  Iniciar Apenas Frontend Web (Vite / React na porta 5173)
echo.
echo   --- PARADA E ENCERRAMENTO ---
echo   [5]  PARAR TUDO (Encerrar Docker e fechar janelas do Node/SIRA)
echo   [6]  Parar Apenas Conteineres Docker (docker compose down)
echo.
echo   --- SINCRONIZACAO E HOMOLOGACAO (PROD ^<--^> TESTE) ---
echo   [14] Espelhar Producao para Teste (sira -> sira_teste)
echo   [15] Promover Cenarios de Teste para Producao (com Senha Admin)
echo.
echo   --- CARGA SQL E GESTAO DO BANCO DE DADOS ---
echo   [11] Aplicar Seed de Teste de Carga (3 Unidades: Cuiaba, Caceres, Rondonopolis)
echo   [12] Aplicar Seed de Producao Limpa (Apenas RBAC e Roles Essenciais)
echo   [13] Resetar Banco de Dados (docker compose down -v && docker compose up -d)
echo.
echo   --- DIAGNOSTICO E FERRAMENTAS ---
echo   [7]  Verificar Status e Healthcheck dos Servicos
echo   [8]  Abrir Aplicacoes no Navegador (Frontend, pgAdmin, API)
echo   [9]  Executar Testes Automatizados (Auth, RBAC, Conflitos e Sync)
echo   [10] Compilar Todo o Sistema (Build Backend API + Build Frontend Web)
echo.
echo   [0]  Sair
echo.
echo ===============================================================================
set "OPCAO="
set /p "OPCAO=>> Digite a opcao desejada [0-15]: "

if "%OPCAO%"=="1" goto INICIAR_TUDO
if "%OPCAO%"=="2" goto INICIAR_DOCKER
if "%OPCAO%"=="3" goto INICIAR_BACKEND
if "%OPCAO%"=="4" goto INICIAR_FRONTEND
if "%OPCAO%"=="5" goto PARAR_TUDO
if "%OPCAO%"=="6" goto PARAR_DOCKER
if "%OPCAO%"=="7" goto STATUS
if "%OPCAO%"=="8" goto ABRIR_NAVEGADOR
if "%OPCAO%"=="9" goto EXECUTAR_TESTES
if "%OPCAO%"=="10" goto COMPILAR_TUDO
if "%OPCAO%"=="11" goto SEED_CARGA
if "%OPCAO%"=="12" goto SEED_PRODUCAO
if "%OPCAO%"=="13" goto RESET_BANCO
if "%OPCAO%"=="14" goto ESPELHAR_BANCO
if "%OPCAO%"=="15" goto PROMOVER_TESTE
if "%OPCAO%"=="0" goto SAIR

echo.
echo [!] Opcao invalida! Pressione qualquer tecla para retornar ao menu.
pause >nul
goto MENU

:INICIAR_TUDO
cls
echo ===============================================================================
echo [ETAPA 1/4] Subindo Servicos de Infraestrutura via Docker Compose...
echo ===============================================================================
echo.
docker compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha ao iniciar conteineres Docker! Verifique se o Docker esta aberto.
    pause
    goto MENU
)

echo.
echo ===============================================================================
echo [ETAPA 2/4] Delay de Estabilizacao: Aguardando PostgreSQL e Redis inicializarem...
echo ===============================================================================
echo.
echo [i] Aguardando verificacao de saude do PostgreSQL (Healthcheck)...

set /a tentativas=0
:LOOP_HEALTHCHECK
set /a tentativas+=1
timeout /t 2 /nobreak >nul
docker exec sira-postgres pg_isready -U sira_admin -d sira >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] PostgreSQL 16 pronto e respondendo com sucesso!
    goto DOCKER_PRONTO
)

if %tentativas% GEQ 15 (
    echo [AVISO] Banco demorou para responder, prosseguindo com a inicializacao...
    goto DOCKER_PRONTO
)

echo [.] Tentativa %tentativas%/15: Banco de dados inicializando...
goto LOOP_HEALTHCHECK

:DOCKER_PRONTO
echo [OK] Infraestrutura Docker operacional (PostgreSQL :5432, Redis :6379, pgAdmin :8080).
timeout /t 2 /nobreak >nul

echo.
echo ===============================================================================
echo [ETAPA 3/4] Inicializando API Backend (NestJS)...
echo ===============================================================================
echo [i] Abrindo janela dedicada para a API SIRA na porta 3000...
start "SIRA [Backend API :3000]" cmd /k "title SIRA - Backend API :3000 && cd /d "%ROOT_DIR%apps\api" && npm run start:dev"

echo [i] Aguardando 4 segundos para o bootstrap do NestJS...
timeout /t 4 /nobreak >nul

echo.
echo ===============================================================================
echo [ETAPA 4/4] Inicializando Frontend Web (Vite + React)...
echo ===============================================================================
echo [i] Abrindo janela dedicada para o Frontend SIRA na porta 5173...
start "SIRA [Frontend Web :5173]" cmd /k "title SIRA - Frontend Web :5173 && cd /d "%ROOT_DIR%apps\web" && npm run dev"

echo [i] Aguardando 3 segundos para o servidor Vite inicializar...
timeout /t 3 /nobreak >nul

echo.
echo ===============================================================================
echo [SUCESSO] Sistema SIRA totalmente operacional em Localhost!
echo ===============================================================================
echo.
echo   - Frontend Web:   http://localhost:5173
echo   - Backend API:    http://localhost:3000/api/v1
echo   - pgAdmin 4:      http://localhost:8080 (admin@sira.com / Admin@2026)
echo.
echo   - Credenciais SIRA: admin@sira.local / Admin@2026
echo.
echo [i] Abrindo o SIRA no seu navegador padrao...
start http://localhost:5173
if not "%1"=="" exit /b 0
pause
goto MENU

:INICIAR_DOCKER
cls
echo ===============================================================================
echo Subindo conteineres Docker (PostgreSQL 16, Redis 7, pgAdmin 4)...
echo ===============================================================================
echo.
docker compose up -d
echo.
echo [i] Aguardando delay de 5 segundos para estabilizacao...
timeout /t 5 /nobreak >nul
echo.
docker compose ps
echo.
echo [OK] Infraestrutura iniciada.
if not "%1"=="" exit /b 0
pause
goto MENU

:INICIAR_BACKEND
cls
echo ===============================================================================
echo Iniciando Backend API (NestJS na porta 3000)...
echo ===============================================================================
start "SIRA [Backend API :3000]" cmd /k "title SIRA - Backend API :3000 && cd /d "%ROOT_DIR%apps\api" && npm run start:dev"
echo [OK] Processo da API NestJS iniciado em nova janela.
if not "%1"=="" exit /b 0
pause
goto MENU

:INICIAR_FRONTEND
cls
echo ===============================================================================
echo Iniciando Frontend Web (Vite na porta 5173)...
echo ===============================================================================
start "SIRA [Frontend Web :5173]" cmd /k "title SIRA - Frontend Web :5173 && cd /d "%ROOT_DIR%apps\web" && npm run dev"
echo [OK] Processo do Frontend iniciado em nova janela.
if not "%1"=="" exit /b 0
pause
goto MENU

:PARAR_TUDO
cls
echo ===============================================================================
echo Parando todos os servicos do SIRA (Docker + Processos Node)...
echo ===============================================================================
echo.
echo [1/2] Parando conteineres Docker...
docker compose down
echo.
echo [2/2] Fechando janelas ativas da API e Frontend SIRA...
taskkill /F /FI "WINDOWTITLE eq SIRA*" >nul 2>&1
echo.
echo [OK] Todos os servicos foram encerrados com sucesso!
if not "%1"=="" exit /b 0
pause
goto MENU

:PARAR_DOCKER
cls
echo ===============================================================================
echo Parando conteineres Docker...
echo ===============================================================================
echo.
docker compose down
echo.
echo [OK] Conteineres parados.
if not "%1"=="" exit /b 0
pause
goto MENU

:STATUS
cls
echo ===============================================================================
echo STATUS DOS SERVICOS SIRA
echo ===============================================================================
echo.
echo [1] Conteineres Docker:
docker compose ps
echo.
echo [2] Teste de Conectividade do Banco de Dados:
docker exec sira-postgres pg_isready -U sira_admin -d sira
echo.
echo [3] Portas em Escuta:
netstat -ano | findstr ":3000 :5173 :5432 :6379 :8080"
echo.
if not "%1"=="" exit /b 0
pause
goto MENU

:ABRIR_NAVEGADOR
cls
echo ===============================================================================
echo Abrindo aplicacoes do SIRA no navegador...
echo ===============================================================================
echo.
echo [1] Frontend Web: http://localhost:5173
start http://localhost:5173
echo [2] pgAdmin 4: http://localhost:8080
start http://localhost:8080
echo [3] API Backend: http://localhost:3000/api/v1
start http://localhost:3000/api/v1
echo.
echo [OK] Abas abertas no navegador.
if not "%1"=="" exit /b 0
pause
goto MENU

:EXECUTAR_TESTES
cls
echo ===============================================================================
echo Executando Bateria de Testes Automatizados (Auth, RBAC e Conflitos)...
echo ===============================================================================
echo.
cd /d "%ROOT_DIR%apps\api"
node test-academic-flow.mjs
cd /d "%ROOT_DIR%"
echo.
if not "%1"=="" exit /b 0
pause
goto MENU

:COMPILAR_TUDO
cls
echo ===============================================================================
echo Compilando API Backend e Frontend Web...
echo ===============================================================================
echo.
echo [1/2] Compilando Backend API (NestJS)...
call npm run build:api
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha no build da API.
    if not "%1"=="" exit /b 1
    pause
    goto MENU
)
echo.
echo [2/2] Compilando Frontend Web (Vite + React)...
call npm run build:web
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha no build do Frontend.
    if not "%1"=="" exit /b 1
    pause
    goto MENU
)
echo.
echo [SUCESSO] Todo o sistema foi compilado com 0 erros!
if not "%1"=="" exit /b 0
pause
goto MENU

:SEED_CARGA
cls
echo ===============================================================================
echo Aplicando Seed de Teste de Carga (02_seed_teste_carga.sql)...
echo Injetando 3 Unidades SENAI (Cuiaba, Caceres, Rondonopolis), Cursos, Ambientes, etc.
echo ===============================================================================
echo.
docker exec -i sira-postgres psql -U sira_admin -d sira < "%ROOT_DIR%database\seeds\02_seed_teste_carga.sql"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCESSO] Seed de teste de carga aplicado com exito!
) else (
    echo.
    echo [ERRO] Falha ao aplicar o seed de teste de carga.
)
if not "%1"=="" exit /b 0
pause
goto MENU

:SEED_PRODUCAO
cls
echo ===============================================================================
echo Aplicando Seed de Producao Limpa (01_seed_producao.sql)...
echo Injetando Roles RBAC, Permissoes Essenciais e Configuracoes Globais...
echo ===============================================================================
echo.
docker exec -i sira-postgres psql -U sira_admin -d sira < "%ROOT_DIR%database\seeds\01_seed_producao.sql"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCESSO] Seed de producao limpa aplicado com exito!
) else (
    echo.
    echo [ERRO] Falha ao aplicar o seed de producao.
)
if not "%1"=="" exit /b 0
pause
goto MENU

:RESET_BANCO
cls
echo ===============================================================================
echo ATENCAO: Esta operacao ira limpar todos os volumes do PostgreSQL e recriar
echo todos os schemas e tabelas a partir dos scripts em database/init/!
echo ===============================================================================
set "CONFIRMA="
set /p "CONFIRMA=Deseja realmente continuar? (S/N): "
if /i not "%CONFIRMA%"=="S" goto MENU
echo.
echo [1/3] Parando conteineres e destruindo volumes antigos...
docker compose down -v
echo.
echo [2/3] Subindo conteineres com inicializacao automatica das tabelas...
docker compose up -d
echo.
echo [3/3] Aguardando banco inicializar...
timeout /t 6 /nobreak >nul
docker exec sira-postgres pg_isready -U sira_admin -d sira
echo.
echo [SUCESSO] Banco de dados SIRA resetado e recriado com sucesso!
if not "%1"=="" exit /b 0
pause
goto MENU

:ESPELHAR_BANCO
cls
echo ===============================================================================
echo Espelhando Producao para Teste (sira -> sira_teste)...
echo ===============================================================================
echo.
call node scripts\mirror-prod-to-test.mjs
echo.
if not "%1"=="" exit /b 0
pause
goto MENU

:PROMOVER_TESTE
cls
echo ===============================================================================
echo Promover Cenarios de Teste para Producao (com Senha Admin)
echo ===============================================================================
echo.
call node scripts\promote-test-to-prod.mjs
echo.
if not "%1"=="" exit /b 0
pause
goto MENU

:SAIR
cls
echo Encerrando painel de operacoes SIRA.
exit /b 0
