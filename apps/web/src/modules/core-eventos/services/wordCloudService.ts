import { CoreFormResponse } from '../types';

export interface WordCloudItem {
  text: string;
  value: number;
  sentiment: 'positive' | 'improvement' | 'neutral';
  percentage: number;
}

export interface WordCloudAnalysis {
  items: WordCloudItem[];
  totalComments: number;
  positiveTermsCount: number;
  improvementTermsCount: number;
  topStrengths: string[];
  topOpportunities: string[];
}

// Lista rica de Stopwords em Português para limpeza analítica
const STOPWORDS = new Set([
  'a', 'ao', 'aos', 'aquela', 'aquelas', 'aquele', 'aqueles', 'aquilo', 'as', 'até',
  'com', 'como', 'da', 'das', 'de', 'dela', 'delas', 'dele', 'deles', 'depois', 'do',
  'dos', 'e', 'ela', 'elas', 'ele', 'eles', 'em', 'entre', 'era', 'eram', 'éramos',
  'essa', 'essas', 'esse', 'esses', 'esta', 'estamos', 'estão', 'estas', 'estava',
  'estavam', 'estávamos', 'este', 'estes', 'estive', 'estivemos', 'estiveram', 'estou',
  'eu', 'foi', 'fomos', 'foram', 'fosse', 'fossem', 'fóssemos', 'há', 'haja', 'hajam',
  'houve', 'houveram', 'isso', 'isto', 'já', 'lhe', 'lhes', 'mais', 'mas', 'me', 'mesmo',
  'meu', 'meus', 'minha', 'minhas', 'muito', 'muitos', 'na', 'não', 'nas', 'nem', 'no',
  'nos', 'nós', 'nossa', 'nossas', 'nosso', 'nossos', 'num', 'numa', 'o', 'os', 'ou',
  'para', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'qual', 'quando', 'que', 'quem', 'são',
  'se', 'seja', 'sejam', 'sejamos', 'sem', 'ser', 'será', 'serão', 'seria', 'seriam',
  'seu', 'seus', 'só', 'somos', 'sua', 'suas', 'também', 'te', 'tem', 'têm', 'temos',
  'tenha', 'tenham', 'tenho', 'ter', 'terá', 'terão', 'teria', 'teriam', 'teu', 'teus',
  'teve', 'tinha', 'tinham', 'tive', 'tivemos', 'tiveram', 'tu', 'tua', 'tuas', 'um',
  'uma', 'você', 'vocês', 'vos', 'pode', 'podem', 'poderia', 'poderiam', 'apenas', 'bem',
  'sobre', 'tudo', 'todos', 'toda', 'todas', 'cada', 'onde', 'outro', 'outra', 'outros',
  'outras', 'estar', 'fazer', 'ir', 'ver', 'dar', 'dizer', 'aqui', 'ali', 'lá', 'senai',
  'evento', 'eventos', 'próximo', 'proximo', 'comente', 'gostou',
]);

// Léxico de Destaques Positivos (Pontos Fortes)
const POSITIVE_LEXICON = new Set([
  'excelente', 'excelentes', 'otimo', 'otimos', 'ótimo', 'ótimos', 'parabens', 'parabéns',
  'palestrante', 'palestrantes', 'organizacao', 'organização', 'laboratorio', 'laboratorios',
  'laboratório', 'laboratórios', 'pratica', 'prática', 'praticos', 'práticos', 'mentor',
  'mentores', 'mentoria', 'infraestrutura', 'maravilhoso', 'sensacional', 'incrivel',
  'incrível', 'inovacao', 'inovação', 'conteudo', 'conteúdo', 'automacao', 'automação',
  'robotica', 'robótica', 'didatica', 'didática', 'networking', 'dinamico', 'dinâmico',
  'dinamicos', 'dinâmicos', 'relevante', 'relevantes', 'top', 'bom', 'bons', 'boa', 'boas',
  'gostei', 'aprendizado', 'aprender', 'conhecimento', 'vocacao', 'vocação', 'projetos',
  'stands', 'qualidade', 'equipe', 'professores', 'instrutor', 'instrutores', 'interativo',
  'interativos', 'perfeito', 'perfeita', 'sucesso', 'estruturado', 'estruturados',
]);

// Léxico de Oportunidades de Melhoria (Pontos a Melhorar)
const IMPROVEMENT_LEXICON = new Set([
  'ar', 'condicionado', 'frio', 'gelado', 'tempo', 'curto', 'pouco', 'fila', 'filas',
  'alimentacao', 'alimentação', 'lanche', 'lanches', 'comida', 'patio', 'pátio', 'espaco',
  'espaço', 'cadeiras', 'auditorio', 'auditório', 'som', 'microfone', 'atraso', 'horario',
  'horário', 'barulho', 'apertado', 'falta', 'faltou', 'perguntas', 'demora', 'organizar',
  'divulgacao', 'divulgação', 'inscricao', 'inscrição', 'estacionamento', 'criterios',
  'critérios', 'jurados', 'transparencia', 'transparência', 'cheio', 'lotado', 'rapido',
  'rápido', 'minicurso', 'alongar', 'espera',
]);

/**
 * Normaliza um token removendo pontuação e caracteres especiais mantendo acentos
 */
function cleanWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'«»[\]]/g, '')
    .trim();
}

/**
 * Formata palavra para exibição visual elegante em Title Case
 */
function toDisplayCase(word: string): string {
  if (word.length <= 2) return word.toUpperCase();
  if (word === 'ar condicionado') return 'Ar-Condicionado';
  if (word === 'clps') return 'CLPs';
  if (word === 'ia') return 'IA';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Processa as respostas de formulários e gera a Nuvem de Palavras
 */
export function generateWordCloudData(responses: CoreFormResponse[]): WordCloudAnalysis {
  // Filtra apenas respostas com comentários preenchidos
  const comments = responses
    .map((r) => r.comment?.trim() || '')
    .filter((c) => c.length > 0);

  const totalComments = comments.length;
  if (totalComments === 0) {
    return {
      items: [],
      totalComments: 0,
      positiveTermsCount: 0,
      improvementTermsCount: 0,
      topStrengths: [],
      topOpportunities: [],
    };
  }

  const wordFrequencyMap = new Map<string, { count: number; sentiment: 'positive' | 'improvement' | 'neutral' }>();

  comments.forEach((comment) => {
    const lowerComment = comment.toLowerCase();

    // Tratamento de Bigramas específicos de alta relevância (ex: 'ar condicionado')
    if (lowerComment.includes('ar condicionado') || lowerComment.includes('ar-condicionado')) {
      const key = 'ar condicionado';
      const existing = wordFrequencyMap.get(key) || { count: 0, sentiment: 'improvement' };
      existing.count += 1;
      wordFrequencyMap.set(key, existing);
    }

    // Tokenização por palavras
    const tokens = comment.split(/\s+/);
    const seenInThisComment = new Set<string>();

    tokens.forEach((rawToken) => {
      const cleaned = cleanWord(rawToken);
      if (!cleaned || cleaned.length < 3 || STOPWORDS.has(cleaned)) return;

      // Ignora tokens parciais do bigrama já capturado
      if ((cleaned === 'ar' || cleaned === 'condicionado') && lowerComment.includes('ar condicionado')) {
        return;
      }

      // Evita inflar contagem se a mesma palavra for dita 3 vezes no mesmo comentário
      if (seenInThisComment.has(cleaned)) return;
      seenInThisComment.add(cleaned);

      // Determina sentimento
      let sentiment: 'positive' | 'improvement' | 'neutral' = 'neutral';
      if (POSITIVE_LEXICON.has(cleaned)) {
        sentiment = 'positive';
      } else if (IMPROVEMENT_LEXICON.has(cleaned)) {
        sentiment = 'improvement';
      }

      const existing = wordFrequencyMap.get(cleaned) || { count: 0, sentiment };
      existing.count += 1;
      // Mantém sentimento prioritário se identificado
      if (sentiment !== 'neutral') {
        existing.sentiment = sentiment;
      }
      wordFrequencyMap.set(cleaned, existing);
    });
  });

  // Converte para array ordenado por frequência
  const items: WordCloudItem[] = Array.from(wordFrequencyMap.entries())
    .map(([rawWord, data]) => {
      const percentage = totalComments > 0 ? Math.round((data.count / totalComments) * 100) : 0;
      return {
        text: toDisplayCase(rawWord),
        value: data.count,
        sentiment: data.sentiment,
        percentage,
      };
    })
    .sort((a, b) => b.value - a.value);

  // Calcula estatísticas analíticas
  const positiveTerms = items.filter((i) => i.sentiment === 'positive');
  const improvementTerms = items.filter((i) => i.sentiment === 'improvement');

  const positiveTermsCount = positiveTerms.reduce((sum, item) => sum + item.value, 0);
  const improvementTermsCount = improvementTerms.reduce((sum, item) => sum + item.value, 0);

  const topStrengths = positiveTerms.slice(0, 3).map((i) => `${i.text} (${i.value})`);
  const topOpportunities = improvementTerms.slice(0, 3).map((i) => `${i.text} (${i.value})`);

  return {
    items,
    totalComments,
    positiveTermsCount,
    improvementTermsCount,
    topStrengths,
    topOpportunities,
  };
}
