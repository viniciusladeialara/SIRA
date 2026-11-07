# SIRA – Sistema Integrado de Recursos Acadêmicos

Plataforma modular de alta disponibilidade para gestão operacional, acadêmica e administrativa das unidades do **SENAI**.

---

## 📌 Status do Projeto

- **Fase Atual**: `Fase 1: Infraestrutura & Fundação Técnica (Concluída)`
- **Próxima Fase**: `Fase 2: Módulo CORE & API NestJS`
- **Ambiente Local**: Docker Compose (PostgreSQL 16, pgAdmin 4, Redis 7)

---

## 🛠️ Stack Tecnológico

| Camada | Tecnologia | Detalhes |
| :--- | :--- | :--- |
| **Banco de Dados** | PostgreSQL 16 (Alpine) | Multi-schema (`core`, `academico`, `planejamento`, `producao`, `relatorios`, `auditoria`) |
| **Administração SQL** | pgAdmin 4 | Auto-descoberta via `servers.json` na porta `8080` |
| **Cache & Filas** | Redis 7 (Alpine) | Porta `6379` com persistência configurada |
| **Backend (Fase 2)** | NestJS / TypeScript | Clean Architecture, Feature-Based, Prisma ORM |
| **Frontend (Fase 3)**| Next.js 14+ / TypeScript | TailwindCSS, Shadcn/UI, Lucide React |

---

## 🚀 Como Executar o Ambiente Local

### 1. Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) em execução no Windows 11.
- [Git](https://git-scm.com/) instalado.

### 2. Configurar Variáveis de Ambiente

O arquivo `.env` já contém as credenciais padrão de desenvolvimento. Você pode revisá-lo ou clonar a partir do `.env.example`:

```bash
# Se necessário, copiar o arquivo de exemplo
cp .env.example .env
```

### 3. Iniciar os Contêineres Docker

Na raiz do projeto, execute:

```bash
docker compose up -d
```

Para verificar o status dos contêineres:

```bash
docker compose ps
```

Para acompanhar os logs de inicialização e carga dos schemas:

```bash
docker compose logs -f postgres
```

---

## 🌐 Serviços & Credenciais de Acesso

### 🐘 PostgreSQL 16
- **Host**: `localhost` (ou `sira-postgres` na rede interna Docker)
- **Porta**: `5432`
- **Banco de Dados**: `sira`
- **Usuário**: `sira_admin`
- **Senha**: `Sira@2026`
- **Connection String**: `postgresql://sira_admin:Sira@2026@localhost:5432/sira?schema=core`

### 🖥️ pgAdmin 4
- **URL**: [http://localhost:8080](http://localhost:8080)
- **Email de Login**: `admin@sira.com`
- **Senha de Login**: `Admin@2026`
- **Servidor Pré-configurado**: O servidor **"SIRA PostgreSQL (sira-postgres)"** já vem carregado automaticamente na árvore lateral. Ao conectar pela primeira vez, utilize a senha `Sira@2026`.

### ⚡ Redis 7
- **Host**: `localhost` (ou `sira-redis` na rede Docker)
- **Porta**: `6379`
- **Teste de Conectividade**:
  ```bash
  docker exec -it sira-redis redis-cli ping
  # Resposta esperada: PONG
  ```

---

## 📂 Estrutura do Monorepo

```text
SIRA/
├── apps/                          # Aplicações executáveis
│   ├── api/                       # API Backend NestJS (Fase 2)
│   ├── web/                       # Frontend Web Next.js (Fase 3)
│   └── optimizer/                 # Motor de otimização de matriz de horários (Fase 5)
├── core/                          # Entidades de domínio universais e contratos centrais
├── modules/                       # Módulos de domínio encapsulados (Feature-based)
├── plugins/                       # Integrações externas e adaptadores
├── shared/                        # Tipos, DTOs e utilitários compartilhados
├── infrastructure/                # Infraestrutura como código (Docker)
│   └── docker/
│       ├── pgadmin/               # servers.json para autoload no pgAdmin
│       └── docker-compose.yml     # Espelho alternativo do compose
├── database/                      # Banco de dados e migrações
│   ├── init/                      # Scripts SQL automáticos de boot
│   │   ├── 01_extensions.sql      # Extensões (uuid-ossp, pgcrypto, unaccent)
│   │   ├── 02_schemas.sql         # Criação de 6 schemas lógicos
│   │   ├── 03_core_tables.sql     # Multiunidade, usuários e modelo RBAC
│   │   ├── 04_auditoria_tables.sql# Trilha imutável de auditoria
│   │   └── 05_seed_data.sql       # Seed: Unidades SENAI, perfis e admin
│   └── migrations/                # Migrações gerenciadas pelo Prisma ORM
├── docs/                          # Documentação e especificações de produto
│   └── PRD.md                     # Documento de Requisitos do Produto oficial
├── tests/                         # Testes e2e e integração
├── .env                           # Variáveis de ambiente locais
├── .env.example                   # Template de variáveis
├── .gitignore                     # Regras de exclusão do repositório
├── docker-compose.yml             # Manifesto Docker principal
└── README.md                      # Este documento
```

---

## 🗄️ Schemas e Carga Inicial do Banco

Ao iniciar o contêiner `sira-postgres`, os seguintes schemas e estruturas são provisionados automaticamente:

1. **`core`**:
   - `core.unidades`: Unidades SENAI (Cuiabá, Cáceres, Rondonópolis, Sinop).
   - `core.perfis`: Administrador, Gestor, Coordenador, Professor, Secretaria, Consulta.
   - `core.permissoes`: Permissões granulares (`usuarios.*`, `unidades.*`, `turmas.*`, `relatorios.*`, `auditoria.*`).
   - `core.usuarios`: Usuário inicial padrão (`admin@sira.local` / `Admin@2026`).
   - `core.usuario_perfis` & `core.perfil_permissoes`: Vínculos RBAC.
   - `core.configuracoes_globais`: Parâmetros de sistema em formato JSONB.
2. **`auditoria`**:
   - `auditoria.logs`: Trilha imutável com campos de usuário, IP, ação, tabela e deltas em JSONB (`dados_anteriores`, `dados_novos`).
3. **`academico`**: Cursos, matrizes curriculares, turmas, alunos e matrículas (reservado para Fase 4).
4. **`planejamento`**: Calendários letivos, disponibilidades docentes e alocações de salas (reservado para Fase 4 e 5).
5. **`producao`**: Aulas, apontamentos de notas, frequências e diários de classe (reservado para Fase 4).
6. **`relatorios`**: Visões analíticas agregadas e estruturas de BI (reservado para Fase 6).

---

## 🛑 Parando o Ambiente

Para parar todos os contêineres:

```bash
docker compose down
```

Para parar removendo também os volumes persistentes (atenção: limpa o banco de dados):

```bash
docker compose down -v
```

---

## 📋 Próximos Passos (Fase 2)

- Inicialização do projeto **NestJS** em `apps/api/` com TypeScript.
- Configuração do **Prisma ORM** mapeando os schemas `core` e `auditoria`.
- Implementação de autenticação JWT, refresh tokens e RBAC Guards.
- Criação dos módulos de usuários e unidades.
