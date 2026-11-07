import { CoreFormResponse, NPSMetrics, EventKpiSummary, CoreEvent } from '../types';
import { format, parseISO, isValid } from 'date-fns';

/**
 * Calcula determinísticamente o Net Promoter Score (NPS) a partir de um array de notas numéricas de 0 a 10.
 * Conforme RF-012 do PRD CORE Eventos:
 * - Promotores: notas 9 e 10
 * - Neutros: notas 7 e 8
 * - Detratores: notas de 0 a 6
 * - NPS = %Promotores - %Detratores
 */
export function calculateNPS(scores: (number | null | undefined)[]): NPSMetrics {
  const validScores = scores.filter(
    (s): s is number => typeof s === 'number' && !isNaN(s) && s >= 0 && s <= 10
  );

  const total = validScores.length;

  if (total === 0) {
    return {
      totalEvaluations: scores.length,
      validScoresCount: 0,
      promotersCount: 0,
      passivesCount: 0,
      detractorsCount: 0,
      promotersPct: 0,
      passivesPct: 0,
      detractorsPct: 0,
      npsScore: 0,
      zone: 'APERFEICOAMENTO',
      zoneLabel: 'Sem avaliações suficientes',
      zoneColor: '#94a3b8',
      averageScore: 0,
    };
  }

  const promoters = validScores.filter((s) => s >= 9).length;
  const passives = validScores.filter((s) => s >= 7 && s <= 8).length;
  const detractors = validScores.filter((s) => s <= 6).length;

  const promotersPct = Math.round((promoters / total) * 1000) / 10;
  const passivesPct = Math.round((passives / total) * 1000) / 10;
  const detractorsPct = Math.round((detractors / total) * 1000) / 10;

  const npsScore = Math.round((promotersPct - detractorsPct) * 10) / 10;
  const sumScores = validScores.reduce((acc, curr) => acc + curr, 0);
  const averageScore = Math.round((sumScores / total) * 10) / 10;

  // Classificação de Zonas Padrão de Mercado / SENAI
  let zone: NPSMetrics['zone'] = 'APERFEICOAMENTO';
  let zoneLabel = 'Zona de Aperfeiçoamento';
  let zoneColor = '#f59e0b'; // Amber

  if (npsScore >= 75) {
    zone = 'EXCELENCIA';
    zoneLabel = 'Zona de Excelência';
    zoneColor = '#10b981'; // Emerald
  } else if (npsScore >= 50) {
    zone = 'QUALIDADE';
    zoneLabel = 'Zona de Qualidade';
    zoneColor = '#0284c7'; // Sky / Blue
  } else if (npsScore < 0) {
    zone = 'CRITICA';
    zoneLabel = 'Zona Crítica';
    zoneColor = '#ef4444'; // Red
  }

  return {
    totalEvaluations: scores.length,
    validScoresCount: total,
    promotersCount: promoters,
    passivesCount: passives,
    detractorsCount: detractors,
    promotersPct,
    passivesPct,
    detractorsPct,
    npsScore,
    zone,
    zoneLabel,
    zoneColor,
    averageScore,
  };
}

/**
 * Agrega e calcula todos os KPIs determinísticos para o painel de BI
 */
export function calculateKpiSummary(
  responses: CoreFormResponse[],
  events: CoreEvent[],
  lastImportAt?: string
): EventKpiSummary {
  const checkins = responses.filter((r) => r.action === 'CHECKIN');
  const evaluations = responses.filter((r) => r.action === 'EVALUATION');

  const scores = evaluations.map((r) => r.recommendationScore);
  const npsGeneral = calculateNPS(scores);

  const comments = evaluations.filter((r) => r.comment && r.comment.trim().length > 0);
  const qualityIssues = responses.filter((r) => r.qualityStatus !== 'VALID');

  // Distribuição de notas (0 a 10)
  const scoreCounts: Record<number, number> = {};
  for (let i = 0; i <= 10; i++) scoreCounts[i] = 0;
  scores.forEach((s) => {
    if (typeof s === 'number' && s >= 0 && s <= 10) {
      scoreCounts[s] = (scoreCounts[s] || 0) + 1;
    }
  });

  const scoreDistribution = Object.entries(scoreCounts).map(([scoreStr, count]) => {
    const score = Number(scoreStr);
    const group: 'detrator' | 'neutro' | 'promotor' =
      score >= 9 ? 'promotor' : score >= 7 ? 'neutro' : 'detrator';
    return { score, count, group };
  });

  // Comparativo por Evento
  const eventMap = new Map<string, { checkins: number; evaluations: number; scores: number[] }>();

  // Pré-popular com eventos conhecidos
  events.forEach((ev) => {
    eventMap.set(ev.canonicalName, { checkins: 0, evaluations: 0, scores: [] });
  });

  responses.forEach((r) => {
    const evName = r.canonicalEventName || 'Evento não informado';
    if (!eventMap.has(evName)) {
      eventMap.set(evName, { checkins: 0, evaluations: 0, scores: [] });
    }
    const cur = eventMap.get(evName)!;
    if (r.action === 'CHECKIN') cur.checkins++;
    if (r.action === 'EVALUATION') {
      cur.evaluations++;
      if (typeof r.recommendationScore === 'number') cur.scores.push(r.recommendationScore);
    }
  });

  const eventComparison = Array.from(eventMap.entries())
    .map(([eventName, data]) => {
      const evNps = calculateNPS(data.scores).npsScore;
      const matchedEv = events.find((e) => e.canonicalName === eventName);
      return {
        eventId: matchedEv?.id || eventName,
        eventName,
        checkins: data.checkins,
        evaluations: data.evaluations,
        nps: evNps,
      };
    })
    .filter((e) => e.checkins > 0 || e.evaluations > 0)
    .sort((a, b) => b.checkins + b.evaluations - (a.checkins + a.evaluations));

  // Distribuição por Categoria
  const categoryMap = new Map<string, number>();
  responses.forEach((r) => {
    if (r.category && r.category.trim()) {
      const cat = r.category.trim();
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    }
  });
  const categoryDistribution = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Distribuição por Turma
  const classMap = new Map<string, number>();
  responses.forEach((r) => {
    if (r.classCode && r.classCode.trim()) {
      const code = r.classCode.trim().toUpperCase();
      classMap.set(code, (classMap.get(code) || 0) + 1);
    }
  });
  const classDistribution = Array.from(classMap.entries())
    .map(([classCode, count]) => ({ classCode, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Evolução temporal diária
  const dayMap = new Map<string, { checkins: number; evaluations: number }>();
  responses.forEach((r) => {
    let dateKey = '';
    try {
      const parsed = parseISO(r.startedAt);
      if (isValid(parsed)) {
        dateKey = format(parsed, 'yyyy-MM-dd');
      }
    } catch {
      // ignore
    }
    if (!dateKey) {
      dateKey = 'Sem Data';
    }
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, { checkins: 0, evaluations: 0 });
    }
    const d = dayMap.get(dateKey)!;
    if (r.action === 'CHECKIN') d.checkins++;
    if (r.action === 'EVALUATION') d.evaluations++;
  });

  const temporalEvolution = Array.from(dayMap.entries())
    .filter(([date]) => date !== 'Sem Data')
    .sort(([d1], [d2]) => d1.localeCompare(d2))
    .map(([date, counts]) => ({
      date: format(parseISO(date), 'dd/MM'),
      checkins: counts.checkins,
      evaluations: counts.evaluations,
    }));

  return {
    totalCheckins: checkins.length,
    totalEvaluations: evaluations.length,
    totalEvents: eventComparison.length,
    npsGeneral,
    totalComments: comments.length,
    qualityIssuesCount: qualityIssues.length,
    lastImportAt,
    eventComparison,
    scoreDistribution,
    categoryDistribution,
    classDistribution,
    temporalEvolution,
  };
}
