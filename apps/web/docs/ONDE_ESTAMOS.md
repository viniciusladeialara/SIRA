# Onde Estamos: Arquitetura Vigente, Core Engine e Ecossistema Atual

Este documento descreve com precisão o estado técnico, operacional e arquitetural do sistema **Macro Micro Schedule**, detalhando o funcionamento do **Core Engine (Motor Principal)**, os módulos em produção, o modelo de governança com Super Admin, as proteções LGPD, a excelência em agendamento inteligente e o processo de deploy.

---

## 1. Visão Geral do Sistema Hoje

O **Macro Micro Schedule** é a plataforma unificada de governança educacional, agendamento inteligente de aulas, gestão de recursos físicos e acompanhamento pedagógico do SENAI Mato Grosso.

* **URL de Produção (Hosting):** [https://agendador-ambiente2.web.app](https://agendador-ambiente2.web.app)
* **Console do Projeto:** [Firebase Console](https://console.firebase.google.com/project/agendador-ambiente2/overview)
* **Multi-Tenant Lógico em Tempo Real:** Suporte a múltiplas unidades escolares (**Cáceres**, **Barra do Bugres**, **Várzea Grande**) isoladas por regras de segurança Zero Trust no Firestore, com troca de unidade em 1 clique.
* **Fuso Horário Oficial:** Todos os agendamentos, turnos e relatórios operam estritamente sob o horário oficial de **Cuiabá/Mato Grosso (UTC-4)**.
* **Resiliência e Desacoplamento:** Todas as funcionalidades de negócio operam como módulos independentes encapsulados em barreiras de tolerância a falhas.

---

## 2. A Arquitetura Core Modular (Micro-Kernel)

A aplicação é estruturada sobre o padrão **Micro-Kernel (Plugin Architecture)**, desacoplando o núcleo do sistema das regras de negócio de cada módulo:

```
+-------------------------------------------------------------------------------+
|                            CORE ENGINE (MOTOR PRINCIPAL)                      |
|                                                                               |
|   +-------------------+   +--------------------+   +----------------------+   |
|   |   Autenticação    |   |  Controle de       |   |  Navegação Lateral   |   |
|   |   & Sessão        |   |  Acesso Dinâmico   |   |  & Seletor Unidades  |   |
|   +-------------------+   +--------------------+   +----------------------+   |
|                                                                               |
|   +-----------------------------------------------------------------------+   |
|   |                       MODULE REGISTRY (CATÁLOGO)                      |   |
|   |     (Gerencia metadados, permissões por usuário e carregamento lazy)  |   |
|   +-----------------------------------------------------------------------+   |
+-------------------------------------------------------------------------------+
                                        |
          +-----------------------------+-----------------------------+
          |                             |                             |
          v                             v                             v
+-------------------+         +-------------------+         +-------------------+
|  ErrorBoundary    |         |  ErrorBoundary    |         |  ErrorBoundary    |
|         +         |         |         +         |         |         +         |
| Módulo Agendamento|         | Módulo Uniformes  |         | Módulo Diagnóstico|
+-------------------+         +-------------------+         +-------------------+
  (Falha Contida)               (Totalmente Isolado)          (Laboratório Core)
```

### Componentes Centrais (`src/core/`):
1. **[types.ts](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/core/types.ts):** Contrato formal `ModuleDefinition` definindo propriedades de cada módulo (id, título, ícone, categoria, perfis autorizados, componente lazy, badges dinâmicos).
2. **[ModuleErrorBoundary.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/core/ModuleErrorBoundary.tsx):** Barreira de proteção ativa. Se um módulo falhar, apenas sua área central exibe mensagem amigável de erro com botões de recarga e stack trace; menus laterais, logout e demais módulos continuam 100% ativos.
3. **[ModuleRegistry.ts](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/core/ModuleRegistry.ts):** Catálogo central que armazena os módulos e resolve permissões com base na role e nas liberações dinâmicas do Firestore.
4. **[useCoreEngine.ts](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/core/useCoreEngine.ts):** Hook reativo que organiza os módulos em categorias, gerencia o menu acordeão (inicia colapsado e recolhe o anterior ao abrir um novo) e garante que o usuário caia sempre no **Dashboard / Visão Geral (`overview`)** após o login.
5. **[registeredModules.ts](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/core/registeredModules.ts):** Ponto de registro onde todos os módulos do sistema são declarados.

---

## 3. Governança, Segurança e Proteção LGPD

Atendendo ao plano corretivo corporativo, a plataforma consolidou três pilares fundamentais de segurança:

### 3.1. Formalização do Papel `SUPER_ADMIN`
* **Desacoplamento do e-mail fixo:** O papel `SUPER_ADMIN` agora é uma constante formal no enum [UserRoles.ts](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/lib/UserRoles.ts) com matriz de acesso total (`fullAccess: true`).
* **Segurança de Transição:** O hook [usePermissions.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/hooks/usePermissions.tsx) contempla tanto a role `SUPER_ADMIN` quanto o e-mail raiz de emergência (`viniciusladeialara@gmail.com`), eliminando qualquer risco de lockout.
* **Gestão Visual de Usuários:** Super Administradores são identificados por badge roxo e ícone de coroa 👑 em [UserTable.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/users/UserTable.tsx), podendo promover outros colaboradores a Super Admin em [UserCreateDialog.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/users/UserCreateDialog.tsx) e [UserEditDialog.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/users/UserEditDialog.tsx).

### 3.2. Trilha de Auditoria Imutável (`Audit Log`)
* **Garantia em Banco de Dados:** No [firestore.rules](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/firestore.rules), a coleção `audit_logs` é estritamente append-only:
  ```javascript
  allow update, delete: if false; // Imutabilidade de auditoria
  ```
* **Novas Ações Monitoradas em [AuditLog.ts](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/lib/AuditLog.ts):**
  * `USER_MODULE_PERMISSION_CHANGED`: Registrada sempre que permissões dinâmicas de módulos são alteradas.
  * `TEACHER_MONITORING_ACCESSED`: Registrada automaticamente no acesso ao módulo de Acompanhamento Docente.
  * `SYSTEM_CONFIG_UPDATED`: Registrada em alterações de configuração da instituição.

### 3.3. Conformidade LGPD no Acompanhamento Docente
* No [TeacherMonitoringModule.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/modules/TeacherMonitoringModule.tsx), registros pedagógicos sensíveis (MSEP e SLIs) são restritos a quem possuir autorização via `isUserSuperAdmin()`.
* Cada acesso ao módulo dispara automaticamente um registro de auditoria contendo UID, e-mail, nome e horário da consulta.
* A coleção `teacher_monitoring` no Firestore bloqueia leitura e gravação para qualquer usuário que não seja Super Admin.

---

## 4. Excelência em Agendamento Inteligente

Seguindo o [PRD_AGENDAMENTO_MELHORIAS.md](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/docs/PRD_AGENDAMENTO_MELHORIAS.md), o motor de agendamento foi elevado de um cadastro passivo para uma ferramenta proativa e de alta produtividade:

### 4.1. Templates e Recorrência Inteligente ("Copiar Grade da Semana")
* **Componente:** [ScheduleCopyWeekModal.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/schedules/ScheduleCopyWeekModal.tsx).
* Permite à coordenação selecionar a semana atual como modelo e replicá-la para **1, 2, 3, 4 (mês completo), 6 ou 8 semanas futuras** com 1 clique.
* **Respeito Automático a Feriados:** Cruza previamente todas as datas projetadas com a coleção `holidays` da unidade. Aulas que caem em feriados oficiais ou recessos são puladas automaticamente, exibindo um resumo claro do total de aulas criadas e feriados preservados.
* **Lotes Atômicos:** Processamento em blocos com `writeBatch` do Firestore e log de auditoria corporativa.

### 4.2. Prevenção Ativa de Conflitos e Feriados no Booking
* No [ScheduleCreationModal.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/schedules/ScheduleCreationModal.tsx), o cálculo de slots recorrentes exclui previamente dias que coincidem com a tabela de feriados.
* O painel de conflitos emite avisos preventivos em tempo real: *"Feriado(s) no período: [Data - Nome]. Estes dias foram pulados automaticamente."*
* Caso todo o período selecionado seja composto por feriados, o envio é bloqueado preventivamente com mensagem informativa.

### 4.3. Interoperabilidade de Calendário (Google Calendar & iCal/.ics)
* **Utilitário:** [calendarExport.ts](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/lib/calendarExport.ts) com conformidade ao padrão internacional **RFC 5545**.
* **Google Agenda com 1 Clique:** Cria links Web Intent com parâmetros formatados (turma, sala, bloco, docente e horário) para adicionar qualquer aula à agenda pessoal sem necessidade de digitação.
* **Download de Arquivo `.ics`:** Disponível em 3 níveis:
  1. No card da grade semanal ([ScheduleCard.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/schedules/ScheduleCard.tsx)) ao passar o mouse.
  2. No diálogo de detalhes e edição da aula ([ScheduleEditDialog.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/schedules/ScheduleEditDialog.tsx)).
  3. No painel do professor ([TeacherDashboardModule.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/modules/TeacherDashboardModule.tsx)) por aula individual ou em lote ("Exportar Minha Agenda" com todas as próximas aulas).

### 4.4. Métricas de Ocupação dos Ambientes em Tempo Real
* Na barra de filtros da grade ([ScheduleFilters.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/schedules/ScheduleFilters.tsx)), é calculada a porcentagem de ambientes ocupados para a semana e turno selecionados (ex: *Ocupação das Salas: 75% (12/16)*).
* Atalho rápido para exportação de toda a semana em arquivo `.ics`.

---

## 5. Resolução Definitiva de Reservas Diretas

* **Causa Anterior:** O sistema gravava o UID de administradores no campo `teacherId` de reservas diretas (eventos institucionais sem professor). A rotina antiga de diagnóstico apontava 22 reservas válidas como "professores fantasmas".
* **Solução Implementada:**
  1. Na criação e edição ([ScheduleCreationModal.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/schedules/ScheduleCreationModal.tsx) e [ScheduleEditDialog.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/schedules/ScheduleEditDialog.tsx)), reservas diretas gravam estritamente `teacherId: 'direct_booking'`, preservando o nome do organizador em `teacherName`.
  2. Validações de conflito ignoram colisões entre reservas diretas em salas distintas.
  3. No [SystemSettingsModule.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/modules/SystemSettingsModule.tsx), o scanner reconhece reservas diretas e oferece o botão **"Normalizar Reservas Diretas"** (em lote via `writeBatch`), protegendo agendamentos reais contra exclusão acidental.

---

## 6. Catálogo Completo dos Módulos em Operação

| Categoria | ID do Módulo | Nome de Exibição | Perfis Padrão | Funcionalidade Principal |
| :--- | :--- | :--- | :--- | :--- |
| **Principal** | `overview` | Visão Geral (Overview) | `ADMIN`, `USER` | Painel gráfico de métricas e indicadores operacionais da unidade ativa. |
| **Cadastros Gerais** | `user-management` | Usuários(as) | `ADMIN` | Gestão de contas, atribuição de perfis, unidades e liberação dinâmica de módulos. |
| **Cadastros Gerais** | `professors` | Professores(as) | `ADMIN`, `USER` | Cadastro de docentes, disponibilidade de turnos e criação de contas de acesso. |
| **Cadastros Gerais** | `classes` | Turmas | `ADMIN`, `USER` | Cadastro curricular de turmas, dias de aula, turno e carga horária diária. |
| **Cadastros Gerais** | `courses` | Cursos | `ADMIN`, `USER` | Catálogo de cursos técnicos, qualificações e matrizes de competências. |
| **Cadastros Gerais** | `environments` | Ambientes | `ADMIN`, `USER` | Cadastro de salas, laboratórios e oficinas organizados por bloco e andar. |
| **Gestão Educacional** | `schedules` | Agendamentos | `ADMIN`, `USER`, `PROFESSOR` | Grade semanal/mensal com cópia de semana, respeito a feriados e exportação iCal/Google Agenda. |
| **Gestão Educacional** | `conflicts` | Conflitos | `ADMIN`, `USER` | Hub com detecção atômica de colisões e indicador (badge) pulsante de pendências. |
| **Gestão Educacional** | `swaps` | Trocas | `ADMIN`, `USER` | Histórico e aprovação de permutas de aulas no mesmo dia e turno. |
| **Gestão Educacional** | `teacher-allocation`| Alocação Docente | `ADMIN` | Matriz de carga horária e alocação de docentes por turma. |
| **Gestão Educacional** | `teacher-monitoring`| Acompanhamento Docente| `SUPER_ADMIN` | Registros pedagógicos MSEP e governança por SLIs (Confidencial LGPD). |
| **Gestão Educacional** | `teacher-week` | Minha Semana | `PROFESSOR` | Visão de campo para docentes em oficinas com 1-clique para Google Agenda e .ics. |
| **Gestão Educacional** | `partner-tracking` | Acompanhamento | `PARTNER_SCHOOL` | Painel de monitoramento de turmas para representantes escolares externos. |
| **Logística & Recursos** | `uniforms` | Uniformes & EPIs | `ADMIN`, `USER` | Controle físico de estoque, tamanhos e auditoria de movimentações. |
| **Logística & Recursos** | `assets` | Gestão de Ativos | `ADMIN`, `USER` | Inventário de máquinas, equipamentos e histórico de manutenção das salas. |
| **Logística & Recursos** | `report-issue` | Reportar Problema | `PROFESSOR` | Abertura ágil de chamados de manutenção para salas e equipamentos. |
| **Relatórios & Dados** | `reports` | Relatórios | `ADMIN`, `USER` | Central unificada com 10 relatórios e exportação para Excel (.xlsx) com auto-width. |
| **Motor & Governança** | `core-demo` | Diagnóstico do Core & Exemplo | `ADMIN` | Laboratório de testes do Core, inspetor de sessão e simulador de falhas. |
| **Motor & Governança** | `system-settings` | Configurações do Sistema | `ADMIN` | Parâmetros operacionais globais, diagnóstico inteligente e personalização de login. |

---

## 7. Como Adicionar um Novo Módulo em 3 Passos

Qualquer desenvolvedor da equipe pode adicionar novos módulos sem alterar o Core Engine:

### Passo 1: Construir o Componente
Crie seu componente (ex: `src/components/modules/EstagiosModule.tsx`):
```tsx
import React from 'react';

export const EstagiosModule: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Gestão de Estágios</h1>
      <p>Módulo isolado pronto para uso.</p>
    </div>
  );
};
```

### Passo 2: Definir o Manifesto do Módulo
Em `src/core/registeredModules.ts`, declare a definição:
```tsx
import { lazy } from 'react';
import { Briefcase } from 'lucide-react';
import { UserRole } from '@/lib/UserRoles';
import { ModuleDefinition } from '@/core/types';

export const estagiosModuleDef: ModuleDefinition = {
  id: 'estagios',
  title: 'Estágios Supervisionados',
  icon: Briefcase,
  category: 'educacional',
  order: 55,
  roles: [UserRole.ADMIN, UserRole.USER],
  component: lazy(() =>
    import('@/components/modules/EstagiosModule').then(m => ({ default: m.EstagiosModule }))
  ),
};
```

### Passo 3: Registrar no Catálogo
Ainda em `src/core/registeredModules.ts`:
```tsx
ModuleRegistry.register(estagiosModuleDef);
```
O módulo passa a aparecer automaticamente nos menus dos perfis autorizados e na tela de liberação dinâmica de módulos.

---

## 8. Procedimentos de Build e Deploy

* **Frontend Build:** `npm run build` (validação de tipos TypeScript e empacotamento Vite sem erros).
* **Functions Build:** `npm --prefix "functions" run build` (compilação do backend serverless com Node.js 22).
* **Deploy Completo:** `firebase deploy` (publica regras de Firestore, Storage, índices, 25 Cloud Functions e os arquivos estáticos no Hosting).
