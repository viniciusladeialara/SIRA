// --- Importações de Bibliotecas e Módulos ---
import { useState, useEffect } from "react";
// Importa a instância do nosso banco de dados do Firebase
import { db, functions } from "@/lib/db";
import { httpsCallable } from "@/lib/sira-functions-adapter";
// Importa as funções do Firestore para interagir com o banco de dados
// collection: para referenciar uma coleção de documentos
// onSnapshot: para ouvir em tempo real as mudanças em uma coleção
// addDoc: para adicionar um novo documento
// updateDoc: para atualizar um documento existente
// deleteDoc: para excluir um documento
// doc: para criar uma referência a um documento específico
// query: para construir uma consulta ao banco de dados
// where: para filtrar a consulta com base em uma condição (ex: email duplicado)
// getDocs: para obter os documentos de uma consulta de forma única (não em tempo real)
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, writeBatch, setDoc } from "@/lib/sira-sql-adapter";
// Importa biblioteca para processar arquivos Excel
import * as XLSX from 'xlsx';

// --- Importações de Componentes de UI (shadcn/ui) ---
// Estes componentes são usados para construir a interface visual
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/AuthContext";
import { logAction, AuditAction } from "@/lib/AuditLog";
import { GraduationCap, Plus, Edit, Trash2, Mail, Phone, UserCheck, UserX, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Copy, Loader, Calendar, Search } from "lucide-react";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
// Importa o hook para exibir notificações (toasts)
import { useToast } from "@/hooks/use-toast";
import { formatPhoneBR } from "@/lib/maskUtils";
import { useFirestoreCache } from "@/hooks/useCache";
import { getUnitName } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// --- Tipagem do Objeto Professor ---
// Define a estrutura de dados que um objeto Professor deve ter
interface Professor {
  id: string;
  name: string;
  email: string;
  phone1: string;
  phone2: string;
  isActive: boolean; // Indica se o professor está ativo ou inativo
  allowedShifts?: string[]; // Turnos permitidos
}

// --- Tipagem para Importação em Massa ---
interface ImportedProfessor {
  name: string;
  email: string;
  phone1: string;
  phone2: string;
  row: number; // Número da linha no arquivo para referência
}

interface ImportResult {
  success: ImportedProfessor[];
  errors: { row: number; error: string; data: ImportedProfessor }[];
  duplicates: { row: number; email: string; data: ImportedProfessor }[];
}

// --- Componente Principal ---
export function ProfessorModule() {
  // Estado para armazenar a lista de professores do banco de dados
  const [professors, setProfessors] = useState<Professor[]>([]);
  // Estado para os campos do formulário de adicionar um novo professor
  const [newProfessor, setNewProfessor] = useState({ name: '', email: '', phone1: '', phone2: '', allowedShifts: [] as string[] });
  // Estado para gerenciar o professor que está sendo editado (null se nenhum)
  const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Estados para importação em massa
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedData, setImportedData] = useState<ImportedProfessor[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Estados para alocação
  const [selectedProfForAlloc, setSelectedProfForAlloc] = useState<Professor | null>(null);
  const [profAllocations, setProfAllocations] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [allocationOptions, setAllocationOptions] = useState<any[]>([]);
  const [isLoadingAlloc, setIsLoadingAlloc] = useState(false);
  
  // Pending Changes State (FinOps Optimization)
  const [pendingChanges, setPendingChanges] = useState<Record<string, { data: Partial<Professor>, type: 'update' | 'delete' }>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Estados para gestão de projetos (Removidos para evitar duplicidade com Alocação Docente)

  // Controle de permissões
  const { isUserAdmin, isUserOperational, userData, canDelete } = usePermissions();
  const { currentUser } = useAuth();
  const selectedUnitId = userData?.selectedUnitId || "caceres";
  const isAdmin = isUserAdmin();
  const canManageProfessors = isUserAdmin() || isUserOperational();

  // Hook para usar a funcionalidade de toasts (notificações)
  const { toast } = useToast();

  const { cacheQuery, invalidate } = useFirestoreCache();

  useEffect(() => {
    const fetchProfessors = async () => {
      try {
        const data = await cacheQuery(`teachers_${selectedUnitId}`, async () => {
          const snapshot = await getDocs(collection(db, "teachers"));
          const allTeachers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          return allTeachers.filter(t => {
            const primaryUnit = t.unitId || 'caceres';
            const unitList = Array.isArray(t.unitIds) && t.unitIds.length > 0 ? t.unitIds : [primaryUnit];
            return unitList.includes(selectedUnitId);
          }) as Professor[];
        });
        setProfessors(data || []);
      } catch (error) {
        console.warn("Sem professores para esta unidade:", error);
        setProfessors([]);
      }
    };

    fetchProfessors();
  }, [toast, cacheQuery, selectedUnitId]);

  const filteredProfessors = professors.filter(p => 
    (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Carregar projetos e opções de alocação de forma reativa
  useEffect(() => {
    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubOptions = onSnapshot(collection(db, "allocation_options"), (snap) => {
      setAllocationOptions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubProjects();
      unsubOptions();
    };
  }, []);

  // Carregar alocações quando um professor for selecionado
  useEffect(() => {
    if (!selectedProfForAlloc) {
      setProfAllocations([]);
      return;
    }

    setIsLoadingAlloc(true);
    const q = query(collection(db, "teacher_allocation"), where("teacherId", "==", selectedProfForAlloc.id));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProfAllocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoadingAlloc(false);
    }, (error) => {
      console.error("Erro ao carregar alocação:", error);
      toast({ title: "Erro", description: "Não foi possível carregar o planejamento.", variant: "destructive" });
      setIsLoadingAlloc(false);
    });

    return () => unsubscribe();
  }, [selectedProfForAlloc, toast]);

  // --- Funções CRUD (Criação, Leitura, Atualização, Exclusão) ---
  const normalizePhone = (phone: string) => {
    // Remove tudo que não é dígito
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    // Se tiver 10 ou 11 dígitos, assume que falta o DDI (55)
    if (digits.length === 10 || digits.length === 11) {
      return `55${digits}`;
    }
    return digits;
  };

  // Função para adicionar um novo professor ao banco de dados
  const handleAddProfessor = async () => {
    // Prevent unauthorized or double execution
    if (!canManageProfessors || isAdding) return;

    // Validação: verifica se o nome e e-mail foram preenchidos
    if (!newProfessor.name || !newProfessor.email) {
      toast({ title: "Erro", description: "Nome e e-mail são obrigatórios", variant: "destructive" });
      return;
    }

    // Prevenção de Duplicatas (Best Practice Google)
    const emailExists = professors.some(p => p.email.toLowerCase() === newProfessor.email.toLowerCase());
    if (emailExists) {
      toast({ title: "Erro", description: "Este e-mail já está cadastrado para outro professor.", variant: "destructive" });
      return;
    }

    setIsAdding(true);

    const normalizedPhone1 = normalizePhone(newProfessor.phone1);
    if (normalizedPhone1 && !/^\d{12,13}$/.test(normalizedPhone1)) {
      toast({ title: "Erro", description: "O telefone deve ter DDD e 9 dígitos (ex: 65999999999)", variant: "destructive" });
      return;
    }

    try {
      // 1. Cria usuário no Firebase Auth via Cloud Function usando a senha padrão
      const defaultPassword = "abcd@1234";
      const createUserFunc = httpsCallable(functions, "createUser");
      const userResult = await createUserFunc({
        email: newProfessor.email,
        name: newProfessor.name,
        password: defaultPassword,
        role: "PROFESSOR",
        unitIds: selectedUnitId ? [selectedUnitId] : [],
        selectedUnitId: selectedUnitId || undefined
      });

      const responseData = userResult.data as any;
      const newUid = responseData?.uid || responseData?.userData?.uid;

      if (!newUid) {
        throw new Error("Não foi possível obter o identificador (UID) do usuário criado.");
      }

      // 2. Salva os dados na coleção teachers, com a flag de troca de senha
      await setDoc(doc(db, "teachers", newUid), {
        name: newProfessor.name,
        email: newProfessor.email,
        phone1: normalizePhone(newProfessor.phone1),
        phone1_raw: newProfessor.phone1, // Mantém o original para exibição se desejar
        phone2: normalizePhone(newProfessor.phone2),
        isActive: true,
        mustChangePassword: true,
        allowedShifts: newProfessor.allowedShifts || [],
        unitId: selectedUnitId,
        unitIds: selectedUnitId ? [selectedUnitId] : [],
        unitName: getUnitName(selectedUnitId)
      });

      // 3. Garante que na coleção users o documento também tenha selectedUnitId e unitIds sincronizados
      await setDoc(doc(db, "users", newUid), {
        name: newProfessor.name,
        email: newProfessor.email,
        role: "PROFESSOR",
        teacherId: newUid,
        unitId: selectedUnitId,
        unitIds: selectedUnitId ? [selectedUnitId] : [],
        selectedUnitId: selectedUnitId,
        isActive: true
      }, { merge: true });

      // Atualiza o estado local
      setProfessors(prev => [...prev, {
        id: newUid,
        name: newProfessor.name,
        email: newProfessor.email,
        phone1: normalizePhone(newProfessor.phone1),
        phone2: normalizePhone(newProfessor.phone2),
        isActive: true,
        allowedShifts: newProfessor.allowedShifts || []
      }]);

      // Limpa os campos do formulário após o sucesso
      setNewProfessor({ name: '', email: '', phone1: '', phone2: '', allowedShifts: [] });
      toast({ title: "Sucesso", description: "Professor criado e credenciais registradas com a senha padrão (abcd@1234)!" });

      // Registro de Auditoria
      if (currentUser) {
        await logAction(
          AuditAction.CREATE_TEACHER,
          currentUser as any,
          `Cadastrou o(a) professor(a) ${newProfessor.name} (${newProfessor.email})`,
          { teacherId: newUid, email: newProfessor.email, unitId: selectedUnitId }
        );
      }
    } catch (error: any) {
      console.error("Erro ao adicionar professor: ", error);
      toast({ title: "Erro", description: error.message || "Não foi possível adicionar o professor", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  // Função para excluir um professor (Refatorada para Frontend-First - Restrita a Administradores)
  const handleDeleteProfessor = (id: string) => {
    if (!canDelete('professors')) {
      toast({ title: "Acesso negado", description: "Você não tem permissão para excluir professores. Apenas administradores podem realizar exclusões.", variant: "destructive" });
      return;
    }
    
    // Pede confirmação antes de preparar a exclusão
    if (!window.confirm("Tem a certeza que deseja excluir este professor? A alteração será efetivada somente ao salvar as pendências.")) return;
    
    const prof = professors.find(p => p.id === id);
    if (!prof) return;

    setPendingChanges(prev => ({
      ...prev,
      [id]: { data: prof, type: 'delete' }
    }));

    toast({ title: "Exclusão preparada!", description: "Salve para efetivar no banco de dados." });
  };

  // Função para atualizar as informações de um professor (Refatorada para Frontend-First)
  const handleUpdateProfessor = () => {
    if (!canManageProfessors || !editingProfessor) return;

    const normalizedPhone1 = normalizePhone(editingProfessor.phone1);
    if (normalizedPhone1 && !/^\d{12,13}$/.test(normalizedPhone1)) {
      toast({ title: "Erro", description: "O telefone deve ter DDD e 9 dígitos (ex: 65999999999)", variant: "destructive" });
      return;
    }

    try {
      // Prepara o payload normalizado
      const payload = {
        ...editingProfessor,
        phone1: normalizedPhone1,
        phone2: normalizePhone(editingProfessor.phone2)
      };

      setPendingChanges(prev => ({
        ...prev,
        [editingProfessor.id]: { data: payload, type: 'update' }
      }));

      // Limpa o estado de edição
      setEditingProfessor(null);
      toast({ title: "Alteração preparada!", description: "Salve para efetivar no banco de dados." });
    } catch (error: any) {
      console.error("Erro ao preparar atualização: ", error);
      toast({ title: "Erro", description: "Não foi possível preparar a atualização", variant: "destructive" });
    }
  };

  // Função para salvar todas as alterações pendentes em lote
  const handleSaveAllChanges = async () => {
    if (!canManageProfessors || isSavingAll || Object.keys(pendingChanges).length === 0) return;

    setIsSavingAll(true);
    const batch = writeBatch(db);

    try {
      Object.entries(pendingChanges).forEach(([id, change]) => {
        const docRef = doc(db, "teachers", id);
        if (change.type === 'delete') {
          if (!canDelete('professors')) {
            throw new Error("Você não tem permissão para excluir professores. Apenas administradores podem realizar exclusões.");
          }
          batch.delete(docRef);
          batch.delete(doc(db, "users", id));
        } else {
          // Remover o ID do payload para evitar sobrescrever a chave primária redundante
          const { id: _, ...payload } = change.data;
          batch.update(docRef, payload);

          // Sincronizar status com a coleção 'users' para controle imediato de acesso/login
          if (payload.isActive !== undefined) {
            const userDocRef = doc(db, "users", id);
            batch.set(userDocRef, { 
              isActive: payload.isActive,
              status: payload.isActive ? 'active' : 'inactive'
            }, { merge: true });
          }
        }
      });

      await batch.commit();

      // Após sucesso, atualizamos o estado local de professors
      setProfessors(prev => {
        let updated = [...prev];
        Object.entries(pendingChanges).forEach(([id, change]) => {
          if (change.type === 'delete') {
            updated = updated.filter(p => p.id !== id);
          } else {
            updated = updated.map(p => p.id === id ? { ...p, ...change.data } as Professor : p);
          }
        });
        return updated;
      });

      const changesCount = Object.keys(pendingChanges).length;
      setPendingChanges({});
      toast({ title: "Sucesso!", description: "Todas as alterações foram sincronizadas com o banco de dados." });

      // Registro de Auditoria
      if (currentUser && changesCount > 0) {
        await logAction(
          AuditAction.UPDATE_TEACHER,
          currentUser as any,
          `Sincronizou ${changesCount} alteração(ões) no corpo docente`,
          { count: changesCount, unitId: selectedUnitId }
        );
      }
    } catch (error: any) {
      console.error("Erro ao salvar lote: ", error);
      toast({ title: "Erro no Salvamento", description: "Ocorreu um problema ao salvar em lote.", variant: "destructive" });
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleDiscardChanges = () => {
    if (Object.keys(pendingChanges).length === 0) return;
    if (window.confirm("Deseja descartar todas as alterações pendentes?")) {
      setPendingChanges({});
    }
  };

  // Funções de manipulação de token foram removidas para uso da autenticação unificada via Firebase Auth.

  // Função para ativar/desativar o status do professor (Refatorada para Frontend-First)
  const handleToggleActiveStatus = (professor: Professor) => {
    if (!canManageProfessors) return;
    
    const key = professor.id;
    const currentPending = pendingChanges[key];
    const baseData = currentPending ? { ...professor, ...currentPending.data } : professor;

    setPendingChanges(prev => ({
      ...prev,
      [key]: { 
        data: { ...baseData, isActive: !baseData.isActive }, 
        type: 'update' 
      }
    }));

    toast({ 
      title: "Status alterado!", 
      description: `Professor(a) ${baseData.isActive ? 'será desativado(a)' : 'será ativado(a)'}. Salve para efetivar.` 
    });
  };

  // --- FUNÇÕES PARA IMPORTAÇÃO EM MASSA ---

  // Função para processar arquivo Excel/CSV
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
        const processedData: ImportedProfessor[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (row && row.length > 0 && row[0] && row[1]) { // Nome e email são obrigatórios
            processedData.push({
              name: String(row[0] || '').trim(),
              email: String(row[1] || '').trim(),
              phone1: String(row[2] || '').trim(),
              phone2: String(row[3] || '').trim(),
              row: i + 1
            });
          }
        }

        setImportedData(processedData);
        setImportResult(null);
        toast({
          title: "Arquivo Processado",
          description: `${processedData.length} professores encontrados no arquivo.`
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

  // Função para validar dados importados (otimizada)
  const validateImportedData = (data: ImportedProfessor[]): ImportResult => {
    const result: ImportResult = {
      success: [],
      errors: [],
      duplicates: []
    };

    // Otimização: usar Set para busca O(1) em vez de array
    const existingEmails = new Set(professors.map(p => p.email.toLowerCase()));
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Processar em lote para melhor performance
    for (const item of data) {
      // Validações básicas
      if (!item.name.trim()) {
        result.errors.push({
          row: item.row,
          error: "Nome é obrigatório",
          data: item
        });
        continue;
      }

      if (!item.email.trim()) {
        result.errors.push({
          row: item.row,
          error: "E-mail é obrigatório",
          data: item
        });
        continue;
      }

      // Validar formato do email
      if (!emailRegex.test(item.email)) {
        result.errors.push({
          row: item.row,
          error: "E-mail inválido",
          data: item
        });
        continue;
      }

      // Verificar duplicatas
      if (existingEmails.has(item.email.toLowerCase())) {
        result.duplicates.push({
          row: item.row,
          email: item.email,
          data: item
        });
        continue;
      }

      result.success.push(item);
    }

    return result;
  };

  // Função para executar a importação
  const handleImportProfessors = async () => {
    if (!canManageProfessors) return;

    if (importedData.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum dado para importar.",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    const validationResult = validateImportedData(importedData);
    setImportResult(validationResult);

    if (validationResult.success.length === 0) {
      setIsImporting(false);
      toast({
        title: "Nenhum Professor Válido",
        description: "Todos os professores têm erros ou são duplicatas.",
        variant: "destructive"
      });
      return;
    }

    try {
      const batch = writeBatch(db);
      const teachersCollection = collection(db, "teachers");

      validationResult.success.forEach(professor => {
        const docRef = doc(teachersCollection);
        batch.set(docRef, {
          name: professor.name,
          email: professor.email,
          phone1: normalizePhone(professor.phone1),
          phone2: normalizePhone(professor.phone2),
          isActive: true,
          unitId: selectedUnitId,
          unitName: getUnitName(selectedUnitId)
        });
      });

      await batch.commit();

      toast({
        title: "Importação Concluída",
        description: `${validationResult.success.length} professores importados com sucesso.`
      });

      if (currentUser && validationResult.success.length > 0) {
        await logAction(
          AuditAction.DATA_IMPORT,
          currentUser as any,
          `Importou ${validationResult.success.length} professores em lote`,
          { count: validationResult.success.length, unitId: selectedUnitId }
        );
      }

      setIsImportModalOpen(false);
      setImportedData([]);
      setImportResult(null);
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: "Erro na Importação",
        description: "Erro ao salvar os professores no banco de dados.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  // --- FUNÇÕES PARA GERENCIAMENTO DE PROJETOS REMOVIDAS (Ver TeacherAllocationModule.tsx) ---

  // Função para baixar template Excel
  const downloadTemplate = () => {
    const templateData = [
      ['Nome Completo', 'E-mail', 'Telefone 1', 'Telefone 2'],
      ['Dr. João Silva', 'joao.silva@exemplo.com', '(11) 99999-9999', '(11) 88888-8888'],
      ['Dra. Maria Santos', 'maria.santos@exemplo.com', '(11) 77777-7777', '']
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Professores');
    XLSX.writeFile(wb, 'template_professores.xlsx');
  };


  // --- RENDERIZAÇÃO DO COMPONENTE (JSX) ---
  return (
    <PageLayout>
      {/* Seção do cabeçalho com título e botões */}
      <PageHeader className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Professores(as)</h2>
          <p className="text-muted-foreground">Cadastre e gerencie o corpo docente</p>
        </div>
        <div className="flex gap-2">
          {/* Botão para baixar template */}
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Baixar Template
          </Button>
          
          {canManageProfessors && (
            <div className="flex gap-2">
              {/* Botão para importação em massa */}
              <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar em Massa
              </Button>
              {/* Diálogo/Modal para o formulário de adicionar */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo(a) Professor(a)
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo(a) Professor(a)</DialogTitle>
                    <DialogDescription>
                      Preencha as informações do(a) professor(a)
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="prof-name">Nome Completo</Label>
                      <Input id="prof-name" value={newProfessor.name} onChange={(e) => setNewProfessor({ ...newProfessor, name: e.target.value })} placeholder="Ex: Dr. João Silva" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prof-email">E-mail</Label>
                      <Input id="prof-email" type="email" value={newProfessor.email} onChange={(e) => setNewProfessor({ ...newProfessor, email: e.target.value })} placeholder="professor@exemplo.com" />
                    </div>
                    <div className="col-span-1 md:col-span-2 bg-yellow-50 text-yellow-800 text-xs p-3 rounded border border-yellow-200">
                      A senha inicial de acesso será <strong>abcd@1234</strong>. O professor será forçado a trocá-la no primeiro acesso.
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prof-phone1">Telefone Principal (WhatsApp)</Label>
                      <Input 
                        id="prof-phone1" 
                        value={formatPhoneBR(newProfessor.phone1)} 
                        onChange={(e) => setNewProfessor({ ...newProfessor, phone1: e.target.value })} 
                        placeholder="Ex: (65) 99999-9999" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prof-phone2">Telefone Secundário (Opcional)</Label>
                      <Input 
                        id="prof-phone2" 
                        value={formatPhoneBR(newProfessor.phone2)} 
                        onChange={(e) => setNewProfessor({ ...newProfessor, phone2: e.target.value })} 
                        placeholder="Ex: (65) 98888-8888" 
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-2">
                      <Label>Disponibilidade Estrutural por Turno</Label>
                      <div className="flex gap-4 mt-1">
                        {['matutino', 'vespertino', 'noturno'].map((shift) => (
                          <label key={shift} className="flex items-center space-x-2 cursor-pointer">
                            <input 
                              type="checkbox"
                              className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                              checked={newProfessor.allowedShifts.includes(shift)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewProfessor({ ...newProfessor, allowedShifts: [...newProfessor.allowedShifts, shift] });
                                } else {
                                  setNewProfessor({ ...newProfessor, allowedShifts: newProfessor.allowedShifts.filter(s => s !== shift) });
                                }
                              }}
                            />
                            <span className="text-sm capitalize">{shift}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddProfessor} disabled={isAdding}>
                      {isAdding ? "Adicionando..." : "Adicionar Professor(a)"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </PageHeader>

      <PageContent>
      {/* Cartão com a tabela de professores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <GraduationCap className="h-5 w-5 mr-2" />
            Corpo Docente
          </CardTitle>
          <CardDescription>{professors.length} professores cadastrados</CardDescription>
        </CardHeader>
        <CardContent>
          {professors.length > 0 && (
            <div className="relative mb-6 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 h-10 w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus-visible:ring-1 focus-visible:ring-indigo-500"
              />
            </div>
          )}
          {professors.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Nenhum professor cadastrado.
            </div>
          ) : filteredProfessors.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Nenhum professor encontrado com a busca realizada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Turnos Permitidos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Alocação Macro</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Mapeia a lista de professores para criar uma linha da tabela para cada um */}
                {filteredProfessors.map(professor => {
                const pending = pendingChanges[professor.id];
                const isDeleted = pending?.type === 'delete';
                const displayData = pending ? { ...professor, ...pending.data } : professor;

                return (
                  <TableRow 
                    key={professor.id} 
                    className={`transition-colors ${
                      isDeleted ? "bg-red-50/50 opacity-60 grayscale-[0.5]" : 
                      pending ? "bg-orange-50/50" : ""
                    }`}
                  >
                    <TableCell>
                      <div className={`font-medium ${isDeleted ? "line-through text-slate-400" : ""}`}>
                        {displayData.name}
                        {pending && !isDeleted && (
                          <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-orange-100 text-orange-700 border-orange-200">Editado</Badge>
                        )}
                        {isDeleted && (
                          <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-red-100 text-red-700 border-red-200 uppercase">Removido</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-muted-foreground"><Mail className="h-3 w-3 mr-1" />{displayData.email}</div>
                        {displayData.phone1 && (<div className="flex items-center text-sm text-muted-foreground"><Phone className="h-3 w-3 mr-1" />{displayData.phone1}</div>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {displayData.allowedShifts && displayData.allowedShifts.length > 0 ? (
                          displayData.allowedShifts.map(shift => (
                             <Badge key={shift} variant="secondary" className="capitalize text-[10px] px-1.5 py-0 h-4">
                               {shift.charAt(0)}
                             </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic truncate">Não configurado</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {/* O componente Badge muda de cor baseado no status 'isActive' */}
                      <Badge variant={displayData.isActive ? "default" : "destructive"}>
                        {displayData.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedProfForAlloc(professor)}
                        className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                        disabled={isDeleted}
                      >
                        <Calendar className="h-4 w-4" /> Planejamento
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {canManageProfessors && (
                          <>
                            {/* Botão de ATIVAR/DESATIVAR - Chama a função corrigida */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleActiveStatus(professor)}
                              title={displayData.isActive ? 'Desativar Professor' : 'Ativar Professor'}
                              disabled={isSavingAll || isDeleted}
                            >
                              {/* Ícone muda dependendo do status atual */}
                              {displayData.isActive
                                ? <UserX className="h-4 w-4 text-red-500" />
                                : <UserCheck className="h-4 w-4 text-green-500" />}
                            </Button>
                            
                            {/* Botão de EDITAR */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingProfessor(displayData as Professor)}
                              title="Editar Dados"
                              disabled={isSavingAll || isDeleted}
                            >
                              <Edit className="h-4 w-4 text-blue-500" />
                            </Button>
                            
                            {/* Botão de EXCLUIR (Apenas Administradores - Perfil USER não vê) */}
                            {canDelete('professors') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteProfessor(professor.id)}
                                title="Excluir Professor"
                                className="hover:bg-red-50"
                                disabled={isSavingAll || isDeleted}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição (só aparece se 'editingProfessor' não for nulo) */}
      {editingProfessor && (
        <Dialog open={!!editingProfessor} onOpenChange={() => setEditingProfessor(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Professor(a)</DialogTitle>
              <DialogDescription>Atualize as informações do(a) professor(a)</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-prof-name">Nome Completo</Label>
                <Input id="edit-prof-name" value={editingProfessor.name} onChange={(e) => setEditingProfessor({ ...editingProfessor, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-prof-email">E-mail</Label>
                <Input id="edit-prof-email" type="email" value={editingProfessor.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-prof-phone1">Telefone 1</Label>
                <Input 
                  id="edit-prof-phone1" 
                  value={formatPhoneBR(editingProfessor.phone1)} 
                  onChange={(e) => setEditingProfessor({ ...editingProfessor, phone1: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-prof-phone2">Telefone 2</Label>
                <Input 
                  id="edit-prof-phone2" 
                  value={formatPhoneBR(editingProfessor.phone2)} 
                  onChange={(e) => setEditingProfessor({ ...editingProfessor, phone2: e.target.value })} 
                />
              </div>
              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label>Disponibilidade Estrutural por Turno</Label>
                <div className="flex gap-4 mt-1">
                  {['matutino', 'vespertino', 'noturno'].map((shift) => (
                    <label key={shift} className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                        checked={(editingProfessor.allowedShifts || []).includes(shift)}
                        onChange={(e) => {
                          const currentShifts = editingProfessor.allowedShifts || [];
                          if (e.target.checked) {
                            setEditingProfessor({ ...editingProfessor, allowedShifts: [...currentShifts, shift] });
                          } else {
                            setEditingProfessor({ ...editingProfessor, allowedShifts: currentShifts.filter(s => s !== shift) });
                          }
                        }}
                      />
                      <span className="text-sm capitalize">{shift}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProfessor(null)} disabled={isUpdating}>Cancelar</Button>
              <Button onClick={handleUpdateProfessor} disabled={isUpdating}>
                {isUpdating ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Exibição de Alocação Macro */}
      <Dialog open={!!selectedProfForAlloc} onOpenChange={() => setSelectedProfForAlloc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Planejamento Macro: {selectedProfForAlloc?.name}
            </DialogTitle>
            <DialogDescription>
              Visualização da alocação semanal baseada na carga horária contratada.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto py-4">
            {isLoadingAlloc ? (
              <div className="flex justify-center p-12">
                <Loader className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : profAllocations.length === 0 ? (
              <div className="bg-gray-50 border border-dashed rounded-lg p-12 text-center text-muted-foreground">
                Nenhuma alocação macro encontrada para este professor.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead>Turno</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead className="text-center">Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profAllocations.sort((a,b) => a.date.toMillis() - b.date.toMillis()).map((alloc) => (
                    <TableRow key={alloc.id}>
                      <TableCell className="font-medium">
                        {format(alloc.date.toDate(), "EEEE, dd/MM", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="capitalize">{alloc.shift}</TableCell>
                      <TableCell>
                        <Badge className={(allocationOptions.find(o => o.id === alloc.status)?.color) || "bg-slate-100 text-slate-800"}>
                          {allocationOptions.find(o => o.id === alloc.status)?.label || (alloc.status && alloc.status.length > 20 ? "Status Sincronizando..." : alloc.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {alloc.projectId !== 'none' ? (projects.find(p => p.id === alloc.projectId)?.name || (alloc.projectId && alloc.projectId.length > 20 ? "Projeto..." : alloc.projectId)) : "—"}
                      </TableCell>
                      <TableCell className="text-center font-bold">{alloc.hours}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setSelectedProfForAlloc(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Gerenciamento de Projetos Removido (Ver TeacherAllocationModule.tsx) */}

      {/* Modal de Importação em Massa */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importação em Massa de Professores(as)
            </DialogTitle>
            <DialogDescription>
              Importe múltiplos professores(as) através de um arquivo Excel (.xlsx)
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto">
            {/* Seção de Upload */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Selecionar Arquivo Excel</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Formatos aceitos: .xlsx, .xls
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Template
                </Button>
              </div>
            </div>

            {/* Seção de Resultados da Validação */}
            {importResult && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Resultado da Validação</h3>

                {/* Professores Válidos */}
                {importResult.success.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-800">
                        {importResult.success.length} Professores Válidos
                      </span>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      {importResult.success.map((prof, index) => (
                        <div key={index} className="text-sm text-green-700">
                          Linha {prof.row}: {prof.name} - {prof.email}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Erros */}
                {importResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <span className="font-semibold text-red-800">
                        {importResult.errors.length} Erros Encontrados
                      </span>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      {importResult.errors.map((error, index) => (
                        <div key={index} className="text-sm text-red-700">
                          Linha {error.row}: {error.error} - {error.data.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Duplicatas */}
                {importResult.duplicates.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <span className="font-semibold text-yellow-800">
                        {importResult.duplicates.length} Duplicatas Encontradas
                      </span>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      {importResult.duplicates.map((dup, index) => (
                        <div key={index} className="text-sm text-yellow-700">
                          Linha {dup.row}: {dup.email} já existe no sistema
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsImportModalOpen(false);
              setImportedData([]);
              setImportResult(null);
            }}>
              Cancelar
            </Button>
            <Button
              onClick={handleImportProfessors}
              disabled={importedData.length === 0 || isImporting}
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Professores(as)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </PageContent>

      {/* Barra de Ações Flutuante (Optimized UX) */}
      {Object.keys(pendingChanges).length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out">
          <div className="bg-white/95 backdrop-blur-md border border-indigo-100 shadow-[0_20px_50px_rgba(79,70,229,0.15)] rounded-full px-6 py-4 flex items-center gap-8 ring-1 ring-black/5">
            <div className="flex items-center gap-4 pr-8 border-r border-indigo-50">
              <div className="bg-orange-500 text-white p-2.5 rounded-full shadow-lg shadow-orange-200">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-extrabold text-slate-800 leading-none mb-1">
                  {Object.keys(pendingChanges).length} {Object.keys(pendingChanges).length === 1 ? 'alteração pendente' : 'alterações pendentes'}
                </p>
                <p className="text-[10px] text-orange-600 uppercase tracking-widest font-bold text-center">
                  cadastros rascunhados
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
                    <Loader className="h-4 w-4 animate-spin" /> Salvando...
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    Salvar no Banco <CheckCircle className="h-4 w-4 text-green-300" />
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