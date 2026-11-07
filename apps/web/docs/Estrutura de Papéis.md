## Estrutura de Papéis

### 1. SUPER_ADMIN

Possui acesso global.

**Pode:**

* Visualizar todas as unidades
* Visualizar todos os usuários
* Criar usuários em qualquer unidade
* Editar qualquer usuário
* Excluir qualquer usuário
* Alterar permissões de qualquer usuário
* Vincular usuários a múltiplas unidades
* Acessar configurações globais do sistema

**Escopo**

```text
UNIDADE_A
UNIDADE_B
UNIDADE_C
```

Visualiza tudo.

---

### 2. ADMIN

Possui acesso apenas às unidades atribuídas.

Exemplo:

```text
ADMIN_JOAO

Unidades:
✓ SENAI Cáceres
✓ SENAI Mirassol

✗ SENAI Rondonópolis
```

**Pode:**

* Visualizar usuários das unidades permitidas
* Criar usuários nas unidades permitidas
* Editar usuários das unidades permitidas
* Excluir usuários das unidades permitidas
* Gerenciar professores das unidades permitidas
* Gerenciar usuários comuns das unidades permitidas

**Não pode:**

* Alterar SUPER_ADMIN
* Visualizar usuários de unidades não autorizadas
* Alterar permissões globais

---

### 3. USUARIO

Acesso operacional.

Sempre pertence a uma unidade.

Exemplo:

```text
Vinicius

Unidade:
✓ SENAI Cáceres
```

**Pode:**

* Visualizar usuários da própria unidade
* Criar Professor
* Editar Professor
* Excluir Professor

**Não pode:**

* Criar Admin
* Criar Super Admin
* Alterar Admin
* Excluir Admin
* Visualizar outras unidades

---

# Estrutura do Banco

## Tabela usuarios

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    nome VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    senha_hash TEXT,
    role VARCHAR(30),
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP
);
```

---

## Tabela unidades

```sql
CREATE TABLE units (
    id UUID PRIMARY KEY,
    nome VARCHAR(255)
);
```

Exemplo:

```text
1 - SENAI Cáceres
2 - SENAI Barra do Bugres
3 - SENAI Rondonópolis
```

---

## Tabela de vínculo

Permite que um ADMIN tenha várias unidades.

```sql
CREATE TABLE user_units (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    unit_id UUID REFERENCES units(id)
);
```

---

# Regra de Consulta

## SUPER ADMIN

```sql
SELECT * FROM users;
```

---

## ADMIN

```sql
SELECT *
FROM users u
INNER JOIN user_units uu
ON uu.user_id = u.id
WHERE uu.unit_id IN (
    SELECT unit_id
    FROM user_units
    WHERE user_id = :adminId
);
```

Resultado:

Somente usuários das unidades autorizadas.

---

## USUARIO

```sql
SELECT *
FROM users u
INNER JOIN user_units uu
ON uu.user_id = u.id
WHERE uu.unit_id =
(
    SELECT unit_id
    FROM user_units
    WHERE user_id = :userId
);
```

Resultado:

Somente sua unidade.

---

# Regras de Alteração

## SUPER ADMIN

```text
Editar:
✓ Super Admin
✓ Admin
✓ Usuário
✓ Professor

Excluir:
✓ Todos
```

---

## ADMIN

```text
Editar:
✓ Usuário
✓ Professor

Excluir:
✓ Usuário
✓ Professor

✗ Admin
✗ Super Admin
```

Desde que pertençam às unidades autorizadas.

---

## USUARIO

```text
Criar:
✓ Professor

Editar:
✓ Professor

Excluir:
✓ Professor

✗ Usuário
✗ Admin
✗ Super Admin
```

Somente da própria unidade.

---

# Middleware de Segurança

Sugestão para Node.js:

```typescript
enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  USER = "USER",
  PROFESSOR = "PROFESSOR"
}
```

```typescript
function canManageUser(
  actor: User,
  target: User
): boolean {

  if (actor.role === "SUPER_ADMIN")
    return true;

  if (actor.role === "ADMIN") {

    if (
      target.role === "SUPER_ADMIN" ||
      target.role === "ADMIN"
    ) {
      return false;
    }

    return sharesUnit(actor, target);
  }

  if (actor.role === "USER") {

    return (
      target.role === "PROFESSOR" &&
      sharesUnit(actor, target)
    );
  }

  return false;
}
```

---

# Matriz de Permissões

| Ação                         | Super Admin | Admin | Usuário |
| ---------------------------- | ----------- | ----- | ------- |
| Ver todas unidades           | ✅           | ❌     | ❌       |
| Ver usuários da unidade      | ✅           | ✅     | ✅       |
| Criar Super Admin            | ✅           | ❌     | ❌       |
| Criar Admin                  | ✅           | ❌     | ❌       |
| Criar Usuário                | ✅           | ✅     | ❌       |
| Criar Professor              | ✅           | ✅     | ✅       |
| Editar Super Admin           | ✅           | ❌     | ❌       |
| Editar Admin                 | ✅           | ❌     | ❌       |
| Editar Usuário               | ✅           | ✅     | ❌       |
| Editar Professor             | ✅           | ✅     | ✅       |
| Excluir Super Admin          | ✅           | ❌     | ❌       |
| Excluir Admin                | ✅           | ❌     | ❌       |
| Excluir Usuário              | ✅           | ✅     | ❌       |
| Excluir Professor            | ✅           | ✅     | ✅       |
| Gerenciar múltiplas unidades | ✅           | ✅     | ❌       |

### Exemplo prático

**Wesley (SUPER_ADMIN)**

```text
Vê:
✓ Cáceres
✓ Barra
✓ Rondonópolis
```

**Coordenador Cáceres (ADMIN)**

```text
Vê:
✓ Cáceres

Não vê:
✗ Barra
✗ Rondonópolis
```

**Orientador Cáceres (USUARIO)**

```text
Vê:
✓ Professores de Cáceres

Pode:
✓ Criar Professor
✓ Editar Professor
✓ Excluir Professor

Não pode:
✗ Criar Admin
✗ Alterar usuários administrativos
```

Essa estrutura é escalável para 3, 10 ou 100 unidades sem necessidade de alteração no banco ou nas regras de negócio.

---

# Status de Implantação no Sistema

Todas as diretrizes deste documento estão **100% implementadas e ativas no sistema**:

1. **Camada de Tipagem e Middleware:** Funções canônicas `sharesUnit` e `canManageUser` implementadas em `src/lib/UserRoles.ts`.
2. **Camada de Interface:**
   - **`Dashboard.tsx`:** Seletor de unidades restrito aos `unitIds` para Admin e Usuário, e global para Super Admin.
   - **`UserManagementModule.tsx`:** Filtro de consulta estrito (`sharesUnit`) impedindo administradores de verem usuários de outras unidades.
   - **`UserCreateDialog.tsx` & `UserEditDialog.tsx`:** ADMIN só pode selecionar e atribuir unidades que ele próprio possui. USUARIO tem lotação única obrigatória (radio button).
   - **`ProfessorModule.tsx`:** Docentes filtrados por unidade ativa com permissão de criação, edição e exclusão para operadores e administradores daquela unidade.
3. **Camada de Backend e Banco de Dados:**
   - **`functions/src/index.ts` (`createUser`):** Rejeita criação de administradores por admins e barra atribuição de unidades não autorizadas.
   - **`firestore.rules`:** Proteção das coleções `users` e `teachers` com validação de hierarquia e escopo territorial (`hasUnitAccess`).
