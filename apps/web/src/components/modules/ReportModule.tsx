import { useState, useEffect } from "react";
import { db } from "@/lib/db";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/AuthContext";
import {
    collection,
    getDocs,
    query,
    limit,
    Timestamp,
} from "@/lib/sira-sql-adapter";
import { format, parseISO, differenceInHours, differenceInMinutes, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

// Bibliotecas para manipulação e exportação Excel (.xlsx)
import * as XLSX from "xlsx";

// Componentes de UI
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    FileText,
    Download,
    Calendar,
    Users,
    Layers,
    Package,
    History,
    FileSpreadsheet,
    Wrench,
    ArrowLeftRight,
    ShieldCheck,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Search,
    BookOpen,
    Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn, getUnitName } from "@/lib/utils";

// --- Tipagens de Apoio ---
interface Schedule {
    id: string;
    className?: string;
    teacherName?: string;
    roomName?: string;
    startTime?: any;
    endTime?: any;
    teacherId?: string;
    roomId?: string;
    classId?: string;
    observation?: string;
    scheduleStatus?: string;
    unitId?: string;
    unitIds?: string[];
}

interface Professor {
    id: string;
    name: string;
    unitId?: string;
    unitIds?: string[];
}

interface ClassDoc {
    id: string;
    name: string;
    unitId?: string;
    unitIds?: string[];
}

interface RoomDoc {
    id: string;
    name: string;
    unitId?: string;
    unitIds?: string[];
    block?: string;
}

interface AuditLogEntry {
    id: string;
    action: string;
    adminId: string;
    adminEmail: string;
    description: string;
    details: Record<string, any>;
    timestamp: any;
}

// Auxiliar para fuso e turno
function getTurnoFromDate(date: Date): string {
    const hour = (date.getUTCHours() - 4 + 24) % 24;
    if (hour >= 7 && hour < 13) return "Matutino";
    if (hour >= 13 && hour < 18) return "Vespertino";
    return "Noturno";
}

function safeToDate(val: any): Date | null {
    if (!val) return null;
    if (typeof val.toDate === "function") return val.toDate();
    if (val instanceof Date) return val;
    if (typeof val === "string") {
        const d = parseISO(val);
        return isValid(d) ? d : null;
    }
    return null;
}

export function ReportModule() {
    const { isUserAdmin, isUserSuperAdmin, userRole, userData } = usePermissions();
    const { currentUser } = useAuth();
    const selectedUnitId = userData?.selectedUnitId || "caceres";
    const isUserOrAdmin = userRole === "ADMIN" || userRole === "USER" || userRole === "SUPER_ADMIN";
    const isViniciusAdmin = isUserSuperAdmin();

    // Estados do Componente
    const [reportType, setReportType] = useState("schedules");
    const [reportData, setReportData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Filtros
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedProfessorId, setSelectedProfessorId] = useState("ALL");
    const [selectedRoomId, setSelectedRoomId] = useState("ALL");
    const [selectedClassId, setSelectedClassId] = useState("ALL");
    const [selectedAction, setSelectedAction] = useState("ALL");
    const [userFilter, setUserFilter] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    // Dados auxiliares para selects
    const [professors, setProfessors] = useState<Professor[]>([]);
    const [classes, setClasses] = useState<ClassDoc[]>([]);
    const [rooms, setRooms] = useState<RoomDoc[]>([]);

    const { toast } = useToast();

    // Limpar resultados ao trocar de tipo de relatório
    useEffect(() => {
        setReportData([]);
        setSearchTerm("");
    }, [reportType]);

    // Busca das entidades auxiliares da unidade
    useEffect(() => {
        if (!isUserOrAdmin) return;
        const fetchData = async () => {
            try {
                const [profsSnap, classesSnap, roomsSnap] = await Promise.all([
                    getDocs(collection(db, "teachers")),
                    getDocs(collection(db, "classes")),
                    getDocs(collection(db, "rooms")),
                ]);

                const matchesUnit = (docData: any) => {
                    if (!selectedUnitId) return true;
                    const uid = docData.unitId || "caceres";
                    if (uid === selectedUnitId) return true;
                    if (Array.isArray(docData.unitIds) && docData.unitIds.includes(selectedUnitId)) return true;
                    return false;
                };

                const profs = profsSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as Professor))
                    .filter(matchesUnit)
                    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

                const cls = classesSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as ClassDoc))
                    .filter(matchesUnit)
                    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

                const rms = roomsSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as RoomDoc))
                    .filter(matchesUnit)
                    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

                setProfessors(profs);
                setClasses(cls);
                setRooms(rms);
            } catch (err) {
                console.error("Erro ao carregar entidades para relatórios:", err);
            }
        };
        fetchData();
    }, [userRole, selectedUnitId, isUserOrAdmin]);

    // Função central que busca e processa os dados de acordo com o relatório selecionado
    const fetchReportData = async (): Promise<any[]> => {
        switch (reportType) {
            case "schedules":
            case "class-schedule":
            case "professor-load":
            case "environment-usage": {
                const schedulesSnap = await getDocs(collection(db, "schedules"));
                let rawSchedules = schedulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Schedule));

                // Filtragem por unidade (compatível com unitId e unitIds array)
                rawSchedules = rawSchedules.filter(s => {
                    if (!selectedUnitId) return true;
                    const uid = s.unitId || "caceres";
                    if (uid === selectedUnitId) return true;
                    if (Array.isArray(s.unitIds) && s.unitIds.includes(selectedUnitId)) return true;
                    return false;
                });

                // Filtragem por Período
                if (startDate) {
                    const start = parseISO(startDate);
                    rawSchedules = rawSchedules.filter(s => {
                        const sDate = safeToDate(s.startTime);
                        return sDate ? sDate >= start : false;
                    });
                }
                if (endDate) {
                    const end = parseISO(`${endDate}T23:59:59`);
                    rawSchedules = rawSchedules.filter(s => {
                        const sDate = safeToDate(s.startTime);
                        return sDate ? sDate <= end : false;
                    });
                }

                // Sub-filtros
                if (selectedProfessorId && selectedProfessorId !== "ALL") {
                    rawSchedules = rawSchedules.filter(s => s.teacherId === selectedProfessorId);
                }
                if (selectedRoomId && selectedRoomId !== "ALL") {
                    rawSchedules = rawSchedules.filter(s => s.roomId === selectedRoomId);
                }
                if (selectedClassId && selectedClassId !== "ALL") {
                    rawSchedules = rawSchedules.filter(s => s.classId === selectedClassId);
                }

                // 1. Agendamentos Gerais
                if (reportType === "schedules" || reportType === "class-schedule") {
                    return rawSchedules.sort((a, b) => {
                        const da = safeToDate(a.startTime)?.getTime() || 0;
                        const dbVal = safeToDate(b.startTime)?.getTime() || 0;
                        return da - dbVal;
                    });
                }

                // 2. Carga Horária Docente
                if (reportType === "professor-load") {
                    const map = new Map<string, {
                        teacherId: string;
                        teacherName: string;
                        totalMinutes: number;
                        sessions: number;
                        classes: Set<string>;
                        rooms: Set<string>;
                    }>();

                    rawSchedules.forEach(sc => {
                        const tId = sc.teacherId || "sem-docente";
                        const tName = sc.teacherName || "Docente Não Informado";
                        const sDate = safeToDate(sc.startTime);
                        const eDate = safeToDate(sc.endTime);
                        const minutes = (sDate && eDate) ? Math.max(0, differenceInMinutes(eDate, sDate)) : 0;

                        if (!map.has(tId)) {
                            map.set(tId, {
                                teacherId: tId,
                                teacherName: tName,
                                totalMinutes: 0,
                                sessions: 0,
                                classes: new Set(),
                                rooms: new Set(),
                            });
                        }
                        const rec = map.get(tId)!;
                        rec.totalMinutes += minutes;
                        rec.sessions += 1;
                        if (sc.className) rec.classes.add(sc.className);
                        if (sc.roomName) rec.rooms.add(sc.roomName);
                    });

                    return Array.from(map.values()).map(r => ({
                        teacherId: r.teacherId,
                        teacherName: r.teacherName,
                        totalHours: Number((r.totalMinutes / 60).toFixed(2)),
                        formattedHours: `${Math.floor(r.totalMinutes / 60)}h ${r.totalMinutes % 60}m`,
                        sessions: r.sessions,
                        classesCount: r.classes.size,
                        classesList: Array.from(r.classes).join(", ") || "-",
                        roomsList: Array.from(r.rooms).join(", ") || "-",
                    })).sort((a, b) => b.totalHours - a.totalHours);
                }

                // 3. Uso de Ambientes
                if (reportType === "environment-usage") {
                    const map = new Map<string, {
                        roomId: string;
                        roomName: string;
                        totalMinutes: number;
                        sessions: number;
                        teachers: Set<string>;
                        classes: Set<string>;
                    }>();

                    rawSchedules.forEach(sc => {
                        const rId = sc.roomId || "sem-sala";
                        const rName = sc.roomName || "Ambiente Não Informado";
                        const sDate = safeToDate(sc.startTime);
                        const eDate = safeToDate(sc.endTime);
                        const minutes = (sDate && eDate) ? Math.max(0, differenceInMinutes(eDate, sDate)) : 0;

                        if (!map.has(rId)) {
                            map.set(rId, {
                                roomId: rId,
                                roomName: rName,
                                totalMinutes: 0,
                                sessions: 0,
                                teachers: new Set(),
                                classes: new Set(),
                            });
                        }
                        const rec = map.get(rId)!;
                        rec.totalMinutes += minutes;
                        rec.sessions += 1;
                        if (sc.teacherName) rec.teachers.add(sc.teacherName);
                        if (sc.className) rec.classes.add(sc.className);
                    });

                    return Array.from(map.values()).map(r => ({
                        roomId: r.roomId,
                        roomName: r.roomName,
                        totalHours: Number((r.totalMinutes / 60).toFixed(2)),
                        formattedHours: `${Math.floor(r.totalMinutes / 60)}h ${r.totalMinutes % 60}m`,
                        sessions: r.sessions,
                        teachersList: Array.from(r.teachers).join(", ") || "-",
                        classesList: Array.from(r.classes).join(", ") || "-",
                    })).sort((a, b) => b.totalHours - a.totalHours);
                }

                return [];
            }

            case "uniforms-stock": {
                const uSnap = await getDocs(collection(db, "uniform_movements"));
                const mvts = uSnap.docs.map(d => d.data());

                const balanceMap: Record<string, {
                    uniformName: string;
                    size: string;
                    entries: number;
                    exits: number;
                    balance: number;
                }> = {};

                mvts.forEach(mov => {
                    const unif = mov.uniformName || "Uniforme/EPI";
                    const sz = mov.size || "Único";
                    const key = `${unif}__${sz}`;

                    if (!balanceMap[key]) {
                        balanceMap[key] = {
                            uniformName: unif,
                            size: sz,
                            entries: 0,
                            exits: 0,
                            balance: 0,
                        };
                    }

                    const qty = Number(mov.quantity) || 0;
                    if (mov.type === "entry" || mov.type === "adjustment") {
                        balanceMap[key].entries += qty;
                        balanceMap[key].balance += qty;
                    } else {
                        balanceMap[key].exits += qty;
                        balanceMap[key].balance -= qty;
                    }
                });

                let list = Object.values(balanceMap).map(item => ({
                    ...item,
                    status: item.balance <= 0 ? "Zerado" : item.balance < 5 ? "Baixo" : "Normal",
                }));

                if (searchTerm) {
                    const lower = searchTerm.toLowerCase();
                    list = list.filter(i => i.uniformName.toLowerCase().includes(lower) || i.size.toLowerCase().includes(lower));
                }

                return list.sort((a, b) => a.uniformName.localeCompare(b.uniformName) || a.size.localeCompare(b.size));
            }

            case "system-audit": {
                const audSnap = await getDocs(query(collection(db, "uniform_movements"), limit(1000)));
                let audData = audSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Filtro por período
                if (startDate) {
                    const start = parseISO(startDate);
                    audData = audData.filter((a: any) => {
                        const d = safeToDate(a.createdAt);
                        return d ? d >= start : false;
                    });
                }
                if (endDate) {
                    const end = parseISO(`${endDate}T23:59:59`);
                    audData = audData.filter((a: any) => {
                        const d = safeToDate(a.createdAt);
                        return d ? d <= end : false;
                    });
                }

                if (searchTerm) {
                    const lower = searchTerm.toLowerCase();
                    audData = audData.filter((a: any) =>
                        (a.uniformName && a.uniformName.toLowerCase().includes(lower)) ||
                        (a.createdBy && a.createdBy.toLowerCase().includes(lower)) ||
                        (a.reason && a.reason.toLowerCase().includes(lower))
                    );
                }

                return audData.sort((a: any, b: any) => {
                    const da = safeToDate(a.createdAt)?.getTime() || 0;
                    const dbVal = safeToDate(b.createdAt)?.getTime() || 0;
                    return dbVal - da;
                });
            }

            case "assets-inventory": {
                const assetsSnap = await getDocs(collection(db, "assets"));
                let assetsData = assetsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Filtro de unidade
                assetsData = assetsData.filter((a: any) => {
                    if (!selectedUnitId) return true;
                    return (a.unitId || "caceres") === selectedUnitId;
                });

                if (selectedRoomId && selectedRoomId !== "ALL") {
                    assetsData = assetsData.filter((a: any) => a.roomId === selectedRoomId);
                }

                if (searchTerm) {
                    const lower = searchTerm.toLowerCase();
                    assetsData = assetsData.filter((a: any) =>
                        (a.name && a.name.toLowerCase().includes(lower)) ||
                        (a.roomName && a.roomName.toLowerCase().includes(lower))
                    );
                }

                return assetsData.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
            }

            case "schedule-swaps": {
                const swapsSnap = await getDocs(collection(db, "scheduleSwaps"));
                let swapsData = swapsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Filtro de unidade
                swapsData = swapsData.filter((s: any) => {
                    if (!selectedUnitId) return true;
                    return !s.unitId || s.unitId === selectedUnitId;
                });

                if (searchTerm) {
                    const lower = searchTerm.toLowerCase();
                    swapsData = swapsData.filter((s: any) =>
                        (s.teacherName && s.teacherName.toLowerCase().includes(lower)) ||
                        (s.targetTeacherName && s.targetTeacherName.toLowerCase().includes(lower)) ||
                        (s.reason && s.reason.toLowerCase().includes(lower))
                    );
                }

                return swapsData.sort((a: any, b: any) => {
                    const da = safeToDate(a.createdAt)?.getTime() || 0;
                    const dbVal = safeToDate(b.createdAt)?.getTime() || 0;
                    return dbVal - da;
                });
            }

            case "user-activity": {
                if (!isUserAdmin()) throw new Error("Acesso restrito para administradores.");
                const auditSnap = await getDocs(query(collection(db, "audit_logs"), limit(1000)));
                let logs = auditSnap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry));

                if (startDate) {
                    const start = parseISO(startDate);
                    logs = logs.filter(l => {
                        const d = safeToDate(l.timestamp);
                        return d ? d >= start : false;
                    });
                }
                if (endDate) {
                    const end = parseISO(`${endDate}T23:59:59`);
                    logs = logs.filter(l => {
                        const d = safeToDate(l.timestamp);
                        return d ? d <= end : false;
                    });
                }

                if (selectedAction !== "ALL") {
                    logs = logs.filter(l => l.action === selectedAction);
                }

                if (userFilter) {
                    const lower = userFilter.toLowerCase();
                    logs = logs.filter(l =>
                        (l.adminEmail && l.adminEmail.toLowerCase().includes(lower)) ||
                        (l.adminId && l.adminId.toLowerCase().includes(lower))
                    );
                }

                return logs.sort((a, b) => {
                    const da = safeToDate(a.timestamp)?.getTime() || 0;
                    const dbVal = safeToDate(b.timestamp)?.getTime() || 0;
                    return dbVal - da;
                });
            }

            case "teacher-monitoring": {
                if (!isViniciusAdmin) throw new Error("Acesso restrito à Coordenação Pedagógica.");
                const [recordsSnap, tSnap] = await Promise.all([
                    getDocs(collection(db, "teacherMonitoringRecords")),
                    getDocs(collection(db, "teachers")),
                ]);

                const teachersList = tSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as any))
                    .filter(t => !selectedUnitId || !t.unitId || t.unitId === selectedUnitId || t.unitIds?.includes(selectedUnitId));

                const records = recordsSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as any))
                    .filter(r => !selectedUnitId || !r.unitId || r.unitId === selectedUnitId);

                // Mapear por professor
                const recMap = new Map<string, any>();
                records.forEach(r => recMap.set(r.teacherId, r));

                const monitoringList = teachersList.map(t => {
                    const r = recMap.get(t.id);
                    return {
                        teacherId: t.id,
                        teacherName: t.name,
                        area: t.area || r?.area || "Geral",
                        vinculo: r?.vinculo || (t.type === "clt" ? "Quadro" : "Horista"),
                        status: r?.status || "pendente",
                        msepCompliance: r?.msepCompliance || "Não avaliado",
                        feedbackSent: r?.feedbackSent ? "Sim" : "Não",
                        feedbackDate: r?.feedbackDate || "-",
                        actionPlansCount: r?.actionPlans ? r.actionPlans.length : 0,
                        actionPlansDone: r?.actionPlans ? r.actionPlans.filter((p: any) => p.status === "concluido").length : 0,
                    };
                });

                return monitoringList.sort((a, b) => a.teacherName.localeCompare(b.teacherName));
            }

            default:
                return [];
        }
    };

    // Geração do relatório para exibição na tela
    const handleGenerateReport = async () => {
        setIsLoading(true);
        try {
            const data = await fetchReportData();
            setReportData(data);
            toast({
                title: "Relatório Gerado com Sucesso",
                description: `${data.length} registros encontrados para os filtros aplicados.`,
            });
        } catch (error: any) {
            console.error("Erro ao gerar relatório:", error);
            toast({
                title: "Erro ao Gerar Relatório",
                description: error.message || "Verifique os filtros selecionados.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-ajuste de colunas para Excel
    const autoFitColumns = (json: Record<string, any>[]) => {
        if (!json || json.length === 0) return [];
        const keys = Object.keys(json[0]);
        return keys.map(key => {
            let maxLen = key.length;
            for (const row of json) {
                const val = row[key];
                if (val !== undefined && val !== null) {
                    const str = String(val);
                    if (str.length > maxLen) {
                        maxLen = str.length;
                    }
                }
            }
            return { wch: Math.min(Math.max(maxLen + 3, 12), 60) };
        });
    };

    // Exportação para Excel (.xlsx) com mapeamento profissional
    const performExcelExport = (data: any[]) => {
        if (!data || data.length === 0) {
            toast({
                title: "Sem Dados para Exportar",
                description: "Não foram encontrados registros para o relatório selecionado.",
                variant: "destructive",
            });
            return;
        }

        let dataForExport: any[] = [];
        let sheetName = "Relatorio";

        switch (reportType) {
            case "schedules":
            case "class-schedule":
                dataForExport = data.map(item => {
                    const sDate = safeToDate(item.startTime);
                    const eDate = safeToDate(item.endTime);
                    const durationHours = (sDate && eDate) ? (differenceInMinutes(eDate, sDate) / 60).toFixed(2) : "0.00";

                    return {
                        "Turma": item.className || "Não Informada",
                        "Professor": item.teacherName || "Não Informado",
                        "Ambiente / Sala": item.roomName || "Não Informado",
                        "Data": sDate ? format(sDate, "dd/MM/yyyy") : "-",
                        "Dia da Semana": sDate ? format(sDate, "EEEE", { locale: ptBR }) : "-",
                        "Turno": sDate ? getTurnoFromDate(sDate) : "-",
                        "Hora Início": sDate ? format(sDate, "HH:mm") : "-",
                        "Hora Fim": eDate ? format(eDate, "HH:mm") : "-",
                        "Duração (Horas)": durationHours,
                        "Status": item.scheduleStatus || "Confirmado",
                        "Observações": item.observation || "-",
                    };
                });
                sheetName = reportType === "class-schedule" ? "Grade_Turma" : "Agendamentos";
                break;

            case "professor-load":
                dataForExport = data.map(item => ({
                    "Professor": item.teacherName,
                    "Total de Aulas (Sessões)": item.sessions,
                    "Total de Horas (Decimal)": item.totalHours,
                    "Carga Horária Formatada": item.formattedHours,
                    "Qtd. Turmas Distintas": item.classesCount,
                    "Turmas Atendidas": item.classesList,
                    "Ambientes Utilizados": item.roomsList,
                }));
                sheetName = "Carga_Docente";
                break;

            case "environment-usage":
                dataForExport = data.map(item => ({
                    "Ambiente / Sala": item.roomName,
                    "Total de Aulas (Sessões)": item.sessions,
                    "Total de Horas Ocupadas": item.totalHours,
                    "Ocupação Formatada": item.formattedHours,
                    "Docentes que Utilizaram": item.teachersList,
                    "Turmas que Utilizaram": item.classesList,
                }));
                sheetName = "Uso_Ambientes";
                break;

            case "uniforms-stock":
                dataForExport = data.map(item => ({
                    "Item (Uniforme / EPI)": item.uniformName,
                    "Tamanho": item.size,
                    "Total Entradas": item.entries,
                    "Total Saídas": item.exits,
                    "Saldo Físico Atual": item.balance,
                    "Situação de Estoque": item.status,
                }));
                sheetName = "Estoque_Uniformes";
                break;

            case "assets-inventory":
                dataForExport = data.map(item => ({
                    "Ativo / Equipamento": item.name,
                    "Tipo": item.type === "equipment" ? "Equipamento" : item.type === "tool" ? "Ferramenta" : "Consumível",
                    "Ambiente / Sala": item.roomName || "-",
                    "Quantidade": item.quantity,
                    "Status Operacional": item.status === "available" ? "Disponível" : item.status === "in_use" ? "Em Uso" : item.status === "maintenance" ? "Manutenção" : item.status === "broken" ? "Avariado" : "Esgotado",
                    "Requer Atenção": item.requiresAttention ? "Sim" : "Não",
                    "Observações": item.notes || "-",
                }));
                sheetName = "Inventario_Ativos";
                break;

            case "schedule-swaps":
                dataForExport = data.map(item => {
                    const cDate = safeToDate(item.createdAt);
                    return {
                        "Data da Solicitação": cDate ? format(cDate, "dd/MM/yyyy HH:mm") : "-",
                        "Professor Solicitante": item.teacherName || "-",
                        "Professor Substituto": item.targetTeacherName || "-",
                        "Status da Troca": item.status === "accepted" ? "Aprovada" : item.status === "rejected" ? "Recusada" : item.status === "pending" ? "Pendente" : item.status || "-",
                        "Motivo / Justificativa": item.reason || item.message || "-",
                        "Data da Resposta": item.responseDate ? format(safeToDate(item.responseDate) || new Date(), "dd/MM/yyyy HH:mm") : "-",
                    };
                });
                sheetName = "Trocas_Horario";
                break;

            case "system-audit":
                dataForExport = data.map(item => {
                    const cDate = safeToDate(item.createdAt);
                    return {
                        "Data / Hora": cDate ? format(cDate, "dd/MM/yyyy HH:mm") : "-",
                        "Operação": item.type === "entry" ? "Entrada" : item.type === "exit" ? "Saída" : item.type === "adjustment" ? "Ajuste" : item.type === "loss" ? "Baixa / Perda" : item.type || "-",
                        "Item": item.uniformName || "-",
                        "Tamanho": item.size || "-",
                        "Quantidade": item.quantity || 0,
                        "Projeto / Centro de Custo": item.projectName || "-",
                        "Turma / Destinatário": item.className || item.studentName || "-",
                        "Operador Responsável": item.createdBy || "-",
                        "Motivo / Justificativa": item.reason || "-",
                    };
                });
                sheetName = "Auditoria_Estoque";
                break;

            case "user-activity":
                dataForExport = data.map(item => {
                    const tDate = safeToDate(item.timestamp);
                    return {
                        "Data / Hora": tDate ? format(tDate, "dd/MM/yyyy HH:mm") : "-",
                        "Operador (E-mail)": item.adminEmail || "-",
                        "ID do Usuário": item.adminId || "-",
                        "Ação Realizada": item.action || "-",
                        "Descrição": item.description || "-",
                        "Detalhes Técnicos": JSON.stringify(item.details || {}),
                    };
                });
                sheetName = "Atividade_Usuarios";
                break;

            case "teacher-monitoring":
                dataForExport = data.map(item => ({
                    "Professor": item.teacherName,
                    "Eixo Tecnológico": item.area,
                    "Vínculo": item.vinculo,
                    "Status Acompanhamento": item.status,
                    "Conformidade MSEP": item.msepCompliance,
                    "Devolutiva Realizada": item.feedbackSent,
                    "Data Devolutiva": item.feedbackDate,
                    "Planos de Ação Criados": item.actionPlansCount,
                    "Planos de Ação Concluídos": item.actionPlansDone,
                }));
                sheetName = "Acompanhamento_Docente";
                break;

            default:
                dataForExport = data;
        }

        const ws = XLSX.utils.json_to_sheet(dataForExport);
        ws["!cols"] = autoFitColumns(dataForExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

        const fileName = `relatorio_${reportType}_${selectedUnitId}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
        XLSX.writeFile(wb, fileName);

        toast({
            title: "Planilha Excel Exportada!",
            description: `Arquivo ${fileName} gerado com ${dataForExport.length} linhas.`,
        });
    };

    // Exportação em 1 clique direto da barra de ferramentas
    const handleDirectExport = async () => {
        setIsExporting(true);
        try {
            let data = reportData;
            if (data.length === 0) {
                data = await fetchReportData();
                setReportData(data);
            }
            performExcelExport(data);
        } catch (error: any) {
            console.error("Erro na exportação para Excel:", error);
            toast({
                title: "Falha na Exportação",
                description: error.message || "Não foi possível gerar a planilha Excel.",
                variant: "destructive",
            });
        } finally {
            setIsExporting(false);
        }
    };

    // Bloqueio de acesso para perfis não autorizados
    if (!isUserOrAdmin) {
        return (
            <div className="flex items-center justify-center h-[70vh]">
                <div className="text-center p-8 bg-white dark:bg-slate-900 rounded-xl shadow-md border max-w-md">
                    <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
                    <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
                    <p className="text-muted-foreground text-sm">
                        Você não possui perfil com permissão operacional ou administrativa para acessar o módulo de relatórios.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <PageLayout>
            <Tabs value={reportType} onValueChange={setReportType} className="flex-1 flex flex-col min-h-0">
                <PageHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
                                <FileSpreadsheet className="h-7 w-7 text-blue-600" />
                                Central de Relatórios & Exportação
                            </h2>
                            <p className="text-muted-foreground text-sm mt-1">
                                Análise operacional, carga horária docente, ocupação de ambientes e exportação para Excel (.xlsx) na unidade <span className="font-semibold text-slate-800 dark:text-slate-200">{getUnitName(selectedUnitId)}</span>.
                            </p>
                        </div>
                    </div>

                    {/* Abas de Tipos de Relatórios */}
                    <TabsList className="mb-0 flex-wrap h-auto gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
                        <TabsTrigger value="schedules" className="flex items-center gap-1.5 text-xs">
                            <Calendar className="h-3.5 w-3.5" />
                            Agendamentos
                        </TabsTrigger>
                        <TabsTrigger value="professor-load" className="flex items-center gap-1.5 text-xs">
                            <Users className="h-3.5 w-3.5" />
                            Carga Horária
                        </TabsTrigger>
                        <TabsTrigger value="environment-usage" className="flex items-center gap-1.5 text-xs">
                            <Layers className="h-3.5 w-3.5" />
                            Uso de Ambientes
                        </TabsTrigger>
                        <TabsTrigger value="class-schedule" className="flex items-center gap-1.5 text-xs">
                            <BookOpen className="h-3.5 w-3.5" />
                            Por Turma
                        </TabsTrigger>
                        <TabsTrigger value="uniforms-stock" className="flex items-center gap-1.5 text-xs">
                            <Package className="h-3.5 w-3.5" />
                            Saldo de Estoque
                        </TabsTrigger>
                        <TabsTrigger value="assets-inventory" className="flex items-center gap-1.5 text-xs">
                            <Wrench className="h-3.5 w-3.5" />
                            Inventário de Ativos
                        </TabsTrigger>
                        <TabsTrigger value="schedule-swaps" className="flex items-center gap-1.5 text-xs">
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            Trocas de Horário
                        </TabsTrigger>
                        <TabsTrigger value="system-audit" className="flex items-center gap-1.5 text-xs">
                            <History className="h-3.5 w-3.5" />
                            Auditoria Estoque
                        </TabsTrigger>
                        {isUserAdmin() && (
                            <TabsTrigger value="user-activity" className="flex items-center gap-1.5 text-xs">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Atividade Usuários
                            </TabsTrigger>
                        )}
                        {isViniciusAdmin && (
                            <TabsTrigger value="teacher-monitoring" className="flex items-center gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                                Acompanhamento Docente
                            </TabsTrigger>
                        )}
                    </TabsList>
                </PageHeader>

                <PageContent>
                    {/* Painel de Filtros e Ações */}
                    <Card className="mb-6 shadow-sm border-slate-200 dark:border-slate-800">
                        <CardHeader className="pb-3 pt-4 px-6 border-b bg-slate-50/50 dark:bg-slate-900/30">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        Filtros de Parâmetros
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Configure os intervalos de datas e critérios de filtragem para geração ou exportação imediata.
                                    </CardDescription>
                                </div>
                                <Badge variant="secondary" className="font-mono text-xs">
                                    Unidade: {selectedUnitId}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 px-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
                                {/* Filtros por Período */}
                                {(reportType === "schedules" ||
                                    reportType === "professor-load" ||
                                    reportType === "environment-usage" ||
                                    reportType === "class-schedule" ||
                                    reportType === "system-audit" ||
                                    reportType === "user-activity") && (
                                    <>
                                        <div className="flex flex-col space-y-1.5">
                                            <Label htmlFor="report-start-date" className="text-xs font-semibold">Data Início</Label>
                                            <Input
                                                id="report-start-date"
                                                type="date"
                                                value={startDate}
                                                onChange={e => setStartDate(e.target.value)}
                                                className="h-9 text-xs"
                                            />
                                        </div>
                                        <div className="flex flex-col space-y-1.5">
                                            <Label htmlFor="report-end-date" className="text-xs font-semibold">Data Fim</Label>
                                            <Input
                                                id="report-end-date"
                                                type="date"
                                                value={endDate}
                                                onChange={e => setEndDate(e.target.value)}
                                                className="h-9 text-xs"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Filtro por Professor */}
                                {(reportType === "schedules" || reportType === "professor-load") && (
                                    <div className="flex flex-col space-y-1.5">
                                        <Label className="text-xs font-semibold">Professor (Opcional)</Label>
                                        <Select value={selectedProfessorId} onValueChange={setSelectedProfessorId}>
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="Todos os professores" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">Todos os professores</SelectItem>
                                                {professors.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Filtro por Ambiente */}
                                {(reportType === "schedules" || reportType === "environment-usage" || reportType === "assets-inventory") && (
                                    <div className="flex flex-col space-y-1.5">
                                        <Label className="text-xs font-semibold">Ambiente / Sala (Opcional)</Label>
                                        <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="Todos os ambientes" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">Todos os ambientes</SelectItem>
                                                {rooms.map(r => (
                                                    <SelectItem key={r.id} value={r.id}>{r.name} {r.block ? `(${r.block})` : ""}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Filtro por Turma */}
                                {(reportType === "schedules" || reportType === "class-schedule") && (
                                    <div className="flex flex-col space-y-1.5">
                                        <Label className="text-xs font-semibold">
                                            {reportType === "class-schedule" ? "Turma Selecionada *" : "Turma (Opcional)"}
                                        </Label>
                                        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="Todas as turmas" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ALL">Todas as turmas</SelectItem>
                                                {classes.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Busca Textual para Estoque, Ativos, Trocas e Auditoria */}
                                {(reportType === "uniforms-stock" ||
                                    reportType === "assets-inventory" ||
                                    reportType === "schedule-swaps" ||
                                    reportType === "system-audit") && (
                                    <div className="flex flex-col space-y-1.5">
                                        <Label className="text-xs font-semibold">Pesquisar Item / Responsável</Label>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Digite para filtrar..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="h-9 pl-8 text-xs"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Filtros para Atividade de Usuários */}
                                {reportType === "user-activity" && (
                                    <>
                                        <div className="flex flex-col space-y-1.5">
                                            <Label className="text-xs font-semibold">Filtrar por Ação</Label>
                                            <Select value={selectedAction} onValueChange={setSelectedAction}>
                                                <SelectTrigger className="h-9 text-xs">
                                                    <SelectValue placeholder="Todas as ações" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ALL">Todas as ações</SelectItem>
                                                    <SelectItem value="CREATE_USER">Criação de Usuário</SelectItem>
                                                    <SelectItem value="UPDATE_USER">Edição de Usuário</SelectItem>
                                                    <SelectItem value="CREATE_SCHEDULE">Novo Agendamento</SelectItem>
                                                    <SelectItem value="UPDATE_SCHEDULE">Edição de Agendamento</SelectItem>
                                                    <SelectItem value="DELETE_SCHEDULE">Exclusão de Agendamento</SelectItem>
                                                    <SelectItem value="LOGIN">Logins</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex flex-col space-y-1.5">
                                            <Label className="text-xs font-semibold">Operador (E-mail / ID)</Label>
                                            <Input
                                                placeholder="ex: admin@senai.br"
                                                value={userFilter}
                                                onChange={e => setUserFilter(e.target.value)}
                                                className="h-9 text-xs"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Botões de Ação na Barra */}
                                <div className="flex items-center gap-2 pt-1 sm:col-span-2 md:col-span-1 lg:col-span-1">
                                    <Button
                                        onClick={handleGenerateReport}
                                        disabled={isLoading || isExporting}
                                        className="h-9 text-xs flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                                    >
                                        <FileText className="h-4 w-4 mr-1.5" />
                                        {isLoading ? "Gerando..." : "Gerar"}
                                    </Button>

                                    <Button
                                        onClick={handleDirectExport}
                                        disabled={isLoading || isExporting}
                                        variant="outline"
                                        className="h-9 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 dark:text-emerald-400 font-semibold"
                                        title="Exporta diretamente para planilha Excel (.xlsx)"
                                    >
                                        <Download className="h-4 w-4 mr-1.5 text-emerald-600" />
                                        {isExporting ? "Exportando..." : "Excel"}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Exibição dos Resultados */}
                    {reportData.length > 0 ? (
                        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-6 border-b">
                                <div>
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        Registros do Relatório
                                        <Badge variant="secondary" className="font-mono text-xs ml-2">
                                            {reportData.length} registros
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Dados consolidados para o relatório de{" "}
                                        <strong className="text-slate-800 dark:text-slate-200">{reportType}</strong>.
                                    </CardDescription>
                                </div>
                                <Button
                                    onClick={() => performExcelExport(reportData)}
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                                >
                                    <Download className="h-4 w-4 mr-1.5" />
                                    Exportar para Excel (.xlsx)
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto w-full">
                                    <Table>
                                        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                            <TableRow>
                                                {(reportType === "schedules" || reportType === "class-schedule") && (
                                                    <>
                                                        <TableHead className="font-bold text-xs">Turma</TableHead>
                                                        <TableHead className="font-bold text-xs">Professor</TableHead>
                                                        <TableHead className="font-bold text-xs">Ambiente</TableHead>
                                                        <TableHead className="font-bold text-xs">Data</TableHead>
                                                        <TableHead className="font-bold text-xs">Turno</TableHead>
                                                        <TableHead className="font-bold text-xs">Início</TableHead>
                                                        <TableHead className="font-bold text-xs">Fim</TableHead>
                                                        <TableHead className="font-bold text-xs">Duração</TableHead>
                                                    </>
                                                )}

                                                {reportType === "professor-load" && (
                                                    <>
                                                        <TableHead className="font-bold text-xs">Professor</TableHead>
                                                        <TableHead className="font-bold text-xs text-center">Aulas (Sessões)</TableHead>
                                                        <TableHead className="font-bold text-xs text-center">Total de Horas</TableHead>
                                                        <TableHead className="font-bold text-xs">Turmas Atendidas</TableHead>
                                                        <TableHead className="font-bold text-xs">Ambientes Utilizados</TableHead>
                                                    </>
                                                )}

                                                {reportType === "environment-usage" && (
                                                    <>
                                                        <TableHead className="font-bold text-xs">Ambiente / Sala</TableHead>
                                                        <TableHead className="font-bold text-xs text-center">Aulas (Sessões)</TableHead>
                                                        <TableHead className="font-bold text-xs text-center">Horas Ocupadas</TableHead>
                                                        <TableHead className="font-bold text-xs">Professores</TableHead>
                                                        <TableHead className="font-bold text-xs">Turmas</TableHead>
                                                    </>
                                                )}

                                                {reportType === "uniforms-stock" && (
                                                    <>
                                                        <TableHead className="font-bold text-xs">Item (Uniforme / EPI)</TableHead>
                                                        <TableHead className="font-bold text-xs">Tamanho</TableHead>
                                                        <TableHead className="font-bold text-xs text-center">Total Entradas</TableHead>
                                                        <TableHead className="font-bold text-xs text-center">Total Saídas</TableHead>
                                                        <TableHead className="font-bold text-xs text-center">Saldo Físico</TableHead>
                                                        <TableHead className="font-bold text-xs">Status</TableHead>
                                                    </>
                                                )}

                                                {reportType === "assets-inventory" && (
                                                    <>
                                                        <TableHead className="font-bold text-xs">Ativo / Equipamento</TableHead>
                                                        <TableHead className="font-bold text-xs">Tipo</TableHead>
                                                        <TableHead className="font-bold text-xs">Ambiente</TableHead>
                                                        <TableHead className="font-bold text-xs text-center">Quantidade</TableHead>
                                                        <TableHead className="font-bold text-xs">Status</TableHead>
                                                        <TableHead className="font-bold text-xs">Atenção?</TableHead>
                                                    </>
                                                )}

                                                {reportType === "schedule-swaps" && (
                                                    <>
                                                        <TableHead className="font-bold text-xs">Data Solicitação</TableHead>
                                                        <TableHead className="font-bold text-xs">Professor Solicitante</TableHead>
                                                        <TableHead className="font-bold text-xs">Professor Proposto</TableHead>
                                                        <TableHead className="font-bold text-xs">Motivo</TableHead>
                                                        <TableHead className="font-bold text-xs">Status</TableHead>
                                                    </>
                                                )}

                                                {reportType === "system-audit" && (
                                                    <>
                                                        <TableHead className="font-bold text-xs">Data / Hora</TableHead>
                                                        <TableHead className="font-bold text-xs">Operação</TableHead>
                                                        <TableHead className="font-bold text-xs">Item & Tamanho</TableHead>
                                                        <TableHead className="font-bold text-xs text-center">Qtd</TableHead>
                                                        <TableHead className="font-bold text-xs">Responsável</TableHead>
                                                        <TableHead className="font-bold text-xs">Motivo / Destino</TableHead>
                                                    </>
                                                )}

                                                {reportType === "user-activity" && (
                                                    <>
                                                        <TableHead className="font-bold text-xs">Data / Hora</TableHead>
                                                        <TableHead className="font-bold text-xs">Operador</TableHead>
                                                        <TableHead className="font-bold text-xs">Ação</TableHead>
                                                        <TableHead className="font-bold text-xs">Descrição</TableHead>
                                                    </>
                                                )}

                                                {reportType === "teacher-monitoring" && (
                                                    <>
                                                        <TableHead className="font-bold text-xs">Professor</TableHead>
                                                        <TableHead className="font-bold text-xs">Eixo</TableHead>
                                                        <TableHead className="font-bold text-xs">Vínculo</TableHead>
                                                        <TableHead className="font-bold text-xs">Status</TableHead>
                                                        <TableHead className="font-bold text-xs">MSEP</TableHead>
                                                        <TableHead className="font-bold text-xs">Devolutiva</TableHead>
                                                        <TableHead className="font-bold text-xs text-center">Planos Ação</TableHead>
                                                    </>
                                                )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {reportData.map((item, index) => {
                                                const sDate = safeToDate(item.startTime);
                                                const eDate = safeToDate(item.endTime);
                                                const durationHours = (sDate && eDate) ? (differenceInMinutes(eDate, sDate) / 60).toFixed(2) : "0.00";

                                                return (
                                                    <TableRow key={item.id || index} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-xs">
                                                        {(reportType === "schedules" || reportType === "class-schedule") && (
                                                            <>
                                                                <TableCell className="font-semibold">{item.className || "-"}</TableCell>
                                                                <TableCell>{item.teacherName || "-"}</TableCell>
                                                                <TableCell>{item.roomName || "-"}</TableCell>
                                                                <TableCell>{sDate ? format(sDate, "dd/MM/yyyy") : "-"}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="text-[10px]">
                                                                        {sDate ? getTurnoFromDate(sDate) : "-"}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>{sDate ? format(sDate, "HH:mm") : "-"}</TableCell>
                                                                <TableCell>{eDate ? format(eDate, "HH:mm") : "-"}</TableCell>
                                                                <TableCell className="font-mono">{durationHours}h</TableCell>
                                                            </>
                                                        )}

                                                        {reportType === "professor-load" && (
                                                            <>
                                                                <TableCell className="font-semibold">{item.teacherName}</TableCell>
                                                                <TableCell className="text-center font-mono">{item.sessions}</TableCell>
                                                                <TableCell className="text-center font-bold text-blue-600 font-mono">
                                                                    {item.formattedHours} ({item.totalHours}h)
                                                                </TableCell>
                                                                <TableCell className="max-w-xs truncate text-muted-foreground">{item.classesList}</TableCell>
                                                                <TableCell className="max-w-xs truncate text-muted-foreground">{item.roomsList}</TableCell>
                                                            </>
                                                        )}

                                                        {reportType === "environment-usage" && (
                                                            <>
                                                                <TableCell className="font-semibold">{item.roomName}</TableCell>
                                                                <TableCell className="text-center font-mono">{item.sessions}</TableCell>
                                                                <TableCell className="text-center font-bold text-emerald-600 font-mono">
                                                                    {item.formattedHours} ({item.totalHours}h)
                                                                </TableCell>
                                                                <TableCell className="max-w-xs truncate text-muted-foreground">{item.teachersList}</TableCell>
                                                                <TableCell className="max-w-xs truncate text-muted-foreground">{item.classesList}</TableCell>
                                                            </>
                                                        )}

                                                        {reportType === "uniforms-stock" && (
                                                            <>
                                                                <TableCell className="font-semibold">{item.uniformName}</TableCell>
                                                                <TableCell><Badge variant="outline">{item.size}</Badge></TableCell>
                                                                <TableCell className="text-center font-mono text-emerald-600">+{item.entries}</TableCell>
                                                                <TableCell className="text-center font-mono text-rose-600">-{item.exits}</TableCell>
                                                                <TableCell className="text-center font-bold text-base font-mono">{item.balance}</TableCell>
                                                                <TableCell>
                                                                    <Badge className={cn(
                                                                        "text-[10px] uppercase font-bold",
                                                                        item.status === "Normal" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                                                        item.status === "Baixo" ? "bg-amber-100 text-amber-800 border-amber-200" :
                                                                        "bg-rose-100 text-rose-800 border-rose-200"
                                                                    )}>
                                                                        {item.status}
                                                                    </Badge>
                                                                </TableCell>
                                                            </>
                                                        )}

                                                        {reportType === "assets-inventory" && (
                                                            <>
                                                                <TableCell className="font-semibold">{item.name}</TableCell>
                                                                <TableCell className="capitalize text-muted-foreground">{item.type}</TableCell>
                                                                <TableCell>{item.roomName || "-"}</TableCell>
                                                                <TableCell className="text-center font-mono font-bold">{item.quantity}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="text-[10px] capitalize">
                                                                        {item.status === "available" ? "Disponível" : item.status === "in_use" ? "Em Uso" : item.status === "maintenance" ? "Manutenção" : item.status || "-"}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {item.requiresAttention ? (
                                                                        <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px]">Sim</Badge>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">Não</span>
                                                                    )}
                                                                </TableCell>
                                                            </>
                                                        )}

                                                        {reportType === "schedule-swaps" && (
                                                            <>
                                                                <TableCell>
                                                                    {item.createdAt ? format(safeToDate(item.createdAt) || new Date(), "dd/MM/yyyy HH:mm") : "-"}
                                                                </TableCell>
                                                                <TableCell className="font-medium">{item.teacherName}</TableCell>
                                                                <TableCell className="font-medium">{item.targetTeacherName}</TableCell>
                                                                <TableCell className="max-w-xs truncate text-muted-foreground">{item.reason || item.message || "-"}</TableCell>
                                                                <TableCell>
                                                                    <Badge className={cn(
                                                                        "text-[10px] font-bold uppercase",
                                                                        item.status === "accepted" ? "bg-emerald-100 text-emerald-800" :
                                                                        item.status === "rejected" ? "bg-rose-100 text-rose-800" :
                                                                        "bg-amber-100 text-amber-800"
                                                                    )}>
                                                                        {item.status === "accepted" ? "Aprovada" : item.status === "rejected" ? "Recusada" : "Pendente"}
                                                                    </Badge>
                                                                </TableCell>
                                                            </>
                                                        )}

                                                        {reportType === "system-audit" && (
                                                            <>
                                                                <TableCell>
                                                                    {item.createdAt ? format(safeToDate(item.createdAt) || new Date(), "dd/MM/yyyy HH:mm") : "-"}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="uppercase text-[10px]">
                                                                        {item.type}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="font-medium">{item.uniformName} ({item.size})</TableCell>
                                                                <TableCell className="text-center font-mono font-bold">{item.quantity}</TableCell>
                                                                <TableCell className="text-muted-foreground">{item.createdBy}</TableCell>
                                                                <TableCell className="max-w-xs truncate text-muted-foreground">
                                                                    {item.reason || item.projectName || "-"}
                                                                </TableCell>
                                                            </>
                                                        )}

                                                        {reportType === "user-activity" && (
                                                            <>
                                                                <TableCell>
                                                                    {item.timestamp ? format(safeToDate(item.timestamp) || new Date(), "dd/MM/yyyy HH:mm") : "-"}
                                                                </TableCell>
                                                                <TableCell className="font-medium">{item.adminEmail}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className={cn(
                                                                        "uppercase text-[10px] font-bold",
                                                                        item.action.includes("DELETE") ? "border-red-200 text-red-700 bg-red-50" :
                                                                        item.action.includes("CREATE") ? "border-green-200 text-green-700 bg-green-50" :
                                                                        item.action.includes("UPDATE") ? "border-blue-200 text-blue-700 bg-blue-50" : ""
                                                                    )}>
                                                                        {item.action.replace(/_/g, " ")}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-xs text-muted-foreground max-w-sm truncate">{item.description}</TableCell>
                                                            </>
                                                        )}

                                                        {reportType === "teacher-monitoring" && (
                                                            <>
                                                                <TableCell className="font-semibold">{item.teacherName}</TableCell>
                                                                <TableCell className="text-muted-foreground">{item.area}</TableCell>
                                                                <TableCell><Badge variant="outline" className="capitalize">{item.vinculo}</Badge></TableCell>
                                                                <TableCell>
                                                                    <Badge className={cn(
                                                                        "text-[10px] uppercase font-bold",
                                                                        item.status === "concluido" ? "bg-emerald-100 text-emerald-800" :
                                                                        item.status === "em_andamento" ? "bg-blue-100 text-blue-800" :
                                                                        item.status === "dispensado" ? "bg-slate-100 text-slate-700" :
                                                                        "bg-amber-100 text-amber-800"
                                                                    )}>
                                                                        {item.status}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="capitalize">{item.msepCompliance}</TableCell>
                                                                <TableCell>{item.feedbackSent}</TableCell>
                                                                <TableCell className="text-center font-mono">
                                                                    {item.actionPlansDone}/{item.actionPlansCount}
                                                                </TableCell>
                                                            </>
                                                        )}
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="shadow-sm border-dashed border-slate-300 dark:border-slate-800 py-12">
                            <CardContent className="flex flex-col items-center justify-center text-center">
                                <div className="h-14 w-14 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center mb-3 text-blue-600">
                                    <FileSpreadsheet className="h-7 w-7" />
                                </div>
                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                    Pronto para Gerar ou Exportar
                                </h3>
                                <p className="text-xs text-muted-foreground max-w-md mt-1 mb-4">
                                    Ajuste os filtros de período e seleções acima e clique em <strong>Gerar</strong> para visualizar os dados na tela, ou em <strong>Excel</strong> para baixar diretamente a planilha formatada.
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={handleGenerateReport}
                                        disabled={isLoading}
                                        className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        <FileText className="h-3.5 w-3.5 mr-1" />
                                        Visualizar na Tela
                                    </Button>
                                    <Button
                                        onClick={handleDirectExport}
                                        disabled={isExporting}
                                        variant="outline"
                                        className="h-8 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 font-semibold"
                                    >
                                        <Download className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                                        Baixar Planilha Excel
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </PageContent>
            </Tabs>
        </PageLayout>
    );
}