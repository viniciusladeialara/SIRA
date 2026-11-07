import { useState, useEffect, useMemo } from "react";
import { clsx } from "clsx";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  query,
  getDocs,
  where,
  writeBatch
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { logAction, AuditAction } from "@/lib/AuditLog";
import { getUnitName } from "@/lib/utils";

// Componentes de UI
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Users, Plus, Edit, Trash2, Calendar, BookOpen, GraduationCap,  CheckCircle,
  XCircle,
  Zap,
  Loader2,
  ChevronsUpDown,
  Check,
  Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestoreCache } from "@/hooks/useCache";
import { usePermissions } from "@/hooks/usePermissions";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { DynamicCreatableSelect } from "@/components/modules/DynamicCreatableSelect";


// --- INTERFACES ATUALIZADAS ---
interface Class {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  teacherIds: string[];
  teacherNames: string[];
  environmentIds?: string[]; // Novos campos (PDR 1)
  dailyWorkload?: number;
  executionModel?: '3h' | '4h' | '5h';
  period: string;
  studentCount: number;
  daysOfWeek?: string[]; // Novos campos (PDR 2 - EXEMPO)
}

// NOVO: Adicionado isActive à interface de Professor
interface Professor {
  id: string;
  name: string;
  isActive: boolean; 
}

interface Course {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
}

const defaultPeriods = ["Matutino", "Vespertino", "Noturno"];
const DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

const getShiftAbbreviation = (period?: string) => {
  if (!period) return "";
  const p = period.toLowerCase();
  if (p.includes("matutino")) return "M";
  if (p.includes("vespertino")) return "V";
  if (p.includes("noturno")) return "N";
  return period.charAt(0).toUpperCase();
};

export function ClassModule() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]); // AQUI: A lista de professores será filtrada
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return classes;
    const queryLower = searchQuery.toLowerCase().trim();
    return classes.filter(classData => 
      (classData.name || "").toLowerCase().includes(queryLower) ||
      (classData.courseName || "").toLowerCase().includes(queryLower)
    );
  }, [classes, searchQuery]);
  const [newClass, setNewClass] = useState({ 
    courseId: '', 
    name: '', 
    teacherIds: [] as string[], 
    teacherNames: [] as string[], 
    environmentIds: [] as string[],
    dailyWorkload: 4,
    executionModel: '4h' as '3h' | '4h' | '5h',
    period: defaultPeriods[0], 
    studentCount: 0,
    daysOfWeek: [] as string[]
  });
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [isProfessorsPopoverOpen, setIsProfessorsPopoverOpen] = useState(false);
  const [isEnvironmentsPopoverOpen, setIsEnvironmentsPopoverOpen] = useState(false);
  const [isEditingProfessorsPopoverOpen, setIsEditingProfessorsPopoverOpen] = useState(false);
  const [isEditingEnvironmentsPopoverOpen, setIsEditingEnvironmentsPopoverOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Pending Changes State (FinOps Optimization)
  const [pendingChanges, setPendingChanges] = useState<Record<string, { data: Partial<Class>, type: 'update' | 'delete' }>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { cacheQuery } = useFirestoreCache();
  const { userData } = usePermissions();
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

  const periods = unitMetadata?.shifts || defaultPeriods;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Carrega Turmas filtradas por unitId
        const classesData = await cacheQuery(`classes_${selectedUnitId}`, async () => {
          const q = query(collection(db, "classes"), where("unitId", "==", selectedUnitId));
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Class));
        });
        setClasses(classesData);

        // Carrega Cursos (globais)
        const coursesData = await cacheQuery("courses", async () => {
          const snapshot = await getDocs(collection(db, "courses"));
          return snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
          } as Course));
        });
        setCourses(coursesData);

        // Carrega Professores Ativos filtrados por unitId
        const professorsData = await cacheQuery(`active_teachers_${selectedUnitId}`, async () => {
          const q = query(collection(db, "teachers"), where("isActive", "==", true), where("unitId", "==", selectedUnitId));
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            isActive: doc.data().isActive
          } as Professor));
        });
        setProfessors(professorsData);

        // Carrega Ambientes (Salas) filtrados por unitId
        const roomsData = await cacheQuery(`rooms_${selectedUnitId}`, async () => {
          const q = query(collection(db, "rooms"), where("unitId", "==", selectedUnitId));
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
          } as Room));
        });
        setRooms(roomsData);

        // Carrega Agendamentos para cálculo de execução (PDR 2) filtrados por unitId
        const schedulesData = await cacheQuery(`all_schedules_${selectedUnitId}`, async () => {
          const q = query(collection(db, "schedules"), where("unitId", "==", selectedUnitId));
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            classId: doc.data().classId
          }));
        });
        setSchedules(schedulesData);
      } catch (error) {
        console.error("Erro ao carregar dados da turma:", error);
        toast({ title: "Erro", description: "Erro ao carregar dados.", variant: "destructive" });
      }
    };

    fetchData();
  }, [toast, cacheQuery, selectedUnitId]);


  const handleAddClass = async () => {
    if (isAdding) return;
    if (!newClass.name || !newClass.courseId || newClass.teacherIds.length === 0) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios: Código da turma, Curso e Professor(es).", variant: "destructive" });
      return;
    }
    setIsAdding(true);
    try {
      const courseName = courses.find(c => c.id === newClass.courseId)?.name || 'Nome do Curso Desconhecido';
      await addDoc(collection(db, "classes"), {
        ...newClass,
        courseName: courseName,
        unitId: selectedUnitId,
        unitName: getUnitName(selectedUnitId),
        createdAt: Timestamp.now(),
      });
      setNewClass({ 
        courseId: '', 
        name: '', 
        teacherIds: [], 
        teacherNames: [], 
        environmentIds: [],
        dailyWorkload: 4,
        executionModel: '4h',
        period: periods[0], 
        studentCount: 0,
        daysOfWeek: [] 
      });
      setIsProfessorsPopoverOpen(false);
      toast({ title: "Sucesso", description: "Turma adicionada com sucesso." });

      if (currentUser) {
        await logAction(
          AuditAction.CREATE_CLASS,
          currentUser as any,
          `Criada nova turma: ${newClass.name} (${courseName})`,
          { class: newClass, courseName }
        );
      }
    } catch (error) {
      console.error("Erro ao adicionar turma: ", error);
      toast({ title: "Erro", description: "Não foi possível adicionar a turma.", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  // Função para disparar a geração automática (PDR 2)
  const handleGenerateSchedule = async (classId: string, className: string) => {
    if (isGenerating) return;
    
    if (!window.confirm(`Deseja gerar automaticamente a agenda para a turma "${className}"? Isso criará agendamentos baseados nas UCs e alocações atuais.`)) {
      return;
    }

    setIsGenerating(classId);
    try {
      const runGenerator = httpsCallable(functions, 'runScheduleGenerator');
      const result = await runGenerator({ turmaId: classId, mode: 'preserve' });
      
      const data = result.data as any;
      toast({
        title: "Motor Iniciado",
        description: data.message || "A geração está ocorrendo em background.",
      });

      if (currentUser) {
        await logAction(
          AuditAction.BULK_CREATE_SCHEDULES, // Reaproveitando para geração automática
          currentUser as any,
          `Iniciada geração automática de agenda para a turma ${className}`,
          { classId, className }
        );
      }
    } catch (error: any) {
      console.error("Erro ao disparar gerador:", error);
      toast({
        title: "Erro na Geração",
        description: error.message || "Não foi possível iniciar o motor de geração.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(null);
    }
  };

  // Deleta a turma (Refatorada para Frontend-First)
  const handleDeleteClass = (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta turma?")) return;
    
    const classData = classes.find(c => c.id === id);
    if (!classData) return;

    setPendingChanges(prev => ({
      ...prev,
      [id]: { data: classData, type: 'delete' }
    }));
    toast({ title: "Exclusão preparada!", description: "Salve para efetivar no banco de dados." });
  };

  const handleSaveAllChanges = async () => {
    if (isSavingAll || Object.keys(pendingChanges).length === 0) return;
    setIsSavingAll(true);
    const batch = writeBatch(db);

    try {
      Object.entries(pendingChanges).forEach(([id, change]) => {
        const docRef = doc(db, "classes", id);
        if (change.type === 'delete') {
          batch.delete(docRef);
        } else {
          const { id: _, ...payload } = change.data;
          batch.update(docRef, payload);
        }
      });
      await batch.commit();

      // Sincronizar estado local
      setClasses(prev => {
        let updated = [...prev];
        Object.entries(pendingChanges).forEach(([id, change]) => {
            if (change.type === 'delete') {
                updated = updated.filter(c => c.id !== id);
            } else {
                updated = updated.map(c => c.id === id ? { ...c, ...change.data } as Class : c);
            }
        });
        return updated;
      });

      setPendingChanges({});
      toast({ title: "Sucesso!", description: "Sincronização com o banco de dados concluída." });

      if (currentUser) {
        const count = Object.keys(pendingChanges).length;
        await logAction(
          AuditAction.DATA_IMPORT, // Usando DATA_IMPORT para alterações em lote
          currentUser as any,
          `Realizada atualização/exclusão em lote de ${count} turmas`,
          { count, changes: pendingChanges }
        );
      }
    } catch (error) {
      console.error("Erro ao salvar lote de turmas: ", error);
      toast({ title: "Erro", description: "Não foi possível salvar as alterações.", variant: "destructive" });
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleDiscardChanges = () => {
    if (Object.keys(pendingChanges).length === 0) return;
    if (window.confirm("Deseja descartar as alterações pendentes?")) {
      setPendingChanges({});
    }
  };

  const handleEditClass = (classData: Class) => {
    setEditingClass({
      ...classData,
      daysOfWeek: classData.daysOfWeek || []
    });
  };

  const handleUpdateClass = () => {
    if (!editingClass) return;
    if (!editingClass.name || !editingClass.courseId || editingClass.teacherIds.length === 0) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    setPendingChanges(prev => ({
      ...prev,
      [editingClass.id]: { 
        data: {
          ...editingClass,
          courseName: courses.find(c => c.id === editingClass.courseId)?.name,
          updatedAt: Timestamp.now()
        }, 
        type: 'update' 
      }
    }));
    
    setEditingClass(null);
    toast({ title: "Alteração preparada!" });
  };

  const handleToggleDay = (day: string) => {
    const currentDays = newClass.daysOfWeek || [];
    if (currentDays.includes(day)) {
      setNewClass({ ...newClass, daysOfWeek: currentDays.filter(d => d !== day) });
    } else {
      setNewClass({ ...newClass, daysOfWeek: [...currentDays, day] });
    }
  };

  const handleEditToggleDay = (day: string) => {
    if (!editingClass) return;
    const currentDays = editingClass.daysOfWeek || [];
    if (currentDays.includes(day)) {
      setEditingClass({ ...editingClass, daysOfWeek: currentDays.filter(d => d !== day) });
    } else {
      setEditingClass({ ...editingClass, daysOfWeek: [...currentDays, day] });
    }
  };

  const handleSelectProfessor = (professor: Professor) => {
    const isSelected = newClass.teacherIds.includes(professor.id);
    if (isSelected) {
      // Remove o professor se já estiver selecionado
      setNewClass({
        ...newClass,
        teacherIds: newClass.teacherIds.filter(id => id !== professor.id),
        teacherNames: newClass.teacherNames.filter(name => name !== professor.name),
      });
    } else {
      // Adiciona o professor
      setNewClass({
        ...newClass,
        teacherIds: [...newClass.teacherIds, professor.id],
        teacherNames: [...newClass.teacherNames, professor.name],
      });
    }
  };

  const handleEditSelectProfessor = (professor: Professor) => {
    if (!editingClass) return;
    const isSelected = editingClass.teacherIds.includes(professor.id);
    if (isSelected) {
      setEditingClass({
        ...editingClass,
        teacherIds: editingClass.teacherIds.filter(id => id !== professor.id),
        teacherNames: editingClass.teacherNames.filter(name => name !== professor.name),
      });
    } else {
      setEditingClass({
        ...editingClass,
        teacherIds: [...editingClass.teacherIds, professor.id],
        teacherNames: [...editingClass.teacherNames, professor.name],
      });
    }
  };

  const handleSelectEnvironment = (roomId: string) => {
    const isSelected = newClass.environmentIds.includes(roomId);
    if (isSelected) {
      setNewClass({
        ...newClass,
        environmentIds: newClass.environmentIds.filter(id => id !== roomId),
      });
    } else {
      setNewClass({
        ...newClass,
        environmentIds: [...newClass.environmentIds, roomId],
      });
    }
  };

  const handleEditSelectEnvironment = (roomId: string) => {
    if (!editingClass) return;
    const currentEnvIds = editingClass.environmentIds || [];
    const isSelected = currentEnvIds.includes(roomId);
    if (isSelected) {
      setEditingClass({
        ...editingClass,
        environmentIds: currentEnvIds.filter(id => id !== roomId),
      });
    } else {
      setEditingClass({
        ...editingClass,
        environmentIds: [...currentEnvIds, roomId],
      });
    }
  };

  return (
    <PageLayout>
      <PageHeader className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Turmas</h2>
          <p className="text-muted-foreground">Gerencie as turmas, seus cursos e professores.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Turma
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Turma</DialogTitle>
              <DialogDescription>
                Preencha as informações para a nova turma.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="class-name">Código da Turma</Label>
                <Input id="class-name" placeholder="Ex: QUA.162.001" value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-course">Curso</Label>
                <select id="class-course" className="w-full p-2 border rounded-md" value={newClass.courseId} onChange={(e) => setNewClass({ ...newClass, courseId: e.target.value })}>
                  <option value="">Selecione um curso</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Professores</Label>
                <Popover open={isProfessorsPopoverOpen} onOpenChange={setIsProfessorsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isProfessorsPopoverOpen}
                      className="w-full justify-between overflow-hidden"
                    >
                      <span className="truncate">
                        {newClass.teacherNames.length > 0
                          ? newClass.teacherNames.join(", ")
                          : "Selecionar professor(es)..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar professor..." />
                      <CommandList>
                        <CommandEmpty>Nenhum professor encontrado.</CommandEmpty>
                        <CommandGroup>
                          {professors.map((professor) => (
                            <CommandItem
                              key={professor.id}
                              value={professor.name}
                              onSelect={() => handleSelectProfessor(professor)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${newClass.teacherIds.includes(professor.id) ? "opacity-100" : "opacity-0"}`}
                              />
                              {professor.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-students">Nº Alunos</Label>
                <Input id="class-students" type="number" value={newClass.studentCount} onChange={(e) => setNewClass({ ...newClass, studentCount: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-workload">Carga Horária Diária (h)</Label>
                <Input id="class-workload" type="number" value={newClass.dailyWorkload} onChange={(e) => setNewClass({ ...newClass, dailyWorkload: parseInt(e.target.value) || 4 })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-execution">Modelo de Execução</Label>
                <select id="class-execution" className="w-full p-2 border rounded-md" value={newClass.executionModel} onChange={(e) => setNewClass({ ...newClass, executionModel: e.target.value as any })}>
                  <option value="3h">3h</option>
                  <option value="4h">4h</option>
                  <option value="5h">5h</option>
                </select>
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <Label htmlFor="class-period">Turno</Label>
                <DynamicCreatableSelect
                  value={newClass.period}
                  onValueChange={(val) => setNewClass({ ...newClass, period: val })}
                  options={periods}
                  placeholder="Selecione o turno"
                  unitId={selectedUnitId}
                  metadataKey="shifts"
                  label="Turno"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Dias da Semana (Padrão)</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {DAYS.map(day => (
                    <label key={day} className={clsx(
                      "flex items-center gap-2 p-2 px-3 border rounded-xl cursor-pointer transition-all",
                      newClass.daysOfWeek?.includes(day) 
                        ? "bg-primary/10 border-primary text-primary" 
                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300"
                    )}>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={newClass.daysOfWeek?.includes(day)}
                        onChange={() => handleToggleDay(day)}
                      />
                      <span className="text-xs font-bold">{day}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Ambientes Padrão</Label>
                <Popover open={isEnvironmentsPopoverOpen} onOpenChange={setIsEnvironmentsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between overflow-hidden"
                    >
                      <span className="truncate">
                        {newClass.environmentIds.length > 0
                          ? rooms.filter(r => newClass.environmentIds.includes(r.id)).map(r => r.name).join(", ")
                          : "Selecionar ambiente(s)..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar ambiente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum ambiente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {rooms.map((room) => (
                            <CommandItem
                              key={room.id}
                              value={room.name}
                              onSelect={() => handleSelectEnvironment(room.id)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${newClass.environmentIds.includes(room.id) ? "opacity-100" : "opacity-0"}`}
                              />
                              {room.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddClass} disabled={isAdding}>
                {isAdding ? "Adicionando..." : "Adicionar Turma"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <PageContent>
      <Card>
        <CardHeader>
          <CardTitle>Turmas Cadastradas</CardTitle>
          <CardDescription>
            Exibe todas as turmas, seus cursos, professores e outras informações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-6 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Buscar por turma (código/nome) ou curso..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 h-10 w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus-visible:ring-1 focus-visible:ring-indigo-500"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código da Turma</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Professor(es)</TableHead>
                <TableHead>Carga/Modelo</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Ambientes</TableHead>
                <TableHead>Nº Alunos</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClasses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    Nenhuma turma encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filteredClasses.map(classData => {
                const pending = pendingChanges[classData.id];
                const isDeleted = pending?.type === 'delete';
                const displayData = pending ? { ...classData, ...pending.data } : classData;
                
                // Cálculo de progresso (Health Bar)
                const scheduledCount = schedules.filter(s => s.classId === classData.id).length;
                const totalRequiredSlots = 40; // Fallback: 4h/dia * 40 slots = 160h. PDR 2 sugere resolver via Course.
                const completionRate = Math.min(Math.round((scheduledCount / totalRequiredSlots) * 100), 100);

                return (
                  <TableRow 
                    key={classData.id}
                    className={`transition-colors ${
                      isDeleted ? "bg-red-50/50 opacity-60 grayscale-[0.5]" : 
                      pending ? "bg-orange-50/50" : ""
                    }`}
                  >
                    <TableCell className="font-medium">
                      <div className={isDeleted ? "line-through text-slate-400" : ""}>
                         {displayData.name} <span className="text-slate-400 text-xs font-bold">({getShiftAbbreviation(displayData.period)})</span>
                        {pending && !isDeleted && (
                          <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-orange-100 text-orange-700 border-orange-200 uppercase font-bold tracking-tighter">Editado</Badge>
                        )}
                        {isDeleted && (
                          <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-red-100 text-red-700 border-red-200 uppercase font-bold tracking-tighter">Removido</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{displayData.courseName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {displayData.teacherNames.map((name, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] w-fit">{name}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs">{displayData.dailyWorkload}h/dia</span>
                        <Badge variant="outline" className="text-[9px] w-fit bg-slate-50">{displayData.executionModel || '4h'}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[100px]">
                        {displayData.daysOfWeek && displayData.daysOfWeek.length > 0 ? (
                          displayData.daysOfWeek.map(day => (
                            <Badge key={day} variant="secondary" className="text-[9px] bg-orange-100 text-orange-700 border-orange-200">
                              {day}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">---</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[150px] truncate text-xs text-slate-500">
                        {displayData.environmentIds && displayData.environmentIds.length > 0
                          ? rooms.filter(r => displayData.environmentIds?.includes(r.id)).map(r => r.name).join(", ")
                          : "---"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1 min-w-[80px]">
                        <div className="text-xs font-bold text-slate-600">{completionRate}%</div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              completionRate > 90 ? 'bg-emerald-500' : 
                              completionRate > 50 ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">Execução</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleGenerateSchedule(classData.id, displayData.name)} 
                          disabled={isDeleted || isSavingAll || !!isGenerating}
                          className="text-amber-600 hover:bg-amber-50"
                          title="Gerar Agenda Automática (Inteligência)"
                        >
                          {isGenerating === classData.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEditClass(displayData as Class)} 
                          disabled={isDeleted || isSavingAll || !!isGenerating}
                          className="text-blue-600 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteClass(classData.id)} 
                          disabled={isDeleted || isSavingAll || !!isGenerating}
                          className="text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editingClass && (
        <Dialog open={!!editingClass} onOpenChange={() => setEditingClass(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Turma</DialogTitle>
              <DialogDescription>
                Atualize as informações da turma.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-class-name">Código da Turma</Label>
                <Input id="edit-class-name" placeholder="Ex: QUA.162.001" value={editingClass.name} onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-class-course">Curso</Label>
                <select id="edit-class-course" className="w-full p-2 border rounded-md" value={editingClass.courseId} onChange={(e) => setEditingClass({ ...editingClass, courseId: e.target.value })}>
                  <option value="">Selecione um curso</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Professor(es)</Label>
                <Popover open={isEditingProfessorsPopoverOpen} onOpenChange={setIsEditingProfessorsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isEditingProfessorsPopoverOpen}
                      className="w-full justify-between overflow-hidden"
                    >
                      <span className="truncate">
                        {editingClass.teacherNames.length > 0
                          ? editingClass.teacherNames.join(", ")
                          : "Selecionar professor(es)..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar professor..." />
                      <CommandList>
                        <CommandEmpty>Nenhum professor encontrado.</CommandEmpty>
                        <CommandGroup>
                          {/* AQUI: Renderiza apenas os professores ATIVOS */}
                          {professors.map((professor) => (
                            <CommandItem
                              key={professor.id}
                              value={professor.name}
                              onSelect={() => handleEditSelectProfessor(professor)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${editingClass.teacherIds.includes(professor.id) ? "opacity-100" : "opacity-0"}`}
                              />
                              {professor.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-class-students">Nº Alunos</Label>
                <Input id="edit-class-students" type="number" value={editingClass.studentCount} onChange={(e) => setEditingClass({ ...editingClass, studentCount: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-class-workload">Carga Horária Diária (h)</Label>
                <Input id="edit-class-workload" type="number" value={editingClass.dailyWorkload} onChange={(e) => setEditingClass({ ...editingClass, dailyWorkload: parseInt(e.target.value) || 4 })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-class-execution">Modelo de Execução</Label>
                <select id="edit-class-execution" className="w-full p-2 border rounded-md" value={editingClass.executionModel} onChange={(e) => setEditingClass({ ...editingClass, executionModel: e.target.value as any })}>
                  <option value="3h">3h</option>
                  <option value="4h">4h</option>
                  <option value="5h">5h</option>
                </select>
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <Label htmlFor="edit-class-period">Turno</Label>
                <DynamicCreatableSelect
                  value={editingClass.period}
                  onValueChange={(val) => setEditingClass({ ...editingClass, period: val })}
                  options={periods}
                  placeholder="Selecione o turno"
                  unitId={selectedUnitId}
                  metadataKey="shifts"
                  label="Turno"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Dias da Semana (Padrão)</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {DAYS.map(day => (
                    <label key={day} className={clsx(
                      "flex items-center gap-2 p-2 px-3 border rounded-xl cursor-pointer transition-all",
                      editingClass.daysOfWeek?.includes(day) 
                        ? "bg-primary/10 border-primary text-primary" 
                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300"
                    )}>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={editingClass.daysOfWeek?.includes(day)}
                        onChange={() => handleEditToggleDay(day)}
                      />
                      <span className="text-xs font-bold">{day}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Ambientes Padrão</Label>
                <Popover open={isEditingEnvironmentsPopoverOpen} onOpenChange={setIsEditingEnvironmentsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between overflow-hidden"
                    >
                      <span className="truncate">
                        {editingClass.environmentIds && editingClass.environmentIds.length > 0
                          ? rooms.filter(r => editingClass.environmentIds?.includes(r.id)).map(r => r.name).join(", ")
                          : "Selecionar ambiente(s)..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar ambiente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum ambiente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {rooms.map((room) => (
                            <CommandItem
                              key={room.id}
                              value={room.name}
                              onSelect={() => handleEditSelectEnvironment(room.id)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${editingClass.environmentIds?.includes(room.id) ? "opacity-100" : "opacity-0"}`}
                              />
                              {room.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingClass(null)} disabled={isUpdating}>Cancelar</Button>
              <Button onClick={handleUpdateClass} disabled={isUpdating}>
                {isUpdating ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </PageContent>

      {/* Barra de Ações Flutuante (Optimized UX) */}
      {Object.keys(pendingChanges).length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out">
          <div className="bg-white/95 backdrop-blur-md border border-indigo-100 shadow-[0_20px_50px_rgba(79,70,229,0.15)] rounded-full px-6 py-4 flex items-center gap-8 ring-1 ring-black/5">
            <div className="flex items-center gap-4 pr-8 border-r border-indigo-50">
              <div className="bg-orange-500 text-white p-2.5 rounded-full shadow-lg shadow-orange-200">
                <Plus className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-extrabold text-slate-800 leading-none mb-1">
                  {Object.keys(pendingChanges).length} {Object.keys(pendingChanges).length === 1 ? 'alteração pendente' : 'alterações pendentes'}
                </p>
                <p className="text-[10px] text-orange-600 uppercase tracking-widest font-bold text-center">
                  turmas rascunhadas
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDiscardChanges}
                disabled={isSavingAll}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors uppercase text-xs font-bold tracking-tight"
              >
                Descartar
              </Button>
              <Button 
                size="sm" 
                onClick={handleSaveAllChanges}
                disabled={isSavingAll}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 rounded-full shadow-[0_10px_20px_rgba(79,70,229,0.3)] hover:shadow-[0_15px_30px_rgba(79,70,229,0.4)] transition-all font-bold group"
              >
                {isSavingAll ? (
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 animate-spin text-white" /> Salvando...
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    Salvar no Banco
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}