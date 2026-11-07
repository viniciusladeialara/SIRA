import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CoreEvent,
  CoreEventAlias,
  CoreFormResponse,
  CoreImportBatch,
  CoreImportIssue,
  ColumnMappingConfig,
  EventFilterState,
} from '../types';
import {
  subscribeToEvents,
  subscribeToFormResponses,
  subscribeToBatches,
  commitImportBatch,
  saveCoreEvent,
  addEventAlias,
  filterResponses,
  getCoreEvents,
  clearAllCoreEventosData,
} from '../services/eventosService';
import {
  inspectExcelFile,
  validateAndProcessRows,
  calculateSha256,
  normalizeKey,
  PreValidationReport,
} from '../services/excelParser';
import {
  generateSyntheticDataset,
  generateSyntheticExcelFile,
} from '../services/syntheticData';
import { calculateKpiSummary } from '../services/npsService';
import { NPSGauge } from './NPSGauge';
import { ScoreHistogram } from './ScoreHistogram';
import { WordCloudCard } from './WordCloudCard';
import { FeedbackWall } from './FeedbackWall';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ExternalLink,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Download,
  Layers,
  BarChart3,
  Users,
  Award,
  History,
  FileText,
  Plus,
  Tag,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const CoreEventosAdminModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'import' | 'events' | 'quality' | 'history'>('overview');

  // Dados principais
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [responses, setResponses] = useState<CoreFormResponse[]>([]);
  const [batches, setBatches] = useState<CoreImportBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros internos
  const [filters, setFilters] = useState<EventFilterState>({
    eventId: 'all',
    periodType: 'all',
    action: 'all',
    category: 'all',
    classCode: 'all',
    searchQuery: '',
  });

  // Estados do Wizard de Importação
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [workbookData, setWorkbookData] = useState<{ workbook: any; result: any } | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<ColumnMappingConfig>({});
  const [validationReport, setValidationReport] = useState<PreValidationReport | null>(null);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados de Modais
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [isAddAliasOpen, setIsAddAliasOpen] = useState(false);
  const [aliasTargetEventId, setAliasTargetEventId] = useState('');
  const [newAliasText, setNewAliasText] = useState('');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  // Subscrições Firestore
  useEffect(() => {
    setLoading(true);
    const unsubEvents = subscribeToEvents((list) => setEvents(list));
    const unsubResp = subscribeToFormResponses((list) => {
      setResponses(list);
      setLoading(false);
    });
    const unsubBatches = subscribeToBatches((list) => setBatches(list));

    return () => {
      unsubEvents();
      unsubResp();
      unsubBatches();
    };
  }, []);

  // Dados filtrados e KPIs
  const filteredResponses = useMemo(() => {
    return filterResponses(responses, filters);
  }, [responses, filters]);

  const kpiSummary = useMemo(() => {
    return calculateKpiSummary(filteredResponses, events);
  }, [filteredResponses, events]);

  // Lista de problemas de qualidade
  const qualityIssues = useMemo(() => {
    return responses.filter((r) => r.qualityStatus !== 'VALID');
  }, [responses]);

  // --- HANDLERS DO WIZARD DE IMPORTAÇÃO ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Por favor, envie um arquivo Excel (.xlsx ou .xls).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('O arquivo excede o limite máximo permitido de 20MB.');
      return;
    }

    setImportFile(file);
    try {
      const buffer = await file.arrayBuffer();
      const inspected = inspectExcelFile(buffer);
      setWorkbookData(inspected);
      setSelectedSheet(inspected.result.selectedSheet);
      setColumnMapping(inspected.result.detectedMapping);
      setValidationReport(null);
      toast.success(`Planilha carregada: ${inspected.result.sheetNames.length} aba(s) encontrada(s).`);
    } catch (err: any) {
      console.error(err);
      toast.error('Falha ao processar o arquivo Excel: ' + (err?.message || 'Arquivo corrompido'));
    }
  };

  const handleRunValidation = (overrideOverwrite?: boolean) => {
    if (!workbookData || !selectedSheet) {
      toast.error('Selecione uma aba válida da planilha.');
      return;
    }

    const effectiveOverwrite = overrideOverwrite !== undefined ? overrideOverwrite : allowOverwrite;
    const existingSourceIds = effectiveOverwrite ? new Set<string>() : new Set(responses.map((r) => r.sourceId || r.id));
    const batchId = `batch-${Date.now()}`;

    try {
      const report = validateAndProcessRows(
        workbookData.workbook,
        selectedSheet,
        columnMapping,
        events,
        [], // Aliases
        existingSourceIds,
        batchId,
        effectiveOverwrite
      );
      setValidationReport(report);
      if (effectiveOverwrite) {
        toast.info(`Pré-validação (modo sobrescrever): ${report.processedResponses.length} registros prontos para gravar.`);
      } else {
        toast.info(`Pré-validação concluída: ${report.newRowsCount} novos, ${report.duplicateRowsCount} repetidos.`);
      }
    } catch (err: any) {
      toast.error('Erro na validação: ' + err.message);
    }
  };

  const handleConfirmImport = async () => {
    if (!validationReport || !importFile) return;

    setIsProcessing(true);
    try {
      const buffer = await importFile.arrayBuffer();
      const sha256 = await calculateSha256(buffer);
      const batchId = `batch-${Date.now()}`;

      const newBatch: CoreImportBatch = {
        id: batchId,
        sourceFilename: importFile.name,
        fileSha256: sha256,
        sheetName: selectedSheet,
        status: validationReport.warningRowsCount > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
        uploadedBy: 'Administrador (Sessão Ativa)',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        rowsRead: validationReport.totalRows,
        rowsInserted: allowOverwrite ? validationReport.processedResponses.length : validationReport.newRowsCount,
        rowsSkipped: allowOverwrite ? 0 : validationReport.duplicateRowsCount,
        rowsInvalid: validationReport.invalidRowsCount,
        rowsConflicted: validationReport.duplicateRowsCount,
        mappingSnapshot: columnMapping as any,
        createdAt: new Date().toISOString(),
      };

      await commitImportBatch(newBatch, validationReport.processedResponses, validationReport.issues);

      // Auto-cadastrar novos eventos canônicos detectados para alimentar filtros e tabs
      const detectedEventNames = Array.from(
        new Set(
          validationReport.processedResponses
            .map((r) => r.canonicalEventName)
            .filter((name) => name && name !== 'Evento não informado')
        )
      );

      for (const evName of detectedEventNames) {
        const alreadyExists = events.some(
          (e) => e.canonicalName.toLowerCase() === evName.toLowerCase()
        );
        if (!alreadyExists) {
          const evId = `ev-${normalizeKey(evName)}`;
          await saveCoreEvent({
            id: evId,
            canonicalName: evName,
            normalizedKey: normalizeKey(evName),
            isActive: true,
            createdAt: new Date().toISOString(),
          });
        }
      }

      toast.success('Importação concluída com sucesso no banco de dados!');
      setImportFile(null);
      setWorkbookData(null);
      setValidationReport(null);
      setActiveTab('overview');
    } catch (err: any) {
      console.error(err);
      toast.error('Falha ao gravar importação: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };


  // Limpar todos os dados da base
  const handleClearAllData = async () => {
    setIsProcessing(true);
    try {
      await clearAllCoreEventosData();
      setResponses([]);
      setEvents([]);
      setBatches([]);
      toast.success('Todos os dados foram limpos com sucesso! A base está pronta para a nova planilha.');
      setIsClearConfirmOpen(false);
    } catch (err: any) {
      toast.error('Erro ao limpar dados: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Baixar planilha sintética para testar upload real
  const handleDownloadSyntheticTemplate = () => {
    try {
      const buffer = generateSyntheticExcelFile();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Planilha_Forms_Eventos_SENAI_Exemplo.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Planilha de exemplo baixada com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao gerar planilha de teste: ' + err.message);
    }
  };

  // Criar novo evento canônico
  const handleCreateEvent = async () => {
    if (!newEventName.trim()) return;
    const cleanName = newEventName.trim();
    const id = `ev-${normalizeKey(cleanName)}`;
    const newEv: CoreEvent = {
      id,
      canonicalName: cleanName,
      normalizedKey: normalizeKey(cleanName),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await saveCoreEvent(newEv);
    setIsAddEventOpen(false);
    setNewEventName('');
    toast.success(`Evento '${cleanName}' cadastrado com sucesso.`);
  };

  // Criar alias para evento
  const handleCreateAlias = async () => {
    if (!newAliasText.trim() || !aliasTargetEventId) return;
    const cleanAlias = newAliasText.trim();
    const aliasObj: CoreEventAlias = {
      id: `alias-${Date.now()}`,
      eventId: aliasTargetEventId,
      alias: cleanAlias,
      normalizedAlias: normalizeKey(cleanAlias),
      createdAt: new Date().toISOString(),
    };
    await addEventAlias(aliasObj);
    setIsAddAliasOpen(false);
    setNewAliasText('');
    toast.success(`Apelido '${cleanAlias}' associado ao evento com sucesso.`);
  };

  return (
    <div className="h-full page-scrollbar px-4 py-5 sm:px-6 sm:py-6 space-y-6 pb-40 animate-in fade-in duration-300">
      {/* HEADER DO MÓDULO ADMINISTRATIVO */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-blue-800/80 ring-1 ring-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-4 w-4" />
            Módulo Integrado • Gestão & BI
          </div>
          <h2 className="text-2xl font-black mt-1">CORE Eventos</h2>
          <p className="text-blue-100 text-xs max-w-xl mt-1">
            Plataforma de importação de planilhas Microsoft Forms, governança de dados, deduplicação idempotente e consolidação do Net Promoter Score (NPS).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botão de Acesso Direto à Visão Pública */}
          <Button
            onClick={() => window.open('/eventos-view', '_blank')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-2 text-xs shadow-md"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir Dashboard Público
          </Button>

          <Button
            variant="outline"
            onClick={handleDownloadSyntheticTemplate}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs gap-1.5"
            title="Baixar planilha sintética pronta para teste"
          >
            <Download className="h-3.5 w-3.5" />
            Template (.xlsx)
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsClearConfirmOpen(true)}
            disabled={isProcessing}
            className="bg-red-500/20 hover:bg-red-500/30 text-white border-red-400/40 text-xs gap-1.5"
            title="Limpar todos os dados da base para subir nova planilha"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-300" />
            Limpar Base
          </Button>
        </div>
      </div>

      {/* ABAS DO MÓDULO */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <TabsList className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
          <TabsTrigger value="overview" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xs font-semibold transition-all">
            <BarChart3 className="h-3.5 w-3.5" />
            Visão Geral & Indicadores
          </TabsTrigger>
          <TabsTrigger value="import" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xs font-semibold transition-all">
            <Upload className="h-3.5 w-3.5" />
            Importar Planilha (.xlsx)
          </TabsTrigger>
          <TabsTrigger value="events" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xs font-semibold transition-all">
            <Layers className="h-3.5 w-3.5" />
            Eventos & Apelidos ({events.length})
          </TabsTrigger>
          <TabsTrigger value="quality" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xs font-semibold transition-all">
            <AlertTriangle className="h-3.5 w-3.5" />
            Inconsistências ({qualityIssues.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xs font-semibold transition-all">
            <History className="h-3.5 w-3.5" />
            Histórico de Lotes ({batches.length})
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: VISÃO GERAL ================= */}
        <TabsContent value="overview" className="space-y-6">
          {/* BARRA DE FILTROS RÁPIDOS */}
          <div className="bg-white dark:bg-slate-900/90 p-4 rounded-xl border border-slate-300/90 dark:border-slate-700 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/5 flex flex-wrap items-center gap-3">
            <div className="w-48">
              <Select
                value={filters.eventId}
                onValueChange={(val) => setFilters((p) => ({ ...p, eventId: val }))}
              >
                <SelectTrigger className="h-8 text-xs border-slate-300 dark:border-slate-700">
                  <SelectValue placeholder="Evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Eventos</SelectItem>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.canonicalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-36">
              <Select
                value={filters.action}
                onValueChange={(val: any) => setFilters((p) => ({ ...p, action: val }))}
              >
                <SelectTrigger className="h-8 text-xs border-slate-300 dark:border-slate-700">
                  <SelectValue placeholder="Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Ações</SelectItem>
                  <SelectItem value="CHECKIN">Apenas Check-in</SelectItem>
                  <SelectItem value="EVALUATION">Apenas Avaliação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({
                eventId: 'all',
                periodType: 'all',
                action: 'all',
                category: 'all',
                classCode: 'all',
                searchQuery: '',
              })}
              className="h-8 text-xs text-muted-foreground border-slate-300 dark:border-slate-700 hover:text-foreground hover:border-slate-400"
            >
              Resetar Filtros
            </Button>

            <div className="ml-auto text-xs text-muted-foreground">
              Total consolidado: <strong className="text-foreground">{responses.length}</strong> respostas no banco
            </div>
          </div>

          {/* CARDS DE KPIS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-slate-300 dark:border-slate-700/80 border-t-4 border-t-blue-500 shadow-sm hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
              <CardHeader className="p-4 pb-2 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Check-ins</CardTitle>
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Users className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <div className="text-2xl sm:text-3xl font-black text-foreground">{kpiSummary.totalCheckins}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Presenças confirmadas</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-300 dark:border-slate-700/80 border-t-4 border-t-emerald-500 shadow-sm hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
              <CardHeader className="p-4 pb-2 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Avaliações Válidas</CardTitle>
                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <div className="text-2xl sm:text-3xl font-black text-foreground">{kpiSummary.totalEvaluations}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Notas de 0 a 10</p>
              </CardContent>
            </Card>

            <Card
              className="border border-slate-300 dark:border-slate-700/80 border-t-4 shadow-sm hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden"
              style={{ borderTopColor: kpiSummary.npsGeneral.zoneColor }}
            >
              <CardHeader className="p-4 pb-2 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Score NPS Geral</CardTitle>
                <div
                  className="p-1.5 rounded-md"
                  style={{
                    backgroundColor: `${kpiSummary.npsGeneral.zoneColor}15`,
                    color: kpiSummary.npsGeneral.zoneColor,
                  }}
                >
                  <Award className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <div className="text-2xl sm:text-3xl font-black" style={{ color: kpiSummary.npsGeneral.zoneColor }}>
                  {kpiSummary.npsGeneral.npsScore > 0 ? `+${kpiSummary.npsGeneral.npsScore}` : kpiSummary.npsGeneral.npsScore}
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] mt-1 font-semibold"
                  style={{
                    borderColor: kpiSummary.npsGeneral.zoneColor,
                    color: kpiSummary.npsGeneral.zoneColor,
                  }}
                >
                  {kpiSummary.npsGeneral.zoneLabel}
                </Badge>
              </CardContent>
            </Card>

            <Card className="border border-slate-300 dark:border-slate-700/80 border-t-4 border-t-amber-500 shadow-sm hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
              <CardHeader className="p-4 pb-2 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Feedbacks</CardTitle>
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <FileText className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <div className="text-2xl sm:text-3xl font-black text-foreground">{kpiSummary.totalComments}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Comentários registrados</p>
              </CardContent>
            </Card>
          </div>

          {/* TERMÔMETRO E HISTOGRAMA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NPSGauge metrics={kpiSummary.npsGeneral} />
            <ScoreHistogram data={kpiSummary.scoreDistribution} />
          </div>

          {/* NUVEM DE PALAVRAS EM DESTAQUE (ANÁLISE DE COMENTÁRIOS E FEEDBACKS) */}
          <WordCloudCard responses={filteredResponses} />

          {/* MURAL DE FEEDBACKS */}
          <FeedbackWall responses={filteredResponses} />
        </TabsContent>

        {/* ================= TAB 2: IMPORTAR PLANILHA ================= */}
        <TabsContent value="import" className="space-y-6">
          <Card className="border border-slate-300 dark:border-slate-700/90 shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5">
            <CardHeader className="border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    Assistente de Importação Transacional (.xlsx)
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Conforme especificação PRD: upload com leitura resiliente, mapeamento inteligente de colunas, deduplicação idempotente e gravação transacional.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSyntheticTemplate}
                  className="text-xs gap-1.5 border-slate-300 dark:border-slate-700"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar Template
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* ETAPA 1: SELETOR DE ARQUIVO */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">1. Selecione o arquivo exportado do Microsoft Forms (.xlsx)</Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary/70 rounded-xl p-8 text-center cursor-pointer bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex flex-col items-center justify-center space-y-2"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">
                    {importFile ? importFile.name : 'Clique para selecionar ou arraste o arquivo .xlsx aqui'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : 'Tamanho máximo permitido: 20 MB'}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* ETAPA 2: SELEÇÃO DA ABA */}
              {workbookData && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold">2. Selecione a Aba da Planilha</Label>
                      <Select value={selectedSheet} onValueChange={(val) => setSelectedSheet(val)}>
                        <SelectTrigger className="h-9 text-xs mt-1">
                          <SelectValue placeholder="Selecione a aba" />
                        </SelectTrigger>
                        <SelectContent>
                          {workbookData.result.sheetNames.map((sheet: string) => (
                            <SelectItem key={sheet} value={sheet}>
                              {sheet}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Linhas de dados detectadas: <strong>{workbookData.result.rawRowsCount}</strong>
                      </p>
                    </div>

                    <div className="flex flex-col justify-end gap-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="allow-overwrite-opt"
                          checked={allowOverwrite}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setAllowOverwrite(val);
                            if (validationReport) {
                              handleRunValidation(val);
                            }
                          }}
                          className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        />
                        <label htmlFor="allow-overwrite-opt" className="text-xs text-muted-foreground cursor-pointer select-none">
                          Sobrescrever/Atualizar registros existentes (para reimportar)
                        </label>
                      </div>
                      <Button
                        onClick={() => handleRunValidation()}
                        className="w-full text-xs font-semibold gap-2 h-9"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Validar e Mapear Colunas
                      </Button>
                    </div>
                  </div>

                  {/* ETAPA 3: MAPEAMENTO DE COLUNAS */}
                  <div className="space-y-3 pt-3">
                    <Label className="text-xs font-semibold">3. Mapeamento de Colunas Detectado (RF-003)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs bg-muted/20 p-4 rounded-lg border border-border/50">
                      {[
                        { key: 'source_id', label: 'ID do Registro' },
                        { key: 'started_at', label: 'Hora de Início' },
                        { key: 'action', label: 'Ação (Opção / Check-in / Avalia)' },
                        { key: 'full_name', label: 'Nome Completo' },
                        { key: 'class_code', label: 'Código da Turma' },
                        { key: 'category', label: 'Categoria' },
                        { key: 'event_checkin', label: 'Evento (Check-in)' },
                        { key: 'event_evaluation', label: 'Evento (Avaliação)' },
                        { key: 'recommendation_score', label: 'Nota Recomendação (NPS)' },
                        { key: 'comment', label: 'Comentário / Sugestão' },
                      ].map(({ key, label }) => (
                        <div key={key} className="space-y-1">
                          <span className="font-medium text-muted-foreground">{label}:</span>
                          <Select
                            value={columnMapping[key as keyof ColumnMappingConfig] || ''}
                            onValueChange={(val) =>
                              setColumnMapping((prev) => ({ ...prev, [key]: val }))
                            }
                          >
                            <SelectTrigger className="h-7 text-xs bg-background">
                              <SelectValue placeholder="Não mapeado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-- Não mapear --</SelectItem>
                              {workbookData.result.headers.map((h: string) => (
                                <SelectItem key={h} value={h}>
                                  {h}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ETAPA 4: RELATÓRIO DE PRÉ-VALIDAÇÃO */}
              {validationReport && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-blue-900 dark:text-blue-300 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Resultado da Pré-validação
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {validationReport.totalRows} linhas analisadas
                      </Badge>
                    </div>

                    {validationReport.duplicateRowsCount > 0 && validationReport.newRowsCount === 0 && !allowOverwrite && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <strong>Atenção:</strong> Todos os {validationReport.totalRows} registros desta planilha já constam como importados anteriormente. Se você já tinha carregado antes e deseja atualizar a base com essa planilha, clique em Ativar Sobrescrita.
                        </div>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => {
                            setAllowOverwrite(true);
                            handleRunValidation(true);
                          }}
                          className="text-xs shrink-0 bg-amber-600 hover:bg-amber-700 text-white border-none h-8 font-semibold shadow-xs"
                        >
                          Ativar Sobrescrita e Revalidar
                        </Button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-border">
                        <span className="text-muted-foreground">{allowOverwrite ? 'Registros a Gravar:' : 'Novos Registros:'}</span>
                        <div className="text-lg font-black text-emerald-600">
                          {allowOverwrite ? validationReport.processedResponses.length : validationReport.newRowsCount}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-border">
                        <span className="text-muted-foreground">{allowOverwrite ? 'Duplicados no Arquivo:' : 'Repetidos / Duplicados:'}</span>
                        <div className="text-lg font-black text-amber-600">
                          {validationReport.duplicateRowsCount}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-border">
                        <span className="text-muted-foreground">Avisos de Qualidade:</span>
                        <div className="text-lg font-black text-purple-600">
                          {validationReport.warningRowsCount}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-border">
                        <span className="text-muted-foreground">Notas Inválidas:</span>
                        <div className="text-lg font-black text-red-600">
                          {validationReport.invalidRowsCount}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={handleConfirmImport}
                        disabled={isProcessing || (validationReport.newRowsCount === 0 && !allowOverwrite)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs"
                      >
                        {isProcessing ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Confirmar e Gravar Lote no Banco
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 3: GESTÃO DE EVENTOS & APELIDOS ================= */}
        <TabsContent value="events" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold">Eventos Canônicos e Apelidos</h3>
              <p className="text-xs text-muted-foreground">
                Padronize as variações de títulos vindas dos formulários para manter indicadores consolidados e precisos.
              </p>
            </div>
            <Button
              onClick={() => setIsAddEventOpen(true)}
              size="sm"
              className="text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Novo Evento Canônico
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => {
              const evResponses = responses.filter((r) => r.canonicalEventName === ev.canonicalName);
              const checkins = evResponses.filter((r) => r.action === 'CHECKIN').length;
              const evals = evResponses.filter((r) => r.action === 'EVALUATION').length;

              return (
                <Card key={ev.id} className="border border-slate-300 dark:border-slate-700/90 shadow-sm hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 rounded-xl overflow-hidden flex flex-col justify-between bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 transition-all">
                  <CardHeader className="p-4 pb-2 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-bold text-primary">
                        {ev.canonicalName}
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] border-slate-300 dark:border-slate-700">
                        Ativo
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      ID: {ev.id}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-3 space-y-3">
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Check-ins: </span>
                        <strong className="text-foreground">{checkins}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avaliações: </span>
                        <strong className="text-foreground">{evals}</strong>
                      </div>
                    </div>

                    {/* Apelidos */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                        <span>Apelidos Mapeados:</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAliasTargetEventId(ev.id);
                            setIsAddAliasOpen(true);
                          }}
                          className="h-6 px-1.5 text-[10px] text-primary"
                        >
                          + Apelido
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ev.aliases && ev.aliases.length > 0 ? (
                          ev.aliases.map((al, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[10px] border border-slate-200 dark:border-slate-700">
                              {al}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Nenhum alias customizado
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ================= TAB 4: QUALIDADE DE DADOS ================= */}
        <TabsContent value="quality" className="space-y-4">
          <Card className="border border-slate-300 dark:border-slate-700/90 shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5">
            <CardHeader className="p-4 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Auditoria de Qualidade e Inconsistências (RF-006)
              </CardTitle>
              <CardDescription className="text-xs">
                Registros que apresentaram divergência de colunas, ações não reconhecidas ou notas inválidas.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {qualityIssues.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma inconsistência ativa. Todos os registros estão em conformidade com as regras de negócio!
                </div>
              ) : (
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/60">
                        <th className="p-2.5 font-semibold">ID</th>
                        <th className="p-2.5 font-semibold">Ação</th>
                        <th className="p-2.5 font-semibold">Evento Original</th>
                        <th className="p-2.5 font-semibold">Status</th>
                        <th className="p-2.5 font-semibold">Observações de Qualidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualityIssues.slice(0, 50).map((issue) => (
                        <tr key={issue.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-mono text-[11px]">{issue.sourceId || issue.id}</td>
                          <td className="p-2.5">{issue.action}</td>
                          <td className="p-2.5">{issue.eventRaw || '—'}</td>
                          <td className="p-2.5">
                            <Badge
                              variant="outline"
                              className={
                                issue.qualityStatus === 'CONFLICT'
                                  ? 'border-red-400 text-red-600 bg-red-50/50 dark:bg-red-950/20'
                                  : 'border-amber-400 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20'
                              }
                            >
                              {issue.qualityStatus}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-muted-foreground">
                            {issue.qualityNotes?.join(', ') || 'Aviso de consistência'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 5: HISTÓRICO DE LOTES ================= */}
        <TabsContent value="history" className="space-y-4">
          <Card className="border border-slate-300 dark:border-slate-700/90 shadow-sm rounded-xl overflow-hidden bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5">
            <CardHeader className="p-4 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico de Importações e Lotes (RF-015)
              </CardTitle>
              <CardDescription className="text-xs">
                Auditoria de todas as planilhas carregadas com hash criptográfico SHA-256 e estatísticas de processamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {batches.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum lote importado ainda.
                </div>
              ) : (
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="p-2 font-semibold">Data / Hora</th>
                        <th className="p-2 font-semibold">Arquivo</th>
                        <th className="p-2 font-semibold">Aba</th>
                        <th className="p-2 font-semibold">Lidos</th>
                        <th className="p-2 font-semibold">Inseridos</th>
                        <th className="p-2 font-semibold">Repetidos</th>
                        <th className="p-2 font-semibold">Status</th>
                        <th className="p-2 font-semibold">Hash SHA-256</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((b) => (
                        <tr key={b.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="p-2 text-muted-foreground">
                            {format(parseISO(b.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </td>
                          <td className="p-2 font-medium">{b.sourceFilename}</td>
                          <td className="p-2">{b.sheetName}</td>
                          <td className="p-2 font-bold">{b.rowsRead}</td>
                          <td className="p-2 text-emerald-600 font-bold">{b.rowsInserted}</td>
                          <td className="p-2 text-amber-600">{b.rowsSkipped}</td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-[10px]">
                              {b.status}
                            </Badge>
                          </td>
                          <td className="p-2 font-mono text-[10px] text-muted-foreground truncate max-w-[120px]" title={b.fileSha256}>
                            {b.fileSha256.substring(0, 12)}...
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: NOVO EVENTO CANÔNICO */}
      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Novo Evento Canônico</DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre o nome oficial do evento. Todos os apelidos e variações convergirão para ele.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Nome Padronizado do Evento:</Label>
            <Input
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              placeholder="Ex: Semana da Tecnologia 2026"
              className="text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddEventOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateEvent} disabled={!newEventName.trim()}>
              Salvar Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVO APELIDO (ALIAS) */}
      <Dialog open={isAddAliasOpen} onOpenChange={setIsAddAliasOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Adicionar Apelido ao Evento</DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre um nome alternativo comum presente nas planilhas do Microsoft Forms.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Variação / Apelido:</Label>
            <Input
              value={newAliasText}
              onChange={(e) => setNewAliasText(e.target.value)}
              placeholder="Ex: Semana de Tecnologia"
              className="text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddAliasOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateAlias} disabled={!newAliasText.trim()}>
              Vincular Apelido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: CONFIRMAR LIMPEZA DA BASE */}
      <Dialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Limpar Todos os Dados do CORE Eventos?
            </DialogTitle>
            <DialogDescription className="text-xs">
              Esta ação removerá todos os registros de teste e lotes de importação do cache e do banco de dados, preparando o painel para receber os dados reais da sua planilha.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground">
            Tem certeza de que deseja zerar os indicadores e os eventos cadastrados?
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsClearConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearAllData}
              disabled={isProcessing}
            >
              {isProcessing ? 'Limpando...' : 'Sim, Limpar Tudo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
