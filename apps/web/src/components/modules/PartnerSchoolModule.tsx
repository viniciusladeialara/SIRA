import React, { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "@/lib/db";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  Timestamp, 
  writeBatch, 
  doc,
  orderBy,
  setDoc,
  deleteDoc
} from "@/lib/sira-sql-adapter";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import * as XLSX from "xlsx";

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, ArrowUpRight } from "lucide-react";

// Icons
import { 
  Users, 
  Upload, 
  Settings,
  Plus,
  Trash2,
  Building2,
  MapPin
} from "lucide-react";

// Novos Componentes
import { PartnerFilters } from "@/components/partner/PartnerFilters";
import { PartnerStats } from "@/components/partner/PartnerStats";
import { PartnerAttendanceTable } from "@/components/partner/PartnerAttendanceTable";
import { PartnerImportFlow } from "@/components/partner/PartnerImportFlow";
import { SchoolManagement } from "@/components/partner/SchoolManagement";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";

// --- Interfaces ---
interface PartnerAttendance {
  id: string;
  escolaId: string;
  turmaId: string;
  dataAula: string;
  raAluno: string;
  nomeAluno: string;
  status: 'P' | 'F' | 'N';
  nota?: string;
  importId: string;
}

interface ClassMetadata {
  id: string;
  escolaId: string;
  escolaNome: string;
  turmaId: string;
  curso: string;
  docente: string;
  modalidade: string;
}

interface ClassLesson {
  id: string;
  escolaId: string;
  turmaId: string;
  dataAula: string;
  conteudo: string;
  observacao: string;
  importId: string;
}

interface School {
  id: string;
  name: string;
  city: string;
  active: boolean;
}

interface XLSXRow {
  unidade_operacional?: string;
  modalidade?: string;
  curso?: string;
  unidade_curricular?: string;
  modulo?: string;
  docente?: string;
  turma: string;
  escola?: string;
  ra_aluno: string;
  nome_aluno: string;
  data_aula: string;
  status_presenca: string;
  nota?: string;
  conteudo_lancado?: string;
  conteudo?: string;
  observacao?: string;
}

export const PartnerSchoolModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { userRole, userData, loading: permissionsLoading } = usePermissions();
  const { toast } = useToast();

  const [activeTab, setActiveTab ] = useState("tracking");
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [frequencias, setFrequencias] = useState<PartnerAttendance[]>([]);
  const [aulas, setAulas] = useState<ClassLesson[]>([]);
  const [turmasMetadata, setTurmasMetadata] = useState<ClassMetadata[]>([]);
  const [schoolsList, setSchoolsList] = useState<School[]>([]);

  // Filters State
  const [filterEscola, setFilterEscola] = useState<string>("all");
  const [filterTurma, setFilterTurma] = useState<string>("all");
  const [filterCurso, setFilterCurso] = useState<string>("all");
  const [filterAluno, setFilterAluno] = useState("");
  const [filterRA, setFilterRA] = useState("");
  const [filterData, setFilterData] = useState("");

  // Import State
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<XLSXRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<"idle" | "preview" | "validation" | "done">("idle");
  const [fullImportData, setFullImportData] = useState<XLSXRow[]>([]);
  const [importSummary, setImportSummary] = useState({ alumnos: 0, aulas: 0, turma: '' });
  
  // School Management
  const [isAddingSchool, setIsAddingSchool] = useState(false);
  const [isDeletingSchool, setIsDeletingSchool] = useState(false);
  const [newSchool, setNewSchool] = useState({ name: '', city: '' });
  
  // Pending Changes State (FinOps Optimization)
  const [pendingChanges, setPendingChanges] = useState<Record<string, { data: any, type: 'update' | 'delete' }>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);

  const isAdminOrUser = userRole === "ADMIN" || userRole === "USER";

  // --- Fetch Data ---
  useEffect(() => {
    if (!currentUser || permissionsLoading) return;
    setLoading(true);

    const isPartner = userRole === "PARTNER_SCHOOL";
    const schoolId = isPartner ? userData?.escolaId : null;

    // Se for escola parceira mas não houver escolaId vinculada, não iniciamos as buscas
    // para evitar Erro de Permissão (Missing or insufficient permissions)
    if (isPartner && !schoolId) {
      console.warn("Usuário Escola Parceira sem escolaId vinculada.");
      setLoading(false);
      return;
    }

    const qTurmas = schoolId 
      ? query(collection(db, "diario_turmas"), where("escolaId", "==", schoolId))
      : (isAdminOrUser 
          ? query(collection(db, "diario_turmas"), orderBy("turmaId", "asc"))
          : null);

    let unsubscribeTurmas = () => {};
    if (qTurmas) {
      unsubscribeTurmas = onSnapshot(qTurmas, (snapshot) => {
        setTurmasMetadata(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClassMetadata[]);
      });
    }

    const qFreq = schoolId
      ? query(collection(db, "diario_frequencias"), where("escolaId", "==", schoolId))
      : (isAdminOrUser 
          ? query(collection(db, "diario_frequencias"), orderBy("dataAula", "desc"))
          : null);

    let unsubscribeFreq = () => {};
    if (qFreq) {
      unsubscribeFreq = onSnapshot(qFreq, (snapshot) => {
        setFrequencias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PartnerAttendance[]);
      });
    }

    const qAulas = schoolId
      ? query(collection(db, "diario_aulas"), where("escolaId", "==", schoolId))
      : (isAdminOrUser 
          ? query(collection(db, "diario_aulas"), orderBy("dataAula", "desc"))
          : null);

    let unsubscribeAulas = () => {};
    if (qAulas) {
      unsubscribeAulas = onSnapshot(qAulas, (snapshot) => {
        setAulas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClassLesson[]);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    let unsubscribeSchools = () => {};
    if (isAdminOrUser) {
      const qSchools = query(collection(db, "schools"), orderBy("name", "asc"));
      unsubscribeSchools = onSnapshot(qSchools, (snapshot) => {
        setSchoolsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as School[]);
      });
    }

    return () => { 
      unsubscribeTurmas(); 
      unsubscribeFreq(); 
      unsubscribeAulas(); 
      unsubscribeSchools(); 
    };
  }, [currentUser, permissionsLoading, userRole, userData?.escolaId, isAdminOrUser]);

  // --- Filters Logic ---
  const escolas = useMemo(() => schoolsList.map(s => s.name).sort(), [schoolsList]);
  
  const cursos = useMemo(() => {
    const filtered = filterEscola !== "all" 
      ? turmasMetadata.filter(t => t.escolaNome === filterEscola) 
      : turmasMetadata;
    return [...new Set(filtered.map(t => t.curso))].sort();
  }, [turmasMetadata, filterEscola]);
  
  const turmas = useMemo(() => {
    let filtered = turmasMetadata;
    if (filterEscola !== "all") filtered = filtered.filter(t => t.escolaNome === filterEscola);
    if (filterCurso !== "all") filtered = filtered.filter(t => t.curso === filterCurso);
    return [...new Set(filtered.map(t => t.turmaId))].sort();
  }, [turmasMetadata, filterEscola, filterCurso]);

  const filteredData = useMemo(() => {
    return frequencias.filter((f) => {
      const meta = turmasMetadata.find(t => t.escolaId === f.escolaId && t.turmaId === f.turmaId);
      if (filterEscola !== "all" && meta?.escolaNome !== filterEscola) return false;
      if (filterTurma !== "all" && f.turmaId !== filterTurma) return false;
      if (filterCurso !== "all" && meta?.curso !== filterCurso) return false;
      if (filterAluno && !f.nomeAluno.toLowerCase().includes(filterAluno.toLowerCase())) return false;
      if (filterRA && !f.raAluno.toLowerCase().includes(filterRA.toLowerCase())) return false;
      if (filterData && f.dataAula !== filterData) return false;
      return true;
    });
  }, [frequencias, turmasMetadata, filterEscola, filterTurma, filterCurso, filterAluno, filterRA, filterData]);

  const stats = useMemo(() => {
    const totalAlunos = new Set(filteredData.map((f) => f.raAluno)).size;
    const totalPresencas = filteredData.filter((f) => f.status === 'P').length;
    const totalFaltas = filteredData.filter((f) => f.status === 'F').length;
    const totalAulas = new Set(filteredData.map((f) => f.dataAula)).size;
    return { totalAlunos, totalPresencas, totalFaltas, totalAulas };
  }, [filteredData]);

  // --- Handlers ---
  const handleSaveAllChanges = async () => {
    if (isSavingAll || Object.keys(pendingChanges).length === 0) return;
    setIsSavingAll(true);
    const batch = writeBatch(db);

    try {
      Object.entries(pendingChanges).forEach(([id, change]) => {
        const docRef = doc(db, "schools", id);
        if (change.type === 'delete') {
          batch.delete(docRef);
        } else {
          batch.update(docRef, change.data);
        }
      });

      await batch.commit();
      setPendingChanges({});
      toast({ title: "Sucesso", description: "Alterações no cadastro de escolas foram salvas." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Erro", description: "Erro ao salvar alterações: " + error.message, variant: "destructive" });
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleDiscardChanges = () => {
    if (Object.keys(pendingChanges).length === 0) return;
    if (window.confirm(`Deseja descartar ${Object.keys(pendingChanges).length} alterações pendentes?`)) {
      setPendingChanges({});
    }
  };

  const handleDeleteSchool = async (id: string) => {
    const school = schoolsList.find(s => s.id === id);
    if (!school) return;

    if (window.confirm(`Deseja colocar a escola "${school.name}" na fila de exclusão?`)) {
      setPendingChanges(prev => ({
        ...prev,
        [id]: { data: school, type: 'delete' }
      }));
      toast({ title: "Preparado", description: "Escola agendada para exclusão." });
    }
  };

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setImportStep("preview");

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result as string;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const dataRows = XLSX.utils.sheet_to_json<XLSXRow>(ws, { defval: "" });
      
      if (dataRows.length > 0) {
        setFullImportData(dataRows);
        setPreview(dataRows.slice(0, 5));
        const uniqueAlunos = new Set(dataRows.map(r => r.ra_aluno)).size;
        const uniqueAulas = new Set(dataRows.map(r => r.data_aula)).size;
        setImportSummary({ 
          alumnos: uniqueAlunos, 
          aulas: uniqueAulas, 
          turma: String(dataRows[0].turma || dataRows[0].escola || "N/A") 
        });
      }
    };
    reader.readAsBinaryString(f);
  }, []);

  const confirmImport = async () => {
    if (fullImportData.length === 0 || !currentUser) return;
    setImporting(true);

    try {
      const importId = "IMP_" + Date.now();
      const firstRow = fullImportData[0];
      const escolaId = userData?.escolaId || "IMP_" + String(firstRow.escola || firstRow.unidade_operacional || "UNK").trim().replace(/\s+/g, '_');
      const escolaNome = String(firstRow.escola || firstRow.unidade_operacional || "Unidade Importada").trim();
      const turmaId = String(firstRow.turma).trim();

      await setDoc(doc(db, "imports_diario", importId), {
        fileName: file?.name,
        uploadedBy: currentUser.uid,
        uploadedAt: Timestamp.now(),
        escolaId,
        turmaId,
        status: 'completed'
      });

      await setDoc(doc(db, "diario_turmas", `${escolaId}_${turmaId}`), {
        escolaId, escolaNome, turmaId,
        curso: String(firstRow.curso || "").trim(),
        modalidade: String(firstRow.modalidade || "").trim(),
        docente: String(firstRow.docente || "").trim()
      }, { merge: true });

      const uniqueDates = Array.from(new Set(fullImportData.map(r => r.data_aula)));
      
      for (const date of uniqueDates) {
        const rows = fullImportData.filter(r => r.data_aula === date);
        const aulaId = `${escolaId}_${turmaId}_${date}`;
        
        await setDoc(doc(db, "diario_aulas", aulaId), {
          escolaId, turmaId, dataAula: date,
          conteudo: String(rows[0].conteudo_lancado || rows[0].conteudo || "").trim(),
          observacao: String(rows[0].observacao || "").trim(),
          importId
        }, { merge: true });

        const batch = writeBatch(db);
        rows.forEach(row => {
          const status = String(row.status_presenca).trim().toUpperCase() === "P" ? "P" : "F";
          batch.set(doc(db, "diario_frequencias", `${aulaId}_${row.ra_aluno}`), {
            escolaId, turmaId, dataAula: date,
            raAluno: String(row.ra_aluno).trim(),
            nomeAluno: String(row.nome_aluno).trim(),
            status, 
            nota: String(row.nota || "").trim(),
            importId
          }, { merge: true });
        });
        await batch.commit();
      }

      toast({ title: "Sucesso", description: "Dados importados com sucesso." });
      setImportStep("done");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ["escola", "curso", "turma", "modalidade", "docente", "data_aula", "ra_aluno", "nome_aluno", "status_presenca", "nota", "conteudo", "observacao"],
      ["SENAI Caceres", "TI", "T-01", "Presencial", "Paulo", "2024-03-13", "123", "Joao", "P", "10", "Lógica", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_acompanhamento.xlsx");
  };

  const handleAddSchool = async () => {
    if (!newSchool.name || !newSchool.city) return;
    setIsAddingSchool(true);
    try {
      const id = newSchool.name.trim().toUpperCase().replace(/\s+/g, '_');
      await setDoc(doc(db, "schools", id), { ...newSchool, active: true, createdAt: Timestamp.now() });
      setNewSchool({ name: '', city: '' });
      setIsAddingSchool(false);
      toast({ title: "Sucesso", description: "Escola cadastrada." });
    } catch (err: any) { 
      toast({ title: "Erro", description: err.message, variant: "destructive" }); 
    } finally {
      setIsAddingSchool(false);
    }
  };

  const handleDeleteSchool_Old = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta escola?")) return;
    setIsDeletingSchool(true);
    try {
      await deleteDoc(doc(db, "schools", id));
      toast({ title: "Sucesso", description: "Escola excluída com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsDeletingSchool(false);
    }
  };

  return (
    <PageLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col h-full min-h-0">
        <PageHeader className="space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Escolas Parceiras</h1>
            <p className="text-muted-foreground">Gestão de acompanhamento e importação de diários.</p>
          </div>

          <TabsList className={`grid w-full max-w-lg ${isAdminOrUser ? "grid-cols-3" : "grid-cols-1"}`}>
            <TabsTrigger value="tracking" className="gap-2"><Users className="h-4 w-4" /> Acompanhamento</TabsTrigger>
            {isAdminOrUser && (
              <>
                <TabsTrigger value="import" className="gap-2"><Upload className="h-4 w-4" /> Importar</TabsTrigger>
                <TabsTrigger value="manage" className="gap-2"><Settings className="h-4 w-4" /> Gestão</TabsTrigger>
              </>
            )}
          </TabsList>
        </PageHeader>

        <PageContent>
        <TabsContent value="tracking" className="space-y-6 pt-4">
          <PartnerStats stats={stats} />
          <PartnerFilters 
            isAdminOrUser={isAdminOrUser} 
            filterEscola={filterEscola} setFilterEscola={setFilterEscola} escolas={escolas}
            filterCurso={filterCurso} setFilterCurso={setFilterCurso} cursos={cursos}
            filterTurma={filterTurma} setFilterTurma={setFilterTurma} turmas={turmas}
            filterAluno={filterAluno} setFilterAluno={setFilterAluno}
            filterRA={filterRA} setFilterRA={setFilterRA}
            filterData={filterData} setFilterData={setFilterData}
          />
          <PartnerAttendanceTable 
            loading={loading} filteredData={filteredData} 
            turmasMetadata={turmasMetadata} aulas={aulas} 
            isAdminOrUser={isAdminOrUser} 
          />
        </TabsContent>

        {isAdminOrUser && (
          <>
            <TabsContent value="import" className="pt-4">
              <PartnerImportFlow 
                importStep={importStep} setImportStep={setImportStep}
                file={file} handleFile={handleFile} preview={preview}
                importSummary={importSummary} importing={importing}
                cancelImport={() => setImportStep("idle")}
                prepareImport={() => setImportStep("validation")}
                confirmImport={confirmImport}
                downloadTemplate={downloadTemplate}
              />
            </TabsContent>
            <TabsContent value="manage" className="pt-4">
              <SchoolManagement 
                schoolsList={schoolsList.map(s => {
                  const pending = pendingChanges[s.id];
                  if (pending?.type === 'delete') return { ...s, isDeleting: true };
                  return s;
                })}
                isAddingSchool={isAddingSchool} setIsAddingSchool={setIsAddingSchool}
                newSchool={newSchool} setNewSchool={setNewSchool}
                handleAddSchool={handleAddSchool}
                handleDeleteSchool={handleDeleteSchool}
                isAdding={isAddingSchool}
                isDeleting={isSavingAll}
              />
            </TabsContent>
          </>
        )}
        </PageContent>
      </Tabs>

      {/* Barra de Ações Flutuante (Optimized UX) */}
      {Object.keys(pendingChanges).length > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out">
            <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900 shadow-[0_20px_50px_rgba(79,70,229,0.15)] rounded-full px-6 py-4 flex items-center gap-8 ring-1 ring-black/5">
              <div className="flex items-center gap-4 pr-8 border-r border-indigo-50 dark:border-indigo-900">
                  <div className="bg-orange-500 text-white p-2.5 rounded-full shadow-lg shadow-orange-200 dark:shadow-orange-900/40 animate-bounce-subtle">
                    <Settings className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200 leading-none mb-1">
                      {Object.keys(pendingChanges).length} {Object.keys(pendingChanges).length === 1 ? 'alteração pendente' : 'alterações pendentes'}
                    </p>
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 uppercase tracking-widest font-bold">
                        Gestão de Unidades
                    </p>
                  </div>
              </div>
              
              <div className="flex items-center gap-4">
                <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDiscardChanges}
                disabled={isSavingAll}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors uppercase text-xs font-bold tracking-tight"
                >
                  Descartar
                </Button>
                <Button 
                size="sm" 
                onClick={handleSaveAllChanges}
                disabled={isSavingAll}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 rounded-full shadow-[0_10px_20px_rgba(79,70,229,0.3)] hover:shadow-[0_15px_30px_rgba(79,70,229,0.4)] transition-all font-bold"
                >
                  {isSavingAll ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </div>
          </div>
      )}
    </PageLayout>
  );
}
