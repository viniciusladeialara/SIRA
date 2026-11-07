/**
 * @file CourseModule.tsx
 * @description Componente para a gestão de cursos da instituição.
 */

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
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
import { useAuth } from "@/lib/AuthContext";
import { logAction, AuditAction } from "@/lib/AuditLog";

// Biblioteca para processar arquivos Excel
import * as XLSX from 'xlsx';

// Componentes de UI
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  BookOpen, 
  Plus, 
  Edit, 
  Trash2, 
  GraduationCap,
  AlertTriangle,
  Calendar,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestoreCache } from "@/hooks/useCache";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { CourseFormBuilder, CourseGeneralData } from "./CourseFormBuilder";
import { fetchCoursePlanTree, saveCoursePlanTree, CoursePlanTree } from "@/services/coursePlanService";


// --- INTERFACES ---
interface Course {
  id: string;
  name: string;
  code?: string;
  duration?: number;
  description?: string;
  workload?: number;
  createdAt?: any;
}

interface ImportedCourse {
  name: string;
  code?: string;
  duration?: number;
  description?: string;
  workload?: number;
  row: number;
}

interface ImportResult {
  successful: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export default function CourseModule() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseGeneralData | null>(null);
  const [currentTree, setCurrentTree] = useState<CoursePlanTree | undefined>(undefined);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [relatedClasses, setRelatedClasses] = useState<number>(0);
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");

  // Pending Changes State (FinOps Optimization)
  const [pendingChanges, setPendingChanges] = useState<Record<string, { data: Partial<Course>, type: 'update' | 'delete' }>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  
  // Estados para importação em massa
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importedData, setImportedData] = useState<ImportedCourse[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Carrega e sincroniza os cursos do Firestore em tempo real
  useEffect(() => {
    const coursesCollection = collection(db, "courses");
    const unsubscribe = onSnapshot(coursesCollection, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Course)).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setCourses(list);
    }, (error) => {
      console.error("Erro ao sincronizar cursos em tempo real:", error);
      toast({ 
        title: "Erro de Sincronização", 
        description: "Não foi possível sincronizar os cursos em tempo real.", 
        variant: "destructive" 
      });
    });

    return () => unsubscribe();
  }, [toast]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const snapshot = await getDocs(collection(db, "courses"));
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Course)).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setCourses(list);
      toast({ title: "Atualizado!", description: "Lista de cursos sincronizada com o banco de dados." });
    } catch (error) {
      console.error("Erro ao atualizar cursos:", error);
      toast({ title: "Erro", description: "Falha ao recarregar cursos.", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredCourses = courses.filter(course => 
    (course.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (course.code || "").toLowerCase().includes(searchQuery.toLowerCase())
  );


  // Verifica se o curso tem turmas associadas antes de deletar
  const checkRelatedClasses = async (courseId: string) => {
    try {
      const q = query(
        collection(db, "classes"), 
        where("courseId", "==", courseId)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error("Erro ao verificar turmas relacionadas:", error);
      return 0;
    }
  };

  // Prepara para deletar um curso
  const handleDeleteClick = async (course: Course) => {
    const count = await checkRelatedClasses(course.id);
    setRelatedClasses(count);
    setCourseToDelete(course);
    setIsDeleteDialogOpen(true);
  };

  // Deleta o curso (Refatorada para Frontend-First)
  const handleDeleteCourse = () => {
    if (!courseToDelete) return;
    
    setPendingChanges(prev => ({
      ...prev,
      [courseToDelete.id]: { data: courseToDelete, type: 'delete' }
    }));
    
    setIsDeleteDialogOpen(false);
    setCourseToDelete(null);
    setRelatedClasses(0);
    toast({ title: "Exclusão preparada!", description: "Salve para efetivar no banco de dados." });
  };

  const handleSaveAllChanges = async () => {
    if (isSavingAll || Object.keys(pendingChanges).length === 0) return;
    setIsSavingAll(true);
    const batch = writeBatch(db);

    try {
      Object.entries(pendingChanges).forEach(([id, change]) => {
        const docRef = doc(db, "courses", id);
        if (change.type === 'delete') {
          batch.delete(docRef);
        } else {
          const { id: _, ...payload } = change.data;
          batch.update(docRef, payload);
        }
      });
      await batch.commit();

      // Sincronizar estado local
      setCourses(prev => {
        let updated = [...prev];
        Object.entries(pendingChanges).forEach(([id, change]) => {
            if (change.type === 'delete') {
                updated = updated.filter(c => c.id !== id);
            } else {
                updated = updated.map(c => c.id === id ? { ...c, ...change.data } as Course : c);
            }
        });
        return updated.sort((a, b) => a.name.localeCompare(b.name));
      });

      setPendingChanges({});
      toast({ title: "Sucesso!", description: "Sincronização com o banco de dados concluída." });

      if (currentUser) {
        const count = Object.keys(pendingChanges).length;
        await logAction(
          AuditAction.DATA_IMPORT, // Usando DATA_IMPORT para alterações em lote
          currentUser as any,
          `Realizada atualização/exclusão em lote de ${count} cursos`,
          { count, changes: pendingChanges }
        );
      }
    } catch (error) {
      console.error("Erro ao salvar lote de cursos: ", error);
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

  const handleEditClick = async (course: Course) => {
    setIsUpdating(true);
    try {
      const tree = await fetchCoursePlanTree(course.id);
      setCurrentTree(tree);
      setEditingCourse({
        id: course.id,
        name: course.name,
        code: course.code,
        duration: course.duration,
        workload: course.workload,
        description: course.description
      });
      setIsBuilderOpen(true);
    } catch (e) {
      toast({title: "Erro ao carregar matriz curricular", variant: "destructive"});
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenNewBuilder = () => {
    setEditingCourse(null);
    setCurrentTree(undefined);
    setIsBuilderOpen(true);
  };

  const handleSaveBuilder = async (courseData: CourseGeneralData, treeData: CoursePlanTree) => {
    setIsAdding(true);
    try {
      let courseId = courseData.id;
      if (!courseId) {
        const docRef = await addDoc(collection(db, "courses"), {
          name: courseData.name.trim(),
          code: courseData.code?.trim() || '',
          duration: courseData.duration || null,
          description: courseData.description?.trim() || '',
          workload: courseData.workload || null,
          createdAt: Timestamp.now(),
        });
        courseId = docRef.id;
      } else {
        await updateDoc(doc(db, "courses", courseId), {
          name: courseData.name.trim(),
          code: courseData.code?.trim() || '',
          duration: courseData.duration || null,
          description: courseData.description?.trim() || '',
          workload: courseData.workload || null,
        });
      }
      
      await saveCoursePlanTree(courseId, treeData);
      
      toast({ title: "Sucesso", description: "Curso e Plano salvos com sucesso!" });
      setIsBuilderOpen(false);
      setEditingCourse(null);
      setCurrentTree(undefined);
      
      // Reload courses
      const snapshot = await getDocs(collection(db, "courses"));
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };


  // --- FUNÇÕES PARA IMPORTAÇÃO EM MASSA ---

  // Processa arquivo Excel/CSV
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Pular a primeira linha (cabeçalho) e processar os dados
        const processedData: ImportedCourse[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (row && row.length > 0 && row[0]) { // Nome é obrigatório
            processedData.push({
              name: String(row[0] || '').trim(),
              code: String(row[1] || '').trim(),
              duration: row[2] ? parseInt(String(row[2])) : undefined,
              workload: row[3] ? parseInt(String(row[3])) : undefined,
              description: String(row[4] || '').trim(),
              row: i + 1
            });
          }
        }

        setImportedData(processedData);
        setImportResult(null);
        toast({
          title: "Arquivo Processado",
          description: `${processedData.length} cursos encontrados no arquivo.`
        });
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        toast({
          title: "Erro",
          description: "Erro ao processar o arquivo. Verifique se é um arquivo Excel válido.",
          variant: "destructive"
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Valida dados importados
  const validateImportedData = (data: ImportedCourse[]): ImportResult => {
    const result: ImportResult = {
      successful: 0,
      failed: 0,
      errors: []
    };

    data.forEach((course) => {
      if (!course.name || course.name.trim() === '') {
        result.failed++;
        result.errors.push({
          row: course.row,
          message: 'Nome do curso é obrigatório'
        });
      } else {
        result.successful++;
      }
    });

    return result;
  };

  // Executa importação em massa
  const handleBulkImport = async () => {
    if (importedData.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum dado para importar.",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    const batch = writeBatch(db);
    const result: ImportResult = {
      successful: 0,
      failed: 0,
      errors: []
    };

    try {
      for (const course of importedData) {
        if (!course.name || course.name.trim() === '') {
          result.failed++;
          result.errors.push({
            row: course.row,
            message: 'Nome do curso é obrigatório'
          });
          continue;
        }

        try {
          const docRef = doc(collection(db, "courses"));
          batch.set(docRef, {
            name: course.name.trim(),
            code: course.code?.trim() || '',
            duration: course.duration || null,
            workload: course.workload || null,
            description: course.description?.trim() || '',
            createdAt: Timestamp.now(),
          });
          result.successful++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            row: course.row,
            message: `Erro ao processar: ${error}`
          });
        }
      }

      await batch.commit();
      setImportResult(result);
      
      if (result.successful > 0) {
        toast({
          title: "Importação Concluída",
          description: `${result.successful} curso(s) importado(s) com sucesso. ${result.failed} falha(s).`
        });

        if (currentUser) {
          await logAction(
            AuditAction.IMPORT_COURSES,
            currentUser as any,
            `Importação em massa de ${result.successful} cursos realizada com sucesso`,
            { successful: result.successful, failed: result.failed }
          );
        }
      }

      if (result.failed === 0) {
        setImportedData([]);
      }
    } catch (error) {
      console.error("Erro durante importação em massa:", error);
      toast({
        title: "Erro",
        description: "Erro ao importar cursos.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Download do template Excel
  const downloadTemplate = () => {
    const template = [
      ['Nome', 'Projeto', 'Duração (semestres)', 'Carga Horária', 'Descrição'],
      ['Engenharia de Software', 'Inova Tech', '8', '3200', 'Curso de graduação em engenharia de software'],
      ['Ciência da Computação', 'Programa Jovem Aprendiz', '8', '3000', 'Curso de graduação em ciência da computação'],
      ['Análise e Desenvolvimento de Sistemas', 'Trilhas de Futuro', '5', '2000', 'Curso tecnólogo em ADS']
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cursos');
    XLSX.writeFile(wb, 'template_cursos.xlsx');
    
    toast({
      title: "Template Baixado",
      description: "Use este arquivo como base para importação."
    });
  };

  return (
    <PageLayout>
      {/* Header */}
      <PageHeader className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Gestão de Cursos
          </h2>
          <p className="text-muted-foreground">
            Gerencie os cursos oferecidos pela instituição.
          </p>
        </div>
        
        {/* Botões de Ação */}
        <div className="flex items-center gap-2">
          {/* Botão Atualizar */}
          <Button 
            variant="outline" 
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
            title="Atualizar lista de cursos do banco de dados"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Atualizar</span>
          </Button>

          {/* Botão Importar em Massa */}
          <Button 
            variant="outline" 
            onClick={() => setIsImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar em Massa
          </Button>

          {/* Botão Adicionar Curso */}
          <Button onClick={handleOpenNewBuilder}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Curso
          </Button>
        </div>
      </PageHeader>

      {/* Card com Tabela de Cursos */}
      <PageContent>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Cursos Cadastrados
              </CardTitle>
              <CardDescription>
                Lista de todos os cursos disponíveis no sistema.
              </CardDescription>
            </div>
            {courses.length > 0 && (
              <Badge variant="secondary">
                {courses.length} {courses.length === 1 ? 'curso' : 'cursos'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {courses.length > 0 && (
            <div className="relative mb-6 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Buscar por nome do curso ou código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 h-10 w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus-visible:ring-1 focus-visible:ring-indigo-500"
              />
            </div>
          )}
          {courses.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Nenhum curso cadastrado
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Comece adicionando o primeiro curso da instituição.
              </p>
              <Button onClick={handleOpenNewBuilder}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Curso
              </Button>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Nenhum curso encontrado para a busca realizada.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do Curso</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead className="text-center">Duração</TableHead>
                    <TableHead className="text-center">Carga Horária</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCourses.map((course) => {
                    const pending = pendingChanges[course.id];
                    const isDeleted = pending?.type === 'delete';
                    const displayData = pending ? { ...course, ...pending.data } : course;

                    return (
                      <TableRow 
                        key={course.id}
                        className={`transition-colors ${
                          isDeleted ? "bg-red-50/50 opacity-60 grayscale-[0.5]" : 
                          pending ? "bg-orange-50/50" : ""
                        }`}
                      >
                        <TableCell className="font-medium">
                          <div className={isDeleted ? "line-through text-slate-400" : ""}>
                            {displayData.name}
                            {pending && !isDeleted && (
                              <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-orange-100 text-orange-700 border-orange-200 uppercase font-bold tracking-tighter">Editado</Badge>
                            )}
                            {isDeleted && (
                              <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-red-100 text-red-700 border-red-200 uppercase font-bold tracking-tighter">Removido</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {displayData.code ? (
                            <Badge variant="outline">{displayData.code}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {displayData.duration ? (
                            <div className="flex items-center justify-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span>{displayData.duration} sem.</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {displayData.workload ? (
                            <span>{displayData.workload}h</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                          {displayData.description || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditClick(displayData as Course)}
                              disabled={isDeleted || isSavingAll}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-500 hover:bg-red-50"
                              onClick={() => handleDeleteClick(course)}
                              disabled={isDeleted || isSavingAll}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Dialog de Importação em Massa */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importação em Massa de Cursos
            </DialogTitle>
            <DialogDescription>
              Importe múltiplos cursos através de um arquivo Excel (.xlsx)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Seção de Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="file-upload">Selecionar Arquivo Excel</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadTemplate}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar XLSX
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a href="/templates/template_cursos.csv" download>
                      <Download className="h-4 w-4 mr-2" />
                      Baixar CSV
                    </a>
                  </Button>
                </div>
              </div>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground">
                O arquivo deve conter as colunas: Nome, Código, Duração (semestres), Carga Horária, Descrição
              </p>
            </div>

            {/* Preview dos Dados */}
            {importedData.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Cursos Encontrados ({importedData.length})</Label>
                  {!importResult && (
                    <Button
                      onClick={handleBulkImport}
                      disabled={isImporting}
                    >
                      {isImporting ? "Importando..." : "Importar Todos"}
                    </Button>
                  )}
                </div>

                <div className="border rounded-md max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Linha</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>C. Horária</TableHead>
                        <TableHead>Descrição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importedData.map((course, index) => (
                        <TableRow key={index}>
                          <TableCell>{course.row}</TableCell>
                          <TableCell className="font-medium">{course.name}</TableCell>
                          <TableCell>{course.code || '—'}</TableCell>
                          <TableCell>{course.duration ? `${course.duration} sem.` : '—'}</TableCell>
                          <TableCell>{course.workload ? `${course.workload}h` : '—'}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {course.description || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Resultado da Importação */}
            {importResult && (
              <div className="space-y-2">
                <Label>Resultado da Importação</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      {importResult.successful} curso(s) importado(s) com sucesso
                    </span>
                  </div>

                  {importResult.failed > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800 dark:text-red-200">
                          {importResult.failed} erro(s) encontrado(s)
                        </span>
                      </div>

                      <div className="border rounded-md max-h-[150px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[80px]">Linha</TableHead>
                              <TableHead>Erro</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importResult.errors.map((error, index) => (
                              <TableRow key={index}>
                                <TableCell>{error.row}</TableCell>
                                <TableCell className="text-sm text-red-600">
                                  {error.message}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false);
                setImportedData([]);
                setImportResult(null);
              }}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Tem certeza que deseja excluir o curso{' '}
                <strong>"{courseToDelete?.name}"</strong>?
              </p>
              {relatedClasses > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mt-2">
                  <p className="text-destructive font-medium">
                    ⚠️ Atenção: Este curso possui {relatedClasses}{' '}
                    {relatedClasses === 1 ? 'turma associada' : 'turmas associadas'}.
                  </p>
                  <p className="text-sm text-destructive/80 mt-1">
                    A exclusão pode afetar as turmas cadastradas.
                  </p>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Esta ação não pode ser desfeita.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir Curso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent 
          className="max-w-5xl h-[90vh] p-0 overflow-hidden flex flex-col"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="sr-only">
            <DialogTitle>Construtor de Cursos</DialogTitle>
            <DialogDescription>
              Interface para construção da matriz curricular do curso.
            </DialogDescription>
          </div>
          <CourseFormBuilder 
            initialCourseData={editingCourse || undefined}
            initialTreeData={currentTree}
            onSave={handleSaveBuilder}
            onCancel={() => setIsBuilderOpen(false)}
            isSaving={isAdding}
          />
        </DialogContent>
      </Dialog>

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
                  cursos rascunhados
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