import React, { useEffect, useState, useMemo } from 'react';
import { db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend, LabelList
} from 'recharts';
import { Clock, Calendar, Users, MapPin, BookOpen, Activity, ArrowUpRight, ArrowRightLeft, Package, Edit, LayoutDashboard, GripVertical, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, startOfWeek, startOfMonth, startOfYear, isAfter } from 'date-fns';
import { cn } from "@/lib/utils";
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

export function BIDashboard() {
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
    const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>("all");
    const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year' | 'all'>('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isRestricted, setIsRestricted] = useState(false);
    
    // Layout State
    const [layout, setLayout] = useState(() => {
        const saved = localStorage.getItem('bi-dashboard-layout');
        return saved ? JSON.parse(saved) : {
            lg: [
                { i: 'kpi-capacity', x: 0, y: 0, w: 1, h: 2 },
                { i: 'kpi-teachers', x: 1, y: 0, w: 1, h: 2 },
                { i: 'kpi-projects', x: 2, y: 0, w: 1, h: 2 },
                { i: 'kpi-completion', x: 3, y: 0, w: 1, h: 2 },
                { i: 'chart-projects', x: 0, y: 2, w: 1, h: 6 },
                { i: 'chart-shifts', x: 1, y: 2, w: 1, h: 6 },
                { i: 'chart-environments', x: 2, y: 2, w: 2, h: 6 },
                { i: 'chart-teachers-rank', x: 0, y: 8, w: 2, h: 6 },
                { i: 'chart-history', x: 2, y: 8, w: 2, h: 6 },
            ]
        };
    });

    const onLayoutChange = (currentLayout: any, allLayouts: any) => {
        setLayout(allLayouts);
        if (!isEditing) return;
        localStorage.setItem('bi-dashboard-layout', JSON.stringify(allLayouts));
    };

    const fetchData = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);

        const collectionsToFetch = [
            { key: 'schedules', coll: 'schedules', setter: setSchedules },
            { key: 'teachers', coll: 'teachers', setter: setTeachers },
            { key: 'rooms', coll: 'rooms', setter: setRooms },
            { key: 'classes', coll: 'classes', setter: setClasses },
            { key: 'absences', coll: 'absences', setter: setAbsences },
            { key: 'uniform_movements', coll: 'uniform_movements', setter: setUniformMovements },
            { key: 'project_demands', coll: 'project_demands', setter: setProjectDemands },
            { key: 'teacher_allocation', coll: 'teacher_allocation', setter: setTeacherAllocations },
            { key: 'projects', coll: 'projects', setter: setProjects },
            { key: 'courses', coll: 'courses', setter: setCourses },
            { key: 'units', coll: 'units', setter: setUnits }
        ];

        try {
            await Promise.all(collectionsToFetch.map(async ({ coll, setter }) => {
                try {
                    const snap = await getDocs(query(collection(db, coll)));
                    setter(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                } catch (err: any) {
                    if (err?.code === 'permission-denied') {
                        console.warn(`🔒 [BI DASHBOARD] Acesso restrito à coleção: ${coll}`);
                        setIsRestricted(true);
                        setter([]); // Fallback para lista vazia em caso de restrição
                    } else {
                        console.error(`Erro ao buscar ${coll}:`, err);
                    }
                }
            }));
            
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Error fetching BI data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filtros em memória baseados na unidade selecionada no BI
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
        return teacherAllocations.filter(a => teacherIdsInUnit.has(a.teacherId));
    }, [teacherAllocations, filteredTeachers, selectedUnitFilter]);

    const filteredAbsences = useMemo(() => {
        if (selectedUnitFilter === 'all') return absences;
        return absences.filter(a => a.unitId === selectedUnitFilter);
    }, [absences, selectedUnitFilter]);

    // Memoized Data Processing for Charts
    const stats = useMemo(() => {
        const activeAllocations = filteredTeacherAllocations.filter(a => a.status !== 'DELETED');
        const totalPlannedHours = activeAllocations.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
        // Se a coleção de professores estiver restrita, contamos os professores únicos alocados
        const effectiveTeachersCount = filteredTeachers.length > 0 ? filteredTeachers.length : new Set(activeAllocations.map(a => a.teacherId)).size;
        const potentialHours = effectiveTeachersCount * 35;
        const occupationRate = potentialHours > 0 ? (totalPlannedHours / potentialHours) * 100 : 0;

        return {
            totalSchedules: filteredSchedules.length,
            totalTeachers: effectiveTeachersCount,
            totalRooms: filteredRooms.length,
            totalClasses: filteredClasses.length,
            totalPlannedHours,
            occupationRate: Math.round(occupationRate)
        };
    }, [filteredSchedules, filteredTeachers, filteredRooms, filteredClasses, filteredTeacherAllocations]);

    // Cálculo de Conclusão de Turmas (PDR 2)
    const classCompletionData = useMemo(() => {
        if (filteredClasses.length === 0) return { average: 0, byClass: [] };

        const completionList = filteredClasses.map(cls => {
            const courseUnits = courses.find(c => c.id === cls.courseId)?.curricular_units || [];
            const totalRequiredHours = courseUnits.reduce((sum: number, unit: any) => sum + (Number(unit.hours) || 0), 0) || 160; // Fallback 160h se não achar curso
            
            const scheduledHours = filteredSchedules
                .filter(s => s.classId === cls.id)
                .reduce((sum, s) => sum + 4, 0); // Cada bloco = 4h

            const completeness = Math.min(Math.round((scheduledHours / totalRequiredHours) * 100), 100);
            return { name: cls.name, completeness };
        });

        const average = Math.round(completionList.reduce((sum, c) => sum + c.completeness, 0) / filteredClasses.length);
        
        return { average, byClass: completionList };
    }, [filteredClasses, filteredSchedules, courses]);

    const classShiftDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredClasses.forEach(c => {
            const shift = c.shift || c.period || "N/A";
            counts[shift] = (counts[shift] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredClasses]);

    const topTeachers = useMemo(() => {
        const counts: Record<string, number> = {};
        // Combine Macro (teacherAllocations) results for strategic view
        filteredTeacherAllocations.filter(a => a.status !== 'DELETED').forEach(a => {
            const name = a.teacherName || "ID: " + a.teacherId.substring(0, 5) + "...";
            counts[name] = (counts[name] || 0) + (Number(a.hours) || 0);
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [filteredTeacherAllocations, filteredTeachers]);

    const projectDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredTeacherAllocations.filter(a => a.status !== 'DELETED').forEach(a => {
            const project = projects.find(p => p.id === a.projectId);
            const course = !project ? courses.find(c => c.id === a.projectId || c.id === a.courseId) : null;
            
            const name = project?.name || course?.name || a.projectName || a.courseName;
            
            if (!name || name === "Institucional / Geral" || name.toLowerCase().includes("planejamento")) {
                return;
            }

            counts[name] = (counts[name] || 0) + (Number(a.hours) || 0);
        });

        const totalHours = Object.values(counts).reduce((sum, val) => sum + val, 0);

        return Object.entries(counts)
            .map(([name, value]) => ({ 
                name, 
                value,
                percentage: totalHours > 0 ? ((value / totalHours) * 100).toFixed(1) : "0"
            }))
            .sort((a,b) => b.value - a.value);
    }, [filteredTeacherAllocations, projects, courses]);

    const executionVsPlanningData = useMemo(() => {
        const data: Record<string, { name: string, planejado: number, executado: number }> = {};
        
        // Planning (Macro)
        filteredTeacherAllocations.filter(a => a.status !== 'DELETED').forEach(a => {
            const project = projects.find(p => p.id === a.projectId);
            const course = !project ? courses.find(c => c.id === a.projectId || c.id === a.courseId) : null;
            const name = project?.name || course?.name || a.projectName || a.courseName || "Institucional / Geral";
            
            if (!data[name]) data[name] = { name, planejado: 0, executado: 0 };
            data[name].planejado += (Number(a.hours) || 0);
        });

        // Execution (Micro - Schedules)
        filteredSchedules.forEach(s => {
            let name = "Institucional / Geral";
            
            // Try direct projectId/courseId on schedule first
            const project = projects.find(p => p.id === s.projectId);
            const course = !project ? courses.find(c => c.id === s.projectId || c.id === s.courseId) : null;
            
            if (project?.name || course?.name) {
                name = project?.name || course?.name || '';
            } else if (s.classId) {
                // Resolve via Class -> Course
                const cls = filteredClasses.find(c => c.id === s.classId);
                if (cls) {
                    const cRef = courses.find(c => c.id === cls.courseId);
                    if (cRef) name = cRef.name;
                    else if (cls.courseName) name = cls.courseName;
                }
            } else if (s.projectName || s.courseName) {
                name = s.projectName || s.courseName || '';
            }

            if (!data[name]) data[name] = { name, planejado: 0, executado: 0 };
            // Each schedule block is typically 4h
            data[name].executado += 4; 
        });

        return Object.values(data).sort((a, b) => b.planejado - a.planejado).slice(0, 6);
    }, [filteredTeacherAllocations, filteredSchedules, projects, courses, filteredClasses]);

    const roomUsage = useMemo(() => {
        const counts: Record<string, number> = {};
        const now = new Date();
        
        // Define o limite de data baseado no filtro
        let limitDate: Date | null = null;
        if (timeFilter === 'week') limitDate = startOfWeek(now);
        if (timeFilter === 'month') limitDate = startOfMonth(now);
        if (timeFilter === 'year') limitDate = startOfYear(now);

        filteredSchedules.forEach(s => {
            if (limitDate) {
                const sDate = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
                if (!isAfter(sDate, limitDate) && timeFilter !== 'all') return;
            }

            const rName = s.roomName || s.roomId || "Desconhecido";
            counts[rName] = (counts[rName] || 0) + 1;
        });
        
        return Object.entries(counts)
            .map(([name, count]) => ({ name, value: count }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [filteredSchedules, timeFilter]);

    const schedulesByMonth = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredSchedules.forEach(s => {
            if (s.startTime) {
                const date = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
                if (!isNaN(date.getTime())) {
                    const monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
                    counts[monthKey] = (counts[monthKey] || 0) + 1;
                }
            }
        });
        const sortedKeys = Object.keys(counts).sort((a, b) => {
            const [mA, yA] = a.split('/');
            const [mB, yB] = b.split('/');
            return new Date(Number(yA), Number(mA) - 1).getTime() - new Date(Number(yB), Number(mB) - 1).getTime();
        });
        return sortedKeys.map(k => ({ data: k, quantidade: counts[k] }));
    }, [filteredSchedules]);

    const totalSubstituted = filteredAbsences.reduce((sum, a) => sum + (a.totalResolvedSchedules || 0), 0);
    const totalAbsentBlocks = filteredAbsences.reduce((sum, a) => sum + (a.totalAffectedSchedules || 0), 0);
    const totalUniformExits = uniformMovements.filter(m => m.type === 'exit').reduce((sum, m) => sum + Number(m.quantity), 0);

    const absenceReasonsData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredAbsences.forEach(a => {
            const reasonMap: Record<string, string> = { medical: 'Médico', travel: 'Viagem', vacation: 'Férias', training: 'Treinamento', indefinite: 'Indefinido', other: 'Outros' };
            const r = reasonMap[a.reason] || a.reason;
            counts[r] = (counts[r] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredAbsences]);

    const uniformsExitsByProject = useMemo(() => {
        const counts: Record<string, number> = {};
        uniformMovements.filter(m => m.type === 'exit').forEach(m => {
            const p = m.projectName || 'Sem Projeto';
            counts[p] = (counts[p] || 0) + Number(m.quantity);
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0,5);
    }, [uniformMovements]);

    const demandVsActualData = useMemo(() => {
        const dataMap: Record<string, { name: string, planejado: number, distribuido: number }> = {};
        
        // Populate planejado
        projectDemands.forEach(demand => {
            let totalKitItems = 0;
            demand.kitConfigs?.forEach((k: any) => {
                totalKitItems += Number(k.quantityPerStudent);
            });
            const totalItemsPlanned = demand.expectedStudents * totalKitItems;
            dataMap[demand.projectId] = {
                name: demand.projectName || demand.id,
                planejado: totalItemsPlanned,
                distribuido: 0
            };
        });

        // Populate distribuido tracking for projects that are in demands
        uniformMovements.filter(m => m.type === 'exit').forEach(m => {
            if (m.projectId && dataMap[m.projectId]) {
                dataMap[m.projectId].distribuido += Number(m.quantity);
            }
        });

        return Object.values(dataMap);
    }, [projectDemands, uniformMovements]);

    const COLORS = [
        'hsl(217, 91%, 60%)', // Blue
        'hsl(142, 71%, 45%)', // Green
        'hsl(31, 90%, 55%)',  // Orange
        'hsl(346, 84%, 61%)', // Red/Pink
        'hsl(262, 83%, 58%)', // Purple
        'hsl(199, 89%, 48%)', // Sky
        'hsl(48, 96%, 53%)',  // Yellow
        'hsl(162, 98%, 35%)', // Emerald
    ];

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <Activity className="h-10 w-10 animate-spin text-blue-600" />
                    <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Carregando painel de BI...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-6 md:p-10 font-sans">
            <div className="max-w-[1600px] mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="space-y-2">
                        <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                            <Clock className="mr-1.5 h-3 w-3" />
                            Última atualização: {format(lastUpdated, 'HH:mm:ss')}
                        </div>
                        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">Painel Estratégico</h1>
                        <div className="flex items-center gap-2">
                            <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">
                                Indicadores de desempenho e ocupação da rede.
                            </p>
                            {isRestricted ? (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold animate-pulse">
                                    <Activity className="h-3 w-3" />
                                    ACESSO RESTRITO
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                    <CheckCircle2 className="h-3 w-3" />
                                    ACESSO TOTAL
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Select value={selectedUnitFilter} onValueChange={setSelectedUnitFilter}>
                            <SelectTrigger className="w-[200px] h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-200 shadow-sm focus:ring-2 focus:ring-primary/20">
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
                        <button
                            onClick={() => fetchData(true)}
                            disabled={refreshing}
                            className={cn(
                                "inline-flex items-center justify-center rounded-lg text-sm font-bold transition-all h-11 px-6 shadow-md active:scale-95 text-white shadow-primary/20",
                                refreshing ? "bg-primary/70 cursor-wait animate-pulse" : "bg-primary hover:bg-primary/90"
                            )}
                        >
                            <ArrowRightLeft className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
                            {refreshing ? "Atualizando..." : "Atualizar BI"}
                        </button>
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-all h-10 px-4 py-2 border shadow-sm ${
                                isEditing 
                                ? "bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200" 
                                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                            }`}
                        >
                            <Edit className="mr-2 h-4 w-4" />
                            {isEditing ? "Salvar Organização" : "Editar Grade"}
                        </button>
                        <button
                            onClick={() => window.open("/public-view", "_blank")}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-50 h-10 px-4 py-2"
                        >
                            <Calendar className="mr-2 h-4 w-4" />
                            Ver Grade Pública
                        </button>
                    </div>
                </div>

                {/* Responsive Grid Layout Container */}
                <ResponsiveGridLayout
                    className="layout"
                    layouts={layout}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 4, md: 2, sm: 2, xs: 1, xxs: 1 }}
                    rowHeight={60}
                    isDraggable={isEditing}
                    isResizable={isEditing}
                    onLayoutChange={onLayoutChange}
                    draggableHandle=".drag-handle"
                >
                    {/* KPIS / Summary Cards */}
                    <div key="kpi-capacity">
                        <Card className={`h-full hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 ${isEditing ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2 drag-handle cursor-grab active:cursor-grabbing">
                                <div className="flex items-center gap-2">
                                    {isEditing && <GripVertical className="h-4 w-4 text-amber-400" />}
                                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Capacidade de Rede</CardTitle>
                                </div>
                                <Activity className="h-5 w-5 text-blue-500" />
                            </CardHeader>
                            <CardContent className="pt-2">
                                <div className="text-3xl font-black">{stats.occupationRate}%</div>
                                <p className="text-xs text-slate-500 mt-1">
                                    {stats.totalPlannedHours}h alocadas de {filteredTeachers.length * 35}h potenciais
                                </p>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                                    <div 
                                        className="bg-blue-500 h-full rounded-full transition-all duration-1000" 
                                        style={{ width: `${stats.occupationRate}%` }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div key="kpi-teachers">
                        <Card className={`h-full hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500 ${isEditing ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2 drag-handle cursor-grab active:cursor-grabbing">
                                <div className="flex items-center gap-2">
                                    {isEditing && <GripVertical className="h-4 w-4 text-amber-400" />}
                                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Docentes Ativos</CardTitle>
                                </div>
                                <Users className="h-5 w-5 text-orange-500" />
                            </CardHeader>
                            <CardContent className="pt-2">
                                <div className="text-3xl font-black">{stats.totalTeachers}</div>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                    <ArrowUpRight className="h-3 w-3 text-green-500"/> {Math.round(stats.totalTeachers * 0.85)} em atuação esta semana
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div key="kpi-projects">
                        <Card className={`h-full hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500 ${isEditing ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2 drag-handle cursor-grab active:cursor-grabbing">
                                <div className="flex items-center gap-2">
                                    {isEditing && <GripVertical className="h-4 w-4 text-amber-400" />}
                                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Projetos Atendidos</CardTitle>
                                </div>
                                <Package className="h-5 w-5 text-purple-500" />
                            </CardHeader>
                            <CardContent className="pt-2">
                                <div className="text-3xl font-black">{projects.length}</div>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                    <ArrowUpRight className="h-3 w-3 text-green-500"/> {projectDemands.length} com demandas ativas
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div key="kpi-completion">
                        <Card className={`h-full hover:shadow-lg transition-all duration-300 border-l-4 border-l-emerald-500 ${isEditing ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2 drag-handle cursor-grab active:cursor-grabbing">
                                <div className="flex items-center gap-2">
                                    {isEditing && <GripVertical className="h-4 w-4 text-amber-400" />}
                                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Conclusão de Turmas</CardTitle>
                                </div>
                                <Activity className="h-5 w-5 text-emerald-500" />
                            </CardHeader>
                            <CardContent className="pt-2">
                                <div className="text-3xl font-black">{classCompletionData.average}%</div>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                    <ArrowUpRight className="h-3 w-3 text-green-500"/> Média de execução da rede
                                </p>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                                    <div 
                                        className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                                        style={{ width: `${classCompletionData.average}%` }}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Donut - Ocupação por Projeto */}
                    <div key="chart-projects">
                        <Card className={`h-full shadow-md ${isEditing ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
                            <CardHeader className="drag-handle cursor-grab active:cursor-grabbing flex flex-row items-center gap-2">
                                {isEditing && <GripVertical className="h-4 w-4 text-amber-400" />}
                                <div>
                                    <CardTitle className="text-lg font-bold">Alocação por Projeto</CardTitle>
                                    <CardDescription>Distribuição da carga horária macro planejada.</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px] w-full mt-4">
                                    {projectDistribution.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={projectDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis 
                                                    dataKey="name" 
                                                    stroke="#64748b" 
                                                    fontSize={10} 
                                                    tickLine={false} 
                                                    axisLine={false}
                                                    interval={0}
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={60}
                                                />
                                                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                                <RechartsTooltip 
                                                    cursor={{fill: '#f1f5f9'}}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                    formatter={(value: any, name: any, props: any) => [
                                                        `${value}h (${props.payload.percentage}%)`, 
                                                        'Alocação'
                                                    ]}
                                                />
                                                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30}>
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
                                        <div className="h-full flex items-center justify-center text-slate-400 font-medium">Sem dados de alocação.</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Pie - Turmas por Turno */}
                    <div key="chart-shifts">
                        <Card className={`h-full shadow-md ${isEditing ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
                            <CardHeader className="drag-handle cursor-grab active:cursor-grabbing flex flex-row items-center gap-2">
                                {isEditing && <GripVertical className="h-4 w-4 text-amber-400" />}
                                <div>
                                    <CardTitle className="text-lg font-bold">Turmas por Turno</CardTitle>
                                    <CardDescription>Ocupação da unidade por período.</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={classShiftDistribution}
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                dataKey="value"
                                                label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            >
                                                {classShiftDistribution.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Top Ambientes com Filtro Temporal */}
                    <div key="chart-environments">
                        <Card className={`h-full shadow-md ${isEditing ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 drag-handle cursor-grab active:cursor-grabbing">
                                <div className="flex items-center gap-2">
                                    {isEditing && <GripVertical className="h-4 w-4 text-amber-400" />}
                                    <div>
                                        <CardTitle className="text-lg font-bold">Ranking de Ambientes</CardTitle>
                                        <CardDescription>Salas e laboratórios agendados.</CardDescription>
                                    </div>
                                </div>
                                <div className="w-[140px]">
                                    <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
                                        <SelectTrigger className="bg-white/50 h-8 dark:bg-slate-900/50">
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
                            <CardContent>
                                <div className="h-[250px] w-full mt-4">
                                    {roomUsage.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={roomUsage} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                                                <RechartsTooltip 
                                                    cursor={{fill: '#f1f5f9'}}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Bar name="Agendamentos" dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-slate-400 font-medium">Sem agendamentos.</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Horizontal Bar - Top Docentes (Load) */}
                    <div key="chart-teachers-rank">
                        <Card className={`h-full shadow-md ${isEditing ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
                            <CardHeader className="drag-handle cursor-grab active:cursor-grabbing flex flex-row items-center gap-2">
                                {isEditing && <GripVertical className="h-4 w-4 text-amber-400" />}
                                <div>
                                    <CardTitle className="text-lg font-bold">Ranking de Carga</CardTitle>
                                    <CardDescription>Top 5 docentes (Macro).</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px] w-full mt-4">
                                    {topTeachers.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={topTeachers} layout="vertical" margin={{ left: 40, right: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} hide />
                                                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={100} />
                                                <RechartsTooltip 
                                                    cursor={{fill: 'transparent'}}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={25}>
                                                    {topTeachers.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-slate-400 font-medium">Sem dados.</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Evolução Temporal */}
                    <div key="chart-history">
                        <Card className={`h-full shadow-md hover:shadow-xl transition-shadow duration-500 ${isEditing ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
                            <CardHeader className="drag-handle cursor-grab active:cursor-grabbing flex flex-row items-center gap-2">
                                {isEditing && <GripVertical className="h-4 w-4 text-amber-400" />}
                                <div>
                                    <CardTitle className="text-lg font-bold">Atividade de Rede</CardTitle>
                                    <CardDescription>Evolução mensal de agendamentos.</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px] w-full mt-4">
                                    {schedulesByMonth.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={schedulesByMonth} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                                <XAxis dataKey="data" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} />
                                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} />
                                                <RechartsTooltip 
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="quantidade" 
                                                    stroke="#3b82f6" 
                                                    strokeWidth={4} 
                                                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} 
                                                    activeDot={{ r: 6, strokeWidth: 0 }} 
                                                    animationDuration={1500}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-slate-400 font-medium italic">Coletando histórico...</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </ResponsiveGridLayout>
            </div>
        </div>
    );
};

export default BIDashboard;
