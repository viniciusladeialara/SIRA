import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/db";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  orderBy,
  Timestamp, getDocs, setDoc, writeBatch
} from "@/lib/sira-sql-adapter";
import { 
  startOfWeek, 
  addDays, 
  format, 
  eachDayOfInterval, 
  isSameDay,
  addWeeks,
  subWeeks
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Calendar as CalendarIcon, 
  CheckCircle2,
  Loader,
  LayoutGrid,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  Settings,
  AlertTriangle,
  X,
  Edit2,
  Copy,
  History,
  Sparkles,
  ArrowRightLeft,
  MapPin,
  Clock,
  BookOpen
} from 'lucide-react';
import { TeacherReallocationModal, ReallocationTarget } from '@/components/schedules/TeacherReallocationModal';
import { useFirestoreCache } from '@/hooks/useCache';
import { logAction, AuditAction } from '@/lib/AuditLog';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { usePermissions } from '@/hooks/usePermissions';

// Tipos base
interface Teacher {
  id: string;
  name: string;
  isActive: boolean;
  unitId?: string;
  unitIds?: string[];
  allowedShifts?: string[];
  shifts?: string[];
  turnos?: string[];
  turno?: string;
  preference?: string[];
}

interface Project {
  id: string;
  name: string;
}

type ShiftType = 'matutino' | 'vespertino' | 'noturno';

interface TeacherAllocation {
  id: string;
  teacherId: string;
  teacherName: string;
  projectId: string;
  projectName?: string;
  date: Timestamp;
  weekday: number;
  shift: ShiftType;
  status: string;
  hours: number;
  classId: string; // Obrigatório no PDR 1
  className: string;
  schoolName?: string;
  observation?: string;
}

interface Schedule {
  id: string;
  teacherId: string;
  teacherName?: string;
  teacherIds?: string[];
  projectId?: string;
  projectName?: string;
  classId?: string;
  className: string;
  roomId?: string;
  roomName?: string;
  courseId?: string;
  courseName?: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  dailyWorkload?: number;
  observation?: string;
}

// Default options for migration
const DEFAULT_STATUSES = [
  { id: 'PLANEJAMENTO', label: 'Planejamento', color: 'bg-blue-100 text-blue-800 border-blue-200', order: 1 },
  { id: 'EM AULA', label: 'Em Aula', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', order: 2 },
  { id: 'DISPONÍVEL', label: 'Disponível', color: 'bg-slate-100 text-slate-800 border-slate-200', order: 3 },
  { id: 'INOVAÇÃO', label: 'Inovação', color: 'bg-purple-100 text-purple-800 border-purple-200', order: 4 },
  { id: 'QUALIDADE', label: 'Qualidade', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', order: 5 },
  { id: 'APOIO LAB', label: 'Apoio Lab', color: 'bg-cyan-100 text-cyan-800 border-cyan-200', order: 6 },
  { id: 'FRC', label: 'FRC', color: 'bg-amber-100 text-amber-800 border-amber-200', order: 7 },
  { id: 'B + P', label: 'B + P', color: 'bg-pink-100 text-pink-800 border-pink-200', order: 8 },
  { id: 'FOLGA', label: 'Visita / Folga', color: 'bg-gray-100 text-gray-500 border-gray-200', order: 9 },
];

const PRESET_COLORS = [
  { label: 'Azul', value: 'bg-blue-100 text-blue-800 border-blue-200' },
  { label: 'Verde', value: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { label: 'Cinza', value: 'bg-slate-100 text-slate-800 border-slate-200' },
  { label: 'Roxo', value: 'bg-purple-100 text-purple-800 border-purple-200' },
  { label: 'Indigo', value: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { label: 'Ciano', value: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { label: 'Amarelo', value: 'bg-amber-100 text-amber-800 border-amber-200' },
  { label: 'Rosa', value: 'bg-pink-100 text-pink-800 border-pink-200' },
  { label: 'Laranja', value: 'bg-orange-100 text-orange-800 border-orange-200' },
  { label: 'Vermelho', value: 'bg-red-100 text-red-800 border-red-200' },
];

const SHIFTS: { id: ShiftType; label: string }[] = [
  { id: 'matutino', label: 'Matutino' },
  { id: 'vespertino', label: 'Vespertino' },
  { id: 'noturno', label: 'Noturno' }
];

export default function TeacherAllocationModule() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  // Data States
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<TeacherAllocation[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<any[]>(DEFAULT_STATUSES);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<any>(null);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptionColor, setNewOptionColor] = useState(PRESET_COLORS[0].value);
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]); 
  const [classes, setClasses] = useState<{id: string, name: string, period?: string}[]>([]); // Carregar turmas para vínculo

  // Helpers
  const getCellKey = (teacherId: string, date: Date, shift: string) => {
    return `${teacherId}_${format(date, 'yyyy-MM-dd')}_${shift}`;
  };

  // Estados para gestão de projetos
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProject, setEditingProject] = useState<{id: string, name: string} | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  
  // Estados para Drag-to-Fill (estilo Excel)
  const [dragSource, setDragSource] = useState<{
    teacherId: string;
    dayIndex: number;
    shift: string;
    data: any;
  } | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);

  const { cacheQuery, invalidate } = useFirestoreCache();
  const { isUserAdmin, userRole, canEdit, userData } = usePermissions();
  const selectedUnitId = userData?.selectedUnitId || "caceres";
  const isAdmin = isUserAdmin() || canEdit('teacher-allocation');
  const isProfessor = userRole === 'PROFESSOR';
  const isUserOnly = userRole === 'USER';
  const isReadOnly = !isAdmin && !isProfessor;
  
  // Filter States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedShift, setSelectedShift] = useState<string>("all");
  const [searchTeacher, setSearchTeacher] = useState("");
  const [showOnlyEligible, setShowOnlyEligible] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    teacher: Teacher;
    date: Date;
    shift: string;
    existingAllocation?: TeacherAllocation;
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<TeacherAllocation>>({
    status: 'DISPONÍVEL',
    hours: 4,
    projectId: '',
    classId: '', // Novo campo obrigatório
    className: '',
    schoolName: '',
    observation: ''
  });

  // Calculate Week Days (Monday to Saturday)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // 1 = Monday
  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 5) // Mon to Sat (6 days)
    });
  }, [weekStart]);

  // Memoized Lookups for Performance
  const allocationsMap = useMemo(() => {
    const map = new Map<string, TeacherAllocation>();
    allocations.forEach(a => {
      const key = getCellKey(a.teacherId, a.date.toDate(), a.shift);
      map.set(key, a);
    });
    return map;
  }, [allocations]);

  const getScheduleHours = (sched: any): number => {
    if (sched.dailyWorkload && Number(sched.dailyWorkload) > 0) {
      return Number(sched.dailyWorkload);
    }
    if (sched.startTime && sched.endTime) {
      const start = typeof sched.startTime.toDate === 'function' ? sched.startTime.toDate() : new Date(sched.startTime);
      const end = typeof sched.endTime.toDate === 'function' ? sched.endTime.toDate() : new Date(sched.endTime);
      const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (diffHours > 0) return Math.round(diffHours * 10) / 10;
    }
    return 4;
  };

  const schedulesMap = useMemo(() => {
    const map = new Map<string, any[]>();
    schedules.forEach(s => {
      if (!s.startTime) return;
      const date = typeof s.startTime.toDate === 'function' ? s.startTime.toDate() : new Date(s.startTime);
      const hour = date.getHours();
      let shift = 'noturno';
      if (hour >= 6 && hour < 12) shift = 'matutino';
      else if (hour >= 12 && hour < 18) shift = 'vespertino';

      const dateStr = format(date, 'yyyy-MM-dd');
      const teacherIds: string[] = [];
      if (s.teacherId) teacherIds.push(s.teacherId);
      if (Array.isArray(s.teacherIds)) {
        s.teacherIds.forEach((id: string) => {
          if (id && !teacherIds.includes(id)) teacherIds.push(id);
        });
      }

      teacherIds.forEach(tId => {
        const key = `${tId}_${dateStr}_${shift}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(s);
      });
    });
    return map;
  }, [schedules]);

  // Contabilização dinâmica de horas e rateio por projeto (integrando Alocações e Schedules oficiais)
  const weeklyAnalytics = useMemo(() => {
    const hours: Record<string, number> = {};
    const projectHours: Record<string, Record<string, number>> = {};
    const globalProjectTotals: Record<string, number> = {};
    let totalUnitHours = 0;
    let scheduledClassesCount = 0;

    teachers.forEach(t => {
      hours[t.id] = 0;
      projectHours[t.id] = {};

      weekDays.forEach(day => {
        SHIFTS.forEach(shift => {
          const key = getCellKey(t.id, day, shift.id);
          const pending = pendingChanges[key];
          const existing = allocationsMap.get(key);
          const active = pending || existing;
          const matching = schedulesMap.get(key) || [];

          let h = 0;
          let projName = '';

          if (active && active.status !== 'DELETED') {
            h = Number(active.hours) || 0;
            projName = active.projectName || (projects.find(p => p.id === active.projectId)?.name) || (active.status === 'PLANEJAMENTO' ? 'Planejamento' : 'Geral');
          } else if (matching.length > 0) {
            h = getScheduleHours(matching[0]);
            projName = matching[0].projectName || (projects.find(p => p.id === matching[0].projectId)?.name) || 'Grade Curricular';
            scheduledClassesCount++;
          }

          if (h > 0) {
            hours[t.id] += h;
            totalUnitHours += h;
            projectHours[t.id][projName] = (projectHours[t.id][projName] || 0) + h;
            globalProjectTotals[projName] = (globalProjectTotals[projName] || 0) + h;
          }
        });
      });
    });

    return {
      hours,
      projectHours,
      globalProjectTotals,
      totalUnitHours,
      scheduledClassesCount
    };
  }, [teachers, weekDays, pendingChanges, allocationsMap, schedulesMap, projects]);

  const weeklyHoursMap = weeklyAnalytics.hours;

  // Estados do Motor de Realocação
  const [reallocationTarget, setReallocationTarget] = useState<ReallocationTarget | null>(null);
  const [isReallocationModalOpen, setIsReallocationModalOpen] = useState(false);

  // Fetches
  const loadMetadata = async () => {
    try {
      // 1. Carregar Projetos (Cached)
      const projData = await cacheQuery("projects", async () => {
        const snap = await getDocs(collection(db, "projects"));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      });
      setProjects(projData);

      // 2. Carregar Professores Ativos da Unidade (Cached com suporte a unitId/unitIds)
      const teachersData = await cacheQuery(`teachers_active_${selectedUnitId}`, async () => {
        const snap = await getDocs(collection(db, "teachers"));
        const allTeachers = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        return allTeachers
          .filter(t => t.isActive !== false)
          .filter(t => {
            const primaryUnit = t.unitId || 'caceres';
            const unitList = Array.isArray(t.unitIds) && t.unitIds.length > 0 ? t.unitIds : [primaryUnit];
            return unitList.includes(selectedUnitId);
          }) as Teacher[];
      });
      setTeachers(teachersData || []);

      // 3. Carregar Status de Alocação (Cached)
      const statusData = await cacheQuery("allocation_options", async () => {
        const q = query(collection(db, "allocation_options"), orderBy("order", "asc"));
        const snap = await getDocs(q);
        if (snap.empty) return DEFAULT_STATUSES;
        return snap.docs.map(d => ({ ...d.data(), id: d.id }));
      });
      setAvailableStatuses(statusData);

      // 4. Carregar Turmas da Unidade
      const classesData = await cacheQuery(`classes_lite_${selectedUnitId}`, async () => {
        const q = query(collection(db, "classes"), where("unitId", "==", selectedUnitId));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, name: d.data().name, period: d.data().period }));
      });
      setClasses(classesData);

    } catch (error) {
      console.error("Erro ao carregar metadados:", error);
    }
  };

  // Carregamento inicial de metadados
  useEffect(() => {
    loadMetadata();
  }, [cacheQuery, selectedUnitId]);

  // Fetch Allocations for the current week - Otimizado com Caching e Snapshots reais
  useEffect(() => {
    const start = Timestamp.fromDate(weekStart);
    const end = Timestamp.fromDate(addDays(weekStart, 6)); // Até Sábado inclusive
    const weekKey = format(weekStart, 'yyyy-MM-dd');

    // Iniciar listener único para atualizações em tempo real (evita getDocs redundante)
    const qAllocs = query(
      collection(db, "teacher_allocation"),
      where("date", ">=", start),
      where("date", "<=", end)
    );

    const unsubAllocations = onSnapshot(qAllocs, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherAllocation));
      setAllocations(data.filter(a => !(a as any).unitId || (a as any).unitId === selectedUnitId));
    });

    // Buscar Schedules (Execução de aulas no período da semana para a unidade com fallback)
    const qSchedules = query(
      collection(db, "schedules"),
      where("startTime", ">=", start),
      where("startTime", "<=", end)
    );

    const unsubSchedules = onSnapshot(qSchedules, (snap) => {
      const allSchedules = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const filtered = allSchedules.filter(s => {
        if (!selectedUnitId || selectedUnitId === 'all') return true;
        return !s.unitId || s.unitId === selectedUnitId;
      });
      setSchedules(filtered);
    }, (error) => {
      console.warn("Erro ao buscar agendamentos na alocação:", error);
    });

    return () => {
      unsubAllocations();
      unsubSchedules();
    };
  }, [weekStart, cacheQuery, selectedUnitId]);

  // Listener global para finalizar o arraste (mouseup)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragSource && dragTargetIndex !== null) {
        // Executar o preenchimento (fill)
        const startIdx = dragSource.dayIndex;
        const endIdx = dragTargetIndex;
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);

        const newPendingChanges = { ...pendingChanges };
        
        for (let i = minIdx; i <= maxIdx; i++) {
          if (i === startIdx) continue; // Pular a origem
          
          const targetDay = weekDays[i];
          const key = getCellKey(dragSource.teacherId, targetDay, dragSource.shift);
          
          // Buscar alocação existente para manter o ID se houver
          const existing = allocationsMap.get(key);

          newPendingChanges[key] = {
            ...dragSource.data,
            id: existing?.id, // Manter ID existente para Update
            date: Timestamp.fromDate(targetDay),
            weekday: targetDay.getDay(),
            isPending: true
          };
        }

        setPendingChanges(newPendingChanges);
        toast({ title: "Preenchimento concluído!", description: `Copiado para ${maxIdx - minIdx} dias.` });
      }
      
      setDragSource(null);
      setDragTargetIndex(null);
    };

    if (dragSource) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragSource, dragTargetIndex, weekDays, pendingChanges, allocations, toast]);

  // Handlers
  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const handleCurrentWeek = () => setCurrentDate(new Date());

  const openCellModal = (teacher: Teacher, date: Date, shift: string) => {
    const key = getCellKey(teacher.id, date, shift);
    const pending = pendingChanges[key];
    const existing = allocationsMap.get(key);

    setEditingCell({ teacher, date, shift, existingAllocation: existing });
    
    // Prioritize pending changes if they exist
    const initialData = pending || existing;

    const matchingSched = (schedulesMap.get(key) || [])[0];

    if (initialData) {
      setFormData({
        status: initialData.status,
        projectId: initialData.projectId || '',
        classId: initialData.classId || '',
        hours: initialData.hours || 0,
        className: initialData.className || '',
        schoolName: initialData.schoolName || '',
        observation: initialData.observation || ''
      });
    } else if (matchingSched) {
      // Pré-preenche com dados reais do agendamento do Firestore!
      setFormData({
        status: 'EM AULA',
        projectId: selectedProjectId !== 'all' ? selectedProjectId : (matchingSched.projectId || ''),
        classId: matchingSched.classId || '',
        hours: getScheduleHours(matchingSched),
        className: matchingSched.className || '',
        schoolName: matchingSched.roomName || '',
        observation: `Ambiente: ${matchingSched.roomName || 'Sala'}`
      });
    } else {
      setFormData({
        status: 'DISPONÍVEL',
        projectId: selectedProjectId !== 'all' ? selectedProjectId : '',
        classId: '',
        hours: 4, 
        className: '',
        schoolName: '',
        observation: ''
      });
    }
    
    setIsModalOpen(true);
  };

  const saveAllocation = () => {
    if (!editingCell) return;
    
    try {
      if ((formData.status === 'EM AULA' || formData.status === 'PLANEJAMENTO') && (!formData.classId || !formData.hours)) {
        toast({ title: "Erro de Validação", description: "Vincule uma Turma e informe as Horas.", variant: "destructive" });
        return;
      }

      const key = getCellKey(editingCell.teacher.id, editingCell.date, editingCell.shift);
      
      const selectedProject = projects.find(p => p.id === formData.projectId);
      const selectedClass = classes.find(c => c.id === formData.classId);
      
      const payload = {
        id: editingCell.existingAllocation?.id, // Keep ID if updating existing
        teacherId: editingCell.teacher.id,
        teacherName: editingCell.teacher.name,
        projectId: formData.projectId || '',
        projectName: selectedProject?.name || '',
        date: Timestamp.fromDate(editingCell.date),
        weekday: editingCell.date.getDay(),
        shift: editingCell.shift,
        status: formData.status,
        hours: Number(formData.hours) || 0,
        classId: formData.classId || '',
        className: selectedClass?.name || formData.className || '',
        schoolName: formData.schoolName || '',
        observation: formData.observation || '',
        isPending: true // Flag to indicate staged change
      };

      setPendingChanges(prev => ({
        ...prev,
        [key]: payload
      }));
      
      toast({ title: "Alteração preparada!" });
      setIsModalOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao preparar", description: e.message, variant: "destructive" });
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    const batch = writeBatch(db);
    
    try {
      Object.entries(pendingChanges).forEach(([key, change]) => {
        const { isPending, ...payload } = change;
        const finalPayload = {
           ...payload,
           updatedAt: Timestamp.now()
        };

        if (payload.status === 'DELETED') {
          // Real delete from Firestore
          if (payload.id) {
            batch.delete(doc(db, "teacher_allocation", payload.id));
          }
        } else if (payload.id) {
          // Update existing
          batch.update(doc(db, "teacher_allocation", payload.id), finalPayload);
        } else {
          // Create new doc
          const newDocRef = doc(collection(db, "teacher_allocation"));
          const { id, ...createPayload } = finalPayload; 
          batch.set(newDocRef, { ...createPayload, createdAt: Timestamp.now() });
        }
      });

      await batch.commit();

      // Registro de Auditoria em lote
      const count = Object.keys(pendingChanges).length;
      if (currentUser && count > 0) {
        await logAction(
          AuditAction.BULK_CREATE_SCHEDULES, // Reaproveitando para alocações em lote
          currentUser as any,
          `Realizada alocação/planejamento de ${count} registros para a semana de ${format(weekStart, 'dd/MM/yyyy')}`,
          { 
            count, 
            weekStart: format(weekStart, 'yyyy-MM-dd'),
            changes: Object.keys(pendingChanges)
          }
        );
      }

      setPendingChanges({});
      toast({ title: "Sucesso!", description: "Todas as alocações foram salvas." });
    } catch (error: any) {
      console.error("Erro ao salvar lote:", error);
      toast({ title: "Erro ao salvar tudo", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Ações do Motor de Realocação Docente ---
  const handleOpenReallocation = (target: ReallocationTarget, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReallocationTarget(target);
    setIsReallocationModalOpen(true);
  };

  const handleConfirmReallocation = async (newTeacherId: string, newTeacherName: string, reason?: string) => {
    if (!reallocationTarget) return;

    try {
      const batch = writeBatch(db);

      // 1. Atualizar agendamento oficial na coleção schedules (se houver vínculo direto)
      if (reallocationTarget.scheduleId) {
        const scheduleRef = doc(db, "schedules", reallocationTarget.scheduleId);
        batch.update(scheduleRef, {
          teacherId: newTeacherId,
          teacherName: newTeacherName,
          isSubstitution: true,
          originalTeacherId: reallocationTarget.teacherId,
          originalTeacherName: reallocationTarget.teacherName,
          substitutionAppliedAt: Timestamp.now(),
          substitutionReason: reason || 'Realocação preditiva via Motor Docente',
          updatedAt: Timestamp.now()
        });
      }

      // 2. Liberar o professor anterior na matriz de alocação
      const prevKey = getCellKey(reallocationTarget.teacherId, reallocationTarget.date, reallocationTarget.shift);
      const prevAlloc = allocationsMap.get(prevKey);
      if (prevAlloc?.id) {
        batch.update(doc(db, "teacher_allocation", prevAlloc.id), {
          status: 'DISPONÍVEL',
          hours: 0,
          observation: `Aula realocada para ${newTeacherName}. ${reason || ''}`.trim(),
          updatedAt: Timestamp.now()
        });
      }

      // 3. Alocar para o novo professor
      const newKey = getCellKey(newTeacherId, reallocationTarget.date, reallocationTarget.shift);
      const newAlloc = allocationsMap.get(newKey);
      const newAllocPayload = {
        teacherId: newTeacherId,
        teacherName: newTeacherName,
        projectId: reallocationTarget.projectId || '',
        projectName: reallocationTarget.projectName || '',
        date: Timestamp.fromDate(reallocationTarget.date),
        weekday: reallocationTarget.date.getDay(),
        shift: reallocationTarget.shift,
        status: 'EM AULA',
        hours: reallocationTarget.hours,
        classId: '',
        className: reallocationTarget.className,
        schoolName: reallocationTarget.roomName || '',
        observation: `Substituição de ${reallocationTarget.teacherName}. ${reason || ''}`.trim(),
        unitId: selectedUnitId,
        updatedAt: Timestamp.now()
      };

      if (newAlloc?.id) {
        batch.update(doc(db, "teacher_allocation", newAlloc.id), newAllocPayload);
      } else {
        const newDocRef = doc(collection(db, "teacher_allocation"));
        batch.set(newDocRef, { ...newAllocPayload, createdAt: Timestamp.now() });
      }

      await batch.commit();

      if (currentUser) {
        await logAction(
          AuditAction.UPDATE_SCHEDULE,
          currentUser as any,
          `Realocou aula de ${reallocationTarget.className} (${reallocationTarget.shift}) de ${reallocationTarget.teacherName} para ${newTeacherName}`,
          {
            scheduleId: reallocationTarget.scheduleId,
            fromTeacherId: reallocationTarget.teacherId,
            toTeacherId: newTeacherId,
            date: format(reallocationTarget.date, 'yyyy-MM-dd'),
            shift: reallocationTarget.shift,
            reason
          }
        );
      }

      toast({
        title: "Realocação Concluída com Sucesso!",
        description: `Aula atribuída a ${newTeacherName}. Grade oficial e planejamento atualizados.`
      });
    } catch (error: any) {
      console.error("Erro na realocação:", error);
      toast({
        title: "Erro na Realocação",
        description: error.message || "Não foi possível efetivar a troca.",
        variant: "destructive"
      });
      throw error;
    }
  };

  // --- Sincronização 1-Clique dos Agendamentos Reais do Firestore para a Alocação ---
  const handleSyncFromSchedules = () => {
    let count = 0;
    const newPending = { ...pendingChanges };

    schedules.forEach(s => {
      if (!s.startTime || !s.teacherId) return;
      const date = typeof s.startTime.toDate === 'function' ? s.startTime.toDate() : new Date(s.startTime);
      const hour = date.getHours();
      let shift: 'matutino' | 'vespertino' | 'noturno' = 'noturno';
      if (hour >= 6 && hour < 12) shift = 'matutino';
      else if (hour >= 12 && hour < 18) shift = 'vespertino';

      const key = getCellKey(s.teacherId, date, shift);
      const existing = allocationsMap.get(key);

      if (!existing && !newPending[key]) {
        const hours = getScheduleHours(s);
        const selectedProj = projects.find(p => p.id === s.projectId);

        newPending[key] = {
          teacherId: s.teacherId,
          teacherName: s.teacherName || teachers.find(t => t.id === s.teacherId)?.name || 'Docente',
          date: Timestamp.fromDate(date),
          weekday: date.getDay(),
          shift,
          status: 'EM AULA',
          hours,
          classId: s.classId || '',
          className: s.className || '',
          schoolName: s.roomName || '',
          projectId: s.projectId || '',
          projectName: selectedProj?.name || s.courseName || '',
          observation: `Ambiente: ${s.roomName || 'Sala'}`,
          isPending: true
        };
        count++;
      }
    });

    if (count === 0) {
      toast({
        title: "Grade Sincronizada",
        description: "Todos os agendamentos da semana já estão refletidos na matriz."
      });
    } else {
      setPendingChanges(newPending);
      toast({
        title: "Agendamentos Carregados!",
        description: `${count} aula(s) da grade foram importadas para revisão. Clique em 'Salvar' para gravar em definitivo.`
      });
    }
  };

  // --- Funções de Gestão de Projetos ---
  const handleAddProject = async () => {
    if (!newProjectName.trim() || isSavingProject || !isAdmin) return;
    setIsSavingProject(true);
    try {
      await addDoc(collection(db, "projects"), { name: newProjectName.trim(), createdAt: Timestamp.now() });
      setNewProjectName("");
      invalidate("projects");
      // Recarregar projetos manualmente após invalidação
      const snap = await getDocs(collection(db, "projects"));
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
      toast({ title: "Sucesso", description: "Projeto adicionado com sucesso." });
    } catch (error) {
      console.error("Erro ao adicionar projeto:", error);
      toast({ title: "Erro", description: "Erro ao adicionar projeto.", variant: "destructive" });
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !editingProject.name.trim() || isSavingProject || !isAdmin) return;
    setIsSavingProject(true);
    try {
      await updateDoc(doc(db, "projects", editingProject.id), { name: editingProject.name.trim(), updatedAt: Timestamp.now() });
      setEditingProject(null);
      invalidate("projects");
      const snap = await getDocs(collection(db, "projects"));
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
      toast({ title: "Sucesso", description: "Projeto atualizado com sucesso." });
    } catch (error) {
      console.error("Erro ao atualizar projeto:", error);
      toast({ title: "Erro", description: "Erro ao atualizar projeto.", variant: "destructive" });
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este projeto?") || isSavingProject || !isAdmin) return;
    setIsSavingProject(true);
    try {
      await deleteDoc(doc(db, "projects", id));
      invalidate("projects");
      const snap = await getDocs(collection(db, "projects"));
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
      toast({ title: "Sucesso", description: "Projeto excluído com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir projeto:", error);
      toast({ title: "Erro", description: "Erro ao excluir projeto.", variant: "destructive" });
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDiscard = () => {
    if (Object.keys(pendingChanges).length === 0) return;
    if (window.confirm(`Deseja descartar ${Object.keys(pendingChanges).length} alterações não salvas?`)) {
       setPendingChanges({});
    }
  };

  const handleCopyWeekToNext = async () => {
    if (allocations.length === 0) {
      toast({ title: "Aviso", description: "Não há alocações na semana atual para copiar.", variant: "destructive" });
      return;
    }

    if (!window.confirm("Deseja replicar todas as alocações visíveis para a próxima semana? Isso substituirá rascunhos existentes lá.")) {
      return;
    }

    setIsSaving(true);
    try {
      const nextWeekStart = addWeeks(weekStart, 1);
      const nextWeekEnd = addDays(nextWeekStart, 6);
      
      // Fetch existing allocations for the next week to preserve IDs and avoid duplicates
      const qNext = query(
        collection(db, "teacher_allocation"),
        where("date", ">=", Timestamp.fromDate(nextWeekStart)),
        where("date", "<=", Timestamp.fromDate(nextWeekEnd))
      );
      const snapNext = await getDocs(qNext);
      const nextWeekExistingMap = new Map<string, string>(); // Key -> ID
      snapNext.docs.forEach(d => {
        const data = d.data();
        const date = data.date.toDate();
        const key = getCellKey(data.teacherId, date, data.shift);
        nextWeekExistingMap.set(key, d.id);
      });

      const newPendingChanges = { ...pendingChanges };
      let copiedCount = 0;

      allocations.forEach(a => {
        // Skip if deleted in current pending
        const currentKey = getCellKey(a.teacherId, a.date.toDate(), a.shift);
        if (pendingChanges[currentKey]?.status === 'DELETED') return;

        const nextDate = addWeeks(a.date.toDate(), 1);
        const nextKey = getCellKey(a.teacherId, nextDate, a.shift);
        
        const existingId = nextWeekExistingMap.get(nextKey);
        
        newPendingChanges[nextKey] = {
          ...a,
          id: existingId, // Preserve ID if exists for update vs create
          date: Timestamp.fromDate(nextDate),
          weekday: nextDate.getDay(),
          isPending: true
        };
        copiedCount++;
      });

      setPendingChanges(newPendingChanges);
      setCurrentDate(nextWeekStart);
      toast({ 
        title: "Semana Replicada!", 
        description: `${copiedCount} alocações copiadas para a próxima semana. Lembre-se de salvar.` 
      });
    } catch (error: any) {
      console.error("Erro ao copiar semana:", error);
      toast({ title: "Erro ao copiar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => 
      t.name.toLowerCase().includes(searchTeacher.toLowerCase())
    );
  }, [teachers, searchTeacher]);

  const shiftsToRender = selectedShift === 'all' ? SHIFTS : SHIFTS.filter(s => s.id === selectedShift);

  const getHourBadgeColor = (hours: number) => {
    if (hours === 0) return "bg-slate-100 text-slate-500";
    if (hours < 40) return "bg-green-100 text-green-700 border-green-200";
    if (hours <= 44) return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  const getStatusBadgeColor = (status: string) => {
    return availableStatuses.find(s => s.id === status)?.color || "bg-slate-100 text-slate-800 border-slate-200";
  };

  /**
   * Normaliza e extrai os turnos configurados no perfil do professor ("M", "V", "N").
   */
  const getTeacherConfiguredShifts = useCallback((teacher: Teacher): string[] => {
    const rawList: any[] = [
      ...(Array.isArray(teacher.allowedShifts) ? teacher.allowedShifts : []),
      ...(Array.isArray(teacher.shifts) ? teacher.shifts : []),
      ...(Array.isArray(teacher.turnos) ? teacher.turnos : []),
      ...(teacher.turno ? [teacher.turno] : []),
      ...(teacher.preference ? (Array.isArray(teacher.preference) ? teacher.preference : [teacher.preference]) : [])
    ];

    const matched = new Set<string>();

    rawList.forEach(item => {
      if (typeof item !== 'string') return;
      const clean = item.trim().toLowerCase();
      if (clean === 'm' || clean === 'matutino' || clean.startsWith('mat')) {
        matched.add('matutino');
      }
      if (clean === 'v' || clean === 'vespertino' || clean.startsWith('vesp')) {
        matched.add('vespertino');
      }
      if (clean === 'n' || clean === 'noturno' || clean.startsWith('not')) {
        matched.add('noturno');
      }
    });

    return Array.from(matched);
  }, []);

  /**
   * Verifica se um professor deve ser exibido no bloco de um determinado turno.
   * Critérios:
   * 1. O turno está pré-definido no cadastro do professor ("M" Matutino, "V" Vespertino, "N" Noturno).
   * 2. OU o professor possui aula oficial na grade (schedules) ou alocação ativa neste turno na semana.
   */
  const isTeacherInShiftBlock = useCallback((teacher: Teacher, shiftId: string): boolean => {
    // 1. Checa turnos pré-definidos no perfil do professor
    const configuredShifts = getTeacherConfiguredShifts(teacher);
    if (configuredShifts.includes(shiftId)) {
      return true;
    }

    // 2. Checa se o professor tem aula agendada na grade ou alocação ativa neste turno nesta semana
    const hasActiveClassesInShift = weekDays.some(day => {
      const key = getCellKey(teacher.id, day, shiftId);
      const scheds = schedulesMap.get(key);
      const alloc = pendingChanges[key] || allocationsMap.get(key);
      return (scheds && scheds.length > 0) || (alloc && alloc.status !== 'DELETED' && alloc.status !== 'DISPONÍVEL');
    });

    return hasActiveClassesInShift;
  }, [getTeacherConfiguredShifts, weekDays, schedulesMap, pendingChanges, allocationsMap]);

  const renderTeacherShiftBadges = (teacher: Teacher) => {
    const shifts = getTeacherConfiguredShifts(teacher);
    if (shifts.length === 0) {
      return (
        <span className="text-[9px] text-slate-400 dark:text-slate-500 italic">
          Sem turno
        </span>
      );
    }

    return (
      <div className="flex items-center gap-1" title={`Turnos no perfil: ${shifts.map(s => s.charAt(0).toUpperCase()).join(', ')}`}>
        {shifts.includes('matutino') && (
          <span className="px-1 py-0.2 text-[9px] font-black rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300">
            M
          </span>
        )}
        {shifts.includes('vespertino') && (
          <span className="px-1 py-0.2 text-[9px] font-black rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300">
            V
          </span>
        )}
        {shifts.includes('noturno') && (
          <span className="px-1 py-0.2 text-[9px] font-black rounded bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300">
            N
          </span>
        )}
      </div>
    );
  };

  const handleAddOption = async () => {
    if (!newOptionLabel.trim()) return;
    try {
      const nextOrder = availableStatuses.length > 0 ? Math.max(...availableStatuses.map(s => s.order || 0)) + 1 : 1;
      const optionId = newOptionLabel.toUpperCase().replace(/\s+/g, '_');
      await setDoc(doc(db, "allocation_options", optionId), {
        id: optionId,
        label: newOptionLabel,
        color: newOptionColor,
        order: nextOrder,
        isActive: true
      });
      setNewOptionLabel("");
      toast({ title: "Sucesso", description: "Opção adicionada com sucesso." });
    } catch (e) {
      toast({ title: "Erro", description: "Erro ao adicionar opção.", variant: "destructive" });
    }
  };

  const handleDeleteOption = async (id: string) => {
    try {
      await deleteDoc(doc(db, "allocation_options", id));
      toast({ title: "Sucesso", description: "Opção removida." });
    } catch (e) {
      toast({ title: "Erro", description: "Erro ao remover opção.", variant: "destructive" });
    }
  };

  const handleUpdateOption = async () => {
    if (!editingOption || !editingOption.label.trim()) return;
    try {
      await updateDoc(doc(db, "allocation_options", editingOption.id), {
        label: editingOption.label,
        color: editingOption.color
      });
      setEditingOption(null);
      toast({ title: "Sucesso", description: "Opção atualizada." });
    } catch (e) {
      toast({ title: "Erro", description: "Erro ao atualizar opção.", variant: "destructive" });
    }
  };

  return (
    <PageLayout>
      {/* Estilo global para desabilitar seleção durante o arraste */}
      {dragSource && (
        <style dangerouslySetInnerHTML={{ __html: `
          body { 
            user-select: none !important; 
            -webkit-user-select: none !important;
            cursor: crosshair !important;
          }
        `}} />
      )}
      
      <PageHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
              Alocação Preditiva de Docentes
              {isReadOnly && (
                <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 text-slate-500 border-slate-200 uppercase tracking-tighter">
                  Modo Visualização
                </Badge>
              )}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">Planejamento e controle semanal de capacidade e distribuição por turno.</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsProjectManagerOpen(true)} className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Gerenciar Projetos
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configurar Opções
                </Button>
              </>
            )}
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="space-y-8 pb-10">
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardContent className="p-4 flex flex-col lg:flex-row gap-4">
              <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <Button variant="ghost" size="icon" onClick={handlePrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
                <div className="px-4 font-semibold text-sm min-w-[200px] text-center flex items-center justify-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-slate-500"/>
                  {format(weekDays[0], "dd/MM")} - {format(weekDays[5], "dd/MM")}
                </div>
                <Button variant="ghost" size="icon" onClick={handleNextWeek}><ChevronRight className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={handleCurrentWeek} className="ml-2 h-8 text-xs">Atual</Button>
                {isAdmin && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSyncFromSchedules} 
                      className="ml-2 h-8 text-xs gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 shadow-xs font-semibold"
                      disabled={isSaving}
                      title="Importar agendamentos reais da grade para a alocação"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      Sincronizar da Grade
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCopyWeekToNext} 
                      className="ml-2 h-8 text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                      disabled={isSaving}
                      title="Replicar esta semana para a próxima"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar p/ Próxima
                    </Button>
                  </>
                )}
              </div>

              <div className="flex-1 flex gap-4 max-w-4xl flex-wrap">
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger id="filter-project" className="w-[180px]">
                    <SelectValue placeholder="Filtrar por Projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Projetos</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger id="filter-shift" className="w-[160px]">
                    <SelectValue placeholder="Turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Turnos</SelectItem>
                    <SelectItem value="matutino">Matutino</SelectItem>
                    <SelectItem value="vespertino">Vespertino</SelectItem>
                    <SelectItem value="noturno">Noturno</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      id="search-teacher"
                      name="search-teacher"
                      placeholder="Buscar professor..."
                      className="pl-9"
                      value={searchTeacher}
                      onChange={(e) => setSearchTeacher(e.target.value)}
                    />
                </div>

                <div className="flex items-center space-x-2 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-md self-center">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={showOnlyEligible} 
                      onChange={(e) => setShowOnlyEligible(e.target.checked)}
                      className="rounded border-slate-300 text-primary w-4 h-4"
                    />
                    Docentes Habilitados
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cockpit Semanal de Horas & Projetos Integrados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Carga Semanal Total</span>
                <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{weeklyAnalytics.totalUnitHours}h</span>
              </div>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Aulas na Grade (Firestore)</span>
                <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{weeklyAnalytics.scheduledClassesCount} aulas</span>
              </div>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex items-center gap-3 col-span-1 sm:col-span-2">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-lg shrink-0">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Rateio por Projeto na Semana</span>
                <div className="flex flex-wrap gap-1.5 mt-1 max-h-12 overflow-y-auto">
                  {Object.entries(weeklyAnalytics.globalProjectTotals).map(([pName, pHours]) => (
                    <Badge key={pName} variant="outline" className="text-[10px] font-semibold bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300">
                      {pName}: <strong>{pHours}h</strong>
                    </Badge>
                  ))}
                  {Object.keys(weeklyAnalytics.globalProjectTotals).length === 0 && (
                    <span className="text-xs text-slate-400">Nenhum projeto com horas registradas nesta semana</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8 pb-10">
            {!isProfessor && shiftsToRender.map(shift => (
              <Card key={shift.id} className="shadow-md border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center gap-3">
                  <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                    Turno: {shift.label}
                  </h3>
                </div>
                
                <ScrollArea className="w-full h-[450px]">
                  <div className="min-w-[1000px]">
                    <table className="w-full text-sm text-left border-separate border-spacing-0">
                      <thead className="sticky top-0 z-30 bg-slate-50 dark:bg-slate-900">
                        <tr>
                          <th className="px-4 py-3 min-w-[200px] border-r border-b border-slate-200 dark:border-slate-800 sticky left-0 top-0 z-50 bg-slate-50 dark:bg-slate-900 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">Professor</th>
                          {weekDays.map(day => (
                            <th key={day.toISOString()} className="px-4 py-3 min-w-[140px] text-center border-r border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 bg-slate-50 dark:bg-slate-900">
                              <div className="flex flex-col items-center">
                                <span className="uppercase text-[10px] tracking-widest">{format(day, 'EEEE', { locale: ptBR }).split('-')[0]}</span>
                                <span className="text-base text-slate-800 dark:text-slate-200 font-bold">{format(day, 'dd/MM')}</span>
                              </div>
                            </th>
                          ))}
                          <th className="px-4 py-3 min-w-[100px] text-center border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 bg-slate-50 dark:bg-slate-900">Total Semanal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredTeachers.map(teacher => {
                          const totalTeacherHours = weeklyHoursMap[teacher.id] || 0;
                          // Check if teacher matches project filter globally for the week
                          // Optimizado: ao invés de filtrar todas alocações, verificamos o Map
                          // Mas o filtro de projeto global ainda precisa checar se ALGUMA alocação do prof é do projeto.
                          // Vamos pré-calcular isso também se necessário, ou usar uma busca rápida.
                          if (selectedProjectId !== 'all') {
                            const hasProject = allocations.some(a => a.teacherId === teacher.id && a.projectId === selectedProjectId) || 
                                              Object.values(pendingChanges).some(c => c.teacherId === teacher.id && c.projectId === selectedProjectId);
                            if (!hasProject) return null;
                          }

                          if (showOnlyEligible) {
                            if (!teacher.allowedShifts || teacher.allowedShifts.length === 0 || !teacher.allowedShifts.includes(shift.id)) {
                              return null;
                            }
                          }

                          return (
                            <tr key={teacher.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 group transition-colors">
                              <td className="px-4 py-3 border-r border-b border-slate-200 dark:border-slate-800 sticky left-0 z-20 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 transition-colors shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]" title={teacher.name}>
                                  {teacher.name}
                                </div>
                              </td>
                              
                              {weekDays.map(day => {
                                const key = getCellKey(teacher.id, day, shift.id);
                                const pending = pendingChanges[key];
                                const existing = allocationsMap.get(key);

                                const activeAlloc = pending || existing;
                                const matchingSchedules = schedulesMap.get(key) || [];

                                if (selectedProjectId !== 'all' && activeAlloc && activeAlloc.projectId !== selectedProjectId) {
                                  return <td key={day.toISOString()} className="border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10"></td>;
                                }

                                let isUnsynced = false;
                                if (activeAlloc && activeAlloc.status === 'EM AULA') {
                                  isUnsynced = matchingSchedules.length === 0 || !matchingSchedules.some(ms => ms.projectId === activeAlloc.projectId);
                                }

                                return (
                                  <td 
                                    key={day.toISOString()} 
                                    className={`px-2 py-2 border-r border-b border-slate-200 dark:border-slate-800 relative transition-all
                                      ${pending ? 'bg-orange-50/30 dark:bg-orange-900/10' : ''} 
                                      ${isAdmin ? 'cursor-pointer' : 'cursor-default'}
                                      ${dragSource && dragSource.teacherId === teacher.id && dragSource.shift === shift.id && 
                                        weekDays.indexOf(day) >= Math.min(dragSource.dayIndex, dragTargetIndex ?? dragSource.dayIndex) &&
                                        weekDays.indexOf(day) <= Math.max(dragSource.dayIndex, dragTargetIndex ?? dragSource.dayIndex)
                                        ? 'ring-2 ring-blue-500 ring-inset z-10 bg-blue-50/30 dark:bg-blue-900/20' 
                                        : ''}
                                    `}
                                    onClick={() => isAdmin && !dragSource && openCellModal(teacher, day, shift.id)}
                                    onMouseEnter={() => {
                                      if (dragSource && dragSource.teacherId === teacher.id && dragSource.shift === shift.id) {
                                        setDragTargetIndex(weekDays.indexOf(day));
                                      }
                                    }}
                                  >
                                    {activeAlloc && activeAlloc.status !== 'DELETED' ? (
                                        <div className={`flex flex-col p-2 rounded-md border ${getStatusBadgeColor(activeAlloc.status)} shadow-sm relative overflow-hidden transition-transform hover:scale-[1.02] ${pending ? 'border-orange-400 border-dashed ring-1 ring-orange-200' : ''}`}>
                                          <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                              {availableStatuses.find(s => s.id === activeAlloc.status)?.label || activeAlloc.status}
                                            </span>
                                            <span className="text-[10px] font-bold opacity-70 bg-black/5 px-1 rounded">{activeAlloc.hours}h</span>
                                          </div>
                                           <div className="text-xs font-semibold truncate leading-tight" title={activeAlloc.className || (activeAlloc.projectId !== 'none' ? (projects.find(p => p.id === activeAlloc.projectId)?.name || activeAlloc.projectId) : '')}>
                                            {activeAlloc.className} <span className="text-[9px] opacity-70">({activeAlloc.shift.charAt(0).toUpperCase()})</span>
                                          </div>

                                          {/* Sala e Ambiente se houver agendamento na grade */}
                                          {matchingSchedules.length > 0 && matchingSchedules[0].roomName && (
                                            <div className="text-[10px] text-slate-600 dark:text-slate-300 flex items-center gap-1 mt-0.5 truncate" title={`Ambiente: ${matchingSchedules[0].roomName}`}>
                                              <MapPin className="h-2.5 w-2.5 text-blue-600 shrink-0" />
                                              <span className="truncate">{matchingSchedules[0].roomName}</span>
                                            </div>
                                          )}
                                        
                                        {pending && (
                                          <div className="absolute top-0 right-0 bg-orange-400 text-white text-[8px] px-1 rounded-bl leading-tight font-bold">
                                            PENDENTE
                                          </div>
                                        )}

                                        {isUnsynced && !pending && (
                                          <div className="absolute bottom-1 right-1" title="Divergência com schedule (execução) real">
                                            <AlertTriangle className="h-3 w-3 text-red-500" />
                                          </div>
                                        )}
                                        {activeAlloc.observation && (
                                          <div className="absolute top-1 right-1">
                                            {!pending && <div className="w-1.5 h-1.5 rounded-full bg-red-400" title="Possui observação"></div>}
                                          </div>
                                        )}

                                        {/* Botão de Realocação Rápida no hover */}
                                        {isAdmin && (
                                          <button
                                            onClick={(e) => {
                                              handleOpenReallocation({
                                                scheduleId: matchingSchedules[0]?.id,
                                                allocationId: activeAlloc.id,
                                                teacherId: teacher.id,
                                                teacherName: teacher.name,
                                                date: day,
                                                shift: shift.id,
                                                hours: activeAlloc.hours || 4,
                                                className: activeAlloc.className || 'Aula',
                                                roomName: matchingSchedules[0]?.roomName,
                                                projectId: activeAlloc.projectId,
                                                projectName: activeAlloc.projectName
                                              }, e);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-1 right-5 bg-white/95 dark:bg-slate-800/95 hover:bg-blue-50 text-blue-700 p-1 rounded border border-blue-200 shadow-xs z-20"
                                            title="Realocar / Substituir Professor"
                                          >
                                            <ArrowRightLeft className="h-3 w-3" />
                                          </button>
                                        )}

                                        {/* Drag Handle (Excel-like) */}
                                        {isAdmin && (
                                          <div 
                                            className="absolute bottom-0 right-0 w-3 h-3 bg-blue-600 cursor-crosshair z-20 border border-white hover:scale-125 transition-transform"
                                            title="Arraste para preencher a semana"
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              setDragSource({
                                                teacherId: teacher.id,
                                                dayIndex: weekDays.indexOf(day),
                                                shift: shift.id,
                                                data: activeAlloc
                                              });
                                              setDragTargetIndex(weekDays.indexOf(day));
                                            }}
                                          />
                                        )}
                                      </div>
                                    ) : matchingSchedules.length > 0 ? (
                                      /* Live Schedule Block direto do Firestore! */
                                      <div className="flex flex-col p-2 rounded-md border border-emerald-300 border-l-4 border-l-emerald-600 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 shadow-xs relative overflow-hidden transition-transform hover:scale-[1.01]">
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                                            <Sparkles className="h-2.5 w-2.5 text-emerald-600" /> Em Aula
                                          </span>
                                          <span className="text-[10px] font-bold bg-emerald-200/60 dark:bg-emerald-800/50 text-emerald-900 dark:text-emerald-200 px-1 rounded">
                                            {getScheduleHours(matchingSchedules[0])}h
                                          </span>
                                        </div>
                                        
                                        <div className="text-xs font-bold truncate leading-tight" title={matchingSchedules[0].className}>
                                          {matchingSchedules[0].className}
                                        </div>

                                        {matchingSchedules[0].roomName && (
                                          <div className="text-[10px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1 mt-0.5 truncate" title={`Ambiente: ${matchingSchedules[0].roomName}`}>
                                            <MapPin className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                                            <span className="truncate">{matchingSchedules[0].roomName}</span>
                                          </div>
                                        )}

                                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-emerald-200/60 text-[9px] text-emerald-800 dark:text-emerald-300">
                                          <span className="font-semibold uppercase tracking-tighter opacity-80">Grade Oficial</span>
                                          {isAdmin && (
                                            <button
                                              onClick={(e) => {
                                                handleOpenReallocation({
                                                  scheduleId: matchingSchedules[0].id,
                                                  teacherId: teacher.id,
                                                  teacherName: teacher.name,
                                                  date: day,
                                                  shift: shift.id,
                                                  hours: getScheduleHours(matchingSchedules[0]),
                                                  className: matchingSchedules[0].className,
                                                  roomName: matchingSchedules[0].roomName,
                                                  projectId: matchingSchedules[0].projectId,
                                                  projectName: matchingSchedules[0].projectName
                                                }, e);
                                              }}
                                              className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-0.5 bg-white/90 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-blue-200 shadow-xs transition-colors"
                                              title="Realocar / Substituir Professor nesta aula"
                                            >
                                              <ArrowRightLeft className="h-2.5 w-2.5" /> Realocar
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="h-full w-full min-h-[44px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Plus className="h-4 w-4 text-slate-400" />
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                              
                              <td className="px-4 py-3 text-center border-b border-slate-200 dark:border-slate-800">
                                <div className="flex flex-col items-center gap-1.5">
                                  <Badge variant="outline" className={`font-bold border-2 ${getHourBadgeColor(totalTeacherHours)}`}>
                                    {totalTeacherHours}h / 40h
                                  </Badge>
                                  {/* Rateio de Horas por Projeto do Professor */}
                                  {weeklyAnalytics.projectHours[teacher.id] && Object.keys(weeklyAnalytics.projectHours[teacher.id]).length > 0 && (
                                    <div className="flex flex-wrap gap-1 justify-center max-w-[130px]">
                                      {Object.entries(weeklyAnalytics.projectHours[teacher.id]).map(([pName, pHours]) => (
                                        <span 
                                          key={pName} 
                                          className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1 py-0.5 rounded font-medium truncate max-w-[120px]"
                                          title={`${pName}: ${pHours}h`}
                                        >
                                          {pName.slice(0, 8)}: <strong>{pHours}h</strong>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredTeachers.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-slate-500">Nenhum professor encontrado.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </Card>
            ))}

            {/* Visualização de Cards para Professores */}
            {isProfessor && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {weekDays.map(day => (
                  <Card key={day.toISOString()} className="shadow-sm border-slate-200 dark:border-slate-800">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900 py-3 border-b border-slate-200 dark:border-slate-800">
                      <CardTitle className="text-sm font-bold flex items-center justify-between">
                        <span>{format(day, "EEEE, dd/MM", { locale: ptBR })}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {SHIFTS.map(shift => {
                        const shiftsAllocations = allocations.filter(a => 
                          isSameDay(a.date.toDate(), day) && 
                          a.shift === shift.id &&
                          (searchTeacher === "" || a.teacherName.toLowerCase().includes(searchTeacher.toLowerCase())) &&
                          (selectedProjectId === "all" || a.projectId === selectedProjectId)
                        );
                        if (selectedShift !== 'all' && shift.id !== selectedShift) return null;
                        return (
                          <div key={shift.id} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-0.5 bg-blue-500 rounded-full"></div>
                              <span className="text-[10px] font-bold uppercase text-slate-500">{shift.label}</span>
                            </div>
                            <div className="space-y-2">
                              {shiftsAllocations.map(alloc => (
                                <div key={alloc.id} className={`p-3 rounded-md border ${getStatusBadgeColor(alloc.status)}`}>
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-xs">{alloc.teacherName}</span>
                                    <Badge variant="outline" className="text-[10px] h-5">{alloc.hours}h</Badge>
                                  </div>
                                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                    {alloc.className} ({alloc.shift.charAt(0).toUpperCase()})
                                  </div>
                                  <div className="text-[10px] uppercase font-bold mt-1 opacity-70">
                                    {availableStatuses.find(s => s.id === alloc.status)?.label || (alloc.status && alloc.status.length > 20 ? "Sincronizando..." : alloc.status)}
                                  </div>
                                </div>
                              ))}
                              {shiftsAllocations.length === 0 && <div className="text-[10px] text-slate-400 italic">Sem alocações</div>}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Barra de Ações Flutuante para Lote */}
          {isAdmin && Object.keys(pendingChanges).length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6">
                 <div className="flex items-center gap-3 pr-6 border-r border-slate-200 dark:border-slate-700">
                    <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 p-2 rounded-full">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {Object.keys(pendingChanges).length} alterações pendentes
                      </p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        rascunho não salvo
                      </p>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-3">
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleDiscard}
                    disabled={isSaving}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                   >
                     Descartar
                   </Button>
                   <Button 
                    size="sm" 
                    onClick={handleSaveAll}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-full shadow-lg shadow-blue-500/20"
                   >
                     {isSaving ? (
                       <div className="flex items-center gap-2">
                         <Loader className="h-4 w-4 animate-spin" /> Salvando...
                       </div>
                     ) : (
                       "Salvar Tudo"
                     )}
                   </Button>
                 </div>
               </div>
            </div>
          )}
          {/* Modal de Alocação de Célula */}
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Planejamento de Turno</DialogTitle>
                <DialogDescription asChild>
                  <div>
                    {editingCell && (
                      <div className="mt-2 space-y-1 text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded-md border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <p><strong>Prof:</strong> {editingCell.teacher.name}</p>
                        <p><strong>Dia:</strong> {format(editingCell.date, "EEEE, dd 'de' MMMM", { locale: ptBR })} ({SHIFTS.find(s=>s.id === editingCell.shift)?.label})</p>
                        {(!editingCell.teacher.allowedShifts || !editingCell.teacher.allowedShifts.includes(editingCell.shift)) && (
                          <div className="mt-2 bg-amber-50 text-amber-800 border-l-4 border-amber-500 p-2 rounded text-xs flex items-start gap-2">
                             <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                             <p>Este professor não atua estruturalmente neste turno. Justificativa obrigatória (Observação) para abrir exceção.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="status" className="text-right">Status</Label>
                  <Select value={formData.status ?? 'DISPONÍVEL'} onValueChange={(v) => setFormData({...formData, status: v})}>
                    <SelectTrigger id="status" className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStatuses.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="hours" className="text-right">Horas</Label>
                  <div className="col-span-3 flex items-center gap-2">
                    <Input id="hours" name="hours" type="number" step="0.5" max="12" className="w-20" value={formData.hours ?? 4} onChange={(e) => setFormData({...formData, hours: Number(e.target.value)})} />
                    <span className="text-xs text-slate-500">h/turno</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="turma" className="text-right">Turma (CORE)</Label>
                    <div className="col-span-3">
                      <Select 
                        value={formData.classId} 
                        onValueChange={(val) => setFormData({...formData, classId: val})}
                      >
                        <SelectTrigger id="turma">
                          <SelectValue placeholder="Selecione a Turma" />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                          <SelectItem value="none">Nenhuma / Outros</SelectItem>
                          {classes.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} {c.period ? `(${c.period.charAt(0).toUpperCase()})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="project" className="text-right text-[10px] sm:text-sm">Projeto</Label>
                    <div className="col-span-3">
                      <Select 
                        value={formData.projectId} 
                        onValueChange={(val) => setFormData({...formData, projectId: val})}
                      >
                        <SelectTrigger id="project">
                          <SelectValue placeholder="Selecione o Projeto" />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                          <SelectItem value="none">Sem Projeto</SelectItem>
                          {projects.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="class-name" className="text-right">CC / Complemento</Label>
                  <Input 
                    id="class-name" 
                    value={formData.className} 
                    onChange={(e) => setFormData({...formData, className: e.target.value})} 
                    className="col-span-3"
                    placeholder="Opcional..."
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="school-name" className="text-right">Escola</Label>
                  <Input id="school-name" name="school-name" className="col-span-3" placeholder="Ex: SENAI - Cáceres" value={formData.schoolName ?? ''} onChange={(e) => setFormData({...formData, schoolName: e.target.value})} />
                </div>

                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="observation" className="text-right mt-2">Observação</Label>
                  <Textarea id="observation" name="observation" className="col-span-3 h-20 resize-none" placeholder="Detalhes (Opcional)..." value={formData.observation ?? ''} onChange={(e) => setFormData({...formData, observation: e.target.value})} />
                </div>
              </div>
              
              <DialogFooter className="flex justify-between items-center sm:justify-between">
                 {editingCell?.existingAllocation && (
                    <Button variant="destructive" size="sm" onClick={() => {
                      const key = getCellKey(editingCell.teacher.id, editingCell.date, editingCell.shift);
                      
                      // Marcar para remoção no lote
                      setPendingChanges(prev => ({
                        ...prev,
                        [key]: { 
                          id: editingCell.existingAllocation!.id,
                          teacherId: editingCell.teacher.id,
                          date: Timestamp.fromDate(editingCell.date),
                          shift: editingCell.shift,
                          status: 'DELETED', // Special status for deletion in batch
                          isPending: true 
                        }
                      }));
                      
                      toast({ title: "Remoção agendada" });
                      setIsModalOpen(false);
                    }}>Remover</Button>
                 )}
                <Button onClick={saveAllocation} className="ml-auto">Salvar Alocação</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

      {/* Modal de Gerenciamento de Opções (Configurações) */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-slate-500" />
              Configurações de Status de Alocação
            </DialogTitle>
            <DialogDescription>
              Gerencie as opções de status disponíveis para a alocação de professores.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
            {/* Adicionar Nova Opção */}
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Nova Opção</h4>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <Input 
                    id="new-option-label"
                    name="new-option-label"
                    placeholder="Ex: Treinamento" 
                    value={newOptionLabel} 
                    onChange={(e) => setNewOptionLabel(e.target.value)} 
                  />
                </div>
                <div className="w-[180px]">
                  <Select value={newOptionColor} onValueChange={setNewOptionColor}>
                    <SelectTrigger id="new-option-color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_COLORS.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${c.value}`}></div>
                            {c.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddOption} className="shrink-0">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>
            </div>

            {/* Lista de Opções Atuais */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Opções Atuais</h4>
              <div className="grid gap-3">
                {availableStatuses.map(status => (
                  <div key={status.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 group animate-in fade-in slide-in-from-left-2 transition-all">
                    {editingOption?.id === status.id ? (
                      <div className="flex-1 flex gap-2">
                        <Input 
                          id={`edit-label-${status.id}`}
                          name={`edit-label-${status.id}`}
                          value={editingOption.label} 
                          onChange={(e) => setEditingOption({...editingOption, label: e.target.value})}
                          className="flex-1"
                        />
                         <Select value={editingOption.color} onValueChange={(v) => setEditingOption({...editingOption, color: v})}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRESET_COLORS.map(c => (
                              <SelectItem key={c.value} value={c.value}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${c.value}`}></div>
                                  {c.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="text-green-600" onClick={handleUpdateOption}><CheckCircle2 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-red-600" onClick={() => setEditingOption(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <Badge className={`${status.color} border-2`}>{status.label}</Badge>
                          <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{status.id}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" onClick={() => setEditingOption(status)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDeleteOption(status.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gerenciador de Projetos */}
      <Dialog open={isProjectManagerOpen} onOpenChange={setIsProjectManagerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Projetos</DialogTitle>
            <DialogDescription>
              Adicione, edite ou exclua projetos para alocação.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Nome do novo projeto" 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddProject()}
              />
              <Button onClick={handleAddProject} disabled={isSavingProject}>
                {isSavingProject ? <Loader className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4" />}
                Add
              </Button>
            </div>

            <div className="border rounded-md max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projeto</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        {editingProject?.id === project.id ? (
                          <Input 
                            value={editingProject.name}
                            onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && handleUpdateProject()}
                            autoFocus
                          />
                        ) : (
                          project.name
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {editingProject?.id === project.id ? (
                            <Button size="icon" variant="ghost" onClick={handleUpdateProject} disabled={isSavingProject}>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => setEditingProject({ id: project.id, name: project.name })}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteProject(project.id)} disabled={isSavingProject}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsProjectManagerOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal do Motor de Realocação Docente */}
      <TeacherReallocationModal
        isOpen={isReallocationModalOpen}
        onClose={() => setIsReallocationModalOpen(false)}
        targetData={reallocationTarget}
        teachers={teachers}
        weeklyHours={weeklyHoursMap}
        schedulesMap={schedulesMap}
        allocationsMap={allocationsMap}
        onConfirmReallocation={handleConfirmReallocation}
      />
        </div>
      </PageContent>
    </PageLayout>
  );
}

// Re-importing Table components since they might be used in the dialog
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
