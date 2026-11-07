import * as XLSX from 'xlsx';
import {
  ColumnMappingConfig,
  CoreActionType,
  CoreFormResponse,
  CoreImportBatch,
  CoreImportIssue,
  QualityStatus,
  CoreEvent,
  CoreEventAlias,
} from '../types';

/**
 * Normaliza string para comparação sem acento, pontuação ou case
 */
export function normalizeKey(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Normaliza nomes de eventos para padronização canônica
 */
export function normalizeEventName(text: string): string {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Detecta mapeamento canônico de colunas a partir dos cabeçalhos da planilha
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMappingConfig {
  const mapping: ColumnMappingConfig = {};

  const patterns: Record<keyof ColumnMappingConfig, string[]> = {
    source_id: ['id', 'sourceid', 'identificador'],
    started_at: ['horadeinicio', 'starttime', 'datadeinicio', 'datainicio', 'inicio'],
    completed_at: ['horadeconclusao', 'completiontime', 'datafim', 'fim', 'conclusao'],
    email: ['email', 'enderecodeemail', 'correioeletronico'],
    action: ['selecioneumaopcao', 'opcao', 'acao', 'tipoderegistro', 'tipodeacao'],
    full_name: ['nomecompleto', 'nome', 'participante'],
    class_code: ['codigodaturma', 'turma', 'codigoturma', 'codturma'],
    category: ['selecionesuacategoria', 'categoria', 'publico', 'perfil'],
    event_checkin: ['eventos', 'eventocheckin', 'evento', 'nomedoevento'],
    event_evaluation: ['eventos1', 'eventoavaliacao', 'eventoavalia', 'eventosavalia'],
    recommendation_score: [
      'quantovocerecomendariaesteeventoparaoutrapessoa',
      'recomendaria',
      'recomendacao',
      'nota',
      'score',
      'nps',
    ],
    comment: [
      'comenteoquevocegostoueoquepodemosmelhoraremumproximoevento',
      'comenteoquevocegostou',
      'oquevocegostou',
      'podemosmelhorar',
      'proximoevento',
      'comentarios',
      'comentario',
      'sugestoes',
      'sugestao',
      'melhorias',
      'melhorar',
      'feedback',
      'feedbacks',
    ],
  };

  headers.forEach((header) => {
    const norm = normalizeKey(header);
    for (const [canonicalField, aliasList] of Object.entries(patterns)) {
      const fieldKey = canonicalField as keyof ColumnMappingConfig;
      if (!mapping[fieldKey]) {
        if (aliasList.some((alias) => norm === alias || norm.includes(alias))) {
          mapping[fieldKey] = header;
          break;
        }
      }
    }
  });

  return mapping;
}

/**
 * Normaliza a ação informada para CHECKIN, EVALUATION ou UNKNOWN
 */
export function normalizeAction(rawVal: any): CoreActionType {
  if (!rawVal) return 'UNKNOWN';
  const str = String(rawVal).trim().toUpperCase();
  const norm = normalizeKey(str);

  if (
    norm.includes('checkin') ||
    norm.includes('check') ||
    norm.includes('presenca') ||
    norm.includes('participacao')
  ) {
    return 'CHECKIN';
  }
  if (
    norm.includes('avalia') ||
    norm.includes('avaliacao') ||
    norm.includes('feedback') ||
    norm.includes('opiniao')
  ) {
    return 'EVALUATION';
  }

  return 'UNKNOWN';
}

/**
 * Converte data de célula do Excel ou string ISO
 */
export function parseExcelDate(val: any): string {
  if (!val) return new Date().toISOString();

  // Se já for Date
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString();
  }

  // Se for número serial de data do Excel
  if (typeof val === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) {
        const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S));
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    } catch {
      // fallback
    }
  }

  // Se for string
  const str = String(val).trim();
  const parsedDirect = new Date(str);
  if (!isNaN(parsedDirect.getTime())) {
    return parsedDirect.toISOString();
  }

  // Tratamento para formato DD/MM/AAAA HH:mm:ss ou DD/MM/AA
  const match = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const min = match[5] ? parseInt(match[5], 10) : 0;
    const sec = match[6] ? parseInt(match[6], 10) : 0;
    const d = new Date(Date.UTC(year, month, day, hour, min, sec));
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Converte e valida nota numérica de 0 a 10
 */
export function parseRecommendationScore(rawVal: any): { score: number | null; isValid: boolean } {
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    return { score: null, isValid: false };
  }
  const clean = String(rawVal).replace(',', '.').trim();
  const num = Number(clean);
  if (isNaN(num)) {
    return { score: null, isValid: false };
  }
  const rounded = Math.round(num);
  if (rounded >= 0 && rounded <= 10) {
    return { score: rounded, isValid: true };
  }
  return { score: null, isValid: false };
}

/**
 * Gera hash idempotente SHA-256 rápida no browser
 */
export async function calculateSha256(buffer: ArrayBuffer): Promise<string> {
  try {
    if (window.crypto && window.crypto.subtle) {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fallback
  }
  return `hash-${Date.now()}-${buffer.byteLength}`;
}

export interface ParseSheetResult {
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  detectedMapping: ColumnMappingConfig;
  rawRowsCount: number;
}

/**
 * Lê o arquivo Excel inicial e extrai metadados das abas e cabeçalhos
 */
export function inspectExcelFile(data: ArrayBuffer): { workbook: XLSX.WorkBook; result: ParseSheetResult } {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames;
  const selectedSheet = sheetNames[0] || '';
  const sheet = workbook.Sheets[selectedSheet];

  const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  const headers = (jsonData[0] || []).map((h) => String(h || '').trim()).filter(Boolean);
  const detectedMapping = autoDetectColumnMapping(headers);

  return {
    workbook,
    result: {
      sheetNames,
      selectedSheet,
      headers,
      detectedMapping,
      rawRowsCount: Math.max(0, jsonData.length - 1),
    },
  };
}

export interface PreValidationReport {
  totalRows: number;
  newRowsCount: number;
  duplicateRowsCount: number;
  invalidRowsCount: number;
  warningRowsCount: number;
  issues: CoreImportIssue[];
  processedResponses: CoreFormResponse[];
}

/**
 * Executa a pré-validação completa e normalização das linhas da planilha
 */
export function validateAndProcessRows(
  workbook: XLSX.WorkBook,
  sheetName: string,
  mapping: ColumnMappingConfig,
  knownEvents: CoreEvent[],
  knownAliases: CoreEventAlias[],
  existingSourceIds: Set<string>,
  batchId: string,
  allowOverwrite: boolean = false
): PreValidationReport {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Aba '${sheetName}' não encontrada na planilha.`);
  }

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const issues: CoreImportIssue[] = [];
  const processedResponses: CoreFormResponse[] = [];
  let duplicateCount = 0;
  let invalidCount = 0;
  let warningCount = 0;

  const seenIdsInCurrentBatch = new Set<string>();

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // Linha 1 é cabeçalho no Excel
    const qualityNotes: string[] = [];
    let qualityStatus: QualityStatus = 'VALID';

    // 1. Identificador de Origem (source_id)
    const rawId = mapping.source_id ? row[mapping.source_id] : undefined;
    const sourceId = rawId !== undefined && rawId !== '' ? String(rawId).trim() : `row-${rowNumber}`;

    // Deduplicação idempotente com suporte a sobrescrita
    const isDuplicateInBatch = seenIdsInCurrentBatch.has(sourceId);
    const isExistingInDb = existingSourceIds.has(sourceId);

    if (isDuplicateInBatch) {
      duplicateCount++;
      qualityNotes.push('Registro duplicado dentro da mesma planilha (ID repetido)');
      qualityStatus = 'CONFLICT';
    } else if (isExistingInDb) {
      if (allowOverwrite) {
        qualityNotes.push('Registro existente atualizado/sobrescrito com sucesso');
        seenIdsInCurrentBatch.add(sourceId);
      } else {
        duplicateCount++;
        qualityNotes.push('Registro já existente no banco de dados');
        qualityStatus = 'CONFLICT';
      }
    } else {
      seenIdsInCurrentBatch.add(sourceId);
    }

    // 2. Ação
    const rawAction = mapping.action ? row[mapping.action] : '';
    const action = normalizeAction(rawAction);
    if (action === 'UNKNOWN') {
      issues.push({
        id: `issue-${batchId}-${rowNumber}-action`,
        importId: batchId,
        sourceRowNumber: rowNumber,
        fieldName: mapping.action || 'action',
        issueCode: 'UNKNOWN_ACTION',
        severity: 'WARNING',
        message: `Ação não reconhecida: '${rawAction}'. Registro classificado como UNKNOWN.`,
      });
      qualityNotes.push(`Ação desconhecida: '${rawAction}'`);
      if (qualityStatus === 'VALID') qualityStatus = 'WARNING';
      warningCount++;
    }

    // 3. Normalização do Evento (RF-005)
    const rawEventCheckin = mapping.event_checkin ? String(row[mapping.event_checkin] || '').trim() : '';
    const rawEventEval = mapping.event_evaluation ? String(row[mapping.event_evaluation] || '').trim() : '';

    let eventRaw = '';
    if (action === 'CHECKIN') {
      eventRaw = rawEventCheckin || rawEventEval;
      if (!rawEventCheckin && rawEventEval) {
        qualityNotes.push('Evento extraído de campo secundário (fallback)');
      }
    } else if (action === 'EVALUATION') {
      eventRaw = rawEventEval || rawEventCheckin;
      if (!rawEventEval && rawEventCheckin) {
        qualityNotes.push('Evento extraído de campo secundário (fallback)');
      }
    } else {
      eventRaw = rawEventCheckin || rawEventEval;
    }

    // Se ambos preenchidos com valores divergentes
    if (rawEventCheckin && rawEventEval && rawEventCheckin !== rawEventEval) {
      qualityNotes.push(`Conflito de eventos entre colunas ('${rawEventCheckin}' vs '${rawEventEval}')`);
      if (qualityStatus === 'VALID') qualityStatus = 'CONFLICT';
    }

    // Identificar evento canônico via aliases
    let canonicalEventName = 'Evento não informado';
    let matchedEventId: string | undefined = undefined;

    if (eventRaw) {
      const normEv = normalizeKey(eventRaw);
      // Busca em eventos diretos
      const directMatch = knownEvents.find(
        (e) => e.normalizedKey === normEv || normalizeKey(e.canonicalName) === normEv
      );
      if (directMatch) {
        canonicalEventName = directMatch.canonicalName;
        matchedEventId = directMatch.id;
      } else {
        // Busca em aliases
        const aliasMatch = knownAliases.find((a) => a.normalizedAlias === normEv);
        if (aliasMatch) {
          const parentEvent = knownEvents.find((e) => e.id === aliasMatch.eventId);
          if (parentEvent) {
            canonicalEventName = parentEvent.canonicalName;
            matchedEventId = parentEvent.id;
          } else {
            canonicalEventName = eventRaw;
          }
        } else {
          canonicalEventName = normalizeEventName(eventRaw);
        }
      }
    } else {
      issues.push({
        id: `issue-${batchId}-${rowNumber}-event`,
        importId: batchId,
        sourceRowNumber: rowNumber,
        fieldName: 'event',
        issueCode: 'MISSING_EVENT',
        severity: 'INFO',
        message: 'Evento não informado no registro.',
      });
      qualityNotes.push('Evento não informado');
      if (qualityStatus === 'VALID') qualityStatus = 'WARNING';
    }

    // 4. Datas
    const startedAt = mapping.started_at ? parseExcelDate(row[mapping.started_at]) : new Date().toISOString();
    const completedAt = mapping.completed_at ? parseExcelDate(row[mapping.completed_at]) : undefined;

    // 5. Dados de Participação (Check-in)
    const fullName = mapping.full_name ? String(row[mapping.full_name] || '').trim() : undefined;
    const classCode = mapping.class_code ? String(row[mapping.class_code] || '').trim() : undefined;
    const category = mapping.category ? String(row[mapping.category] || '').trim() : undefined;
    const email = mapping.email ? String(row[mapping.email] || '').trim() : undefined;

    // 6. Avaliação e NPS
    const rawScore = mapping.recommendation_score ? row[mapping.recommendation_score] : undefined;
    const { score, isValid: isScoreValid } = parseRecommendationScore(rawScore);

    if (action === 'EVALUATION' && !isScoreValid) {
      issues.push({
        id: `issue-${batchId}-${rowNumber}-score`,
        importId: batchId,
        sourceRowNumber: rowNumber,
        fieldName: mapping.recommendation_score || 'recommendation_score',
        issueCode: 'INVALID_SCORE',
        severity: 'WARNING',
        message: `Avaliação sem nota válida ou fora da escala 0-10: '${rawScore}'.`,
      });
      qualityNotes.push(`Nota de avaliação inválida ou em branco: '${rawScore}'`);
      if (qualityStatus === 'VALID') qualityStatus = 'WARNING';
      invalidCount++;
    }

    const comment = mapping.comment ? String(row[mapping.comment] || '').trim() : undefined;

    // Neutralizar fórmulas maliciosas em comentários ou campos de texto (CSV/Excel Formula Injection)
    const sanitizeText = (txt?: string) => {
      if (!txt) return undefined;
      if (txt.startsWith('=') || txt.startsWith('+') || txt.startsWith('-') || txt.startsWith('@')) {
        return `'${txt}`;
      }
      return txt;
    };

    processedResponses.push({
      id: `resp-${batchId}-${sourceId}`,
      sourceSystem: 'MICROSOFT_FORMS',
      sourceId,
      importId: batchId,
      action,
      startedAt,
      completedAt,
      eventId: matchedEventId,
      eventRaw: eventRaw || undefined,
      canonicalEventName,
      fullName: sanitizeText(fullName),
      classCode: sanitizeText(classCode),
      category: sanitizeText(category),
      email: sanitizeText(email),
      recommendationScore: score,
      comment: sanitizeText(comment),
      qualityStatus,
      qualityNotes: qualityNotes.length > 0 ? qualityNotes : undefined,
      sourceRowNumber: rowNumber,
      createdAt: new Date().toISOString(),
    });
  });

  const newRowsCount = processedResponses.length - duplicateCount;

  return {
    totalRows: rawRows.length,
    newRowsCount: Math.max(0, newRowsCount),
    duplicateRowsCount: duplicateCount,
    invalidRowsCount: invalidCount,
    warningRowsCount: warningCount,
    issues,
    processedResponses,
  };
}
