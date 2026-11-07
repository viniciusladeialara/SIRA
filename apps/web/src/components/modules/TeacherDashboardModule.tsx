import { useEffect, useState, useCallback, useMemo } from "react";
import { format, isSameDay, isToday, isTomorrow, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone, getHoursInTimeZone } from "@/lib/date-utils";

import { useFirestoreCache } from "@/hooks/useCache";
import { fetchTeacherSchedules, Schedule } from "@/services/reservationService";
import { subscribeToSchedules } from "@/services/scheduleService";
import { fetchRooms, subscribeToHolidays } from "@/services/dataService";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, updateDoc, Timestamp, query, where, onSnapshot } from "firebase/firestore";
import { usePermissions } from "@/hooks/usePermissions";
import { useSystemConfig } from "@/hooks/useSystemConfig";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Loader, Calendar, Plus, Clock, MapPin, ArrowRightLeft, AlertTriangle, BookOpen, CalendarRange, FileText, ExternalLink, CheckCircle2, ClipboardCheck, Power, Lightbulb, MonitorUp, LayoutPanelTop, Bell, Check, X, MessageCircle, Send, Pencil, Settings, ShieldCheck, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { ForcePasswordChange } from "@/components/teacher/ForcePasswordChange";
import { RoomReservationModal } from "@/components/rooms/RoomReservationModal";
import { RoomInspectionModal } from "@/components/rooms/RoomInspectionModal";
import { SwapRequestModal } from "@/components/swaps/SwapRequestModal";
import { ScheduleGrid } from "@/components/schedules/ScheduleGrid";
import { getIncomingSwapRequests, respondToSwapRequest } from "@/services/swapService";
import { useToast } from "@/components/ui/use-toast";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { generateGoogleCalendarUrl, downloadIcsFile } from "@/lib/calendarExport";

interface Room {
    id: string;
    name: string;
    block: string;
    floor: string;
    type: string;
    capacity: number;
    resources?: string[];
}

interface Holiday {
    id: string;
    date: { toDate: () => Date };
    name: string;
}

interface TeacherDashboardModuleProps {
    initialSection?: "scheduling" | "my-schedules";
}

const turnoColors = {
    matutino: { bg: "bg-blue-100", border: "border-blue-500", text: "text-blue-800" },
    vespertino: { bg: "bg-orange-100", border: "border-orange-500", text: "text-orange-800" },
    noturno: { bg: "bg-purple-100", border: "border-purple-500", text: "text-purple-800" },
};

const getTurnoAndColor = (startTime: Schedule["startTime"]) => {
    const hour = getHoursInTimeZone(startTime.toDate());
    if (hour >= 7 && hour < 13) return { name: "matutino", colors: turnoColors.matutino };
    if (hour >= 13 && hour < 18) return { name: "vespertino", colors: turnoColors.vespertino };
    return { name: "noturno", colors: turnoColors.noturno };
};

const getScheduleDayLabel = (date: Date) => {
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanha";
    return formatInTimeZone(date, "EEEE, dd/MM");
};

export function TeacherDashboardModule({ initialSection = "scheduling" }: TeacherDashboardModuleProps) {
    const { currentUser } = useAuth();
    const { userRole, userData, isProfessor, isUserAdmin } = usePermissions();
    const { config: systemConfig, updateConfig } = useSystemConfig();
    const { cacheQuery } = useFirestoreCache();

    const portalDocenteLink = systemConfig?.portalDocenteLink || 'http://educacional.sesisenaimt.ind.br:8081/FrameHTML/web/app/Edu/PortalDoProfessor/#/login';
    const portalDocenteLabel = systemConfig?.portalDocenteLabel || 'Portal Docente';
    const meuSenaiLink = systemConfig?.meuSenaiLink || 'https://identidade.senai.br/authenticationendpoint/login.do?RelayState=https%3A%2F%2Fmeusenai.senai.br%2F&commonAuthCallerPath=%2Fsamlsso&forceAuth=false&passiveAuth=false&tenantDomain=carbon.super&sessionDataKey=51179269-6e9a-4ef6-9f36-043326f53f60&relyingParty=https%3A%2F%2Fmeusenai.senai.br&type=samlsso&sp=meusenai.senai.br&isSaaSApp=false&authenticators=BasicAuthenticator%3ALOCAL';
    const meuSenaiLabel = systemConfig?.meuSenaiLabel || 'Meu SENAI';
    const pesquisaSensorialLink = systemConfig?.pesquisaSensorialLink || 'https://script.google.com/macros/s/AKfycbzuZ6Eq9r0KfITKTgkJGgmiOYYuQ6IUkI90FgfCTMQv5FgDp6l7xz37X8B-vWoYlZKn/exec';
    const pesquisaSensorialLabel = systemConfig?.pesquisaSensorialLabel || 'Pesquisa Sensorial';
    const gradePublicaLink = systemConfig?.gradePublicaLink || '/public-view';
    const gradePublicaLabel = systemConfig?.gradePublicaLabel || 'Grade Pública';

    const [isEditLinksOpen, setIsEditLinksOpen] = useState(false);
    const [tempLinks, setTempLinks] = useState({
        portalDocenteLink: '',
        portalDocenteLabel: '',
        meuSenaiLink: '',
        meuSenaiLabel: '',
        pesquisaSensorialLink: '',
        pesquisaSensorialLabel: '',
        gradePublicaLink: '',
        gradePublicaLabel: '',
    });
    const [isSavingLinks, setIsSavingLinks] = useState(false);

    const handleOpenEditLinks = () => {
        setTempLinks({
            portalDocenteLink,
            portalDocenteLabel,
            meuSenaiLink,
            meuSenaiLabel,
            pesquisaSensorialLink,
            pesquisaSensorialLabel,
            gradePublicaLink,
            gradePublicaLabel,
        });
        setIsEditLinksOpen(true);
    };

    const handleSaveTempLinks = async () => {
        const validateUrl = (url: string) => {
            if (!url) return false;
            return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
        };

        if (
            !validateUrl(tempLinks.portalDocenteLink) ||
            !validateUrl(tempLinks.meuSenaiLink) ||
            !validateUrl(tempLinks.pesquisaSensorialLink) ||
            !validateUrl(tempLinks.gradePublicaLink)
        ) {
            toast({
                title: "Erro de Validação",
                description: "Todas as URLs de destino devem começar com http://, https:// ou / para garantir a segurança do sistema.",
                variant: "destructive"
            });
            return;
        }

        setIsSavingLinks(true);
        try {
            await updateConfig(tempLinks, currentUser?.uid);
            toast({
                title: "Sucesso",
                description: "Links rápidos atualizados com sucesso!",
            });
            setIsEditLinksOpen(false);
        } catch (error) {
            console.error("Erro ao salvar links:", error);
            toast({
                title: "Erro",
                description: "Falha ao salvar links do painel.",
                variant: "destructive"
            });
        } finally {
            setIsSavingLinks(false);
        }
    };

    const [teacher, setTeacher] = useState<any>(null);
    const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [weeklySchedules, setWeeklySchedules] = useState<any[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeTurno, setActiveTurno] = useState("todos");
    const [selectedRoomId, setSelectedRoomId] = useState("todos");
    const [activeSection, setActiveSection] = useState<string>(initialSection);
    const [loadingContext, setLoadingContext] = useState(true);
    const [isLoadingTeacher, setIsLoadingTeacher] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const [availableRooms, setAvailableRooms] = useState<{ id: string; name: string }[]>([]);
    const [teacherClasses, setTeacherClasses] = useState<{ id: string; name: string }[]>([]);

    const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
    const [inspectionType, setInspectionType] = useState<"CHECK_IN" | "CHECK_OUT">("CHECK_IN");
    const [incomingSwaps, setIncomingSwaps] = useState<any[]>([]);
    const { toast } = useToast();

    const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
    const [prefilledReservation, setPrefilledReservation] = useState<{
        roomId?: string;
        date?: string;
        startTime?: string;
        endTime?: string;
    } | null>(null);

    useEffect(() => {
        setActiveSection(initialSection);
    }, [initialSection]);

    useEffect(() => {
        const loadTeacherData = async () => {
            if (!currentUser) {
                setIsLoadingTeacher(false);
                return;
            }

            // Se for ADMIN ou USER, carregar lista de professores e permitir selecionar
            const isOp = ["ADMIN", "USER"].includes(userRole || "");

            try {
                if (isOp) {
                    const teachersCol = collection(db, "teachers");
                    const snapshot = await getDocs(teachersCol);
                    const teachersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setTeachers(teachersList as any[]);

                    // Se houver um professor selecionado (via preview), carregar ele
                    if (selectedTeacherId) {
                        const t = teachersList.find(t => t.id === selectedTeacherId);
                        setTeacher(t);
                    } else {
                        setTeacher(null); // Resetar se nenhum selecionado
                    }
                } else {
                    // Comportamento para professor logado: usar teacherId do metadado do usuario se disponivel
                    const tId = userData?.teacherId || currentUser.uid;
                    let activeTeacherDoc: any = null;
                    const teacherDoc = await getDoc(doc(db, "teachers", tId));
                    if (teacherDoc.exists()) {
                        activeTeacherDoc = { id: teacherDoc.id, ...teacherDoc.data() };
                        setTeacher(activeTeacherDoc);
                    } else {
                        // Fallback 1: Se o tId falhou e era diferente do UID, tenta o UID
                        if (tId !== currentUser.uid) {
                            const fallbackDoc = await getDoc(doc(db, "teachers", currentUser.uid));
                            if (fallbackDoc.exists()) {
                                activeTeacherDoc = { id: fallbackDoc.id, ...fallbackDoc.data() };
                                setTeacher(activeTeacherDoc);
                            }
                        }
                        
                        // Fallback 2: Tenta buscar pelo EMAIL (crucial para migracoes/legado)
                        if (!activeTeacherDoc && currentUser.email) {
                            const q = query(collection(db, "teachers"), where("email", "==", currentUser.email.toLowerCase()));
                            const emailSnap = await getDocs(q);
                            if (!emailSnap.empty) {
                                const found = emailSnap.docs[0];
                                activeTeacherDoc = { id: found.id, ...found.data() };
                                setTeacher(activeTeacherDoc);
                                console.log("Professor encontrado por email:", found.id);
                            } else {
                                console.warn("Professor não encontrado no banco de dados para o email:", currentUser.email);
                            }
                        }
                    }

                    // Carrega solicitações de troca para todos os IDs candidatos possíveis
                    const candidateIds = Array.from(new Set([
                        currentUser.uid,
                        tId,
                        activeTeacherDoc?.id,
                        userData?.teacherId
                    ].filter(Boolean) as string[]));

                    if (candidateIds.length > 0) {
                        const swaps = await getIncomingSwapRequests(candidateIds);
                        setIncomingSwaps(swaps);
                    }
                }
            } catch (error) {
                console.error("Error loading teacher/admin data:", error);
            } finally {
                setIsLoadingTeacher(false);
            }
        };

        loadTeacherData();
    }, [currentUser, userRole, selectedTeacherId, userData?.teacherId]);

    useEffect(() => {
        const fetchDependencies = async () => {
            if (!teacher?.id) return;
            try {
                const targetUnitId = (teacher as any)?.unitId || userData?.selectedUnitId;
                const [roomsData, classSnapshot] = await Promise.all([
                    fetchRooms(targetUnitId),
                    getDocs(query(collection(db, "classes"), where("teacherIds", "array-contains", teacher.id)))
                ]);

                setRooms((roomsData as Room[]).filter(r => (r as any).available !== false));
                setAvailableRooms(
                    (roomsData as Room[])
                        .filter(r => (r as any).available !== false)
                        .map((room) => ({
                            id: room.id,
                            name: room.name,
                        }))
                );

                const classes = classSnapshot.docs.map((classDoc) => {
                    const data = classDoc.data();
                    return {
                        id: classDoc.id,
                        name: data.name || data.code,
                        courseName: data.courseName || data.courseId || "Sem Curso",
                        unitName: data.unitName || data.escolaNome || "Unidade N/A",
                    };
                });
                setTeacherClasses(classes);
            } catch (error) {
                console.error("Error fetching dependencies", error);
            }
        };
        fetchDependencies();
    }, [teacher?.id, (teacher as any)?.unitId, userData?.selectedUnitId]);

    const loadSchedules = useCallback(async () => {
        if (!teacher?.id) return;
        setLoadingContext(true);
        const key = `teacher_workspace_${teacher.id}_${format(currentMonth, "yyyy_MM")}`;
        try {
            const data = await cacheQuery(
                key,
                () => fetchTeacherSchedules(teacher.id, currentMonth),
                { id: teacher.id, month: currentMonth.toISOString() },
                5 * 60 * 1000
            );
            setSchedules(data as Schedule[]);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingContext(false);
        }
    }, [teacher?.id, currentMonth, cacheQuery]);

    useEffect(() => {
        if (teacher?.id) {
            loadSchedules();
        }
    }, [teacher?.id, currentMonth, loadSchedules]);

    useEffect(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        const targetUnitId = (teacher as any)?.unitId || userData?.selectedUnitId;

        const unsubscribeSchedules = subscribeToSchedules(start, end, (data) => {
            const filtered = targetUnitId
                ? data.filter(s => (s.unitId || "caceres") === targetUnitId)
                : data;
            setWeeklySchedules(filtered as Schedule[]);
        });

        const unsubscribeHolidays = subscribeToHolidays((data) => {
            setHolidays(data as Holiday[]);
        });

        return () => {
            unsubscribeSchedules();
            unsubscribeHolidays();
        };
    }, [currentDate, (teacher as any)?.unitId, userData?.selectedUnitId]);

    const groupedRooms = useMemo(() => {
        const filteredRooms = selectedRoomId === "todos"
            ? rooms
            : rooms.filter(r => r.id === selectedRoomId);

        const groups = filteredRooms.reduce((acc, room) => {
            const block = room.block || "Geral";
            (acc[block] = acc[block] || []).push(room);
            return acc;
        }, {} as Record<string, Room[]>);

        Object.keys(groups).forEach((block) => {
            groups[block].sort((a, b) => a.name.localeCompare(b.name));
        });

        return Object.fromEntries(
            Object.entries(groups).sort(([blockA], [blockB]) => blockA.localeCompare(blockB))
        );
    }, [rooms, selectedRoomId]);

    const weekDays = useMemo(() => eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
    }).slice(0, 5), [currentDate]);

    const getSchedulesForRoomAndDay = useCallback((roomId: string, day: Date) => {
        return weeklySchedules
            .filter((schedule) => schedule.roomId === roomId && isSameDay(schedule.startTime.toDate(), day))
            .filter((schedule) => activeTurno === "todos" || getTurnoAndColor(schedule.startTime).name === activeTurno)
            .sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
    }, [weeklySchedules, activeTurno]);

    const getHolidayForDay = useCallback((day: Date) => {
        return holidays.find((holiday) => isSameDay(holiday.date.toDate(), day));
    }, [holidays]);

    const openReserveModal = useCallback((roomId?: string, date?: Date, startTime?: string, endTime?: string) => {
        setPrefilledReservation({
            roomId,
            date: date ? formatInTimeZone(date, "yyyy-MM-dd") : undefined,
            startTime,
            endTime,
        });
        setIsReserveModalOpen(true);
    }, []);

    const openInspection = useCallback((schedule: Schedule, type: "CHECK_IN" | "CHECK_OUT" = "CHECK_IN") => {
        setSelectedSchedule(schedule);
        setInspectionType(type);
        setIsInspectionModalOpen(true);
    }, []);

    const handleSwapResponse = async (swapId: string, status: "accepted" | "rejected") => {
        setIsProcessing(true);
        try {
            await respondToSwapRequest(swapId, status);
            setIncomingSwaps(prev => prev.filter(s => s.id !== swapId));
            toast({
                title: status === "accepted" ? "Troca Aceita!" : "Troca Recusada",
                description: status === "accepted" ? "Os agendamentos foram atualizados." : "A solicitação foi removida.",
            });
            // Recarregar dados para refletir mudanças nos agendamentos
            loadSchedules();
            // Também recarregar o weekly schedules (teria que ser disparado via sub, mas forçamos recarga de contexto se necessário)
            window.location.reload(); // Simplificando para garantir integridade total da view após swap
        } catch (error: any) {
            console.error("Erro ao responder troca:", error);
            toast({ 
                title: "Erro ao processar troca", 
                description: error?.message || "Não foi possível concluir a resposta da troca. Tente novamente.", 
                variant: "destructive" 
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const sortedSchedules = useMemo(() => {
        const now = new Date();
        return [...schedules].map(s => {
            const isFinished = now > s.endTime.toDate();
            // Se já passou do horário, o status derivado é 'concluida'
            // mas mantemos o status do banco se ele for explicitamente definido
            const derivedStatus = isFinished ? 'concluida' : (s.status || 'pendente');
            return { ...s, derivedStatus };
        }).sort((a, b) => a.startTime.toDate().getTime() - b.startTime.toDate().getTime());
    }, [schedules]);

    const nextSchedules = useMemo(() => {
        const pending = sortedSchedules.filter(s => s.derivedStatus === 'pendente');
        const finished = sortedSchedules.filter(s => s.derivedStatus === 'concluida');
        return { pending, finished };
    }, [sortedSchedules]);

    const todaySchedules = useMemo(() => {
        return sortedSchedules.filter((schedule) => isToday(schedule.startTime.toDate()));
    }, [sortedSchedules]);

    if (isLoadingTeacher) {
        return <div className="flex justify-center p-8"><Loader className="w-8 h-8 animate-spin text-gray-400" /></div>;
    }

    if (!teacher) {
        if (["ADMIN", "USER"].includes(userRole || "")) {
            return (
                <div className="p-8 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Modo de Visualização Admin</CardTitle>
                            <CardDescription>Selecione um professor para visualizar sua grade e horários.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                                <SelectTrigger className="w-full md:w-[300px]">
                                    <SelectValue placeholder="Selecione um professor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {teachers.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return (
            <div className="flex justify-center p-8 text-red-500">
                Perfil de professor nao encontrado. Por favor, contate a administracao.
            </div>
        );
    }

    if (teacher.mustChangePassword) {
        return <ForcePasswordChange teacherId={teacher.id} onSuccess={() => window.location.reload()} />;
    }

    const selectedScheduleIsMine = selectedSchedule?.teacherId === teacher.id;
    const renderScheduleCard = (schedule: any) => {
        const start = schedule.startTime.toDate();
        const end = schedule.endTime.toDate();
        const isConflict = schedule.scheduleStatus === 'conflict_flagged';
        return (
            <div
                key={schedule.id}
                className="text-left w-full"
            >
                <Card className={`h-full border-l-4 ${
                    isConflict ? 'border-l-orange-500 bg-orange-50/20' :
                    schedule.derivedStatus === 'concluida' ? 'border-l-green-500' : 'border-l-blue-500'
                } shadow-sm hover:shadow-md transition-shadow group`}>
                    <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">{getScheduleDayLabel(start)}</p>
                                    <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${getTurnoAndColor(schedule.startTime).colors.bg} ${getTurnoAndColor(schedule.startTime).colors.text} border-0 capitalize`}>
                                        {getTurnoAndColor(schedule.startTime).name}
                                    </Badge>
                                    {isConflict && (
                                        <Badge variant="destructive" className="bg-orange-600 text-white border-0 text-[9px] uppercase font-black animate-pulse">Conflito / Manutenção</Badge>
                                    )}
                                </div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{schedule.className || "Reserva avulsa"}</h3>
                                {schedule.courseName && (
                                    <p className="text-xs text-blue-600 font-medium line-clamp-1 mt-0.5">{schedule.courseName}</p>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-2 text-right shrink-0">
                                <div className="flex flex-wrap justify-end gap-1.5 sm:gap-2">
                                    <Badge variant="secondary" className="text-[10px] sm:text-xs font-mono">{formatInTimeZone(start, "HH:mm")} - {formatInTimeZone(end, "HH:mm")}</Badge>
                                    {schedule.derivedStatus === 'concluida' ? (
                                        <Badge className="bg-green-600 hover:bg-green-700 text-[10px] sm:text-xs">Concluída</Badge>
                                    ) : (
                                        <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 text-[10px] sm:text-xs">Pendente</Badge>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    {schedule.checkInCompleted && schedule.checkOutCompleted ? (
                                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-300 gap-1 text-[9px] sm:text-[10px] font-semibold">
                                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Vistoria Completa
                                        </Badge>
                                    ) : schedule.checkInCompleted ? (
                                        <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 gap-1 text-[9px] sm:text-[10px]">
                                            <ShieldCheck className="h-3 w-3 text-blue-600" /> Entrada OK
                                        </Badge>
                                    ) : isToday(start) ? (
                                        <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300 animate-pulse text-[9px] sm:text-[10px]">
                                            Vistoria Pendente
                                        </Badge>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] sm:text-sm text-slate-700 bg-slate-50/80 p-2 sm:p-3 rounded-lg border border-slate-100 shadow-inner group-hover:bg-white transition-colors">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                                <span className="font-medium truncate">{schedule.roomName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                                <span className="font-medium">{formatInTimeZone(start, "dd/MM/yy")}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 mt-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className={`flex-1 min-w-[110px] h-9 text-[11px] sm:text-xs gap-1.5 font-semibold shadow-sm transition-all ${
                                    schedule.checkInCompleted 
                                        ? "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100" 
                                        : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md border-blue-600"
                                }`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openInspection(schedule, "CHECK_IN");
                                }}
                            >
                                <ShieldCheck className="h-4 w-4 shrink-0" /> 
                                <span>{schedule.checkInCompleted ? "Entrada OK" : "Check-in"}</span>
                            </Button>

                            <Button
                                size="sm"
                                variant="outline"
                                className={`flex-1 min-w-[110px] h-9 text-[11px] sm:text-xs gap-1.5 font-semibold shadow-sm transition-all ${
                                    schedule.checkOutCompleted 
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100" 
                                        : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                                }`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openInspection(schedule, "CHECK_OUT");
                                }}
                            >
                                <Power className="h-4 w-4 shrink-0" /> 
                                <span>{schedule.checkOutCompleted ? "Saída OK" : "Check-out"}</span>
                            </Button>

                            <Button
                                size="sm"
                                variant="outline"
                                className="h-9 px-3.5 text-[11px] sm:text-xs gap-1.5 font-semibold text-indigo-700 bg-indigo-50/90 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 hover:text-indigo-800 transition-all shadow-sm shrink-0"
                                title="Solicitar troca de sala ou permuta de aula"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSchedule(schedule);
                                    setIsSwapModalOpen(true);
                                }}
                            >
                                <ArrowRightLeft className="h-4 w-4 text-indigo-600 shrink-0" />
                                <span>Troca de Sala</span>
                            </Button>
                        </div>
                        {schedule.observation && (
                            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                                <strong>Observação:</strong> {schedule.observation}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    };

    const todayStr = formatInTimeZone(new Date(), "EEEE");

    return (
        <PageLayout>
            <PageHeader className="space-y-4">
                <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md border-0">
                    <CardContent className="p-6 md:p-8 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-3xl font-bold mb-2">Olá, Professor(a) {teacher.name.split(" ")[0]}</h2>
                                {["ADMIN", "USER"].includes(userRole || "") && (
                                    <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                                        <SelectTrigger className="bg-white/10 border-white/20 text-white h-9 w-[200px]">
                                            <SelectValue placeholder="Trocar Professor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {teachers.map(t => (
                                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-blue-100 opacity-90">
                                <Calendar className="w-5 h-5" />
                                <p className="text-lg capitalize">Hoje: {todayStr}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 w-full xl:w-auto xl:justify-end items-center">
                            <Button
                                asChild
                                variant="secondary"
                                className="bg-white text-blue-700 hover:bg-white hover:text-blue-800 font-bold h-11 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] border-0"
                            >
                                <a href={portalDocenteLink} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    {portalDocenteLabel}
                                </a>
                            </Button>
                            <Button
                                asChild
                                variant="secondary"
                                className="bg-white text-blue-700 hover:bg-white hover:text-blue-800 font-bold h-11 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] border-0"
                            >
                                <a href={meuSenaiLink} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    {meuSenaiLabel}
                                </a>
                            </Button>
                            <Button
                                asChild
                                variant="secondary"
                                className="bg-white text-blue-700 hover:bg-white hover:text-blue-800 font-bold h-11 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] border-0"
                            >
                                <a href={pesquisaSensorialLink} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    {pesquisaSensorialLabel}
                                </a>
                            </Button>
                            <Button
                                asChild
                                variant="secondary"
                                className="bg-white text-blue-700 hover:bg-white hover:text-blue-800 font-bold h-11 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] border-0"
                            >
                                <a href={gradePublicaLink} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    {gradePublicaLabel}
                                </a>
                            </Button>
                            {isUserAdmin() && (
                                <Button
                                    onClick={handleOpenEditLinks}
                                    variant="secondary"
                                    className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold h-11 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] gap-2"
                                    title="Editar Links do Painel"
                                >
                                    <Pencil className="h-4 w-4" />
                                    Editar Links
                                </Button>
                            )}
                            {!isProfessor() && (
                                <Button
                                    size="lg"
                                    variant="secondary"
                                    onClick={() => openReserveModal()}
                                    className="gap-2 font-bold text-blue-700 bg-white hover:bg-white hover:text-blue-800 h-11 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] border-0"
                                >
                                    <Plus className="h-5 w-5" /> Reservar Sala
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {incomingSwaps.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                        <Card className="border-blue-200 bg-blue-50/50 shadow-sm overflow-hidden">
                            <div className="bg-blue-600 px-4 py-2 flex items-center justify-between text-white">
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                    <Bell className="h-4 w-4" />
                                    Solicitações de Troca Pendentes ({incomingSwaps.length})
                                </div>
                            </div>
                            <CardContent className="p-0">
                                <div className="divide-y divide-blue-100">
                                    {incomingSwaps.map((swap) => (
                                        <div key={swap.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-blue-100/30 transition-colors">
                                            <div className="space-y-2 flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-blue-900">
                                                        {swap.requesterTeacherName} deseja trocar de sala com você
                                                    </p>
                                                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                                                        Troca de Sala
                                                    </span>
                                                </div>
                                                <div className="text-xs text-blue-800 flex flex-wrap gap-x-4 gap-y-1 bg-white/70 p-2.5 rounded-lg border border-blue-100">
                                                    <span><strong>Aula do Colega:</strong> {swap.requesterSchedule?.className || "Aula"} (Sala atual: <strong className="text-blue-950">{swap.requesterSchedule?.roomName}</strong>)</span>
                                                    <span><strong>Sua Aula:</strong> {swap.targetSchedule?.className || "Sua aula"} (Sua sala atual: <strong className="text-blue-950">{swap.targetSchedule?.roomName}</strong>)</span>
                                                </div>
                                                {(swap.message || swap.justification) && (
                                                    <div className="text-xs bg-amber-50/90 border border-amber-200 rounded-lg p-2.5 text-amber-950 shadow-2xs">
                                                        <span className="font-bold text-amber-900 block mb-0.5">
                                                            💬 Justificativa informada pelo colega:
                                                        </span>
                                                        <p className="italic text-slate-700">{swap.message || swap.justification}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleSwapResponse(swap.id, "rejected")}
                                                    disabled={isProcessing}
                                                >
                                                    <X className="h-4 w-4 mr-1" /> {isProcessing ? "..." : "Recusar"}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                                                    onClick={() => handleSwapResponse(swap.id, "accepted")}
                                                    disabled={isProcessing}
                                                >
                                                    <Check className="h-4 w-4 mr-1" /> {isProcessing ? "Aguarde..." : "Aceitar Troca"}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Unified Navigation Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white/50 backdrop-blur-sm p-2 rounded-lg border shadow-sm">
                    <div className="flex bg-muted p-1 rounded-md shrink-0">
                        <Button
                            variant={(activeSection as string) === "scheduling" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setActiveSection("scheduling")}
                            className="h-8 gap-2"
                        >
                            <Calendar className="h-4 w-4" /> Grade Geral
                        </Button>
                        <Button
                            variant={(activeSection as string) === "my-schedules" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setActiveSection("my-schedules")}
                            className="h-8 gap-2"
                        >
                            <BookOpen className="h-4 w-4" /> Minhas Aulas (Micro)
                        </Button>
                    </div>

                    {activeSection === "scheduling" && (
                        <div className="flex items-center gap-2 w-full sm:w-64">
                            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                                <SelectTrigger className="w-full h-8 bg-white/80">
                                    <SelectValue placeholder="Filtrar por Ambiente" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos os Ambientes</SelectItem>
                                    {rooms.map(room => (
                                        <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </PageHeader>

            <PageContent className="flex flex-col gap-4">
                {activeSection === "scheduling" ?
                    <Card className="flex flex-1 min-h-0 flex-col overflow-hidden">
                        <CardHeader className="shrink-0 border-b bg-white">
                            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Calendar className="h-5 w-5" />
                                        Grade de Agendamentos
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Visualize a ocupação completa das salas e agendamentos da semana.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary" className="mr-2">
                                        {formatInTimeZone(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM")} - {formatInTimeZone(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM yyyy")}
                                    </Badge>
                                    <Button variant="outline" size="sm" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>Anterior</Button>
                                    <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
                                        disabled={isProfessor() && addWeeks(currentDate, 1) > addWeeks(new Date(), 2)}
                                    >
                                        Proxima
                                    </Button>
                                    <Tabs value={activeTurno} onValueChange={setActiveTurno} className="ml-2">
                                        <TabsList>
                                            <TabsTrigger value="todos">Todos</TabsTrigger>
                                            <TabsTrigger value="matutino">Matutino</TabsTrigger>
                                            <TabsTrigger value="vespertino">Vespertino</TabsTrigger>
                                            <TabsTrigger value="noturno">Noturno</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0 overflow-hidden p-0 bg-white">
                            {loadingContext ? (
                                <div className="flex h-full items-center justify-center p-12">
                                    <Loader className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                            ) : (
                                <div className="h-full min-h-0 overflow-auto overscroll-contain custom-scrollbar">
                                    <div className="min-h-full">
                                        <ScheduleGrid
                                            groupedRooms={groupedRooms}
                                            weekDays={weekDays}
                                            getHolidayForDay={getHolidayForDay}
                                            getSchedulesForRoomAndDay={getSchedulesForRoomAndDay}
                                            getTurnoAndColor={getTurnoAndColor}
                                            onScheduleClick={(sched) => {
                                                if (sched.teacherId === teacher.id) {
                                                    setSelectedSchedule(sched);
                                                    setIsSwapModalOpen(true);
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                :
                    <Card className="border-0 shadow-xl bg-slate-50/30 overflow-visible mb-8">
                        <CardHeader className="shrink-0 bg-white border-b pb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                                        <BookOpen className="h-6 w-6 text-blue-600" />
                                        Meus Agendamentos
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Confira sua agenda completa e registros de aulas para os próximos 14 dias.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1.5 font-semibold text-xs gap-1.5 shadow-sm">
                                        <CalendarRange className="h-4 w-4 text-blue-600" />
                                        {sortedSchedules.length} {sortedSchedules.length === 1 ? 'aula na agenda' : 'aulas na agenda'}
                                    </Badge>
                                    {sortedSchedules.length > 0 && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 shadow-sm"
                                            title="Baixar todas as aulas em arquivo compatível com Google Calendar, iPhone e Outlook"
                                            onClick={() => {
                                                downloadIcsFile(sortedSchedules as any, `minha_agenda_${teacher?.name?.split(' ')[0] || 'docente'}.ics`, `Agenda Docente - ${teacher?.name || 'SENAI'}`);
                                            }}
                                        >
                                            <Download className="h-3.5 w-3.5 text-emerald-600" />
                                            Exportar Agenda (.ics)
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 p-0 overflow-visible">
                            {loadingContext ? (
                                <div className="flex justify-center p-12 bg-white rounded-xl shadow-inner">
                                    <Loader className="w-8 h-8 animate-spin text-blue-500" />
                                </div>
                            ) : sortedSchedules.length === 0 ? (
                                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center shadow-inner">
                                    <div className="inline-flex items-center justify-center p-4 bg-slate-50 rounded-full mb-4">
                                        <CalendarRange className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-800">Nenhum agendamento futuro</h4>
                                    <p className="text-slate-500 max-w-xs mx-auto mt-2 italic">
                                        Não encontramos aulas ou reservas vinculadas ao seu perfil para o período selecionado.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-8 pb-32">
                                    {nextSchedules.pending.length > 0 && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 text-amber-600 border-l-4 border-amber-500 pl-4 py-1">
                                                <Clock className="h-6 w-6" />
                                                <h3 className="font-black text-xl tracking-tight uppercase">Próximas Aulas (Pendentes)</h3>
                                            </div>
                                            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 lg:gap-6">
                                                {nextSchedules.pending.map((schedule) => renderScheduleCard(schedule))}
                                            </div>
                                        </div>
                                    )}

                                    {nextSchedules.finished.length > 0 && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 text-green-600 border-l-4 border-green-500 pl-4 py-1">
                                                <CheckCircle2 className="h-6 w-6" />
                                                <h3 className="font-black text-xl tracking-tight uppercase">Aulas Finalizadas (Registros)</h3>
                                            </div>
                                            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 lg:gap-6 opacity-85 hover:opacity-100 transition-opacity">
                                                {nextSchedules.finished.map((schedule) => renderScheduleCard(schedule))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                }
                {isReserveModalOpen && teacher && (
                    <RoomReservationModal
                        isOpen={isReserveModalOpen}
                        onClose={() => {
                            setIsReserveModalOpen(false);
                            setPrefilledReservation(null);
                        }}
                        availableRooms={availableRooms}
                        teacherClasses={teacherClasses}
                        onSuccess={loadSchedules}
                        initialValues={prefilledReservation ?? undefined}
                    />
                )}

                {isSwapModalOpen && selectedSchedule && teacher && (
                    <SwapRequestModal
                        isOpen={isSwapModalOpen}
                        onClose={() => setIsSwapModalOpen(false)}
                        sourceSchedule={selectedSchedule}
                        teacherId={teacher.id}
                        teacherName={teacher.name}
                        initialTab="rooms"
                    />
                )}

                <Dialog open={isEditLinksOpen} onOpenChange={setIsEditLinksOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5 text-indigo-600" />
                                Editar Links do Painel
                            </DialogTitle>
                            <DialogDescription>
                                Atualize os títulos e links exibidos na página do professor.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            {/* Portal Docente */}
                            <div className="space-y-2 border-b pb-3">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-indigo-850">1. Portal Docente</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <Input
                                            value={tempLinks.portalDocenteLabel}
                                            onChange={(e) => setTempLinks(prev => ({ ...prev, portalDocenteLabel: e.target.value }))}
                                            placeholder="Nome"
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            value={tempLinks.portalDocenteLink}
                                            onChange={(e) => setTempLinks(prev => ({ ...prev, portalDocenteLink: e.target.value }))}
                                            placeholder="URL"
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Meu SENAI */}
                            <div className="space-y-2 border-b pb-3">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-indigo-850">2. Meu SENAI</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <Input
                                            value={tempLinks.meuSenaiLabel}
                                            onChange={(e) => setTempLinks(prev => ({ ...prev, meuSenaiLabel: e.target.value }))}
                                            placeholder="Nome"
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            value={tempLinks.meuSenaiLink}
                                            onChange={(e) => setTempLinks(prev => ({ ...prev, meuSenaiLink: e.target.value }))}
                                            placeholder="URL"
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Pesquisa Sensorial */}
                            <div className="space-y-2 border-b pb-3">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-indigo-850">3. Pesquisa Sensorial</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <Input
                                            value={tempLinks.pesquisaSensorialLabel}
                                            onChange={(e) => setTempLinks(prev => ({ ...prev, pesquisaSensorialLabel: e.target.value }))}
                                            placeholder="Nome"
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            value={tempLinks.pesquisaSensorialLink}
                                            onChange={(e) => setTempLinks(prev => ({ ...prev, pesquisaSensorialLink: e.target.value }))}
                                            placeholder="URL"
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Grade Pública */}
                            <div className="space-y-2 pb-1">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-indigo-850">4. Grade Pública</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <Input
                                            value={tempLinks.gradePublicaLabel}
                                            onChange={(e) => setTempLinks(prev => ({ ...prev, gradePublicaLabel: e.target.value }))}
                                            placeholder="Nome"
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            value={tempLinks.gradePublicaLink}
                                            onChange={(e) => setTempLinks(prev => ({ ...prev, gradePublicaLink: e.target.value }))}
                                            placeholder="URL"
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEditLinksOpen(false)}
                                disabled={isSavingLinks}
                                className="h-9 text-xs"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSaveTempLinks}
                                disabled={isSavingLinks}
                                className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {isSavingLinks && <Loader className="mr-2 h-3 w-3 animate-spin" />}
                                Salvar Links
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <RoomInspectionModal
                    isOpen={isInspectionModalOpen}
                    onClose={() => setIsInspectionModalOpen(false)}
                    schedule={selectedSchedule}
                    room={rooms.find(r => r.id === selectedSchedule?.roomId)}
                    type={inspectionType}
                    onSuccess={() => {
                        // Atualizar localmente se necessário
                        if (selectedSchedule) {
                            const isCheckIn = inspectionType === "CHECK_IN";
                            setSchedules(prev => prev.map(s => s.id === selectedSchedule.id ? {
                                ...s,
                                checkInCompleted: isCheckIn ? true : s.checkInCompleted,
                                checkOutCompleted: !isCheckIn ? true : s.checkOutCompleted,
                                derivedStatus: !isCheckIn ? 'concluida' : s.derivedStatus
                            } : s));
                            setWeeklySchedules(prev => prev.map(s => s.id === selectedSchedule.id ? {
                                ...s,
                                checkInCompleted: isCheckIn ? true : s.checkInCompleted,
                                checkOutCompleted: !isCheckIn ? true : s.checkOutCompleted,
                                derivedStatus: !isCheckIn ? 'concluida' : s.derivedStatus
                            } : s));
                        }
                    }}
                />
            </PageContent>
        </PageLayout>
    );
}
