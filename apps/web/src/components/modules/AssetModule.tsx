import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/db";
import { 
    collection, 
    onSnapshot, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    orderBy, 
    where, 
    writeBatch 
} from "@/lib/sira-sql-adapter";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/AuthContext";
import { 
    subscribeToRoomIssues, 
    updateRoomIssueStatus, 
    RoomIssue, 
    subscribeToUnitSchedulesWithInspections, 
    RoomItemConfig 
} from "@/services/inspectionService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
    Plus, 
    Edit, 
    Trash2, 
    AlertTriangle, 
    Wrench, 
    Package, 
    Search, 
    Monitor, 
    CheckCircle, 
    ShieldAlert, 
    CheckCircle2, 
    UserCheck, 
    ShieldCheck, 
    MapPin, 
    User, 
    ArrowRightLeft, 
    Shield, 
    Tv, 
    Wind, 
    BookOpen, 
    X, 
    Sparkles, 
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    CalendarDays,
    Clock,
    LayoutList,
    Table as TableIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
    format, 
    isToday, 
    startOfWeek, 
    endOfWeek, 
    addWeeks, 
    subWeeks, 
    isSameWeek, 
    isSameDay, 
    eachDayOfInterval 
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { TeacherIssueModule } from "./TeacherIssueModule";

interface AssetReport {
    id: string;
    assetId: string;
    assetName: string;
    roomName: string;
    reportedBy: string;
    description: string;
    status: "open" | "in_progress" | "resolved";
    createdAt: any;
    unitId?: string;
}

interface Room {
    id: string;
    name: string;
    type: string;
    block?: string;
    floor?: string;
    capacity?: number;
    unitId?: string;
    items?: RoomItemConfig[];
}

interface InventoryItemView extends RoomItemConfig {
    roomId: string;
    roomName: string;
    roomBlock?: string;
    roomFloor?: string;
    hasOpenIssue?: boolean;
    openIssueCount?: number;
}

interface AssetModuleProps {
    initialTab?: "assets" | "usage" | "reports";
}

const CATEGORY_MAP: Record<RoomItemConfig["category"], { label: string; color: string; icon: any }> = {
    ferramentas: { label: "Ferramentas", color: "bg-orange-50 text-orange-700 border-orange-200", icon: Wrench },
    epi: { label: "EPI & Segurança", color: "bg-amber-50 text-amber-800 border-amber-200", icon: Shield },
    informatica: { label: "Informática & TI", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Monitor },
    audiovisual: { label: "Audiovisual", color: "bg-purple-50 text-purple-700 border-purple-200", icon: Tv },
    climatizacao: { label: "Climatização", color: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: Wind },
    didatico: { label: "Didático & Móveis", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: BookOpen },
    outro: { label: "Outros", color: "bg-slate-50 text-slate-700 border-slate-200", icon: Package }
};

export function AssetModule({ initialTab = "usage" }: AssetModuleProps) {
    const { userData, userRole, isProfessor } = usePermissions();
    if (isProfessor?.() || userRole === "PROFESSOR") {
        return <TeacherIssueModule />;
    }
    const { currentUser } = useAuth();
    const selectedUnitId = userData?.selectedUnitId || "caceres";
    const [activeTab, setActiveTab] = useState<"assets" | "usage" | "reports">(initialTab);
    const [reports, setReports] = useState<AssetReport[]>([]);
    const [roomIssues, setRoomIssues] = useState<RoomIssue[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [unitSchedules, setUnitSchedules] = useState<any[]>([]);

    // --- Filtros e Estados do Inventário de Equipamentos ---
    const [inventorySearchTerm, setInventorySearchTerm] = useState("");
    const [inventoryRoomFilter, setInventoryRoomFilter] = useState<string>("all");
    const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>("all");

    // Dialog Cadastro / Edição de Item
    const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<{ item: RoomItemConfig; roomId: string } | null>(null);
    const [formRoomId, setFormRoomId] = useState("");
    const [formName, setFormName] = useState("");
    const [formCategory, setFormCategory] = useState<RoomItemConfig["category"]>("ferramentas");
    const [formCode, setFormCode] = useState("");
    const [formQuantity, setFormQuantity] = useState(1);
    const [formIsEssential, setFormIsEssential] = useState(false);
    const [formSubItems, setFormSubItems] = useState<string[]>([]);
    const [subItemInput, setSubItemInput] = useState("");
    const [isSavingItem, setIsSavingItem] = useState(false);

    // Dialog Transferência de Sala (Movimentação)
    const [transferringItem, setTransferringItem] = useState<{ item: RoomItemConfig; roomId: string; roomName: string } | null>(null);
    const [targetRoomId, setTargetRoomId] = useState("");
    const [isTransferring, setIsTransferring] = useState(false);

    // Dialog Limpar Itens Cadastrados
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
    const [clearScope, setClearScope] = useState<"selected_room" | "all_rooms">("all_rooms");
    const [isClearing, setIsClearing] = useState(false);

    // --- Filtros e Estados de Custódia e Uso ---
    const [usageFilter, setUsageFilter] = useState<"all" | "today" | "pending_checkin" | "with_issues">("all");
    const [usageRoomFilter, setUsageRoomFilter] = useState<string>("all");
    const [usageTeacherSearch, setUsageTeacherSearch] = useState<string>("");
    const [selectedScheduleDetails, setSelectedScheduleDetails] = useState<any | null>(null);

    // Sincroniza activeTab caso initialTab mude via navegação
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    // --- Navegação Semanal de Custódia e Uso ---
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [weekViewMode, setWeekViewMode] = useState<"week" | "all">("week");
    const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);
    const [displayMode, setDisplayMode] = useState<"grouped" | "table">("grouped");
    const [hasAutoJumped, setHasAutoJumped] = useState(false);

    // Auto-ajuste para a semana com aulas se a semana atual não possuir nenhuma aula cadastrada
    useEffect(() => {
        if (!hasAutoJumped && unitSchedules.length > 0) {
            const now = new Date();
            const wStart = startOfWeek(now, { weekStartsOn: 1 });
            const wEnd = endOfWeek(now, { weekStartsOn: 1 });
            const hasSchedulesThisWeek = unitSchedules.some(s => {
                const d = s.startTime?.toDate ? s.startTime.toDate() : null;
                return d && d >= wStart && d <= wEnd;
            });
            if (!hasSchedulesThisWeek) {
                let bestDate: Date | null = null;
                let minDiff = Infinity;
                const nowMs = now.getTime();
                unitSchedules.forEach(s => {
                    const d = s.startTime?.toDate ? s.startTime.toDate() : null;
                    if (!d) return;
                    const diff = Math.abs(d.getTime() - nowMs);
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestDate = d;
                    }
                });
                if (bestDate) {
                    setCurrentWeekStart(startOfWeek(bestDate, { weekStartsOn: 1 }));
                }
            }
            setHasAutoJumped(true);
        }
    }, [unitSchedules, hasAutoJumped]);

    // --- Resolução de Ocorrências ---
    const [resolvingIssue, setResolvingIssue] = useState<RoomIssue | null>(null);
    const [resolutionText, setResolutionText] = useState("");
    const [isResolving, setIsResolving] = useState(false);

    const { toast } = useToast();

    useEffect(() => {
        // Carregar Ambientes da unidade em tempo real
        const roomsQuery = query(collection(db, "rooms"), where("unitId", "==", selectedUnitId));
        const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
            setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
        });

        // Carregar Relatórios legados de Ativos
        const reportsQuery = query(collection(db, "asset_reports"), orderBy("createdAt", "desc"));
        const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
            const allReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssetReport));
            setReports(allReports.filter(r => !r.unitId || r.unitId === selectedUnitId));
        });

        // Carregar Ocorrências de Vistorias de Sala (Check-in/Out)
        const unsubIssues = subscribeToRoomIssues(selectedUnitId, (issues) => {
            setRoomIssues(issues);
        });

        // Carregar Agendamentos para Custódia e Histórico de Uso
        const unsubSchedules = subscribeToUnitSchedulesWithInspections(selectedUnitId, (schedules) => {
            setUnitSchedules(schedules);
        });

        return () => {
            unsubRooms();
            unsubReports();
            unsubIssues();
            unsubSchedules();
        };
    }, [selectedUnitId]);

    // Lista consolidada de todos os itens cadastrados em todas as salas
    const allInventoryItems: InventoryItemView[] = useMemo(() => {
        const list: InventoryItemView[] = [];
        rooms.forEach(room => {
            if (room.items && Array.isArray(room.items)) {
                room.items.forEach(item => {
                    const openIssues = roomIssues.filter(
                        iss => (iss.roomId === room.id || iss.roomName === room.name) &&
                               (iss.itemId === item.id || iss.itemName?.toLowerCase() === item.name?.toLowerCase()) &&
                               iss.status === "open"
                    );
                    list.push({
                        ...item,
                        roomId: room.id,
                        roomName: room.name,
                        roomBlock: room.block,
                        roomFloor: room.floor,
                        hasOpenIssue: openIssues.length > 0,
                        openIssueCount: openIssues.length
                    });
                });
            }
        });
        return list;
    }, [rooms, roomIssues]);

    // Lista filtrada para exibição
    const filteredInventoryItems = useMemo(() => {
        return allInventoryItems.filter(item => {
            if (inventoryRoomFilter !== "all" && item.roomId !== inventoryRoomFilter) {
                return false;
            }
            if (inventoryCategoryFilter !== "all" && item.category !== inventoryCategoryFilter) {
                return false;
            }
            if (inventorySearchTerm.trim()) {
                const search = inventorySearchTerm.toLowerCase();
                const matchName = item.name.toLowerCase().includes(search);
                const matchRoom = item.roomName.toLowerCase().includes(search);
                const matchCode = (item.code || "").toLowerCase().includes(search);
                const matchSub = (item.subItems || []).some(s => s.toLowerCase().includes(search));
                if (!matchName && !matchRoom && !matchCode && !matchSub) return false;
            }
            return true;
        });
    }, [allInventoryItems, inventoryRoomFilter, inventoryCategoryFilter, inventorySearchTerm]);

    // --- Cálculos e Navegação Semanal de Custódia ---
    const currentWeekEnd = useMemo(() => endOfWeek(currentWeekStart, { weekStartsOn: 1 }), [currentWeekStart]);
    const isCurrentWeek = useMemo(() => isSameWeek(currentWeekStart, new Date(), { weekStartsOn: 1 }), [currentWeekStart]);
    const weekDays = useMemo(() => eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd }), [currentWeekStart, currentWeekEnd]);

    // Agendamentos pertencentes à semana selecionada
    const baseWeekSchedules = useMemo(() => {
        if (weekViewMode === "all") return unitSchedules;
        return unitSchedules.filter(item => {
            const d = item.startTime?.toDate ? item.startTime.toDate() : null;
            if (!d) return false;
            return d >= currentWeekStart && d <= currentWeekEnd;
        });
    }, [unitSchedules, weekViewMode, currentWeekStart, currentWeekEnd]);

    // Métricas semanais calculadas para os cards
    const weeklyMetrics = useMemo(() => {
        const total = baseWeekSchedules.length;
        const checkInCount = baseWeekSchedules.filter(s => s.checkInCompleted).length;
        const checkOutCount = baseWeekSchedules.filter(s => s.checkOutCompleted).length;
        const issuesCount = baseWeekSchedules.filter(s => s.checkInDiscrepancy || s.checkOutDiscrepancy).length;

        return {
            total,
            checkInCount,
            checkInPct: total > 0 ? Math.round((checkInCount / total) * 100) : 0,
            checkOutCount,
            checkOutPct: total > 0 ? Math.round((checkOutCount / total) * 100) : 0,
            issuesCount
        };
    }, [baseWeekSchedules]);

    // Agendamentos filtrados com buscas e filtros secundários
    const finalFilteredSchedules = useMemo(() => {
        return baseWeekSchedules.filter(item => {
            const d = item.startTime?.toDate ? item.startTime.toDate() : null;
            if (!d) return false;

            if (selectedDayFilter) {
                if (format(d, "yyyy-MM-dd") !== selectedDayFilter) return false;
            }

            if (usageTeacherSearch.trim()) {
                const search = usageTeacherSearch.toLowerCase();
                const teacherMatch = (item.teacherName || "").toLowerCase().includes(search);
                const classMatch = (item.className || "").toLowerCase().includes(search);
                if (!teacherMatch && !classMatch) return false;
            }

            if (usageRoomFilter !== "all") {
                if ((item.roomName || "") !== usageRoomFilter) return false;
            }

            if (usageFilter === "today") {
                if (!isToday(d)) return false;
            } else if (usageFilter === "pending_checkin") {
                if (item.checkInCompleted) return false;
            } else if (usageFilter === "with_issues") {
                if (!item.checkInDiscrepancy && !item.checkOutDiscrepancy) return false;
            }

            return true;
        });
    }, [baseWeekSchedules, selectedDayFilter, usageTeacherSearch, usageRoomFilter, usageFilter]);

    // Agrupamento por dia (para visualização agrupada em seções por dia)
    const schedulesGroupedByDay = useMemo(() => {
        const groupsMap = new Map<string, any[]>();
        finalFilteredSchedules.forEach(item => {
            const d = item.startTime?.toDate ? item.startTime.toDate() : null;
            if (!d) return;
            const key = format(d, "yyyy-MM-dd");
            if (!groupsMap.has(key)) {
                groupsMap.set(key, []);
            }
            groupsMap.get(key)!.push(item);
        });

        const sortedKeys = Array.from(groupsMap.keys()).sort();
        return sortedKeys.map(key => {
            const items = groupsMap.get(key)!;
            items.sort((a, b) => {
                const tA = a.startTime?.toMillis ? a.startTime.toMillis() : 0;
                const tB = b.startTime?.toMillis ? b.startTime.toMillis() : 0;
                return tA - tB;
            });
            const firstDate = items[0].startTime.toDate();
            return {
                dateKey: key,
                date: firstDate,
                label: format(firstDate, "EEEE, dd 'de' MMMM", { locale: ptBR }),
                schedules: items
            };
        });
    }, [finalFilteredSchedules]);

    // Data de agendamento mais próxima caso a semana selecionada esteja vazia
    const nearestScheduleDate = useMemo(() => {
        if (baseWeekSchedules.length > 0 || unitSchedules.length === 0) return null;
        const currentMs = currentWeekStart.getTime();
        let bestSched: any = null;
        let minDiff = Infinity;
        unitSchedules.forEach(s => {
            const d = s.startTime?.toDate ? s.startTime.toDate() : null;
            if (!d) return;
            const diff = Math.abs(d.getTime() - currentMs);
            if (diff < minDiff) {
                minDiff = diff;
                bestSched = s;
            }
        });
        return bestSched?.startTime?.toDate ? bestSched.startTime.toDate() : null;
    }, [baseWeekSchedules, unitSchedules, currentWeekStart]);

    const handlePrevWeek = () => {
        setCurrentWeekStart(prev => subWeeks(prev, 1));
        setSelectedDayFilter(null);
    };

    const handleNextWeek = () => {
        setCurrentWeekStart(prev => addWeeks(prev, 1));
        setSelectedDayFilter(null);
    };

    const handleThisWeek = () => {
        setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
        setSelectedDayFilter(null);
    };

    const renderScheduleRow = (sched: any) => {
        const startTime = sched.startTime?.toDate ? sched.startTime.toDate() : null;
        const endTime = sched.endTime?.toDate ? sched.endTime.toDate() : null;
        const hasIssue = sched.checkInDiscrepancy || sched.checkOutDiscrepancy;

        return (
            <TableRow key={sched.id} className="h-14 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors">
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        <span>{sched.roomName || "Sala"}</span>
                    </div>
                </TableCell>
                <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                    {startTime ? (
                        <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{format(startTime, "dd/MM/yy")}</span>
                            <span className="text-slate-400"> • </span>
                            <span>{format(startTime, "HH:mm")} - {endTime ? format(endTime, "HH:mm") : "--"}</span>
                        </div>
                    ) : "--"}
                </TableCell>
                <TableCell className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{sched.teacherName || "Docente"}</span>
                    </div>
                </TableCell>
                <TableCell className="text-xs text-slate-600 dark:text-slate-300 max-w-[170px] truncate" title={sched.className}>
                    {sched.className || "Reserva"}
                </TableCell>
                <TableCell>
                    {sched.checkInCompleted ? (
                        <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 font-semibold gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            {sched.checkInAt?.toDate ? format(sched.checkInAt.toDate(), "HH:mm") : "Feito"}
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-[10px]">
                            Pendente
                        </Badge>
                    )}
                </TableCell>
                <TableCell>
                    {sched.checkOutCompleted ? (
                        <Badge className="bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 font-semibold gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            {sched.checkOutAt?.toDate ? format(sched.checkOutAt.toDate(), "HH:mm") : "Feito"}
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-slate-500 text-[10px]">
                            Não realizado
                        </Badge>
                    )}
                </TableCell>
                <TableCell>
                    {hasIssue ? (
                        <Badge variant="destructive" className="font-semibold text-[10px] gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Avaria Apontada
                        </Badge>
                    ) : (
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Conforme
                        </span>
                    )}
                </TableCell>
                <TableCell className="text-right">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-semibold"
                        onClick={() => setSelectedScheduleDetails(sched)}
                    >
                        Detalhes
                    </Button>
                </TableCell>
            </TableRow>
        );
    };

    const renderScheduleTable = (schedules: any[]) => (
        <div className="overflow-x-auto rounded-lg border">
            <Table>
                <TableHeader className="bg-slate-50/70 dark:bg-slate-900/50">
                    <TableRow>
                        <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Ambiente</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Data & Horário</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Docente Responsável</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Turma / UC</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Check-in</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Check-out</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Integridade / Avarias</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300 text-right">Ação</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {schedules.map(sched => renderScheduleRow(sched))}
                </TableBody>
            </Table>
        </div>
    );

    // --- Handlers do Inventário de Itens ---
    const handleOpenAddItem = (preselectedRoomId?: string) => {
        setEditingItem(null);
        setFormRoomId(preselectedRoomId || (inventoryRoomFilter !== "all" ? inventoryRoomFilter : rooms[0]?.id || ""));
        setFormName("");
        setFormCategory("ferramentas");
        setFormCode("");
        setFormQuantity(1);
        setFormIsEssential(false);
        setFormSubItems([]);
        setSubItemInput("");
        setIsItemDialogOpen(true);
    };

    const handleOpenEditItem = (item: InventoryItemView) => {
        setEditingItem({ item, roomId: item.roomId });
        setFormRoomId(item.roomId);
        setFormName(item.name);
        setFormCategory(item.category);
        setFormCode(item.code || "");
        setFormQuantity(item.quantity || 1);
        setFormIsEssential(!!item.isEssential);
        setFormSubItems(item.subItems || []);
        setSubItemInput("");
        setIsItemDialogOpen(true);
    };

    const handleAddSubItem = () => {
        const text = subItemInput.trim();
        if (!text) return;
        if (!formSubItems.includes(text)) {
            setFormSubItems(prev => [...prev, text]);
        }
        setSubItemInput("");
    };

    const handleRemoveSubItem = (index: number) => {
        setFormSubItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveInventoryItem = async () => {
        if (!formRoomId) {
            toast({ title: "Erro", description: "Selecione o ambiente onde o item está alocado.", variant: "destructive" });
            return;
        }
        if (!formName.trim()) {
            toast({ title: "Erro", description: "Informe o nome ou descrição do item.", variant: "destructive" });
            return;
        }

        setIsSavingItem(true);
        const buildItemPayload = (baseItem?: RoomItemConfig): RoomItemConfig => {
            const payload: RoomItemConfig = {
                id: baseItem?.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                name: formName.trim(),
                category: formCategory,
                quantity: Number(formQuantity) || 1,
                isEssential: !!formIsEssential
            };
            if (formCode.trim()) {
                payload.code = formCode.trim();
            }
            if (formSubItems.length > 0) {
                payload.subItems = formSubItems;
            }
            return payload;
        };

        try {
            if (editingItem) {
                const updatedItem = buildItemPayload(editingItem.item);

                // Se a sala de destino mudou na edição:
                if (formRoomId !== editingItem.roomId) {
                    const sourceRoom = rooms.find(r => r.id === editingItem.roomId);
                    const targetRoom = rooms.find(r => r.id === formRoomId);
                    if (!sourceRoom || !targetRoom) throw new Error("Salas não encontradas.");

                    const batch = writeBatch(db);
                    const newSourceItems = (sourceRoom.items || []).filter(it => it.id !== editingItem.item.id);
                    batch.update(doc(db, "rooms", sourceRoom.id), { items: newSourceItems });

                    const newTargetItems = [...(targetRoom.items || []), updatedItem];
                    batch.update(doc(db, "rooms", targetRoom.id), { items: newTargetItems });
                    await batch.commit();
                } else {
                    // Mesma sala
                    const room = rooms.find(r => r.id === editingItem.roomId);
                    if (!room) throw new Error("Sala não encontrada.");
                    const updatedItems = (room.items || []).map(it => {
                        if (it.id === editingItem.item.id) {
                            return updatedItem;
                        }
                        return it;
                    });
                    await updateDoc(doc(db, "rooms", editingItem.roomId), { items: updatedItems });
                }
                toast({ title: "Item Atualizado!", description: `"${formName}" atualizado com sucesso.` });
            } else {
                // Novo Item
                const room = rooms.find(r => r.id === formRoomId);
                if (!room) throw new Error("Sala não encontrada.");

                const newItem = buildItemPayload();
                const currentItems = room.items || [];
                await updateDoc(doc(db, "rooms", formRoomId), {
                    items: [...currentItems, newItem]
                });
                toast({ title: "Item Cadastrado!", description: `"${formName}" adicionado ao inventário de ${room.name}.` });
            }

            setIsItemDialogOpen(false);
            setEditingItem(null);
        } catch (error) {
            console.error("Erro ao salvar item:", error);
            toast({ title: "Erro", description: "Não foi possível salvar o item.", variant: "destructive" });
        } finally {
            setIsSavingItem(false);
        }
    };

    const handleDeleteInventoryItem = async (item: InventoryItemView) => {
        if (!window.confirm(`Deseja realmente remover o item "${item.name}" do inventário de ${item.roomName}?`)) {
            return;
        }
        try {
            const room = rooms.find(r => r.id === item.roomId);
            if (!room) return;
            const updated = (room.items || []).filter(it => it.id !== item.id);
            await updateDoc(doc(db, "rooms", item.roomId), { items: updated });
            toast({ title: "Item Removido", description: `"${item.name}" foi removido do inventário.` });
        } catch (error) {
            console.error("Erro ao remover item:", error);
            toast({ title: "Erro", description: "Falha ao remover item.", variant: "destructive" });
        }
    };

    const handleTransferItem = async () => {
        if (!transferringItem || !targetRoomId || targetRoomId === transferringItem.roomId) {
            toast({ title: "Atenção", description: "Selecione uma sala de destino válida diferente da atual.", variant: "destructive" });
            return;
        }

        setIsTransferring(true);
        try {
            const sourceRoom = rooms.find(r => r.id === transferringItem.roomId);
            const destRoom = rooms.find(r => r.id === targetRoomId);
            if (!sourceRoom || !destRoom) throw new Error("Salas não encontradas.");

            const batch = writeBatch(db);
            const newSourceItems = (sourceRoom.items || []).filter(it => it.id !== transferringItem.item.id);
            batch.update(doc(db, "rooms", sourceRoom.id), { items: newSourceItems });

            const newDestItems = [...(destRoom.items || []), transferringItem.item];
            batch.update(doc(db, "rooms", destRoom.id), { items: newDestItems });

            await batch.commit();
            toast({
                title: "Item Movimentado!",
                description: `"${transferringItem.item.name}" transferido de ${sourceRoom.name} para ${destRoom.name}.`
            });
            setTransferringItem(null);
            setTargetRoomId("");
        } catch (error) {
            console.error("Erro ao transferir item:", error);
            toast({ title: "Erro", description: "Não foi possível movimentar o item.", variant: "destructive" });
        } finally {
            setIsTransferring(false);
        }
    };

    const handleClearRegisteredItems = async () => {
        setIsClearing(true);
        try {
            const batch = writeBatch(db);
            if (clearScope === "selected_room") {
                if (!inventoryRoomFilter || inventoryRoomFilter === "all") {
                    toast({ title: "Atenção", description: "Selecione uma sala no filtro para limpar.", variant: "destructive" });
                    setIsClearing(false);
                    return;
                }
                const room = rooms.find(r => r.id === inventoryRoomFilter);
                if (room) {
                    batch.update(doc(db, "rooms", room.id), { items: [] });
                }
            } else {
                rooms.forEach(r => {
                    batch.update(doc(db, "rooms", r.id), { items: [] });
                });
            }
            await batch.commit();
            toast({
                title: "Itens Removidos!",
                description: clearScope === "selected_room" 
                    ? "Os itens da sala selecionada foram removidos com sucesso." 
                    : "Todos os itens de todos os ambientes foram removidos do inventário."
            });
            setIsClearDialogOpen(false);
        } catch (error) {
            console.error("Erro ao limpar itens:", error);
            toast({ title: "Erro", description: "Falha ao limpar itens cadastrados.", variant: "destructive" });
        } finally {
            setIsClearing(false);
        }
    };

    const handleUpdateReportStatus = async (reportId: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, "asset_reports", reportId), { status: newStatus });
            toast({ title: "Sucesso", description: "Status do chamado atualizado." });
        } catch {
            toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" });
        }
    };

    return (
        <PageLayout>
            <PageHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <ShieldCheck className="h-6 w-6 text-indigo-600" />
                            Custódia, Ocorrências & Inventário
                        </h2>
                        <p className="text-muted-foreground text-xs sm:text-sm">
                            Gestão de conformidade de salas, histórico de uso dos professores e controle de equipamentos.
                        </p>
                    </div>

                    {/* Ordem solicitada: 1º Cadeia de Custódia, 2º Ocorrências, 3º Inventário */}
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <Button
                            variant={activeTab === "usage" ? "default" : "outline"}
                            onClick={() => setActiveTab("usage")}
                            className="flex-1 sm:flex-none text-xs font-semibold relative"
                        >
                            <ShieldCheck className="h-4 w-4 mr-1.5 text-indigo-600" />
                            Cadeia de Custódia & Uso
                            {unitSchedules.filter(s => s.checkInDiscrepancy || s.checkOutDiscrepancy).length > 0 && (
                                <span className="ml-1.5 flex h-4 px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                                    {unitSchedules.filter(s => s.checkInDiscrepancy || s.checkOutDiscrepancy).length}
                                </span>
                            )}
                        </Button>
                        <Button
                            variant={activeTab === "reports" ? "default" : "outline"}
                            onClick={() => setActiveTab("reports")}
                            className="flex-1 sm:flex-none text-xs font-semibold relative"
                        >
                            <ShieldAlert className="h-4 w-4 mr-1.5 text-amber-600" />
                            Ocorrências & Avarias
                            {roomIssues.filter(r => r.status === "open").length > 0 && (
                                <span className="ml-1.5 flex h-4 px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white animate-pulse">
                                    {roomIssues.filter(r => r.status === "open").length}
                                </span>
                            )}
                        </Button>
                        <Button
                            variant={activeTab === "assets" ? "default" : "outline"}
                            onClick={() => setActiveTab("assets")}
                            className="flex-1 sm:flex-none text-xs font-semibold"
                        >
                            <Package className="h-4 w-4 mr-1.5 text-slate-700" />
                            Inventário de Equipamentos & Ativos
                            {allInventoryItems.length > 0 && (
                                <span className="ml-1.5 flex h-4 px-1.5 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-800 font-bold">
                                    {allInventoryItems.length}
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </PageHeader>

            <PageContent>

            {/* TAB 1: CADEIA DE CUSTÓDIA & USO */}
            {activeTab === "usage" && (
                <Card>
                    <CardHeader className="space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-indigo-600" />
                                    Cadeia de Custódia & Histórico de Uso das Salas
                                </CardTitle>
                                <CardDescription>
                                    Controle semanal de conformidade e uso dos ambientes, cumprimento de Check-in e Check-out e avarias apontadas pelos docentes.
                                </CardDescription>
                            </div>
                        </div>

                        {/* Cards de Métricas Rápidas */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3.5">
                                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                                    {weekViewMode === "week" ? "Aulas na Semana" : "Total de Aulas"}
                                </p>
                                <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                                    {weekViewMode === "week" ? weeklyMetrics.total : unitSchedules.length}
                                </p>
                            </div>
                            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
                                <p className="text-[11px] text-emerald-800 font-semibold uppercase tracking-wider">Check-in Realizado</p>
                                <p className="text-2xl font-black text-emerald-900 mt-1">
                                    {weeklyMetrics.checkInCount}
                                    <span className="text-xs font-normal text-emerald-700 ml-1.5">
                                        ({weeklyMetrics.checkInPct}%)
                                    </span>
                                </p>
                            </div>
                            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5">
                                <p className="text-[11px] text-blue-800 font-semibold uppercase tracking-wider">Check-out Realizado</p>
                                <p className="text-2xl font-black text-blue-900 mt-1">
                                    {weeklyMetrics.checkOutCount}
                                    <span className="text-xs font-normal text-blue-700 ml-1.5">
                                        ({weeklyMetrics.checkOutPct}%)
                                    </span>
                                </p>
                            </div>
                            <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5">
                                <p className="text-[11px] text-red-800 font-semibold uppercase tracking-wider">Com Avarias / Faltas</p>
                                <p className="text-2xl font-black text-red-900 mt-1">
                                    {weeklyMetrics.issuesCount}
                                </p>
                            </div>
                        </div>

                        {/* Barra de Navegação Semanal */}
                        <div className="bg-slate-50/80 dark:bg-slate-900/50 p-3 rounded-xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            {/* Controles da Semana */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handlePrevWeek}
                                    disabled={weekViewMode === "all"}
                                    className="h-8 text-xs font-medium"
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Anterior
                                </Button>
                                <Button
                                    size="sm"
                                    variant={isCurrentWeek ? "secondary" : "outline"}
                                    onClick={handleThisWeek}
                                    disabled={weekViewMode === "all" || isCurrentWeek}
                                    className="h-8 text-xs font-medium"
                                >
                                    <CalendarIcon className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                                    Esta Semana
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleNextWeek}
                                    disabled={weekViewMode === "all"}
                                    className="h-8 text-xs font-medium"
                                >
                                    Próxima
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>

                                <div className="flex items-center gap-2 ml-1">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                        <CalendarDays className="h-4 w-4 text-indigo-600" />
                                        {weekViewMode === "week" 
                                            ? `Semana de ${format(currentWeekStart, "dd/MM")} a ${format(currentWeekEnd, "dd/MM/yyyy")}`
                                            : "Todos os Agendamentos Cadastrados"}
                                    </span>
                                    {isCurrentWeek && weekViewMode === "week" && (
                                        <Badge className="bg-emerald-600 text-white text-[10px] h-5">
                                            Semana Atual
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Alternância de Modo de Visão e Layout */}
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                {/* Toggle Semana vs Todos */}
                                <div className="flex items-center bg-white dark:bg-slate-950 p-0.5 rounded-lg border">
                                    <Button
                                        size="sm"
                                        variant={weekViewMode === "week" ? "default" : "ghost"}
                                        className="h-7 text-xs px-2.5 font-medium"
                                        onClick={() => setWeekViewMode("week")}
                                    >
                                        Por Semana
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={weekViewMode === "all" ? "default" : "ghost"}
                                        className="h-7 text-xs px-2.5 font-medium"
                                        onClick={() => setWeekViewMode("all")}
                                    >
                                        Todos ({unitSchedules.length})
                                    </Button>
                                </div>

                                {/* Toggle Agrupado por Dia vs Tabela */}
                                <div className="flex items-center bg-white dark:bg-slate-950 p-0.5 rounded-lg border">
                                    <Button
                                        size="sm"
                                        variant={displayMode === "grouped" ? "secondary" : "ghost"}
                                        className="h-7 text-xs px-2 font-medium gap-1"
                                        title="Visualização agrupada por dia"
                                        onClick={() => setDisplayMode("grouped")}
                                    >
                                        <LayoutList className="h-3.5 w-3.5 text-indigo-600" />
                                        <span className="hidden sm:inline">Dia a Dia</span>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={displayMode === "table" ? "secondary" : "ghost"}
                                        className="h-7 text-xs px-2 font-medium gap-1"
                                        title="Tabela única completa"
                                        onClick={() => setDisplayMode("table")}
                                    >
                                        <TableIcon className="h-3.5 w-3.5 text-slate-600" />
                                        <span className="hidden sm:inline">Tabela</span>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Filtro por Dias da Semana (Day Pills) */}
                        {weekViewMode === "week" && (
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t">
                                <Button
                                    size="sm"
                                    variant={selectedDayFilter === null ? "default" : "outline"}
                                    className="h-7 text-xs shrink-0 font-medium"
                                    onClick={() => setSelectedDayFilter(null)}
                                >
                                    Todos os dias ({baseWeekSchedules.length})
                                </Button>
                                {weekDays.map(day => {
                                    const dayKey = format(day, "yyyy-MM-dd");
                                    const isDaySelected = selectedDayFilter === dayKey;
                                    const count = baseWeekSchedules.filter(s => {
                                        const d = s.startTime?.toDate ? s.startTime.toDate() : null;
                                        return d && isSameDay(d, day);
                                    }).length;
                                    const isDayToday = isToday(day);

                                    return (
                                        <Button
                                            key={dayKey}
                                            size="sm"
                                            variant={isDaySelected ? "default" : "outline"}
                                            className={`h-7 text-xs shrink-0 font-medium flex items-center gap-1.5 ${
                                                isDayToday && !isDaySelected ? "border-indigo-300 bg-indigo-50/50 text-indigo-700" : ""
                                            }`}
                                            onClick={() => setSelectedDayFilter(isDaySelected ? null : dayKey)}
                                        >
                                            <span className="capitalize">{format(day, "EEE dd/MM", { locale: ptBR })}</span>
                                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                                isDaySelected 
                                                    ? "bg-white/20 text-white" 
                                                    : count > 0 
                                                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" 
                                                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                            }`}>
                                                {count}
                                            </span>
                                        </Button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Barra de Filtros */}
                        <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Buscar docente ou turma..."
                                    className="pl-8 h-9 text-xs"
                                    value={usageTeacherSearch}
                                    onChange={(e) => setUsageTeacherSearch(e.target.value)}
                                />
                            </div>

                            <Select value={usageRoomFilter} onValueChange={setUsageRoomFilter}>
                                <SelectTrigger className="w-full sm:w-56 h-9 text-xs">
                                    <SelectValue placeholder="Filtrar por Sala..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as Salas / Labs</SelectItem>
                                    {rooms.map(room => (
                                        <SelectItem key={room.id} value={room.name}>{room.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                                <Button
                                    size="sm"
                                    variant={usageFilter === "all" ? "default" : "outline"}
                                    onClick={() => setUsageFilter("all")}
                                    className="h-8 text-xs font-medium"
                                >
                                    Todas
                                </Button>
                                <Button
                                    size="sm"
                                    variant={usageFilter === "today" ? "default" : "outline"}
                                    onClick={() => setUsageFilter("today")}
                                    className="h-8 text-xs font-medium"
                                >
                                    Hoje
                                </Button>
                                <Button
                                    size="sm"
                                    variant={usageFilter === "pending_checkin" ? "default" : "outline"}
                                    onClick={() => setUsageFilter("pending_checkin")}
                                    className="h-8 text-xs font-medium text-amber-700 border-amber-300"
                                >
                                    Check-in Pendente
                                </Button>
                                <Button
                                    size="sm"
                                    variant={usageFilter === "with_issues" ? "default" : "outline"}
                                    onClick={() => setUsageFilter("with_issues")}
                                    className="h-8 text-xs font-medium text-red-700 border-red-300"
                                >
                                    Com Avarias
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {finalFilteredSchedules.length === 0 ? (
                            <div className="text-center py-12 px-4 rounded-xl border border-dashed bg-slate-50/50 dark:bg-slate-900/30">
                                <CalendarDays className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                    {baseWeekSchedules.length === 0 
                                        ? `Nenhuma aula agendada para ${weekViewMode === "week" ? `a semana de ${format(currentWeekStart, "dd/MM")} a ${format(currentWeekEnd, "dd/MM/yyyy")}` : "o período selecionado"}`
                                        : "Nenhuma aula corresponde aos filtros aplicados"}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                                    {baseWeekSchedules.length === 0 
                                        ? (nearestScheduleDate 
                                            ? `Identificamos que existem aulas cadastradas em outras semanas, como na semana de ${format(nearestScheduleDate, "dd/MM/yyyy")}.`
                                            : "Não foram encontrados agendamentos registrados para os ambientes desta unidade.")
                                        : "Tente limpar a busca por docente ou alterar os filtros de sala e status."}
                                </p>
                                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                                    {nearestScheduleDate && baseWeekSchedules.length === 0 && (
                                        <Button
                                            size="sm"
                                            className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                                            onClick={() => {
                                                setCurrentWeekStart(startOfWeek(nearestScheduleDate, { weekStartsOn: 1 }));
                                                setSelectedDayFilter(null);
                                            }}
                                        >
                                            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                                            Ir para semana de {format(nearestScheduleDate, "dd/MM/yyyy")}
                                        </Button>
                                    )}
                                    {baseWeekSchedules.length > 0 && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs font-semibold"
                                            onClick={() => {
                                                setUsageTeacherSearch("");
                                                setUsageRoomFilter("all");
                                                setUsageFilter("all");
                                                setSelectedDayFilter(null);
                                            }}
                                        >
                                            Limpar Filtros
                                        </Button>
                                    )}
                                    {weekViewMode === "week" && unitSchedules.length > 0 && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs font-semibold"
                                            onClick={() => setWeekViewMode("all")}
                                        >
                                            Ver Todos os Agendamentos ({unitSchedules.length})
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            displayMode === "grouped" ? (
                                <div className="space-y-4">
                                    {schedulesGroupedByDay.map(group => {
                                        const isGroupToday = isToday(group.date);
                                        const totalInGroup = group.schedules.length;
                                        const checkInsInGroup = group.schedules.filter(s => s.checkInCompleted).length;
                                        const issuesInGroup = group.schedules.filter(s => s.checkInDiscrepancy || s.checkOutDiscrepancy).length;

                                        return (
                                            <div key={group.dateKey} className="rounded-xl border bg-white dark:bg-slate-950 overflow-hidden shadow-xs">
                                                <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-slate-900/70 border-b flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarDays className="h-4 w-4 text-indigo-600 shrink-0" />
                                                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm capitalize">
                                                            {group.label}
                                                        </span>
                                                        {isGroupToday && (
                                                            <Badge className="bg-emerald-600 text-white text-[10px] h-5 px-2">
                                                                Hoje
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <Badge variant="outline" className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                                                            {totalInGroup} {totalInGroup === 1 ? "aula" : "aulas"}
                                                        </Badge>
                                                        <span className="text-slate-300">|</span>
                                                        <span className="text-emerald-700 dark:text-emerald-400 font-medium text-[11px]">
                                                            {checkInsInGroup}/{totalInGroup} check-ins
                                                        </span>
                                                        {issuesInGroup > 0 && (
                                                            <>
                                                                <span className="text-slate-300">|</span>
                                                                <Badge variant="destructive" className="text-[10px] h-5">
                                                                    {issuesInGroup} {issuesInGroup === 1 ? "avaria" : "avarias"}
                                                                </Badge>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                {renderScheduleTable(group.schedules)}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                renderScheduleTable(finalFilteredSchedules)
                            )
                        )}
                    </CardContent>
                </Card>
            )}

            {/* TAB 2: OCORRÊNCIAS & AVARIAS */}
            {activeTab === "reports" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-amber-600" />
                            Gestão de Ocorrências & Avarias
                        </CardTitle>
                        <CardDescription>
                            Problemas relatados pelos professores durante vistorias de entrada/saída ou chamados manuais de ativos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                Ocorrências de Vistoria de Sala ({roomIssues.length})
                            </h3>
                            {roomIssues.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground text-xs">
                                    Nenhuma avaria reportada nas vistorias recentes.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {roomIssues.map(issue => (
                                        <div 
                                            key={issue.id} 
                                            className={`p-4 rounded-xl border-l-4 transition-all flex flex-col md:flex-row gap-4 items-start md:items-center justify-between ${
                                                issue.status === 'open' 
                                                    ? 'bg-red-50/60 border-red-500 shadow-xs' 
                                                    : issue.status === 'in_progress' 
                                                        ? 'bg-amber-50/60 border-amber-500' 
                                                        : 'bg-emerald-50/40 border-emerald-500'
                                            }`}
                                        >
                                            <div className="flex-1 space-y-1.5">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge 
                                                        variant={issue.status === 'open' ? 'destructive' : issue.status === 'in_progress' ? 'default' : 'secondary'} 
                                                        className="text-[10px] font-bold"
                                                    >
                                                        {issue.status === 'open' ? 'Pendente' : issue.status === 'in_progress' ? 'Em Atendimento' : 'Resolvido'}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[10px] font-semibold bg-white">
                                                        {issue.reportedStage === 'CHECK_IN' ? 'Detectado no Check-in' : 'Registrado no Check-out'}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        {issue.createdAt?.toDate ? format(issue.createdAt.toDate(), "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : "Recente"}
                                                    </span>
                                                </div>

                                                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                                    <span>{issue.itemName}</span>
                                                    <span className="text-xs font-normal text-muted-foreground">({issue.roomName})</span>
                                                </h4>

                                                <p className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-lg border border-slate-200">
                                                    "{issue.description}"
                                                </p>

                                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                                                    <span>Docente Solicitante: <strong>{issue.reportedByTeacherName}</strong></span>
                                                    {issue.photoUrl && (
                                                        <a 
                                                            href={issue.photoUrl} 
                                                            target="_blank" 
                                                            rel="noreferrer" 
                                                            className="text-indigo-600 hover:underline font-semibold flex items-center gap-1"
                                                        >
                                                            Ver Foto Anexada
                                                        </a>
                                                    )}
                                                </div>

                                                {issue.status === 'resolved' && (
                                                    <div className="mt-2 p-2 bg-emerald-100/70 border border-emerald-300 rounded-lg text-xs text-emerald-950 space-y-0.5">
                                                        <div className="flex items-center gap-1 font-bold">
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                                                            <span>Resolvido por: {issue.resolvedByName || issue.resolvedBy || "Equipe Técnica"}</span>
                                                            {issue.resolvedAt?.toDate && (
                                                                <span className="font-normal text-emerald-800">
                                                                    • {format(issue.resolvedAt.toDate(), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="italic text-emerald-900">
                                                            Ação realizada: "{issue.resolutionNotes || "Item verificado e consertado/reposto no local."}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto shrink-0">
                                                {issue.status !== 'resolved' ? (
                                                    <>
                                                        {issue.status === 'open' && (
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs h-8"
                                                                onClick={async () => {
                                                                    await updateRoomIssueStatus(issue.id!, "in_progress", currentUser);
                                                                    toast({ title: "Status Atualizado", description: "Ocorrência colocada em atendimento." });
                                                                }}
                                                            >
                                                                Atender Chamado
                                                            </Button>
                                                        )}
                                                        <Button 
                                                            size="sm" 
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-semibold shadow-sm"
                                                            onClick={() => {
                                                                setResolvingIssue(issue);
                                                                setResolutionText("");
                                                            }}
                                                        >
                                                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                                            Resolver Ocorrência
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/70 px-3 py-1.5 rounded-lg border border-emerald-300">
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Resolvido
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Seção 2: Chamados Gerais de Ativos */}
                        {reports.length > 0 && (
                            <div className="pt-4 border-t">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
                                    Outros Relatórios de Ativos ({reports.length})
                                </h3>
                                <div className="space-y-3">
                                    {reports.map(report => (
                                        <div key={report.id} className={`p-4 rounded-xl border-l-4 ${report.status === 'open' ? 'bg-red-50/50 border-red-500' : report.status === 'in_progress' ? 'bg-amber-50/50 border-amber-500' : 'bg-slate-50 border-green-500'} flex flex-col md:flex-row gap-4 items-start md:items-center justify-between`}>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant={report.status === 'open' ? 'destructive' : report.status === 'in_progress' ? 'default' : 'secondary'} className="text-[10px]">
                                                        {report.status === 'open' ? 'Pendente' : report.status === 'in_progress' ? 'Em Análise' : 'Resolvido'}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        {report.createdAt?.toDate ? format(report.createdAt.toDate(), "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : "Recente"}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-sm text-slate-900">{report.assetName}</h4>
                                                <p className="text-xs text-muted-foreground mb-1">Sala: {report.roomName} | Solicitante: {report.reportedBy}</p>
                                                <div className="bg-white border p-2.5 rounded-lg text-xs italic">
                                                    "{report.description}"
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 w-full md:w-auto shrink-0">
                                                {report.status !== 'resolved' ? (
                                                    <>
                                                        {report.status === 'open' && (
                                                            <Button size="sm" variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-50 text-xs h-8" onClick={() => handleUpdateReportStatus(report.id, "in_progress")}>
                                                                Em Análise
                                                            </Button>
                                                        )}
                                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8" onClick={() => handleUpdateReportStatus(report.id, "resolved")}>
                                                            Marcar Resolvido
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                                                        <CheckCircle2 className="h-4 w-4" /> Concluído
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* TAB 3: INVENTÁRIO DE EQUIPAMENTOS, FERRAMENTAS & EPIS */}
            {activeTab === "assets" && (
                <Card>
                    <CardHeader className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5 text-slate-800" />
                                    Inventário de Equipamentos, Ferramentas & EPIs
                                </CardTitle>
                                <CardDescription>
                                    Gestão centralizada de todos os itens cadastrados por sala/laboratório para conferência no Check-in/Check-out.
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setClearScope(inventoryRoomFilter !== "all" ? "selected_room" : "all_rooms");
                                        setIsClearDialogOpen(true);
                                    }}
                                    className="text-xs text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800 h-9"
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                    Limpar Itens Cadastrados
                                </Button>
                                <Button 
                                    size="sm"
                                    onClick={() => handleOpenAddItem()}
                                    className="h-9 text-xs font-semibold bg-primary hover:bg-primary/90"
                                >
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Cadastrar Item
                                </Button>
                            </div>
                        </div>

                        {/* Barra de Filtros do Inventário */}
                        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t">
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Buscar item, patrimônio ou sala..."
                                    className="pl-8 h-9 text-xs"
                                    value={inventorySearchTerm}
                                    onChange={(e) => setInventorySearchTerm(e.target.value)}
                                />
                            </div>

                            <Select value={inventoryRoomFilter} onValueChange={setInventoryRoomFilter}>
                                <SelectTrigger className="w-full sm:w-60 h-9 text-xs">
                                    <SelectValue placeholder="Filtrar por Sala..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as Salas ({rooms.length})</SelectItem>
                                    {rooms.map(room => (
                                        <SelectItem key={room.id} value={room.id}>
                                            {room.name} {room.block ? `(${room.block})` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={inventoryCategoryFilter} onValueChange={setInventoryCategoryFilter}>
                                <SelectTrigger className="w-full sm:w-52 h-9 text-xs">
                                    <SelectValue placeholder="Filtrar Categoria..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as Categorias</SelectItem>
                                    {Object.entries(CATEGORY_MAP).map(([key, cfg]) => (
                                        <SelectItem key={key} value={key}>
                                            {cfg.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {filteredInventoryItems.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                                <Package className="h-10 w-10 mb-2 opacity-25" />
                                <p className="font-semibold text-sm">Nenhum item localizado no inventário.</p>
                                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                                    Os ambientes estão limpos. Clique em "Cadastrar Item" para vincular ferramentas, equipamentos ou EPIs a uma sala.
                                </p>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="mt-4 text-xs font-semibold"
                                    onClick={() => handleOpenAddItem()}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Cadastrar Primeiro Item
                                </Button>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item / Descrição</TableHead>
                                        <TableHead>Ambiente Alocado</TableHead>
                                        <TableHead>Categoria</TableHead>
                                        <TableHead className="text-center">Qtd</TableHead>
                                        <TableHead>Patrimônio / Código</TableHead>
                                        <TableHead>Integridade</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInventoryItems.map(item => {
                                        const cat = CATEGORY_MAP[item.category] || CATEGORY_MAP.outro;
                                        const CatIcon = cat.icon;

                                        return (
                                            <TableRow key={`${item.roomId}_${item.id}`} className="h-14">
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                                                            <span>{item.name}</span>
                                                            {item.isEssential && (
                                                                <Badge variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-200 py-0 px-1">
                                                                    Obrigatório
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {item.subItems && item.subItems.length > 0 && (
                                                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                                <Wrench className="h-3 w-3 text-indigo-600" />
                                                                <span>Kit com {item.subItems.length} ferramentas contidas</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs font-semibold text-slate-800">
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                                        <span>{item.roomName}</span>
                                                        {item.roomBlock && (
                                                            <span className="text-slate-400 font-normal">({item.roomBlock})</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`text-[10px] font-semibold gap-1 ${cat.color}`}>
                                                        <CatIcon className="h-3 w-3" />
                                                        {cat.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center text-xs font-bold text-slate-800">
                                                    {item.quantity || 1}
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-600 font-mono">
                                                    {item.code ? (
                                                        <Badge variant="outline" className="text-[10px] bg-slate-50">
                                                            {item.code}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-slate-400">--</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {item.hasOpenIssue ? (
                                                        <Badge variant="destructive" className="text-[10px] font-semibold gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            Avaria em Aberto ({item.openIssueCount})
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Conforme
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right space-x-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Transferir de Sala (Movimentação)"
                                                        onClick={() => {
                                                            setTransferringItem({ item, roomId: item.roomId, roomName: item.roomName });
                                                            setTargetRoomId("");
                                                        }}
                                                        className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                                                    >
                                                        <ArrowRightLeft className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Editar Item"
                                                        onClick={() => handleOpenEditItem(item)}
                                                        className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Remover Item"
                                                        onClick={() => handleDeleteInventoryItem(item)}
                                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Modal: Cadastrar / Editar Item no Inventário da Sala */}
            <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            {editingItem ? "Editar Item do Inventário" : "Cadastrar Item no Inventário"}
                        </DialogTitle>
                        <DialogDescription>
                            Vincule o equipamento, ferramenta ou EPI à sala física correspondente.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        <div className="space-y-1.5">
                            <Label htmlFor="itemRoom" className="font-bold text-slate-800">
                                Ambiente / Sala Alocada *
                            </Label>
                            <Select value={formRoomId} onValueChange={setFormRoomId}>
                                <SelectTrigger id="itemRoom" className="h-9 text-xs">
                                    <SelectValue placeholder="Selecione a sala..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {rooms.map(room => (
                                        <SelectItem key={room.id} value={room.id}>
                                            {room.name} {room.block ? `(${room.block})` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="itemName" className="font-bold text-slate-800">
                                    Nome / Descrição do Item *
                                </Label>
                                <Input
                                    id="itemName"
                                    placeholder="Ex: Projetor Epson X20, Multímetro..."
                                    className="h-9 text-xs"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="itemCategory" className="font-bold text-slate-800">
                                    Categoria *
                                </Label>
                                <Select value={formCategory} onValueChange={(val: any) => setFormCategory(val)}>
                                    <SelectTrigger id="itemCategory" className="h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(CATEGORY_MAP).map(([key, cfg]) => (
                                            <SelectItem key={key} value={key}>
                                                {cfg.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="itemCode" className="font-bold text-slate-800">
                                    Patrimônio / Etiqueta / Código (Opcional)
                                </Label>
                                <Input
                                    id="itemCode"
                                    placeholder="Ex: PAT-009841"
                                    className="h-9 text-xs font-mono"
                                    value={formCode}
                                    onChange={e => setFormCode(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="itemQty" className="font-bold text-slate-800">
                                    Quantidade *
                                </Label>
                                <Input
                                    id="itemQty"
                                    type="number"
                                    min="1"
                                    className="h-9 text-xs"
                                    value={formQuantity}
                                    onChange={e => setFormQuantity(parseInt(e.target.value) || 1)}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl border bg-slate-50">
                            <div>
                                <p className="font-bold text-slate-800 text-xs">Item de Conferência Obrigatória</p>
                                <p className="text-[11px] text-muted-foreground">Exigir conferência obrigatória no Check-in e Check-out do docente</p>
                            </div>
                            <Switch checked={formIsEssential} onCheckedChange={setFormIsEssential} />
                        </div>

                        {/* Subitens / Ferramentas Contidas (Kits) */}
                        <div className="space-y-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                            <div>
                                <Label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                    <Wrench className="h-3.5 w-3.5 text-indigo-600" />
                                    Ferramentas ou Componentes do Kit (Opcional)
                                </Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Se for uma maleta, caixa ou kit, cadastre os itens individuais para o professor conferir.
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Input
                                    placeholder="Ex: Alicate de Pressão, Chave de Fenda 6mm..."
                                    className="h-8 text-xs bg-white"
                                    value={subItemInput}
                                    onChange={e => setSubItemInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddSubItem();
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="h-8 text-xs shrink-0"
                                    onClick={handleAddSubItem}
                                >
                                    Adicionar
                                </Button>
                            </div>

                            {formSubItems.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {formSubItems.map((sub, idx) => (
                                        <Badge key={idx} variant="outline" className="gap-1 bg-white text-xs py-0.5 pr-1">
                                            <span>{sub}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSubItem(idx)}
                                                className="text-slate-400 hover:text-red-600 rounded-full"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsItemDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button size="sm" onClick={handleSaveInventoryItem} disabled={isSavingItem}>
                            {isSavingItem ? "Salvando..." : editingItem ? "Salvar Alterações" : "Cadastrar Item"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Transferência de Sala (Movimentação) */}
            <Dialog open={!!transferringItem} onOpenChange={(open) => !open && setTransferringItem(null)}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
                            Transferir Item de Sala
                        </DialogTitle>
                        <DialogDescription>
                            Movimente o item entre ambientes da instituição mantendo o histórico de custódia.
                        </DialogDescription>
                    </DialogHeader>

                    {transferringItem && (
                        <div className="space-y-4 py-2 text-xs">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                                <span className="text-muted-foreground text-[11px] block">Item a ser transferido:</span>
                                <p className="font-bold text-sm text-slate-800">{transferringItem.item.name}</p>
                                <p className="text-xs text-slate-600">Ambiente Atual: <strong>{transferringItem.roomName}</strong></p>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="targetRoom" className="font-bold text-slate-800">
                                    Ambiente de Destino *
                                </Label>
                                <Select value={targetRoomId} onValueChange={setTargetRoomId}>
                                    <SelectTrigger id="targetRoom" className="h-9 text-xs">
                                        <SelectValue placeholder="Selecione o ambiente de destino..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rooms
                                            .filter(r => r.id !== transferringItem.roomId)
                                            .map(room => (
                                                <SelectItem key={room.id} value={room.id}>
                                                    {room.name} {room.block ? `(${room.block})` : ""}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" size="sm" onClick={() => setTransferringItem(null)}>
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                            onClick={handleTransferItem}
                            disabled={isTransferring || !targetRoomId}
                        >
                            {isTransferring ? "Transferindo..." : "Confirmar Transferência"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Limpar Itens Cadastrados */}
            <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 className="h-5 w-5 text-red-600" />
                            Limpar Itens Cadastrados
                        </DialogTitle>
                        <DialogDescription>
                            Remova itens e equipamentos vinculados às salas físicas para recadastrá-los do zero.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-900">
                            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">Atenção!</p>
                                <p className="text-[11px] leading-relaxed mt-0.5">
                                    Esta ação removerá os itens das salas selecionadas. Os ambientes físicos não serão excluídos, apenas a lista de equipamentos/ferramentas será zerada.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-bold text-slate-800">Escolha o escopo da limpeza:</Label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input
                                        type="radio"
                                        name="clearScope"
                                        value="all_rooms"
                                        checked={clearScope === "all_rooms"}
                                        onChange={() => setClearScope("all_rooms")}
                                        className="h-4 w-4 text-red-600"
                                    />
                                    <div>
                                        <p className="font-bold text-slate-800">Limpar itens de TODAS as salas da unidade</p>
                                        <p className="text-[11px] text-muted-foreground">Zera a lista de equipamentos de todos os {rooms.length} ambientes.</p>
                                    </div>
                                </label>

                                <label className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors ${inventoryRoomFilter === 'all' ? 'opacity-50' : ''}`}>
                                    <input
                                        type="radio"
                                        name="clearScope"
                                        value="selected_room"
                                        disabled={inventoryRoomFilter === "all"}
                                        checked={clearScope === "selected_room"}
                                        onChange={() => setClearScope("selected_room")}
                                        className="h-4 w-4 text-red-600"
                                    />
                                    <div>
                                        <p className="font-bold text-slate-800">
                                            Limpar apenas da sala selecionada no filtro:{" "}
                                            <strong>{rooms.find(r => r.id === inventoryRoomFilter)?.name || "(Nenhuma selecionada)"}</strong>
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {inventoryRoomFilter === "all" 
                                                ? "Selecione uma sala específica no filtro acima para habilitar esta opção." 
                                                : "Remove apenas os itens deste ambiente específico."}
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsClearDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleClearRegisteredItems}
                            disabled={isClearing}
                        >
                            {isClearing ? "Limpando..." : "Confirmar e Limpar Itens"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Resolução de Ocorrência */}
            <Dialog open={!!resolvingIssue} onOpenChange={(open) => !open && setResolvingIssue(null)}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            Registrar Resolução e Manutenção do Item
                        </DialogTitle>
                        <DialogDescription>
                            Informe detalhadamente o que foi verificado no ambiente e qual ação foi realizada para resolver a ocorrência.
                        </DialogDescription>
                    </DialogHeader>

                    {resolvingIssue && (
                        <div className="space-y-4 py-2 text-sm">
                            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-800">Ambiente: {resolvingIssue.roomName}</span>
                                    <Badge variant="outline" className="text-[10px] font-semibold bg-white">
                                        {resolvingIssue.reportedStage === 'CHECK_IN' ? 'Detectado no Check-in (Entrada)' : 'Registrado no Check-out (Saída)'}
                                    </Badge>
                                </div>
                                <p className="font-black text-slate-900 text-sm">{resolvingIssue.itemName}</p>
                                <p className="text-xs text-slate-600 italic bg-white p-2 rounded border border-slate-100">
                                    "{resolvingIssue.description}"
                                </p>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                                    <span>Docente: <strong>{resolvingIssue.reportedByTeacherName}</strong></span>
                                    {resolvingIssue.photoUrl && (
                                        <a href={resolvingIssue.photoUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold">
                                            Ver Foto Anexada
                                        </a>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="resolutionNotes" className="text-xs font-bold text-slate-800">
                                    O que foi feito / Como foi arrumado? *
                                </Label>
                                <Textarea
                                    id="resolutionNotes"
                                    placeholder="Ex: Verificado no local, trocadas as pilhas do controle do ar condicionado e testado o funcionamento com sucesso."
                                    rows={4}
                                    value={resolutionText}
                                    onChange={(e) => setResolutionText(e.target.value)}
                                    className="text-xs leading-relaxed"
                                />
                            </div>

                            <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-900 flex items-center gap-2.5">
                                <UserCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                                <div>
                                    <span className="font-semibold block">Responsável pelo conserto/atendimento:</span>
                                    <span className="font-bold text-emerald-950">
                                        {userData?.name || currentUser?.displayName || currentUser?.email || "Admin"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" size="sm" onClick={() => setResolvingIssue(null)}>
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4"
                            disabled={isResolving || !resolutionText.trim()}
                            onClick={async () => {
                                if (!resolvingIssue) return;
                                setIsResolving(true);
                                try {
                                    await updateRoomIssueStatus(resolvingIssue.id!, "resolved", currentUser, resolutionText.trim());
                                    toast({
                                        title: "Ocorrência Concluída!",
                                        description: "A resolução foi registrada no histórico com sucesso."
                                    });
                                    setResolvingIssue(null);
                                    setResolutionText("");
                                } catch (error) {
                                    console.error(error);
                                    toast({ title: "Erro ao concluir", description: "Tente novamente mais tarde.", variant: "destructive" });
                                } finally {
                                    setIsResolving(false);
                                }
                            }}
                        >
                            {isResolving ? "Salvando..." : "Concluir e Assinar Manutenção"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Detalhes da Custódia e Vistoria do Agendamento */}
            <Dialog open={!!selectedScheduleDetails} onOpenChange={(open) => !open && setSelectedScheduleDetails(null)}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-indigo-950">
                            <ShieldCheck className="h-5 w-5 text-indigo-600" />
                            Registro de Custódia & Vistoria
                        </DialogTitle>
                        <DialogDescription>
                            Detalhes do uso do ambiente, confirmações de entrada e saída e apontamentos.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedScheduleDetails && (
                        <div className="space-y-4 py-2 text-xs">
                            <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3.5 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                                        {selectedScheduleDetails.roomName}
                                    </span>
                                    <Badge variant="outline" className="text-[10px]">
                                        {selectedScheduleDetails.className || "Reserva"}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1 border-t border-slate-200">
                                    <div>
                                        <span className="font-semibold block text-slate-700">Docente Responsável:</span>
                                        <span>{selectedScheduleDetails.teacherName}</span>
                                    </div>
                                    <div>
                                        <span className="font-semibold block text-slate-700">Horário:</span>
                                        <span>
                                            {selectedScheduleDetails.startTime?.toDate && format(selectedScheduleDetails.startTime.toDate(), "dd/MM/yy HH:mm")}
                                            {" - "}
                                            {selectedScheduleDetails.endTime?.toDate && format(selectedScheduleDetails.endTime.toDate(), "HH:mm")}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Status de Check-in */}
                            <div className="p-3 rounded-xl border bg-white dark:bg-slate-950 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" /> Check-in de Entrada
                                    </span>
                                    {selectedScheduleDetails.checkInCompleted ? (
                                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-[10px]">
                                            Realizado às {selectedScheduleDetails.checkInAt?.toDate ? format(selectedScheduleDetails.checkInAt.toDate(), "HH:mm") : "--"}
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive" className="text-[10px]">
                                            Não Realizado
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-slate-500 text-[11px]">
                                    {selectedScheduleDetails.checkInDiscrepancy 
                                        ? "⚠️ Professor reportou discrepância ou avaria de itens no momento do check-in." 
                                        : selectedScheduleDetails.checkInCompleted 
                                            ? "Ambiente recebido em conformidade sem divergências apontadas." 
                                            : "Check-in não foi executado pelo docente."}
                                </p>
                            </div>

                            {/* Status de Check-out */}
                            <div className="p-3 rounded-xl border bg-white dark:bg-slate-950 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <CheckCircle2 className="h-4 w-4 text-blue-600" /> Check-out de Saída
                                    </span>
                                    {selectedScheduleDetails.checkOutCompleted ? (
                                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-semibold text-[10px]">
                                            Realizado às {selectedScheduleDetails.checkOutAt?.toDate ? format(selectedScheduleDetails.checkOutAt.toDate(), "HH:mm") : "--"}
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-slate-500 text-[10px]">
                                            Pendente / Em Aberto
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-slate-500 text-[11px]">
                                    {selectedScheduleDetails.checkOutDiscrepancy 
                                        ? "⚠️ Ocorrência registrada no check-out de saída." 
                                        : selectedScheduleDetails.checkOutCompleted 
                                            ? "Devolução da sala concluída sem registro de novas avarias." 
                                            : "Check-out ainda não efetuado."}
                                </p>
                            </div>

                            {selectedScheduleDetails.observation && (
                                <div className="p-2.5 bg-slate-50 rounded-lg border text-slate-700 italic">
                                    "Observação: {selectedScheduleDetails.observation}"
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setSelectedScheduleDetails(null)}>
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            </PageContent>
        </PageLayout>
    );
}
