# 📘 MANUAL DE USO OPERACIONAL E CONTROLE MASTER - SIRA

**SIRA — Sistema Integrado de Recursos Acadêmicos (SENAI)**  
*Documento Oficial de Governança, Credenciais de Acesso e Guia Operacional.*

---

## 📑 Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Serviços, Portas e Endpoints Oficiais](#2-serviços-portas-e-endpoints-oficiais)
3. [Credenciais e Usuários para Controle Master](#3-credenciais-e-usuários-para-controle-master)
4. [Como Inicializar o Sistema](#4-como-inicializar-o-sistema)
5. [Guia de Uso por Perfil de Acesso](#5-guia-de-uso-por-perfil-de-acesso)
6. [Módulos Principais e Regras de Negócio](#6-módulos-principais-e-regras-de-negócio)
7. [Relatórios Enterprise e Exportações](#7-relatórios-enterprise-e-exportações)
8. [Observabilidade e Monitoramento (Prometheus & Grafana)](#8-observabilidade-e-monitoramento-prometheus--grafana)
9. [Sincronização Duplo Banco (Produção <-> Homologação)](#9-sincronização-duplo-banco-produção---homologação)
10. [Comandos Rápidos e Rotinas de Manutenção](#10-comandos-rápidos-e-rotinas-de-manutenção)

---

## 1. Visão Geral da Arquitetura

O **SIRA** opera sob uma arquitetura de **Monólito Modular Corporativo**, com separação estrita de responsabilidades:

- **Frontend:** React 18, Vite, TypeScript, TailwindCSS, Radix UI e TanStack Query.
- **Backend:** NestJS 10+, TypeScript, Prisma ORM, Redis 7 (Cache, Sessions e Rate Limiting).
- **Banco de Dados:** PostgreSQL 16 com particionamento lógico em Schemas dedicados:
  - `core`: Usuários, Unidades, Perfis RBAC, Permissões, Feature Flags e Seed History.
  - `academico`: Cursos, Ambientes, Docentes e Turmas.
  - `planejamento`: Agendamentos e Substituições/Permutas.
  - `workflow`: Motor de aprovações, solicitações, assinaturas e Event Store imutável.
  - `relatorios`: Materialized Views analíticas e funções de refresh concorrente.
  - `auditoria`: Logs de auditoria à prova de adulteração.
  - `producao`: Espelhamento homologado.

---

## 2. Serviços, Portas e Endpoints Oficiais

| Serviço | URL / Acesso | Porta | Credenciais Padrão |
| :--- | :--- | :---: | :--- |
| **Frontend Web** | [http://localhost:5173](http://localhost:5173) | `5173` | *(Utilize qualquer usuário da tabela abaixo)* |
| **Backend API (REST)** | [http://localhost:3000/api/v1](http://localhost:3000/api/v1) | `3000` | Bearer Token JWT |
| **Métricas Prometheus** | [http://localhost:3000/api/v1/metrics](http://localhost:3000/api/v1/metrics) | `3000` | Aberto para scraper |
| **Grafana Dashboards** | [http://localhost:3001](http://localhost:3001) | `3001` | Usuário: `admin` \| Senha: `Admin@2026` |
| **Prometheus Server** | [http://localhost:9090](http://localhost:9090) | `9090` | Aberto |
| **pgAdmin 4 (GUI Banco)** | [http://localhost:8080](http://localhost:8080) | `8080` | Email: `admin@sira.com` \| Senha: `Admin@2026` |
| **PostgreSQL 16** | `localhost:5432` (db: `sira`) | `5432` | User: `sira_admin` \| Senha: `Sira@2026` |
| **Redis 7 Cache** | `localhost:6379` | `6379` | Sem senha padrão (Rede Docker interna) |

---

## 3. Credenciais e Usuários para Controle Master

O sistema foi refatorado para um modelo corporativo de alta governança com **Hierarquia Estrita em Cascata** e **Liberação Granular de Módulos**.

> [!IMPORTANT]
> **Único Usuário Master Provisionado (SUPER_ADMIN):**
>
> | Nome do Usuário | E-mail de Login | Senha Master | Perfil RBAC | Unidades Atribuídas | Acesso ao Sistema |
> | :--- | :--- | :---: | :---: | :--- | :--- |
> | **Super Administrador SIRA** | **`admin@sira.local`** *(ou `admin@sira.com`)* | **`Admin@2026`** | `super_admin` | **Todas as Unidades** (Cuiabá, Cáceres, Rondonópolis, Sinop) | **Acesso Master Full**: Controle total de governança, motor de sistema, parâmetros globais, criação de administradores de escolas e alternador multi-unidades no cabeçalho. |

---

### 🛡️ Regras de Governança e Hierarquia do Sistema

1. **Criação de Administradores de Escolas (`SUPER_ADMIN` -> `ADMIN`):**
   - O `SUPER_ADMIN` é o **único perfil com autoridade** para cadastrar e gerenciar **Administradores de Escolas (ADMIN)**.
   - O `SUPER_ADMIN` define a qual escola (unidade) ou escolas o gestor responderá.

2. **Regra de Ouro: Admin NÃO Edita Admin e NEM Cadastra Admin:**
   - Um administrador escolar (`ADMIN`) **NÃO** tem permissão para criar outro `ADMIN` ou `SUPER_ADMIN`.
   - Um administrador escolar **NÃO** pode alterar nem excluir outro `ADMIN` ou `SUPER_ADMIN`.
   - Esta restrição é validada tanto no frontend (ocultando opções e botões de ação) quanto no backend (`UsersService` rejeita com `403 Forbidden`).

3. **Efeito Cascata (Lotação Automática da Escola):**
   - Se o `SUPER_ADMIN` cadastrar um Administrador da unidade **Cáceres**, quando esse gestor entrar e cadastrar usuários (professores, secretários, etc.), o sistema **automaticamente vincula esses novos usuários à unidade Cáceres**.
   - O gestor escolar não pode vincular colaboradores a outras unidades.

4. **Módulos Desativados por Padrão (Concessão Pontual):**
   - Todos os novos usuários cadastrados chegam com **todos os módulos desativados por padrão**.
   - Durante o cadastro ou edição, o administrador marca expressamente os módulos que o colaborador terá direito de usar (ex.: apenas Agendamentos e Turmas).
   - Se o colaborador se destacar ou mudar de setor, o gestor pode editar o usuário e marcar módulos adicionais (ex.: Estoque de Uniformes, Ativos, etc.).

5. **Filtro Multi-Unidade no Topo da Página:**
   - **Usuário com 1 única unidade:** O menu suspenso não é exibido; a unidade do usuário fica exibida de forma fixa e travada (ex.: *SENAI Cáceres*).
   - **Usuário com mais de 1 unidade (ou SUPER_ADMIN):** O menu suspenso no topo da barra lateral é liberado para permitir alternar entre as unidades autorizadas.

---

## 4. Como Inicializar o Sistema

### Método 1: Pelo Terminal Rápido (Recomendado)

1. **Subir os Contêineres de Infraestrutura (Postgres, Redis, pgAdmin, Prometheus, Grafana):**
   ```bash
   docker compose up -d
   ```
2. **Iniciar o Backend NestJS:**
   ```bash
   npm --prefix apps/api run start:dev
   ```
3. **Iniciar o Frontend Vite React:**
   ```bash
   npm --prefix apps/web run dev
   ```
4. Acesse no navegador: **[http://localhost:5173](http://localhost:5173)**.

### Método 2: Pelo Menu Interativo Windows
Execute com duplo-clique ou pelo CMD:
```cmd
menu.bat
```
- Escolha a opção **`[1]`** para iniciar o ecossistema completo (Docker + Backend + Frontend).
- Escolha a opção **`[12]`** para diagnóstico de conectividade.

---

## 5. Guia de Uso por Perfil de Acesso

### 👑 Perfil: Administrador (`administrador`)
- **Tela de Controle Master:** Acesso total à barra lateral completa:
  - Gestão de Usuários (criação, edição de permissões dinâmicas por módulo e exclusão via soft delete).
  - Parâmetros Globais e Chaveamento de Unidades (Multi-Tenant).
  - Gerenciamento de Feature Flags ativas via Redis.
  - Sincronização e Promoção Transacional de Banco de Dados.
  - Acesso aos relatórios consolidados de todas as unidades.

### 📋 Perfil: Coordenador (`coordenador`)
- **Foco Operacional:**
  - Cadastro e manutenção de Cursos, Turmas, Docentes e Ambientes de sua unidade.
  - Montagem de grade horária (Agendamentos) com prevenção de choque de horários.
  - Aprovação de solicitações de permuta docente.
  - Emissão de relatórios locais de ocupação e carga horária.
  - *Restrição:* Não visualiza configurações críticas de banco ou outros tenants não autorizados.

### 🎓 Perfil: Professor (`professor`)
- **Visualização Focal:**
  - Acesso à grade de horários própria e das turmas designadas.
  - Botão de solicitação de substituição/troca de horário com outro docente.
  - *Restrição:* Sem botões de exclusão, edição de infraestrutura ou alteração de usuários.

---

## 6. Módulos Principais e Regras de Negócio

### 📅 1. Motor de Agendamento e Validação de Conflitos
- **Detecção em Tempo Real:** O sistema impede reservas sobrepostas:
  - *Conflito de Sala:* Impede que dois agendamentos no mesmo ambiente compartilhem intervalo temporal.
  - *Conflito de Docente:* Impede que o mesmo professor seja agendado em turmas ou salas distintas no mesmo horário.
- **Event Store:** Cada agendamento gravado emite o evento imutável `AGENDAMENTO_CRIADO` no schema `workflow.eventos`.

### 🔄 2. Substituição e Permuta Docente (Workflow Engine)
- Um docente ou coordenador solicita a troca entre o professor titular e o substituto.
- Ao deferir a substituição com status `aprovada`, o SIRA:
  1. Atualiza automaticamente o agendamento no banco de dados.
  2. Registra o histórico de auditoria.
  3. Emite o evento canônico `SWAP_APROVADO`.

### 🗑️ 3. Padrão Corporativo de Soft Delete
- Nenhuma exclusão física (`DELETE FROM ...`) é executada para usuários, docentes, cursos, ambientes ou turmas.
- O registro é marcado com:
  - `ativo = FALSE`
  - `excluido_em = NOW()`
  - `excluido_por = UUID_DO_EXECUTOR`
- Toda listagem na interface oculta automaticamente os registros marcados como excluídos.

---

## 7. Relatórios Enterprise e Exportações

O SIRA conta com 4 **Materialized Views** de alto desempenho no schema `relatorios`, permitindo análises volumosas com tempo de resposta quase instantâneo:

1. **Ocupação de Ambientes:** `relatorios.vw_ocupacao_ambientes`
   - Total de horas ocupadas, capacidade e percentual estimado de ocupação por sala/laboratório.
2. **Carga Horária Docente:** `relatorios.vw_carga_docentes`
   - Total de agendamentos, turmas e percentual da jornada de 40h alocada por professor.
3. **Turmas Ativas:** `relatorios.vw_turmas_ativas`
   - Situação das turmas, ano letivo, turno e período do primeiro ao último agendamento.
4. **Detecção de Conflitos:** `relatorios.vw_conflitos`
   - Identificação imediata de sobreposições de horários com data/hora de interseção.

### 📥 Formatos de Exportação Disponíveis
Nos endpoints da API ou botões da interface, os relatórios suportam:
- **`format=csv`**: Arquivo CSV codificado em **UTF-8 com BOM** (abre com acentos perfeitos no Microsoft Excel).
- **`format=xlsx`**: Planilha nativa formatada com cabeçalho corporativo escuro, linhas zebradas e auto-largura de colunas gerada via ExcelJS.
- **`format=pdf`**: Documento corporativo diagramado em layout paisagem com grade e paginação via PDFKit.

---

## 8. Observabilidade e Monitoramento (Prometheus & Grafana)

A pilha de monitoramento corporativo já está integrada ao Docker Compose:

1. Acesse o **Grafana** em [http://localhost:3001](http://localhost:3001) (`admin` / `Admin@2026`).
2. Abra o dashboard pré-configurado: **`SIRA Enterprise - Visão Geral do Sistema`**.
3. **Métricas Monitoradas em Tempo Real:**
   - **PostgreSQL:** Status UP/DOWN e latência das consultas em milissegundos.
   - **Redis:** Status UP/DOWN e latência do comando `PING`.
   - **NestJS API:** Taxa de requisições por rota (`req/s`), percentis de latência (p50 e p95) e contador de erros HTTP (4xx e 5xx).
   - **Recursos da Máquina:** Consumo de CPU (%) e memória RAM (Heap Usado e RSS) do processo Node.js.

---

## 9. Sincronização Duplo Banco (Produção <-> Homologação)

O SIRA possui uma arquitetura de duplo banco que permite simular e homologar horários em um banco de testes antes de aplicar na produção:

- **Espelhar Produção -> Teste:**
  ```bash
  node scripts/mirror-prod-to-test.mjs
  ```
  *(Copia a base atual de produção para a base de testes `sira_teste` mantendo isolamento).*
- **Promover Teste -> Produção:**
  ```bash
  node scripts/promote-test-to-prod.mjs
  ```
  *(Exige senha de Administrador, executa validação transacional e registra o evento `PROMOCAO_EXECUTADA` no Event Store).*

---

## 10. Comandos Rápidos e Rotinas de Manutenção

| Objetivo | Comando |
| :--- | :--- |
| **Executar Suíte Completa de Testes** | `npm --prefix apps/api test` |
| **Executar Testes com Cobertura** | `npm --prefix apps/api run test:cov` |
| **Compilar Monorepo Completo (API + Web)** | `npm run build` |
| **Executar Migrations Pendentes do Prisma** | `npm --prefix apps/api exec prisma migrate deploy -- --schema apps/api/prisma/schema.prisma` |
| **Executar Runner de Seeds Idempotente** | `npx tsx database/seed-runner.ts` |
| **Revogar Todas as Sessões de um Usuário** | `POST http://localhost:3000/api/v1/auth/revoke-all` (Header: `Authorization: Bearer <TOKEN>`) |
| **Atualizar Materialized Views de Relatórios**| `POST http://localhost:3000/api/v1/reports/refresh` |
| **Limpar Cache do Redis** | `docker exec -it sira-redis redis-cli FLUSHALL` |

---

> [!NOTE]  
> Este documento é mantido sob controle de versão. Para registrar alterações arquiteturais ou de credenciais, atualize também o [`CHANGELOG.md`](file:///c:/Users/VINICIUS/Documents/GitHub/SIRA/CHANGELOG.md).
