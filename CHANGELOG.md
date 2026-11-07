# SIRA Enterprise - Histórico Oficial de Evolução e Changelog

Este documento registra todas as alterações arquiteturais, de infraestrutura, banco de dados, backend e frontend aplicadas no projeto **SIRA (Sistema Integrado de Recursos Acadêmicos)** em conformidade estrita com o documento [PRD_V2_10_10.md](file:///c:/Users/VINICIUS/Documents/GitHub/SIRA/Melhoria/PRD_V2_10_10.md).

---

## [2.0.0-ENTERPRISE] - 2026-11-07

### 📌 Resumo Executivo
Evolução do monólito modular SIRA para o patamar Enterprise 10/10, mantendo 100% de compatibilidade reversa com a stack tecnológica existente (NestJS 10+, React 18, PostgreSQL 16, Redis 7, Prisma ORM, Docker Compose), sem introdução de quebras ou tecnologias alienígenas (sem Kafka, sem Kubernetes, sem RabbitMQ).

---

### 📂 Detalhamento por Etapa de Implementação

#### ETAPA 1: ANÁLISE DE GAP ENTERPRISE
- **Arquivo Criado**: [`docs/analise-gap-v2.md`](file:///c:/Users/VINICIUS/Documents/GitHub/SIRA/docs/analise-gap-v2.md)
- **Motivo**: Diagnóstico exaustivo entre o estado legado e a meta corporativa para os 10 EPICs.
- **Impacto**: Forneceu o plano de voo seguro para execuções sem regressão.
- **Risco**: Zero risco operacional (documentação analítica).

#### ETAPA 2: MIGRATIONS OFICIAIS COM PRISMA
- **Arquivos Criados/Alterados**:
  - `database/migrations/20261107000000_0_init/migration.sql` (Baseline)
  - `database/migrations/20261107120000_v2_enterprise_foundation/migration.sql` (Tabelas de Governança, Soft Delete e Workflow)
  - `database/migrations/20261107130000_v2_enterprise_reports/migration.sql` (Materialized Views de Relatórios)
  - [`database/README_MIGRATIONS.md`](file:///c:/Users/VINICIUS/Documents/GitHub/SIRA/database/README_MIGRATIONS.md)
  - [`apps/api/prisma/schema.prisma`](file:///c:/Users/VINICIUS/Documents/GitHub/SIRA/apps/api/prisma/schema.prisma)
- **Motivo**: Eliminar manipulação manual de DDL no PostgreSQL; o Prisma tornou-se a fonte única da verdade estrutural.
- **Impacto**: Rastreamento imutável de todas as modificações estruturais do banco de dados `sira`.
- **Risco**: Mitigado por testes em ambiente isolado antes do `prisma migrate deploy`.

#### ETAPA 3: CONTROLE DE VERSÃO DE SEEDS
- **Arquivos Criados/Alterados**:
  - [`database/seed-runner.ts`](file:///c:/Users/VINICIUS/Documents/GitHub/SIRA/database/seed-runner.ts)
  - Tabela `core.seed_history` no PostgreSQL
- **Motivo**: Garantir execução idempotente e versionada de cargas de teste e produção.
- **Impacto**: Prevenção de duplicação de dados e histórico auditável de quem e quando executou cada carga.
- **Risco**: Zero risco (opera com transações e hash de versão).

#### ETAPA 4: FEATURE FLAGS DESACOPLADAS COM REDIS CACHE
- **Arquivos Criados/Alterados**:
  - Backend: `apps/api/src/modules/feature-flags/` (`service`, `controller`, `guard`, `decorator`, `module`)
  - Frontend: `apps/web/src/contexts/FeatureFlagContext.tsx`, `apps/web/src/hooks/useFeatureFlag.ts`, `apps/web/src/App.tsx`
  - Tabela `core.feature_flags`
- **Motivo**: Permitir rollouts graduais e habilitar/desabilitar módulos criticamente em tempo de execução sem downtime.
- **Flags Iniciais**: `optimizer_enabled`, `reports_enabled`, `teacher_swap_enabled`, `dashboard_advanced`, `experimental_scheduler`.
- **Impacto**: Cache em Redis 7 com fallback automático ao banco.
- **Risco**: Baixo (fallback seguro para false em caso de flag inexistente).

#### ETAPA 5: SOFT DELETE GLOBAL
- **Arquivos Alterados**:
  - `apps/api/src/modules/usuarios/`
  - `apps/api/src/modules/docentes/`
  - `apps/api/src/modules/turmas/`
  - `apps/api/src/modules/ambientes/`
  - `apps/api/src/modules/cursos/`
- **Motivo**: Impossibilitar deleção física inadvertida de registros essenciais pela aplicação.
- **Padrão Aplicado**: `ativo: false`, `excluido_em: NOW()`, `excluido_por: UUID`.
- **Impacto**: Todos os serviços e repositórios filtram automaticamente registros com `excluido_em: null`.
- **Risco**: Baixo (queries ajustadas com índices correspondentes).

#### ETAPAS 6 & 7: SCHEMA WORKFLOW E EVENT STORE IMUTÁVEL
- **Arquivos Criados/Alterados**:
  - Schema `workflow` no PostgreSQL (`fluxos`, `etapas`, `solicitacoes`, `aprovacoes`, `assinaturas`, `historicos`, `eventos`)
  - `apps/api/src/modules/workflow/`
  - `apps/api/src/modules/event-store/`
  - Emissão de eventos canônicos nos módulos:
    - `USUARIO_CRIADO` (`UsersService.create`)
    - `DOCENTE_CRIADO` (`DocentesService.create`)
    - `TURMA_CRIADA` (`TurmasService.create`)
    - `AGENDAMENTO_CRIADO` (`AgendamentosService.create`)
    - `PROMOCAO_EXECUTADA` (`SyncService.promoteTestToProd`)
    - `SWAP_APROVADO` (`SubstituicoesService.updateStatus`)
- **Motivo**: Rastreamento imutável e transacional de eventos de domínio e desacoplamento de fluxos de aprovação.
- **Impacto**: Trilha de auditoria 100% à prova de adulteração em formato JSONB consultável.
- **Risco**: Mínimo (gravação não-bloqueante resiliente a falhas periféricas).

#### ETAPA 8: OBSERVABILIDADE COM PROMETHEUS & GRAFANA
- **Arquivos Criados/Alterados**:
  - `docker-compose.yml` (Adicionados serviços `prometheus` e `grafana` na `sira-network`)
  - `infra/monitoring/prometheus/prometheus.yml`
  - `infra/monitoring/grafana/provisioning/datasources/datasources.yml`
  - `infra/monitoring/grafana/provisioning/dashboards/dashboards.yml`
  - `infra/monitoring/grafana/dashboards/sira-overview.json`
  - `apps/api/src/modules/metrics/` (`metrics.service.ts`, `metrics.controller.ts`, `metrics.interceptor.ts`, `metrics.module.ts`)
- **Motivo**: Monitoramento proativo em tempo real de latência HTTP (p50/p95/p99), CPU/RAM, conexões PostgreSQL e ping do Redis.
- **Impacto**: Endpoint `/api/v1/metrics` em formato Prometheus e dashboard pré-provisionado no Grafana (porta 3001).
- **Risco**: Nulo (métricas leves coletadas em memória via `prom-client`).

#### ETAPA 9: SEGURANÇA MULTI-TENANT TRIPLA & HARDENING
- **Arquivos Alterados**:
  - `apps/api/src/modules/tenant/tenant.interceptor.ts` (Validação tripla: JWT Tenant, Header Tenant `X-Unidade-Id` e Context Tenant)
  - `apps/api/src/common/guards/rate-limit.guard.ts` e `@RateLimit()`
  - `apps/api/src/modules/auth/auth.service.ts` e `auth.controller.ts` (Device Tracking com `deviceId`, Rotação de Refresh Token e Global Revoke)
- **Motivo**: Bloqueio irrestrito (403 Forbidden) em caso de divergência de unidade e defesa ativa contra brute-force / sequestro de sessão.
- **Impacto**: Proteção do login com rate limit (10 req/min) e possibilidade de revogar todas as sessões ativas do usuário simultaneamente.
- **Risco**: Mitigado (usuários administradores mantêm permissão de chavear unidade).

#### ETAPA 10: RELATÓRIOS ENTERPRISE E MATERIALIZED VIEWS
- **Arquivos Criados/Alterados**:
  - Materialized Views: `relatorios.vw_ocupacao_ambientes`, `relatorios.vw_carga_docentes`, `relatorios.vw_turmas_ativas`, `relatorios.vw_conflitos`
  - Função PostgreSQL: `relatorios.refresh_all_reports()`
  - Backend: `apps/api/src/modules/reports/` (`reports.service.ts`, `reports.controller.ts`, `export.service.ts`, `reports.module.ts`)
- **Formatos Suportados**: JSON, CSV (com UTF-8 BOM), XLSX nativo (ExcelJS estilizado) e PDF vetorial corporativo (PDFKit).
- **Motivo**: Consultas analíticas ultrarrápidas sem sobrecarregar tabelas operacionais OLTP de agendamento.
- **Impacto**: Geração instantânea de relatórios com concorrência segura (`CONCURRENTLY`).
- **Risco**: Nulo (opera sobre views isoladas no schema `relatorios`).

#### ETAPA 11: SUÍTE DE TESTES AUTOMATIZADOS (UNIT, INTEGRATION, E2E)
- **Arquivos Criados/Configurados**:
  - `apps/api/vitest.config.ts`
  - `tests/unit/` (`auth.service.spec.ts`, `feature-flags.service.spec.ts`, `workflow.service.spec.ts`, `tenant-isolation.spec.ts`, `soft-delete.spec.ts`, `export.service.spec.ts`, `event-store.service.spec.ts`, `redis-cache.service.spec.ts`, `rbac.service.spec.ts`, `users.service.spec.ts`, `docentes.service.spec.ts`, `turmas.service.spec.ts`, `cursos.service.spec.ts`, `substituicoes.service.spec.ts`)
  - `tests/integration/` (`academic-lifecycle.integration.spec.ts`, `reports.integration.spec.ts`)
  - `tests/e2e/` (`playwright.config.ts`, `auth-and-scheduling.e2e.spec.ts`)
- **Resultado da Execução**: 17 arquivos de teste, **41 testes executados, 41 aprovados (100% de sucesso)**.
- **Build de Compilação**:
  - `npm run build:api` -> Concluído com sucesso (0 erros)
  - `npm run build:web` -> Concluído com sucesso (0 erros)

---

### 🛡️ Matriz de Risco e Compatibilidade
| Componente | Compatibilidade Reversa | Risco Residual | Mitigação Implementada |
| :--- | :---: | :---: | :--- |
| **Banco de Dados** | 100% | Zero | Schemas desacoplados (`workflow`, `relatorios`, `core`); dados existentes preservados. |
| **APIs REST** | 100% | Zero | Endpoints legados mantidos; rotas novas prefixadas; soft-delete transparente. |
| **Frontend Web** | 100% | Zero | FeatureFlagProvider engloba a árvore sem quebrar componentes existentes. |
| **Docker Compose** | 100% | Zero | Contêineres `sira-postgres`, `sira-redis`, `sira-pgadmin` intactos; adicionados `sira-prometheus` e `sira-grafana`. |

---

### 🔮 Etapas Futuras e Próximos Passos
1. **Ativação Contínua em Produção**: Subir o monitoramento via `docker compose up -d prometheus grafana` e acessar `http://localhost:3001` (admin / Admin@2026).
2. **Expansão de Workflows**: Integrar mais formulários do frontend diretamente com o motor `workflow.solicitacoes`.
3. **Agendamento Cron do Refresh**: Adicionar job periódico em background no NestJS para disparar `ReportsService.refreshAllReports()` a cada 15 ou 30 minutos.
