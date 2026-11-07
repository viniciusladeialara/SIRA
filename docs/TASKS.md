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

## 🚀 Fase 2: CORE, Autenticação & API NestJS `[STATUS: EM PROGRESSO]`

### 2.1 Scaffolding & Setup da API Backend
- [x] **F2-01**: Inicialização da aplicação NestJS dentro de `apps/api` via CLI `@nestjs/cli`.
- [x] **F2-02**: Configuração de scripts (`build`, `start:dev`, `test`, `lint`) e padronização do `tsconfig.json`.
- [x] **F2-03**: Instalação e configuração do **Prisma ORM** (`@prisma/client`, `prisma`).
- [x] **F2-04**: Introspecção ou mapeamento declarativo dos schemas `core` e `auditoria` no `schema.prisma`.
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
- [>] **F2-14**: Criação dos decoradores `@Roles('administrador', ...)` e `@RequirePermissions('modulo.acao')`.
- [ ] **F2-15**: Implementação do `PermissionsGuard` (avaliação de permissões granulares no banco e com caching em Redis).

### 2.5 Isolamento Multiunidade (Multi-tenancy Context)
- [ ] **F2-16**: Criação do serviço de contexto assíncrono `TenantContext` baseado em `AsyncLocalStorage`.
- [ ] **F2-17**: Criação do `TenantInterceptor` para extração do header `X-Unidade-Id` e validação de vínculo do usuário.
- [ ] **F2-18**: Injeção automática de escopo de unidade nas operações de repositório.

### 2.6 Módulos de Domínio do Core
- [ ] **F2-19**: Módulo de Usuários (`UsersModule`): CRUD completo, validação de DTOs com `class-validator`, hashing de senhas.
- [ ] **F2-20**: Módulo de Unidades (`UnitsModule`): Listagem, ativação/inativação e busca por código/cidade.
- [ ] **F2-21**: Módulo de Perfis e Permissões (`RolesModule`): Consulta de catálogo e atribuição de perfis a usuários.

### 2.7 Auditoria & Tratamento Global
- [ ] **F2-22**: Criação do `AuditInterceptor` para captura de mutações (POST/PUT/DELETE) e persistência em `auditoria.logs`.
- [ ] **F2-23**: Criação do `HttpExceptionFilter` padronizado conforme especificação RFC 7807 (Problem Details).
- [ ] **F2-24**: Configuração do logger estruturado com Winston (JSON / traceId).

### 2.8 Documentação & Testes
- [ ] **F2-25**: Configuração do Swagger/OpenAPI em `/api/docs`.
- [ ] **F2-26**: Criação de testes unitários para serviços de autenticação, usuários e permissions guard.
- [ ] **F2-27**: Criação de testes E2E (`/test/auth.e2e-spec.ts`).

---

## 🎨 Fase 3: Frontend Web & Dashboard Administrativo (Next.js) `[STATUS: PENDENTE]`

- [ ] **F3-01**: Inicialização do projeto Next.js 14+ em `apps/web` (App Router, TypeScript).
- [ ] **F3-02**: Configuração do TailwindCSS, Shadcn/UI e Lucide React.
- [ ] **F3-03**: Criação do cliente de API (`fetch` / `axios`) com renovação transparente de tokens JWT via cookies HTTP-only.
- [ ] **F3-04**: Tela de Login e recuperação de credenciais com validação Zod.
- [ ] **F3-05**: Layout Administrativo Responsivo (Sidebar retrátil, Header, Seletor de Unidade Operacional ativa).
- [ ] **F3-06**: Telas de Gestão de Usuários (listagem com filtros, criação, edição e concessão de perfis).
- [ ] **F3-07**: Telas de Gestão de Unidades do SENAI.
- [ ] **F3-08**: Visualizador da Trilha de Auditoria (histórico com diff visual dos registros alterados).

---

## 📚 Fase 4: Módulo Acadêmico `[STATUS: PENDENTE]`

- [ ] **F4-01**: Migrações do schema `academico` no Prisma (cursos, matrizes, turmas, alunos, matrículas).
- [ ] **F4-02**: Gestão de Cursos e Componentes Curriculares por Unidade.
- [ ] **F4-03**: Gestão de Turmas e Matrículas de Alunos.
- [ ] **F4-04**: Apontamento de Frequência, Conteúdo e Notas (Schema `producao`).
- [ ] **F4-05**: Diário de Classe Digital do Docente.

---

## ⚙️ Fase 5: Motor Otimizador de Horários `[STATUS: PENDENTE]`

- [ ] **F5-01**: Modelagem do schema `planejamento` (restrições docentes, horários de disponibilidade, salas e laboratórios).
- [ ] **F5-02**: Desenvolvimento do serviço/motor de alocação de horários em `apps/optimizer`.
- [ ] **F5-03**: Algoritmo de resolução de restrições rígidas (hard constraints) e flexíveis (soft constraints).
- [ ] **F5-04**: Interface visual de aprovação e ajuste de grade horária.

---

## 📊 Fase 6: Business Intelligence & Relatórios `[STATUS: PENDENTE]`

- [ ] **F6-01**: Criação de visões analíticas no schema `relatorios`.
- [ ] **F6-02**: Dashboards executivos de ocupação física de laboratórios e taxa de utilização docente.
- [ ] **F6-03**: Exportação de relatórios em formatos estruturados (PDF / XLSX / CSV).
