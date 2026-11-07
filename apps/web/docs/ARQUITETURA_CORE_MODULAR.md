# Arquitetura Core Modular & Isolamento de Falhas (Micro-Kernel)

Este documento estabelece o padrão arquitetural do sistema **Macro Micro Schedule**, detalhando a transição de um painel monolítico para uma **Arquitetura Modular Baseada em Micro-Kernel (Core Engine)**.

---

## 1. Problema Anterior vs. Nova Abordagem com Core

### Como era antes:
* Todos os módulos eram importados e roteados diretamente dentro de um único componente ([Dashboard.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/Dashboard.tsx)).
* Para criar um módulo, era necessário alterar múltiplos arquivos centrais: menus estáticos, múltiplos `switch/cases`, matriz de permissões rígida.
* Se qualquer módulo disparasse um erro crítico (ex: falha de API, campo nulo, erro de renderização), congelava ou quebrava todo o dashboard.
* Não havia como conceder um módulo específico para um usuário sem alterar seu papel (`role`) global.

### Como funciona com o Core Engine:
* **Core Desacoplado:** O Core cuida exclusivamente de Autenticação, Menu Lateral dinâmico, Isolamento de Erros e Controle de Acesso.
* **Módulos Plugáveis:** Cada funcionalidade reside em sua própria pasta e se auto-registra com um manifesto ([ModuleDefinition](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/core/types.ts)).
* **Isolamento de Falhas (Fault Isolation):** Cada módulo roda dentro de um [ModuleErrorBoundary](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/core/ModuleErrorBoundary.tsx). Se um módulo travar, apenas a sua área de conteúdo exibe a tela de diagnóstico; o menu lateral, a barra superior, a troca de unidades e os outros módulos continuam funcionando 100%.
* **Liberação Dinâmica por Usuário:** Administradores podem conceder ou revogar módulos pontualmente para qualquer usuário (`allowedModules` no Firestore), sem encostar no código-fonte.

---

## 2. Diagrama da Arquitetura

```
+-----------------------------------------------------------------------+
|                             CORE ENGINE                               |
|                                                                       |
|   +-------------------+   +--------------------+   +--------------+   |
|   |   Autenticação    |   |  Controle de       |   |  Navegação   |   |
|   |   & Sessão        |   |  Acesso Dinâmico   |   |  & Unidades  |   |
|   +-------------------+   +--------------------+   +--------------+   |
|                                                                       |
|   +---------------------------------------------------------------+   |
|   |                       MODULE REGISTRY                         |   |
|   |  (Catálogo central de módulos registrados e suas permissões)  |   |
|   +---------------------------------------------------------------+   |
+-----------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          |                         |                         |
          v                         v                         v
+-------------------+     +-------------------+     +-------------------+
|  MODULE WRAPPER   |     |  MODULE WRAPPER   |     |  MODULE WRAPPER   |
|  (ErrorBoundary)  |     |  (ErrorBoundary)  |     |  (ErrorBoundary)  |
|         +         |     |         +         |     |         +         |
|    Módulo de      |     |    Módulo de      |     |  Módulo Piloto /  |
|   Agendamentos    |     |     Uniformes     |     |    Novo Módulo    |
+-------------------+     +-------------------+     +-------------------+
  (Se quebrar aqui,         (Totalmente isolado)       (Totalmente isolado)
   só este módulo cai!)
```

---

## 3. Especificação do Contrato (`ModuleDefinition`)

Todo módulo registrado no sistema implementa o contrato `ModuleDefinition`:

```typescript
export interface ModuleDefinition {
  /** Identificador único do módulo (slug sem espaços) */
  id: string;

  /** Nome exibido no menu e nos títulos */
  title: string;

  /** Breve descrição da finalidade do módulo */
  description?: string;

  /** Ícone do Lucide React para o menu lateral */
  icon: React.ComponentType<{ className?: string }>;

  /** Categoria para agrupamento no menu lateral */
  category: 'cadastros' | 'gestao' | 'logistica' | 'relatorios' | 'sistema' | 'outros';

  /** Ordem de exibição na lista/grupo */
  order?: number;

  /** Perfis de usuário com acesso padrão */
  defaultRoles: UserRole[];

  /** Flag para módulos exclusivos de governança (Super Admin) */
  superAdminOnly?: boolean;

  /** Carregador lazy do componente principal do módulo */
  component: React.LazyExoticComponent<React.ComponentType<any>>;

  /** Status do módulo no ecossistema */
  status?: 'active' | 'beta' | 'maintenance';
}
```

---

## 4. Como Adicionar um Novo Módulo em 3 Passos

Para implantar um novo módulo sem tocar no motor principal:

### Passo 1: Desenvolva o Módulo
Crie a pasta do módulo em `src/modules/nome-do-modulo/` ou em `src/components/modules/`:
```tsx
// src/components/modules/PatrimonioModule.tsx
import React from 'react';

export const PatrimonioModule: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Gestão de Patrimônio</h1>
      <p>Módulo isolado pronto para uso.</p>
    </div>
  );
};
```

### Passo 2: Crie o Manifesto
No módulo ou catálogo de módulos:
```tsx
import { lazy } from 'react';
import { Landmark } from 'lucide-react';
import { UserRole } from '@/lib/UserRoles';
import { ModuleDefinition } from '@/core/types';

export const patrimonioModuleDef: ModuleDefinition = {
  id: 'patrimonio',
  title: 'Patrimônio',
  icon: Landmark,
  category: 'logistica',
  defaultRoles: [UserRole.ADMIN],
  component: lazy(() => import('./PatrimonioModule').then(m => ({ default: m.PatrimonioModule })))
};
```

### Passo 3: Registre no Core
No arquivo de catálogo central [registeredModules.ts](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/core/registeredModules.ts):
```ts
registerModule(patrimonioModuleDef);
```
**Pronto!** O menu lateral, roteamento, permissões de acesso e proteção contra falhas são gerenciados automaticamente pelo Core.

---

## 5. Isolamento de Falhas (`ModuleErrorBoundary`)

Se um módulo apresentar um erro em tempo de execução ou uma exceção não tratada:
1. O React interrompe apenas a árvore daquele módulo.
2. O componente [ModuleErrorBoundary](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/core/ModuleErrorBoundary.tsx) captura a falha.
3. É exibida uma interface amigável informando que ocorreu uma falha no módulo, com:
   - Botão para **"Tentar Novamente / Recarregar Módulo"**;
   - Informações de diagnóstico e stack trace (para depuração rápida);
   - A barra lateral, navegação e todos os demais módulos continuam 100% utilizáveis sem necessidade de recarregar a página inteira.
