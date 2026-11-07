import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  CoreEvent,
  CoreFormResponse,
  EventFilterState,
} from '../types';
import {
  subscribeToEvents,
  subscribeToFormResponses,
  filterResponses,
  exportPublicReport,
  getCoreEvents,
  getCoreResponses,
} from '../services/eventosService';
import { calculateKpiSummary } from '../services/npsService';
import { NPSGauge } from './NPSGauge';
import { ScoreHistogram } from './ScoreHistogram';
import { WordCloudCard } from './WordCloudCard';
import { FeedbackWall } from './FeedbackWall';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

import {
  Users,
  CheckCircle2,
  Calendar,
  MessageSquare,
  Award,
  RefreshCw,
  Maximize2,
  Minimize2,
  Download,
  Filter,
  XCircle,
  TrendingUp,
  Layers,
  GraduationCap,
  Building,
  Activity,
  BarChart3,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  Cell,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PublicEventosView() {
  const { eventId } = useParams();

  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [allResponses, setAllResponses] = useState<CoreFormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filtros Globais
  const [filters, setFilters] = useState<EventFilterState>({
    eventId: eventId || 'all',
    periodType: 'all',
    action: 'all',
    category: 'all',
    classCode: 'all',
    searchQuery: '',
  });

  const senaiLogo = '/imagens/senai.png';

  // Sincroniza parâmetro da URL se fornecido
  useEffect(() => {
    if (eventId) {
      setFilters((prev) => ({ ...prev, eventId }));
    }
  }, [eventId]);

  // Carrega e escuta eventos e respostas em tempo real
  useEffect(() => {
    setLoading(true);

    const unsubEvents = subscribeToEvents(
      (evList) => {
        setEvents(evList);
      },
      () => {}
    );

    const unsubResponses = subscribeToFormResponses(
      (respList) => {
        setAllResponses(respList);
        setLastUpdated(new Date());
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => {
      unsubEvents();
      unsubResponses();
    };
  }, []);

  // Extrai lista única de turmas e categorias disponíveis para os dropdowns de filtro
  const { availableCategories, availableClasses } = useMemo(() => {
    const cats = new Set<string>();
    const cls = new Set<string>();

    allResponses.forEach((r) => {
      if (r.category && r.category.trim()) cats.add(r.category.trim());
      if (r.classCode && r.classCode.trim()) cls.add(r.classCode.trim().toUpperCase());
    });

    return {
      availableCategories: Array.from(cats).sort(),
      availableClasses: Array.from(cls).sort(),
    };
  }, [allResponses]);

  // Respostas filtradas de acordo com os filtros ativos
  const filteredResponses = useMemo(() => {
    return filterResponses(allResponses, filters);
  }, [allResponses, filters]);

  // Resumo de KPIs determinísticos
  const kpiSummary = useMemo(() => {
    return calculateKpiSummary(
      filteredResponses,
      events,
      lastUpdated ? lastUpdated.toISOString() : undefined
    );
  }, [filteredResponses, events, lastUpdated]);

  // Evento selecionado atualmente
  const currentEvent = useMemo(() => {
    if (filters.eventId === 'all') return null;
    return (
      events.find((e) => e.id === filters.eventId || e.canonicalName === filters.eventId) || null
    );
  }, [events, filters.eventId]);

  const handleResetFilters = () => {
    setFilters({
      eventId: 'all',
      periodType: 'all',
      action: 'all',
      category: 'all',
      classCode: 'all',
      searchQuery: '',
    });
  };


  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-x-hidden">
      {/* ===== HEADER PADRÃO PUBLIC-VIEW AMPLO ESTILO BI ===== */}
      <header className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 lg:px-8 xl:px-10 py-3 sm:py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3 sm:gap-4">
          <img src={senaiLogo} alt="Logo SENAI" className="h-7 sm:h-8 flex-shrink-0" />
          <div className="h-7 sm:h-8 w-[1px] bg-gray-200 dark:bg-gray-800 hidden sm:block"></div>
          <div className="flex flex-col min-w-0">
            <h1 className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-lg leading-tight flex items-center gap-2">
              CORE Eventos <span className="text-muted-foreground font-normal text-xs sm:text-sm hidden md:inline">• Painel Público de Indicadores BI</span>
            </h1>
            <p className="text-muted-foreground font-medium text-xs truncate max-w-[280px] sm:max-w-md">
              {currentEvent ? currentEvent.canonicalName : 'Visão Consolidada de Todos os Eventos'}
            </p>
          </div>
        </div>

        {/* Controles de Ação do Topo (Sem nenhuma brecha de navegação interna) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Indicador Ao Vivo */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-700 dark:text-emerald-400 font-medium text-xs">
              {loading ? 'Atualizando...' : `Ao vivo • ${format(lastUpdated, 'HH:mm:ss')}`}
            </span>
          </div>


          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPublicReport(filteredResponses, currentEvent?.canonicalName || 'Geral')}
            className="h-8 gap-1.5 text-xs text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 shadow-xs"
            title="Baixar planilha resumida dos dados visíveis"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exportar Relatório</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setLoading(true);
              setTimeout(() => {
                setLastUpdated(new Date());
                setLoading(false);
              }, 600);
            }}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Recarregar dados"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={toggleFullscreen}
            className="h-8 w-8 hidden sm:flex text-muted-foreground hover:text-foreground"
            title={isFullscreen ? 'Sair da tela cheia' : 'Modo TV / Tela cheia'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </header>

      {/* ===== BARRA DE FILTROS FIXA / STICKY AMPLA ===== */}
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 lg:px-8 xl:px-10 py-2.5 sm:py-3 sticky top-[57px] sm:top-[65px] z-30 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-1">
            <Filter className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Filtros:</span>
          </div>

          {/* Filtro: Evento */}
          <div className="w-48 sm:w-60">
            <Select
              value={filters.eventId}
              onValueChange={(val) => setFilters((prev) => ({ ...prev, eventId: val }))}
            >
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <SelectValue placeholder="Selecione um evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Eventos</SelectItem>
                {events.map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {ev.canonicalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro: Período */}
          <div className="w-36 sm:w-40">
            <Select
              value={filters.periodType}
              onValueChange={(val: any) => setFilters((prev) => ({ ...prev, periodType: val }))}
            >
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo o período</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="month">Este Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro: Ação */}
          <div className="w-32 sm:w-36">
            <Select
              value={filters.action}
              onValueChange={(val: any) => setFilters((prev) => ({ ...prev, action: val }))}
            >
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <SelectValue placeholder="Tipo de Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Ações</SelectItem>
                <SelectItem value="CHECKIN">Apenas Check-ins</SelectItem>
                <SelectItem value="EVALUATION">Apenas Avaliações</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro: Categoria */}
          {availableCategories.length > 0 && (
            <div className="w-36 sm:w-44">
              <Select
                value={filters.category}
                onValueChange={(val) => setFilters((prev) => ({ ...prev, category: val }))}
              >
                <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  {availableCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filtro: Turma */}
          {availableClasses.length > 0 && (
            <div className="w-32 sm:w-36">
              <Select
                value={filters.classCode}
                onValueChange={(val) => setFilters((prev) => ({ ...prev, classCode: val }))}
              >
                <SelectTrigger className="h-8 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                  <SelectValue placeholder="Turma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Turmas</SelectItem>
                  {availableClasses.map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Limpar Filtros */}
          {(filters.eventId !== 'all' ||
            filters.periodType !== 'all' ||
            filters.action !== 'all' ||
            filters.category !== 'all' ||
            filters.classCode !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 text-xs text-muted-foreground hover:text-red-500 gap-1 px-2"
            >
              <XCircle className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}

          {/* Contador de Registros no Filtro */}
          <div className="ml-auto text-[11px] text-muted-foreground font-medium hidden lg:block">
            {filteredResponses.length} registros no escopo filtrado
          </div>
        </div>
      </div>

      {/* ===== CONTEÚDO PRINCIPAL DO DASHBOARD AMPLO BI ===== */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6 w-full max-w-[1920px] mx-auto">
        {/* BANNER DE BASE AGUARDANDO DADOS */}
        {allResponses.length === 0 && !loading && (
          <div className="p-8 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-foreground">Aguardando Dados da Planilha</h3>
            <p className="text-xs text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Nenhum dado importado no momento. Acesse o módulo administrativo do CORE Eventos e faça o upload da sua planilha Excel (.xlsx) para visualizar os indicadores em tempo real.
            </p>
          </div>
        )}

        {/* ROW 1: CARDS DE KPIS EXECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* KPI 1: Check-ins */}
          <Card className="border border-slate-300 dark:border-slate-700/80 border-t-4 border-t-blue-500 shadow-sm hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
            <CardHeader className="p-3.5 pb-2 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Check-ins</CardTitle>
              <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3.5 pt-3">
              <div className="text-2xl sm:text-3xl font-black text-foreground">
                {kpiSummary.totalCheckins.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Presenças confirmadas
              </p>
            </CardContent>
          </Card>

          {/* KPI 2: Avaliações Válidas */}
          <Card className="border border-slate-300 dark:border-slate-700/80 border-t-4 border-t-emerald-500 shadow-sm hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
            <CardHeader className="p-3.5 pb-2 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avaliações</CardTitle>
              <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3.5 pt-3">
              <div className="text-2xl sm:text-3xl font-black text-foreground">
                {kpiSummary.totalEvaluations.toLocaleString('pt-BR')}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Notas apuradas
              </p>
            </CardContent>
          </Card>

          {/* KPI 3: NPS Geral */}
          <Card
            className="border border-slate-300 dark:border-slate-700/80 border-t-4 shadow-sm hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden"
            style={{ borderTopColor: kpiSummary.npsGeneral.zoneColor }}
          >
            <CardHeader className="p-3.5 pb-2 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Índice NPS</CardTitle>
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
            <CardContent className="p-3.5 pt-3">
              <div
                className="text-2xl sm:text-3xl font-black"
                style={{ color: kpiSummary.npsGeneral.zoneColor }}
              >
                {kpiSummary.npsGeneral.npsScore > 0
                  ? `+${kpiSummary.npsGeneral.npsScore}`
                  : kpiSummary.npsGeneral.npsScore}
              </div>
              <Badge
                variant="outline"
                className="mt-1 text-[10px] font-semibold px-2 py-0"
                style={{
                  borderColor: kpiSummary.npsGeneral.zoneColor,
                  color: kpiSummary.npsGeneral.zoneColor,
                }}
              >
                {kpiSummary.npsGeneral.zoneLabel}
              </Badge>
            </CardContent>
          </Card>

          {/* KPI 4: Eventos Monitorados */}
          <Card className="border border-slate-300 dark:border-slate-700/80 border-t-4 border-t-purple-500 shadow-sm hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
            <CardHeader className="p-3.5 pb-2 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Eventos</CardTitle>
              <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Layers className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3.5 pt-3">
              <div className="text-2xl sm:text-3xl font-black text-foreground">
                {kpiSummary.totalEvents}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Eventos consolidados
              </p>
            </CardContent>
          </Card>

          {/* KPI 5: Feedbacks Qualitativos */}
          <Card className="border border-slate-300 dark:border-slate-700/80 border-t-4 border-t-amber-500 shadow-sm hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden col-span-2 sm:col-span-1">
            <CardHeader className="p-3.5 pb-2 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feedbacks</CardTitle>
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <MessageSquare className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3.5 pt-3">
              <div className="text-2xl sm:text-3xl font-black text-foreground">
                {kpiSummary.totalComments}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Comentários registrados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ROW 2: TERMÔMETRO NPS + HISTOGRAMA DE NOTAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <NPSGauge metrics={kpiSummary.npsGeneral} />
          <ScoreHistogram data={kpiSummary.scoreDistribution} />
        </div>

        {/* ROW 3: COMPARATIVOS POR EVENTO (CHECK-INS VS AVALIAÇÕES & NPS POR EVENTO) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico 1: Comparativo Check-ins vs Avaliações */}
          <Card className="border border-slate-300 dark:border-slate-700/90 shadow-sm hover:shadow-md hover:border-slate-400/90 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
            <CardHeader className="pb-2.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-bold">Check-ins vs. Avaliações por Evento</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Comparativo de volume de participantes registrados e respostas de avaliação
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {kpiSummary.eventComparison.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum dado por evento no filtro atual.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={kpiSummary.eventComparison}
                      margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                      <XAxis
                        dataKey="eventName"
                        angle={-20}
                        textAnchor="end"
                        interval={0}
                        height={40}
                        tick={{ fontSize: 10, fill: 'currentColor' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={{ stroke: '#94a3b8', opacity: 0.3 }}
                        tick={{ fontSize: 11, fill: 'currentColor' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--popover)',
                          borderColor: 'var(--border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="checkins" name="Check-ins (Presenças)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="evaluations" name="Avaliações Válidas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico 2: NPS por Evento */}
          <Card className="border border-slate-300 dark:border-slate-700/90 shadow-sm hover:shadow-md hover:border-slate-400/90 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
            <CardHeader className="pb-2.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-bold">NPS por Evento</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Score de satisfação líquida apurado para cada evento monitorado (-100 a +100)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {kpiSummary.eventComparison.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum dado por evento no filtro atual.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={kpiSummary.eventComparison}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                      <XAxis
                        type="number"
                        domain={[-100, 100]}
                        tick={{ fontSize: 11, fill: 'currentColor' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="eventName"
                        width={130}
                        tick={{ fontSize: 10, fill: 'currentColor' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--popover)',
                          borderColor: 'var(--border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [`${val} pts`, 'Score NPS']}
                      />
                      <Bar dataKey="nps" name="NPS do Evento" radius={[0, 4, 4, 0]}>
                        {kpiSummary.eventComparison.map((entry, index) => {
                          const color =
                            entry.nps >= 75
                              ? '#10b981'
                              : entry.nps >= 50
                              ? '#0284c7'
                              : entry.nps >= 0
                              ? '#f59e0b'
                              : '#ef4444';
                          return <Cell key={`cell-nps-${index}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ROW 4: PARTICIPAÇÃO POR CATEGORIA E TURMA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Participantes por Categoria */}
          <Card className="border border-slate-300 dark:border-slate-700/90 shadow-sm hover:shadow-md hover:border-slate-400/90 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
            <CardHeader className="pb-2.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-bold">Participação por Categoria de Público</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Composição do público participante (Estudantes, Docentes, Comunidade, Empresas)
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {kpiSummary.categoryDistribution.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                  Nenhuma categoria registrada no filtro.
                </div>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={kpiSummary.categoryDistribution}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                      <XAxis
                        dataKey="category"
                        angle={-15}
                        textAnchor="end"
                        interval={0}
                        tick={{ fontSize: 11, fill: 'currentColor' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={{ stroke: '#94a3b8', opacity: 0.3 }}
                        tick={{ fontSize: 11, fill: 'currentColor' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--popover)',
                          borderColor: 'var(--border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" name="Participantes" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Participantes por Turma */}
          <Card className="border border-slate-300 dark:border-slate-700/90 shadow-sm hover:shadow-md hover:border-slate-400/90 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
            <CardHeader className="pb-2.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-bold">Top Turmas com Mais Participação</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Turmas com maior engajamento registrado em formulários
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {kpiSummary.classDistribution.length === 0 ? (
                <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                  Nenhuma turma registrada no filtro.
                </div>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={kpiSummary.classDistribution}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                      <XAxis
                        dataKey="classCode"
                        angle={-15}
                        textAnchor="end"
                        interval={0}
                        tick={{ fontSize: 11, fill: 'currentColor' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={{ stroke: '#94a3b8', opacity: 0.3 }}
                        tick={{ fontSize: 11, fill: 'currentColor' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--popover)',
                          borderColor: 'var(--border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" name="Registros da Turma" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ROW 5: EVOLUÇÃO TEMPORAL */}
        {kpiSummary.temporalEvolution.length > 0 && (
          <Card className="border border-slate-300 dark:border-slate-700/90 shadow-sm hover:shadow-md hover:border-slate-400/90 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
            <CardHeader className="pb-2.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-bold">Evolução Temporal Diária de Registros</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Distribuição cronológica das presenças (check-ins) e avaliações recebidas
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={kpiSummary.temporalEvolution}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorCheckins" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="colorEvals" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={{ stroke: '#94a3b8', opacity: 0.3 }}
                      tick={{ fontSize: 11, fill: 'currentColor' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={{ stroke: '#94a3b8', opacity: 0.3 }}
                      tick={{ fontSize: 11, fill: 'currentColor' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--popover)',
                        borderColor: 'var(--border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Area
                      type="monotone"
                      dataKey="checkins"
                      name="Check-ins"
                      stroke="#2563eb"
                      fillOpacity={1}
                      fill="url(#colorCheckins)"
                    />
                    <Area
                      type="monotone"
                      dataKey="evaluations"
                      name="Avaliações"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorEvals)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ROW 6: NUVEM DE PALAVRAS EM DESTAQUE (ANÁLISE DE COMENTÁRIOS E FEEDBACKS) */}
        <WordCloudCard responses={filteredResponses} />

        {/* ROW 7: MURAL DE FEEDBACKS (LGPD COMPLIANT) */}
        <FeedbackWall responses={filteredResponses} />
      </main>

      {/* RODAPÉ PÚBLICO SEGURO (Sem links de navegação para a área interna) */}
      <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 py-4 px-4 sm:px-6 lg:px-8 xl:px-10 text-center text-xs text-muted-foreground">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 w-full max-w-[1920px] mx-auto">
          <span>
            CORE Eventos • Serviço Nacional de Aprendizagem Industrial (SENAI)
          </span>
          <span className="text-[11px] text-muted-foreground">
            Painel Público Institucional • Visualização com Governança e Privacidade LGPD
          </span>
        </div>
      </footer>
    </div>
  );
}
