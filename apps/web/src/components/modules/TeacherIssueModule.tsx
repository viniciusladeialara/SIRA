import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/db";
import { 
    collection, 
    onSnapshot, 
    query, 
    where, 
    orderBy 
} from "@/lib/sira-sql-adapter";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/AuthContext";
import { 
    subscribeToRoomIssues, 
    RoomIssue, 
    createManualRoomIssue 
} from "@/services/inspectionService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
    Plus, 
    Wrench, 
    Search, 
    CheckCircle2, 
    MapPin, 
    Clock, 
    CheckCircle, 
    ExternalLink,
    AlertTriangle,
    XCircle,
    ShieldAlert,
    ArrowRight
} from "lucide-react";
import { UserRole } from "@/lib/UserRoles";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";

interface Room {
    id: string;
    name: string;
    type?: string;
    block?: string;
    floor?: string;
    unitId?: string;
}

interface UnifiedTicket {
    id: string;
    source: "room_issue" | "asset_report";
    roomName: string;
    itemName: string;
    description: string;
    createdAt: Date | null;
    status: "open" | "in_progress" | "resolved";
    severity?: "low" | "medium" | "high";
    issueType?: "danificado" | "faltando" | "mau_funcionamento";
    reportedStage?: string;
    photoUrl?: string;
    resolvedBy?: string;
    resolvedByName?: string;
    resolvedAt?: Date | null;
    resolutionNotes?: string;
}

export function TeacherIssueModule() {
    const { userData, userRole, isProfessor } = usePermissions();
    const { currentUser } = useAuth();
    const selectedUnitId = userData?.selectedUnitId || "caceres";
    const { toast } = useToast();

    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomIssues, setRoomIssues] = useState<RoomIssue[]>([]);
    const [assetReports, setAssetReports] = useState<any[]>([]);

    // Filtros
    const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "resolved">("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Modal de Novo Chamado
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [formRoomId, setFormRoomId] = useState("");
    const [formItemName, setFormItemName] = useState("");
    const [formIssueType, setFormIssueType] = useState<"danificado" | "faltando" | "mau_funcionamento">("danificado");
    const [formSeverity, setFormSeverity] = useState<"low" | "medium" | "high">("medium");
    const [formDescription, setFormDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Carregar Ambientes da unidade
    useEffect(() => {
        const roomsQuery = query(collection(db, "rooms"), where("unitId", "==", selectedUnitId));
        const unsubRooms = onSnapshot(roomsQuery, (snapshot) => {
            setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
        });

        // Carregar Ocorrências de Vistorias e Chamados
        const unsubIssues = subscribeToRoomIssues(selectedUnitId, (issues) => {
            setRoomIssues(issues);
        });

        // Carregar relatórios legados de ativos
        const reportsQuery = query(collection(db, "asset_reports"), orderBy("createdAt", "desc"));
        const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
            const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setAssetReports(all.filter((r: any) => !r.unitId || r.unitId === selectedUnitId));
        });

        return () => {
            unsubRooms();
            unsubIssues();
            unsubReports();
        };
    }, [selectedUnitId]);

    // Filtrar estritamente os chamados abertos pelo professor logado
    const myTickets = useMemo<UnifiedTicket[]>(() => {
        if (!currentUser) return [];

        const uid = currentUser.uid;
        const email = (currentUser.email || "").toLowerCase().trim();
        const displayName = (currentUser.displayName || "").toLowerCase().trim();
        const teacherName = (userData?.name || "").toLowerCase().trim();
        const teacherId = userData?.teacherId;

        const isUserMatch = (reportedId?: string, reportedName?: string) => {
            if (reportedId) {
                if (reportedId === uid || (teacherId && reportedId === teacherId)) return true;
            }
            if (reportedName) {
                const rep = reportedName.toLowerCase().trim();
                if (rep === email || rep === displayName || rep === teacherName) return true;
                if (teacherName && (rep.includes(teacherName) || teacherName.includes(rep))) return true;
                if (displayName && (rep.includes(displayName) || displayName.includes(rep))) return true;
            }
            return false;
        };

        const list: UnifiedTicket[] = [];

        // 1. Ocorrências de Vistoria / Chamados de Sala
        roomIssues.forEach(issue => {
            if (isUserMatch(issue.reportedByTeacherId, issue.reportedByTeacherName)) {
                list.push({
                    id: issue.id || Math.random().toString(),
                    source: "room_issue",
                    roomName: issue.roomName || "Sala",
                    itemName: issue.itemName || "Equipamento / Infraestrutura",
                    description: issue.description,
                    createdAt: issue.createdAt?.toDate ? issue.createdAt.toDate() : null,
                    status: issue.status,
                    severity: issue.severity,
                    issueType: issue.issueType,
                    reportedStage: issue.reportedStage,
                    photoUrl: issue.photoUrl,
                    resolvedBy: issue.resolvedBy,
                    resolvedByName: issue.resolvedByName,
                    resolvedAt: issue.resolvedAt?.toDate ? issue.resolvedAt.toDate() : null,
                    resolutionNotes: issue.resolutionNotes
                });
            }
        });

        // 2. Relatórios de Ativos
        assetReports.forEach(report => {
            if (isUserMatch(report.userId, report.reportedBy)) {
                list.push({
                    id: report.id,
                    source: "asset_report",
                    roomName: report.roomName || "Ambiente",
                    itemName: report.assetName || "Equipamento",
                    description: report.description,
                    createdAt: report.createdAt?.toDate ? report.createdAt.toDate() : null,
                    status: report.status || "open",
                    severity: "medium",
                    issueType: "danificado",
                    reportedStage: "CHAMADO",
                    photoUrl: report.photoUrl,
                    resolvedBy: report.resolvedBy,
                    resolvedByName: report.resolvedByName,
                    resolvedAt: report.resolvedAt?.toDate ? report.resolvedAt.toDate() : null,
                    resolutionNotes: report.resolutionNotes
                });
            }
        });

        // Ordenar por data (mais recentes primeiro)
        list.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.getTime() : 0;
            const tB = b.createdAt ? b.createdAt.getTime() : 0;
            return tB - tA;
        });

        return list;
    }, [currentUser, userData, roomIssues, assetReports]);

    // Filtro por status e busca textual
    const filteredTickets = useMemo(() => {
        return myTickets.filter(ticket => {
            if (statusFilter !== "all" && ticket.status !== statusFilter) {
                return false;
            }
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchRoom = ticket.roomName.toLowerCase().includes(term);
                const matchItem = ticket.itemName.toLowerCase().includes(term);
                const matchDesc = ticket.description.toLowerCase().includes(term);
                if (!matchRoom && !matchItem && !matchDesc) return false;
            }
            return true;
        });
    }, [myTickets, statusFilter, searchTerm]);

    // Métricas do professor
    const metrics = useMemo(() => {
        const total = myTickets.length;
        const open = myTickets.filter(t => t.status === "open").length;
        const inProgress = myTickets.filter(t => t.status === "in_progress").length;
        const resolved = myTickets.filter(t => t.status === "resolved").length;
        return { total, open, inProgress, resolved };
    }, [myTickets]);

    // Abertura de Novo Chamado
    const handleCreateTicket = async () => {
        if (!formRoomId) {
            toast({ title: "Atenção", description: "Selecione a sala onde ocorreu o problema.", variant: "destructive" });
            return;
        }
        if (!formItemName.trim()) {
            toast({ title: "Atenção", description: "Informe qual equipamento ou item apresentou defeito.", variant: "destructive" });
            return;
        }
        if (!formDescription.trim()) {
            toast({ title: "Atenção", description: "Descreva o problema para orientar a equipe técnica.", variant: "destructive" });
            return;
        }

        const selectedRoom = rooms.find(r => r.id === formRoomId);
        if (!selectedRoom) return;

        setIsSubmitting(true);
        try {
            await createManualRoomIssue({
                roomId: selectedRoom.id,
                roomName: selectedRoom.name,
                unitId: selectedUnitId,
                reportedByTeacherId: currentUser?.uid || "unknown",
                reportedByTeacherName: currentUser?.displayName || userData?.name || currentUser?.email || "Docente",
                itemName: formItemName.trim(),
                issueType: formIssueType,
                severity: formSeverity,
                description: formDescription.trim()
            });

            toast({
                title: "Chamado Registrado com Sucesso!",
                description: "A equipe de manutenção e logística já foi notificada do chamado."
            });

            setIsCreateOpen(false);
            setFormRoomId("");
            setFormItemName("");
            setFormIssueType("danificado");
            setFormSeverity("medium");
            setFormDescription("");
        } catch (error) {
            console.error("Erro ao abrir chamado:", error);
            toast({ title: "Erro", description: "Não foi possível abrir o chamado. Tente novamente.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Guarda de perfil: Se um não-docente tentar acessar diretamente, exibe orientação de governança
    if (userRole && userRole !== UserRole.PROFESSOR && !isProfessor?.()) {
        return (
            <PageLayout>
                <PageHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                Módulo Exclusivo para Docentes (Professores)
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Este canal de chamados e suporte é reservado para que os professores apontem avarias e itens faltantes em sala de aula.
                            </p>
                        </div>
                    </div>
                </PageHeader>
                <PageContent>
                    <Card className="max-w-2xl mx-auto border-amber-200 bg-amber-50/30 dark:bg-amber-950/20">
                        <CardContent className="p-6 text-center space-y-4">
                            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
                                <Wrench className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                    Fluxo de Atendimento e Governança
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
                                    Como <strong>{userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN ? 'Administrador(a)' : 'Gestão'}</strong>, o seu fluxo é deixar as salas corretas no <strong>Inventário</strong> e atender as solicitações na aba <strong>Ocorrências & Avarias</strong> do módulo de <strong>Gestão de Ativos</strong>.
                                </p>
                            </div>
                            <Button 
                                onClick={() => window.location.search = '?module=assets'}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold gap-2"
                            >
                                Ir para Gestão de Ativos & Ocorrências
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                </PageContent>
            </PageLayout>
        );
    }

    return (
        <PageLayout>
            <PageHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Wrench className="h-6 w-6 text-indigo-600" />
                            Meus Chamados & Suporte
                        </h2>
                        <p className="text-muted-foreground text-xs sm:text-sm">
                            Acompanhe o status e a resolução dos chamados de manutenção e vistorias reportados por você.
                        </p>
                    </div>

                    <Button 
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-9 shadow-sm"
                    >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Reportar Problema / Novo Chamado
                    </Button>
                </div>
            </PageHeader>

            <PageContent className="space-y-6">
                {/* Cards de Métricas do Professor */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3.5">
                        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Meus Chamados</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{metrics.total}</p>
                    </div>
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5">
                        <p className="text-[11px] text-amber-800 font-semibold uppercase tracking-wider">Aguardando Atendimento</p>
                        <p className="text-2xl font-black text-amber-900 mt-1">{metrics.open}</p>
                    </div>
                    <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5">
                        <p className="text-[11px] text-blue-800 font-semibold uppercase tracking-wider">Em Andamento</p>
                        <p className="text-2xl font-black text-blue-900 mt-1">{metrics.inProgress}</p>
                    </div>
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
                        <p className="text-[11px] text-emerald-800 font-semibold uppercase tracking-wider">Resolvidos</p>
                        <p className="text-2xl font-black text-emerald-900 mt-1">{metrics.resolved}</p>
                    </div>
                </div>

                {/* Filtros de Chamados */}
                <Card>
                    <CardHeader className="py-4 space-y-3">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Buscar por sala, equipamento..."
                                    className="pl-8 h-9 text-xs"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                                <Button
                                    size="sm"
                                    variant={statusFilter === "all" ? "default" : "outline"}
                                    onClick={() => setStatusFilter("all")}
                                    className="h-8 text-xs font-medium"
                                >
                                    Todos ({metrics.total})
                                </Button>
                                <Button
                                    size="sm"
                                    variant={statusFilter === "open" ? "default" : "outline"}
                                    onClick={() => setStatusFilter("open")}
                                    className="h-8 text-xs font-medium text-amber-700 border-amber-300"
                                >
                                    Aguardando ({metrics.open})
                                </Button>
                                <Button
                                    size="sm"
                                    variant={statusFilter === "in_progress" ? "default" : "outline"}
                                    onClick={() => setStatusFilter("in_progress")}
                                    className="h-8 text-xs font-medium text-blue-700 border-blue-300"
                                >
                                    Em Andamento ({metrics.inProgress})
                                </Button>
                                <Button
                                    size="sm"
                                    variant={statusFilter === "resolved" ? "default" : "outline"}
                                    onClick={() => setStatusFilter("resolved")}
                                    className="h-8 text-xs font-medium text-emerald-700 border-emerald-300"
                                >
                                    Resolvidos ({metrics.resolved})
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                        {filteredTickets.length === 0 ? (
                            <div className="text-center py-12 px-4 rounded-xl border border-dashed bg-slate-50/50 dark:bg-slate-900/30">
                                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
                                <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                    {myTickets.length === 0 
                                        ? "Você não possui nenhum chamado de suporte em aberto" 
                                        : "Nenhum chamado encontrado com o filtro selecionado"}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                                    {myTickets.length === 0 
                                        ? "Sempre que você apontar uma avaria durante o Check-in/Check-out de uma aula ou abrir um chamado direto, o andamento e o parecer da equipe técnica aparecerão aqui."
                                        : "Tente limpar a busca ou selecionar outro filtro de status acima."}
                                </p>
                                {myTickets.length === 0 && (
                                    <Button
                                        size="sm"
                                        onClick={() => setIsCreateOpen(true)}
                                        className="mt-4 h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                                        Abrir Meu Primeiro Chamado
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3.5">
                                {filteredTickets.map(ticket => {
                                    const isResolved = ticket.status === "resolved";
                                    const isInProgress = ticket.status === "in_progress";
                                    const isOpen = ticket.status === "open";

                                    return (
                                        <div
                                            key={ticket.id}
                                            className={`p-4 rounded-xl border transition-all ${
                                                isResolved 
                                                    ? "bg-white dark:bg-slate-950 border-emerald-200 shadow-xs" 
                                                    : isInProgress 
                                                        ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-300 shadow-xs" 
                                                        : "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 shadow-xs"
                                            }`}
                                        >
                                            {/* Cabeçalho do Card */}
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3 pb-2.5 border-b">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {isOpen && (
                                                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                                                            Aguardando Atendimento
                                                        </Badge>
                                                    )}
                                                    {isInProgress && (
                                                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] font-bold">
                                                            Em Andamento / Manutenção
                                                        </Badge>
                                                    )}
                                                    {isResolved && (
                                                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold gap-1">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Resolvido
                                                        </Badge>
                                                    )}

                                                    {ticket.reportedStage && ticket.reportedStage !== "MANUAL" && (
                                                        <Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-900 text-slate-600">
                                                            Apontado no {ticket.reportedStage === "CHECK_IN" ? "Check-in" : "Check-out"}
                                                        </Badge>
                                                    )}

                                                    {ticket.issueType === "danificado" && (
                                                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold gap-1">
                                                            <AlertTriangle className="h-3 w-3 text-amber-600" /> Estragou / Danificado
                                                        </Badge>
                                                    )}
                                                    {ticket.issueType === "faltando" && (
                                                        <Badge className="bg-red-100 text-red-900 border-red-300 text-[10px] font-bold gap-1">
                                                            <XCircle className="h-3 w-3 text-red-600" /> Sumiu / Faltando
                                                        </Badge>
                                                    )}
                                                    {ticket.issueType === "mau_funcionamento" && (
                                                        <Badge className="bg-blue-100 text-blue-900 border-blue-300 text-[10px] font-bold gap-1">
                                                            <Wrench className="h-3 w-3 text-blue-600" /> Falha / Mau Uso
                                                        </Badge>
                                                    )}

                                                    {ticket.severity === "high" && (
                                                        <Badge variant="destructive" className="text-[10px] font-semibold">
                                                            Urgente (Impede a Aula)
                                                        </Badge>
                                                    )}
                                                </div>

                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {ticket.createdAt 
                                                        ? format(ticket.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) 
                                                        : "Data recente"}
                                                </span>
                                            </div>

                                            {/* Informações Principais */}
                                            <div className="space-y-2">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                                        <span>{ticket.itemName}</span>
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                                                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                        <span>{ticket.roomName}</span>
                                                    </div>
                                                </div>

                                                {/* Descrição informada pelo professor */}
                                                <div className="bg-slate-50 dark:bg-slate-900/80 p-3 rounded-lg border text-xs text-slate-700 dark:text-slate-300 space-y-1">
                                                    <p className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                                                        O que você reportou:
                                                    </p>
                                                    <p className="italic">"{ticket.description}"</p>
                                                    {ticket.photoUrl && (
                                                        <a 
                                                            href={ticket.photoUrl} 
                                                            target="_blank" 
                                                            rel="noreferrer" 
                                                            className="inline-flex items-center gap-1 text-indigo-600 hover:underline pt-1 font-semibold"
                                                        >
                                                            <ExternalLink className="h-3 w-3" /> Ver Foto Anexada
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Retorno / Resolução da Equipe Técnica */}
                                                {isResolved ? (
                                                    <div className="mt-2.5 p-3 rounded-lg border border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/30 text-xs text-emerald-950 dark:text-emerald-200 space-y-1.5">
                                                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 font-bold">
                                                            <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                                                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                                                                Resolvido por: {ticket.resolvedByName || ticket.resolvedBy || "Equipe de Suporte"}
                                                            </span>
                                                            {ticket.resolvedAt && (
                                                                <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400">
                                                                    {format(ticket.resolvedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="pt-1 border-t border-emerald-200/80">
                                                            <span className="font-semibold block text-[11px] text-emerald-800 dark:text-emerald-300">
                                                                Parecer Técnico / Solução Aplicada:
                                                            </span>
                                                            <p className="italic text-emerald-900 dark:text-emerald-100 mt-0.5">
                                                                "{ticket.resolutionNotes || "Ocorrência verificada no local e solucionada pela equipe de manutenção."}"
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : isInProgress ? (
                                                    <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-300 flex items-center gap-2">
                                                        <Wrench className="h-4 w-4 text-blue-600 shrink-0" />
                                                        <span>
                                                            <strong>Em atendimento:</strong> A equipe de manutenção da unidade já está atuando para reparar este item.
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2">
                                                        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                                                        <span>
                                                            <strong>Aguardando técnico:</strong> Sua solicitação está na fila de atendimento da equipe de suporte do SENAI.
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </PageContent>

            {/* Dialog de Abertura de Novo Chamado */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-indigo-950">
                            <Wrench className="h-5 w-5 text-indigo-600" />
                            Reportar Problema / Solicitar Suporte
                        </DialogTitle>
                        <DialogDescription>
                            Abra um chamado de suporte para a equipe de infraestrutura e manutenção da unidade.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Sala / Ambiente */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Ambiente / Sala *</Label>
                            <Select value={formRoomId} onValueChange={setFormRoomId}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Selecione o ambiente..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {rooms.map(r => (
                                        <SelectItem key={r.id} value={r.id}>
                                            {r.name} {r.block ? `(${r.block})` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Equipamento / Item com Defeito */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Qual item ou recurso apresentou problema? *</Label>
                            <Input
                                placeholder="Ex: Ar-condicionado, Projetor Epson, Computador 04, Lâmpada..."
                                className="h-9 text-xs"
                                value={formItemName}
                                onChange={(e) => setFormItemName(e.target.value)}
                            />
                            {/* Sugestões Rápidas */}
                            <div className="flex flex-wrap gap-1 pt-1">
                                {["Ar-condicionado", "Projetor", "Computador", "Iluminação / Lâmpada", "Tomada / Rede", "Limpeza"].map(sug => (
                                    <button
                                        key={sug}
                                        type="button"
                                        className="text-[10px] px-2 py-0.5 rounded-full border bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
                                        onClick={() => setFormItemName(sug)}
                                    >
                                        + {sug}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* O que aconteceu com o item (Estragou ou Sumiu) */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">O que aconteceu com o item? *</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormIssueType("danificado")}
                                    className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                                        formIssueType === "danificado" 
                                            ? "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500" 
                                            : "border-slate-200 hover:bg-slate-50 text-slate-600"
                                    }`}
                                >
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <span>Estragou / Quebrou</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormIssueType("faltando")}
                                    className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                                        formIssueType === "faltando" 
                                            ? "bg-red-500/10 border-red-500 text-red-700 dark:text-red-400 ring-1 ring-red-500" 
                                            : "border-slate-200 hover:bg-slate-50 text-slate-600"
                                    }`}
                                >
                                    <XCircle className="h-4 w-4 text-red-600" />
                                    <span>Sumiu / Faltando</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormIssueType("mau_funcionamento")}
                                    className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                                        formIssueType === "mau_funcionamento" 
                                            ? "bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500" 
                                            : "border-slate-200 hover:bg-slate-50 text-slate-600"
                                    }`}
                                >
                                    <Wrench className="h-4 w-4 text-blue-600" />
                                    <span>Falha / Mau Uso</span>
                                </button>
                            </div>
                        </div>

                        {/* Gravidade */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Gravidade do Problema</Label>
                            <Select value={formSeverity} onValueChange={(val: any) => setFormSeverity(val)}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Baixa (Pode aguardar)</SelectItem>
                                    <SelectItem value="medium">Média (Aparelho instável ou com falha parcial)</SelectItem>
                                    <SelectItem value="high">Alta / Urgente (Impede a aula no ambiente)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Descrição do Defeito */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Descrição do Defeito *</Label>
                            <Textarea
                                placeholder="Descreva o que está acontecendo (ex: O ar-condicionado está fazendo barulho e não está resfriando a sala...)"
                                className="text-xs min-h-[90px]"
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                            Cancelar
                        </Button>
                        <Button 
                            size="sm" 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                            onClick={handleCreateTicket}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Enviando Chamado..." : "Enviar Chamado de Suporte"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageLayout>
    );
}
