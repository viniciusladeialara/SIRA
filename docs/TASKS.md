# SIRA – Matriz Operacional de Tarefas (TASKS.md)
## Backlog de Engenharia & Acompanhamento de Fases

---

### Legenda de Status
- `[x]` **Concluído**
- `[>]` **Em Progresso**
- `[ ]` **Pendente**
- `[!]` **Bloqueado**

---

## 📌 Fase 1: Infraestrutura & Fundação Técnica `[STATUS: CONCLUÍDO]`

| ID | Tarefa | Responsável | Status | Entregável / Verificação |
| :---: | :--- | :---: | :---: | :--- |
| **F1-01** | Estruturação de diretórios do Monorepo Modular (`apps`, `core`, `modules`, `infrastructure`, etc.) | Antigravity | `[x]` | Inspeção do sistema de arquivos |
| **F1-02** | Criação do `docker-compose.yml` consolidado na raiz (Postgres, pgAdmin, Redis) | Antigravity | `[x]` | `docker compose ps` |
| **F1-03** | Definição das variáveis de ambiente (`.env` e `.env.example`) | Antigravity | `[x]` | Validação de credenciais e portas |
| **F1-04** | Configuração do `.gitignore` para Node, Nest, Next, Prisma e Docker | Antigravity | `[x]` | `git status` |
| **F1-05** | Criação do script SQL de extensões (`01_extensions.sql`) | Antigravity | `[x]` | `uuid-ossp`, `pgcrypto`, `unaccent` |
| **F1-06** | Criação do script de 6 schemas lógicos (`02_schemas.sql`) | Antigravity | `[x]` | `core`, `academico`, `planejamento`, `producao`, `relatorios`, `auditoria` |
| **F1-07** | Modelagem das tabelas do schema `core` (`03_core_tables.sql`) | Antigravity | `[x]` | `unidades`, `usuarios`, `perfis`, `permissoes`, RBAC |
| **F1-08** | Modelagem da tabela imutável de auditoria (`04_auditoria_tables.sql`) | Antigravity | `[x]` | `auditoria.logs` com JSONB diff |
| **F1-09** | Carga inicial de dados (`05_seed_data.sql`) | Antigravity | `[x]` | Unidades SENAI (CBA, CAC, ROO, SNP), admin e perfis |
| **F1-10** | Configuração de auto-descoberta do pgAdmin (`servers.json`) | Antigravity | `[x]` | Servidor pré-carregado no console web |
| **F1-11** | Teste de conectividade e healthcheck dos contêineres | Antigravity | `[x]` | Postgres (5432), pgAdmin (8080), Redis (6379) |
| **F1-12** | Versionamento e commit inicial no Git | Antigravity | `[x]` | Commit `e44e9e7` |
| **F1-13** | Reestruturação do PRD oficial e documentação operacional | Antigravity | `[x]` | `docs/PRD.md` e `README.md` |

---

## 🚀 Fase 2: CORE, Autenticação & API NestJS `[STATUS: CONCLUÍDO]`

### 2.1 Scaffolding & Setup da API Backend
- [x] **F2-01**: Inicialização da aplicação NestJS dentro de `apps/api` via CLI `@nestjs/cli`.
- [x] **F2-02**: Configuração de scripts (`build`, `start:dev`, `test`, `lint`) e padronização do `tsconfig.json`.
- [x] **F2-03**: Instalação e configuração do **Prisma ORM** (`@prisma/client`, `prisma`).
- [x] **F2-04**: Introspecção declarativa dos schemas `core`, `auditoria`, `academico` e `planejamento` no `schema.prisma`.
- [x] **F2-05**: Criação do serviço global singleton `PrismaService` com gerenciamento de lifecycle (`$connect`, `$disconnect`).

### 2.2 Módulo de Cache & Redis
- [x] **F2-06**: Integração com Redis via `ioredis` e `@nestjs/config` com lifecycle de desconexão limpa.
- [x] **F2-07**: Criação do serviço global `RedisCacheService` com métodos genéricos (`get`, `set`, `del`, `delPattern`, `addToDenylist`, `isTokenDenylisted`, `checkRateLimit`).

### 2.3 Autenticação & Segurança (JWT + Refresh Token)
- [x] **F2-08**: Instalação de dependências de segurança (`@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `class-validator` e tipagens).
- [x] **F2-09**: Criação do `AuthModule`, `AuthService` e `AuthController` em conformidade com Clean Architecture.
- [x] **F2-10**: Implementação da rota `POST /auth/login` (validação bcrypt, emissão de JWT, refresh token no Redis e log em `auditoria.logs`).
- [x] **F2-11**: Implementação da rota `POST /auth/refresh` (renovação segura com rotação atômica de refresh tokens no Redis).
- [x] **F2-12**: Implementação da rota `POST /auth/logout` (invalidação do access token via denylist no Redis e remoção de sessão).
- [x] **F2-13**: Implementação do `JwtStrategy` e `JwtAuthGuard` global com suporte a decorador `@Public()` e `@CurrentUser()`.

### 2.4 Controle de Acesso Baseado em Perfis (RBAC Granular)
- [x] **F2-14**: Criação dos decoradores `@Roles('administrador', ...)` e `@RequirePermissions('modulo.acao')`.
- [x] **F2-15**: Implementação do `RolesGuard`, `PermissionsGuard` e `RbacService` (avaliação no PostgreSQL com caching em Redis e superuser bypass).

### 2.5 Isolamento Multiunidade (Multi-tenancy Context)
- [x] **F2-16**: Criação do serviço de contexto assíncrono `TenantContext` baseado em `AsyncLocalStorage`.
- [x] **F2-17**: Criação do `TenantInterceptor` para extração do header `X-Unidade-Id`, validação estrita de tenant e superuser bypass.
- [x] **F2-18**: Injeção e escopo de unidade nas operações via `TenantScopeHelper` e decorador `@CurrentTenant()`.

### 2.6 Módulos de Domínio do Core
- [x] **F2-19**: Módulo de Usuários (`UsersModule`): CRUD completo, validação de DTOs com `class-validator`, hashing de senhas bcrypt e vínculos RBAC.
- [x] **F2-20**: Módulo de Unidades (`UnitsModule`): Listagem, ativação/inativação e busca por código/cidade.
- [x] **F2-21**: Módulo de Perfis e Permissões (`RolesModule`): Consulta de catálogo de perfis e permissões.

### 2.7 Auditoria & Tratamento Global
- [x] **F2-22**: Criação do `AuditInterceptor` para captura de mutações (POST/PUT/PATCH/DELETE) e persistência em `auditoria.logs`.
- [x] **F2-23**: Criação do `HttpExceptionFilter` padronizado conforme especificação RFC 7807 (Problem Details).

---

## 📚 Fase 3 & 4: Módulos Acadêmico & Planejamento (SQL + API) `[STATUS: CONCLUÍDO]`

### 3.1 Modelagem e Migrações de Banco
- [x] **F4-01**: Criação de `06_academico_planejamento.sql` com tabelas `cursos`, `ambientes`, `docentes`, `turmas`, `feriados`, `agendamentos`, `substituicoes`.
- [x] **F4-02**: Criação de `07_seed_academico.sql` com dados completos para unidades SENAI Cuiabá e Cáceres.
- [x] **F4-03**: Introspecção completa via `prisma db pull` e geração do Prisma Client com os 15 modelos.

### 3.2 Endpoints e Regras de Negócio
- [x] **F4-04**: `AmbientesModule` (`/ambientes` e `/salas`): CRUD completo com metadados de bloco, andar, capacidade e tipo.
- [x] **F4-05**: `CursosModule` (`/cursos`): CRUD com modalidade, nível e carga horária.
- [x] **F4-06**: `DocentesModule` (`/docentes` e `/professores`): CRUD com especialidade, matrícula e limite semanal de horas.
- [x] **F4-07**: `TurmasModule` (`/turmas`): CRUD de turmas vinculadas a cursos, turnos e vagas.
- [x] **F4-08**: `AgendamentosModule` (`/agendamentos`): Planejamento de aulas com **motor detector de conflitos de horário para docentes e ambientes** (HTTP 409).
- [x] **F4-09**: `FeriadosModule` (`/feriados` e `/calendar/holidays`): Calendário nacional e municipal.
- [x] **F4-10**: `SubstituicoesModule` (`/swaps`): Fluxo de solicitação e aprovação de substituição de turnos/professores.

---

## 🎨 Fase 5: Integração Frontend (`agendamento-ambiente` / `apps/web`) `[STATUS: CONCLUÍDO]`

- [x] **F5-01**: Reorganização estrutural em `apps/web` e criação de junção NTFS em `agendamento-ambiente` para compatibilidade total.
- [x] **F5-02**: Configuração de variáveis de ambiente (`apps/web/.env`) apontando para `http://localhost:3000/api/v1`.
- [x] **F5-03**: Criação do serviço cliente `apiService.ts` com injeção automática de `Bearer Token` e header multi-tenant `X-Unidade-Id`.
- [x] **F5-04**: Criação da camada de adaptadores SIRA (`sira-firestore-adapter`, `sira-auth-adapter`, `sira-functions-adapter`).
- [x] **F5-05**: Configuração de aliases no `vite.config.ts` redirecionando SDKs do Firebase para a API NestJS + PostgreSQL em localhost.
- [x] **F5-06**: Ajuste de porta do frontend para `5173` evitando conflito com o console do pgAdmin (`8080`).
- [x] **F5-07**: Atualização do `AuthContext.tsx` e `usePermissions.tsx` com suporte a `admin@sira.local` e RBAC SIRA.
- [x] **F5-08**: Build de produção do frontend concluído com **0 erros** (3473 módulos empacotados).
- [x] **F5-09**: Scripts de desenvolvimento adicionados ao `package.json` da raiz do Monorepo.
- [x] **F5-10**: Remoção completa de arquivos, regras, mocks e funções legadas do Firebase; migração de 53 componentes para a camada nativa SIRA SQL (`@/lib/db`, `@/lib/sira-sql-adapter`).
- [x] **F5-11**: Criação do script interativo de operações `menu.bat` na raiz com healthcheck, delays de inicialização segura e comandos de orquestração completa.
- [x] **F5-12**: Desvinculação segura da pasta/junção temporária `agendamento-ambiente` (mantendo integridade total de `apps/web`).
- [x] **F5-13**: Criação do script de seed de produção limpa `database/seeds/01_seed_producao.sql` (RBAC, roles e permissões essenciais).
- [x] **F5-14**: Criação do script de seed de teste de carga `database/seeds/02_seed_teste_carga.sql` com suporte a 3 unidades operacionais SENAI (Cuiabá, Cáceres, Rondonópolis) com 11 cursos, 18 ambientes, 15 docentes, 11 turmas, feriados e agendamentos.
- [x] **F5-15**: Integração das rotinas de injeção de seeds e reset do banco ao `menu.bat` (opções 11, 12, 13) e atualização completa do `README.md`.

---

## 🔄 Fase 6: Arquitetura de Sincronização e Homologação (Prod <-> Teste) `[STATUS: CONCLUÍDO]`

- [x] **F6-01**: Provisionamento do banco de dados isolado `sira_teste` no PostgreSQL para simulações e homologação.
- [x] **F6-02**: Configuração de variáveis de ambiente de banco secundário (`DATABASE_TEST_URL`) e registro dos dois servidores no pgAdmin 4 (`servers.json`).
- [x] **F6-03**: Criação do serviço de espelhamento Produção ➔ Teste com higienização (`scripts/mirror-prod-to-test.mjs` e `SyncService.mirrorProdToTest`).
- [x] **F6-04**: Criação do motor de validação prévia de conflitos no banco de testes (`SyncService.validateScenario`).
- [x] **F6-05**: Criação do motor transacional de promoção Teste ➔ Produção com autenticação por senha de Administrador e log imutável de auditoria (`SyncService.promoteTestToProd`).
- [x] **F6-06**: Criação da API REST `SyncController` com endpoints `/sync/status`, `/sync/validate`, `/sync/mirror` e `/sync/promote`.
- [x] **F6-07**: Criação de script interativo de terminal `scripts/promote-test-to-prod.mjs` e integração com `menu.bat` (opções `14` e `15`).
- [x] **F6-08**: Criação de suíte de testes automatizados `apps/api/test-sync-flow.mjs` validando os 5 cenários com 100% de sucesso.
- [x] **F6-09**: Elaboração do documento de arquitetura de alta escala e migração em `docs/ARQUITETURA.md`.

---

## ⚙️ Próximas Fases: Otimização & Relatórios Avançados `[STATUS: PENDENTE]`

- [ ] **F7-01**: Motor de Otimização Automática de Grades Horárias (`apps/optimizer`).
- [ ] **F7-02**: Dashboards analíticos agregados no schema `relatorios`.
- [ ] **F7-03**: Exportação de relatórios em formatos estruturados (PDF / XLSX / CSV).
