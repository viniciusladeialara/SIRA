import { Course, CurricularUnit, Capability, Knowledge } from './coursePlanService';

export interface EduPlanPromptInput {
  course: Course | null;
  uc: CurricularUnit | null;
  capabilities: Capability[];
  knowledgesMap: Record<string, Knowledge[]>;
  classroomProfile?: string;
}

export interface TeachingPlanRow {
  bloco: number;
  categoria: string;
  descricao: string;
}

export interface TeachingPlanTable {
  totalHours: number;
  blocks: number;
  blockSize: number;
  rows: TeachingPlanRow[];
}

export const buildEduPlanPrompt = ({
  course,
  uc,
  capabilities,
  knowledgesMap,
  classroomProfile = 'Turma do curso selecionado no cadastro institucional.',
}: EduPlanPromptInput) => {
  const capacidadeTexto = capabilities.length
    ? capabilities.map((cap) => {
        const conhecimentos = knowledgesMap[cap.id || ''] || [];
        return `- ${cap.type}: ${cap.description}${conhecimentos.length ? `\n  Conhecimentos: ${conhecimentos.map(k => k.description).join('; ')}` : ''}`;
      }).join('\n')
    : 'Nenhuma capacidade cadastrada para esta UC ainda.';

  return `Você é um especialista em design instrucional e em metodologia SENAI.

Objetivo:
Crie um plano de aula diário e detalhado para a UC abaixo, utilizando como fonte única os dados já cadastrados no sistema (curso, unidade curricular, capacidades e conhecimentos).

DADOS DA BASE DE CURSOS E UC:
- Curso: ${course?.name || 'Não informado'}
- Unidade Curricular: ${uc?.name || 'Não informado'}
- Carga horária total da UC: ${uc?.workload || 0} horas
- Perfil da turma: ${classroomProfile}
- Objetivo principal da UC: desenvolver competências técnicas, socioemocionais e metodológicas a partir dos conteúdos e capacidades cadastrados.

CAPACIDADES E CONHECIMENTOS CADASTRADOS:
${capacidadeTexto}

INSTRUÇÕES PARA A RESPONDA:
1. Gere um cronograma completo com distribuição dos conteúdos ao longo dos encontros.
2. Para cada encontro, produza um plano com os campos obrigatórios:
   - Tema da Aula
   - Capacidades e seus Tipos (Técnicas, Socioemocionais, Metodológicas)
   - Resultados Esperados
   - Estratégia Desafiadora (Situação de Aprendizagem)
   - Contextualização
   - Sequência Didática (com momentos pedagógicos e tempo)
   - Avaliação (Tipo, Instrumentos, Critérios e Pontuação Sugerida)
   - Ambientes e Recursos Pedagógicos
3. Use a linguagem de referência do SENAI e priorize atividades práticas, contextualizadas e alinhadas aos conhecimentos da base.
4. Se alguma informação de curso/UC estiver ausente, indique claramente a lacuna e proponha uma sugestão segura e pedagógica.

FORMATO FINAL ESPERADO:
- Cronograma geral
- Planos de aula detalhados por encontro
- Sugestão de avaliação somativa final
- Sugestão de recursos e ambientes
`;
};

export const buildTeachingPlanTable = ({
  course,
  uc,
  capabilities,
  knowledgesMap,
}: EduPlanPromptInput): TeachingPlanTable => {
  const totalHours = uc?.workload || 0;
  const blockSize = totalHours < 40 ? 10 : 20;
  const blocks = Math.max(1, Math.ceil(totalHours / blockSize));

  const capText = capabilities.length
    ? capabilities.map((cap, index) => `${index + 1}. ${cap.description} (${cap.type})`).join(' | ')
    : 'Nenhuma capacidade cadastrada.';

  const knowText = Object.values(knowledgesMap).flat().length
    ? Object.values(knowledgesMap).flat().map((k, index) => `${index + 1}. ${k.description}`).join(' | ')
    : 'Nenhum conhecimento cadastrado.';

  const rows: TeachingPlanRow[] = [];

  for (let bloco = 1; bloco <= blocks; bloco += 1) {
    const blocoLabel = `Bloco ${bloco} (${Math.min(blockSize, Math.max(0, totalHours - (bloco - 1) * blockSize))}h)`;
    rows.push(
      { bloco, categoria: 'Capacidades', descricao: `${blocoLabel}: ${capText}` },
      { bloco, categoria: 'Conhecimentos', descricao: knowText },
      { bloco, categoria: 'Estratégias de ensino', descricao: 'Atividade prática orientada por problema, trabalho em grupo e discussão guiada com aplicação ao contexto profissional.' },
      { bloco, categoria: 'Ambientes pedagógicos', descricao: 'Sala de aula, laboratório ou ambiente de simulação conforme a atividade proposta.' },
      { bloco, categoria: 'Instrumentos de avaliação', descricao: 'Diagnóstico inicial no primeiro bloco, observação prática ao longo do processo e entrega parcial final.' },
      { bloco, categoria: 'Situação de aprendizagem', descricao: `Planejar uma produção contextualizada da UC ${uc?.name || 'selecionada'} para o curso ${course?.name || 'informado'}, com entregas parciais e revisão do professor.` },
    );
  }

  return { totalHours, blocks, blockSize, rows };
};

export const buildProfessorPlanningPrompt = ({
  course,
  uc,
  capabilities,
  knowledgesMap,
}: EduPlanPromptInput) => {
  const totalHours = uc?.workload || 0;
  const maxBlock = totalHours < 40 ? 10 : 20;
  const blocks = Math.max(1, Math.ceil(totalHours / maxBlock));
  const capList = capabilities.map((cap) => cap.description).join(', ');
  const knowList = Object.values(knowledgesMap).flat().map((k) => k.description).join('; ');

  return `Você é o assistente de planejamento do professor.

Objetivo:
Criar um Plano de Ensino em formato de tabela de 2 colunas e 6 linhas por bloco, com blocos de até ${maxBlock}h.

Contexto:
- Curso: ${course?.name || 'Curso não informado'}
- UC: ${uc?.name || 'UC não informada'}
- Carga horária total: ${totalHours}h
- Quantidade estimada de blocos: ${blocks}
- Capacidades cadastradas: ${capList || 'Nenhuma capacidade cadastrada'}
- Conhecimentos cadastrados: ${knowList || 'Nenhum conhecimento cadastrado'}

Regras obrigatórias:
1. Organize o Plano de Ensino em blocos de no máximo ${maxBlock}h.
2. Para cursos com carga horária menor que 40h, a divisão deve ser obrigatoriamente em blocos de no máximo 10h; abaixo disso, os blocos devem ser múltiplos de 2h.
3. Cada bloco deve conter obrigatoriamente 6 categorias: Capacidades, Conhecimentos, Estratégias de ensino e descrição da atividade, Ambientes pedagógicos, Instrumentos de avaliação.
4. A coluna 1 deve conter a categoria e a coluna 2 deve conter a descrição detalhada.
5. Todas as capacidades e conhecimentos devem ser utilizados ao menos uma vez; repetições só podem ocorrer com justificativa pedagógica.
6. Inclua ao final: total de capacidades utilizadas e total de conhecimentos utilizados.
7. Inclua 1 avaliação diagnóstica no primeiro bloco, 1 avaliação prática ao longo do plano e 1 avaliação somativa final.
8. Use estratégias coerentes com o SENAI e com a prática pedagógica real.

Saída esperada:
- Tabela 2 colunas por bloco
- 6 linhas por bloco
- Blocos coerentes, exequíveis e organizados por progressão de complexidade
- Resumo final com total de capacidades e conhecimentos utilizados
`;
};
