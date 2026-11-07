/**
 * @file PublicRoomMonitor.tsx
 * @description Painel Público Indicativo (Modo TV de Corredor / Flight Board) de Aulas, Check-in/Check-out e Integridade dos Ambientes.
 * Exibe em alta legibilidade e tempo real o status operacional dos ambientes do SENAI.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, Timestamp } from "firebase/firestore";
import { 
    format, 
    isSameDay, 
    getHours, 
    isWithinInterval, 
    differenceInMinutes 
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
    Clock, 
    MapPin, 
    User, 
    GraduationCap, 
    CheckCircle2, 
    AlertTriangle, 
    Maximize2, 
    Minimize2, 
    Tv, 
    Calendar, 
    Search, 
    Wrench, 
    ShieldCheck, 
    Radio, 
    Play, 
    Pause,
    ArrowUpRight,
    RefreshCw,
    X,
    Filter
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatDisplayName } from "@/lib/utils";
import { subscribeToRoomIssues, RoomIssue } from "@/services/inspectionService";

interface ScheduleItem {
    id: string;
    className: string;
    courseName?: string;
    roomName: string;
    roomId?: string;
    teacherName: string;
    startTime: Timestamp;
    endTime: Timestamp;
    unitId: string;
    unitName?: string;
    observation?: string;
    // Check-in / Check-out fields
    checkInCompleted?: boolean;
    checkInAt?: Timestamp | null;
    checkInDiscrepancy?: boolean;
    checkOutCompleted?: boolean;
    checkOutAt?: Timestamp | null;
    checkOutDiscrepancy?: boolean;
    isSubstitution?: boolean;
    originalTeacherName?: string;
}

export default function PublicRoomMonitor() {
    const { unitId } = useParams<{ unitId?: string }>();
    const navigate = useNavigate();

    // Estado da Unidade
    const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
    const [selectedUnitId, setSelectedUnitId] = useState<string>(unitId || "caceres");

    // Dados em tempo real
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [roomIssues, setRoomIssues] = useState<RoomIssue[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Relógio ao vivo
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    // Filtros e Visualização
    const [shiftFilter, setShiftFilter] = useState<"all" | "matutino" | "vespertino" | "noturno">("all");
    const [searchFilter, setSearchFilter] = useState<string>("");
    const [displayLayout, setDisplayLayout] = useState<"board" | "cards">("board");
    const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);

    // Modo Fullscreen e Auto-scroll para TVs
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [autoScroll, setAutoScroll] = useState<boolean>(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Atualização do Relógio a cada segundo
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Sincronizar parâmetro de URL se mudar
    useEffect(() => {
        if (unitId && unitId !== selectedUnitId) {
            setSelectedUnitId(unitId);
        }
    }, [unitId]);

    // Carregar unidades ativas
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "units"), (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
            setUnits(list);
            if (!unitId && list.length > 0 && !list.some(u => u.id === selectedUnitId)) {
                setSelectedUnitId(list[0].id);
            }
        });
        return () => unsub();
    }, [unitId]);

    // Carregar Agendamentos em tempo real
    useEffect(() => {
        setLoading(true);
        const unsubSchedules = onSnapshot(
            collection(db, "schedules"),
            (snapshot) => {
                const list = snapshot.docs
                    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ScheduleItem))
                    .filter(s => !selectedUnitId || s.unitId === selectedUnitId);

                // Ordenar por horário de início crescente
                list.sort((a, b) => {
                    const tA = a.startTime?.toMillis ? a.startTime.toMillis() : 0;
                    const tB = b.startTime?.toMillis ? b.startTime.toMillis() : 0;
                    return tA - tB;
                });

                setSchedules(list);
                setLoading(false);
            },
            (error) => {
                console.error("Erro ao carregar agendamentos no painel público:", error);
                setLoading(false);
            }
        );

        // Carregar Ocorrências e Avarias em tempo real
        const unsubIssues = subscribeToRoomIssues(selectedUnitId, (issues) => {
            setRoomIssues(issues.filter(i => i.status === "open"));
        });

        return () => {
            unsubSchedules();
            unsubIssues();
        };
    }, [selectedUnitId]);

    // Auto-scroll suave para TVs de corredor
    useEffect(() => {
        if (!autoScroll) return;
        const container = scrollContainerRef.current;
        if (!container) return;

        let direction = 1;
        const scrollInterval = setInterval(() => {
            if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
                direction = -1;
            } else if (container.scrollTop <= 5) {
                direction = 1;
            }
            container.scrollBy({ top: 1.5 * direction, behavior: "smooth" });
        }, 50);

        return () => clearInterval(scrollInterval);
    }, [autoScroll]);

    // Controle de tela cheia nativo
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
            }
        }
    };

    // Aulas de hoje filtradas
    const todaySchedules = useMemo(() => {
        return schedules.filter(s => {
            if (!s.startTime?.toDate) return false;
            return isSameDay(s.startTime.toDate(), currentTime);
        });
    }, [schedules, currentTime]);

    // Filtragem de turno e busca
    const filteredSchedules = useMemo(() => {
        return todaySchedules.filter(s => {
            const startHour = getHours(s.startTime.toDate());
            
            // Filtro por Turno
            if (shiftFilter === "matutino" && !(startHour >= 6 && startHour < 13)) return false;
            if (shiftFilter === "vespertino" && !(startHour >= 13 && startHour < 18)) return false;
            if (shiftFilter === "noturno" && !(startHour >= 18 && startHour <= 23)) return false;

            // Filtro de Busca
            if (searchFilter.trim()) {
                const term = searchFilter.toLowerCase();
                const room = (s.roomName || "").toLowerCase();
                const teacher = (s.teacherName || "").toLowerCase();
                const className = (s.className || "").toLowerCase();
                if (!room.includes(term) && !teacher.includes(term) && !className.includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }, [todaySchedules, shiftFilter, searchFilter]);

    // Estatísticas da Tela
    const stats = useMemo(() => {
        const total = todaySchedules.length;
        let inProgress = 0;
        let checkedInCount = 0;
        let checkedOutCount = 0;
        let pendingCheckInCount = 0;
        let discrepancies = 0;

        todaySchedules.forEach(s => {
            const start = s.startTime.toDate();
            const end = s.endTime.toDate();
            const isOngoing = isWithinInterval(currentTime, { start, end });
            const hasStarted = currentTime >= start;

            if (isOngoing) inProgress++;
            if (s.checkInCompleted) checkedInCount++;
            if (s.checkOutCompleted) checkedOutCount++;
            if (s.checkInDiscrepancy || s.checkOutDiscrepancy) discrepancies++;

            // Check-in pendente se a aula já começou há mais de 10 min e ainda não realizou check-in
            if (hasStarted && !s.checkInCompleted && differenceInMinutes(currentTime, start) >= 10) {
                pendingCheckInCount++;
            }
        });

        const checkInPercent = total > 0 ? Math.round((checkedInCount / total) * 100) : 0;

        return {
            total,
            inProgress,
            checkedInCount,
            checkedOutCount,
            pendingCheckInCount,
            discrepancies,
            checkInPercent
        };
    }, [todaySchedules, currentTime]);

    const unitDisplayName = units.find(u => u.id === selectedUnitId)?.name || "SENAI Cáceres";

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
            {/* Header Flight Board */}
            <header className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-3 sm:px-6 backdrop-blur-md shrink-0 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Logo & Unidade */}
                    <div className="flex items-center gap-4">
                        <img 
                            src="/imagens/senai.png" 
                            alt="SENAI" 
                            className="h-8 sm:h-9 object-contain filter drop-shadow brightness-110" 
                        />
                        <div className="h-7 w-[1px] bg-slate-700 hidden sm:block"></div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-extrabold tracking-wider text-base sm:text-lg text-white uppercase flex items-center gap-1.5">
                                    <Tv className="w-5 h-5 text-sky-400" />
                                    Painel de Ambientes & Aulas
                                </span>
                                <Badge variant="outline" className="border-sky-500/30 text-sky-400 bg-sky-950/40 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 animate-pulse">
                                    Ao Vivo
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <select
                                    value={selectedUnitId}
                                    onChange={(e) => {
                                        const newUnit = e.target.value;
                                        setSelectedUnitId(newUnit);
                                        navigate(`/painel-aulas/${newUnit}`);
                                    }}
                                    aria-label="Selecionar Unidade Operacional"
                                    className="bg-transparent text-slate-300 font-semibold text-xs border-none p-0 focus:outline-none cursor-pointer hover:text-white transition-colors"
                                >
                                    {units.map((u) => (
                                        <option key={u.id} value={u.id} className="bg-slate-900 text-slate-100">
                                            {u.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Relógio Digital de Alta Legibilidade */}
                    <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-1.5 shadow-inner">
                        <Clock className="w-6 h-6 text-sky-400 animate-pulse" />
                        <div className="text-right">
                            <div className="text-2xl sm:text-3xl font-mono font-bold tracking-wider text-emerald-400">
                                {format(currentTime, "HH:mm:ss")}
                            </div>
                            <div className="text-[11px] font-medium text-slate-400 capitalize">
                                {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                            </div>
                        </div>
                    </div>

                    {/* Controles de TV / Filtros / Fullscreen */}
                    <div className="flex items-center gap-2">
                        {/* Botão Auto-scroll */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAutoScroll(!autoScroll)}
                            className={`border-slate-700 text-xs hidden md:flex items-center gap-1.5 ${
                                autoScroll ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-slate-900 text-slate-300"
                            }`}
                            title={autoScroll ? "Pausar rolagem automática" : "Ativar rolagem automática para TVs"}
                        >
                            {autoScroll ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            {autoScroll ? "Auto-Scroll Ativo" : "Auto-Scroll"}
                        </Button>

                        {/* Fullscreen */}
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={toggleFullscreen}
                            className="border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 h-9 w-9"
                            title="Alternar Tela Cheia"
                            aria-label="Alternar Tela Cheia"
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </Button>

                        {/* Atalho para Calendário Público */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/public-view/${selectedUnitId}`)}
                            className="text-slate-400 hover:text-white text-xs hidden lg:flex items-center gap-1"
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            Ver Calendário
                            <ArrowUpRight className="w-3 h-3" />
                        </Button>
                    </div>
                </div>

                {/* Barra de Alertas de Manutenção Ativos (Ticker) */}
                {roomIssues.length > 0 && (
                    <div className="mt-2.5 bg-rose-950/70 border border-rose-800/80 rounded-lg px-3 py-1.5 flex items-center gap-3 overflow-hidden shadow-sm">
                        <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs shrink-0 uppercase tracking-wide">
                            <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
                            Avisos Técnicos ({roomIssues.length}):
                        </div>
                        <div className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-rose-200 custom-scrollbar flex gap-4">
                            {roomIssues.map((issue) => (
                                <span key={issue.id} className="inline-flex items-center gap-1 bg-rose-900/40 px-2 py-0.5 rounded border border-rose-800/50">
                                    <strong className="text-white">{issue.roomName}:</strong> {issue.description}
                                    <span className="text-[10px] text-rose-300 opacity-80">({issue.reportedByTeacherName})</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </header>

            {/* Barra de Filtros e KPIs */}
            <div className="bg-slate-900/60 border-b border-slate-800 px-4 py-2 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* KPIs Rápidos */}
                <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1">
                    <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                        <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                        <span className="text-slate-400">Em Andamento:</span>
                        <strong className="text-sky-300 font-bold text-sm">{stats.inProgress}</strong>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-slate-400">Check-in:</span>
                        <strong className="text-emerald-300 font-bold text-sm">{stats.checkedInCount}/{stats.total} ({stats.checkInPercent}%)</strong>
                    </div>

                    {stats.pendingCheckInCount > 0 && (
                        <div className="flex items-center gap-1.5 bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-700/60 text-amber-300 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Check-in Pendente:</span>
                            <strong className="font-bold text-sm">{stats.pendingCheckInCount}</strong>
                        </div>
                    )}

                    {stats.discrepancies > 0 && (
                        <div className="flex items-center gap-1.5 bg-rose-950/60 px-2.5 py-1 rounded-md border border-rose-700/60 text-rose-300">
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Avarias Registradas:</span>
                            <strong className="font-bold text-sm">{stats.discrepancies}</strong>
                        </div>
                    )}
                </div>

                {/* Filtros de Turno e Busca */}
                <div className="flex items-center gap-2 flex-wrap ml-auto">
                    <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800">
                        {(["all", "matutino", "vespertino", "noturno"] as const).map((shift) => (
                            <button
                                key={shift}
                                onClick={() => setShiftFilter(shift)}
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
                                    shiftFilter === shift 
                                        ? "bg-sky-600 text-white shadow-sm" 
                                        : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                {shift === "all" ? "Todos" : shift}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Filtrar sala, docente..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 w-36 sm:w-44 transition-all"
                        />
                        {searchFilter && (
                            <button onClick={() => setSearchFilter("")} className="absolute right-2 top-2 text-slate-500 hover:text-white" aria-label="Limpar filtro de busca">
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Conteúdo Principal (Quadro de Voo / Tabela de TV) */}
            <main 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 custom-scrollbar"
            >
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <RefreshCw className="w-8 h-8 animate-spin text-sky-500 mb-3" />
                        <p className="text-base font-semibold">Carregando programação de ambientes...</p>
                    </div>
                ) : filteredSchedules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30 p-8">
                        <Tv className="w-12 h-12 text-slate-600 mb-3" />
                        <h3 className="text-lg font-bold text-slate-300">Nenhuma aula programada para hoje</h3>
                        <p className="text-sm text-slate-500 max-w-md mt-1">
                            Não há agendamentos com os filtros selecionados para a data de hoje ({format(currentTime, "dd/MM/yyyy")}).
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Cabeçalho da Tabela Tipo Aeroporto */}
                        <div className="hidden lg:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 shadow-sm">
                            <div className="col-span-3">Ambiente / Laboratório</div>
                            <div className="col-span-2 text-center">Horário & Turno</div>
                            <div className="col-span-3">Turma & Docente</div>
                            <div className="col-span-2 text-center">Status da Aula</div>
                            <div className="col-span-2 text-center">Check-in / Custódia</div>
                        </div>

                        {/* Linhas de Agendamento */}
                        <div className="space-y-2.5">
                            {filteredSchedules.map((schedule) => {
                                const start = schedule.startTime.toDate();
                                const end = schedule.endTime.toDate();
                                const isOngoing = isWithinInterval(currentTime, { start, end });
                                const hasFinished = currentTime > end;
                                const isUpcoming = currentTime < start;
                                const hasStarted = currentTime >= start;
                                
                                const checkInLate = hasStarted && !schedule.checkInCompleted && differenceInMinutes(currentTime, start) >= 10;
                                const hasDiscrepancy = schedule.checkInDiscrepancy || schedule.checkOutDiscrepancy;

                                return (
                                    <div
                                        key={schedule.id}
                                        onClick={() => setSelectedSchedule(schedule)}
                                        className={`rounded-xl border transition-all duration-200 cursor-pointer p-4 lg:py-3.5 lg:px-4 shadow-sm hover:shadow-md ${
                                            isOngoing 
                                                ? "bg-slate-900/95 border-sky-500/60 ring-1 ring-sky-500/30 hover:border-sky-400" 
                                                : hasFinished 
                                                    ? "bg-slate-900/40 border-slate-800/80 opacity-70 hover:opacity-100" 
                                                    : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                                        }`}
                                    >
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                                            {/* Coluna 1: Ambiente */}
                                            <div className="lg:col-span-3 flex items-start sm:items-center gap-3">
                                                <div className={`p-2.5 rounded-lg shrink-0 ${
                                                    isOngoing ? "bg-sky-500/20 text-sky-400" : "bg-slate-800 text-slate-400"
                                                }`}>
                                                    <MapPin className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                                                        {schedule.roomName}
                                                    </h4>
                                                    <span className="text-xs text-slate-400 truncate block">
                                                        {schedule.courseName || schedule.className}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Coluna 2: Horário */}
                                            <div className="lg:col-span-2 flex lg:flex-col items-center justify-between lg:justify-center text-left lg:text-center py-1 lg:py-0 border-y lg:border-y-0 border-slate-800/60 my-1 lg:my-0">
                                                <div className="text-sm sm:text-base font-mono font-bold text-slate-200 flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                    {format(start, "HH:mm")} - {format(end, "HH:mm")}
                                                </div>
                                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                                    {getHours(start) < 12 ? "Manhã" : getHours(start) < 18 ? "Tarde" : "Noite"}
                                                </span>
                                            </div>

                                            {/* Coluna 3: Docente & Turma */}
                                            <div className="lg:col-span-3 min-w-0 space-y-0.5">
                                                <div className="flex items-center gap-1.5 text-slate-200 font-semibold text-sm truncate">
                                                    <User className="w-4 h-4 text-sky-400 shrink-0" />
                                                    <span className="truncate">{formatDisplayName(schedule.teacherName)}</span>
                                                    {schedule.isSubstitution && (
                                                        <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-300 bg-amber-950/30 px-1 py-0">
                                                            Subst.
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
                                                    <GraduationCap className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                    <span className="truncate font-medium">{schedule.className}</span>
                                                </div>
                                            </div>

                                            {/* Coluna 4: Status da Aula */}
                                            <div className="lg:col-span-2 flex items-center justify-start lg:justify-center">
                                                {isOngoing ? (
                                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold tracking-wide">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                                        <span>EM ANDAMENTO</span>
                                                    </div>
                                                ) : isUpcoming ? (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-950/60 border border-sky-600/40 text-sky-300 text-xs font-semibold">
                                                        <Clock className="w-3 h-3 text-sky-400" />
                                                        <span>A SEGUIR</span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-medium">
                                                        <span>ENCERRADA</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Coluna 5: Check-in / Check-out & Avarias */}
                                            <div className="lg:col-span-2 flex flex-col items-start lg:items-center gap-1">
                                                {/* Badge de Check-in */}
                                                {schedule.checkInCompleted ? (
                                                    <div className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded px-2 py-0.5 text-xs font-semibold">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        <span>Check-in: {schedule.checkInAt?.toDate ? format(schedule.checkInAt.toDate(), "HH:mm") : "OK"}</span>
                                                    </div>
                                                ) : checkInLate ? (
                                                    <div className="inline-flex items-center gap-1 text-rose-300 bg-rose-950/80 border border-rose-600 rounded px-2 py-0.5 text-xs font-bold animate-pulse">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                                        <span>Check-in Pendente</span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1 text-slate-400 bg-slate-800/50 border border-slate-700/60 rounded px-2 py-0.5 text-xs">
                                                        <span>Check-in: Aguardando</span>
                                                    </div>
                                                )}

                                                {/* Badge de Avaria ou Integridade */}
                                                {hasDiscrepancy ? (
                                                    <div className="inline-flex items-center gap-1 text-amber-300 bg-amber-950/60 border border-amber-600/60 rounded px-2 py-0.5 text-[11px] font-semibold">
                                                        <Wrench className="w-3 h-3 text-amber-400" />
                                                        <span>Avaria / Falta Relatada</span>
                                                    </div>
                                                ) : schedule.checkInCompleted ? (
                                                    <div className="inline-flex items-center gap-1 text-emerald-300/80 text-[10px]">
                                                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                                        <span>Ambiente Conforme</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>

            {/* Rodapé Informativo */}
            <footer className="bg-slate-900/90 border-t border-slate-800 px-6 py-2.5 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                        Check-in Realizado
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                        Check-in Pendente (&gt;10 min)
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                        Avaria ou Item Faltante
                    </span>
                </div>
                <div className="text-slate-500 text-[11px]">
                    SENAI MT • Gestão Integrada de Ambientes & Custódia de Ativos
                </div>
            </footer>

            {/* Modal de Detalhes da Aula / Ambiente ao clicar */}
            <Dialog open={!!selectedSchedule} onOpenChange={(open) => !open && setSelectedSchedule(null)}>
                <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-slate-100">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg text-white">
                            <MapPin className="w-5 h-5 text-sky-400" />
                            {selectedSchedule?.roomName}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            Detalhes operacionais e cadeia de custódia do ambiente.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedSchedule && (
                        <div className="space-y-4 text-xs py-2">
                            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Docente Responsável</span>
                                    <strong className="text-white text-sm">{selectedSchedule.teacherName}</strong>
                                    {selectedSchedule.isSubstitution && (
                                        <span className="text-amber-400 text-[10px] block">
                                            (Substituindo: {selectedSchedule.originalTeacherName})
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Horário da Aula</span>
                                    <strong className="text-emerald-400 font-mono text-sm">
                                        {format(selectedSchedule.startTime.toDate(), "HH:mm")} às {format(selectedSchedule.endTime.toDate(), "HH:mm")}
                                    </strong>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Turma & Curso</span>
                                    <p className="text-slate-200">{selectedSchedule.className}</p>
                                    {selectedSchedule.courseName && (
                                        <p className="text-slate-400 text-[11px]">{selectedSchedule.courseName}</p>
                                    )}
                                </div>
                            </div>

                            {/* Status de Check-in e Check-out */}
                            <div className="space-y-2">
                                <h5 className="font-bold text-slate-300 uppercase text-[10px] tracking-wider">
                                    Histórico de Vistoria
                                </h5>

                                <div className="grid grid-cols-2 gap-2">
                                    {/* Card Check-in */}
                                    <div className={`p-3 rounded-lg border ${
                                        selectedSchedule.checkInCompleted 
                                            ? "bg-emerald-950/30 border-emerald-800/60" 
                                            : "bg-slate-950 border-slate-800"
                                    }`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-slate-300">Check-in</span>
                                            {selectedSchedule.checkInCompleted ? (
                                                <Badge className="bg-emerald-600 text-white text-[9px] py-0">Realizado</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400 text-[9px] py-0">Pendente</Badge>
                                            )}
                                        </div>
                                        <p className="text-slate-400 text-[11px]">
                                            {selectedSchedule.checkInAt?.toDate 
                                                ? `Horário: ${format(selectedSchedule.checkInAt.toDate(), "HH:mm:ss")}`
                                                : "Não registrado pelo docente"}
                                        </p>
                                        {selectedSchedule.checkInDiscrepancy && (
                                            <p className="text-amber-400 font-bold mt-1 text-[11px]">
                                                ⚠ Avaria ou item em falta apontado na entrada!
                                            </p>
                                        )}
                                    </div>

                                    {/* Card Check-out */}
                                    <div className={`p-3 rounded-lg border ${
                                        selectedSchedule.checkOutCompleted 
                                            ? "bg-sky-950/30 border-sky-800/60" 
                                            : "bg-slate-950 border-slate-800"
                                    }`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-slate-300">Check-out</span>
                                            {selectedSchedule.checkOutCompleted ? (
                                                <Badge className="bg-sky-600 text-white text-[9px] py-0">Realizado</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400 text-[9px] py-0">Pendente</Badge>
                                            )}
                                        </div>
                                        <p className="text-slate-400 text-[11px]">
                                            {selectedSchedule.checkOutAt?.toDate 
                                                ? `Horário: ${format(selectedSchedule.checkOutAt.toDate(), "HH:mm:ss")}`
                                                : "Não registrado pelo docente"}
                                        </p>
                                        {selectedSchedule.checkOutDiscrepancy && (
                                            <p className="text-rose-400 font-bold mt-1 text-[11px]">
                                                ⚠ Avaria apontada no encerramento!
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {selectedSchedule.observation && (
                                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                                    <span className="font-bold text-slate-400">Observações:</span>
                                    <p className="text-slate-300 mt-0.5">{selectedSchedule.observation}</p>
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setSelectedSchedule(null)}
                                    className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                                >
                                    Fechar
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
