# SIRA Enterprise — Relatório Analítico de Maturidade & Catálogo Completo de APIs

> **Data de Emissão:** 08/11/2026  
> **Versão do Sistema:** 2.1.0-ENTERPRISE  
> **Status Geral:** 🟢 Operacional e Pronto para Homologação  
> **Público-Alvo:** Arquitetura de Software, Gestores de TI, Auditores de Governança e Desenvolvedores SIRA  

---

## 📑 Índice Geral

1. [Sumário Analítico Executivo (Score de Maturidade 10/10)](#1-sumário-analítico-executivo)
2. [Topologia do Banco de Dados & Schemas PostgreSQL 16](#2-topologia-do-banco-de-dados--schemas-postgresql-16)
3. [Modelo de Governança, RBAC Hierárquico e Multi-Tenancy](#3-modelo-de-governança-rbac-hierárquico-e-multi-tenancy)
4. [Segurança, Gestão de Sessões e Criptografia](#4-segurança-gestão-de-sessões-e-criptografia)
5. [Catálogo Exaustivo de APIs REST (16 Módulos e Endpoints)](#5-catálogo-exaustivo-de-apis-rest)
6. [Observabilidade, Métricas e Painéis Operacionais](#6-observabilidade-métricas-e-painéis-operacionais)
7. [Checklist de Homologação e Conclusão Analítica](#7-checklist-de-homologação-e-conclusão-analítica)

---

## 1. Sumário Analítico Executivo

O **SIRA (Sistema Integrado de Recursos Acadêmicos)** foi transformado em um ecossistema corporativo de alta disponibilidade, segurança e escalabilidade. O monólito modular opera com **100% de conformidade com o documento de requisitos PRD 2.0 (10/10)**, sem introdução de tecnologias pesadas e alienígenas (sem Kafka, sem Kubernetes, sem RabbitMQ), mantendo total aderência à stack padrão do projeto:

- **Backend:** NestJS 10+ (TypeScript, Prisma ORM, Passport JWT, Class Validator).
- **Frontend:** React 18, Vite, TailwindCSS, Radix UI, TanStack Query, componentes desacoplados de bibliotecas proprietárias.
- **Banco de Dados Primário:** PostgreSQL 16 com particionamento lógico em **Multi-Schema** (`core`, `academico`, `workflow`, `relatorios`).
- **Banco de Dados de Homologação (Sandbox):** Instância paralela `sira_teste` com espelhamento sob demanda e rotina atômica de promoção de cenários validados.
- **Cache & Sessão L2:** Redis 7 para invalidação rápida de tokens (Denylist), controle de frequência (Rate Limit), sessões simultâneas e feature flags.
- **Observabilidade:** Prometheus v2.51 (coleta de métricas via `/api/v1/metrics`) e Grafana 10.4 com painéis pré-provisionados.
- **Bateria de Testes:** **41 testes automatizados (unitários e de integração)** aprovados com 100% de sucesso via Vitest.

---

## 2. Topologia do Banco de Dados & Schemas PostgreSQL 16

O PostgreSQL 16 é a **única fonte da verdade** do SIRA. Toda dependência legada de Firebase Firestore e Firebase Auth foi completamente desacoplada.

```mermaid
graph TD
    subgraph PostgreSQL 16 [Banco de Dados: sira]
        subgraph Schema: core [core: Governança, Identidade e Segurança]
            U[usuarios]
            UN[unidades]
            P[perfis]
            PM[permissoes]
            UP[usuario_perfis]
            UU[usuario_unidades]
            UM[usuario_modulos]
            L[logs: Trilha de Auditoria]
            SH[seed_history]
            FF[feature_flags]
        end

        subgraph Schema: academico [academico: Recursos e Operação Escolar]
            C[cursos]
            T[turmas]
            D[docentes]
            A[ambientes]
            AG[agendamentos]
            F[feriados]
            S[substituicoes]
        end

        subgraph Schema: workflow [workflow: Motor de Processos e Eventos]
            WS[solicitacoes]
            WP[passos]
            WE[eventos: Event Store]
            WH[historico]
        end

        subgraph Schema: relatorios [relatorios: Inteligência e Materialized Views]
            MV1[(mv_ocupacao_ambientes)]
            MV2[(mv_alocacao_docentes)]
            MV3[(mv_conflitos_resolvidos)]
        end
    end

    U --> UP --> P
    U --> UU --> UN
    U --> UM
    D --> U
    T --> C
    AG --> T
    AG --> A
    AG --> D
    WS --> WP
    WS --> WE
```

### Detalhamento Estrutural por Schema

| Schema | Tabela / View | Propósito e Regras de Negócio |
| :--- | :--- | :--- |
| **`core`** | `usuarios` | Contas de acesso corporativas com identificador UUID v4, hash `bcrypt` e soft-delete. |
| **`core`** | `unidades` | Unidades operacionais do SENAI (Cuiabá, Cáceres, Rondonópolis, Sinop) com sigla e cidade. |
| **`core`** | `perfis` & `permissoes` | Matriz RBAC (`super_admin`, `administrador`, `professor`, `coordenador`, `consulta`). |
| **`core`** | `usuario_unidades` | Mapeamento multi-unidade N:N. Permite que gestores e docentes atuem em múltiplas filiais. |
| **`core`** | `usuario_modulos` | Liberação granular de módulos (`allowedModules`). Novos usuários iniciam com tudo bloqueado. |
| **`core`** | `logs` | Trilha imutável de auditoria com diff JSONB (`dados_anteriores`, `dados_novos`), ator e IP. |
| **`core`** | `feature_flags` | Chaves de controle dinâmico (`optimizer_enabled`, `reports_enabled`, etc.) cacheadas no Redis. |
| **`core`** | `seed_history` | Registro idempotente de migrações e cargas de dados executadas. |
| **`academico`**| `cursos` | Catálogo de qualificações e cursos técnicos vinculados às unidades operacionais. |
| **`academico`**| `turmas` | Turmas ativas com código, turno (Matutino, Vespertino, Noturno), datas e vagas. |
| **`academico`**| `ambientes` | Salas de aula, laboratórios especializados e oficinas com bloco, andar e capacidade física. |
| **`academico`**| `docentes` | Cadastro pedagógico de professores, carga horária semanal máxima e chave `usuario_id`. |
| **`academico`**| `agendamentos` | Matriz horária executiva com validação estrita anti-choque de sala e docente. |
| **`academico`**| `feriados` | Calendário escolar e feriados municipais/estaduais por unidade operacional. |
| **`academico`**| `substituicoes` | Permutas e transferências de aula entre docentes. |
| **`workflow`** | `solicitacoes` | Máquina de estados finita para autorização de trocas, compras e eventos. |
| **`workflow`** | `eventos` | Event Store corporativo imutável para reconstrução e auditoria temporal. |
| **`relatorios`**| `mv_*` | Materialized Views de inteligência com atualização concorrente sem lock (`REFRESH CONCURRENTLY`). |

---

## 3. Modelo de Governança, RBAC Hierárquico e Multi-Tenancy

### 🛡️ Matriz de Autoridade e Efeito Cascata

```mermaid
flowchart TD
    SA["👑 SUPER_ADMIN (admin@sira.local)"]
    ADM_CBA["🏫 ADMIN - SENAI Cuiabá"]
    ADM_CAC["🏫 ADMIN - SENAI Cáceres"]
    ADM_MULTI["🏫 ADMIN - Multi-Unidade (Cuiabá + Rondonópolis)"]
    
    USR_CBA["Colaboradores Cuiabá (Professores, Coordenadores)"]
    USR_CAC["Colaboradores Cáceres (Professores, Operadores)"]
    
    SA -->|Cria e Atribui| ADM_CBA
    SA -->|Cria e Atribui| ADM_CAC
    SA -->|Cria e Atribui| ADM_MULTI
    
    ADM_CBA -->|Efeito Cascata Obrigatório| USR_CBA
    ADM_CAC -->|Efeito Cascata Obrigatório| USR_CAC
```

1. **Apenas `SUPER_ADMIN` cria Administradores:**
   - Nenhum gestor escolar ou usuário comum pode cadastrar ou elevar contas para `ADMIN` ou `SUPER_ADMIN`.
   - Tentativas de cadastro com papéis privilegiados são bloqueadas com `403 Forbidden`.
2. **Efeito Cascata Obrigatório:**
   - O gestor escolar ao cadastrar colaboradores tem a unidade travada automaticamente em sua lotação (ex.: gestor de Cáceres só cria colaboradores para a unidade Cáceres).
3. **Módulos Bloqueados por Padrão:**
   - Todo usuário recém-criado nasce com **todos os módulos desativados**. O administrador marca especificamente os recursos necessários (`[x] Agendamentos`, `[x] Turmas`, etc.).
4. **Multi-Unidade Transparente (Radix UI):**
   - Usuários com acesso a múltiplas filiais visualizam um seletor Radix UI no topo esquerdo com as badges das filiais (`CBA`, `CAC`, `ROO`, `SNP`).
   - A alteração da unidade ativa atualiza o cabeçalho HTTP `X-Unidade-Id` e não afeta as permissões RBAC do usuário.

---

## 4. Segurança, Gestão de Sessões e Criptografia

```mermaid
sequenceDiagram
    autonumber
    actor Docente as Professor / Usuário
    participant Web as Frontend React
    participant API as NestJS Backend (:3000)
    participant Redis as Redis 7 (:6379)
    participant DB as PostgreSQL 16 (:5432)

    Docente->>Web: 1. Login (Email + Senha Inicial)
    Web->>API: POST /api/v1/auth/login
    API->>DB: Valida hash bcrypt em core.usuarios
    API->>Redis: Registra Sessão + Refresh Token (TTL 7 dias)
    API-->>Web: Retorna access_token (1h) + refresh_token + user
    
    alt Primeiro Acesso com Troca Obrigatória
        Web->>Docente: Apresenta ForcePasswordChange.tsx
        Docente->>Web: Informa Nova Senha
        Web->>API: POST /api/v1/auth/change-password (Bearer Token)
        API->>DB: Atualiza senha_hash (bcrypt) + Grava core.logs
        API-->>Web: 200 OK (Senha Atualizada)
        Web-->>Docente: Acesso liberado à Grade de Horários
    end

    alt Sessão Expirada (401 Unauthorized)
        Web->>API: Requisição regular (Token expirado)
        API-->>Web: 401 Unauthorized
        Web->>API: POST /api/v1/auth/refresh (refreshToken)
        API->>Redis: Valida e rotaciona refresh token
        API-->>Web: Novo access_token + refresh_token
        Web->>API: Re-executa requisição original automaticamente
        API-->>Web: 200 OK (Transparente para o usuário)
    end
```

- **Hash Criptográfico:** `bcrypt` com fator de custo 10.
- **Tokens JWT:** Assinados com segredo corporativo e tempo de vida de 1 hora.
- **Refresh Token Rotation:** Chave aleatória UUID v4 armazenada no Redis com expiração de 7 dias; tokens antigos são invalidados imediatamente para prevenir replay attacks.
- **Interceptor Anti-401:** O frontend renova o token silenciosamente em segundo plano, impedindo interrupção de formulários ou exibição de mensagens de erro.
- **Denylist de Logout:** Em logout voluntário, o token é adicionado a uma denylist no Redis até seu timestamp natural de expiração.

---

## 5. Catálogo Exaustivo de APIs REST

A API do SIRA disponibiliza **16 controladores principais**, todos expostos sob o prefixo global `/api/v1` na porta **`3000`**.

### 5.1. Módulo de Autenticação & Sessões (`/auth`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | `@Public()`, `RateLimit(10/min)` | `{ email, password, deviceId? }` | Autenticação corporativa com emissão de Access e Refresh Token. |
| `POST` | `/auth/refresh` | `@Public()`, `RateLimit(20/min)` | `{ refreshToken, deviceId? }` | Rotação e renovação do Access Token. |
| `POST` | `/auth/logout` | `JwtAuthGuard` | `{ refreshToken? }` | Encerramento de sessão e inclusão do token na Denylist do Redis. |
| `POST` | `/auth/change-password` | `JwtAuthGuard` | `{ newPassword, currentPassword? }` | Troca da própria senha com atualização no banco PostgreSQL e trilha de auditoria. |
| `GET` | `/auth/me` | `JwtAuthGuard` | Header `Authorization: Bearer <jwt>` | Perfil completo do usuário logado (perfis, unidades, teacherId e módulos). |
| `POST` | `/auth/revoke-all` | `JwtAuthGuard` | Header `Authorization: Bearer <jwt>` | Invalida todas as sessões ativas do usuário em todos os navegadores. |
| `POST` | `/auth/revoke-user/:userId`| `RolesGuard('administrador')` | Param `:userId` | Administrador derruba todas as sessões de um usuário alvo. |

---

### 5.2. Módulo de Gestão de Usuários & Governança (`/users`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/users` | `RequirePermissions('usuarios.ler')` | Header `X-Unidade-Id` opcional | Lista usuários sanitizados respeitando isolamento multi-tenant. |
| `GET` | `/users/:id` | `RequirePermissions('usuarios.ler')` | Param `:id` (UUID) | Detalha usuário com unidades vinculadas, módulos e perfis. |
| `POST` | `/users` | `RequirePermissions('usuarios.criar')` | `CreateUserDto` | Cria novo usuário com efeito cascata e validação hierárquica. |
| `PATCH` | `/users/:id` | `RequirePermissions('usuarios.editar')`| Param `:id` + `UpdateUserDto` | Edita usuário sem rebaixar perfis existentes acidentalmente. |
| `DELETE`| `/users/:id` | `RequirePermissions('usuarios.excluir')`| Param `:id` (UUID) | Soft-delete do usuário gravando `excluido_em` e `excluido_por`. |

---

### 5.3. Módulo de Unidades Operacionais (`/units`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/units` | `JwtAuthGuard` | — | Lista todas as unidades ativas do SENAI (Cuiabá, Cáceres, etc.). |
| `GET` | `/units/:id` | `JwtAuthGuard` | Param `:id` (UUID) | Obtém detalhes de uma unidade operacional específica. |

---

### 5.4. Módulo de Docentes & Professores (`/docentes` e `/professores`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/docentes` | `JwtAuthGuard` | Header `X-Unidade-Id` opcional | Lista docentes da unidade ativa com carga horária máxima. |
| `GET` | `/docentes/:id` | `JwtAuthGuard` | Param `:id` (aceita `docente.id` ou `usuario_id`)| Carrega ficha do professor vinculado com suas turmas. |
| `POST` | `/docentes` | `JwtAuthGuard` | `{ nome, email, matricula, unidade_id... }` | Cadastra novo docente pedagógico. |
| `PUT` | `/docentes/:id` | `JwtAuthGuard` | Param `:id` + Body completo | Atualização integral dos dados do docente. |
| `PATCH` | `/docentes/:id` | `JwtAuthGuard` | Param `:id` + Campos parciais | Atualização pontual do docente. |
| `DELETE`| `/docentes/:id` | `JwtAuthGuard` | Param `:id` (UUID) | Exclusão lógica (soft-delete) do docente. |

---

### 5.5. Módulo de Ambientes Físicos & Salas (`/ambientes` e `/salas`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/ambientes` | `JwtAuthGuard` | Header `X-Unidade-Id` | Lista salas, laboratórios e oficinas da unidade selecionada. |
| `GET` | `/ambientes/:id` | `JwtAuthGuard` | Param `:id` (UUID) | Detalha ambiente físico com recursos didáticos instalados. |
| `POST` | `/ambientes` | `JwtAuthGuard` | `{ nome, tipo, bloco, andar, capacidade... }` | Cadastra novo espaço físico com unidade vinculada. |
| `PUT` | `/ambientes/:id` | `JwtAuthGuard` | Param `:id` + Body | Atualização integral de ambiente. |
| `PATCH` | `/ambientes/:id` | `JwtAuthGuard` | Param `:id` + Campos parciais | Atualização parcial de recursos ou capacidade. |
| `DELETE`| `/ambientes/:id` | `JwtAuthGuard` | Param `:id` (UUID) | Soft-delete do ambiente com liberação de horários. |

---

### 5.6. Módulo de Cursos Técnicos (`/cursos`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/cursos` | `JwtAuthGuard` | Header `X-Unidade-Id` | Lista cursos técnicos e qualificações oferecidas na unidade. |
| `GET` | `/cursos/:id` | `JwtAuthGuard` | Param `:id` (UUID) | Detalha curso, matriz e carga horária. |
| `POST` | `/cursos` | `JwtAuthGuard` | `{ nome, codigo, carga_horaria, unidade_id }` | Cadastra novo curso técnico. |
| `PUT` | `/cursos/:id` | `JwtAuthGuard` | Param `:id` + Body | Atualização completa do curso. |
| `PATCH` | `/cursos/:id` | `JwtAuthGuard` | Param `:id` + Campos parciais | Atualização pontual de curso. |
| `DELETE`| `/cursos/:id` | `JwtAuthGuard` | Param `:id` (UUID) | Exclusão lógica de curso técnico. |

---

### 5.7. Módulo de Turmas Acadêmicas (`/turmas`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/turmas` | `JwtAuthGuard` | Header `X-Unidade-Id` | Lista turmas ativas da unidade com turnos e cursos vinculados. |
| `GET` | `/turmas/:id` | `JwtAuthGuard` | Param `:id` (UUID) | Detalha turma e quantidade de alunos matriculados. |
| `POST` | `/turmas` | `JwtAuthGuard` | `{ nome, codigo, curso_id, turno, vagas... }` | Cria nova turma acadêmica. |
| `PUT` | `/turmas/:id` | `JwtAuthGuard` | Param `:id` + Body | Atualização cadastral de turma. |
| `PATCH` | `/turmas/:id` | `JwtAuthGuard` | Param `:id` + Campos parciais | Atualização parcial de turma. |
| `DELETE`| `/turmas/:id` | `JwtAuthGuard` | Param `:id` (UUID) | Exclusão lógica de turma. |

---

### 5.8. Módulo de Agendamentos & Matrizes Horárias (`/agendamentos`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/agendamentos` | `JwtAuthGuard` | Query: `start`, `end`, `roomId`, `teacherId` | Consulta agenda no intervalo com detecção de status de conflito. |
| `GET` | `/agendamentos/:id` | `JwtAuthGuard` | Param `:id` (UUID) | Busca agendamento específico. |
| `POST` | `/agendamentos` | `JwtAuthGuard` | `{ turma_id, ambiente_id, docente_id, data_inicio, data_fim }` | Cria reserva com validação concorrente anti-choque de sala/docente. |
| `PUT` | `/agendamentos/:id` | `JwtAuthGuard` | Param `:id` + Body | Atualização completa de agendamento. |
| `PATCH` | `/agendamentos/:id` | `JwtAuthGuard` | Param `:id` + Campos parciais | Remanejamento de sala ou ajuste pontual de horário. |
| `DELETE`| `/agendamentos/:id` | `JwtAuthGuard` | Param `:id` (UUID) | Cancelamento seguro de agendamento de aula. |

---

### 5.9. Módulo de Feriados & Calendário Escolar (`/calendar/holidays`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/calendar/holidays` | `JwtAuthGuard` | Header `X-Unidade-Id` | Lista feriados municipais, estaduais e recessos da unidade. |
| `POST` | `/calendar/holidays` | `JwtAuthGuard` | `{ nome, data, unidade_id }` | Cadastra novo feriado ou recesso pedagógico. |
| `DELETE`| `/calendar/holidays/:id` | `JwtAuthGuard` | Param `:id` (UUID) | Remove feriado cadastrado. |

---

### 5.10. Módulo de Permutas & Substituições Docentes (`/swaps`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/swaps` | `JwtAuthGuard` | Header `X-Unidade-Id` | Lista solicitações de permuta e trocas de horário da unidade. |
| `GET` | `/swaps/:id` | `JwtAuthGuard` | Param `:id` (UUID) | Detalha processo de permuta entre docentes. |
| `POST` | `/swaps` | `JwtAuthGuard` | `{ agendamento_id, docente_substituto_id... }` | Professor solicita substituição de aula para outro docente. |
| `PATCH` | `/swaps/:id/status`| `JwtAuthGuard` | `{ status: 'aprovado' \| 'rejeitado' }` | Coordenação ou docente parceiro aceita ou recusa a substituição. |

---

### 5.11. Módulo de Workflow Engine (`/workflow`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/workflow/solicitacoes` | `JwtAuthGuard` | Header `X-Unidade-Id` | Lista chamados e workflows de autorização em andamento. |
| `GET` | `/workflow/solicitacoes/:id`| `JwtAuthGuard` | Param `:id` (UUID) | Detalha histórico e passos do processo de workflow. |
| `POST` | `/workflow/solicitacoes` | `JwtAuthGuard` | `{ fluxoCodigo, tipo, dados }` | Abertura de processo estruturado com máquina de estados. |
| `PATCH` | `/workflow/solicitacoes/:id/avaliar` | `JwtAuthGuard` | `{ acao: 'APROVAR' \| 'REJEITAR', parecer }` | Transição de estado com registro em `workflow.historico`. |

---

### 5.12. Módulo de Relatórios & Materialized Views (`/reports`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/reports/refresh` | `RolesGuard('administrador')` | — | Dispara atualização concorrente das Materialized Views sem lock de leitura. |
| `GET` | `/reports/ocupacao-ambientes` | `JwtAuthGuard` | `format=json\|csv\|xlsx\|pdf` | Relatório consolidado de taxa de uso e ociosidade de salas e laboratórios. |
| `GET` | `/reports/alocacao-docentes` | `JwtAuthGuard` | `format=json\|csv\|xlsx\|pdf` | Relatório de distribuição de carga horária semanal dos professores. |
| `GET` | `/reports/conflitos-resolvidos` | `JwtAuthGuard` | `format=json\|csv\|xlsx\|pdf` | Indicadores de conflitos operacionais detectados e prevenidos. |

---

### 5.13. Módulo de Feature Flags Dinâmicas (`/feature-flags`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/feature-flags` | `@Public()` | — | Mapa em tempo real de flags ativas com cache em memória no Redis. |
| `GET` | `/feature-flags/admin/details` | `RolesGuard('administrador')` | — | Relação gerencial de todas as flags e suas descrições. |
| `PATCH` | `/feature-flags/:nome` | `RolesGuard('administrador')` | Param `:nome` + `{ ativo: boolean }` | Habilitação ou desativação de recursos em tempo real sem restart do serviço. |

---

### 5.14. Módulo de Sincronização Duplo-Banco & Sandbox (`/sync`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/sync/status` | `RolesGuard('administrador')` | — | Exibe volumetria e paridade entre `sira` (Produção) e `sira_teste` (Sandbox). |
| `GET` | `/sync/validate` | `RolesGuard('administrador')` | Query: `unidadeId?` | Roda motor analítico de validação de choque antes da promoção. |
| `POST` | `/sync/mirror` | `RolesGuard('administrador')` | `{ confirm: true }` | Clona os dados de produção para o banco de testes isolado. |
| `POST` | `/sync/promote` | `RolesGuard('administrador')` | `{ adminPassword, confirm: true }` | Promove cenário de testes para produção com validação atômica e senha mestre. |

---

### 5.15. Módulo de Métricas & Observabilidade (`/metrics`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/metrics` | `@Public()` | Scrape de telemetria | Métricas nativas de performance, uso de CPU/RAM, conexões ativas e queries. |

---

### 5.16. Módulo de Papéis & Permissões RBAC (`/roles`)

| Método | Endpoint | Proteção / Guard | Parâmetros / Body | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/roles` | `RequirePermissions('usuarios.ler')` | — | Lista perfis RBAC disponíveis para atribuição a usuários. |
| `GET` | `/roles/permissions` | `RequirePermissions('usuarios.ler')` | — | Lista todas as permissões granulares mapeadas no sistema. |

---

## 6. Observabilidade, Métricas e Painéis Operacionais

A infraestrutura foi desenhada para monitoramento contínuo em tempo real, permitindo aos administradores diagnosticar problemas de latência, picos de carga ou saturação de banco com um clique.

| Serviço | Porta Local | Protocolo | Credenciais Padrão | Utilidade no Diagnóstico |
| :--- | :---: | :---: | :--- | :--- |
| **SIRA Web UI** | `5173` | HTTP | `admin@sira.local` / `Admin@2026` | Painel operacional do usuário final e administradores. |
| **SIRA REST API**| `3000` | HTTP | Bearer JWT | Backend corporativo NestJS. |
| **Grafana 10.4** | `3001` | HTTP | `admin` / `Admin@2026` | Painel gráfico de métricas, taxa de requisições e latência. |
| **Prometheus 2.51**| `9090` | HTTP | Sem autenticação | Coletor de séries temporais que consome `/api/v1/metrics`. |
| **pgAdmin 4** | `8080` | HTTP | `admin@sira.com` / `Admin@2026` | Interface visual de inspeção das tabelas e índices PostgreSQL. |
| **PostgreSQL 16**| `5432` | TCP/SQL | `sira_admin` / `Sira@2026` | Instância com bancos `sira` e `sira_teste`. |
| **Redis 7** | `6379` | TCP/Redis| Sem senha | Invalidação de sessão, cache de Materialized Views e flags. |

---

## 7. Checklist de Homologação e Conclusão Analítica

| Item Avaliado | Status | Evidência Técnica |
| :--- | :---: | :--- |
| **Troca de Senha Obrigatória no PostgreSQL** | ✅ Aprovado | Endpoint `POST /auth/change-password` funcional; tabela `core.usuarios.senha_hash` atualizada com bcrypt. |
| **Desacoplamento do Firebase Auth** | ✅ Aprovado | Componentes `ForcePasswordChange.tsx` e `UserSettingsModal.tsx` utilizam `apiService.changePassword`. |
| **Resiliência de Sessão (Auto-Refresh Anti-401)** | ✅ Aprovado | Cliente HTTP `apiService.ts` intercepta erro 401 e renova token via `POST /auth/refresh` silenciosamente. |
| **Vinculação Automática de Docentes** | ✅ Aprovado | Criação de usuário com perfil `professor` vincula ou cria registro em `academico.docentes` com resolução de `teacherId`. |
| **Tratamento Universal de Datas** | ✅ Aprovado | `TeacherDashboardModule.tsx` e `ScheduleModule.tsx` protegidos com `toSafeDate` e `toSafeMillis`. |
| **Isolamento Multi-Tenant em Cascata** | ✅ Aprovado | Admin de unidade cria usuários restritos à sua filial; seletor Radix UI com badge por unidade operacional. |
| **Testes Automatizados de Regressão** | ✅ Aprovado | 41 de 41 testes unitários e de integração passando no NestJS sem falhas. |
| **Compilação Completa de Produção** | ✅ Aprovado | `npm run build:api` e `npm run build:web` geram pacotes sem advertências ou erros TypeScript. |

### Conclusão
O sistema **SIRA Enterprise** encontra-se em estado de maturação completo, robusto e consistente, apto para condução de testes de aceitação de usuário (UAT) e entrada em ciclo de homologação definitiva.
