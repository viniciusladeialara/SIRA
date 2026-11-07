// --- Importações de Bibliotecas e Módulos ---
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import { collection, onSnapshot, query, where, Timestamp, orderBy, limit } from "@/lib/sira-sql-adapter";
import {
  startOfMonth, endOfMonth, addMonths, subMonths, format, eachDayOfInterval, getDay, getHours,
  isSameDay, isWithinInterval, startOfWeek, endOfWeek
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx } from "clsx";

// --- Importações de Componentes de UI e Ícones ---
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDisplayName } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Clock, User, BookOpen, MapPin, ChevronLeft, ChevronRight, GraduationCap, TrendingUp, Info, Tv } from "lucide-react";

// --- Tipagem de Dados (sem alterações) ---
interface Schedule {
  id: string;
  className: string;
  courseName: string;
  unitName: string;
  roomId: string;
  roomName: string;
  teacherName: string;
  startTime: Timestamp;
  endTime: Timestamp;
  observation?: string;
  isSubstitution?: boolean;
  originalTeacherName?: string;
  baseScheduleId?: string;
}

interface Holiday {
  id: string;
  name: string;
  date: Timestamp;
}

const turnoColors = {
  matutino: { bg: "bg-blue-100 dark:bg-blue-900/50", border: "border-blue-500", text: "text-blue-800 dark:text-blue-200" },
  vespertino: { bg: "bg-orange-100 dark:bg-orange-900/50", border: "border-orange-500", text: "text-orange-800 dark:text-orange-200" },
  noturno: { bg: "bg-purple-100 dark:bg-purple-900/50", border: "border-purple-500", text: "text-purple-800 dark:text-purple-200" },
};

const getTurnoMeta = (startTime: Timestamp) => {
  const hour = getHours(startTime.toDate());
  if (hour >= 7 && hour < 13) {
    return { key: 'matutino', label: 'Matutino', ...turnoColors.matutino };
  }
  if (hour >= 13 && hour < 18) {
    return { key: 'vespertino', label: 'Vespertino', ...turnoColors.vespertino };
  }
  return { key: 'noturno', label: 'Noturno', ...turnoColors.noturno };
};

const getShiftAbbreviation = (hour: number) => {
  if (hour >= 7 && hour < 13) return "M";
  if (hour >= 13 && hour < 18) return "V";
  return "N";
};

// --- Componente Principal ---
export default function PublicView() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'compact' | 'comfortable' | 'spacious'>(() => {
    try { const v = localStorage.getItem('publicViewMode'); return (v as any) || 'comfortable'; } catch { return 'comfortable'; }
  });
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const { unitId } = useParams();
  const navigate = useNavigate();
  const [selectedUnitId, setSelectedUnitId] = useState<string>("caceres");

  useEffect(() => {
    if (unitId) {
      setSelectedUnitId(unitId);
    }
  }, [unitId]);

  const senaiLogo = "/imagens/senai.png";

  // Carregar unidades ativas dinamicamente
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "units"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setUnits(list);
    }, (err) => {
      console.error("Erro ao carregar unidades na visualização pública:", err);
    });
    return () => unsubscribe();
  }, []);

  // Filtrar agendamentos em memória pela unidade selecionada
  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => (s as any).unitId === selectedUnitId);
  }, [schedules, selectedUnitId]);

  useEffect(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    // Converte para Timestamps e limita ordenação para otimizar leitura
    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);
    const schedulesQuery = query(
      collection(db, "schedules"),
      where("startTime", ">=", startTs),
      where("startTime", "<=", endTs),
      orderBy("startTime", "asc"),
      limit(1000)
    );

    setLoading(true);
    setError(null);
    const unsubscribe = onSnapshot(
      schedulesQuery,
      (snapshot) => {
        const schedulesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Schedule[];

        console.log(`📅 [PUBLIC VIEW] Agendamentos atualizados: ${schedulesData.length} encontrados`);

        // Detectar mudancas (se houver schedules anteriores)
        if (schedules.length > 0) {
          const changes = snapshot.docChanges();
          changes.forEach(change => {
            if (change.type === 'modified') {
              const oldData = schedules.find(s => s.id === change.doc.id);
              const newData = change.doc.data() as Schedule;
              if (oldData && oldData.teacherName !== newData.teacherName) {
                console.log(`🔄 [PUBLIC VIEW] TROCA DETECTADA!`, {
                  agendamento: newData.className,
                  professorAnterior: oldData.teacherName,
                  professorNovo: newData.teacherName,
                  horario: format(newData.startTime.toDate(), "dd/MM 'as' HH:mm", { locale: ptBR })
                });
              }
            }
          });
        }

        setSchedules(schedulesData.sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis()));
        setLoading(false);
        setLastUpdated(new Date());
      },
      (err) => {
        setError(err?.message || 'Erro ao carregar agendamentos');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentMonth]);

  // --- Efeito para Carregar Feriados ---
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "holidays"), (snapshot) => {
      const holidayData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Holiday[];
      setHolidays(holidayData);
    });
    return () => unsubscribe();
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const firstDayOfGrid = startOfWeek(monthStart, { weekStartsOn: 0 });
  const lastDayOfGrid = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 });
  const daysInGrid = eachDayOfInterval({ start: firstDayOfGrid, end: lastDayOfGrid });

  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  // Atualiza estado de loading ao navegar entre meses
  useEffect(() => {
    setLoading(true);
  }, [currentMonth]);

  // Persiste a preferência do usuário para o modo de visualização
  useEffect(() => {
    try { localStorage.setItem('publicViewMode', viewMode); } catch (e) { /* ignore */ }
  }, [viewMode]);

  const getSchedulesForDay = (day: Date) => {
    return filteredSchedules.filter(s => isSameDay(s.startTime.toDate(), day));
  };

  const getHolidayForDay = (day: Date) => {
    return holidays.find(h => isSameDay(h.date.toDate(), day));
  };

  const groupSchedulesByTurn = (daySchedules: Schedule[]) => {
    const grouped = daySchedules.reduce((acc, schedule) => {
      const turno = getTurnoMeta(schedule.startTime);
      const key = turno.key;

      if (!acc[key]) {
        acc[key] = {
          turnoKey: turno.key,
          turnoLabel: turno.label,
          schedules: [],
        };
      }

      acc[key].schedules.push(schedule);
      return acc;
    }, {} as Record<string, { turnoKey: string; turnoLabel: string; schedules: Schedule[] }>);

    const turnoOrder = { matutino: 0, vespertino: 1, noturno: 2 } as const;

    return Object.values(grouped)
      .map((group) => ({
        ...group,
        schedules: group.schedules.sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis()),
      }))
      .sort((a, b) => {
        return turnoOrder[a.turnoKey as keyof typeof turnoOrder] - turnoOrder[b.turnoKey as keyof typeof turnoOrder];
      });
  };

  const schedulesForSelectedDay = selectedDay ? getSchedulesForDay(selectedDay) : [];
  const groupedSchedules = groupSchedulesByTurn(schedulesForSelectedDay);

  const rightPanelModeMap = {
    compact: {
      containerPadding: 'p-3 sm:p-5 space-y-4',
      cardPadding: 'p-2',
      timeText: 'text-[10px]',
      badgeText: 'text-[8px]',
      badgeHeight: 'h-3.5',
      roomText: 'text-[11px]',
      teacherText: 'text-[10px]',
      substText: 'text-[7px]',
      unitText: 'text-[9px]',
      courseText: 'text-[9px]',
      obsText: 'text-[8px]',
      iconSize: 'h-2.5 w-2.5',
      iconSizeSmall: 'h-2 w-2',
      gridCols: 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
    },
    comfortable: {
      containerPadding: 'p-4 sm:p-6 space-y-6',
      cardPadding: 'p-3.5',
      timeText: 'text-xs',
      badgeText: 'text-[10px]',
      badgeHeight: 'h-4',
      roomText: 'text-[13px]',
      teacherText: 'text-xs',
      substText: 'text-[9px]',
      unitText: 'text-[11px]',
      courseText: 'text-[11px]',
      obsText: 'text-[10px]',
      iconSize: 'h-3.5 w-3.5',
      iconSizeSmall: 'h-2.5 w-2.5',
      gridCols: 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-2'
    },
    spacious: {
      containerPadding: 'p-5 sm:p-8 space-y-8',
      cardPadding: 'p-5',
      timeText: 'text-sm',
      badgeText: 'text-xs',
      badgeHeight: 'h-5',
      roomText: 'text-base',
      teacherText: 'text-sm',
      substText: 'text-[11px]',
      unitText: 'text-[13px]',
      courseText: 'text-[13px]',
      obsText: 'text-[12px]',
      iconSize: 'h-4 w-4',
      iconSizeSmall: 'h-3.5 w-3.5',
      gridCols: 'grid-cols-1 lg:grid-cols-1 xl:grid-cols-2'
    }
  };

  const rm = rightPanelModeMap[viewMode];

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <img src={senaiLogo} alt="Logo SENAI" className="h-8 hidden sm:block flex-shrink-0" />
          <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-800 hidden sm:block"></div>
          <div className="flex flex-col min-w-0">
            <h1 className="font-bold text-gray-900 dark:text-gray-100 leading-tight" style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)' }}>Grade de Horários</h1>
            {units.length > 1 ? (
              <select
                value={selectedUnitId}
                onChange={(e) => {
                  setSelectedUnitId(e.target.value);
                  navigate(`/public-view/${e.target.value}`);
                }}
                className="bg-transparent text-muted-foreground font-semibold border-none p-0 text-xs sm:text-sm focus:outline-none cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 transition-colors w-full max-w-[200px]"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                    {u.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-muted-foreground font-medium text-xs sm:text-sm">
                {units.find(u => u.id === selectedUnitId)?.name || "SENAI Cáceres"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8 hover:bg-white dark:hover:bg-gray-700"><ChevronLeft className="h-4 w-4" /></Button>
          <div className="px-4 font-bold text-primary min-w-[140px] text-center" style={{ fontSize: 'clamp(0.875rem, 1.8vw, 1rem)' }}>
            {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </div>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8 hover:bg-white dark:hover:bg-gray-700"><ChevronRight className="h-4 w-4" /></Button>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => window.open('/dashboard-publico', '_blank')} className="hidden sm:flex gap-2 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10">
            <TrendingUp className="h-4 w-4" />
            Visão BI
          </Button>
          <Button variant="outline" onClick={() => window.open(`/painel-aulas/${selectedUnitId}`, '_blank')} className="hidden sm:flex gap-2 text-sky-600 dark:text-sky-400 border-sky-500/20 bg-sky-500/10 hover:bg-sky-500/20">
            <Tv className="h-4 w-4" />
            Modo TV Corredor
          </Button>
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-700 dark:text-emerald-400 font-medium text-xs">
              {loading ? "Carregando..." : `Ao vivo • ${lastUpdated ? format(lastUpdated, "HH:mm:ss") : '—'}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleToday} size="sm" className="hidden sm:inline-flex h-9 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800">Hoje</Button>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            >
              <option value="compact">Compacto</option>
              <option value="comfortable">Confortável</option>
              <option value="spacious">Espaçoso</option>
            </select>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden bg-gray-50/30 dark:bg-gray-950/30">
        {/* Left Panel: Calendar Container */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-[20px_0_40px_-20px_rgba(0,0,0,0.05)] z-10 transition-all duration-300">
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dayName => (
              <div key={dayName} className="py-3 text-center font-bold text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wider">
                {dayName}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-7 gap-0 min-h-full border-l border-gray-100 dark:border-gray-800" style={{ gridAutoRows: '1fr' }}>
              {daysInGrid.map(day => {
                const daySchedules = getSchedulesForDay(day);
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const isToday = isSameDay(day, new Date());

                const modeMap: Record<string, { cellPadding: string; dateText: string; badgeText: string; gap: string; visible: number }> = {
                  compact: { cellPadding: 'p-1', dateText: 'text-xs', badgeText: 'text-[10px]', gap: 'space-y-1', visible: 2 },
                  comfortable: { cellPadding: 'p-2', dateText: 'text-sm', badgeText: 'text-[11px]', gap: 'space-y-1', visible: 3 },
                  spacious: { cellPadding: 'p-3', dateText: 'text-base', badgeText: 'text-xs', gap: 'space-y-2', visible: 4 },
                };
                const modes = modeMap[viewMode];

                return (
                  <div
                    key={day.toISOString()}
                    className={clsx(
                      "relative border-r border-b border-gray-100 dark:border-gray-800 flex flex-row items-center p-1 gap-2 min-h-[48px] transition-all duration-200 group",
                      !isCurrentMonth ? "bg-gray-50/40 dark:bg-gray-950/40 opacity-40" : "bg-white dark:bg-gray-900",
                      isSelected && "ring-2 ring-inset ring-primary/60 dark:ring-primary/40 z-20 bg-primary/5 dark:bg-primary/10 shadow-inner",
                      daySchedules.length > 0 && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/80",
                      isToday && !isSelected && "bg-orange-50/30 dark:bg-orange-900/10"
                    )}
                    onClick={() => setSelectedDay(day)}
                  >
                    <div className="flex flex-col items-center gap-1 shrink-0">
                       <span className={clsx(
                         "font-bold rounded-md w-7 h-7 flex items-center justify-center transition-colors shadow-sm relative",
                         isSelected ? "bg-primary text-white scale-110 shadow-primary/20" :
                         isToday ? "bg-orange-500 text-white shadow-orange-500/20" :
                         getHolidayForDay(day) ? "bg-amber-100 text-amber-700 border border-amber-200" :
                         "text-gray-500 dark:text-gray-400 group-hover:bg-gray-100 dark:group-hover:bg-gray-800"
                       )} style={{ fontSize: '12px' }}>
                        {format(day, 'd')}
                        {getHolidayForDay(day) && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full border border-white dark:border-gray-900"></span>
                        )}
                      </span>
                        {daySchedules.length > 0 && !getHolidayForDay(day) && (
                          <span className="w-1 h-1 rounded-full bg-primary/40 animate-pulse"></span>
                        )}
                    </div>

                    <div className="flex-1 flex items-center">
                      {(() => {
                        const counts = daySchedules.reduce((acc, s) => {
                          const turno = getTurnoMeta(s.startTime).key;
                          acc[turno] = (acc[turno] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>);

                        return (
                          <div className="flex flex-row flex-wrap gap-0.5 items-center">
                            {counts.matutino && (
                              <div className={clsx(
                                "flex items-center gap-1 px-1 py-0.5 rounded-full border text-[9px] font-bold shadow-sm whitespace-nowrap",
                                turnoColors.matutino.bg, turnoColors.matutino.border, turnoColors.matutino.text
                              )}>
                                <span className="w-1 h-1 rounded-full bg-blue-500 shrink-0"></span>
                                M: {counts.matutino}
                              </div>
                            )}
                            {counts.vespertino && (
                              <div className={clsx(
                                "flex items-center gap-1 px-1 py-0.5 rounded-full border text-[9px] font-bold shadow-sm whitespace-nowrap",
                                turnoColors.vespertino.bg, turnoColors.vespertino.border, turnoColors.vespertino.text
                              )}>
                                <span className="w-1 h-1 rounded-full bg-orange-500 shrink-0"></span>
                                V: {counts.vespertino}
                              </div>
                            )}
                            {counts.noturno && (
                              <div className={clsx(
                                "flex items-center gap-1 px-1 py-0.5 rounded-full border text-[9px] font-bold shadow-sm whitespace-nowrap",
                                turnoColors.noturno.bg, turnoColors.noturno.border, turnoColors.noturno.text
                              )}>
                                <span className="w-1 h-1 rounded-full bg-purple-500 shrink-0"></span>
                                N: {counts.noturno}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Daily Details */}
        <aside className="w-full md:w-[600px] lg:w-[800px] xl:w-[1020px] flex flex-col bg-gray-50/50 dark:bg-gray-950/50 backdrop-blur-xl relative overflow-hidden shrink-0 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] transition-all duration-500">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -ml-32 -mb-32"></div>

          <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm z-10 sticky top-0">
            <div className="flex flex-col gap-1">
              <h3 className="font-extrabold text-xl text-gray-900 dark:text-gray-100 tracking-tight">
                {selectedDay ? format(selectedDay, "dd 'de' MMMM", { locale: ptBR }) : "Selecione um dia"}
              </h3>
              <p className="text-xs font-semibold text-primary/80 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                {selectedDay ? format(selectedDay, "EEEE", { locale: ptBR }) : ""}
              </p>
            </div>
            <Badge variant="outline" className="h-8 px-3 rounded-full border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-800/50 shadow-sm font-bold text-gray-700 dark:text-gray-300">
              {schedulesForSelectedDay.length} Alocações
            </Badge>
          </div>

          <div className={clsx("flex-1 overflow-y-auto z-10 custom-scrollbar", rm.containerPadding)}>
            {selectedDay && getHolidayForDay(selectedDay) && (
               <div className="animate-in fade-in zoom-in duration-500 mb-6">
                  <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-6 text-center group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200"></div>
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-black uppercase mb-3 px-3 py-1 shadow-sm">
                        Feriado Nacional / Local
                    </Badge>
                    <h4 className="text-2xl font-black text-amber-900 tracking-tight leading-tight">
                        Feriado: {getHolidayForDay(selectedDay)!.name}
                    </h4>
                    <p className="text-amber-700/70 text-xs font-medium mt-2">Não há atividades letivas programadas para esta data.</p>
                  </div>
               </div>
            )}

            {groupedSchedules.length > 0 ? (
              groupedSchedules.map((group, idx) => (
                <div key={group.turnoKey}
                  className="animate-in fade-in slide-in-from-right-4 duration-300"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-center gap-1.5 mb-2 mt-1 px-1">
                    <div className={clsx("w-1 h-5 rounded-full", group.turnoKey === 'matutino' ? 'bg-blue-500' : group.turnoKey === 'vespertino' ? 'bg-orange-500' : 'bg-purple-500')}></div>
                    <span className={clsx("font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest", viewMode === 'spacious' ? 'text-sm' : 'text-xs')}>{group.turnoLabel}</span>
                  </div>
                  <div className={clsx("grid gap-3", rm.gridCols)}>
                    {group.schedules.map((item) => {
                      const turno = getTurnoMeta(item.startTime);
                      return (
                        <div key={item.id} className="group relative">
                          <div className={clsx(
                            "rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden h-full flex flex-col",
                            "hover:border-primary/20",
                            rm.cardPadding
                          )}>
                            <div className={clsx("absolute top-0 left-0 w-1 h-full", turno.bg.includes('blue') ? 'bg-blue-500' : turno.bg.includes('orange') ? 'bg-orange-500' : 'bg-purple-500')}></div>

                            <div className="flex items-center justify-between mb-2 gap-2">
                              <span className={clsx("font-black whitespace-nowrap", rm.timeText, turno.text)}>
                                {format(item.startTime.toDate(), 'HH:mm')} - {format(item.endTime.toDate(), 'HH:mm')}
                              </span>
                              <Badge className={clsx("shadow-none border-none px-1.5 py-0 font-bold uppercase leading-none truncate", rm.badgeText, rm.badgeHeight, turno.bg, turno.text)}>
                                {item.className} ({getShiftAbbreviation(getHours(item.startTime.toDate()))})
                              </Badge>
                            </div>

                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0 bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-1 rounded border border-indigo-100/50 dark:border-indigo-800/30">
                                  <MapPin className={clsx("text-indigo-600 dark:text-indigo-400 shrink-0", rm.iconSize)} />
                                  <span className={clsx("font-black text-indigo-900 dark:text-indigo-100 truncate uppercase tracking-tight", rm.roomText)}>{item.roomName}</span>
                                </div>

                                <div className="flex items-center gap-2 min-w-0">
                                  <User className={clsx("text-muted-foreground shrink-0", rm.iconSizeSmall)} />
                                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    <span className={clsx("font-semibold text-gray-700 dark:text-gray-300 truncate", rm.teacherText)}>{formatDisplayName(item.teacherName)}</span>
                                    {item.isSubstitution && (
                                      <span className={clsx("font-bold text-amber-600 bg-amber-50 px-1 rounded-sm shrink-0", rm.substText)}>S</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 min-w-0 border-t border-gray-100 dark:border-gray-800/40 pt-1.5 mt-0.5">
                                  <BookOpen className={clsx("text-muted-foreground shrink-0", rm.iconSizeSmall)} />
                                  <span className={clsx("font-medium text-gray-500 dark:text-gray-400 truncate line-clamp-1", rm.unitText)} title={item.unitName}>
                                    {item.unitName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 min-w-0">
                                  <GraduationCap className={clsx("text-muted-foreground shrink-0", rm.iconSizeSmall)} />
                                  <span className={clsx("font-medium text-gray-400 dark:text-gray-500 truncate line-clamp-1", rm.courseText)} title={item.courseName}>
                                    {item.courseName}
                                  </span>
                                </div>

                                {item.observation && (
                                  <div className={clsx("mt-auto pt-2 italic text-gray-400 truncate flex items-start gap-1.5", rm.obsText)}>
                                    <Info className="h-3 w-3 shrink-0 mt-0.5" />
                                    <span className="truncate">{item.observation}</span>
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 border border-gray-200 dark:border-gray-800">
                  <Calendar className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Sem agendamentos</h4>
                <p className="text-sm text-muted-foreground">Não há alocações registradas para este dia.</p>
              </div>
            )}
          </div>
        </aside>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.4);
        }
      `}</style>
    </div>
  );
}


