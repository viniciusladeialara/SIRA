# SIRA – Guia de Engenharia do Frontend (React + Vite)

Este documento é a referência técnica completa para **Desenvolvedores Frontend e Full Stack** que atuam na interface web do **SIRA** (`apps/web`).

---

## 📌 Sumário
1. [Stack Tecnológico do Frontend](#1-stack-tecnológico-do-frontend)
2. [Estrutura de Pastas de `apps/web`](#2-estrutura-de-pastas-de-appsweb)
3. [Camada de Acesso a Dados: A Migração do Firebase para SQL Nativo](#3-camada-de-acesso-a-dados-a-migração-do-firebase-para-sql-nativo)
4. [Cliente HTTP e Multi-tenancy (`apiService.ts`)](#4-cliente-http-e-multi-tenancy-apiservicets)
5. [Autenticação e Sessão (`AuthContext.tsx`)](#5-autenticação-e-sessão-authcontexttsx)
6. [Controle de Visibilidade e Permissões (`usePermissions.tsx`)](#6-controle-de-visibilidade-e-permissões-usepermissionstsx)
7. [Componentes e Módulos de Interface](#7-componentes-e-módulos-de-interface)
8. [Como Criar uma Nova Tela / Módulo no Frontend](#8-como-criar-uma-nova-tela--módulo-no-frontend)
9. [Build, Otimização e Code-Splitting no Vite](#9-build-otimização-e-code-splitting-no-vite)

---

## 1. Stack Tecnológico do Frontend

| Recurso | Tecnologia | Detalhes |
| :--- | :--- | :--- |
| **Framework Base** | React 18 + TypeScript | Componentização declarativa e hooks avançados |
| **Bundler & DevServer** | Vite 5 | HMR ultrarrápido na porta padronizada `5173` |
| **Estilização** | TailwindCSS + CSS Variables | Design system responsivo com suporte a Dark Mode |
| **Componentes de UI** | Radix UI + Lucide Icons | Componentes acessíveis (modais, menus, abas, selects) |
| **Gerenciamento de Estado de Servidor** | TanStack React Query v5 | Cache e revalidação de dados assíncronos |
| **Roteamento** | React Router v6 | Navegação SPA baseada em histórico de rotas |

---

## 2. Estrutura de Pastas de `apps/web`

```text
apps/web/
├── src/
│   ├── components/                    # Módulos funcionais e telas da aplicação
│   │   ├── Dashboard.tsx              # Visão geral, estatísticas rápidas e atalhos
│   │   ├── ScheduleModule.tsx         # Matriz semanal e grade de agendamentos
│   │   ├── EnvironmentModule.tsx      # Gestão de salas e laboratórios de informática
│   │   ├── ProfessorModule.tsx        # Cadastro de docentes e especialidades
│   │   ├── ClassModule.tsx            # Gestão de turmas e turnos
│   │   ├── CourseModule.tsx           # Cadastro de cursos técnicos
│   │   ├── ConflictModule.tsx         # Painel de auditoria e resolução de conflitos
│   │   ├── UserManagementModule.tsx   # Gestão de usuários do sistema e perfis
│   │   ├── SystemSettingsModule.tsx   # Parâmetros gerais e seleção de unidade
│   │   └── ui/                        # Componentes primitivos (Button, Input, Dialog, etc.)
│   │
│   ├── lib/                           # Camada central de dados, API e autenticação
│   │   ├── apiService.ts              # Cliente HTTP REST com Bearer Token e Tenant Header
│   │   ├── db.ts                      # Camada de abstração de dados (SIRA SQL Native)
│   │   ├── sira-sql-adapter.ts        # Adaptador de compatibilidade para consultas SQL
│   │   ├── AuthContext.tsx            # Provedor global de autenticação e sessão do usuário
│   │   ├── UserRoles.ts               # Constantes e tipagens de perfis e permissões RBAC
│   │   └── usePermissions.tsx         # Hook de verificação de permissões do usuário ativo
│   │
│   ├── App.tsx                        # Roteamento e árvore de Provedores
│   └── main.tsx                       # Ponto de entrada do React DOM
├── .env                               # Variáveis de ambiente (VITE_API_URL=http://localhost:3000/api/v1)
├── vite.config.ts                     # Configuração de portas, aliases e proxy
└── package.json
```

---

## 3. Camada de Acesso a Dados: A Migração do Firebase para SQL Nativo

Anteriormente, o sistema utilizava SDKs e referências em nuvem do Firebase Firestore / Cloud Functions. Essa dependência foi **completamente removida**:

- Todos os 53 componentes foram migrados para consumir [`@/lib/db`](file:///c:/Users/VINICIUS/Documents/GitHub/SIRA/apps/web/src/lib/db.ts) e [`@/lib/sira-sql-adapter`](file:///c:/Users/VINICIUS/Documents/GitHub/SIRA/apps/web/src/lib/sira-sql-adapter.ts).
- As operações são traduzidas em chamadas HTTP REST para a API NestJS conectada ao PostgreSQL local.
- **Vantagem:** O frontend não possui nenhum custo de licença em nuvem, roda 100% offline em localhost ou em rede local do SENAI e possui segurança corporativa unificada via JWT e PostgreSQL.

---

## 4. Cliente HTTP e Multi-tenancy (`apiService.ts`)

Todas as requisições enviadas ao backend passam pelo singleton `apiService`:

```typescript
// Exemplo de funcionamento interno do apiService.ts:
async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('sira_access_token');
  const activeTenantId = localStorage.getItem('sira_active_unit_id');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(activeTenantId ? { 'X-Unidade-Id': activeTenantId } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  // Tratamento de erros padronizado...
}
```

### Principais métodos disponíveis:
- `apiService.login(email, password)`: Autenticação e armazenamento seguro de tokens.
- `apiService.getRooms()`, `apiService.createRoom()`, `apiService.updateRoom()`
- `apiService.getTeachers()`, `apiService.getCourses()`, `apiService.getClasses()`
- `apiService.getSchedules()`, `apiService.createSchedule()`, `apiService.deleteSchedule()`
- `apiService.syncStatus()`, `apiService.syncMirror()`, `apiService.syncPromote()`

---

## 5. Autenticação e Sessão (`AuthContext.tsx`)

O `AuthContext` provê o estado de login para toda a aplicação React:
- Mantém o objeto do usuário logado: `user: { id, email, nome, perfis, unidade_id }`.
- Gerencia a renovação automática de tokens via refresh token no Redis.
- Ao selecionar uma nova unidade no topo da interface, o `activeTenantId` é atualizado e as consultas de salas, turmas e professores são filtradas automaticamente para a nova unidade.

---

## 6. Controle de Visibilidade e Permissões (`usePermissions.tsx`)

Para exibir ou ocultar botões e telas com base nos papéis do usuário:

```tsx
import { usePermissions } from '@/lib/usePermissions';

export function BotaoCriarSala() {
  const { hasRole, canManageSchedules } = usePermissions();

  // Apenas Administradores e Coordenadores podem ver o botão:
  if (!canManageSchedules) {
    return null;
  }

  return <button onClick={...}>Nova Sala</button>;
}
```

---

## 7. Componentes e Módulos de Interface

- **`Dashboard.tsx`**: Painel inicial exibindo estatísticas em tempo real: total de ambientes disponíveis, docentes alocados, turmas em andamento e indicador de conflitos.
- **`ScheduleModule.tsx`**: Calendário e matriz interativa semanal por turno (Matutino, Vespertino, Noturno). Permite arrastar e alocar horários com alerta visual em tempo real caso ocorra conflito.
- **`ConflictModule.tsx`**: Painel especializado onde a coordenação visualiza choques de horários e sugere trocas inteligentes.
- **`SystemSettingsModule.tsx`**: Configurações gerais, chaveamento de unidade e módulo de Sincronização e Promoção de banco de dados.

---

## 8. Como Criar uma Nova Tela / Módulo no Frontend

1. **Criar o componente da tela:**
   - Crie `apps/web/src/components/MeuNovoModulo.tsx`.
2. **Adicionar o método no `apiService.ts`:**
   ```typescript
   async getMeusDados() {
     return this.request('/meus-dados');
   }
   ```
3. **Consumir os dados com React Query:**
   ```tsx
   const { data, isLoading } = useQuery({
     queryKey: ['meus-dados', activeUnitId],
     queryFn: () => apiService.getMeusDados(),
   });
   ```
4. **Adicionar a rota no `App.tsx` e o atalho na barra de navegação lateral.**

---

## 9. Build, Otimização e Code-Splitting no Vite

O frontend é compilado com divisão inteligente de chunks de JavaScript (Vendor Chunking):
- Gráficos pesados (Recharts) e ícones (Lucide) são empacotados em arquivos separados.
- O resultado do build gera arquivos estáticos ultra-otimizados em `apps/web/dist/`.

```bash
# Executar servidor de desenvolvimento local (Porta 5173):
npm --prefix apps/web run dev

# Executar build de produção:
npm --prefix apps/web run build
```
