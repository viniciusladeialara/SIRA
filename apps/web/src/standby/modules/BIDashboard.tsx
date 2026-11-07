import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend, LabelList, AreaChart, Area
} from 'recharts';
import { 
    Clock, Calendar, Users, MapPin, BookOpen, Activity, ArrowUpRight, ArrowRightLeft, 
    Package, Edit, LayoutDashboard, GripVertical, CheckCircle2, AlertTriangle, ShieldCheck, 
    RefreshCw, Maximize2, Minimize2, Wrench, Sparkles, Filter, Layers, BarChart3, 
    TrendingUp, CheckCircle, XCircle, ChevronDown, GraduationCap, Building2, AlertCircle, 
    Info, CheckCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, startOfYear, isWithinInterval, differenceInMinutes, isAfter } from 'date-fns';
import { cn } from "@/lib/utils";
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

// Paleta Harmoniosa de Cores SENAI / Modern BI
const COLORS = [
    '#2563eb', // Azul Royal
    '#10b981', // Verde Esmeralda
    '#f59e0b', // Âmbar Vibrante
    '#8b5cf6', // Roxo Moderno
    '#06b6d4', // Ciano
    '#ec4899', // Rosa / Magenta
    '#6366f1', // Índigo
    '#14b8a6', // Teal
];

// Helper seguro para converter Timestamp do Firestore ou ISO string para Date
function toJsDate(val: any): Date | null {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

export function BIDashboard() {
    // --- ESTADOS DE DADOS EM TEMPO REAL ---
    const [schedules, setSchedules] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [absences, setAbsences] = useState<any[]>([]);
    const [uniformMovements, setUniformMovements] = useState<any[]>([]);
    const [projectDemands, setProjectDemands] = useState<any[]>([]);
    const [teacherAllocations, setTeacherAllocations] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [scheduleSwaps, setScheduleSwaps] = useState<any[]>([]);
    const [scheduleConflicts, setScheduleConflicts] = useState<any[]>([]);
    const [roomIssues, setRoomIssues] = useState<any[]>([]);

    // --- ESTADOS DE CONTROLE & USUÁRIO ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>("all");
    const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year' | 'all'>('week');
    const [roomCategoryFilter, setRoomCategoryFilter] = useState<'all' | 'lab' | 'sala' | 'conteiner'>('all');
    const [activeTab, setActiveTab] = useState<string>("overview");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [liveEventCount, setLiveEventCount] = useState<number>(0);
    const [isRestricted, setIsRestricted] = useState(false);

    // Monitora usuário autenticado para habilitar coleções restritas
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsub();
    }, []);

    // Layout padrão reativo e expansível (Ranking de Ambientes com destaque amplo)
    const defaultLayout = {
        lg: [
            { i: 'kpi-occupancy', x: 0, y: 0, w: 1, h: 2 },
            { i: 'kpi-teachers', x: 1, y: 0, w: 1, h: 2 },
            { i: 'kpi-projects', x: 2, y: 0, w: 1, h: 2 },
            { i: 'kpi-completion', x: 3, y: 0, w: 1, h: 2 },
            
            { i: 'chart-projects', x: 0, y: 2, w: 2, h: 6 },
            { i: 'chart-shifts', x: 2, y: 2, w: 2, h: 6 },

            // Ranking de Ambientes ocupando toda a largura (w: 4) para visualização espaçosa e nítida
            { i: 'chart-environments', x: 0, y: 8, w: 4, h: 7 },

            { i: 'chart-history', x: 0, y: 15, w: 2, h: 6 },
            { i: 'chart-operations-status', x: 2, y: 15, w: 2, h: 6 },
        ]
    };

    const [layout, setLayout] = useState(() => {
        try {
            const saved = localStorage.getItem('bi-dashboard-layout-v6');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Remove os gráficos excluídos
                const filteredLg = (parsed.lg || []).filter((item: any) => 
                    item.i !== 'chart-macro-micro' && item.i !== 'chart-teachers-rank'
                );
                // Garante que chart-environments tenha largura 4 e shifts tenha 2
                const updatedLg = filteredLg.map((item: any) => {
                    if (item.i === 'chart-environments') return { ...item, w: 4, h: Math.max(item.h || 7, 7) };
                    if (item.i === 'chart-shifts') return { ...item, w: 2 };
                    return item;
                });
                return { lg: updatedLg };
            }
        } catch (e) {
            console.error("Erro ao carregar layout salvo do BI:", e);
        }
        return defaultLayout;
    });

    const onLayoutChange = (currentLayout: any, allLayouts: any) => {
        setLayout(allLayouts);
        if (!isEditing) return;
        localStorage.setItem('bi-dashboard-layout-v6', JSON.stringify(allLayouts));
    };

    // --- ASSINATURA EM TEMPO REAL VIA FIRESTORE (onSnapshot) ---
    useEffect(() => {
        setLoading(true);
        const unsubs: (() => void)[] = [];

        const registerListener = (collectionName: string, setter: (data: any[]) => void, requiresAuth = false) => {
            try {
                const q = query(collection(db, collectionName));
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setter(docs);
                    setLastUpdated(new Date());
                    setLiveEventCount(prev => prev + 1);
                }, (error) => {
                    if (error?.code === 'permission-denied') {
                        console.warn(`🔒 [BI REALTIME] Leitura restrita para '${collectionName}' (Acesso restrito ou público).`);
                        setIsRestricted(true);
                        setter([]);
                    } else {
                        console.error(`Erro no listener realtime de ${collectionName}:`, error);
                    }
                });
                unsubs.push(unsubscribe);
            } catch (err) {
                console.error(`Falha ao registrar listener para ${collectionName}:`, err);
            }
        };

        // 1. Coleções Principais da Grade e Alocações
        registerListener('schedules', setSchedules);
        registerListener('teacher_allocation', setTeacherAllocations);
        registerListener('rooms', setRooms);
        registerListener('classes', setClasses);
        registerListener('courses', setCourses);
        registerListener('units', setUnits);
        registerListener('projects', setProjects);
        registerListener('absences', setAbsences);
        registerListener('uniform_movements', setUniformMovements);
        registerListener('project_demands', setProjectDemands);

        // 2. Coleções com controle de autenticação / Governança
        registerListener('teachers', setTeachers, true);
        registerListener('scheduleSwaps', setScheduleSwaps, true);
        registerListener('schedule_conflicts', setScheduleConflicts, true);
        registerListener('room_issues', setRoomIssues, true);

        const timer = setTimeout(() => {
            setLoading(false);
        }, 600);

        return () => {
            clearTimeout(timer);
            unsubs.forEach(unsub => unsub());
        };
    }, [currentUser]);

    // Atualização manual sob demanda com animação de feedback
    const handleManualRefresh = async () => {
        setRefreshing(true);
        try {
            const snap = await getDocs(query(collection(db, 'schedules')));
            setSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLastUpdated(new Date());
            setLiveEventCount(c => c + 1);
        } catch (err) {
            console.error("Erro na atualização manual:", err);
        } finally {
            setTimeout(() => setRefreshing(false), 500);
        }
    };

    // Alternar modo de tela cheia (ideal para telas de coordenação / TV)
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
            }
        }
    };

    // --- FILTRAGEM MULTITENANT & TEMPORAL EM MEMÓRIA ---
    const filteredSchedules = useMemo(() => {
        if (selectedUnitFilter === 'all') return schedules;
        return schedules.filter(s => s.unitId === selectedUnitFilter);
    }, [schedules, selectedUnitFilter]);

    const filteredTeachers = useMemo(() => {
        if (selectedUnitFilter === 'all') return teachers;
        return teachers.filter(t => t.unitId === selectedUnitFilter);
    }, [teachers, selectedUnitFilter]);

    const filteredRooms = useMemo(() => {
        if (selectedUnitFilter === 'all') return rooms;
        return rooms.filter(r => r.unitId === selectedUnitFilter);
    }, [rooms, selectedUnitFilter]);

    const filteredClasses = useMemo(() => {
        if (selectedUnitFilter === 'all') return classes;
        return classes.filter(c => c.unitId === selectedUnitFilter);
    }, [classes, selectedUnitFilter]);

    const filteredTeacherAllocations = useMemo(() => {
        if (selectedUnitFilter === 'all') return teacherAllocations;
        const teacherIdsInUnit = new Set(filteredTeachers.map(t => t.id));
        return teacherAllocations.filter(a => a.unitId === selectedUnitFilter || teacherIdsInUnit.has(a.teacherId));
    }, [teacherAllocations, filteredTeachers, selectedUnitFilter]);

    const filteredAbsences = useMemo(() => {
        if (selectedUnitFilter === 'all') return absences;
        return absences.filter(a => a.unitId === selectedUnitFilter);
    }, [absences, selectedUnitFilter]);

    const filteredSwaps = useMemo(() => {
        if (selectedUnitFilter === 'all') return scheduleSwaps;
        return scheduleSwaps.filter(s => s.unitId === selectedUnitFilter || !s.unitId);
    }, [scheduleSwaps, selectedUnitFilter]);

    const filteredConflicts = useMemo(() => {
        if (selectedUnitFilter === 'all') return scheduleConflicts;
        return scheduleConflicts.filter(c => c.unitId === selectedUnitFilter || !c.unitId);
    }, [scheduleConflicts, selectedUnitFilter]);

    const filteredRoomIssues = useMemo(() => {
        if (selectedUnitFilter === 'all') return roomIssues;
        return roomIssues.filter(i => i.unitId === selectedUnitFilter);
    }, [roomIssues, selectedUnitFilter]);

    // --- CÁLCULO DE KPIS ESTRATÉGICOS ---
    const stats = useMemo(() => {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

        // 1. Agendamentos na Semana Corrente (Micro)
        const currentWeekSchedules = filteredSchedules.filter(s => {
            const d = toJsDate(s.startTime);
            return d && isWithinInterval(d, { start: weekStart, end: weekEnd });
        });

        const weeklyScheduledMinutes = currentWeekSchedules.reduce((sum, s) => {
            const start = toJsDate(s.startTime);
            const end = toJsDate(s.endTime);
            if (start && end) {
                const diff = differenceInMinutes(end, start);
                return sum + (diff > 0 && diff < 600 ? diff : 240);
            }
            return sum + 240; // 4h padrão por bloco
        }, 0);
        const weeklyScheduledHours = Math.round(weeklyScheduledMinutes / 60);

        // 2. Docentes efetivos e capacidade semanal (35h/sem por docente ativo)
        const activeAllocations = filteredTeacherAllocations.filter(a => a.status !== 'DELETED');
        const effectiveTeachersCount = filteredTeachers.length > 0 
            ? filteredTeachers.filter(t => t.isActive !== false).length 
            : Math.max(1, new Set(activeAllocations.map(a => a.teacherId)).size);

        const weeklyPotentialHours = effectiveTeachersCount * 35;
        const weeklyOccupancyRate = weeklyPotentialHours > 0 
            ? Math.min(100, Math.round((weeklyScheduledHours / weeklyPotentialHours) * 100))
            : 0;

        // 3. Alocação Macro Planejada (Total do contrato/semestre)
        const totalPlannedHours = activeAllocations.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);

        // 4. Docentes com aula nesta semana
        const teachersWithClassThisWeek = new Set(currentWeekSchedules.map(s => s.teacherId)).size;
        const avgHoursPerTeacher = effectiveTeachersCount > 0 ? (weeklyScheduledHours / effectiveTeachersCount).toFixed(1) : "0";

        return {
            weeklyScheduledHours,
            weeklyPotentialHours,
            weeklyOccupancyRate,
            totalPlannedHours,
            totalTeachers: effectiveTeachersCount,
            teachersWithClassThisWeek,
            avgHoursPerTeacher,
            totalSchedules: filteredSchedules.length,
            totalRooms: filteredRooms.length,
            totalClasses: filteredClasses.length,
        };
    }, [filteredSchedules, filteredTeachers, filteredRooms, filteredClasses, filteredTeacherAllocations]);

    // Conclusão Curricular de Turmas
    const classCompletionData = useMemo(() => {
        if (filteredClasses.length === 0) return { average: 0, byClass: [] };

        const completionList = filteredClasses.map(cls => {
            const courseUnits = courses.find(c => c.id === cls.courseId)?.curricular_units || [];
            const totalRequiredHours = courseUnits.reduce((sum: number, unit: any) => sum + (Number(unit.hours) || 0), 0) || 160;
            
            const scheduledHours = filteredSchedules
                .filter(s => s.classId === cls.id)
                .reduce((sum, s) => sum + 4, 0);

            const completeness = Math.min(Math.round((scheduledHours / totalRequiredHours) * 100), 100);
            return { name: cls.name, completeness, scheduledHours, totalRequiredHours };
        });

        const average = Math.round(completionList.reduce((sum, c) => sum + c.completeness, 0) / filteredClasses.length);
        return { average, byClass: completionList };
    }, [filteredClasses, filteredSchedules, courses]);

    // Distribuição de Turmas por Turno (Donut Chart com dados limpos)
    const classShiftDistribution = useMemo(() => {
        const counts: Record<string, number> = {
            'Matutino': 0,
            'Vespertino': 0,
            'Noturno': 0,
        };
        
        filteredClasses.forEach(c => {
            const rawShift = (c.shift || c.period || '').toLowerCase();
            if (rawShift.includes('mat') || rawShift.includes('manh')) counts['Matutino']++;
            else if (rawShift.includes('vesp') || rawShift.includes('tard')) counts['Vespertino']++;
            else if (rawShift.includes('not') || rawShift.includes('noit')) counts['Noturno']++;
            else {
                const label = c.shift || c.period || 'Integral';
                counts[label] = (counts[label] || 0) + 1;
            }
        });

        const total = Object.values(counts).reduce((a, b) => a + b, 0);

        return Object.entries(counts)
            .filter(([_, val]) => val > 0)
            .map(([name, value]) => ({
                name,
                value,
                percentage: total > 0 ? Math.round((value / total) * 100) : 0
            }));
    }, [filteredClasses]);

    // Alocação Macro por Projeto
    const projectDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredTeacherAllocations.filter(a => a.status !== 'DELETED').forEach(a => {
            const project = projects.find(p => p.id === a.projectId);
            const course = !project ? courses.find(c => c.id === a.projectId || c.id === a.courseId) : null;
            const name = project?.name || course?.name || a.projectName || a.courseName;
            
            if (!name || name === "Institucional / Geral" || name.toLowerCase().includes("planejamento")) return;
            counts[name] = (counts[name] || 0) + (Number(a.hours) || 0);
        });

        const totalHours = Object.values(counts).reduce((sum, val) => sum + val, 0);

        return Object.entries(counts)
            .map(([name, value]) => ({ 
                name, 
                value,
                percentage: totalHours > 0 ? ((value / totalHours) * 100).toFixed(1) : "0"
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [filteredTeacherAllocations, projects, courses]);

    // Macro vs Micro: Planejado vs Agendado por Projeto (Utilizado na aba temática)
    const macroVsMicroData = useMemo(() => {
        const data: Record<string, { name: string; planejado: number; executado: number; saldo: number }> = {};
        
        filteredTeacherAllocations.filter(a => a.status !== 'DELETED').forEach(a => {
            const project = projects.find(p => p.id === a.projectId);
            const course = !project ? courses.find(c => c.id === a.projectId || c.id === a.courseId) : null;
            const name = project?.name || course?.name || a.projectName || a.courseName || "Geral";
            
            if (!name || name === "Institucional / Geral" || name.toLowerCase().includes("planejamento")) return;

            if (!data[name]) data[name] = { name, planejado: 0, executado: 0, saldo: 0 };
            data[name].planejado += (Number(a.hours) || 0);
        });

        filteredSchedules.forEach(s => {
            let name = "";
            const project = projects.find(p => p.id === s.projectId);
            const course = !project ? courses.find(c => c.id === s.projectId || c.id === s.courseId) : null;
            if (project?.name || course?.name) {
                name = project?.name || course?.name || '';
            } else if (s.classId) {
                const cls = filteredClasses.find(c => c.id === s.classId);
                if (cls) {
                    const cRef = courses.find(c => c.id === cls.courseId);
                    if (cRef) name = cRef.name;
                    else if (cls.courseName) name = cls.courseName;
                }
            } else if (s.projectName || s.courseName) {
                name = s.projectName || s.courseName || '';
            }

            if (name && data[name]) {
                data[name].executado += 4;
            }
        });

        return Object.values(data)
            .map(item => ({
                ...item,
                saldo: Math.max(0, item.planejado - item.executado),
                taxaExecucao: item.planejado > 0 ? Math.min(100, Math.round((item.executado / item.planejado) * 100)) : 0
            }))
            .sort((a, b) => b.planejado - a.planejado)
            .slice(0, 6);
    }, [filteredTeacherAllocations, filteredSchedules, projects, courses, filteredClasses]);

    // Ranking de Ambientes (Salas e Laboratórios) com filtro de período e enriquecimento
    const roomUsage = useMemo(() => {
        const counts: Record<string, { count: number; type: string; id: string; hours: number }> = {};
        const now = new Date();
        
        let limitDate: Date | null = null;
        if (timeFilter === 'week') limitDate = startOfWeek(now, { weekStartsOn: 1 });
        if (timeFilter === 'month') limitDate = startOfMonth(now);
        if (timeFilter === 'year') limitDate = startOfYear(now);

        filteredSchedules.forEach(s => {
            if (limitDate) {
                const sDate = toJsDate(s.startTime);
                if (sDate && !isAfter(sDate, limitDate) && timeFilter !== 'all') return;
            }

            const rName = s.roomName || s.roomId || "Sala Geral";
            const roomObj = filteredRooms.find(r => r.id === s.roomId || r.name === rName);
            let type = roomObj?.type || "Sala de Aula";
            const lowerName = rName.toLowerCase();
            if (lowerName.includes('lab') || lowerName.includes('informática') || lowerName.includes('eletricidade') || lowerName.includes('redes')) {
                type = 'Laboratório';
            } else if (lowerName.includes('cont')) {
                type = 'Contêiner';
            } else if (lowerName.includes('sala')) {
                type = 'Sala de Aula';
            }

            if (!counts[rName]) counts[rName] = { count: 0, type, id: s.roomId || rName, hours: 0 };
            counts[rName].count += 1;
            counts[rName].hours += 4;
        });
        
        return Object.entries(counts)
            .map(([name, data]) => ({ name, value: data.count, hours: data.hours, type: data.type }))
            .sort((a, b) => b.value - a.value);
    }, [filteredSchedules, filteredRooms, timeFilter]);

    // Filtragem por Categoria de Ambiente (Todos, Labs, Salas, Contêineres)
    const displayedRoomUsage = useMemo(() => {
        let list = roomUsage;
        if (roomCategoryFilter === 'lab') {
            list = list.filter(r => r.type === 'Laboratório' || r.name.toLowerCase().includes('lab'));
        } else if (roomCategoryFilter === 'sala') {
            list = list.filter(r => r.type === 'Sala de Aula' || r.name.toLowerCase().includes('sala'));
        } else if (roomCategoryFilter === 'conteiner') {
            list = list.filter(r => r.type === 'Contêiner' || r.name.toLowerCase().includes('cont'));
        }
        return list.slice(0, 10);
    }, [roomUsage, roomCategoryFilter]);

    // Métricas Resumidas dos Ambientes para o painel lateral
    const roomMetrics = useMemo(() => {
        const totalAgendamentos = roomUsage.reduce((acc, r) => acc + r.value, 0);
        const labsUsage = roomUsage.filter(r => r.type === 'Laboratório' || r.name.toLowerCase().includes('lab')).reduce((acc, r) => acc + r.value, 0);
        const salasUsage = roomUsage.filter(r => r.type === 'Sala de Aula' || r.name.toLowerCase().includes('sala')).reduce((acc, r) => acc + r.value, 0);
        const conteinerUsage = roomUsage.filter(r => r.type === 'Contêiner' || r.name.toLowerCase().includes('cont')).reduce((acc, r) => acc + r.value, 0);

        const topRoom = roomUsage[0] || null;
        const activeRooms = roomUsage.length;
        const totalRooms = Math.max(1, filteredRooms.length);
        const activeRate = Math.min(100, Math.round((activeRooms / totalRooms) * 100));

        return {
            totalAgendamentos,
            labsUsage,
            salasUsage,
            conteinerUsage,
            topRoom,
            activeRooms,
            totalRooms,
            activeRate
        };
    }, [roomUsage, filteredRooms]);

    // Top Docentes por Carga Horária Planejada (Utilizado na aba temática)
    const topTeachers = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredTeacherAllocations.filter(a => a.status !== 'DELETED').forEach(a => {
            const name = a.teacherName || "ID: " + String(a.teacherId).substring(0, 6);
            counts[name] = (counts[name] || 0) + (Number(a.hours) || 0);
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [filteredTeacherAllocations]);

    // Evolução Mensal da Atividade da Rede (Agendamentos)
    const schedulesByMonth = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredSchedules.forEach(s => {
            const date = toJsDate(s.startTime);
            if (date) {
                const monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                counts[monthKey] = (counts[monthKey] || 0) + 1;
            }
        });
        const sortedKeys = Object.keys(counts).sort((a, b) => {
            const [mA, yA] = a.split('/');
            const [mB, yB] = b.split('/');
            return new Date(Number(yA), Number(mA) - 1).getTime() - new Date(Number(yB), Number(mB) - 1).getTime();
        });
        return sortedKeys.map(k => ({ data: k, quantidade: counts[k] }));
    }, [filteredSchedules]);

    // Estatísticas de Operações (Trocas, Conflitos e Manutenções)
    const operationsStats = useMemo(() => {
        const pendingSwaps = filteredSwaps.filter(s => s.status === 'pending').length;
        const approvedSwaps = filteredSwaps.filter(s => s.status === 'approved').length;
        const totalSwaps = filteredSwaps.length;
        const swapApprovalRate = totalSwaps > 0 ? Math.round((approvedSwaps / totalSwaps) * 100) : 100;

        const pendingConflicts = filteredConflicts.filter(c => c.status === 'pending').length;
        const openIssues = filteredRoomIssues.filter(i => i.status === 'open' || i.status === 'in_progress').length;
        const totalRooms = filteredRooms.length;
        const operationalRooms = Math.max(0, totalRooms - new Set(filteredRoomIssues.filter(i => i.status !== 'resolved').map(i => i.roomId)).size);
        const facilityHealth = totalRooms > 0 ? Math.round((operationalRooms / totalRooms) * 100) : 100;

        return {
            pendingSwaps,
            approvedSwaps,
            swapApprovalRate,
            pendingConflicts,
            isScheduleClean: pendingConflicts === 0,
            openIssues,
            facilityHealth
        };
    }, [filteredSwaps, filteredConflicts, filteredRoomIssues, filteredRooms]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
                <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                    <div className="relative flex items-center justify-center">
                        <Activity className="h-12 w-12 animate-spin text-blue-500" />
                        <Sparkles className="h-5 w-5 text-amber-400 absolute" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-lg font-bold">Conectando ao Stream do BI...</p>
                        <p className="text-xs text-slate-400">Sincronizando alocações, ambientes e grade em tempo real</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans transition-colors duration-300",
            isFullscreen ? "p-4 md:p-6" : "p-6 md:p-10"
        )}>
            <div className="max-w-[1700px] mx-auto space-y-8">
                
                {/* --- HEADER ESTRATÉGICO & CONTROLES --- */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
                    <div className="space-y-3">
                        {/* Live Sync Status Pill */}
                        <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 dark:border-emerald-900/50 dark:bg-emerald-950/40 px-3.5 py-1 text-xs font-semibold shadow-sm">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <span className="text-emerald-800 dark:text-emerald-300 font-bold">
                                Ao Vivo • Firestore Realtime
                            </span>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(lastUpdated, 'HH:mm:ss')}
                            </span>
                            {liveEventCount > 0 && (
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-none">
                                    {liveEventCount} syncs
                                </Badge>
                            )}
                        </div>

                        <div>
                            <h1 className="text-3xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-blue-700 via-indigo-600 to-slate-900 dark:from-blue-400 dark:via-indigo-300 dark:to-white bg-clip-text text-transparent">
                                Painel Estratégico de Inteligência
                            </h1>
                            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium mt-1">
                                Monitoramento em tempo real de ocupação da rede, planejamento macro e execução micro docente.
                            </p>
                        </div>
                    </div>

                    {/* Barra de Filtros e Ações Executivas */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Seletor de Unidade Multitenant */}
                        <Select value={selectedUnitFilter} onValueChange={setSelectedUnitFilter}>
                            <SelectTrigger className="w-[190px] h-10 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 font-semibold shadow-sm">
                                <MapPin className="h-4 w-4 mr-1.5 text-blue-600 shrink-0" />
                                <SelectValue placeholder="Unidade: Todas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as Unidades</SelectItem>
                                {units.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Botão de Atualização Manual com Feedback */}
                        <button
                            onClick={handleManualRefresh}
                            disabled={refreshing}
                            title="Forçar sincronização de dados"
                            className={cn(
                                "inline-flex items-center justify-center rounded-lg text-xs md:text-sm font-bold transition-all h-10 px-4 shadow-sm active:scale-95 text-white shadow-blue-500/20",
                                refreshing ? "bg-blue-400 cursor-wait animate-pulse" : "bg-blue-600 hover:bg-blue-700"
                            )}
                        >
                            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />
                            {refreshing ? "Sincronizando..." : "Atualizar BI"}
                        </button>

                        {/* Alternar Fullscreen / Modo TV */}
                        <button
                            onClick={toggleFullscreen}
                            title="Alternar Modo TV / Tela Cheia para Telões"
                            className="inline-flex items-center justify-center rounded-lg text-xs md:text-sm font-semibold border border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 h-10 px-3 shadow-sm transition-all"
                        >
                            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            <span className="hidden sm:inline ml-1.5">{isFullscreen ? "Sair TV" : "Modo TV"}</span>
                        </button>

                        {/* Botão para Editar Grade Arrastável */}
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={cn(
                                "inline-flex items-center justify-center rounded-lg text-xs md:text-sm font-semibold transition-all h-10 px-3.5 border shadow-sm",
                                isEditing 
                                    ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600" 
                                    : "bg-white border-slate-300 hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                            )}
                        >
                            <Edit className="mr-1.5 h-3.5 w-3.5" />
                            {isEditing ? "Salvar Posições" : "Editar Grade"}
                        </button>

                        {/* Atalho para Grade Pública */}
                        <button
                            onClick={() => window.open("/public-view", "_blank")}
                            className="inline-flex items-center justify-center rounded-lg text-xs md:text-sm font-semibold border border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 h-10 px-3.5 shadow-sm transition-all"
                        >
                            <Calendar className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                            Ver Grade
                        </button>
                    </div>
                </div>

                {/* --- BARRA DE ABAS TEMÁTICAS --- */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-slate-200/60 dark:bg-slate-900/60 p-1 rounded-xl h-auto flex flex-wrap gap-1">
                        <TabsTrigger value="overview" className="rounded-lg font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                            <LayoutDashboard className="h-4 w-4 mr-2 text-blue-600" />
                            Visão Geral Estratégica
                        </TabsTrigger>
                        <TabsTrigger value="macro-micro" className="rounded-lg font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                            <TrendingUp className="h-4 w-4 mr-2 text-indigo-600" />
                            Macro vs Micro (Planejado x Executado)
                        </TabsTrigger>
                        <TabsTrigger value="teachers" className="rounded-lg font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                            <Users className="h-4 w-4 mr-2 text-orange-500" />
                            Corpo Docente & Carga
                        </TabsTrigger>
                        <TabsTrigger value="environments" className="rounded-lg font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                            <Building2 className="h-4 w-4 mr-2 text-purple-600" />
                            Ambientes & Infraestrutura
                        </TabsTrigger>
                        <TabsTrigger value="operations" className="rounded-lg font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                            <ArrowRightLeft className="h-4 w-4 mr-2 text-emerald-600" />
                            Operações & Continuidade
                        </TabsTrigger>
                    </TabsList>

                    {/* --- TAB 1: VISÃO GERAL (GRID PRINCIPAL) --- */}
                    <TabsContent value="overview" className="space-y-8 mt-6">
                        <ResponsiveGridLayout
                            className="layout"
                            layouts={layout}
                            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                            cols={{ lg: 4, md: 2, sm: 2, xs: 1, xxs: 1 }}
                            rowHeight={65}
                            isDraggable={isEditing}
                            isResizable={isEditing}
                            onLayoutChange={onLayoutChange}
                            draggableHandle=".drag-handle"
                        >
                            {/* KPI 1: OCUPAÇÃO SEMANAL DA REDE (MICRO) */}
                            <div key="kpi-occupancy">
                                <Card className={cn(
                                    "h-full hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-600 bg-white dark:bg-slate-900",
                                    isEditing && "ring-2 ring-amber-400 ring-offset-2"
                                )}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 drag-handle cursor-grab active:cursor-grabbing">
                                        <div className="flex items-center gap-2">
                                            {isEditing && <GripVertical className="h-4 w-4 text-amber-500" />}
                                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                Ocupação Semanal da Rede
                                            </CardTitle>
                                        </div>
                                        <Activity className="h-5 w-5 text-blue-600" />
                                    </CardHeader>
                                    <CardContent className="pt-1">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black text-slate-900 dark:text-white">
                                                {stats.weeklyOccupancyRate}%
                                            </span>
                                            <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50/50">
                                                Semana Atual
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 font-medium">
                                            {stats.weeklyScheduledHours}h alocadas de {stats.weeklyPotentialHours}h potenciais
                                        </p>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
                                            <div 
                                                className="bg-blue-600 h-full rounded-full transition-all duration-1000" 
                                                style={{ width: `${Math.min(100, stats.weeklyOccupancyRate)}%` }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* KPI 2: DOCENTES ATIVOS & ATUAÇÃO */}
                            <div key="kpi-teachers">
                                <Card className={cn(
                                    "h-full hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500 bg-white dark:bg-slate-900",
                                    isEditing && "ring-2 ring-amber-400 ring-offset-2"
                                )}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 drag-handle cursor-grab active:cursor-grabbing">
                                        <div className="flex items-center gap-2">
                                            {isEditing && <GripVertical className="h-4 w-4 text-amber-500" />}
                                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                Docentes Ativos
                                            </CardTitle>
                                        </div>
                                        <Users className="h-5 w-5 text-orange-500" />
                                    </CardHeader>
                                    <CardContent className="pt-1">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black text-slate-900 dark:text-white">
                                                {stats.totalTeachers}
                                            </span>
                                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
                                                <ArrowUpRight className="h-3.5 w-3.5" />
                                                {stats.teachersWithClassThisWeek} em aula
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 font-medium">
                                            Média de {stats.avgHoursPerTeacher}h lecionadas / docente
                                        </p>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
                                            <div 
                                                className="bg-orange-500 h-full rounded-full transition-all duration-1000" 
                                                style={{ width: `${stats.totalTeachers > 0 ? (stats.teachersWithClassThisWeek / stats.totalTeachers) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* KPI 3: PROJETOS ATENDIDOS & TURMAS */}
                            <div key="kpi-projects">
                                <Card className={cn(
                                    "h-full hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500 bg-white dark:bg-slate-900",
                                    isEditing && "ring-2 ring-amber-400 ring-offset-2"
                                )}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 drag-handle cursor-grab active:cursor-grabbing">
                                        <div className="flex items-center gap-2">
                                            {isEditing && <GripVertical className="h-4 w-4 text-amber-500" />}
                                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                Projetos & Demandas
                                            </CardTitle>
                                        </div>
                                        <Package className="h-5 w-5 text-purple-500" />
                                    </CardHeader>
                                    <CardContent className="pt-1">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black text-slate-900 dark:text-white">
                                                {projects.length || projectDistribution.length}
                                            </span>
                                            <span className="text-xs font-semibold text-slate-500">
                                                ({projectDemands.length} demandas ativas)
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 font-medium">
                                            {stats.totalClasses} turmas ativas na rede
                                        </p>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
                                            <div 
                                                className="bg-purple-500 h-full rounded-full transition-all duration-1000" 
                                                style={{ width: `${Math.min(100, (projectDistribution.length / Math.max(1, projects.length)) * 100)}%` }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* KPI 4: CONCLUSÃO DE TURMAS */}
                            <div key="kpi-completion">
                                <Card className={cn(
                                    "h-full hover:shadow-lg transition-all duration-300 border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900",
                                    isEditing && "ring-2 ring-amber-400 ring-offset-2"
                                )}>
                                    <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 drag-handle cursor-grab active:cursor-grabbing">
                                        <div className="flex items-center gap-2">
                                            {isEditing && <GripVertical className="h-4 w-4 text-amber-500" />}
                                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                Execução Curricular
                                            </CardTitle>
                                        </div>
                                        <GraduationCap className="h-5 w-5 text-emerald-500" />
                                    </CardHeader>
                                    <CardContent className="pt-1">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black text-slate-900 dark:text-white">
                                                {classCompletionData.average}%
                                            </span>
                                            <span className="text-xs font-semibold text-emerald-600 flex items-center">
                                                <CheckCheck className="h-3.5 w-3.5 mr-0.5" />
                                                Média da Rede
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 font-medium">
                                            {stats.totalPlannedHours}h macro contratadas
                                        </p>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
                                            <div 
                                                className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                                                style={{ width: `${classCompletionData.average}%` }}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* GRÁFICO 1: ALOCAÇÃO POR PROJETO (W: 2) */}
                            <div key="chart-projects">
                                <Card className={cn("h-full shadow-md bg-white dark:bg-slate-900", isEditing && "ring-2 ring-amber-400 ring-offset-2")}>
                                    <CardHeader className="drag-handle cursor-grab active:cursor-grabbing flex flex-row items-center justify-between pb-2">
                                        <div className="flex items-center gap-2">
                                            {isEditing && <GripVertical className="h-4 w-4 text-amber-500" />}
                                            <div>
                                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                                    <BarChart3 className="h-4 w-4 text-blue-600" />
                                                    Alocação por Projeto (Macro)
                                                </CardTitle>
                                                <CardDescription className="text-xs">Distribuição da carga horária macro planejada.</CardDescription>
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="text-xs font-semibold">
                                            {projectDistribution.length} Projetos
                                        </Badge>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[250px] w-full mt-2">
                                            {projectDistribution.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={projectDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                        <XAxis 
                                                            dataKey="name" 
                                                            stroke="#64748b" 
                                                            fontSize={11} 
                                                            tickLine={false} 
                                                            axisLine={false}
                                                            interval={0}
                                                            angle={-25}
                                                            textAnchor="end"
                                                            height={45}
                                                        />
                                                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                                        <RechartsTooltip 
                                                            cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
                                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                                                            formatter={(value: any, name: any, props: any) => [
                                                                `${value} horas (${props.payload.percentage}%)`, 
                                                                'Carga Alocada'
                                                            ]}
                                                        />
                                                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={34}>
                                                            {projectDistribution.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                            <LabelList 
                                                                dataKey="percentage" 
                                                                position="top" 
                                                                formatter={(v: any) => `${v}%`}
                                                                style={{ fontSize: '10px', fontWeight: 'bold', fill: '#64748b' }}
                                                            />
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-400 font-medium">Sem alocações macro registradas.</div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* GRÁFICO 2: TURMAS POR TURNO (DONUT CLEAN COM W: 2) */}
                            <div key="chart-shifts">
                                <Card className={cn("h-full shadow-md bg-white dark:bg-slate-900", isEditing && "ring-2 ring-amber-400 ring-offset-2")}>
                                    <CardHeader className="drag-handle cursor-grab active:cursor-grabbing flex flex-row items-center gap-2 pb-2">
                                        {isEditing && <GripVertical className="h-4 w-4 text-amber-500" />}
                                        <div>
                                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-orange-500" />
                                                Turmas por Turno
                                            </CardTitle>
                                            <CardDescription className="text-xs">Ocupação da unidade por período.</CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[180px] w-full mt-1">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={classShiftDistribution}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={48}
                                                        outerRadius={75}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                    >
                                                        {classShiftDistribution.map((entry, index) => (
                                                            <Cell key={`cell-shift-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip 
                                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                                        formatter={(value: any, name: any, props: any) => [
                                                            `${value} turmas (${props.payload.percentage}%)`, 
                                                            name
                                                        ]}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Legenda Customizada com Badges para Evitar Corte de Texto */}
                                        <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                                            {classShiftDistribution.map((item, idx) => (
                                                <div key={item.name} className="flex flex-col items-center">
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                                        {item.name}
                                                    </div>
                                                    <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                                                        {item.value} ({item.percentage}%)
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* GRÁFICO 3: RANKING DE AMBIENTES (DESTAQUE TOTAL ESPAÇOSO - W: 4) */}
                            <div key="chart-environments">
                                <Card className={cn(
                                    "h-full shadow-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800",
                                    isEditing && "ring-2 ring-amber-400 ring-offset-2"
                                )}>
                                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 drag-handle cursor-grab active:cursor-grabbing gap-3 border-b border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2.5">
                                            {isEditing && <GripVertical className="h-5 w-5 text-amber-500 shrink-0" />}
                                            <div>
                                                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                                    <Building2 className="h-5 w-5 text-purple-600" />
                                                    Ranking de Ocupação dos Ambientes
                                                </CardTitle>
                                                <CardDescription className="text-xs text-slate-500">
                                                    Salas de aula, laboratórios e contêineres com maior volume de agendamentos.
                                                </CardDescription>
                                            </div>
                                        </div>

                                        {/* Controles de Filtro e Período */}
                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Filtro por Categoria */}
                                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                                                <button
                                                    onClick={() => setRoomCategoryFilter('all')}
                                                    className={cn(
                                                        "px-2.5 py-1 rounded-md transition-all",
                                                        roomCategoryFilter === 'all' 
                                                            ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm font-bold" 
                                                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                                    )}
                                                >
                                                    Todos
                                                </button>
                                                <button
                                                    onClick={() => setRoomCategoryFilter('lab')}
                                                    className={cn(
                                                        "px-2.5 py-1 rounded-md transition-all",
                                                        roomCategoryFilter === 'lab' 
                                                            ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm font-bold" 
                                                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                                    )}
                                                >
                                                    Laboratórios
                                                </button>
                                                <button
                                                    onClick={() => setRoomCategoryFilter('sala')}
                                                    className={cn(
                                                        "px-2.5 py-1 rounded-md transition-all",
                                                        roomCategoryFilter === 'sala' 
                                                            ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm font-bold" 
                                                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                                    )}
                                                >
                                                    Salas
                                                </button>
                                                <button
                                                    onClick={() => setRoomCategoryFilter('conteiner')}
                                                    className={cn(
                                                        "px-2.5 py-1 rounded-md transition-all",
                                                        roomCategoryFilter === 'conteiner' 
                                                            ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm font-bold" 
                                                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                                    )}
                                                >
                                                    Contêineres
                                                </button>
                                            </div>

                                            {/* Filtro Temporal */}
                                            <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
                                                <SelectTrigger className="w-[115px] h-8 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-semibold">
                                                    <SelectValue placeholder="Período" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="week">Semana</SelectItem>
                                                    <SelectItem value="month">Mês</SelectItem>
                                                    <SelectItem value="year">Ano</SelectItem>
                                                    <SelectItem value="all">Tudo</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="pt-4">
                                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
                                            {/* 1. Gráfico de Barras Amplo e Nítido (3 Colunas) */}
                                            <div className="lg:col-span-3 h-[290px] w-full">
                                                {displayedRoomUsage.length > 0 ? (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={displayedRoomUsage} margin={{ top: 15, right: 15, left: -15, bottom: 35 }}>
                                                            <defs>
                                                                <linearGradient id="purpleRoomGradient" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.95} />
                                                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.8} />
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.7} />
                                                            <XAxis 
                                                                dataKey="name" 
                                                                stroke="#64748b" 
                                                                fontSize={11} 
                                                                fontWeight={500}
                                                                tickLine={false} 
                                                                axisLine={false}
                                                                interval={0}
                                                                angle={-15}
                                                                textAnchor="end"
                                                                height={50}
                                                            />
                                                            <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                                            <RechartsTooltip 
                                                                cursor={{ fill: 'rgba(139, 92, 246, 0.06)' }}
                                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)' }}
                                                                formatter={(value: any, name: any, props: any) => [
                                                                    `${value} agendamentos (${props.payload.hours}h) • ${props.payload.type}`, 
                                                                    'Ocupação'
                                                                ]}
                                                            />
                                                            <Bar 
                                                                name="Agendamentos" 
                                                                dataKey="value" 
                                                                fill="url(#purpleRoomGradient)" 
                                                                radius={[6, 6, 0, 0]} 
                                                                barSize={36}
                                                            >
                                                                {displayedRoomUsage.map((entry, index) => {
                                                                    let barColor = "#8b5cf6";
                                                                    if (entry.type === 'Laboratório') barColor = "#3b82f6";
                                                                    else if (entry.type === 'Contêiner') barColor = "#10b981";
                                                                    return <Cell key={`cell-room-${index}`} fill={barColor} />;
                                                                })}
                                                                <LabelList 
                                                                    dataKey="value" 
                                                                    position="top" 
                                                                    formatter={(v: any) => `${v}`}
                                                                    style={{ fontSize: '11px', fontWeight: 'bold', fill: '#64748b' }}
                                                                />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                ) : (
                                                    <div className="h-full flex items-center justify-center text-slate-400 font-medium">
                                                        Nenhum ambiente encontrado para o filtro selecionado.
                                                    </div>
                                                )}
                                            </div>

                                            {/* 2. Painel Lateral de Resumo Executivo (1 Coluna) */}
                                            <div className="lg:col-span-1 flex flex-col justify-between gap-3 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 h-[290px]">
                                                {/* Top 1 Ambiente */}
                                                {roomMetrics.topRoom && (
                                                    <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900/40 shadow-sm space-y-1">
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                                                            <span>🏆</span> Mais Demandado
                                                        </div>
                                                        <p className="font-black text-sm text-slate-900 dark:text-white truncate">
                                                            {roomMetrics.topRoom.name}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 font-medium">
                                                            {roomMetrics.topRoom.value} agendamentos ({roomMetrics.topRoom.hours}h)
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Breakdown de Ambientes */}
                                                <div className="space-y-2 text-xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                                                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                                            Laboratórios
                                                        </span>
                                                        <span className="font-bold text-slate-900 dark:text-white">
                                                            {roomMetrics.labsUsage} aulas
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                                                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                                                            Salas de Aula
                                                        </span>
                                                        <span className="font-bold text-slate-900 dark:text-white">
                                                            {roomMetrics.salasUsage} aulas
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                                            Contêineres
                                                        </span>
                                                        <span className="font-bold text-slate-900 dark:text-white">
                                                            {roomMetrics.conteinerUsage} aulas
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Taxa de Ativação Geral */}
                                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                                                    <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                        <span>Espaços em Atuação</span>
                                                        <span className="text-purple-600 font-bold">{roomMetrics.activeRate}%</span>
                                                    </div>
                                                    <Progress value={roomMetrics.activeRate} className="h-1.5" />
                                                    <p className="text-[10px] text-slate-400 text-right">
                                                        {roomMetrics.activeRooms} de {roomMetrics.totalRooms} espaços físicos
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* GRÁFICO 4: ATIVIDADE DE REDE (EVOLUÇÃO TEMPORAL MÊS A MÊS - W: 2) */}
                            <div key="chart-history">
                                <Card className={cn("h-full shadow-md hover:shadow-xl transition-all duration-300 bg-white dark:bg-slate-900", isEditing && "ring-2 ring-amber-400 ring-offset-2")}>
                                    <CardHeader className="drag-handle cursor-grab active:cursor-grabbing flex flex-row items-center gap-2 pb-2">
                                        {isEditing && <GripVertical className="h-4 w-4 text-amber-500" />}
                                        <div>
                                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                                <Activity className="h-4 w-4 text-blue-600" />
                                                Atividade de Rede (Evolução Temporal)
                                            </CardTitle>
                                            <CardDescription className="text-xs">Volume mensal de aulas lecionadas ao longo do ano letivo.</CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[250px] w-full mt-2">
                                            {schedulesByMonth.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={schedulesByMonth} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                                                        <XAxis dataKey="data" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                                        <RechartsTooltip 
                                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                                                            formatter={(value: any) => [`${value} agendamentos`, 'Volume de Aulas']}
                                                        />
                                                        <Area 
                                                            type="monotone" 
                                                            dataKey="quantidade" 
                                                            stroke="#2563eb" 
                                                            strokeWidth={3} 
                                                            fillOpacity={1} 
                                                            fill="url(#areaGradient)" 
                                                            dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-400 font-medium italic">Coletando histórico temporal...</div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* WIDGET 5: SAÚDE OPERACIONAL, CONFLITOS & TROCAS (W: 2) */}
                            <div key="chart-operations-status">
                                <Card className={cn("h-full shadow-md bg-white dark:bg-slate-900", isEditing && "ring-2 ring-amber-400 ring-offset-2")}>
                                    <CardHeader className="drag-handle cursor-grab active:cursor-grabbing flex flex-row items-center gap-2 pb-2">
                                        {isEditing && <GripVertical className="h-4 w-4 text-amber-500" />}
                                        <div>
                                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                                Integridade & Operações da Grade
                                            </CardTitle>
                                            <CardDescription className="text-xs">Estabilidade de horários, trocas e manutenção de ambientes.</CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-1">
                                        {/* Status de Conflitos */}
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "p-2 rounded-lg",
                                                    operationsStats.isScheduleClean ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-red-100 text-red-700"
                                                )}>
                                                    {operationsStats.isScheduleClean ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Conflitos de Grade</p>
                                                    <p className="text-[11px] text-slate-500">
                                                        {operationsStats.isScheduleClean ? "Nenhuma colisão de sala ou professor" : `${operationsStats.pendingConflicts} conflitos pendentes`}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant={operationsStats.isScheduleClean ? "default" : "destructive"} className="text-[11px]">
                                                {operationsStats.isScheduleClean ? "100% Íntegra" : "Atenção"}
                                            </Badge>
                                        </div>

                                        {/* Status de Trocas / Permutas */}
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                                                    <ArrowRightLeft className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Permutas Docentes</p>
                                                    <p className="text-[11px] text-slate-500">
                                                        {operationsStats.pendingSwaps} pendentes • {operationsStats.approvedSwaps} deferidas
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                {operationsStats.swapApprovalRate}% deferimento
                                            </span>
                                        </div>

                                        {/* Saúde dos Ambientes Físicos */}
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400">
                                                    <Wrench className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Disponibilidade dos Ambientes</p>
                                                    <p className="text-[11px] text-slate-500">
                                                        {operationsStats.openIssues === 0 ? "100% dos espaços operacionais" : `${operationsStats.openIssues} chamados em aberto`}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                                                {operationsStats.facilityHealth}% aptos
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </ResponsiveGridLayout>
                    </TabsContent>

                    {/* --- TAB 2: MACRO VS MICRO DETALHADO --- */}
                    <TabsContent value="macro-micro" className="space-y-6 mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="p-5">
                                <CardTitle className="text-sm text-slate-500">Total Planejado (Macro)</CardTitle>
                                <div className="text-3xl font-black text-blue-600 mt-2">{stats.totalPlannedHours}h</div>
                                <p className="text-xs text-slate-500 mt-1">Carga total contratual distribuída</p>
                            </Card>
                            <Card className="p-5">
                                <CardTitle className="text-sm text-slate-500">Total Executado na Grade (Micro)</CardTitle>
                                <div className="text-3xl font-black text-emerald-600 mt-2">{stats.totalSchedules * 4}h</div>
                                <p className="text-xs text-slate-500 mt-1">{stats.totalSchedules} blocos de 4h lecionados</p>
                            </Card>
                            <Card className="p-5">
                                <CardTitle className="text-sm text-slate-500">Saldo a Alocar na Grade</CardTitle>
                                <div className="text-3xl font-black text-amber-500 mt-2">
                                    {Math.max(0, stats.totalPlannedHours - (stats.totalSchedules * 4))}h
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Horas restantes a agendar no semestre</p>
                            </Card>
                        </div>

                        <Card className="p-6">
                            <CardHeader className="px-0 pt-0">
                                <CardTitle className="text-lg font-bold">Quadro Analítico por Projeto</CardTitle>
                                <CardDescription>Acompanhe o cumprimento das metas horárias em cada projeto educacional.</CardDescription>
                            </CardHeader>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {macroVsMicroData.map(item => (
                                    <div key={item.name} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div className="space-y-1 min-w-[220px]">
                                            <p className="font-bold text-slate-800 dark:text-slate-100">{item.name}</p>
                                            <p className="text-xs text-slate-500">
                                                Meta: {item.planejado}h | Executado: {item.executado}h
                                            </p>
                                        </div>
                                        <div className="flex-1 max-w-md">
                                            <div className="flex justify-between text-xs font-semibold mb-1">
                                                <span>Progresso</span>
                                                <span>{item.taxaExecucao}%</span>
                                            </div>
                                            <Progress value={item.taxaExecucao} className="h-2" />
                                        </div>
                                        <div className="text-right">
                                            <Badge variant={item.saldo === 0 ? "secondary" : "outline"} className="font-semibold">
                                                Saldo: {item.saldo}h
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </TabsContent>

                    {/* --- TAB 3: CORPO DOCENTE & SUBSTITUIÇÕES --- */}
                    <TabsContent value="teachers" className="space-y-6 mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6">
                                <CardHeader className="px-0 pt-0">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <Users className="h-5 w-5 text-orange-500" />
                                        Docentes em Destaque de Carga
                                    </CardTitle>
                                    <CardDescription>Carga horária acumulada dos principais professores.</CardDescription>
                                </CardHeader>
                                <div className="space-y-3">
                                    {topTeachers.map((t, idx) => (
                                        <div key={t.name} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                            <div className="flex items-center gap-3">
                                                <span className="font-black text-slate-400 w-5">#{idx + 1}</span>
                                                <p className="font-semibold text-slate-800 dark:text-slate-200">{t.name}</p>
                                            </div>
                                            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200 border-none font-bold">
                                                {t.value}h alocadas
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card className="p-6">
                                <CardHeader className="px-0 pt-0">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                        Afastamentos & Substituições Pedagógicas
                                    </CardTitle>
                                    <CardDescription>Controle de faltas, atestados e continuidade de turmas.</CardDescription>
                                </CardHeader>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                                            <span className="text-2xl font-black text-slate-900 dark:text-white">{filteredAbsences.length}</span>
                                            <p className="text-xs text-slate-500 mt-1">Afastamentos Registrados</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                                            <span className="text-2xl font-black text-emerald-600">
                                                {filteredAbsences.reduce((sum, a) => sum + (Number(a.totalResolvedSchedules) || 0), 0)}
                                            </span>
                                            <p className="text-xs text-slate-500 mt-1">Aulas com Substituto</p>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200">
                                        <Info className="h-4 w-4 inline mr-1.5 text-blue-600" />
                                        As faltas com cobertura alocada via módulo de substituições mantêm 100% da frequência da turma sem interrupção pedagógica.
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* --- TAB 4: AMBIENTES & INFRAESTRUTURA --- */}
                    <TabsContent value="environments" className="space-y-6 mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="p-5">
                                <CardTitle className="text-sm text-slate-500">Total de Ambientes Físicos</CardTitle>
                                <div className="text-3xl font-black text-purple-600 mt-2">{filteredRooms.length}</div>
                                <p className="text-xs text-slate-500 mt-1">Salas, Laboratórios e Oficinas</p>
                            </Card>
                            <Card className="p-5">
                                <CardTitle className="text-sm text-slate-500">Taxa de Operação</CardTitle>
                                <div className="text-3xl font-black text-emerald-600 mt-2">{operationsStats.facilityHealth}%</div>
                                <p className="text-xs text-slate-500 mt-1">Espaços sem manutenções impeditivas</p>
                            </Card>
                            <Card className="p-5">
                                <CardTitle className="text-sm text-slate-500">Chamados Abertos</CardTitle>
                                <div className="text-3xl font-black text-amber-500 mt-2">{operationsStats.openIssues}</div>
                                <p className="text-xs text-slate-500 mt-1">Ocorrências de suporte ou avaria</p>
                            </Card>
                        </div>

                        <Card className="p-6">
                            <CardHeader className="px-0 pt-0">
                                <CardTitle className="text-lg font-bold">Ocupação de Ambientes Mais Demandados</CardTitle>
                                <CardDescription>Salas e laboratórios com maior taxa de uso.</CardDescription>
                            </CardHeader>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                {roomUsage.map(r => (
                                    <div key={r.name} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500">
                                            {r.type}
                                        </Badge>
                                        <p className="font-bold text-slate-900 dark:text-white truncate">{r.name}</p>
                                        <div className="flex items-center justify-between text-xs pt-1">
                                            <span className="text-slate-500">Agendamentos:</span>
                                            <span className="font-bold text-purple-600">{r.value}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </TabsContent>

                    {/* --- TAB 5: OPERAÇÕES & CONTINUIDADE --- */}
                    <TabsContent value="operations" className="space-y-6 mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6">
                                <CardHeader className="px-0 pt-0">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                                        Painel de Permutas de Aulas (Swaps)
                                    </CardTitle>
                                    <CardDescription>Fluxo de trocas solicitadas e deferidas entre professores.</CardDescription>
                                </CardHeader>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">Trocas Pendentes de Confirmação</span>
                                        <Badge variant="secondary" className="font-bold bg-amber-100 text-amber-800">
                                            {operationsStats.pendingSwaps} pendentes
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">Trocas Deferidas com Sucesso</span>
                                        <Badge variant="secondary" className="font-bold bg-emerald-100 text-emerald-800">
                                            {operationsStats.approvedSwaps} concluídas
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">Índice de Efetivação</span>
                                        <span className="font-black text-blue-600">{operationsStats.swapApprovalRate}%</span>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-6">
                                <CardHeader className="px-0 pt-0">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                        Garantia de Não-Conflito (Zero Collisions)
                                    </CardTitle>
                                    <CardDescription>Mecanismo automático que impede duplicidade de sala ou docente no mesmo turno.</CardDescription>
                                </CardHeader>
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 space-y-1">
                                        <p className="font-bold flex items-center gap-1.5">
                                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                                            Motor de Exclusão Ativo
                                        </p>
                                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                            Todas as inserções de grade são validadas em tempo real antes de persistir no banco.
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">Conflitos Ativos Detectados</span>
                                        <Badge variant={operationsStats.pendingConflicts === 0 ? "secondary" : "destructive"}>
                                            {operationsStats.pendingConflicts}
                                        </Badge>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

export default BIDashboard;
