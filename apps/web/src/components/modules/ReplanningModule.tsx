/**
 * @file ReplanningModule.tsx
 * @description Módulo para gerenciar replanejamentos e substituições de professores
 */

import React, { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/db";
import { collection, onSnapshot, addDoc, updateDoc, doc, Timestamp, getDocs } from "@/lib/sira-sql-adapter";
import { updateSchedule } from "@/services/scheduleService";
import { format, parse, isAfter, startOfDay, endOfDay, isSameDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from "@/lib/AuthContext";
import { useFirestoreCache } from "@/hooks/useCache";

import { 
  Plus, 
  UserX, 
  UserCheck, 
  Calendar, 
  FileText, 
  CalendarDays, 
  RefreshCw, 
  ChevronRight, 
  ChevronLeft, 
  AlertTriangle,
  ChevronDown,
  Clock,
  User,
  Edit,
  Trash2,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Interfaces
interface Teacher {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  allowedShifts?: string[];
}

interface Class {
  id: string;
  name: string;
  courseId: string;
  teacherIds: string[];
  teacherNames: string[];
}

interface Schedule {
  id: string;
  teacherId: string;
  teacherName: string;
  className: string;
  startTime: Timestamp;
  endTime: Timestamp;
  roomName: string;
  unitName: string;
  roomId: string;
  classId: string;
  // Novos campos para rastreamento de substituição
  isSubstitution?: boolean;
  originalTeacherId?: string | null;
  originalTeacherName?: string | null;
  absenceId?: string | null;
  substitutionAppliedAt?: Timestamp;
  substitutionAppliedBy?: string;
  substitutionReason?: string;
  substitutionVersion?: number;
  scheduleStatus?: 'original' | 'substituted' | 'cancelled';
}

interface Absence {
  id: string;
  teacherId: string;
  teacherName: string;
  reason: 'medical' | 'travel' | 'dismissal' | 'other' | 'vacation' | 'training' | 'indefinite';
  startDate: Timestamp;
  endDate: Timestamp;
  description: string;
  status: 'draft' | 'active' | 'partially_resolved' | 'fully_resolved' | 'completed' | 'cancelled';
  totalAffectedSchedules?: number;
  totalResolvedSchedules?: number;
  createdBy?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  version?: number;
}

interface SubstitutionAssignment {
  id: string;
  absenceId: string;
  scheduleId: string;
  originalTeacherId: string;
  substituteTeacherId: string;
  substituteTeacherName?: string;
  status: 'active' | 'reverted' | 'cancelled';
  appliedBy: string;
  appliedAt: Timestamp;
}

interface Substitution {
  id: string;
  absenceId: string;
  originalTeacherId: string;
  originalTeacherName: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: Timestamp;
}

export function ReplanningModule() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { cacheQuery } = useFirestoreCache();

  // Estados principais
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [assignments, setAssignments] = useState<SubstitutionAssignment[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);

  // Estados de navegação e detalhe
  const [selectedAbsenceId, setSelectedAbsenceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("absences");

  // Estados do modal de ausência
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({
    teacherId: '',
    reason: 'medical' as Absence['reason'],
    startDate: '',
    endDate: '',
    description: ''
  });

  // Estados do modal de substituição (Legado/Simplificado)
  const [isSubstitutionModalOpen, setIsSubstitutionModalOpen] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState<Absence | null>(null);
  const [substitutionForm, setSubstitutionForm] = useState({
    substituteTeacherId: ''
  });

  // Novos estados para o Motor de Sugestão
  const [suggestedTeachers, setSuggestedTeachers] = useState<any[]>([]);
  const [isCalculatingImpact, setIsCalculatingImpact] = useState(false);
  const [hideIncompatibleShifts, setHideIncompatibleShifts] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentAbsence = useMemo(() => 
    absences.find(a => a.id === selectedAbsenceId) || null
  , [absences, selectedAbsenceId]);

  const affectedSchedules = useMemo(() => {
    if (!currentAbsence) return [];
    const start = startOfDay(currentAbsence.startDate.toDate());
    const end = endOfDay(currentAbsence.endDate.toDate());

    return schedules.filter(s => 
      s.teacherId === currentAbsence.teacherId &&
      s.startTime.toDate() >= start &&
      s.startTime.toDate() <= end
    );
  }, [currentAbsence, schedules]);

  // Carregar dados em tempo real
  useEffect(() => {
    setIsLoading(true);

    const unsubs = [
      onSnapshot(collection(db, "schedules"), (snapshot) => {
        setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule)));
      }),
      onSnapshot(collection(db, "absences"), (snapshot) => {
        setAbsences(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Absence)));
      }),
      onSnapshot(collection(db, "substitutions"), (snapshot) => {
        setSubstitutions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Substitution)));
      }),
      onSnapshot(collection(db, "substitution_assignments"), (snapshot) => {
        setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubstitutionAssignment)));
      })
    ];

    // Carregar dados estáticos via Cache (FinOps Optimization)
    const loadStaticData = async () => {
      try {
        const [teachersData, allocationsData] = await Promise.all([
          cacheQuery("teachers", async () => {
            const snap = await getDocs(collection(db, "teachers"));
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
          }),
          cacheQuery("teacher_allocation", async () => {
            const snap = await getDocs(collection(db, "teacher_allocation"));
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
          })
        ]);
        setTeachers(teachersData as any[]);
        setAllocations(allocationsData as any[]);
        setIsLoading(false);
      } catch (error) {
        console.error("Erro ao carregar dados estáticos no ReplanningModule:", error);
        setIsLoading(false);
      }
    };

    loadStaticData();

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, []);


  // Funções para ausências
  const handleCreateAbsence = async () => {
    if (!absenceForm.teacherId || !absenceForm.startDate || !absenceForm.endDate) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    const startDate = startOfDay(parse(absenceForm.startDate, 'yyyy-MM-dd', new Date()));
    const endDate = endOfDay(parse(absenceForm.endDate, 'yyyy-MM-dd', new Date()));

    if (isAfter(startDate, endDate)) {
      toast({ title: "Erro", description: "A data de início deve ser anterior à data de fim.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const selectedTeacher = teachers.find(t => t.id === absenceForm.teacherId);
      
      // Calcular impacto inicial
      const start = startOfDay(parse(absenceForm.startDate, 'yyyy-MM-dd', new Date()));
      const end = endOfDay(parse(absenceForm.endDate, 'yyyy-MM-dd', new Date()));
      const affected = schedules.filter(s => 
        s.teacherId === absenceForm.teacherId &&
        s.startTime.toDate() >= start &&
        s.startTime.toDate() <= end
      );

      await addDoc(collection(db, "absences"), {
        teacherId: absenceForm.teacherId,
        teacherName: selectedTeacher?.name || '',
        reason: absenceForm.reason,
        startDate: Timestamp.fromDate(start),
        endDate: Timestamp.fromDate(end),
        description: absenceForm.description,
        status: 'active',
        totalAffectedSchedules: affected.length,
        totalResolvedSchedules: 0,
        createdBy: currentUser?.uid || 'system',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        version: 1
      });

      toast({ title: "Sucesso", description: `Ausência registrada. ${affected.length} blocos impactados.` });
      setIsAbsenceModalOpen(false);
      setAbsenceForm({ teacherId: '', reason: 'medical', startDate: '', endDate: '', description: '' });
    } catch (error) {
      console.error('Erro ao criar ausência:', error);
      toast({ title: "Erro", description: "Não foi possível registrar a ausência.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Funções para substituições
  const handleCreateSubstitution = async () => {
    if (!selectedAbsence || !substitutionForm.substituteTeacherId) {
      toast({ title: "Erro", description: "Selecione um professor substituto.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const substituteTeacher = teachers.find(t => t.id === substitutionForm.substituteTeacherId);
      if (!selectedAbsence || !substituteTeacher) return;

      const unconfirmedSchedules = affectedSchedules.filter(s => !s.isSubstitution);
      
      for (const schedule of unconfirmedSchedules) {
        // 1. Atualizar o agendamento com metadados avançados
        await updateSchedule(schedule.id, {
          teacherId: substitutionForm.substituteTeacherId,
          teacherName: substituteTeacher.name,
          isSubstitution: true,
          originalTeacherId: schedule.teacherId,
          originalTeacherName: schedule.teacherName,
          absenceId: selectedAbsence.id,
          substitutionAppliedAt: Timestamp.now(),
          substitutionAppliedBy: currentUser?.displayName || currentUser?.email || 'admin',
          substitutionReason: selectedAbsence.reason,
          substitutionVersion: (schedule.substitutionVersion || 0) + 1,
          scheduleStatus: 'substituted'
        });

        // 2. Criar o registro na nova coleção de auditoria
        await addDoc(collection(db, "substitution_assignments"), {
          absenceId: selectedAbsence.id,
          scheduleId: schedule.id,
          originalTeacherId: schedule.teacherId,
          substituteTeacherId: substitutionForm.substituteTeacherId,
          substituteTeacherName: substituteTeacher.name,
          status: 'active',
          appliedBy: currentUser?.displayName || currentUser?.email || 'admin',
          appliedAt: Timestamp.now()
        });
      }

      // 3. Atualizar o status da ausência
      const newResolvedCount = (selectedAbsence.totalResolvedSchedules || 0) + unconfirmedSchedules.length;
      const newStatus = newResolvedCount >= (selectedAbsence.totalAffectedSchedules || 0) ? 'fully_resolved' : 'partially_resolved';
      
      await updateDoc(doc(db, "absences", selectedAbsence.id), {
        status: newStatus,
        totalResolvedSchedules: newResolvedCount,
        updatedAt: Timestamp.now(),
        version: (selectedAbsence.version || 1) + 1
      });

      toast({ 
        title: "Sucesso", 
        description: `${unconfirmedSchedules.length} blocos atribuídos a ${substituteTeacher.name}.` 
      });
      
      setIsSubstitutionModalOpen(false);
      setSelectedAbsence(null);
      setSubstitutionForm({ substituteTeacherId: '' });
    } catch (error) {
      console.error('Erro ao criar substituição:', error);
      toast({ title: "Erro", description: "Não foi possível criar a substituição.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const openSubstitutionModal = (absence: Absence) => {
    setSelectedAbsence(absence);
    setIsSubstitutionModalOpen(true);
  };

  const handleCompleteAbsence = async (id: string) => {
    setIsProcessing(true);
    try {
      const absence = absences.find(a => a.id === id);
      if (!absence) return;

      const schedulesToRevert = schedules.filter(s => s.absenceId === id);
      for (const schedule of schedulesToRevert) {
        await updateSchedule(schedule.id, {
          teacherId: schedule.originalTeacherId || '',
          teacherName: schedule.originalTeacherName || '',
          isSubstitution: false,
          originalTeacherId: null,
          originalTeacherName: null,
          absenceId: null,
          scheduleStatus: 'original',
          substitutionVersion: (schedule.substitutionVersion || 0) + 1
        });
      }

      await updateDoc(doc(db, "absences", id), {
        status: 'completed',
        updatedAt: Timestamp.now()
      });

      const relatedAssignments = assignments.filter(a => a.absenceId === id);
      for (const ass of relatedAssignments) {
        await updateDoc(doc(db, "substitution_assignments", ass.id), {
          status: 'reverted'
        });
      }

      toast({ title: "Ausência Finalizada", description: `${schedulesToRevert.length} aulas voltaram ao docente original.` });
    } catch (error) {
      console.error('Erro ao finalizar ausência:', error);
      toast({ title: "Erro", description: "Não foi possível finalizar a ausência.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Motor de Sugestão (PRD Estratégico) ---
  const calculateTeacherScores = (targetSchedules: Schedule[]) => {
    if (targetSchedules.length === 0) return [];

    return teachers
      .filter(t => t.isActive && t.id !== currentAbsence?.teacherId)
      .map(teacher => {
        let score = 0;
        let reasons: string[] = [];
        let conflicts = 0;
        let shiftConflicts = 0;
        let totalDailyHours: Record<string, number> = {};

        // 1. Checar Conflitos de Horário (Critério Absoluto) e Validação de Turno
        for (const target of targetSchedules) {
          const hasConflict = schedules.some(s => 
            s.teacherId === teacher.id && 
            isWithinInterval(s.startTime.toDate(), { start: target.startTime.toDate(), end: target.endTime.toDate() })
          );
          if (hasConflict) conflicts++;

          // Validação de Turno
          const hour = target.startTime.toDate().getHours();
          const targetShift = hour < 12 ? 'matutino' : hour < 18 ? 'vespertino' : 'noturno';
          if (!teacher.allowedShifts || !teacher.allowedShifts.includes(targetShift)) {
            shiftConflicts++;
          }

          // Calcular carga diária para o alerta
          const dayKey = format(target.startTime.toDate(), 'yyyy-MM-dd');
          const duration = (target.endTime.seconds - target.startTime.seconds) / 3600;
          totalDailyHours[dayKey] = (totalDailyHours[dayKey] || 0) + duration;
        }

        if (conflicts === 0) {
          score += 10;
          reasons.push("Disponível em todos os horários");
        } else {
          reasons.push(`${conflicts} conflito(s) de horário`);
        }

        if (shiftConflicts > 0) {
          score -= 50; // penalidade forte
          reasons.push("Turno incompatível estruturalmente");
        }

        // 2. Mesma Unidade Curricular / Área (Critério Forte)
        const relevantUnits = targetSchedules.map(s => s.unitName);
        const teachesSameUnit = schedules.some(s => 
          s.teacherId === teacher.id && relevantUnits.includes(s.unitName)
        );
        if (teachesSameUnit) {
          score += 5;
          reasons.push("Já ministra esta unidade curricular");
        }

        // Inteligência de Disponibilidade Planejada (PRD)
        let plannedAvailable = 0;
        for (const target of targetSchedules) {
           const targetDate = startOfDay(target.startTime.toDate());
           const hour = target.startTime.toDate().getHours();
           const targetShift = hour < 12 ? 'matutino' : hour < 18 ? 'vespertino' : 'noturno';
           
           const hasPlannedDisponivel = allocations.some(a => 
             a.teacherId === teacher.id &&
             a.status === 'DISPONÍVEL' &&
             a.shift === targetShift &&
             isSameDay(a.date.toDate(), targetDate)
           );

           if (hasPlannedDisponivel) {
             plannedAvailable++;
           }
        }

        if (plannedAvailable > 0 && plannedAvailable === targetSchedules.length) {
           score += 20;
           reasons.push("Estava DISPONÍVEL no planejamento da alocação");
        } else if (plannedAvailable > 0) {
           score += 10;
           reasons.push("Estava DISPONÍVEL parcialmente na alocação");
        }

        // 3. Alertas de Carga Horária
        const overLimit = Object.values(totalDailyHours).some(h => h > 10);
        
        return {
          ...teacher,
          score,
          reasons,
          hasConflict: conflicts > 0,
          hasShiftConflict: shiftConflicts > 0,
          overLimit
        };
      })
      .sort((a, b) => b.score - a.score);
  };

  useEffect(() => {
    if (selectedAbsenceId && activeTab === "suggestions") {
      setSuggestedTeachers(calculateTeacherScores(affectedSchedules));
    }
  }, [selectedAbsenceId, activeTab, affectedSchedules, schedules, hideIncompatibleShifts, allocations]);

  // Função para lidar com clique na ausência
  const handleAbsenceClick = (id: string) => {
    setSelectedAbsenceId(id);
    setActiveTab("summary");
  };

  // Funções para renderização de status e cores
  const getAbsenceReasonText = (reason: string) => {
    const reasons: Record<string, string> = {
      medical: 'Atestado Médico',
      travel: 'Viagem Planejada',
      dismissal: 'Desligamento/Afastamento',
      vacation: 'Férias',
      training: 'Treinamento',
      indefinite: 'Afastamento Indefinido',
      other: 'Outros'
    };
    return reasons[reason] || reason;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800 border-green-200',
      partially_resolved: 'bg-amber-100 text-amber-800 border-amber-200',
      fully_resolved: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-gray-100 text-gray-800 border-gray-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    const labels: Record<string, string> = {
      active: 'Ativa',
      partially_resolved: 'Parcial',
      fully_resolved: 'Resolvida',
      completed: 'Finalizada',
      cancelled: 'Cancelada'
    };
    return (
      <Badge variant="outline" className={styles[status] || ''}>
        {labels[status] || status}
      </Badge>
    );
  };

  // Auxiliares para UI
  const allocatedTeachers = useMemo(() => teachers.filter(t => t.isActive), [teachers]);
  const availableTeachers = useMemo(() => teachers.filter(t => t.isActive), [teachers]);

  if (selectedAbsenceId && currentAbsence) {
    return (
      <PageLayout>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <PageHeader className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedAbsenceId(null)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    {currentAbsence.teacherName}
                    {getStatusBadge(currentAbsence.status)}
                  </h2>
                  <p className="text-muted-foreground">
                    {getAbsenceReasonText(currentAbsence.reason)} • {format(currentAbsence.startDate.toDate(), 'dd/MM/yyyy')} - {format(currentAbsence.endDate.toDate(), 'dd/MM/yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {currentAbsence.status === 'active' && (
                  <Button onClick={() => handleCompleteAbsence(currentAbsence.id)} variant="outline" disabled={isProcessing}>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Finalizar Ausência
                  </Button>
                )}
              </div>
            </div>

            <TabsList>
              <TabsTrigger value="summary">Resumo de Impacto</TabsTrigger>
              <TabsTrigger value="blocks">Blocos Afetados ({affectedSchedules.length})</TabsTrigger>
              <TabsTrigger value="suggestions">Sugestões de Substitução</TabsTrigger>
              <TabsTrigger value="history">Auditoria e Auditoria</TabsTrigger>
            </TabsList>
          </PageHeader>

          <PageContent>
            <TabsContent value="summary" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Total Impactado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{affectedSchedules.length} Blocos</div>
                    <p className="text-xs text-muted-foreground mt-1">Schedules encontrados no período</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Resolvidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      {affectedSchedules.filter(s => s.isSubstitution).length} / {affectedSchedules.length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Progresso operacional</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Pendentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-amber-500">
                      {affectedSchedules.filter(s => !s.isSubstitution).length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Aguardando cobertura</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Observações Administrativas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 dark:text-gray-300 italic">
                    {currentAbsence.description || "Nenhuma observação registrada."}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="blocks" className="space-y-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data / Hora</TableHead>
                        <TableHead>Turma / UC</TableHead>
                        <TableHead>Ambiente</TableHead>
                        <TableHead>Status Atual</TableHead>
                        <TableHead>Docente Atual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {affectedSchedules.map(schedule => (
                        <TableRow key={schedule.id}>
                          <TableCell>
                            <div className="font-medium">{format(schedule.startTime.toDate(), 'dd/MM/yyyy')}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(schedule.startTime.toDate(), 'HH:mm')} - {format(schedule.endTime.toDate(), 'HH:mm')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{schedule.className}</div>
                            <div className="text-xs text-muted-foreground">{schedule.unitName}</div>
                          </TableCell>
                          <TableCell>{schedule.roomName}</TableCell>
                          <TableCell>
                            {schedule.isSubstitution ? (
                              <Badge className="bg-blue-100 text-blue-800 border-none">Substituído</Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-200 text-amber-600">Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={schedule.isSubstitution ? "text-blue-600 font-bold" : ""}>
                              {schedule.teacherName}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="suggestions" className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <Alert className="flex-1">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Operação Assistida</AlertTitle>
                  <AlertDescription>
                    Selecione um professor abaixo para aplicar a substituição em **todos os blocos pendentes** desta ausência.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-md bg-white dark:bg-slate-900 shadow-sm shrink-0">
                  <input
                    type="checkbox"
                    id="hideIncompatible"
                    checked={hideIncompatibleShifts}
                    onChange={(e) => setHideIncompatibleShifts(e.target.checked)}
                    className="rounded border-gray-300 text-primary w-4 h-4"
                  />
                  <Label htmlFor="hideIncompatible" className="text-sm cursor-pointer">Ocultar Turno Incompatível</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestedTeachers
                  .filter(t => !hideIncompatibleShifts || !t.hasShiftConflict)
                  .map(teacher => (
                    <Card key={teacher.id} className={clsx(
                      "border-2 transition-all hover:shadow-md",
                      teacher.score >= 10 ? "border-green-100" : teacher.hasConflict ? "opacity-60 border-gray-100" : ""
                    )}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div className="font-bold text-lg">{teacher.name}</div>
                          <Badge className={teacher.score >= 10 ? "bg-green-500" : "bg-gray-400"}>
                            {teacher.score} pts
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-1">
                          {teacher.reasons.map((r: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              {r.includes("conflito") ? <UserX className="h-3 w-3 text-red-500" /> : <UserCheck className="h-3 w-3 text-green-500" />}
                              {r}
                            </div>
                          ))}
                        </div>
                        {teacher.overLimit && (
                          <Badge variant="destructive" className="w-full justify-center">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Alerta Carga +10h
                          </Badge>
                        )}
                        <Button
                          className="w-full"
                          variant={teacher.hasConflict ? "outline" : "default"}
                          disabled={teacher.hasConflict || isProcessing}
                          onClick={() => {
                            setSelectedAbsence(currentAbsence);
                            setSubstitutionForm({ substituteTeacherId: teacher.id });
                            setIsSubstitutionModalOpen(true);
                          }}
                        >
                          Selecionar como Substituto
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Operações</CardTitle>
                  <CardDescription>Rastreabilidade de todas as alterações feitas nesta ausência</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {assignments.filter(a => a.absenceId === currentAbsence.id).map(assignment => (
                      <div key={assignment.id} className="flex gap-4 border-l-2 border-primary pl-4 py-1">
                        <div className="flex-1">
                          <p className="text-sm font-bold">
                            Substituição Aplicada: {assignment.substituteTeacherName || assignment.substituteTeacherId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(assignment.appliedAt.toDate(), 'dd/MM/yyyy HH:mm')} por {assignment.appliedBy}
                          </p>
                        </div>
                        <Badge variant="outline">{assignment.status}</Badge>
                      </div>
                    ))}
                    {assignments.filter(a => a.absenceId === currentAbsence.id).length === 0 && (
                      <p className="text-muted-foreground text-center py-8 italic">Nenhuma mudança registrada em auditoria.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </PageContent>
        </Tabs>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-primary" />
            Controle de Replanejamento
          </h2>
          <p className="text-muted-foreground">Monitor acadêmico de ausências e substituições estratégicas</p>
        </div>
        <div className="flex items-center gap-4">
          <Dialog open={isAbsenceModalOpen} onOpenChange={setIsAbsenceModalOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg hover:shadow-xl transition-all">
                <Plus className="h-4 w-4 mr-2" />
                Registrar Faltas / Férias
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Registro Administrativo de Ausência</DialogTitle>
                <DialogDescription>Inicie o processo de replanejamento identificando o docente e o período</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Docente Ausente *</Label>
                  <Select value={absenceForm.teacherId} onValueChange={(v) => setAbsenceForm({ ...absenceForm, teacherId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o professor" />
                    </SelectTrigger>
                    <SelectContent>
                      {allocatedTeachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo / Motivo da Ausência *</Label>
                  <Select value={absenceForm.reason} onValueChange={(v: any) => setAbsenceForm({ ...absenceForm, reason: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medical">Atestado Médico</SelectItem>
                      <SelectItem value="vacation">Férias</SelectItem>
                      <SelectItem value="training">Treinamento</SelectItem>
                      <SelectItem value="travel">Viagem</SelectItem>
                      <SelectItem value="dismissal">Desligamento</SelectItem>
                      <SelectItem value="indefinite">Afastamento Indefinido</SelectItem>
                      <SelectItem value="other">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Início do Impacto</Label>
                    <Input type="date" value={absenceForm.startDate} onChange={(e) => setAbsenceForm({ ...absenceForm, startDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Fim do Impacto</Label>
                    <Input type="date" value={absenceForm.endDate} onChange={(e) => setAbsenceForm({ ...absenceForm, endDate: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Observações Operacionais</Label>
                  <Textarea value={absenceForm.description} onChange={(e) => setAbsenceForm({ ...absenceForm, description: e.target.value })} placeholder="Detalhes que ajudam o substituto..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAbsenceModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateAbsence} disabled={isProcessing}>
                  {isProcessing ? "Calculando Impacto..." : "Salvar e Analisar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="py-2 pb-0">
            <CardTitle className="text-xs font-bold uppercase text-primary/70 tracking-widest">Ausências Ativas</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-3xl font-extrabold">{absences.filter(a => a.status === 'active' || a.status === 'partially_resolved').length}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="py-2 pb-0">
            <CardTitle className="text-xs font-bold uppercase text-amber-600/70 tracking-widest">Pendente Cobertura</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-3xl font-extrabold text-amber-600">
               {absences.filter(a => a.status === 'active' || a.status === 'partially_resolved').reduce((acc, a) => acc + (a.totalAffectedSchedules || 0) - (a.totalResolvedSchedules || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="py-2 pb-0">
            <CardTitle className="text-xs font-bold uppercase text-green-600/70 tracking-widest">Retornos Previstos (7 dias)</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-3xl font-extrabold text-green-600">
              {absences.filter(a => isWithinInterval(a.endDate.toDate(), { start: new Date(), end: new Date(Date.now() + 7 * 86400000) })).length}
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-end">
           <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar Painel
           </Button>
        </div>
      </div>
      </PageHeader>

      <PageContent>
      <Card>
        <CardHeader>
          <CardTitle>Registro Geral de Impacto</CardTitle>
          <CardDescription>Visualize e resolva as coberturas acadêmicas em aberto</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Docente Ausente</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Status / Cobertura</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {absences.map(absence => (
                <TableRow key={absence.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => handleAbsenceClick(absence.id)}>
                  <TableCell className="font-bold">{absence.teacherName}</TableCell>
                  <TableCell>
                    {format(absence.startDate.toDate(), 'dd/MM')} - {format(absence.endDate.toDate(), 'dd/MM')}
                  </TableCell>
                  <TableCell>{getAbsenceReasonText(absence.reason)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(absence.status)}
                      <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-500" 
                          style={{ width: `${((absence.totalResolvedSchedules || 0) / (absence.totalAffectedSchedules || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {absences.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                     Nenhuma ausência pendente de replanejamento.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Substituição Estratégica */}
      <Dialog open={isSubstitutionModalOpen} onOpenChange={setIsSubstitutionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Atribuição de Substituição</DialogTitle>
            <DialogDescription>
              Você está designando {teachers.find(t => t.id === substitutionForm.substituteTeacherId)?.name} como substituto de {selectedAbsence?.teacherName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
             <Alert variant="destructive">
               <AlertTriangle className="h-4 w-4" />
               <AlertTitle>Atenção</AlertTitle>
               <AlertDescription>
                 Isso alterará todos os blocos **ainda não cobertos** do período selecionado. A ação é auditável.
               </AlertDescription>
             </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubstitutionModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSubstitution} disabled={isProcessing}>
               Confirmar e Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </PageContent>
    </PageLayout>
  );
}
