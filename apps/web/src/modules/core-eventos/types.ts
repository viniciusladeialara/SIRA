export type CoreActionType = 'CHECKIN' | 'EVALUATION' | 'UNKNOWN';

export type QualityStatus = 'VALID' | 'WARNING' | 'ERROR' | 'CONFLICT';

export type ImportBatchStatus = 
  | 'UPLOADED'
  | 'VALIDATING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_WARNINGS'
  | 'FAILED'
  | 'CANCELLED';

export type IssueSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

export interface CoreEvent {
  id: string;
  canonicalName: string;
  normalizedKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  aliases?: string[];
  totalCheckins?: number;
  totalEvaluations?: number;
  nps?: number | null;
}

export interface CoreEventAlias {
  id: string;
  eventId: string;
  alias: string;
  normalizedAlias: string;
  createdAt: string;
  createdBy?: string;
}

export interface CoreFormResponse {
  id: string;
  sourceSystem: string;
  sourceId?: string;
  importId: string;
  action: CoreActionType;
  startedAt: string; // ISO string
  completedAt?: string; // ISO string
  eventId?: string;
  eventRaw?: string;
  canonicalEventName: string;
  fullName?: string; // Protected PII (never shown on public view)
  classCode?: string;
  category?: string;
  email?: string; // Protected PII (never shown on public view)
  recommendationScore?: number | null; // 0 to 10
  comment?: string;
  qualityStatus: QualityStatus;
  qualityNotes?: string[];
  sourceRowNumber?: number;
  createdAt: string;
}

export interface CoreImportBatch {
  id: string;
  sourceFilename: string;
  fileSha256: string;
  sheetName: string;
  status: ImportBatchStatus;
  uploadedBy: string;
  startedAt: string;
  finishedAt?: string;
  rowsRead: number;
  rowsInserted: number;
  rowsSkipped: number;
  rowsInvalid: number;
  rowsConflicted: number;
  mappingSnapshot?: Record<string, string>;
  errorSummary?: string;
  createdAt: string;
}

export interface CoreImportIssue {
  id: string;
  importId: string;
  sourceRowNumber: number;
  fieldName?: string;
  issueCode: string;
  severity: IssueSeverity;
  message: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface NPSMetrics {
  totalEvaluations: number;
  validScoresCount: number;
  promotersCount: number;
  passivesCount: number;
  detractorsCount: number;
  promotersPct: number;
  passivesPct: number;
  detractorsPct: number;
  npsScore: number; // -100 to 100
  zone: 'EXCELENCIA' | 'QUALIDADE' | 'APERFEICOAMENTO' | 'CRITICA';
  zoneLabel: string;
  zoneColor: string;
  averageScore: number;
}

export interface EventKpiSummary {
  totalCheckins: number;
  totalEvaluations: number;
  totalEvents: number;
  npsGeneral: NPSMetrics;
  totalComments: number;
  qualityIssuesCount: number;
  lastImportAt?: string;
  eventComparison: {
    eventId: string;
    eventName: string;
    checkins: number;
    evaluations: number;
    nps: number;
  }[];
  scoreDistribution: {
    score: number;
    count: number;
    group: 'detrator' | 'neutro' | 'promotor';
  }[];
  categoryDistribution: {
    category: string;
    count: number;
  }[];
  classDistribution: {
    classCode: string;
    count: number;
  }[];
  temporalEvolution: {
    date: string;
    checkins: number;
    evaluations: number;
  }[];
}

export interface EventFilterState {
  eventId: string; // 'all' or specific eventId
  periodType: 'all' | '7d' | '30d' | 'month' | 'custom';
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  action: 'all' | 'CHECKIN' | 'EVALUATION';
  category: string; // 'all' or specific
  classCode: string; // 'all' or specific
  searchQuery: string; // for searching comments or names (admin only)
}

export interface ColumnMappingConfig {
  source_id?: string;
  started_at?: string;
  completed_at?: string;
  email?: string;
  action?: string;
  full_name?: string;
  class_code?: string;
  category?: string;
  event_checkin?: string;
  event_evaluation?: string;
  recommendation_score?: string;
  comment?: string;
}
