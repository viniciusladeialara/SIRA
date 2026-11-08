/**
 * @file ScheduleModule.tsx
 * @description Componente principal para a gestão de agendamentos.
 * Exibe uma grade de horários semanal agrupada por blocos de ambientes, com cabeçalho fixo e conteúdo rolável.
 * Permite a criação de alocações complexas através de um modal avançado que se comunica
 * com uma Cloud Function segura no backend.
 */

// --- IMPORTAÇÕES ---
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Timestamp, doc, onSnapshot } from "@/lib/sira-sql-adapter";
import { db } from "@/lib/db";
import { startOfWeek, endOfWeek, format, eachDayOfInterval, isSameDay, getHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toSafeDate, toSafeMillis } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { useFirestoreCache } from "@/hooks/useCache";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { logAction, AuditAction } from "@/lib/AuditLog";
import { subscribeToSchedules, deleteSchedule } from "@/services/scheduleService";
import { fetchClasses, fetchRooms, fetchTeachers, subscribeToHolidays, createHoliday, deleteHoliday as deleteHolidaySvc } from "@/services/dataService";
import { ScheduleGrid } from "@/components/schedules/ScheduleGrid";
import { ScheduleCreationModal } from "@/components/schedules/ScheduleCreationModal";
import { ScheduleFilters } from "@/components/schedules/ScheduleFilters";
import { ScheduleEditDialog } from "@/components/schedules/ScheduleEditDialog";
import { ScheduleCopyWeekModal } from "@/components/schedules/ScheduleCopyWeekModal";
import { downloadIcsFile } from "@/lib/calendarExport";
import { usePermissions } from "@/hooks/usePermissions";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";

// --- TIPAGEM ---
interface Schedule {
    id: string;
    className: string;
    roomName: string;
    teacherName: string;
    startTime: Timestamp;
    endTime: Timestamp;
    roomId: string;
    teacherId: string;
    classId: string;
    observation?: string;
    scheduleStatus?: string;
}
interface Class { id: string; name: string; teacherIds: string[]; teacherNames: string[]; period: string; courseId?: string; courseName?: string; }
interface Room { id: string; name: string; block: string; floor: string; type: string; capacity: number; }
interface Teacher { id: string; name: string; }
interface Holiday { id: string; date: Timestamp; name: string; }

// --- CONSTANTES E HELPERS ---
const turnoColors = {
  matutino: { bg: "bg-blue-100", border: "border-blue-500", text: "text-blue-800" },
  vespertino: { bg: "bg-orange-100", border: "border-orange-500", text: "text-orange-800" },
  noturno: { bg: "bg-purple-100", border: "border-purple-500", text: "text-purple-800" },
};

// --- COMPONENTE PRINCIPAL ---
export function ScheduleModule() {
  // --- ESTADOS DO COMPONENTE ---
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { cacheQuery } = useFirestoreCache();
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTurno, setActiveTurno] = useState('todos');
  const [selectedRoomId, setSelectedRoomId] = useState('todos');

  // Estados para os dados gerais
  const [classes, setClasses] = useState<Class[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessingHoliday, setIsProcessingHoliday] = useState(false);
  
  const { userRole, userData } = usePermissions();
  const [selectedScheduleForEdit, setSelectedScheduleForEdit] = useState<Schedule | null>(null);
  const [isCopyWeekOpen, setIsCopyWeekOpen] = useState(false);

  // --- PROCESSAMENTO DE DADOS (useMemo) ---
  const groupedRooms = useMemo(() => {
    const filteredRooms = selectedRoomId === 'todos' 
      ? rooms 
      : rooms.filter(r => r.id === selectedRoomId);

    const groups = filteredRooms.reduce((acc, room) => {
      const block = room.block || 'Geral';
      (acc[block] = acc[block] || []).push(room);
      return acc;
    }, {} as Record<string, Room[]>);
    Object.keys(groups).forEach(block => {
      groups[block].sort((a, b) => a.name.localeCompare(b.name));
    });
    return Object.fromEntries(Object.entries(groups).sort(([blockA], [blockB]) => blockA.localeCompare(blockB)));
  }, [rooms, selectedRoomId]);

  const availableBlocks = useMemo(() => {
    const blockSet = new Set<string>();
    rooms.forEach(room => {
      if (room.block) blockSet.add(room.block);
    });
    return Array.from(blockSet).sort();
  }, [rooms]);

  // --- BUSCA DE DADOS (VIA SERVIÇOS E CACHE) ---
  const selectedUnitId = userData?.selectedUnitId || "caceres";

  const [unitMetadata, setUnitMetadata] = useState<any>(null);

  // Escuta os metadados da unidade selecionada
  useEffect(() => {
    if (!selectedUnitId) return;
    const unsub = onSnapshot(doc(db, "units", selectedUnitId), (docSnap) => {
      if (docSnap.exists()) {
        setUnitMetadata(docSnap.data().metadata || {});
      }
    }, (error) => {
      console.error("Erro ao obter metadados da unidade:", error);
    });
    return () => unsub();
  }, [selectedUnitId]);

  const getShiftOrder = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("matutino") || lower.includes("morning")) return 1;
    if (lower.includes("vespertino") || lower.includes("afternoon")) return 2;
    if (lower.includes("noturno") || lower.includes("night")) return 3;
    return 4;
  };

  const shiftsList = useMemo(() => {
    const rawShifts: string[] = unitMetadata?.shifts || ["Matutino", "Vespertino", "Noturno"];
    return [...rawShifts].sort((a, b) => getShiftOrder(a) - getShiftOrder(b));
  }, [unitMetadata]);

  const getShiftColors = useCallback((shiftName: string) => {
    const s = shiftName.toLowerCase();
    if (s.includes("matutino") || s.includes("morning")) return turnoColors.matutino;
    if (s.includes("vespertino") || s.includes("afternoon")) return turnoColors.vespertino;
    if (s.includes("noturno") || s.includes("night")) return turnoColors.noturno;
    return { bg: "bg-slate-100", border: "border-slate-500", text: "text-slate-800" };
  }, []);

  const getTurnoAndColor = useCallback((startTime: any) => {
    const d = toSafeDate(startTime);
    const hour = getHours(d);
    let defaultShift = 'noturno';
    if (hour >= 7 && hour < 12) defaultShift = 'matutino';
    else if (hour >= 13 && hour < 18) defaultShift = 'vespertino';

    const matched = shiftsList.find(s => s.toLowerCase().includes(defaultShift));
    const name = matched ? matched.toLowerCase() : (shiftsList[0]?.toLowerCase() || defaultShift);

    return { name, colors: getShiftColors(name) };
  }, [shiftsList, getShiftColors]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classesData, roomsData, teachersData] = await Promise.all([
          cacheQuery(`classes_${selectedUnitId}`, () => fetchClasses(selectedUnitId)),
          cacheQuery(`rooms_${selectedUnitId}`, () => fetchRooms(selectedUnitId)),
          cacheQuery(`teachers_${selectedUnitId}`, () => fetchTeachers(selectedUnitId))
        ]);
        setClasses(classesData as Class[]);
        // Filtrar apenas ambientes disponíveis para a grade e seleções
        const availableRooms = (roomsData as any[]).filter(r => r.available !== false);
        setRooms(availableRooms as Room[]);
        setTeachers(teachersData as Teacher[]);
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
      }
    };
    fetchData();

    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });

    const unsubscribeSchedules = subscribeToSchedules(start, end, (data) => {
      const filtered = data.filter((s: any) => s.unitId === selectedUnitId);
      setSchedules(filtered as any as Schedule[]);
    });

    const unsubscribeHolidays = subscribeToHolidays((data) => {
      setHolidays(data as Holiday[]);
    });

    return () => { unsubscribeSchedules(); unsubscribeHolidays(); };
  }, [currentDate, selectedUnitId]);

  // --- FUNÇÕES DE LÓGICA (HANDLERS) ---
  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta alocação?")) return;
    setIsDeleting(true);
    try {
      // Buscar dados antes de excluir para o log
      const scheduleToDelete = schedules.find(s => s.id === id);
      
      await deleteSchedule(id);

      if (currentUser && scheduleToDelete) {
        await logAction(
          AuditAction.DELETE_SCHEDULE,
          currentUser as any,
          `Excluída alocação: ${scheduleToDelete.className} em ${scheduleToDelete.roomName} (${scheduleToDelete.teacherName})`,
          { scheduleId: id, scheduleData: scheduleToDelete }
        );
      }

      toast({ title: "Sucesso", description: "Alocação excluída." });
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      toast({ title: "Erro", description: "Não foi possível excluir a alocação.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddHoliday = async (day: Date) => {
    const holidayName = prompt("Insira o nome do feriado:");
    if (holidayName) {
      setIsProcessingHoliday(true);
      try {
        await createHoliday(holidayName, day);
      } finally {
        setIsProcessingHoliday(false);
      }
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (window.confirm("Remover este feriado?")) {
      setIsProcessingHoliday(true);
      try {
        await deleteHolidaySvc(id);
      } finally {
        setIsProcessingHoliday(false);
      }
    }
  };

  // --- LÓGICA DE RENDERIZAÇÃO AUXILIAR ---
  const weekDays = eachDayOfInterval({ 
    start: startOfWeek(currentDate, { weekStartsOn: 1 }), 
    end: endOfWeek(currentDate, { weekStartsOn: 1 }) 
  }).slice(0, 5);

  const getSchedulesForRoomAndDay = (roomId: string, day: Date) => {
    return schedules.filter(s => s.roomId === roomId && isSameDay(toSafeDate(s.startTime), day))
      .filter(item => activeTurno === 'todos' || getTurnoAndColor(item.startTime).name === activeTurno)
      .sort((a, b) => {
        const aTime = toSafeMillis(a.startTime);
        const bTime = toSafeMillis(b.startTime);
        return aTime - bTime;
      });
  };

  const getHolidayForDay = (day: Date) => holidays.find(h => isSameDay(toSafeDate(h.date), day));

  // --- MÉTRICAS DE OCUPAÇÃO DA SEMANA (A08) ---
  const occupancyStats = useMemo(() => {
    if (rooms.length === 0) return { rate: 0, occupiedCount: 0, totalCount: 0 };
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const weekSchedules = schedules.filter(s => {
      const sDate = toSafeDate(s.startTime);
      const inWeek = sDate >= weekStart && sDate <= weekEnd;
      if (!inWeek) return false;
      if (activeTurno === 'todos') return true;
      return getTurnoAndColor(s.startTime).name === activeTurno;
    });

    const occupiedRoomIds = new Set(weekSchedules.map(s => s.roomId));
    const rate = Math.round((occupiedRoomIds.size / rooms.length) * 100);
    return {
      rate,
      occupiedCount: occupiedRoomIds.size,
      totalCount: rooms.length
    };
  }, [rooms, schedules, currentDate, activeTurno]);

  const handleExportWeekIcs = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const weekSchedules = schedules.filter(s => {
      const sDate = toSafeDate(s.startTime);
      return sDate >= weekStart && sDate <= weekEnd;
    });
    if (weekSchedules.length === 0) {
      toast({
        title: "Nenhum agendamento",
        description: "Não há aulas agendadas nesta semana para exportar.",
        variant: "destructive"
      });
      return;
    }
    downloadIcsFile(
      weekSchedules as any,
      `grade_semana_${format(weekStart, 'yyyy_MM_dd')}.ics`,
      `Grade SENAI - Semana ${format(weekStart, 'dd/MM')}`
    );
    toast({
      title: "Arquivo .ics Gerado",
      description: `${weekSchedules.length} aulas exportadas com sucesso!`,
    });
  };

  const creationModal = (
    <ScheduleCreationModal
      classes={classes}
      teachers={teachers}
      rooms={rooms}
      availableBlocks={availableBlocks}
      schedules={schedules}
      shifts={shiftsList}
      holidays={holidays}
    />
  );

  // --- RENDERIZAÇÃO PRINCIPAL (JSX) ---
  return (
    <PageLayout className="bg-white dark:bg-gray-950">
      <PageHeader className="pb-0">
        <ScheduleFilters 
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          activeTurno={activeTurno}
          setActiveTurno={setActiveTurno}
          isProcessing={isDeleting || isProcessingHoliday}
          creationModal={creationModal}
          rooms={rooms}
          selectedRoom={selectedRoomId}
          setSelectedRoom={setSelectedRoomId}
          isAdmin={userRole === 'ADMIN'}
          shifts={shiftsList}
          onCopyWeek={() => setIsCopyWeekOpen(true)}
          onExportWeekIcs={handleExportWeekIcs}
          occupancyStats={occupancyStats}
        />
      </PageHeader>
      
      <PageContent className="pt-4 flex">
        <div className="flex-1 min-h-0 overflow-auto border rounded-lg shadow-sm bg-white dark:bg-gray-900">
          <ScheduleGrid
            groupedRooms={groupedRooms}
            weekDays={weekDays}
            getHolidayForDay={getHolidayForDay}
            handleAddHoliday={handleAddHoliday}
            handleDeleteHoliday={handleDeleteHoliday}
            getSchedulesForRoomAndDay={getSchedulesForRoomAndDay}
            getTurnoAndColor={getTurnoAndColor as any}
            handleDeleteSchedule={handleDeleteSchedule}
            onEditSchedule={(s) => setSelectedScheduleForEdit(s as any)}
            userRole={userRole || undefined}
            teacherId={userData?.teacherId || undefined}
            shifts={shiftsList}
          />
        </div>
      </PageContent>

      <ScheduleEditDialog 
        schedule={selectedScheduleForEdit as any}
        open={!!selectedScheduleForEdit}
        onOpenChange={(open) => !open && setSelectedScheduleForEdit(null)}
        classes={classes}
        teachers={teachers}
        rooms={rooms}
        schedules={schedules}
      />

      <ScheduleCopyWeekModal
        isOpen={isCopyWeekOpen}
        onClose={() => setIsCopyWeekOpen(false)}
        currentDate={currentDate}
        schedules={schedules}
        holidays={holidays}
        selectedUnitId={selectedUnitId}
      />
    </PageLayout>
  );
}