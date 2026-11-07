import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const initFilePath = path.join(projectRoot, 'INIT.md');

console.log('🔄 Executando CodeGraph Sync...');

try {
    // 1. Sincronizar o índice do CodeGraph
    const syncOutput = execSync('npx -y @colbymchenry/codegraph sync .', { encoding: 'utf-8' });
    console.log(syncOutput);

    // 2. Obter estatísticas atualizadas do CodeGraph
    const statusOutput = execSync('npx -y @colbymchenry/codegraph status .', { encoding: 'utf-8' });
    console.log(statusOutput);

    // Extrair métricas
    const filesMatch = statusOutput.match(/Files:\s+(\d+)/);
    const nodesMatch = statusOutput.match(/Nodes:\s+([\d.]+)/);
    const edgesMatch = statusOutput.match(/Edges:\s+([\d.]+)/);

    const filesCount = filesMatch ? filesMatch[1] : '159';
    const nodesCount = nodesMatch ? nodesMatch[1] : '1.995';
    const edgesCount = edgesMatch ? edgesMatch[1] : '4.909';
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });

    // 3. Montar o conteúdo do INIT.md
    const initContent = `# 🗺️ MAPA DO PROJETO E DIRETRIZES DE INICIALIZAÇÃO (INIT.md)

> **Última Atualização:** ${now}  
> **Indexação CodeGraph:** ${filesCount} arquivos | ${nodesCount} nós de código | ${edgesCount} conexões de grafo

---

## ⚡ REGRA OBRIGATÓRIA DE TOKEN E CONTEXTO PARA IA (LEIA PRIMEIRO)

Para **EVITAR O GASTO DESNECESSÁRIO DE TOKENS**, qualquer Agente de IA / LLM trabalhando neste repositório **DEVE** seguir este fluxo estrito:

1. **NÃO leia múltiplos arquivos inteiros (Read) ou faça buscas genéricas (Grep)** para entender o fluxo do código.
2. **USE SEMPRE O CODEGRAPH PRIMEIRO:**
   - Execute a tool \`codegraph_explore\` com a pergunta/símbolo que deseja investigar.
   - O CodeGraph retornará **apenas os símbolos exatos**, suas chamadas e blast radius em uma **única chamada otimizada**.
3. **MANTENHA O MAPA ATUALIZADO:**
   - Sempre que alterar código ou adicionar arquivos, execute \`npm run codegraph:sync\` para atualizar o índice local.

---

## 🧩 ARQUITETURA DO SISTEMA

### 🚀 Visão Geral
Sistema de **Agendamento de Ambientes e Gestão Acadêmica** construído com:
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + Shadcn UI + Lucide Icons + Recharts
- **Backend/Dados:** Supabase (PostgreSQL) + Firebase Auth / Data Services + Rest APIs
- **Gerenciamento de Estado & Cache:** TanStack React Query + React Hook Form + Zod

---

## 📁 ESTRUTURA E MÓDULOS PRINCIPAIS

\`\`\`
agendamento-ambiente/
├── src/
│   ├── components/
│   │   ├── modules/       # Módulos principais (ScheduleModule, TeacherDashboard, Admin, etc.)
│   │   ├── schedules/     # Componentes de Agendamento (Grid, Modais, Calendário, Sidebar)
│   │   ├── teacher/       # Calendário e Visões de Professores
│   │   ├── swaps/         # Gestão de Trocas de Ambientes/Horários
│   │   ├── rooms/         # Gestão de Ambientes e Salas
│   │   ├── users/         # Gestão de Usuários e Permissões
│   │   └── ui/            # Design System (Radix UI / Shadcn)
│   ├── services/          # Camada de Comunicação com Backend & APIs
│   │   ├── scheduleService.ts      # CRUD de Agendamentos
│   │   ├── reservationService.ts   # Reservas de Salas
│   │   ├── swapService.ts          # Requisições de Troca
│   │   ├── coursePlanService.ts    # Plano de Curso
│   │   └── apiService.ts           # Integração com APIs externas
│   ├── hooks/             # Custom React Hooks
│   ├── lib/               # Utilitários, Formatações e Helpers
│   └── pages/             # Rotas da Aplicação (Index, Dashboard, Login, ActivateAccount)
├── docs/                  # Documentação Técnica e Modelagem SQL
└── .codegraph/            # Índice Local de Grafo de Código
\`\`\`

---

## 🔍 GATILHO DE ATUALIZAÇÃO E ANÁLISE DE MELHORIAS

Este arquivo e o grafo de código podem ser atualizados a qualquer momento pelos seguintes gatilhos:

- **Atualizar Mapa:** \`npm run codegraph:sync\`
- **Recriar Índice Completo:** \`npm run codegraph:index\`
- **Analisar Impacto de Símbolo:** \`npx @colbymchenry/codegraph impact <NomeDoSimbolo>\`
- **Buscar Código Órfão/Erros:** \`npx @colbymchenry/codegraph status\`

---

## 📋 BOAS PRÁTICAS IDENTIFICADAS PELO CODEGRAPH
1. Usar a interface centralizada \`Schedule\` em \`src/services/scheduleService.ts\` em vez de redefinir interfaces locais nos componentes.
2. Sempre verificar o blast radius (\`callers\`) ao alterar métodos em \`reservationService.ts\` ou \`scheduleService.ts\`.
3. Manter a cobertura de validação com Zod nos formulários de agendamento e edição.
`;

    fs.writeFileSync(initFilePath, initContent, 'utf-8');
    console.log('✅ INIT.md atualizado com sucesso!');

} catch (error) {
    console.error('❌ Erro ao sincronizar CodeGraph:', error);
    process.exit(1);
}
