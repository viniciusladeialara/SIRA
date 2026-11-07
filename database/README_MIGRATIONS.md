# SIRA – Governança Oficial de Migrações de Banco de Dados (Prisma Migrate)

## 1. Visão Geral e Princípios
A partir da versão 2.0 (PRD Enterprise 10/10), o **Prisma Migrate** é a **única fonte da verdade** para a evolução do esquema de dados do SIRA (PostgreSQL 16 Multi-Schema).

### Regras Inegociáveis
1. **Nenhuma alteração estrutural manual:** É proibido executar DDL (`CREATE TABLE`, `ALTER TABLE`, etc.) diretamente em produção ou homologação sem migration versionada.
2. **Ambiente reprodutível:** Qualquer ambiente novo (dev, staging, prod) deve ser 100% reconstruível executando as migrações oficiais.
3. **Independência de Seeds:** As migrações (`database/migrations`) cuidam exclusivamente de estrutura (DDL). Cargas de dados (DML) são gerenciadas exclusivamente pelo `database/seed-runner.ts` e auditadas em `core.seed_history`.

---

## 2. Estrutura de Diretórios
```text
database/
├── migrations/
│   ├── 20261107000000_0_init/
│   │   └── migration.sql           <-- Baseline inicial do ecossistema SIRA
│   ├── 20261107120000_seed_history/
│   ├── 20261107130000_feature_flags/
│   ├── 20261107140000_soft_delete/
│   ├── 20261107150000_schema_workflow/
│   └── 20261107160000_event_store/
├── seeds/                          <-- Cargas e fixtures de dados versionadas
│   ├── 01_seed_producao.sql
│   └── 02_seed_teste_carga.sql
├── seed-runner.ts                  <-- Executor idempotente com controle de versão
└── README_MIGRATIONS.md            <-- Este guia operacional
```

---

## 3. Comandos Operacionais

### 3.1 Em Ambiente de Desenvolvimento
Para criar uma nova migração a partir de alterações no `apps/api/prisma/schema.prisma`:
```bash
# Executa diff e cria migration formal
npm run db:migrate:dev -- --name nome_da_alteracao
```
Ou diretamente via CLI Prisma:
```bash
npx --prefix apps/api prisma migrate dev --name nome_da_alteracao --schema apps/api/prisma/schema.prisma
```

### 3.2 Em Ambiente de Produção / Homologação (Deploy Automatizado)
Para aplicar migrações pendentes sem intervenção interativa:
```bash
npm run db:migrate:deploy
```
Ou diretamente:
```bash
npx --prefix apps/api prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

### 3.3 Verificação de Status das Migrações
```bash
npx --prefix apps/api prisma migrate status --schema apps/api/prisma/schema.prisma
```

---

## 4. Resolução de Conflitos e Baseline
Caso um banco preexistente necessite ser sincronizado sem reexecutar scripts já existentes:
```bash
npx --prefix apps/api prisma migrate resolve --applied <migration_name> --schema apps/api/prisma/schema.prisma
```
Para marcar uma migração com falha como revertida:
```bash
npx --prefix apps/api prisma migrate resolve --rolled-back <migration_name> --schema apps/api/prisma/schema.prisma
```
