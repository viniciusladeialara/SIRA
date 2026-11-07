import * as XLSX from 'xlsx';
import { CoreEvent, CoreEventAlias, CoreFormResponse, CoreImportBatch } from '../types';

export const SYNTHETIC_EVENTS: CoreEvent[] = [
  {
    id: 'ev-semana-tec-2026',
    canonicalName: 'Semana da Tecnologia 2026',
    normalizedKey: 'semanadatecnologia2026',
    isActive: true,
    createdAt: new Date().toISOString(),
    aliases: ['Semana de Tecnologia', 'Semana da Tecnologia', 'SEMANA DA TECNOLOGIA 2026'],
  },
  {
    id: 'ev-feira-prof-2026',
    canonicalName: 'Feira das Profissões SENAI',
    normalizedKey: 'feiradasprofissoessenai',
    isActive: true,
    createdAt: new Date().toISOString(),
    aliases: ['Feira das Profissões', 'Feira SENAI de Profissoes', 'Feira Profissoes'],
  },
  {
    id: 'ev-hackathon-ia-2026',
    canonicalName: 'Hackathon SENAI de Inteligência Artificial',
    normalizedKey: 'hackathonsenaideinteligenciaartificial',
    isActive: true,
    createdAt: new Date().toISOString(),
    aliases: ['Hackathon IA', 'Hackathon SENAI', 'Hackathon 2026'],
  },
  {
    id: 'ev-workshop-robotica',
    canonicalName: 'Workshop de Robótica & Automação Industrial',
    normalizedKey: 'workshopderoboticaeautomacaoindustrial',
    isActive: true,
    createdAt: new Date().toISOString(),
    aliases: ['Workshop Robotica', 'Robotica SENAI'],
  },
];

export const SYNTHETIC_ALIASES: CoreEventAlias[] = [
  {
    id: 'alias-1',
    eventId: 'ev-semana-tec-2026',
    alias: 'Semana de Tecnologia',
    normalizedAlias: 'semanadetecnologia',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'alias-2',
    eventId: 'ev-semana-tec-2026',
    alias: 'SEMANA DA TECNOLOGIA',
    normalizedAlias: 'semanadatecnologia',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'alias-3',
    eventId: 'ev-feira-prof-2026',
    alias: 'Feira de Profissões',
    normalizedAlias: 'feiradeprofissoes',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'alias-4',
    eventId: 'ev-hackathon-ia-2026',
    alias: 'Hackathon IA',
    normalizedAlias: 'hackathonia',
    createdAt: new Date().toISOString(),
  },
];

/**
 * Gera um lote sintético completo e realista de respostas (CHECK-IN e AVALIA)
 * Explicitamente identificado como DADOS SINTÉTICOS DE TESTE.
 */
export function generateSyntheticDataset(): {
  events: CoreEvent[];
  aliases: CoreEventAlias[];
  responses: CoreFormResponse[];
  batch: CoreImportBatch;
} {
  const batchId = 'batch-synthetic-demo-001';
  const responses: CoreFormResponse[] = [];

  const categories = ['Estudante SENAI', 'Docente / Instrutor', 'Comunidade Externa', 'Empresa Parceira', 'Visitante'];
  const classes = ['DS-2026-M1', 'ELETRO-2026-N2', 'MEC-2025-V1', 'AUTO-2026-M2', 'ADM-2026-N1'];

  const eventConfigs = [
    {
      id: 'ev-semana-tec-2026',
      name: 'Semana da Tecnologia 2026',
      checkins: 45,
      evaluations: [
        { score: 10, count: 18, comment: 'Palestrantes excepcionais e laboratórios muito bem estruturados!' },
        { score: 9, count: 12, comment: 'Excelente organização, o SENAI está de parabéns!' },
        { score: 8, count: 5, comment: 'Bom evento, apenas o ar condicionado do auditório estava muito frio.' },
        { score: 7, count: 3, comment: 'Conteúdo relevante, mas faltou tempo para perguntas ao final.' },
        { score: 5, count: 2, comment: 'Muito cheio, filas na entrada dos workshops.' },
      ],
    },
    {
      id: 'ev-feira-prof-2026',
      name: 'Feira das Profissões SENAI',
      checkins: 60,
      evaluations: [
        { score: 10, count: 25, comment: 'Descobri minha vocação para a área técnica de automação!' },
        { score: 9, count: 15, comment: 'Stands interativos muito legais e dinâmicos.' },
        { score: 8, count: 6, comment: 'Gostei muito da apresentação dos projetos práticos dos alunos.' },
        { score: 6, count: 2, comment: 'Poderia ter mais opções de alimentação no pátio.' },
      ],
    },
    {
      id: 'ev-hackathon-ia-2026',
      name: 'Hackathon SENAI de Inteligência Artificial',
      checkins: 32,
      evaluations: [
        { score: 10, count: 16, comment: 'Desafio intenso de 24h com mentores do mais alto nível técnico.' },
        { score: 9, count: 8, comment: 'A infraestrutura de servidores e internet funcionou perfeitamente.' },
        { score: 8, count: 2, comment: 'Muito bom, pizza e café não faltaram!' },
        { score: 4, count: 1, comment: 'Critérios de avaliação dos jurados poderiam ter sido mais transparentes.' },
      ],
    },
    {
      id: 'ev-workshop-robotica',
      name: 'Workshop de Robótica & Automação Industrial',
      checkins: 28,
      evaluations: [
        { score: 10, count: 10, comment: 'Aprender na prática nos braços robóticos industriais faz toda diferença.' },
        { score: 9, count: 7, comment: 'Instrutor domina totalmente a tecnologia dos CLPs.' },
        { score: 7, count: 2, comment: 'Poderia ser um minicurso mais longo, 4 horas foi pouco tempo.' },
      ],
    },
  ];

  let idCounter = 1;
  const now = new Date();

  const SAMPLE_COMMENTS_HIGH = [
    'Palestrantes excepcionais e laboratórios muito bem estruturados!',
    'Excelente organização, o SENAI está de parabéns por toda a dedicação!',
    'Descobri minha vocação para a área técnica de automação industrial!',
    'Stands interativos muito legais, dinâmicos e com grande networking.',
    'Aprender na prática nos braços robóticos industriais faz toda diferença.',
    'Desafio intenso de 24h com mentores do mais alto nível técnico e inovação.',
    'A infraestrutura de servidores e internet funcionou perfeitamente.',
    'Gostei muito da apresentação dos projetos práticos dos alunos e da didática.',
    'Instrutores dominam totalmente o conteúdo de inteligência artificial e robótica.',
    'Experiência maravilhosa, recomendo muito para quem quer aprender tecnologia.',
    'Tudo perfeito, estrutura de alta qualidade e palestrantes muito preparados!',
  ];

  const SAMPLE_COMMENTS_MID = [
    'Bom evento, mas o ar condicionado do auditório estava muito frio e incomodou.',
    'Conteúdo muito relevante, mas faltou tempo para perguntas ao final das palestras.',
    'Gostei das oficinas, porém as filas na entrada dos workshops estavam demoradas.',
    'Poderia ter mais opções de alimentação e lanches rápidos no pátio externo.',
    'Palestra excelente, mas o som do auditório teve pequenas falhas no início.',
    'Minicurso muito rápido, 4 horas foi pouco tempo para aprofundar na prática.',
    'Muito bom evento, apenas organizar melhor as filas para o credenciamento.',
  ];

  const SAMPLE_COMMENTS_LOW = [
    'Muito cheio, filas intermináveis e o ar condicionado estava congelando.',
    'Critérios de avaliação dos jurados poderiam ter sido mais transparentes.',
    'Faltou espaço e cadeiras suficientes para todos os participantes no auditório.',
    'Atraso de 40 minutos para iniciar e pouco tempo para tirar dúvidas.',
  ];

  eventConfigs.forEach((evConfig, evIdx) => {
    // 1. Gera Check-ins (com dados de presença e perfil, sem PII real)
    for (let i = 0; i < evConfig.checkins; i++) {
      const daysAgo = (evIdx * 3) + (i % 5);
      const rowDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 + i * 180000);
      const cat = categories[i % categories.length];
      const cls = classes[i % classes.length];

      responses.push({
        id: `resp-synth-${idCounter}`,
        sourceSystem: 'MICROSOFT_FORMS',
        sourceId: `forms-synth-${idCounter}`,
        importId: batchId,
        action: 'CHECKIN',
        startedAt: rowDate.toISOString(),
        completedAt: new Date(rowDate.getTime() + 120000).toISOString(),
        eventId: evConfig.id,
        eventRaw: evConfig.name,
        canonicalEventName: evConfig.name,
        fullName: `Participante Sintético ${idCounter}`,
        classCode: cls,
        category: cat,
        email: `demo.participante${idCounter}@senai.exemplo.br`,
        recommendationScore: null,
        qualityStatus: 'VALID',
        sourceRowNumber: idCounter + 1,
        createdAt: rowDate.toISOString(),
      });
      idCounter++;
    }

    // 2. Gera Avaliações (anônimas, com notas de recomendação 0-10)
    evConfig.evaluations.forEach((evalGroup) => {
      for (let j = 0; j < evalGroup.count; j++) {
        const daysAgo = (evIdx * 3) + (j % 4);
        const evalDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 + j * 240000);

        let commentText: string | undefined = undefined;
        // ~60% das avaliações incluem comentário rico
        if (j % 2 === 0 || j === 0) {
          if (evalGroup.score >= 9) {
            commentText = SAMPLE_COMMENTS_HIGH[(idCounter + j) % SAMPLE_COMMENTS_HIGH.length];
          } else if (evalGroup.score >= 7) {
            commentText = SAMPLE_COMMENTS_MID[(idCounter + j) % SAMPLE_COMMENTS_MID.length];
          } else {
            commentText = SAMPLE_COMMENTS_LOW[(idCounter + j) % SAMPLE_COMMENTS_LOW.length];
          }
        }

        responses.push({
          id: `resp-synth-${idCounter}`,
          sourceSystem: 'MICROSOFT_FORMS',
          sourceId: `forms-synth-${idCounter}`,
          importId: batchId,
          action: 'EVALUATION',
          startedAt: evalDate.toISOString(),
          completedAt: new Date(evalDate.getTime() + 180000).toISOString(),
          eventId: evConfig.id,
          eventRaw: evConfig.name,
          canonicalEventName: evConfig.name,
          recommendationScore: evalGroup.score,
          comment: commentText,
          qualityStatus: 'VALID',
          sourceRowNumber: idCounter + 1,
          createdAt: evalDate.toISOString(),
        });
        idCounter++;
      }
    });
  });

  // Adicionar alguns registros com avisos de qualidade para demonstração da governança (RF-006)
  responses.push({
    id: `resp-synth-${idCounter}`,
    sourceSystem: 'MICROSOFT_FORMS',
    sourceId: `forms-synth-${idCounter}`,
    importId: batchId,
    action: 'CHECKIN',
    startedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString(),
    eventRaw: '',
    canonicalEventName: 'Evento não informado',
    category: 'Visitante',
    qualityStatus: 'WARNING',
    qualityNotes: ['Evento não informado na coluna original'],
    sourceRowNumber: idCounter + 1,
    createdAt: new Date().toISOString(),
  });
  idCounter++;

  const batch: CoreImportBatch = {
    id: batchId,
    sourceFilename: 'Formularios_Eventos_SENAI_2026_SINTETICO.xlsx',
    fileSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    sheetName: 'Respostas ao Formulário 1',
    status: 'COMPLETED_WITH_WARNINGS',
    uploadedBy: 'Sistema (Modo Demonstração Homologada)',
    startedAt: new Date(now.getTime() - 3600000).toISOString(),
    finishedAt: new Date(now.getTime() - 3550000).toISOString(),
    rowsRead: responses.length,
    rowsInserted: responses.length,
    rowsSkipped: 0,
    rowsInvalid: 0,
    rowsConflicted: 1,
    createdAt: now.toISOString(),
  };

  return {
    events: SYNTHETIC_EVENTS,
    aliases: SYNTHETIC_ALIASES,
    responses,
    batch,
  };
}

/**
 * Cria uma planilha XLSX sintética pronta para download e teste real de upload
 */
export function generateSyntheticExcelFile(): ArrayBuffer {
  const dataset = generateSyntheticDataset();

  const rows = dataset.responses.map((r, i) => {
    return {
      'Id': i + 1,
      'Hora de início': r.startedAt.replace('T', ' ').substring(0, 19),
      'Hora de conclusão': r.completedAt ? r.completedAt.replace('T', ' ').substring(0, 19) : '',
      'Email': r.email || '',
      'Selecione uma opção:': r.action === 'CHECKIN' ? 'CHECK-IN' : 'AVALIAÇÃO',
      'NOME COMPLETO:': r.fullName || '',
      'Código da TURMA:': r.classCode || '',
      'SELECIONE SUA CATEGORIA:': r.category || '',
      'EVENTOS:': r.action === 'CHECKIN' ? r.eventRaw || '' : '',
      'Eventos:1': r.action === 'EVALUATION' ? r.eventRaw || '' : '',
      'Quanto você recomendaria este evento para outra pessoa?':
        r.recommendationScore !== null && r.recommendationScore !== undefined ? r.recommendationScore : '',
      'Comente o que você gostou e o que podemos melhorar em um próximo evento.': r.comment || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Respostas ao Formulário 1');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}
