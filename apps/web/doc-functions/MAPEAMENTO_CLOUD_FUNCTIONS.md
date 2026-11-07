# Mapeamento e Diagnóstico das Cloud Functions (Pós-Limpeza v2.0)

Este documento reflete a arquitetura otimizada e consolidada das **12 Cloud Functions Ativas** do sistema, após a remoção de código morto, sobreposições e ferramentas depreciadas em conformidade com o `Analise_Cloud_FUNCTIONS.md`.

---

## 1. Resumo Executivo da Limpeza

* **Antes:** 25 Cloud Functions (funções órfãs, legadas, endpoints de teste e cópias duplicadas).
* **Depois:** **12 Cloud Functions Essenciais** (-52% de funções no backend).
* **Benefícios:**
  1. **Deploy ~50% mais rápido** no Firebase CLI.
  2. **Unificação completa da criação e reserva de salas** na função `createScheduleBatch` (mesmo motor de colisão para admin e docentes).
  3. **Zero chamadas órfãs** e integridade absoluta do frontend.

---

## 2. Inventário Oficial das 12 Cloud Functions Ativas

| # | Nome da Função | Arquivo de Origem | Tipo / Gatilho | Chamada no Frontend? | Objetivo / Responsabilidade |
| :-: | :--- | :--- | :---: | :--- | :--- |
| 1 | **`createScheduleBatch`** | `functions/src/index.ts` | `onCall` | ✅ `ScheduleCreationModal.tsx`, `reservationService.ts` | Motor unificado de criação de grade e reservas de sala em lote com validação de colisão |
| 2 | **`updateSchedule`** | `functions/src/index.ts` | `onCall` | ✅ `scheduleService.ts` | Atualização segura de horários e troca de sala/professor com checagem server-side |
| 3 | **`deleteSchedule`** | `functions/src/index.ts` | `onCall` | ✅ `scheduleService.ts` | Exclusão controlada de agendamentos com validação de permissões RBAC |
| 4 | **`resolveScheduleConflict`**| `functions/src/copySchedules.ts` | `onCall` | ✅ `scheduleService.ts`, `ConflictResolutionDialog.tsx` | Resolução de pendências e colisões no Hub de Conflitos |
| 5 | **`executeScheduleSwap`** | `functions/src/index.ts` | `onCall` | ✅ `swapService.ts` | Troca transacional de aulas entre dois docentes |
| 6 | **`createUser`** | `functions/src/index.ts` | `onCall` | ✅ `UserManagementModule.tsx` | Criação segura de credenciais no Firebase Auth e convite de primeiro acesso |
| 7 | **`onTeacherStatusUpdated`** | `functions/src/notifications.ts` | `Firestore Trigger` | ⚡ Automático (`teachers/{id}`) | Sincroniza status ativo/inativo e desativa usuário no Firebase Auth |
| 8 | **`runScheduleGenerator`** | `functions/src/index.ts` | `onCall` | ✅ Motor de IA / PRD 2 | Algoritmo gerador de grade horária semanal da turma |
| 9 | **`onScheduleWritten`** | `functions/src/notifications.ts` | `Firestore Trigger` | ⚡ Automático (`schedules/{id}`) | Monitora criação/alteração de aulas e alimenta `schedule_conflicts` |
| 10| **`onRoomUpdated`** | `functions/src/notifications.ts` | `Firestore Trigger` | ⚡ Automático (`rooms/{id}`) | Detecta manutenção ou mudança de capacidade de salas |
| 11| **`onTeacherDeleted`** | `functions/src/notifications.ts` | `Firestore Trigger` | ⚡ Automático (`teachers/{id}`) | Exclui acesso Auth e desvincula registros de docentes excluídos |
| 12| **`cleanupOldAuditLogs`** | `functions/src/FinOps_CleanupLogs_Prototype.ts` | `Scheduled Cron` | ⚡ Diário (`0 0 * * *`) | Limpeza automática de logs de auditoria antigos para economia (FinOps) |

---

## 3. Relação de Funções Removidas

| Função Removida | Origem Anterior | Motivo da Descontinuação |
| :--- | :--- | :--- |
| `createTeacherSchedule` | `src/index.ts:773` | Código morto; criação unitária nunca chamada |
| `createTeacherScheduleBatch` | `src/index.ts:919` | Unificada na função principal `createScheduleBatch` |
| `copyMonthlySchedules` | `src/copySchedules.ts:51` | Substituída pelo modal `ScheduleCopyWeekModal.tsx` no frontend |
| `undoMonthlyCopy` | `src/copySchedules.ts:406` | Operação de rollback legada não utilizada pelo frontend |
| `bulkCreateCourses` | `src/index.ts:160` | Cadastro de cursos é feito diretamente via Firestore SDK |
| `importCourses` | `src/index.ts:418` | Sem integração externa; cursos gerenciados pelo `CourseModule.tsx` |
| `listUsers` | `src/index.ts:1092` | Frontend consome diretamente Firestore com `onSnapshot` |
| `listCourses` | `src/index.ts:1116` | Frontend consome diretamente Firestore com `onSnapshot` |
| `generateHiringPDF` | `src/index.ts:1485` | Protótipo abandonado; sem botão de acionamento no cliente |
| `migrateLegacyTeachers` | `src/index.ts:698` | Script pontual executado uma única vez no passado |
| `testCors` | `src/index.ts:492` | Endpoint de depuração e botão de teste removidos |
| `getCacheStats` | `src/index.ts:1140` | Ferramenta interna sem uso em produção |
| `clearCache` | `src/index.ts:1165` | Ferramenta interna sem uso em produção |
