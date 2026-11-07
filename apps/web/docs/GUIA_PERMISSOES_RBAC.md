# Guia de Permissões e Perfis de Acesso (RBAC) & Multitenancy por Unidade

O sistema Macro Micro Schedule adota um controle de acesso baseado em funções (**Role-Based Access Control - RBAC**) combinado com isolamento departamental e territorial por unidades operacionais (**Multitenancy por Unidade**), segregando funcionalidades por papel institucional e aplicando princípios rigorosos de menor privilégio e segurança de dados.

---

## 1. Estrutura de Papéis e Níveis de Acesso

| Perfil | Código (`role`) | Escopo Territorial | Prerrogativas e Regras de Segurança |
| :--- | :--- | :--- | :--- |
| **Super Administrador** | `SUPER_ADMIN` | **Global** (Todas as unidades) | **Acesso Total Irrestrito:** Visualiza todas as unidades e todos os usuários; cria, edita e exclui qualquer perfil (`SUPER_ADMIN`, `ADMIN`, `USER`, `PROFESSOR`, `PARTNER_SCHOOL`); vincula usuários a múltiplas unidades; gerencia configurações globais e auditoria. |
| **Administrador** | `ADMIN` | **Regional / Restrito** (Apenas unidades atribuídas) | **Gestão de Unidade:** Gerencia usuários (`USER`, `PARTNER_SCHOOL`) e professores (`PROFESSOR`) pertencentes às suas unidades permitidas. **Restrições:** Não pode alterar, editar ou excluir `SUPER_ADMIN` nem outros `ADMIN`s; não visualiza usuários de unidades não autorizadas; só pode vincular novos usuários às unidades que ele próprio possui. |
| **Operacional / Apoio** | `USER` | **Local** (Lotação única) | **Operação de Rotina:** Gestão diária de agendamentos, turmas, ambientes, uniformes e ativos. **Gestão de Professores:** Pode cadastrar, importar, editar e excluir professores da sua própria unidade de lotação. **Restrições:** Não acessa a gestão de usuários do sistema, não cria contas de usuários e não visualiza outras unidades. |
| **Professor(a)** | `PROFESSOR` | **Restrito** (Vínculo próprio) | Visualização do cronograma de aulas semanal, solicitação e aceite de permutas (*swaps*), relato de problemas em salas de aula e reserva direta de ambientes. |
| **Escola Parceira** | `PARTNER_SCHOOL` | **Restrito** (Escola vinculada) | Acompanhamento pedagógico de turmas parceiras, visualização de diário de classe e frequência de alunos vinculados à instituição parceira. |

---

## 2. Matriz de Permissões de Usuários e Professores

| Ação / Capacidade | `SUPER_ADMIN` | `ADMIN` | `USER` (Operador) | Observações e Regras de Negócio |
| :--- | :---: | :---: | :---: | :--- |
| **Ver todas as unidades no seletor** | ✅ | ❌ | ❌ | Admin e Operador veem apenas suas unidades atribuídas |
| **Ver usuários de unidades autorizadas** | ✅ | ✅ | ❌ | Regra de consulta `sharesUnit(actor, target)` |
| **Criar Super Admin** | ✅ | ❌ | ❌ | Exclusivo para Super Administradores |
| **Criar Admin** | ✅ | ❌ | ❌ | Exclusivo para Super Administradores |
| **Criar Usuário Operacional (`USER`)** | ✅ | ✅ | ❌ | Admin cria apenas para suas unidades permitidas |
| **Criar Escola Parceira (`PARTNER_SCHOOL`)**| ✅ | ✅ | ❌ | Admin vincula apenas à sua escola/unidade |
| **Criar / Importar Professor** | ✅ | ✅ | ✅ | Operador cadastra professores da sua unidade |
| **Editar Super Admin** | ✅ | ❌ | ❌ | Bloqueio em UI, handlers e `firestore.rules` |
| **Editar Admin** | ✅ | ❌ | ❌ | Admin não edita outros admins |
| **Editar Usuário Operacional** | ✅ | ✅ | ❌ | Restrito a usuários que compartilham unidade (`sharesUnit`) |
| **Editar Professor** | ✅ | ✅ | ✅ | Limitado aos docentes da unidade ativa |
| **Excluir Super Admin** | ✅ | ❌ | ❌ | Bloqueado para auto-exclusão por segurança |
| **Excluir Admin** | ✅ | ❌ | ❌ | Bloqueio em UI, handlers e `firestore.rules` |
| **Excluir Usuário Operacional** | ✅ | ✅ | ❌ | Restrito a usuários que compartilham unidade (`sharesUnit`) |
| **Excluir Professor** | ✅ | ✅ | ✅ | Operador pode excluir docentes da sua própria unidade |
| **Gerenciar múltiplas unidades** | ✅ | ✅ | ❌ | Operador tem lotação única obrigatória |

---

## 3. Matriz de Permissões por Módulo do Sistema

| Módulo / Recurso | `SUPER_ADMIN` | `ADMIN` | `USER` | `PROFESSOR` | `PARTNER_SCHOOL` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Gestão de Usuários (`users`)** | Total (Global) | Total (Unidades Permitidas) | Sem Acesso | Sem Acesso | Sem Acesso |
| **Professores (`teachers`)** | Total | Total | Total (Sua Unidade) | Perfil Próprio | Sem Acesso |
| **Agendamentos (`schedules`)** | Total | Total | Total | Reservas Próprias | Leitura Escopada |
| **Turmas (`classes`)** | Total | Total | Total | Somente Leitura | Leitura Escopada |
| **Ambientes / Salas (`rooms`)** | Total | Total | Total | Somente Leitura | Sem Acesso |
| **Cursos e Matrizes (`courses`)** | Total | Total | Total | Somente Leitura | Sem Acesso |
| **Central de Relatórios (`reports`)** | Total | Total | Operacionais | Sem Acesso | Sem Acesso |
| **Uniformes & EPIs (`uniforms`)** | Total | Total | Movimentações | Sem Acesso | Sem Acesso |
| **Gestão de Ativos (`assets`)** | Total | Total | Gestão de Sala | Abertura de Chamados | Sem Acesso |
| **Trocas de Aula (`swaps`)** | Total | Total | Somente Leitura | Solicitar / Aceitar | Sem Acesso |
| **Auditoria Sistêmica (`audit_logs`)**| Total | Total | Sem Acesso | Sem Acesso | Sem Acesso |
| **Acompanhamento Pedagógico** | Total | Bloqueado | Bloqueado | Bloqueado | Bloqueado |

---

## 4. Implementação Técnica do Middleware de Segurança

A lógica canônica de multitenancy e controle hierárquico está centralizada em `src/lib/UserRoles.ts`:

### `sharesUnit(actor, target)`
Determina se dois usuários compartilham ao menos uma unidade operacional:
```typescript
export function sharesUnit(
  actor: { unitIds?: string[]; selectedUnitId?: string; role?: UserRole; email?: string } | null | undefined,
  target: { unitIds?: string[]; selectedUnitId?: string; role?: UserRole; email?: string; unitId?: string } | null | undefined
): boolean {
  if (!actor || !target) return false;
  if (actor.role === UserRole.SUPER_ADMIN || actor.email === 'viniciusladeialara@gmail.com') return true;

  const actorUnits = actor.unitIds?.length ? actor.unitIds : [actor.selectedUnitId || 'caceres'];
  const targetUnits = target.unitIds?.length ? target.unitIds : [target.unitId || target.selectedUnitId || 'caceres'];

  return actorUnits.some(id => targetUnits.includes(id));
}
```

### `canManageUser(actor, target, action)`
Valida de forma atômica se um operador (`actor`) tem prerrogativa para criar, editar ou excluir um alvo (`target`):
- `SUPER_ADMIN`: Pode tudo (exceto auto-exclusão para evitar lock-out).
- `ADMIN`: Bloqueado para alterar ou excluir outros `ADMIN` ou `SUPER_ADMIN`. Exige `sharesUnit` para usuários comuns.
- `USER`: Permitido exclusivamente para docentes (`PROFESSOR`) que compartilhem sua unidade.

---

## 5. Regras de Backend (Cloud Functions & Firestore Security Rules)

1. **Cloud Function `createUser`:**
   - Rejeita chamadas onde um `ADMIN` tenta criar outro `ADMIN` ou `SUPER_ADMIN`.
   - Valida se o array de `unitIds` do novo usuário é um subconjunto estrito das unidades autorizadas do administrador requisitante.
2. **`firestore.rules`:**
   - Proteção do documento `/users/{userId}`: impede alterações cruzadas entre administradores e protege dados de Super Admins.
   - Proteção da coleção `/teachers/{teacherId}`: updates e deletes avaliam `hasUnitAccess` garantindo que o usuário só opere professores dentro das unidades a que tem direito.
