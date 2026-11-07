# Macro Micro Schedule - Documento de Inicialização e Referência Técnica (`init.md`)

Este arquivo contém todas as informações fundamentais sobre o sistema, sua arquitetura, regras de negócio, modelagem de dados e instruções de desenvolvimento. **Caso você modifique o sistema, mantenha este arquivo atualizado.**

---

## 1. Stack Tecnológica (100% Google Cloud / Firebase)

O sistema opera de forma pura e nativa sobre o ecossistema Google Cloud:
* **Frontend**: React 18 (TypeScript) + Vite (Single Page Application)
* **Hospedagem**: Firebase Hosting (distribuição global via CDN)
* **Estilização**: TailwindCSS + Radix UI / shadcn/ui + Lucide React
* **Banco de Dados**: Google Cloud Firestore (NoSQL em tempo real, multi-tenant lógico com regras de segurança Zero Trust)
* **Autenticação**: Firebase Authentication (autenticação baseada em JWT e perfis no Firestore)
* **Backend Serverless**: Firebase Cloud Functions v2 (Node.js 22 / TypeScript na região `us-central1`)
* **Armazenamento**: Firebase Cloud Storage (armazenamento de arquivos e comprovantes com regras de segurança)
* **Integração de Calendário**: Google Agenda (Web Intent 1-clique) e exportação universal `.ics` (RFC 5545)
* **Auditoria**: Coleção `audit_logs` estritamente imutável (append-only) no Firestore

> [!NOTE]
> Todo o código legado ou experimental relacionado a bancos relacionais (PostgreSQL/SQL), containers Docker de banco de dados e APIs intermediárias em Express foi completamente removido do repositório, mantendo o foco exclusivo e limpo na arquitetura Google Cloud Serverless.

---

## 2. Multi-Tenancy e Isolamento de Unidades (Campuses)

O sistema utiliza um modelo **multi-tenant lógico** no Firestore. As unidades são isoladas por um identificador `unitId` no nível do documento em cada coleção principal.

### Unidades Ativas
1. **Cáceres**: ID: `"caceres"` | Nome: `"SENAI Cáceres"`
2. **Várzea Grande**: ID: `"varzea-grande"` | Nome: `"SENAI Várzea Grande"`
3. **Barra do Bugres**: ID: `"barra-do-bugres"` | Nome: `"SENAI Barra do Bugres"`

### Regra de Compartilhamento de Entidades
* **Compartilhados Globalmente**:
  * **Cursos (`courses`)**: Os cursos são cadastrados de forma global e compartilhados entre todas as unidades.
* **Isolados por Unidade (`unitId`)**:
  * **Professores (`teachers`)**: Pertencem exclusivamente a uma unidade.
  * **Salas/Laboratórios (`rooms`)**: Espaços físicos vinculados a uma única unidade.
  * **Turmas (`classes`)**: Cohorts/turmas de alunos criados em uma unidade específica para cursar um curso global.
  * **Agendamentos (`schedules`)**: Alocações de horários que vinculam professor, sala e turma em uma unidade específica.

---

## 3. Estrutura do Banco de Dados (Coleções Principais no Firestore)

### 3.1. Coleção `units` (Unidades SENAI)
* **Caminho**: `/units/{unitId}`
* **Estrutura**:
  ```typescript
  {
    name: string; // Ex: "SENAI Barra do Bugres"
    code: string; // Ex: "BB"
    createdAt: Timestamp;
    metadata?: {
      shifts?: string[]; // Ex: ["Matutino", "Vespertino", "Noturno"]
      roomTypes?: string[];
      blocks?: string[];
      floors?: string[];
    }
  }
  ```

### 3.2. Coleção `users` (Perfis de Acesso & RBAC)
* **Caminho**: `/users/{userId}`
* **Campos principais**:
  * `email`: string
  * `name`: string
  * `role`: `'SUPER_ADMIN' | 'ADMIN' | 'USER' | 'PROFESSOR' | 'PARTNER_SCHOOL'`
  * `unitIds`: Array de strings contendo os IDs das unidades às quais o usuário tem acesso (ex: `["caceres", "varzea-grande"]`).
  * `selectedUnitId`: ID da unidade ativa no momento (ex: `"caceres"`).
  * `allowedModules` (opcional): Array com os IDs dos módulos liberados dinamicamente para o usuário.

### 3.3. Outras Coleções Isoladas (`teachers`, `rooms`, `classes`, `schedules`)
Cada documento contém os campos de tenant:
* `unitId`: string (ex: `"barra-do-bugres"`)
* `unitName`: string (ex: `"SENAI Barra do Bugres"`)

### 3.4. Backend Serverless & Cloud Functions v2
As operações atômicas e regras de negócio de alta integridade residem em `functions/src/`:
1. **`createScheduleBatch`** (`onCall`): Valida teto de 5h por sala/turno, colisões via cache em memória e insere grade em lote. Suporta `teacherId: 'direct_booking'`.
2. **`updateSchedule`** (`onCall`): Atualiza horários com revalidação de colisões server-side.
3. **`deleteSchedule`** (`onCall`): Exclui agendamento e limpa pendências em `schedule_conflicts`.
4. **`resolveScheduleConflict`** (`onCall`): Resolução no Hub de Conflitos (ignorar, aceitar ou realocar recurso livre).
5. **`executeScheduleSwap`** (`onCall`): Permuta transacional de aulas (`db.runTransaction()`).
6. **`createUser`** (`onCall`): Criação atômica no Firebase Auth + Firestore (`users` e `teachers`).
7. **`runScheduleGenerator`** (`onCall`): Geração inteligente de horários respeitando matriz, dias úteis, turno e rate limit.
8. **`onScheduleWritten`** (Trigger `schedules/{id}`): Sentinela de conflitos no banco e alimentador de alertas.
9. **`onRoomUpdated`** (Trigger `rooms/{id}`): Gestão de salas em manutenção (`conflict_flagged`) e restauração automática.
10. **`onTeacherDeleted`** (Trigger `teachers/{id}`): Safe-delete do Firebase Auth e marcação de aulas órfãs (`teacher_missing`).
11. **`onTeacherStatusUpdated`** (Trigger `teachers/{id}`): Desativação imediata de sessão no Auth (`disabled: !isActive`).
12. **`cleanupOldAuditLogs`** (Cron `0 0 * * *`): Política FinOps de retenção (7 dias geral, 90 dias crítico).

---

## 4. Regras de Resolução de Nomes
Para evitar inconsistências e redundâncias, utilize a função utilitária centralizada `getUnitName` de `@/lib/utils` para mapear IDs em nomes oficiais de unidades:
```typescript
import { getUnitName } from "@/lib/utils";
const unitName = getUnitName(selectedUnitId); // Retorna "SENAI Barra do Bugres"
```

---

## 5. Diretrizes para Modificações
1. **Novo Campo**: Se adicionar novos campos de configuração em nível de unidade, certifique-se de adicioná-los ao `metadata` da unidade em `units` ou no `SystemSettingsModule`.
2. **Segurança**: Qualquer nova query de leitura nas coleções de `teachers`, `rooms`, `classes` ou `schedules` no frontend ou backend deve filtrar por `unitId` (`where("unitId", "==", selectedUnitId)`), com exceção das visualizações consolidadas por super administradores.
3. **Padrão Micro-Kernel**: Para adicionar uma nova funcionalidade, crie o componente em `src/components/modules/` e registre seu manifesto em `src/core/registeredModules.ts`. Ele herdará automaticamente tolerância a falhas via `ModuleErrorBoundary`.
4. **Deploy e Operações**: Utilize o script `menu.bat` para compilações locais e deploys no Firebase.
