import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { logAction, AuditAction } from "@/lib/AuditLog";
import { db } from "@/lib/db";
import { collection, getDocs } from "@/lib/sira-sql-adapter";
import * as XLSX from "xlsx";
import {
  format,
  parseISO,
  differenceInDays,
  addDays,
  subMonths,
  addMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// UI Components
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

// Icons
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  Plus,
  Edit,
  Trash2,
  Send,
  Calendar,
  XCircle,
  FileText,
  Lock,
  Sparkles,
  Award,
  BookOpen,
  Filter,
  Eye,
  Info,
} from "lucide-react";

// Service & Types
import {
  teacherMonitoringService,
  TeacherMonitoringRecord,
  MonitoringStatus,
  TeacherVinculo,
  MSEPCompliance,
  ActionPlanItem,
  OperationalAlert,
} from "@/services/teacherMonitoringService";

interface TeacherFromDB {
  id: string;
  name: string;
  email?: string;
  phone1?: string;
  phone2?: string;
  isActive?: boolean;
  unitId?: string;
  unitIds?: string[];
  area?: string;
  vinculo?: TeacherVinculo;
}

const DEFAULT_AREAS = [
  "Eletroeletrônica",
  "Mecânica Industrial",
  "Tecnologia da Informação",
  "Gestão & Negócios",
  "Logística",
  "Segurança do Trabalho",
  "Automotiva",
  "Alimentos & Bebidas",
  "Construção Civil",
  "Geral",
];

export function TeacherMonitoringModule() {
  const { currentUser } = useAuth();
  const { userData, isUserSuperAdmin } = usePermissions();
  const { toast } = useToast();
  const selectedUnitId = userData?.selectedUnitId || "caceres";

  // Verificação de Segurança Estrita: Super Admin (Desacoplado de e-mail fixo)
  const isAuthorized = isUserSuperAdmin();

  // Auditoria Imutável de Acesso a Dados Pedagógicos Sensíveis (LGPD / PRD Enterprise)
  useEffect(() => {
    if (isAuthorized && currentUser) {
      logAction(
        AuditAction.TEACHER_MONITORING_ACCESSED,
        currentUser,
        `Acesso aos relatórios pedagógicos confidenciais de Acompanhamento Docente`,
        { unitId: selectedUnitId }
      ).catch(err => console.error("Erro ao registrar auditoria de acompanhamento docente:", err));
    }
  }, [isAuthorized, currentUser, selectedUnitId]);

  // Estados principais
  const [teachers, setTeachers] = useState<TeacherFromDB[]>([]);
  const [monitoringRecords, setMonitoringRecords] = useState<TeacherMonitoringRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros Globais
  const [selectedCompetence, setSelectedCompetence] = useState<string>(() =>
    format(new Date(), "yyyy-MM")
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterArea, setFilterArea] = useState<string>("all");
  const [filterVinculo, setFilterVinculo] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Modais
  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isWaiverModalOpen, setIsWaiverModalOpen] = useState(false);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);

  // Professor selecionado para ações nos modais
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherFromDB | null>(null);
  const [activeRecord, setActiveRecord] = useState<TeacherMonitoringRecord | null>(null);

  // Formulário de Observação Pedagógica
  const [obsForm, setObsForm] = useState({
    vinculo: "quadro" as TeacherVinculo,
    area: "Geral",
    observationDate: format(new Date(), "yyyy-MM-dd"),
    observerName: "Vinícius",
    curricularUnit: "",
    roomName: "",
    pedagogicalAspects: "",
    strengths: "",
    improvements: "",
    msepCompliance: "total" as MSEPCompliance,
    feedbackDeadline: format(addDays(new Date(), 5), "yyyy-MM-dd"),
    actionPlans: [] as ActionPlanItem[],
  });

  // Formulário de Devolutiva
  const [feedbackForm, setFeedbackForm] = useState({
    feedbackDate: format(new Date(), "yyyy-MM-dd"),
    feedbackChannel: "Reunião Pedagógica Presencial",
    feedbackNotes: "",
  });

  // Formulário de Dispensa
  const [waiverReason, setWaiverReason] = useState("");

  // Novo item de plano de ação temporário no modal
  const [newPlanDescription, setNewPlanDescription] = useState("");
  const [newPlanDueDate, setNewPlanDueDate] = useState(
    format(addDays(new Date(), 15), "yyyy-MM-dd")
  );

  // 1. Carregar Professores Cadastrados no Banco de Dados
  useEffect(() => {
    if (!isAuthorized) return;

    const fetchTeachers = async () => {
      try {
        setIsLoading(true);
        const snapshot = await getDocs(collection(db, "teachers"));
        const allTeachers = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as TeacherFromDB[];

        // Filtrar pela unidade ativa
        const filtered = allTeachers.filter((t) => {
          const primaryUnit = t.unitId || "caceres";
          const unitList =
            Array.isArray(t.unitIds) && t.unitIds.length > 0 ? t.unitIds : [primaryUnit];
          return unitList.includes(selectedUnitId);
        });

        // Ordenar alfabeticamente
        filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setTeachers(filtered);
      } catch (err) {
        console.error("Erro ao carregar professores:", err);
        toast({
          title: "Erro ao buscar professores",
          description: "Não foi possível carregar a lista de docentes do banco de dados.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeachers();
  }, [selectedUnitId, isAuthorized, toast]);

  // 2. Assinar registros de Acompanhamento Docente no Firestore
  useEffect(() => {
    if (!isAuthorized) return;

    const unsubscribe = teacherMonitoringService.subscribeToMonitoring(
      selectedUnitId,
      (records) => {
        setMonitoringRecords(records);
      }
    );

    return () => unsubscribe();
  }, [selectedUnitId, isAuthorized]);

  // 3. Mapear Professores com seus respectivos registros na competência atual
  const consolidatedTeachers = useMemo(() => {
    const recordMap = new Map<string, TeacherMonitoringRecord>();
    monitoringRecords
      .filter((r) => r.competence === selectedCompetence)
      .forEach((r) => recordMap.set(r.teacherId, r));

    return teachers.map((teacher) => {
      const record = recordMap.get(teacher.id);
      const status: MonitoringStatus = record ? record.status : "pendente";
      const vinculo: TeacherVinculo = record?.vinculo || teacher.vinculo || "quadro";
      const area = record?.area || teacher.area || "Geral";

      // Encontrar última observação histórica do professor
      const historicalObs = monitoringRecords
        .filter((r) => r.teacherId === teacher.id && r.observationDate)
        .sort((a, b) => (b.observationDate || "").localeCompare(a.observationDate || ""));

      const lastObservationDate = historicalObs[0]?.observationDate;
      const daysSinceLastObs = lastObservationDate
        ? differenceInDays(new Date(), parseISO(lastObservationDate))
        : null;

      return {
        ...teacher,
        record,
        status,
        vinculo,
        area,
        lastObservationDate,
        daysSinceLastObs,
      };
    });
  }, [teachers, monitoringRecords, selectedCompetence]);

  // 4. Calcular Métricas SLI e Alertas Operacionais
  const { metrics, alerts } = useMemo(() => {
    return teacherMonitoringService.calculateMetricsAndAlerts(
      teachers,
      monitoringRecords,
      selectedCompetence,
      monitoringRecords
    );
  }, [teachers, monitoringRecords, selectedCompetence]);

  // 5. Aplicar Filtros da Tabela
  const filteredList = useMemo(() => {
    return consolidatedTeachers.filter((item) => {
      // Busca textual
      const matchesSearch =
        (item.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.email || "").toLowerCase().includes(searchQuery.toLowerCase());

      // Filtro de Área
      const matchesArea = filterArea === "all" || item.area === filterArea;

      // Filtro de Vínculo
      const matchesVinculo = filterVinculo === "all" || item.vinculo === filterVinculo;

      // Filtro de Status
      const matchesStatus = filterStatus === "all" || item.status === filterStatus;

      return matchesSearch && matchesArea && matchesVinculo && matchesStatus;
    });
  }, [consolidatedTeachers, searchQuery, filterArea, filterVinculo, filterStatus]);

  // Navegação de Mês/Competência
  const handlePrevMonth = () => {
    const [year, month] = selectedCompetence.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    setSelectedCompetence(format(subMonths(date, 1), "yyyy-MM"));
  };

  const handleNextMonth = () => {
    const [year, month] = selectedCompetence.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    setSelectedCompetence(format(addMonths(date, 1), "yyyy-MM"));
  };

  // Abrir Modal de Observação
  const handleOpenObservation = (item: any) => {
    setSelectedTeacher(item);
    const existingRecord = item.record;
    setActiveRecord(existingRecord || null);

    if (existingRecord) {
      setObsForm({
        vinculo: existingRecord.vinculo || "quadro",
        area: existingRecord.area || "Geral",
        observationDate: existingRecord.observationDate || format(new Date(), "yyyy-MM-dd"),
        observerName: existingRecord.observerName || "Vinícius",
        curricularUnit: existingRecord.curricularUnit || "",
        roomName: existingRecord.roomName || "",
        pedagogicalAspects: existingRecord.pedagogicalAspects || "",
        strengths: existingRecord.strengths || "",
        improvements: existingRecord.improvements || "",
        msepCompliance: existingRecord.msepCompliance || "total",
        feedbackDeadline:
          existingRecord.feedbackDeadline || format(addDays(new Date(), 5), "yyyy-MM-dd"),
        actionPlans: existingRecord.actionPlans || [],
      });
    } else {
      setObsForm({
        vinculo: item.vinculo || "quadro",
        area: item.area || "Geral",
        observationDate: format(new Date(), "yyyy-MM-dd"),
        observerName: "Vinícius",
        curricularUnit: "",
        roomName: "",
        pedagogicalAspects: "",
        strengths: "",
        improvements: "",
        msepCompliance: "total",
        feedbackDeadline: format(addDays(new Date(), 5), "yyyy-MM-dd"),
        actionPlans: [],
      });
    }

    setIsObservationModalOpen(true);
  };

  // Salvar Observação Pedagógica
  const handleSaveObservation = async () => {
    if (!selectedTeacher) return;

    try {
      const recordPayload: Partial<TeacherMonitoringRecord> = {
        teacherId: selectedTeacher.id,
        teacherName: selectedTeacher.name,
        teacherEmail: selectedTeacher.email || "",
        unitId: selectedUnitId,
        competence: selectedCompetence,
        vinculo: obsForm.vinculo,
        area: obsForm.area,
        status: activeRecord?.feedbackSent ? "concluido" : "em_andamento",
        observationDate: obsForm.observationDate,
        observerName: obsForm.observerName,
        curricularUnit: obsForm.curricularUnit,
        roomName: obsForm.roomName,
        pedagogicalAspects: obsForm.pedagogicalAspects,
        strengths: obsForm.strengths,
        improvements: obsForm.improvements,
        msepCompliance: obsForm.msepCompliance,
        feedbackDeadline: obsForm.feedbackDeadline,
        feedbackSent: activeRecord?.feedbackSent || false,
        actionPlans: obsForm.actionPlans,
      };

      await teacherMonitoringService.saveRecord(recordPayload, activeRecord?.id);

      toast({
        title: "Acompanhamento registrado com sucesso",
        description: `Registro pedagógico salvo para ${selectedTeacher.name}.`,
      });

      setIsObservationModalOpen(false);
    } catch (err) {
      console.error("Erro ao salvar acompanhamento:", err);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar o acompanhamento no banco de dados.",
        variant: "destructive",
      });
    }
  };

  // Abrir Modal de Devolutiva
  const handleOpenFeedback = (item: any) => {
    setSelectedTeacher(item);
    setActiveRecord(item.record || null);
    setFeedbackForm({
      feedbackDate: item.record?.feedbackDate || format(new Date(), "yyyy-MM-dd"),
      feedbackChannel: item.record?.feedbackChannel || "Reunião Pedagógica Presencial",
      feedbackNotes: item.record?.feedbackNotes || "",
    });
    setIsFeedbackModalOpen(true);
  };

  // Salvar Devolutiva
  const handleSaveFeedback = async () => {
    if (!selectedTeacher) return;

    try {
      if (activeRecord?.id) {
        await teacherMonitoringService.registerFeedback(activeRecord.id, feedbackForm);
      } else {
        // Se ainda não existia registro prévio, cria e já marca concluído
        await teacherMonitoringService.saveRecord({
          teacherId: selectedTeacher.id,
          teacherName: selectedTeacher.name,
          teacherEmail: selectedTeacher.email || "",
          unitId: selectedUnitId,
          competence: selectedCompetence,
          vinculo: "quadro",
          area: "Geral",
          status: "concluido",
          feedbackSent: true,
          feedbackDate: feedbackForm.feedbackDate,
          feedbackChannel: feedbackForm.feedbackChannel,
          feedbackNotes: feedbackForm.feedbackNotes,
        });
      }

      toast({
        title: "Devolutiva registrada com sucesso!",
        description: `Status atualizado para Concluído para ${selectedTeacher.name}.`,
      });

      setIsFeedbackModalOpen(false);
    } catch (err) {
      console.error("Erro ao registrar devolutiva:", err);
      toast({
        title: "Erro ao registrar devolutiva",
        description: "Não foi possível atualizar o status de devolutiva.",
        variant: "destructive",
      });
    }
  };

  // Abrir Modal de Dispensa
  const handleOpenWaiver = (item: any) => {
    setSelectedTeacher(item);
    setActiveRecord(item.record || null);
    setWaiverReason(item.record?.waiverReason || "Docente em período de férias regulamentares.");
    setIsWaiverModalOpen(true);
  };

  // Salvar Dispensa
  const handleSaveWaiver = async () => {
    if (!selectedTeacher) return;

    try {
      if (activeRecord?.id) {
        await teacherMonitoringService.waiveMonitoring(activeRecord.id, waiverReason);
      } else {
        await teacherMonitoringService.createWaiver({
          teacherId: selectedTeacher.id,
          teacherName: selectedTeacher.name,
          teacherEmail: selectedTeacher.email || "",
          unitId: selectedUnitId,
          competence: selectedCompetence,
          vinculo: "quadro",
          area: "Geral",
          status: "dispensado",
          feedbackSent: false,
          waiverReason,
        });
      }

      toast({
        title: "Dispensa justificada",
        description: `Docente ${selectedTeacher.name} dispensado da competência ${selectedCompetence}.`,
      });

      setIsWaiverModalOpen(false);
    } catch (err) {
      console.error("Erro ao registrar dispensa:", err);
      toast({
        title: "Erro ao justificar dispensa",
        description: "Ocorreu um erro ao salvar a dispensa.",
        variant: "destructive",
      });
    }
  };

  // Abrir Dossiê Histórico do Docente
  const handleOpenDossier = (item: any) => {
    setSelectedTeacher(item);
    setActiveRecord(item.record || null);
    setIsDossierModalOpen(true);
  };

  // Adicionar item de plano de ação
  const handleAddPlanItem = () => {
    if (!newPlanDescription.trim()) return;

    const newItem: ActionPlanItem = {
      id: "plan_" + Date.now(),
      description: newPlanDescription.trim(),
      dueDate: newPlanDueDate,
      status: "pendente",
    };

    setObsForm((prev) => ({
      ...prev,
      actionPlans: [...prev.actionPlans, newItem],
    }));

    setNewPlanDescription("");
  };

  const handleRemovePlanItem = (id: string) => {
    setObsForm((prev) => ({
      ...prev,
      actionPlans: prev.actionPlans.filter((p) => p.id !== id),
    }));
  };

  const handleTogglePlanItemStatus = (id: string) => {
    setObsForm((prev) => ({
      ...prev,
      actionPlans: prev.actionPlans.map((p) =>
        p.id === id
          ? {
              ...p,
              status: p.status === "concluido" ? "pendente" : "concluido",
              completedAt:
                p.status === "pendente" ? format(new Date(), "yyyy-MM-dd") : undefined,
            }
          : p
      ),
    }));
  };

  // Exportação para Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const dataForSheet = filteredList.map((item) => ({
        Docente: item.name,
        Email: item.email || "Não informado",
        Vínculo: item.vinculo === "quadro" ? "Quadro Próprio" : "Extraquadro",
        "Área de Atuação": item.area,
        Competência: selectedCompetence,
        "Status SLI":
          item.status === "concluido"
            ? "Concluído (Devolutiva Entregue)"
            : item.status === "em_andamento"
            ? "Em Andamento (Aguardando Devolutiva)"
            : item.status === "dispensado"
            ? `Dispensado (${item.record?.waiverReason || "Justificado"})`
            : "Pendente",
        "Data da Observação": item.record?.observationDate || "Não realizada",
        "Observador Responsável": item.record?.observerName || "-",
        "Conformidade MSEP": item.record?.msepCompliance || "-",
        "Devolutiva Enviada": item.record?.feedbackSent ? "Sim" : "Não",
        "Data da Devolutiva": item.record?.feedbackDate || "-",
        "Prazo SLA Devolutiva": item.record?.feedbackDeadline || "-",
        "Planos de Ação": (item.record?.actionPlans || [])
          .map((p) => `${p.description} (Venc: ${p.dueDate}, Status: ${p.status})`)
          .join(" | "),
      }));

      // Resumo dos SLIs
      const sliSummary = [
        {
          Indicador: "SLI-01: Cobertura Mensal",
          Meta: "100%",
          Resultado: `${metrics.coveragePercent}%`,
          Realizado: `${metrics.totalMonitored} de ${metrics.totalExpected} docentes previstos`,
        },
        {
          Indicador: "SLI-02: Fila de Pendências",
          Meta: "0 no fechamento",
          Resultado: `${metrics.pendingCount} pendentes`,
          Realizado: metrics.pendingIsCritical ? "ALERTA CRÍTICO: Reta final do mês" : "Normal",
        },
        {
          Indicador: "SLA-01: Prazo de Devolutiva",
          Meta: ">= 95%",
          Resultado: `${metrics.feedbackSlaPercent}%`,
          Realizado: `${metrics.onTimeFeedbacks} de ${metrics.totalFeedbacksSent} devolutivas no prazo`,
        },
        {
          Indicador: "SLI-03: Planos de Ação no Prazo",
          Meta: ">= 90%",
          Resultado: `${metrics.actionPlansOnTimePercent}%`,
          Realizado: `${metrics.onTimeActionPlans} concluídos no prazo (${metrics.pendingActionPlans} pendentes)`,
        },
      ];

      const wb = XLSX.utils.book_new();
      const wsMain = XLSX.utils.json_to_sheet(dataForSheet);
      const wsSli = XLSX.utils.json_to_sheet(sliSummary);

      XLSX.utils.book_append_sheet(wb, wsMain, `Agenda_${selectedCompetence}`);
      XLSX.utils.book_append_sheet(wb, wsSli, "Indicadores_SLI");

      XLSX.writeFile(wb, `Acompanhamento_Docente_SENAI_${selectedCompetence}.xlsx`);

      toast({
        title: "Exportação concluída",
        description: `Planilha Excel gerada com sucesso para a competência ${selectedCompetence}.`,
      });
    } catch (err) {
      console.error("Erro ao exportar:", err);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível gerar a planilha Excel.",
        variant: "destructive",
      });
    }
  };

  // Se o usuário não for viniciusladeialara@gmail.com, bloqueia e exibe acesso restrito
  if (!isAuthorized) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/50 rounded-2xl flex items-center justify-center text-rose-600 mb-4 border border-rose-200 dark:border-rose-900">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Acesso Restrito à Coordenação
          </h2>
          <p className="text-sm text-gray-500 max-w-md mt-2">
            Esta visão de Governança Pedagógica e Acompanhamento Docente é restrita ao gestor
            autorizado do sistema (LGPD / Princípio do Menor Privilégio).
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="bg-slate-900/5 dark:bg-slate-950">
      <PageHeader className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md pb-4">
        {/* Top bar com Título e Ações Globais */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                    Acompanhamento Docente
                  </h1>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px] font-semibold uppercase tracking-wider"
                  >
                    SLI / MSEP
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    Exclusivo Coordenação
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Central de Operações Pedagógicas • SENAI Unidade {selectedUnitId.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Navegador de Competência e Botões Globais */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Mês */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevMonth}
                className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900 dark:text-slate-300"
                title="Mês Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                <span>
                  {format(
                    new Date(
                      Number(selectedCompetence.split("-")[0]),
                      Number(selectedCompetence.split("-")[1]) - 1,
                      1
                    ),
                    "MMMM 'de' yyyy",
                    { locale: ptBR }
                  ).toUpperCase()}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextMonth}
                className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900 dark:text-slate-300"
                title="Próximo Mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="gap-2 text-xs font-semibold border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Exportar Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-2 text-xs font-semibold border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Printer className="h-4 w-4 text-slate-600" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* 4 Cards de Indicadores SLI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {/* SLI-01: Cobertura Mensal */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  SLI-01: Cobertura Mensal
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    metrics.coverageStatus === "green"
                      ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                      : metrics.coverageStatus === "yellow"
                      ? "bg-amber-500 shadow-sm shadow-amber-500/50"
                      : "bg-rose-500 shadow-sm shadow-rose-500/50"
                  }`}
                />
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {metrics.coveragePercent}%
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {metrics.totalMonitored} / {metrics.totalExpected} docentes
                </div>
              </div>

              <div className="mt-2">
                <Progress
                  value={metrics.coveragePercent}
                  className="h-1.5 bg-slate-100 dark:bg-slate-800"
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>Meta: 100% (SLO)</span>
                <span
                  className={
                    metrics.coveragePercent >= 100
                      ? "text-emerald-600 font-bold"
                      : metrics.coveragePercent >= 90
                      ? "text-amber-600 font-bold"
                      : "text-rose-600 font-bold"
                  }
                >
                  {metrics.coveragePercent >= 100
                    ? "Meta Atingida"
                    : metrics.coveragePercent >= 90
                    ? "Atenção"
                    : "Crítico"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* SLI-02: Fila de Pendências */}
          <Card
            className={`border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/60 ${
              metrics.pendingIsCritical ? "border-rose-400 ring-1 ring-rose-400/40" : ""
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  SLI-02: Fila de Pendências
                </span>
                {metrics.pendingIsCritical ? (
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0 uppercase">
                    Risco Fechamento
                  </Badge>
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                )}
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {metrics.pendingCount}
                </div>
                <div className="text-xs text-slate-500 font-medium">docentes sem registro</div>
              </div>

              <div className="mt-2 text-[11px] text-slate-500">
                {metrics.pendingCount === 0 ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Agenda zerada no mês
                  </span>
                ) : (
                  <span>Aguardando agendamento ou observação</span>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>Meta: 0 no fechamento</span>
                <span className="text-slate-500">Mês: {selectedCompetence}</span>
              </div>
            </CardContent>
          </Card>

          {/* SLA-01: Prazo de Devolutiva */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  SLA-01: Prazo Devolutiva
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    metrics.feedbackSlaStatus === "green"
                      ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                      : metrics.feedbackSlaStatus === "yellow"
                      ? "bg-amber-500 shadow-sm shadow-amber-500/50"
                      : "bg-rose-500 shadow-sm shadow-rose-500/50"
                  }`}
                />
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {metrics.feedbackSlaPercent}%
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {metrics.onTimeFeedbacks} / {metrics.totalFeedbacksSent} no prazo
                </div>
              </div>

              <div className="mt-2">
                <Progress
                  value={metrics.feedbackSlaPercent}
                  className="h-1.5 bg-slate-100 dark:bg-slate-800"
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>Meta: &gt;= 95%</span>
                <span
                  className={
                    metrics.feedbackSlaStatus === "green"
                      ? "text-emerald-600 font-bold"
                      : metrics.feedbackSlaStatus === "yellow"
                      ? "text-amber-600 font-bold"
                      : "text-rose-600 font-bold"
                  }
                >
                  {metrics.feedbackSlaStatus === "green"
                    ? "Em Conformidade"
                    : metrics.feedbackSlaStatus === "yellow"
                    ? "Alerta Moderado"
                    : "Fora do SLA"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* SLI-03: Planos de Ação no Prazo */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  SLI-03: Planos de Ação
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    metrics.actionPlansStatus === "green"
                      ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                      : metrics.actionPlansStatus === "yellow"
                      ? "bg-amber-500 shadow-sm shadow-amber-500/50"
                      : "bg-rose-500 shadow-sm shadow-rose-500/50"
                  }`}
                />
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {metrics.actionPlansOnTimePercent}%
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {metrics.onTimeActionPlans} concluídos ({metrics.pendingActionPlans} em aberto)
                </div>
              </div>

              <div className="mt-2">
                <Progress
                  value={metrics.actionPlansOnTimePercent}
                  className="h-1.5 bg-slate-100 dark:bg-slate-800"
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>Meta: &gt;= 90%</span>
                <span
                  className={
                    metrics.actionPlansStatus === "green"
                      ? "text-emerald-600 font-bold"
                      : "text-amber-600 font-bold"
                  }
                >
                  {metrics.pendingActionPlans > 0
                    ? `${metrics.pendingActionPlans} pendentes`
                    : "Todos em dia"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fila de Atenção Operacional (Alertas Visuais SLI) */}
        {alerts.length > 0 && (
          <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                  Fila de Atenção Operacional ({alerts.length}{" "}
                  {alerts.length === 1 ? "alerta" : "alertas"})
                </span>
              </div>
              <span className="text-[10px] text-amber-700 dark:text-amber-400">
                Alertas automáticos baseados em SLI / SLA
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {alerts.slice(0, 6).map((alert) => (
                <div
                  key={alert.id}
                  className="bg-white/90 dark:bg-slate-900/90 border border-amber-200 dark:border-amber-900/50 p-2.5 rounded-xl flex items-start justify-between gap-2 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={alert.type === "critical" ? "destructive" : "outline"}
                        className={`text-[9px] px-1.5 py-0 ${
                          alert.type === "warning"
                            ? "border-amber-500 text-amber-700 bg-amber-50"
                            : ""
                        }`}
                      >
                        {alert.badgeText}
                      </Badge>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {alert.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                      {alert.description}
                    </p>
                  </div>

                  {alert.teacherId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 shrink-0"
                      onClick={() => {
                        const target = consolidatedTeachers.find((t) => t.id === alert.teacherId);
                        if (target) {
                          if (alert.actionType === "feedback") {
                            handleOpenFeedback(target);
                          } else {
                            handleOpenObservation(target);
                          }
                        }
                      }}
                    >
                      Ação
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros Globais */}
        <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Busca Textual */}
          <div className="relative flex-1 min-w-[200px] sm:min-w-[240px] max-w-full sm:max-w-xs md:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por docente ou e-mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 sm:h-10 text-xs sm:text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>

          {/* Filtro de Área */}
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="h-9 sm:h-10 w-full sm:w-[170px] md:w-[180px] text-xs sm:text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <SelectValue placeholder="Todas as Áreas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Áreas</SelectItem>
              {DEFAULT_AREAS.map((area) => (
                <SelectItem key={area} value={area}>
                  {area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro de Vínculo */}
          <Select value={filterVinculo} onValueChange={setFilterVinculo}>
            <SelectTrigger className="h-9 sm:h-10 w-full sm:w-[130px] md:w-[140px] text-xs sm:text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <SelectValue placeholder="Vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Vínculos</SelectItem>
              <SelectItem value="quadro">Quadro</SelectItem>
              <SelectItem value="extraquadro">Extraquadro</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro de Status SLI */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 sm:h-10 w-full sm:w-[170px] md:w-[180px] text-xs sm:text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <SelectValue placeholder="Status SLI" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="pendente">Pendente no Mês</SelectItem>
              <SelectItem value="em_andamento">Aguardando Devolutiva</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="dispensado">Dispensado</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto text-xs text-slate-500 font-medium whitespace-nowrap">
            Exibindo <span className="font-bold text-slate-900 dark:text-slate-100">{filteredList.length}</span>{" "}
            de {teachers.length} docentes cadastrados
          </div>
        </div>
      </PageHeader>

      {/* Grid Principal / Tabela de Acompanhamento */}
      <PageContent>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 mt-4 overflow-hidden">
          <div className="overflow-x-auto w-full custom-scrollbar">
            <Table className="min-w-[880px] lg:min-w-full">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
              <TableRow>
                <TableHead className="w-[240px] font-bold text-slate-700 dark:text-slate-300 text-xs">
                  Docente
                </TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                  Vínculo
                </TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                  Área de Atuação
                </TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                  Competência
                </TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                  Status SLI
                </TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                  Último Acompanhamento
                </TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                  Devolutiva / SLA
                </TableHead>
                <TableHead className="text-right font-bold text-slate-700 dark:text-slate-300 text-xs">
                  Ações Rápidas
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <User className="h-8 w-8 text-slate-300" />
                      <p className="font-medium text-sm">Nenhum docente encontrado nos filtros</p>
                      <p className="text-xs text-slate-400">
                        Tente ajustar a busca ou os seletores de área e vínculo.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredList.map((item) => {
                  const isConcluido = item.status === "concluido";
                  const isEmAndamento = item.status === "em_andamento";
                  const isDispensado = item.status === "dispensado";
                  const isPendente = item.status === "pendente";

                  return (
                    <TableRow
                      key={item.id}
                      className={`transition-colors duration-150 ${
                        isConcluido
                          ? "hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
                          : isEmAndamento
                          ? "hover:bg-amber-50/40 dark:hover:bg-amber-950/20"
                          : isDispensado
                          ? "opacity-60 bg-slate-50/50 dark:bg-slate-900/30"
                          : "hover:bg-rose-50/30 dark:hover:bg-rose-950/10"
                      }`}
                    >
                      {/* Docente */}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {item.name ? item.name.charAt(0).toUpperCase() : "P"}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {item.email || "Sem e-mail cadastrado"}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Vínculo */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            item.vinculo === "quadro"
                              ? "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300"
                              : "border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300"
                          }`}
                        >
                          {item.vinculo === "quadro" ? "Quadro" : "Extraquadro"}
                        </Badge>
                      </TableCell>

                      {/* Área de Atuação */}
                      <TableCell>
                        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                          {item.area}
                        </span>
                      </TableCell>

                      {/* Competência */}
                      <TableCell>
                        <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400">
                          {selectedCompetence}
                        </span>
                      </TableCell>

                      {/* Status SLI com Formatação Condicional */}
                      <TableCell>
                        {isConcluido && (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-[10px] font-bold shadow-sm shadow-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Concluído
                          </Badge>
                        )}
                        {isEmAndamento && (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 text-[10px] font-bold shadow-sm shadow-amber-500/20">
                            <Clock className="h-3 w-3" />
                            Aguardando Devolutiva
                          </Badge>
                        )}
                        {isPendente && (
                          <Badge className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5 text-[10px] font-bold shadow-sm shadow-rose-500/20">
                            <AlertTriangle className="h-3 w-3" />
                            Pendente no Mês
                          </Badge>
                        )}
                        {isDispensado && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] text-slate-500 gap-1 bg-slate-200 dark:bg-slate-800"
                          >
                            <XCircle className="h-3 w-3" />
                            Dispensado
                          </Badge>
                        )}
                      </TableCell>

                      {/* Último Acompanhamento */}
                      <TableCell>
                        {item.record?.observationDate ? (
                          <div className="text-xs">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {format(parseISO(item.record.observationDate), "dd/MM/yyyy")}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Obs por {item.record.observerName || "Coordenação"}
                            </div>
                          </div>
                        ) : item.lastObservationDate ? (
                          <div className="text-xs">
                            <div className="text-slate-500">
                              {format(parseISO(item.lastObservationDate), "dd/MM/yyyy")}
                            </div>
                            <div className="text-[10px] text-amber-600 font-medium">
                              Há {item.daysSinceLastObs} dias
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sem registros</span>
                        )}
                      </TableCell>

                      {/* Devolutiva / SLA */}
                      <TableCell>
                        {item.record?.feedbackSent ? (
                          <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>
                              Enviada em{" "}
                              {item.record.feedbackDate
                                ? format(parseISO(item.record.feedbackDate), "dd/MM")
                                : "OK"}
                            </span>
                          </div>
                        ) : isEmAndamento ? (
                          <div className="text-xs">
                            <span className="text-amber-600 font-bold">Prazo: </span>
                            <span className="text-slate-700 dark:text-slate-300">
                              {item.record?.feedbackDeadline
                                ? format(parseISO(item.record.feedbackDeadline), "dd/MM/yyyy")
                                : "5 dias úteis"}
                            </span>
                          </div>
                        ) : isDispensado ? (
                          <span className="text-xs text-slate-400 line-clamp-1" title={item.record?.waiverReason}>
                            {item.record?.waiverReason || "Dispensado no mês"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>

                      {/* Ações Rápidas */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Registrar / Editar Observação */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs font-semibold border-blue-200 hover:bg-blue-50 text-blue-700 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                            onClick={() => handleOpenObservation(item)}
                            title="Registrar ou Editar Acompanhamento Pedagógico"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            {item.record ? "Editar" : "Registrar"}
                          </Button>

                          {/* Registrar Devolutiva */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs font-semibold border-emerald-200 hover:bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                            onClick={() => handleOpenFeedback(item)}
                            title="Registrar Devolutiva de Feedback"
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            Devolutiva
                          </Button>

                          {/* Dossiê Histórico */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                            onClick={() => handleOpenDossier(item)}
                            title="Ver Dossiê e Histórico do Docente"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {/* Dispensar / Justificar */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            onClick={() => handleOpenWaiver(item)}
                            title="Dispensar / Justificar Acompanhamento"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </Card>
      </PageContent>

      {/* MODAL 1: REGISTRO DE ACOMPANHAMENTO PEDAGÓGICO (SENAI MSEP) */}
      <Dialog open={isObservationModalOpen} onOpenChange={setIsObservationModalOpen}>
        <DialogContent className="w-[96vw] sm:max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl max-h-[92vh] flex flex-col p-4 sm:p-6 lg:p-7 overflow-hidden transition-all duration-200">
          <DialogHeader className="shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl font-black">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" />
              <span>Registro de Acompanhamento Docente</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Avaliação de conformidade pedagógica alinhada à Metodologia SENAI MSEP • Docente:{" "}
              <strong className="text-slate-900 dark:text-slate-100 font-bold">
                {selectedTeacher?.name}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1.5 sm:pr-2.5 custom-scrollbar space-y-4 sm:space-y-5 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Vínculo Institucional</Label>
                <Select
                  value={obsForm.vinculo}
                  onValueChange={(val) => setObsForm({ ...obsForm, vinculo: val as TeacherVinculo })}
                >
                  <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quadro">Quadro Próprio</SelectItem>
                    <SelectItem value="extraquadro">Extraquadro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Área de Atuação</Label>
                <Select
                  value={obsForm.area}
                  onValueChange={(val) => setObsForm({ ...obsForm, area: val })}
                >
                  <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_AREAS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Data da Observação</Label>
                <Input
                  type="date"
                  value={obsForm.observationDate}
                  onChange={(e) => setObsForm({ ...obsForm, observationDate: e.target.value })}
                  className="h-9 sm:h-10 text-xs sm:text-sm mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Observador / Coordenação</Label>
                <Input
                  value={obsForm.observerName}
                  onChange={(e) => setObsForm({ ...obsForm, observerName: e.target.value })}
                  placeholder="Nome do avaliador pedagógico"
                  className="h-9 sm:h-10 text-xs sm:text-sm mt-1"
                />
              </div>

              <div>
                <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Unidade Curricular / Turma / Sala</Label>
                <Input
                  value={obsForm.curricularUnit}
                  onChange={(e) => setObsForm({ ...obsForm, curricularUnit: e.target.value })}
                  placeholder="Ex: Metrologia • Turma MEC-01 • Lab 04"
                  className="h-9 sm:h-10 text-xs sm:text-sm mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                Aspectos Pedagógicos Observados (Metodologia MSEP)
              </Label>
              <Textarea
                rows={3}
                value={obsForm.pedagogicalAspects}
                onChange={(e) => setObsForm({ ...obsForm, pedagogicalAspects: e.target.value })}
                placeholder="Planejamento de aula, domínio do conteúdo técnico, utilização de metodologias ativas e recursos didáticos..."
                className="text-xs sm:text-sm mt-1 min-h-[75px] sm:min-h-[90px] lg:min-h-[110px] resize-y"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Pontos Fortes (Feedback Positivo)
                </Label>
                <Textarea
                  rows={3}
                  value={obsForm.strengths}
                  onChange={(e) => setObsForm({ ...obsForm, strengths: e.target.value })}
                  placeholder="Destaques na didática, pontualidade, engajamento dos alunos..."
                  className="text-xs sm:text-sm mt-1 min-h-[75px] sm:min-h-[90px] lg:min-h-[110px] resize-y border-emerald-200 dark:border-emerald-900/60 focus-visible:ring-emerald-500"
                />
              </div>

              <div>
                <Label className="text-xs sm:text-sm text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Oportunidades de Melhoria
                </Label>
                <Textarea
                  rows={3}
                  value={obsForm.improvements}
                  onChange={(e) => setObsForm({ ...obsForm, improvements: e.target.value })}
                  placeholder="Ajustes no tempo de prática, reforço no fechamento da aula..."
                  className="text-xs sm:text-sm mt-1 min-h-[75px] sm:min-h-[90px] lg:min-h-[110px] resize-y border-amber-200 dark:border-amber-900/60 focus-visible:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
              <div>
                <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Conformidade Metodologia SENAI MSEP</Label>
                <Select
                  value={obsForm.msepCompliance}
                  onValueChange={(val) =>
                    setObsForm({ ...obsForm, msepCompliance: val as MSEPCompliance })
                  }
                >
                  <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Totalmente Conforme</SelectItem>
                    <SelectItem value="parcial">Parcialmente Conforme</SelectItem>
                    <SelectItem value="adequando">Em Processo de Adequação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Prazo Limite para Devolutiva (SLA)</Label>
                <Input
                  type="date"
                  value={obsForm.feedbackDeadline}
                  onChange={(e) => setObsForm({ ...obsForm, feedbackDeadline: e.target.value })}
                  className="h-9 sm:h-10 text-xs sm:text-sm mt-1"
                />
              </div>
            </div>

            {/* Gestão de Planos de Ação */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <Label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Planos de Ação Pedagógica (Se aplicável)</span>
                <span className="text-[10px] sm:text-xs text-slate-400 font-normal">
                  {obsForm.actionPlans.length} plano(s)
                </span>
              </Label>

              {/* Lista de Planos */}
              {obsForm.actionPlans.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {obsForm.actionPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 sm:p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePlanItemStatus(plan.id)}
                          className="shrink-0 text-slate-400 hover:text-emerald-600"
                        >
                          {plan.status === "concluido" ? (
                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                          ) : (
                            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                          )}
                        </button>
                        <span
                          className={`truncate ${
                            plan.status === "concluido" ? "line-through text-slate-400" : "font-medium"
                          }`}
                        >
                          {plan.description}
                        </span>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        <span className="text-[10px] sm:text-xs text-slate-500 font-medium">
                          Venc: {format(parseISO(plan.dueDate), "dd/MM/yyyy")}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          onClick={() => handleRemovePlanItem(plan.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Adicionar Novo Plano */}
              <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Input
                  placeholder="Nova ação de melhoria (ex: alinhamento com instrutor sênior)..."
                  value={newPlanDescription}
                  onChange={(e) => setNewPlanDescription(e.target.value)}
                  className="h-9 sm:h-10 text-xs sm:text-sm flex-1 min-w-0"
                />
                <Input
                  type="date"
                  value={newPlanDueDate}
                  onChange={(e) => setNewPlanDueDate(e.target.value)}
                  className="h-9 sm:h-10 text-xs sm:text-sm w-full sm:w-[150px] shrink-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddPlanItem}
                  className="h-9 sm:h-10 text-xs sm:text-sm gap-1 border-blue-200 text-blue-600 shrink-0 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsObservationModalOpen(false)} className="h-9 sm:h-10 text-xs sm:text-sm">
              Cancelar
            </Button>
            <Button onClick={handleSaveObservation} className="h-9 sm:h-10 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              Salvar Acompanhamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: REGISTRO DE DEVOLUTIVA (FEEDBACK) */}
      <Dialog open={isFeedbackModalOpen} onOpenChange={setIsFeedbackModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden transition-all duration-200">
          <DialogHeader className="shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black">
              <Send className="h-5 w-5 text-emerald-600" />
              <span>Registrar Devolutiva de Feedback</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Confirmação de entrega dos alinhamentos pedagógicos para{" "}
              <strong className="text-slate-900 dark:text-slate-100">{selectedTeacher?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar space-y-4 py-3">
            <div>
              <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Data da Devolutiva</Label>
              <Input
                type="date"
                value={feedbackForm.feedbackDate}
                onChange={(e) =>
                  setFeedbackForm({ ...feedbackForm, feedbackDate: e.target.value })
                }
                className="h-9 sm:h-10 text-xs sm:text-sm mt-1"
              />
            </div>

            <div>
              <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Canal / Formato de Entrega</Label>
              <Select
                value={feedbackForm.feedbackChannel}
                onValueChange={(val) =>
                  setFeedbackForm({ ...feedbackForm, feedbackChannel: val })
                }
              >
                <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reunião Pedagógica Presencial">
                    Reunião Pedagógica Presencial
                  </SelectItem>
                  <SelectItem value="Reunião Online via Microsoft Teams">
                    Reunião Online via Microsoft Teams
                  </SelectItem>
                  <SelectItem value="E-mail Institucional Formal">
                    E-mail Institucional Formal
                  </SelectItem>
                  <SelectItem value="Diálogo em Sala de Aula">
                    Diálogo em Sala de Aula
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Notas e Acordos Estabelecidos</Label>
              <Textarea
                rows={4}
                value={feedbackForm.feedbackNotes}
                onChange={(e) =>
                  setFeedbackForm({ ...feedbackForm, feedbackNotes: e.target.value })
                }
                placeholder="Resumo dos pontos acordados durante o momento de devolutiva..."
                className="text-xs sm:text-sm mt-1 min-h-[90px] sm:min-h-[120px] resize-y"
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsFeedbackModalOpen(false)} className="h-9 sm:h-10 text-xs sm:text-sm">
              Cancelar
            </Button>
            <Button onClick={handleSaveFeedback} className="h-9 sm:h-10 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
              Confirmar Devolutiva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: DISPENSA JUSTIFICADA */}
      <Dialog open={isWaiverModalOpen} onOpenChange={setIsWaiverModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden transition-all duration-200">
          <DialogHeader className="shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
              <XCircle className="h-5 w-5 text-slate-500" />
              <span>Dispensar Acompanhamento no Mês</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Justifique o motivo pelo qual o docente{" "}
              <strong className="text-slate-900 dark:text-slate-100">{selectedTeacher?.name}</strong> não receberá acompanhamento na
              competência <strong className="text-slate-900 dark:text-slate-100">{selectedCompetence}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar space-y-4 py-3">
            <div>
              <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Motivo da Dispensa</Label>
              <Select value={waiverReason} onValueChange={setWaiverReason}>
                <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Docente em período de férias regulamentares.">
                    Férias Regulamentares
                  </SelectItem>
                  <SelectItem value="Licença Médica / Afastamento Legal.">
                    Licença Médica / Afastamento Legal
                  </SelectItem>
                  <SelectItem value="Carga Horária Suspensa / Sem aulas no mês.">
                    Sem Aulas no Mês / Carga Horária Suspensa
                  </SelectItem>
                  <SelectItem value="Participação em Treinamento / Capacitação Externa.">
                    Treinamento / Capacitação Externa
                  </SelectItem>
                  <SelectItem value="Outro motivo justificado pela coordenação.">
                    Outro Motivo Justificado
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Observações Adicionais</Label>
              <Textarea
                rows={3}
                value={waiverReason}
                onChange={(e) => setWaiverReason(e.target.value)}
                className="text-xs sm:text-sm mt-1 min-h-[80px] resize-y"
                placeholder="Detalhes sobre a dispensa..."
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsWaiverModalOpen(false)} className="h-9 sm:h-10 text-xs sm:text-sm">
              Cancelar
            </Button>
            <Button onClick={handleSaveWaiver} variant="secondary" className="h-9 sm:h-10 text-xs sm:text-sm font-bold">
              Registrar Dispensa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: DOSSIÊ HISTÓRICO DO DOCENTE */}
      <Dialog open={isDossierModalOpen} onOpenChange={setIsDossierModalOpen}>
        <DialogContent className="w-[96vw] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] flex flex-col p-4 sm:p-6 lg:p-7 overflow-hidden transition-all duration-200">
          <DialogHeader className="shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg lg:text-xl font-black">
              <Award className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" />
              <span>Dossiê Pedagógico & Histórico de Acompanhamentos</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Histórico consolidado do docente: <strong className="text-slate-900 dark:text-slate-100">{selectedTeacher?.name}</strong> •{" "}
              {selectedTeacher?.email || "Sem e-mail"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar py-3 space-y-4">
            {/* Resumo do Perfil */}
            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
              <div>
                <span className="text-slate-400">Vínculo:</span>{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {selectedTeacher?.vinculo === "quadro" ? "Quadro Próprio" : "Extraquadro"}
                </strong>
              </div>
              <div>
                <span className="text-slate-400">Área:</span>{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {selectedTeacher?.area || "Geral"}
                </strong>
              </div>
              <div>
                <span className="text-slate-400">Total de Acompanhamentos:</span>{" "}
                <strong className="text-blue-600 font-bold text-sm sm:text-base">
                  {
                    monitoringRecords.filter(
                      (r) => r.teacherId === selectedTeacher?.id && r.status === "concluido"
                    ).length
                  }
                </strong>
              </div>
            </div>

            {/* Linha do Tempo de Acompanhamentos Anteriores */}
            <div className="space-y-3">
              <h4 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Registros por Competência
              </h4>

              {monitoringRecords
                .filter((r) => r.teacherId === selectedTeacher?.id)
                .sort((a, b) => b.competence.localeCompare(a.competence)).length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-400 italic py-6 text-center">
                  Nenhum acompanhamento anterior registrado para este docente.
                </p>
              ) : (
                monitoringRecords
                  .filter((r) => r.teacherId === selectedTeacher?.id)
                  .sort((a, b) => b.competence.localeCompare(a.competence))
                  .map((rec) => (
                    <div
                      key={rec.id || rec.competence}
                      className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2.5 text-xs sm:text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px] sm:text-xs font-bold">
                            {rec.competence}
                          </Badge>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {rec.observationDate
                              ? `Observação: ${format(parseISO(rec.observationDate), "dd/MM/yyyy")}`
                              : "Sem observação"}
                          </span>
                        </div>
                        <Badge
                          className={`text-[9px] sm:text-[10px] font-bold ${
                            rec.status === "concluido"
                              ? "bg-emerald-600"
                              : rec.status === "em_andamento"
                              ? "bg-amber-500"
                              : rec.status === "dispensado"
                              ? "bg-slate-500"
                              : "bg-rose-600"
                          }`}
                        >
                          {rec.status.toUpperCase()}
                        </Badge>
                      </div>

                      {rec.pedagogicalAspects && (
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                          <strong>Aspectos:</strong> {rec.pedagogicalAspects}
                        </p>
                      )}

                      {rec.strengths && (
                        <p className="text-emerald-700 dark:text-emerald-400 leading-relaxed">
                          <strong>Pontos Fortes:</strong> {rec.strengths}
                        </p>
                      )}

                      {rec.improvements && (
                        <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
                          <strong>Melhorias:</strong> {rec.improvements}
                        </p>
                      )}

                      {rec.waiverReason && (
                        <p className="text-slate-500 italic leading-relaxed">
                          <strong>Justificativa de Dispensa:</strong> {rec.waiverReason}
                        </p>
                      )}

                      {rec.feedbackSent && (
                        <div className="text-[10px] sm:text-xs text-emerald-600 font-semibold pt-1 border-t border-slate-100 dark:border-slate-800">
                          Devolutiva entregue em{" "}
                          {rec.feedbackDate
                            ? format(parseISO(rec.feedbackDate), "dd/MM/yyyy")
                            : "Data não informada"}{" "}
                          ({rec.feedbackChannel || "Presencial"})
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <Button onClick={() => setIsDossierModalOpen(false)} className="h-9 sm:h-10 text-xs sm:text-sm">
              Fechar Dossiê
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
