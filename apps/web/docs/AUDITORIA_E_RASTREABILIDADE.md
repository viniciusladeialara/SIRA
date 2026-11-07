# Auditoria e Rastreabilidade ("Quem Fez o Quê")

O sistema Macro Micro Schedule implementa uma camada de rastreabilidade abrangente para assegurar conformidade operacional e auditoria completa de alterações em turmas, professores, ambientes e agendamentos.

---

## 1. Campos de Rastreabilidade nos Documentos

### Coleção `schedules` (Agendamentos)
* `createdBy`: UID do usuário que criou o agendamento (via agendamento em lote, criação avulsa ou reserva direta).
* `createdAt`: Timestamp de quando o agendamento foi registrado no sistema.
* `updatedBy`: UID do usuário que realizou a última modificação no agendamento.
* `updatedAt`: Timestamp da última modificação.
* `scheduleStatus`: Status do agendamento (`'original'`, `'conflict_flagged'`, `'manually_adjusted'`, `'substituted'`, `'reverted'`).
* `batchId`: ID do lote de cópia mensal (quando gerado por replicação).

### Coleção `teachers`, `classes`, `rooms`, `courses`
* `createdAt` e `updatedAt`: Timestamps automáticos de ciclo de vida.
* `unitId` e `unitName`: Identificação da unidade responsável.

---

## 2. Coleção Central `audit_logs`

Registra ações administrativas e operacionais críticas de forma imutável (as regras do Firestore proíbem `update` ou `delete` em `audit_logs`).

### Estrutura do Documento de Auditoria
```typescript
interface AuditLogEntry {
  id: string;
  action: AuditAction;        // Ex: CREATE_TEACHER, BULK_CREATE_SCHEDULES, USER_ROLE_CHANGED
  adminId: string;            // UID do usuário autenticado que executou a ação
  adminEmail: string;         // E-mail do usuário autenticado
  description: string;        // Descrição humanizada (ex: "Cadastrou o professor João Silva")
  details: Record<string, any>; // Payload contextual (IDs, diferenças antes/depois, contadores)
  timestamp: Timestamp;       // Data/hora da ação
  ipAddress?: string;         // Endereço IP do cliente
  userAgent?: string;         // Navegador/dispositivo do cliente
}
```

### Ações Auditadas Atualmente (`AuditAction`)
* **Professores:** `CREATE_TEACHER`, `UPDATE_TEACHER`, `DELETE_TEACHER`
* **Turmas & Disciplinas:** `CREATE_CLASS`, `UPDATE_CLASS`, `DELETE_CLASS`, `CREATE_UNIT`, `UPDATE_UNIT`, `DELETE_UNIT`
* **Ambientes:** `CREATE_ENVIRONMENT`, `UPDATE_ENVIRONMENT`, `DELETE_ENVIRONMENT`
* **Cursos:** `CREATE_COURSE`, `UPDATE_COURSE`, `DELETE_COURSE`, `IMPORT_COURSES`
* **Agendamentos:** `CREATE_SCHEDULE`, `UPDATE_SCHEDULE`, `DELETE_SCHEDULE`, `BULK_CREATE_SCHEDULES`
* **Usuários:** `CREATE_USER`, `UPDATE_USER`, `DELETE_USER`, `USER_ROLE_CHANGED`, `USER_STATUS_CHANGED`, `USER_INVITE_SENT`
* **Sistema & Dados:** `DATA_IMPORT`, `DATA_EXPORT`, `SYSTEM_ERROR`
* **Sessão:** `LOGIN`, `LOGIN_FAILED`

---

## 3. Rastreabilidade de Processos Especiais

### 3.1. Trocas de Horário (`scheduleSwaps`)
* `requesterTeacherId` / `requesterTeacherName`: Docente que solicitou a troca.
* `targetTeacherId` / `targetTeacherName`: Docente receptor da proposta.
* `respondedAt` e `executedAt`: Timestamps de resposta e execução atômica da troca.
* `originalSchedule1TeacherId` vs `finalSchedule1TeacherId`: Snapshot antes e depois da inversão.

### 3.2. Lotes de Cópia Mensal (`schedule_copy_batches`)
* `createdBy`: UID do administrador que disparou a cópia do mês.
* `status`: `'processing'`, `'completed'`, `'completed_with_conflicts'`, `'undone'`.
* `undoneBy` e `undoneAt`: Registram quem e quando executou o rollback do lote.

### 3.3. Histórico de Conflitos (`schedule_conflicts`)
* `sourceScheduleId`: ID do agendamento que originou a sobreposição.
* `conflictingScheduleIds`: IDs dos agendamentos concorrentes.
* `status`: `'pending'`, `'resolved'`, `'ignored'`.
* `resolvedBy` e `resolvedAt`: UID e data/hora da resolução humana ou `'system_auto_fix'`.
* `resolutionAction`: Ação executada (`'ignore'`, `'accept_anyway'`, `'resolve'`).

---

## 4. Visualização de Auditoria no Painel

Administradores podem consultar o histórico completo em **Relatórios $\rightarrow$ Auditoria Sistêmica**:
* Filtragem por intervalo de datas.
* Filtragem por tipo de ação (`AuditAction`).
* Filtragem por e-mail de usuário.
* Exportação da trilha de auditoria em planilha Excel (`.xlsx`).
