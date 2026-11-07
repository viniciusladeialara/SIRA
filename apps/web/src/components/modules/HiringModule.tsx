import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { db, functions } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  FileText, 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Clock,
  ChevronRight,
  Download,
  Loader2,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { PermissionGuard } from '@/components/PermissionGuard';
import { hiringService, HiringProcess, HiringStepStatus } from '@/services/hiringService';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function HiringModule() {
  const { currentUser } = useAuth();
  const { isUserAdmin } = usePermissions();
  const { toast } = useToast();
  
  const [processes, setProcesses] = useState<HiringProcess[]>([]);
  const [classes, setClasses] = useState<{id: string, name: string, courseId: string, courseName: string}[]>([]);
  const [courses, setCourses] = useState<{id: string, name: string, code: string}[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<HiringProcess | null>(null);
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Form criacao
  const [newProcess, setNewProcess] = useState({
    teacher_name: '',
    class_id: '',
    project: 'TÉCNICO'
  });

  // Carregar dados
  useEffect(() => {
    if (!isUserAdmin()) return;

    // Processos
    const unsubscribeProcesses = hiringService.subscribeToProcesses(setProcesses);
    
    // Turmas
    const unsubscribeClasses = onSnapshot(collection(db, 'classes'), (snap) => {
      setClasses(snap.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name,
        courseId: doc.data().courseId,
        courseName: doc.data().courseName || 'Sem Curso'
      })));
    });

    // Cursos
    const unsubscribeCourses = onSnapshot(collection(db, 'courses'), (snap) => {
      setCourses(snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        code: doc.data().code || ''
      })));
    });

    return () => {
      unsubscribeProcesses();
      unsubscribeClasses();
      unsubscribeCourses();
    };
  }, [isUserAdmin]);

  const handleCreate = async () => {
    if (!newProcess.teacher_name || !newProcess.class_id) {
      toast({ title: "Erro", description: "Preencha o nome do professor e a turma.", variant: "destructive" });
      return;
    }

    const turma = classes.find(c => c.id === newProcess.class_id);

    try {
      const initialStep = { status: "NOT_STARTED" as HiringStepStatus, checklist: {} };
      
      // Definir checklists iniciais conforme PRD
      const processData: Omit<HiringProcess, "id" | "created_at" | "updated_at"> = {
        teacher_name: newProcess.teacher_name,
        class_id: newProcess.class_id,
        class_name: turma?.name,
        course_name: turma?.courseName || "Não especificado",
        project: newProcess.project,
        status: "IN_PROGRESS",
        responsible_user: currentUser?.uid || "unknown",
        responsible_name: currentUser?.displayName || currentUser?.email || "Admin",
        steps: {
          documentacao: {
            status: "IN_PROGRESS",
            checklist: { cpf_rg: false, comprovante_endereco: false, dados_bancarios: false, contrato_tipo_pf_pj: false }
          },
          validacao: { status: "NOT_STARTED", checklist: { dados_conferidos: false, aprovacao_coordenador: false } },
          treinamento: { status: "NOT_STARTED", checklist: { msep_apresentada: false, plano_curso: false, plano_aula: false } },
          assinaturas: { status: "NOT_STARTED", checklist: { professor: false, coordenador: false, orientador: false, analista: false } }
        }
      };

      await hiringService.createProcess(processData);
      toast({ title: "Sucesso", description: "Processo de contratação iniciado." });
      setIsCreateOpen(false);
      setNewProcess({ teacher_name: '', class_id: '', project: 'TÉCNICO' });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro", description: "Erro ao iniciar processo.", variant: "destructive" });
    }
  };

  const handleToggleCheck = async (stepKey: keyof HiringProcess["steps"], itemKey: string, value: boolean) => {
    if (!selectedProcess?.id) return;

    const updatedSteps = { ...selectedProcess.steps };
    updatedSteps[stepKey].checklist[itemKey] = value;

    // Recalcular status da etapa
    const allChecked = Object.values(updatedSteps[stepKey].checklist).every(v => v === true);
    const anyChecked = Object.values(updatedSteps[stepKey].checklist).some(v => v === true);
    
    if (allChecked) {
      updatedSteps[stepKey].status = "COMPLETED";
      // Liberar proxima etapa se necessário
      const keys: (keyof HiringProcess["steps"])[] = ["documentacao", "validacao", "treinamento", "assinaturas"];
      const currentIndex = keys.indexOf(stepKey);
      if (currentIndex < keys.length - 1) {
        const nextKey = keys[currentIndex + 1];
        if (updatedSteps[nextKey].status === "NOT_STARTED") {
          updatedSteps[nextKey].status = "IN_PROGRESS";
        }
      }
    } else if (anyChecked) {
      updatedSteps[stepKey].status = "IN_PROGRESS";
    } else {
      updatedSteps[stepKey].status = "NOT_STARTED";
    }

    // Se todas as etapas estiverem completas, o processo todo está completo
    const allStepsDone = Object.values(updatedSteps).every(s => s.status === "COMPLETED");
    const newStatus = allStepsDone ? "COMPLETED" : "IN_PROGRESS";

    try {
      await hiringService.updateProcess(selectedProcess.id, { 
        steps: updatedSteps,
        status: newStatus as any
      });
      setSelectedProcess({ ...selectedProcess, steps: updatedSteps, status: newStatus as any });
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao atualizar checklist.", variant: "destructive" });
    }
  };

  const handleGeneratePdf = async () => {
    if (!selectedProcess?.id) return;
    
    // Regra: Só gera PDF se tudo estiver completo
    const allDone = Object.values(selectedProcess.steps).every(s => s.status === "COMPLETED");
    if (!allDone) {
      toast({ 
        title: "Atenção", 
        description: "O PDF só pode ser gerado após a conclusão de todas as etapas do checklist.",
        variant: "destructive" 
      });
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const generateHiringPDF = httpsCallable(functions, 'generateHiringPDF');
      const result = await generateHiringPDF({ hiringId: selectedProcess.id });
      const { pdfUrl } = result.data as { pdfUrl: string };
      
      window.open(pdfUrl, '_blank');
      toast({ title: "Sucesso", description: "PDF gerado com sucesso!" });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Erro", description: error.message || "Erro ao gerar PDF.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const calculateProgress = (process: HiringProcess) => {
    const steps = Object.values(process.steps);
    const completed = steps.filter(s => s.status === "COMPLETED").length;
    return (completed / steps.length) * 100;
  };

  const filteredProcesses = processes.filter(p => {
    const matchesSearch = p.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.class_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStepIcon = (status: HiringStepStatus) => {
    switch (status) {
      case "COMPLETED": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "IN_PROGRESS": return <Clock className="h-5 w-5 text-blue-500" />;
      case "BLOCKED": return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Circle className="h-5 w-5 text-slate-300" />;
    }
  };

  return (
    <PermissionGuard module="hiring" action="view">
      <PageLayout>
        <PageHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">Contratação de Professores</h2>
              <p className="text-muted-foreground">Controle, rastreabilidade e formalização digital de contratações</p>
            </div>
            
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" /> Novo Processo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Iniciar Novo Processo</DialogTitle>
                  <DialogDescription>Selecione o professor e a turma para começar o checklist de contratação.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome do Professor(a)</label>
                    <Input 
                      placeholder="Identificação do Candidato" 
                      value={newProcess.teacher_name} 
                      onChange={(e) => setNewProcess({...newProcess, teacher_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Turma</label>
                    <Select 
                      value={newProcess.class_id} 
                      onValueChange={(v) => {
                        const turma = classes.find(c => c.id === v);
                        const course = courses.find(c => c.id === turma?.courseId);
                        setNewProcess({
                          ...newProcess, 
                          class_id: v,
                          project: course?.code || newProcess.project
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.courseName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Projeto</label>
                    <Select value={newProcess.project} onValueChange={(v) => setNewProcess({...newProcess, project: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o projeto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TÉCNICO">TÉCNICO</SelectItem>
                        <SelectItem value="APRENDIZAGEM">APRENDIZAGEM</SelectItem>
                        <SelectItem value="QUALIFICAÇÃO">QUALIFICAÇÃO</SelectItem>
                        <SelectItem value="OUTROS">OUTROS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreate} className="bg-blue-600">Iniciar Processo</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por professor ou turma..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
                  <SelectItem value="COMPLETED">Concluído</SelectItem>
                  <SelectItem value="BLOCKED">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </PageHeader>

        <PageContent>
          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Processos de Contratação</CardTitle>
                <Badge variant="outline">{filteredProcesses.length} registros</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Professor / Turma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProcesses.map(p => (
                    <TableRow key={p.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => { setSelectedProcess(p); setIsDetailOpen(true); }}>
                      <TableCell>
                        <div className="font-medium underline decoration-blue-200 underline-offset-4">{p.teacher_name}</div>
                        <div className="text-xs text-muted-foreground">{p.class_name} • {p.course_name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={p.status === 'COMPLETED' ? 'outline' : p.status === 'BLOCKED' ? 'destructive' : 'secondary'}
                          className={p.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : p.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                        >
                          {p.status === 'IN_PROGRESS' ? 'Em Andamento' : 
                           p.status === 'COMPLETED' ? 'Concluído' :
                           p.status === 'BLOCKED' ? 'Bloqueado' : 'Não Iniciado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[150px]">
                        <div className="flex items-center gap-2">
                          <Progress value={calculateProgress(p)} className="h-1.5" />
                          <span className="text-[10px] font-bold text-slate-500">{Math.round(calculateProgress(p))}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{p.responsible_name}</TableCell>
                      <TableCell className="text-xs">
                        {p.created_at ? format(p.created_at.toDate(), 'dd/MM/yy', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredProcesses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        Nenhum processo de contratação encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </PageContent>

        {/* Detalhes do Processo */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex justify-between items-start">
                <div>
                  <DialogTitle className="text-xl">{selectedProcess?.teacher_name}</DialogTitle>
                  <DialogDescription>
                    {selectedProcess?.class_name} • {selectedProcess?.course_name}
                  </DialogDescription>
                </div>
                <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{selectedProcess?.project}</Badge>
              </div>
            </DialogHeader>

            {selectedProcess && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Etapa 1: Documentação */}
                  <Card className={selectedProcess.steps.documentacao.status === 'NOT_STARTED' ? 'opacity-50' : ''}>
                    <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        {getStepIcon(selectedProcess.steps.documentacao.status)}
                        <CardTitle className="text-sm font-bold">1. Documentação</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Object.keys(selectedProcess.steps.documentacao.checklist).map(key => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`doc-${key}`} 
                            checked={selectedProcess.steps.documentacao.checklist[key]}
                            onCheckedChange={(checked) => handleToggleCheck('documentacao', key, !!checked)}
                          />
                          <label htmlFor={`doc-${key}`} className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer">
                            {key.replace(/_/g, ' ')}
                          </label>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Etapa 2: Validação */}
                  <Card className={selectedProcess.steps.validacao.status === 'NOT_STARTED' ? 'opacity-50' : ''}>
                    <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        {getStepIcon(selectedProcess.steps.validacao.status)}
                        <CardTitle className="text-sm font-bold">2. Validação</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Object.keys(selectedProcess.steps.validacao.checklist).map(key => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`val-${key}`} 
                            checked={selectedProcess.steps.validacao.checklist[key]}
                            onCheckedChange={(checked) => handleToggleCheck('validacao', key, !!checked)}
                            disabled={selectedProcess.steps.validacao.status === 'NOT_STARTED'}
                          />
                          <label htmlFor={`val-${key}`} className="text-xs font-medium leading-none capitalize cursor-pointer">
                            {key.replace(/_/g, ' ')}
                          </label>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Etapa 3: Treinamento */}
                  <Card className={selectedProcess.steps.treinamento.status === 'NOT_STARTED' ? 'opacity-50' : ''}>
                    <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        {getStepIcon(selectedProcess.steps.treinamento.status)}
                        <CardTitle className="text-sm font-bold">3. Treinamento</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Object.keys(selectedProcess.steps.treinamento.checklist).map(key => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`tr-${key}`} 
                            checked={selectedProcess.steps.treinamento.checklist[key]}
                            onCheckedChange={(checked) => handleToggleCheck('treinamento', key, !!checked)}
                            disabled={selectedProcess.steps.treinamento.status === 'NOT_STARTED'}
                          />
                          <label htmlFor={`tr-${key}`} className="text-xs font-medium leading-none capitalize cursor-pointer">
                            {key.replace(/_/g, ' ')}
                          </label>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Etapa 4: Assinaturas */}
                  <Card className={selectedProcess.steps.assinaturas.status === 'NOT_STARTED' ? 'opacity-50' : ''}>
                    <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        {getStepIcon(selectedProcess.steps.assinaturas.status)}
                        <CardTitle className="text-sm font-bold">4. Assinaturas</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Object.keys(selectedProcess.steps.assinaturas.checklist).map(key => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`sig-${key}`} 
                            checked={selectedProcess.steps.assinaturas.checklist[key]}
                            onCheckedChange={(checked) => handleToggleCheck('assinaturas', key, !!checked)}
                            disabled={selectedProcess.steps.assinaturas.status === 'NOT_STARTED'}
                          />
                          <label htmlFor={`sig-${key}`} className="text-xs font-medium leading-none capitalize cursor-pointer">
                            Assinatura {key}
                          </label>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                  <Button 
                    variant="default" 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleGeneratePdf}
                    disabled={isGeneratingPdf || selectedProcess.status !== 'COMPLETED'}
                  >
                    {isGeneratingPdf ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Gerar PDF Formal
                  </Button>
                  
                  {selectedProcess.pdf_url && (
                    <Button variant="outline" className="flex-1" onClick={() => window.open(selectedProcess.pdf_url, '_blank')}>
                      <Download className="h-4 w-4 mr-2" /> Baixar Checklist
                    </Button>
                  )}
                  
                  <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={async () => {
                    if (window.confirm("Tem certeza que deseja excluir este processo?")) {
                      await hiringService.deleteProcess(selectedProcess.id!);
                      setIsDetailOpen(false);
                      toast({ title: "Excluído", description: "Processo excluído com sucesso." });
                    }
                  }}>
                    Excluir
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageLayout>
    </PermissionGuard>
  );
}
