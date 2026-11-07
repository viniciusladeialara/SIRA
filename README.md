# SIRA – Sistema Integrado de Recursos Acadêmicos (SENAI MT)

Plataforma empresarial de alta performance e disponibilidade para gestão operacional, acadêmica, planejamento de matrizes horárias e controle de recursos físicos das unidades operacionais do **SENAI**.

---

## 📌 Sumário Executivo

- **Arquitetura**: Monorepo Modular (`apps/api`, `apps/web`, `database/`, `infrastructure/`, `docs/`)
- **Backend**: NestJS 10, TypeScript, Prisma ORM, Redis 7 (Cache, Rate Limit e Sessões)
- **Frontend**: React 18, Vite, TailwindCSS, Radix UI, TanStack Query (100% migrado para SIRA SQL nativo)
- **Banco de Dados**: PostgreSQL 16 Multi-Schema (`core`, `academico`, `planejamento`, `producao`, `relatorios`, `auditoria`)
- **Administração SQL**: pgAdmin 4 pré-configurado na porta `8080`
- **Isolamento**: Multi-tenancy por unidade operacional via header `X-Unidade-Id` e RBAC Granular

---

## 🚀 Como Executar o Sistema (Guia Rápido)

### Pré-requisitos
1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e em execução (com backend WSL2 no Windows).
2. [Node.js](https://nodejs.org/) v20+ e [npm](https://www.npmjs.com/) instalados.
3. [Git](https://git-scm.com/) instalado.

---

### Método 1: Menu Interativo `menu.bat` (Recomendado no Windows)

O projeto conta com um painel de controle operacional em arquivo batch na raiz:

```cmd
.\menu.bat
```
*(ou simplesmente dê um duplo clique no arquivo `menu.bat` pelo Explorador de Arquivos do Windows)*

Ao abrir o menu, você terá acesso às seguintes opções imediatas:
- **`[1]` INICIAR SISTEMA COMPLETO**: Sobe o Docker, aguarda a estabilização com healthcheck do PostgreSQL, inicia o NestJS na porta 3000, inicia o Vite na porta 5173 e abre automaticamente o navegador.
- **`[2]` a `[4]`**: Inicialização individual de serviços (apenas Docker, apenas API ou apenas Frontend).
- **`[5]` PARAR TUDO**: Encerra os contêineres Docker e fecha os processos Node em background.
- **`[7]` Verificar Status**: Executa healthcheck no PostgreSQL, Redis e verifica portas ocupadas.
- **`[8]` Abrir Aplicações**: Abre no navegador o Frontend, a API e o pgAdmin.
- **`[9]` Executar Testes**: Roda a suíte de testes de autenticação, RBAC e motor de conflitos de horário.
- **`[10]` Compilar Todo o Sistema**: Valida o build de produção do Backend e do Frontend.
- **`[11]` Aplicar Seed de Teste de Carga**: Injeta carga massiva com **3 Unidades SENAI** (Cuiabá, Cáceres e Rondonópolis).
- **`[12]` Aplicar Seed de Produção Limpa**: Injeta apenas as tabelas essenciais de RBAC, permissões e parâmetros globais.
- **`[13]` Resetar Banco de Dados**: Destrói volumes Docker (`down -v`) e sobe do zero recriando todas as tabelas.
- **`[14]` Espelhar Produção para Teste**: Clona com segurança os dados de Produção (`sira`) para o banco de Testes (`sira_teste`).
- **`[15]` Promover Cenários de Teste para Produção**: Valida conflitos de horário e promove a grade para Produção mediante senha do Admin.

---

### Método 2: Linha de Comando (Terminal / npm)

Se preferir rodar manualmente no terminal:

```bash
# 1. Subir os contêineres Docker (PostgreSQL, Redis, pgAdmin)
npm run docker:up

# 2. Iniciar a API Backend (Terminal 1)
npm run dev:api

# 3. Iniciar o Frontend Web (Terminal 2)
npm run dev:web
```

---

## 🌐 URLs e Credenciais de Acesso

| Serviço | URL Local | Usuário / Identificador | Senha | Observações |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Web SIRA** | [http://localhost:5173](http://localhost:5173) | `admin@sira.local` | `Admin@2026` | Permite também `admin@sira.com` ou `viniciusladeialara@gmail.com` |
| **Backend API (REST)**| [http://localhost:3000/api/v1](http://localhost:3000/api/v1) | — | — | Documentação e endpoints da API |
| **pgAdmin 4 (Console)**| [http://localhost:8080](http://localhost:8080) | `admin@sira.com` | `Admin@2026` | Servidor `sira-postgres` já vem pré-configurado na barra lateral |
| **PostgreSQL 16 (Produção)** | `localhost:5432` | `sira_admin` | `Sira@2026` | Banco: `sira` (Multi-schema) |
| **PostgreSQL 16 (Teste/Sandbox)** | `localhost:5432` | `sira_admin` | `Sira@2026` | Banco: `sira_teste` (Isolado para simulação) |
| **Redis 7** | `localhost:6379` | — | Sem senha | Cache L1/L2, rate limiting e tokens |

> [!NOTE]
> A porta do frontend foi padronizada para **`5173`** para evitar qualquer conflito com o console web do pgAdmin na porta **`8080`**.

---

## 🗄️ Estrutura do Banco de Dados & Scripts de Carga (Seeds)

### ❓ As tabelas já foram criadas ou preciso executar algo manualmente?

**As tabelas JÁ ESTÃO CRIADAS automaticamente!**
- Ao iniciar o contêiner `sira-postgres`, o Docker monta a pasta `database/init/` diretamente no diretório de inicialização do PostgreSQL (`/docker-entrypoint-initdb.d/`).
- Em qualquer banco novo ou volume recém-criado, o próprio PostgreSQL executa sequencialmente:
  1. `01_extensions.sql` (Criação de `uuid-ossp`, `pgcrypto`, `unaccent`)
  2. `02_schemas.sql` (Criação dos 6 schemas lógicos)
  3. `03_core_tables.sql` (Usuários, unidades, perfis e permissões RBAC)
  4. `04_auditoria_tables.sql` (Tabela imutável de logs de auditoria com diff JSONB)
  5. `05_seed_data.sql` (Unidades SENAI iniciais e usuário admin)
  6. `06_academico_planejamento.sql` (Tabelas de cursos, ambientes, docentes, turmas, feriados, agendamentos)
  7. `07_seed_academico.sql` (Dados base para validação)

### 📦 Scripts de Carga Dedicados (`database/seeds/`)

Para manutenções futuras, homologação, testes de estresse ou deploys em produção, criamos dois arquivos SQL idempotentes (`ON CONFLICT DO UPDATE`):

#### 1. Seed de Teste de Carga (`database/seeds/02_seed_teste_carga.sql`)
Popula o banco com **3 Unidades Operacionais do SENAI** totalmente funcionais para testar o isolamento multi-tenant:
- **SENAI Cuiabá** (`a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`):
  - 4 Cursos Técnicos (Desenvolvimento de Sistemas, Eletrotécnica, Mecânica Industrial, Redes de Computadores)
  - 6 Ambientes (Labs de Software, Hardware, Automação, Oficina de Usinagem, Salas Teóricas e Auditório)
  - 5 Docentes com limite de horas semanais configurado
  - 4 Turmas ativas (Matutino, Vespertino e Noturno)
  - Agendamentos semanais de aula e Feriado Municipal de Cuiabá (08/04)
- **SENAI Cáceres** (`a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12`):
  - 3 Cursos Técnicos (Informática para Internet, Administração, Manutenção de Sistemas)
  - 4 Ambientes (Labs de Informática, Redes e Salas de Aula)
  - 4 Docentes especializados
  - 3 Turmas ativas
  - Agendamentos e Feriado Municipal de Cáceres (06/10)
- **SENAI Rondonópolis** (`a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13`):
  - 4 Cursos Técnicos (Eletromecânica, Logística, Segurança do Trabalho, Automação Industrial)
  - 5 Ambientes (Lab de Robótica, Simulador de Logística, Galpão de Manutenção, Salas)
  - 6 Docentes
  - 4 Turmas ativas
  - Agendamentos e Feriado Municipal de Rondonópolis (10/12)

**Como aplicar a carga de teste:**
- Pelo menu: Digite `11` no `menu.bat`.
- Pelo terminal: `npm run seed:load`
- Ou diretamente via Docker:
  ```bash
  docker exec -i sira-postgres psql -U sira_admin -d sira < database/seeds/02_seed_teste_carga.sql
  ```

#### 2. Seed de Produção Limpa (`database/seeds/01_seed_producao.sql`)
Contém a fundação estrita do sistema sem nenhum dado fictício de turmas ou agendamentos:
- Catálogo de 6 Perfis RBAC (`administrador`, `gestor`, `coordenador`, `professor`, `secretaria`, `consulta`).
- Permissões granulares mapeadas por módulo (`usuarios.*`, `unidades.*`, `academico.*`, `planejamento.*`, `auditoria.*`).
- Vínculos de permissões por perfil.
- Parâmetros globais de configuração em `core.configuracoes_globais`.

**Como aplicar o seed de produção:**
- Pelo menu: Digite `12` no `menu.bat`.
- Pelo terminal: `npm run seed:prod`
- Ou diretamente via Docker:
  ```bash
  docker exec -i sira-postgres psql -U sira_admin -d sira < database/seeds/01_seed_producao.sql
  ```

---

## 📁 Estrutura de Diretórios do Repositório

```text
SIRA/
├── apps/
│   ├── api/                          # Backend NestJS 10 (Porta 3000)
│   │   ├── prisma/                   # schema.prisma com 15 modelos multi-schema
│   │   ├── src/
│   │   │   ├── modules/              # auth, users, units, roles, ambientes, cursos, docentes, turmas, agendamentos...
│   │   │   ├── common/               # guards, interceptors (tenant, audit), filters, decorators
│   │   │   └── main.ts
│   │   └── package.json
│   │
│   └── web/                          # Frontend React 18 + Vite (Porta 5173)
│       ├── src/
│       │   ├── components/           # Dashboard, Agendamentos, Salas, Cursos, Turmas, Docentes...
│       │   ├── lib/                  # apiService, db (SIRA SQL Adapter), AuthContext, UserRoles
│       │   └── App.tsx
│       └── package.json
│
├── database/
│   ├── init/                         # Scripts automáticos de inicialização no Docker
│   │   ├── 01_extensions.sql
│   │   ├── 02_schemas.sql
│   │   ├── 03_core_tables.sql
│   │   ├── 04_auditoria_tables.sql
│   │   ├── 05_seed_data.sql
│   │   ├── 06_academico_planejamento.sql
│   │   └── 07_seed_academico.sql
│   └── seeds/                        # Seeds operacionais reutilizáveis
│       ├── 01_seed_producao.sql      # Seed limpo para ambiente de Produção
│       └── 02_seed_teste_carga.sql   # Seed de Carga Completa com 3 Unidades SENAI
│
├── docs/                             # Documentação de Arquitetura e Engenharia
│   ├── PRD.md                        # Documento de Requisitos de Produto
│   ├── ARQUITETURA.md                # Decisões arquiteturais e padrões de projeto
│   └── TASKS.md                      # Matriz operacional e histórico de tarefas
│
├── infrastructure/
│   └── docker/
│       └── pgadmin/servers.json      # Auto-conexão do pgAdmin com o PostgreSQL
│
├── docker-compose.yml                # Orquestração do PostgreSQL, Redis e pgAdmin
├── menu.bat                          # Painel interativo de inicialização e manutenção local
├── package.json                      # Scripts de orquestração do Monorepo
└── README.md                         # Este documento de referência
```

---

## 🧹 Limpeza & Esclarecimento sobre `agendamento-ambiente`

Durante a refatoração do sistema legado (baseado em Firebase) para o novo padrão corporativo SQL:
- Uma junção de diretórios temporária (`agendamento-ambiente`) havia sido criada como ponte de transição.
- **A pasta/junção `agendamento-ambiente` já foi desvinculada com total segurança.**
- Todo o código do Frontend reside de forma limpa, consolidada e versionada dentro de **`apps/web/`**.
- Todos os arquivos, configurações e SDKs do Firebase foram completamente removidos. O sistema agora opera 100% integrado ao NestJS e PostgreSQL local.

---

## 🛡️ Testes Automatizados

O sistema conta com testes automatizados ponta-a-ponta que validam o fluxo completo de autenticação, RBAC e integridade acadêmica:

```bash
# Executar a bateria de testes do fluxo acadêmico e regras de negócio:
cd apps/api
node test-academic-flow.mjs
```

Os testes cobrem:
1. **Autenticação**: Emissão de JWT e validação de credenciais.
2. **Multi-tenancy**: Isolamento de dados entre unidades através do header `X-Unidade-Id`.
3. **RBAC**: Permissões de administrador, coordenador e professor.
4. **Detector de Conflitos**: Bloqueio (HTTP 409) ao tentar agendar dois professores na mesma sala ou o mesmo professor em duas salas no mesmo horário.
5. **Auditoria**: Registro automático das ações em `auditoria.logs`.

---

## 🛠️ Resolução de Problemas Comuns (Troubleshooting)

### 1. "Porta 3000 ou 5173 já está em uso"
Execute a opção **`[5] PARAR TUDO`** no `menu.bat`. Ela fecha todos os contêineres Docker e encerra com segurança processos órfãos do Node.

### 2. "Falha de conexão com o banco de dados na inicialização da API"
O PostgreSQL pode levar alguns segundos para carregar as extensões na primeira vez.
O script `menu.bat` já inclui um delay inteligente com **Healthcheck** (`pg_isready`). Se iniciar manualmente, aguarde o contêiner estar com status `healthy` antes de rodar `npm run dev:api`.

### 3. "Quero recriar o banco do zero absoluto"
Execute a opção **`[13]`** no `menu.bat` (ou `docker compose down -v && docker compose up -d`). Os 6 schemas e todas as tabelas serão recriados instantaneamente a partir dos arquivos em `database/init/`.

---

*Desenvolvido para as Unidades Operacionais do SENAI MT – Sistema Integrado de Recursos Acadêmicos (SIRA).*
