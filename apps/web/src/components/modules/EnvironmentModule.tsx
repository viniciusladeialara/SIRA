import React, { useState, useEffect } from "react";
// Importa a nossa instância do Firestore (db) e as funções necessárias
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";

// --- Componentes de UI ---
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Plus, Edit, Trash2, Monitor, Users, Wifi, Filter, Search, Settings, X, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestoreCache } from "@/hooks/useCache";
import { usePermissions } from "@/hooks/usePermissions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { DynamicCreatableSelect } from "@/components/modules/DynamicCreatableSelect";
import { getUnitName } from "@/lib/utils";

// --- Tipagem ---
interface Environment {
  id: string;
  name: string;
  type: string;
  capacity: number;
  block: string;
  floor: string;
  available: boolean;
  unitId?: string;
  unitName?: string;
}

// --- Componente Principal ---
export function EnvironmentModule() {
  // --- Estados do Componente ---
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [newEnvironment, setNewEnvironment] = useState({ name: '', type: '', capacity: 0, block: '', floor: '' });
  const [editingEnvironment, setEditingEnvironment] = useState<Environment | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draftBlockLabel, setDraftBlockLabel] = useState("");
  const [draftFloorLabel, setDraftFloorLabel] = useState("");
  const [draftBlocks, setDraftBlocks] = useState<string[]>([]);
  const [draftFloors, setDraftFloors] = useState<string[]>([]);
  const [draftRoomTypes, setDraftRoomTypes] = useState<string[]>([]);
  const [draftShifts, setDraftShifts] = useState<string[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // Pending Changes State (FinOps Optimization)
  const [pendingChanges, setPendingChanges] = useState<Record<string, { data: Partial<Environment>, type: 'update' | 'delete' }>>({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<string>("all");
  const { toast } = useToast();
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

  useEffect(() => {
    if (isSettingsOpen && unitMetadata) {
      setDraftBlockLabel(unitMetadata.blockLabel || "Bloco");
      setDraftFloorLabel(unitMetadata.floorLabel || "Andar");
      setDraftBlocks([...(unitMetadata.blocks || ["A", "B", "C", "D"])]);
      setDraftFloors([...(unitMetadata.floors || ["Térreo", "1º Andar"])]);
      setDraftRoomTypes([...(unitMetadata.roomTypes || ["Sala de Aula", "Laboratório", "Auditório"])]);
      setDraftShifts([...(unitMetadata.shifts || ["Matutino", "Vespertino", "Noturno"])]);
    }
  }, [isSettingsOpen, unitMetadata]);

  // Dados dinâmicos para os formulários obtidos do banco com fallbacks
  const environmentTypes = unitMetadata?.roomTypes || ['Sala de Aula', 'Laboratório', 'Auditório', 'Biblioteca', 'Outro'];
  const blocks = unitMetadata?.blocks || ['A', 'B', 'C', 'D'];
  const floors = unitMetadata?.floors || ['Térreo', '1º', '2º', '3º'];

  const blockLabel = unitMetadata?.blockLabel || "Bloco";
  const floorLabel = unitMetadata?.floorLabel || "Andar";

  const { cacheQuery } = useFirestoreCache();

  // Escuta os ambientes da unidade selecionada
  useEffect(() => {
    const fetchEnvironments = async () => {
      try {
        const data = await cacheQuery(`rooms_${selectedUnitId}`, async () => {
          const q = query(collection(db, "rooms"), where("unitId", "==", selectedUnitId));
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Environment));
        });
        setEnvironments(data);
      } catch (error) {
        console.error("Erro ao carregar ambientes:", error);
        toast({ title: "Erro", description: "Não foi possível carregar os ambientes.", variant: "destructive" });
      }
    };

    fetchEnvironments();
  }, [toast, cacheQuery, selectedUnitId]);

  const filteredEnvironments = environments.filter(env => 
    (env.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (env.type || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Funções CRUD (Create, Read, Update, Delete) ---

  const handleAddEnvironment = async () => {
    if (isAdding) return;
    if (!newEnvironment.name || !newEnvironment.type || !newEnvironment.block) {
      toast({ title: "Erro", description: "Nome, tipo e bloco são obrigatórios", variant: "destructive" });
      return;
    }
    setIsAdding(true);
    try {
      // Verifica se já existe um ambiente com o mesmo nome na mesma unidade
      const q = query(collection(db, "rooms"), where("name", "==", newEnvironment.name), where("unitId", "==", selectedUnitId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        toast({ title: "Erro", description: "Já existe um ambiente com este nome nesta unidade.", variant: "destructive" });
        setIsAdding(false);
        return;
      }

      // Adiciona um novo documento à coleção 'rooms' (apenas físico; itens são geridos em Ativos)
      await addDoc(collection(db, "rooms"), {
        name: newEnvironment.name.trim(),
        type: newEnvironment.type.trim(),
        capacity: Number(newEnvironment.capacity) || 0,
        block: newEnvironment.block.trim(),
        floor: newEnvironment.floor.trim(),
        items: [],
        available: true,
        unitId: selectedUnitId,
        unitName: getUnitName(selectedUnitId),
        createdAt: serverTimestamp()
      });

      setNewEnvironment({ name: '', type: '', capacity: 0, block: '', floor: '' });
      toast({ title: "Sucesso", description: "Ambiente cadastrado com sucesso!" });
    } catch (error) {
      console.error("Erro ao adicionar ambiente: ", error);
      toast({ title: "Erro", description: "Não foi possível adicionar o ambiente", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteEnvironment = (id: string) => {
    if (!window.confirm("Tem a certeza que deseja excluir este ambiente? A exclusão só será efetivada após salvar as pendências.")) return;
    
    const env = environments.find(e => e.id === id);
    if (!env) return;

    setPendingChanges(prev => ({
      ...prev,
      [id]: { data: env, type: 'delete' }
    }));
    toast({ title: "Exclusão preparada!", description: "Salve para efetivar no banco de dados." });
  };
  
  const handleStartEdit = (env: Environment) => {
    setEditingEnvironment({ ...env });
  };

  const handleUpdateEnvironment = () => {
    if (!editingEnvironment) return;
    if (!editingEnvironment.name || !editingEnvironment.type || !editingEnvironment.block) {
      toast({ title: "Erro", description: "Nome, tipo e bloco são obrigatórios", variant: "destructive" });
      return;
    }

    const payload = {
      ...editingEnvironment,
      capacity: Number(editingEnvironment.capacity) || 0
    };

    setPendingChanges(prev => ({
      ...prev,
      [editingEnvironment.id]: { data: payload, type: 'update' }
    }));
    
    setEditingEnvironment(null);
    toast({ title: "Alteração preparada!" });
  };

  const handleSaveAllChanges = async () => {
    if (isSavingAll || Object.keys(pendingChanges).length === 0) return;
    setIsSavingAll(true);
    const batch = writeBatch(db);

    try {
      Object.entries(pendingChanges).forEach(([id, change]) => {
        const docRef = doc(db, "rooms", id);
        if (change.type === 'delete') {
          batch.delete(docRef);
        } else {
          const { id: _, ...payload } = change.data;
          batch.update(docRef, payload);
        }
      });
      await batch.commit();

      // Sincronizar estado local
      setEnvironments(prev => {
        let updated = [...prev];
        Object.entries(pendingChanges).forEach(([id, change]) => {
            if (change.type === 'delete') {
                updated = updated.filter(e => e.id !== id);
            } else {
                updated = updated.map(e => e.id === id ? { ...e, ...change.data } as Environment : e);
            }
        });
        return updated;
      });

      setPendingChanges({});
      toast({ title: "Sucesso!", description: "Sincronização com o banco de dados concluída." });
    } catch (error) {
      console.error("Erro ao salvar lote de ambientes: ", error);
      toast({ title: "Erro", description: "Não foi possível salvar as alterações.", variant: "destructive" });
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const unitRef = doc(db, "units", selectedUnitId);
      const updatedMetadata = {
        ...unitMetadata,
        blockLabel: draftBlockLabel.trim(),
        floorLabel: draftFloorLabel.trim(),
        blocks: draftBlocks,
        floors: draftFloors,
        roomTypes: draftRoomTypes,
        shifts: draftShifts
      };
      await updateDoc(unitRef, { metadata: updatedMetadata });
      toast({ title: "Sucesso", description: "Configurações da unidade salvas com sucesso!" });
      setIsSettingsOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar metadados da unidade:", err);
      toast({ title: "Erro", description: "Erro ao salvar configurações no banco de dados.", variant: "destructive" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDiscardChanges = () => {
    if (Object.keys(pendingChanges).length === 0) return;
    if (window.confirm("Deseja descartar as alterações pendentes?")) {
      setPendingChanges({});
    }
  };

  const handleUndoPendingChange = (id: string) => {
    setPendingChanges(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    toast({ title: "Alteração desfeita", description: "O item retornou ao estado original." });
  };
  
  // Função para mudar a disponibilidade (Refatorada para Frontend-First)
  const toggleAvailability = (id: string, currentStatus: boolean) => {
    const env = environments.find(e => e.id === id);
    if (!env) return;

    const currentPending = pendingChanges[id];
    const baseData = currentPending ? { ...env, ...currentPending.data } : env;

    setPendingChanges(prev => ({
      ...prev,
      [id]: { 
        data: { ...baseData, available: !baseData.available }, 
        type: 'update' 
      }
    }));

    toast({ title: "Status alterado!", description: "A alteração será efetivada ao salvar as pendências." });
  };
  
  // Funções auxiliares para a UI
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Laboratório': return <Monitor className="h-4 w-4" />;
      case 'Auditório': return <Users className="h-4 w-4" />;
      default: return <MapPin className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Laboratório': return 'bg-blue-100 text-blue-800';
      case 'Auditório': return 'bg-purple-100 text-purple-800';
      case 'Sala de Aula': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // --- RENDERIZAÇÃO DO COMPONENTE (JSX) ---
  return (
    <PageLayout>
       {/* Cabeçalho e Botão de Adicionar */}
      <PageHeader className="space-y-6">
        <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Ambientes</h2>
          <p className="text-muted-foreground">Gerencie salas, laboratórios e outros espaços</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botão Configurações da Unidade */}
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                <Settings className="h-4 w-4 mr-2" />
                Configurar Unidade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-indigo-950">
                  <Settings className="h-5 w-5 text-indigo-600" />
                  Configurar Termos e Opções da Unidade
                </DialogTitle>
                <DialogDescription>
                  Ajuste a nomenclatura e as opções de seleção do sistema. As alterações serão salvas em massa de uma só vez.
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4 space-y-6">
                {/* Nomenclatura */}
                <div className="space-y-4 border-b pb-4">
                  <h3 className="font-semibold text-sm text-slate-800 uppercase tracking-wider">Nomenclatura Personalizada</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="block-label">Termo para Bloco/Prédio</Label>
                      <Input
                        id="block-label"
                        value={draftBlockLabel}
                        onChange={(e) => setDraftBlockLabel(e.target.value)}
                        placeholder="Ex: Bloco, Prédio, Setor..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="floor-label">Termo para Andar/Piso</Label>
                      <Input
                        id="floor-label"
                        value={draftFloorLabel}
                        onChange={(e) => setDraftFloorLabel(e.target.value)}
                        placeholder="Ex: Andar, Piso, Nível..."
                      />
                    </div>
                  </div>
                </div>

                {/* Listas de Opções */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-slate-800 uppercase tracking-wider">Listas de Valores</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Blocos */}
                    <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 border rounded-lg">
                      <Label className="font-bold text-xs text-slate-600 capitalize">{draftBlockLabel}s Disponíveis</Label>
                      <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-slate-950 border rounded min-h-[60px]">
                        {draftBlocks.map(item => (
                          <Badge key={item} variant="secondary" className="flex items-center gap-1">
                            {item}
                            <button onClick={() => setDraftBlocks(prev => prev.filter(x => x !== item))} className="text-muted-foreground hover:text-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder={`Adicionar ${draftBlockLabel}...`}
                          className="h-8 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val && !draftBlocks.includes(val)) {
                                setDraftBlocks(prev => [...prev, val]);
                                e.currentTarget.value = '';
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Andares */}
                    <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 border rounded-lg">
                      <Label className="font-bold text-xs text-slate-600 capitalize">{draftFloorLabel}es Disponíveis</Label>
                      <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-slate-950 border rounded min-h-[60px]">
                        {draftFloors.map(item => (
                          <Badge key={item} variant="secondary" className="flex items-center gap-1">
                            {item}
                            <button onClick={() => setDraftFloors(prev => prev.filter(x => x !== item))} className="text-muted-foreground hover:text-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder={`Adicionar ${draftFloorLabel}...`}
                          className="h-8 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val && !draftFloors.includes(val)) {
                                setDraftFloors(prev => [...prev, val]);
                                e.currentTarget.value = '';
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Tipos de Ambientes */}
                    <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 border rounded-lg">
                      <Label className="font-bold text-xs text-slate-600">Tipos de Ambientes</Label>
                      <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-slate-950 border rounded min-h-[60px]">
                        {draftRoomTypes.map(item => (
                          <Badge key={item} variant="secondary" className="flex items-center gap-1">
                            {item}
                            <button onClick={() => setDraftRoomTypes(prev => prev.filter(x => x !== item))} className="text-muted-foreground hover:text-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Adicionar tipo..."
                          className="h-8 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val && !draftRoomTypes.includes(val)) {
                                setDraftRoomTypes(prev => [...prev, val]);
                                e.currentTarget.value = '';
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Turnos */}
                    <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900 border rounded-lg">
                      <Label className="font-bold text-xs text-slate-600">Turnos Letivos</Label>
                      <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-slate-950 border rounded min-h-[60px]">
                        {draftShifts.map(item => (
                          <Badge key={item} variant="secondary" className="flex items-center gap-1">
                            {item}
                            <button onClick={() => setDraftShifts(prev => prev.filter(x => x !== item))} className="text-muted-foreground hover:text-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Adicionar turno..."
                          className="h-8 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val && !draftShifts.includes(val)) {
                                setDraftShifts(prev => [...prev, val]);
                                e.currentTarget.value = '';
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic mt-2">Dica: Escreva o nome no campo de input e pressione <b>Enter</b> para adicionar à lista.</p>
                </div>
              </div>

              <DialogFooter className="border-t pt-4">
                <Button variant="outline" onClick={() => setIsSettingsOpen(false)} disabled={isSavingSettings}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                  {isSavingSettings && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar Configurações
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                <Plus className="h-4 w-4 mr-2" />
                Novo Ambiente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-indigo-950">
                  <MapPin className="h-5 w-5 text-indigo-600" />
                  Cadastrar Novo Ambiente
                </DialogTitle>
                <DialogDescription>
                  Informe os dados físicos do ambiente (capacidade, bloco e andar). Os equipamentos e ferramentas são gerenciados na Gestão de Ativos.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="env-name" className="text-xs font-bold text-slate-800">Nome do Ambiente *</Label>
                    <Input
                      id="env-name"
                      value={newEnvironment.name}
                      onChange={(e) => setNewEnvironment({...newEnvironment, name: e.target.value})}
                      placeholder="Ex: Sala 5, Lab Informática 2..."
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-2 flex flex-col justify-end">
                    <Label htmlFor="env-type" className="text-xs font-bold text-slate-800">Tipo de Ambiente *</Label>
                    <DynamicCreatableSelect
                      value={newEnvironment.type}
                      onValueChange={(val) => setNewEnvironment({...newEnvironment, type: val})}
                      options={environmentTypes}
                      placeholder="Selecione um tipo"
                      unitId={selectedUnitId}
                      metadataKey="roomTypes"
                      label="Tipo de Ambiente"
                    />
                  </div>
                  <div className="space-y-2 flex flex-col justify-end">
                    <Label htmlFor="env-block" className="text-xs font-bold text-slate-800">{blockLabel} *</Label>
                    <DynamicCreatableSelect
                      value={newEnvironment.block}
                      onValueChange={(val) => setNewEnvironment({...newEnvironment, block: val})}
                      options={blocks}
                      placeholder={`Selecione um ${blockLabel.toLowerCase()}`}
                      unitId={selectedUnitId}
                      metadataKey="blocks"
                      label={blockLabel}
                    />
                  </div>
                  <div className="space-y-2 flex flex-col justify-end">
                    <Label htmlFor="env-floor" className="text-xs font-bold text-slate-800">{floorLabel}</Label>
                    <DynamicCreatableSelect
                      value={newEnvironment.floor}
                      onValueChange={(val) => setNewEnvironment({...newEnvironment, floor: val})}
                      options={floors}
                      placeholder={`Selecione um ${floorLabel.toLowerCase()}`}
                      unitId={selectedUnitId}
                      metadataKey="floors"
                      label={floorLabel}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="env-capacity" className="text-xs font-bold text-slate-800">Capacidade de Alunos (Lugares)</Label>
                    <Input
                      id="env-capacity"
                      type="number"
                      value={newEnvironment.capacity}
                      onChange={(e) => setNewEnvironment({...newEnvironment, capacity: parseInt(e.target.value) || 0})}
                      placeholder="Ex: 40"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t pt-4">
                <Button onClick={handleAddEnvironment} disabled={isAdding} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {isAdding ? "Cadastrando..." : "Cadastrar Ambiente"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Ambientes</p>
                    <p className="text-2xl font-bold">{environments.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-accent/10 p-2 rounded-lg">
                    <Users className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Capacidade Total</p>
                    <p className="text-2xl font-bold">
                      {environments.reduce((total, e) => total + e.capacity, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-warning/10 p-2 rounded-lg">
                    <Wifi className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Disponíveis</p>
                    <p className="text-2xl font-bold">
                      {environments.filter(e => e.available).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Filtros e Organização */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Tabs value={selectedBlock} onValueChange={setSelectedBlock} className="w-full max-w-xl">
              <TabsList className="flex flex-wrap h-auto p-1 bg-muted/50 border justify-start w-full gap-1">
                <TabsTrigger value="all" className="py-2 text-xs md:text-sm">Todos</TabsTrigger>
                {blocks.map(block => (
                  <TabsTrigger key={block} value={block} className="py-2 text-xs md:text-sm">
                    {blockLabel} {block}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
              <Filter className="h-4 w-4" />
              <span>Mostrando: <b>{selectedBlock === "all" ? `Todos os ${blockLabel}s` : `${blockLabel} ${selectedBlock}`}</b></span>
            </div>
          </div>
        </>
      </PageHeader>

      {/* Conteúdo Principal */}
      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Ambientes Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {environments.length > 0 && (
              <div className="relative mb-6 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <Input
                  placeholder="Buscar por nome ou tipo do ambiente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 h-10 w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus-visible:ring-1 focus-visible:ring-indigo-500"
                />
              </div>
            )}
            {environments.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Nenhum ambiente cadastrado.
              </div>
            ) : filteredEnvironments.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Nenhum ambiente encontrado com a busca realizada.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ambiente</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Capacidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedBlock === "all" ? (
                    blocks.map(block => {
                      const blockEnvs = (filteredEnvironments || []).filter(e => e.block === block);
                    if (blockEnvs.length === 0) return null;
                    return (
                      <React.Fragment key={block}>
                        <TableRow className="bg-muted/30 hover:bg-muted/30 border-y-2 border-slate-100">
                          <TableCell colSpan={5} className="py-3 font-extrabold text-xs text-indigo-600 uppercase tracking-widest bg-slate-50/50">
                            {blockLabel} {block} — {blockEnvs.length} ambiente(s)
                          </TableCell>
                        </TableRow>
                        {blockEnvs.map(env => {
                          const pending = pendingChanges[env.id];
                          const isDeleted = pending?.type === 'delete';
                          const displayData = pending ? { ...env, ...pending.data } : env;

                          return (
                            <TableRow 
                              key={env.id} 
                              className={`transition-colors duration-200 ${
                                isDeleted ? "bg-red-50/50 opacity-60 grayscale-[0.5]" : 
                                pending ? "bg-orange-50/50" : ""
                              }`}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center space-x-3">
                                  <div className="bg-slate-100 p-2 rounded-lg text-slate-500">
                                    {getTypeIcon(displayData.type)}
                                  </div>
                                  <div>
                                    <div className={`font-semibold text-slate-700 ${isDeleted ? "line-through text-slate-400" : ""}`}>
                                      {displayData.name}
                                      {pending && !isDeleted && (
                                        <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-orange-100 text-orange-700 border-orange-200">Editado</Badge>
                                      )}
                                      {isDeleted && (
                                        <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-red-100 text-red-700 border-red-200 uppercase">Removido</Badge>
                                      )}
                                    </div>
                                    <Badge className={`text-[10px] h-4 mt-1 font-bold tracking-tight uppercase ${getTypeColor(displayData.type)}`}>
                                      {displayData.type}
                                    </Badge>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-slate-600">
                                  <span className="font-medium">{blockLabel} {displayData.block}</span>
                                  {displayData.floor && <span className="text-slate-400"> • {displayData.floor}</span>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center text-sm font-medium text-slate-700">
                                  <Users className="h-4 w-4 mr-1.5 text-slate-400" />
                                  {displayData.capacity} lugares
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline" 
                                  className={`text-[11px] font-bold px-2 py-0.5 border ${
                                    displayData.available 
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                      : "bg-red-50 text-red-700 border-red-200"
                                  }`}
                                >
                                  {displayData.available ? "Ativo" : "Inativo"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end space-x-1">
                                  {isDeleted ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUndoPendingChange(env.id)}
                                      className="text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-bold"
                                    >
                                      Desfazer
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleStartEdit(displayData)}
                                        className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteEnvironment(env.id)}
                                        className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                ) : (
                  (filteredEnvironments || [])
                    .filter(e => selectedBlock === "all" || e.block === selectedBlock)
                    .map(env => {
                      const pending = pendingChanges[env.id];
                      const isDeleted = pending?.type === 'delete';
                      const displayData = pending ? { ...env, ...pending.data } : env;

                      return (
                        <TableRow 
                          key={env.id} 
                          className={`transition-colors duration-200 ${
                            isDeleted ? "bg-red-50/50 opacity-60 grayscale-[0.5]" : 
                            pending ? "bg-orange-50/50" : ""
                          }`}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-3">
                              <div className="bg-slate-100 p-2 rounded-lg text-slate-500">
                                {getTypeIcon(displayData.type)}
                              </div>
                              <div>
                                <div className={`font-semibold text-slate-700 ${isDeleted ? "line-through text-slate-400" : ""}`}>
                                  {displayData.name}
                                  {pending && !isDeleted && (
                                    <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-orange-100 text-orange-700 border-orange-200">Editado</Badge>
                                  )}
                                  {isDeleted && (
                                    <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-red-100 text-red-700 border-red-200 uppercase">Removido</Badge>
                                  )}
                                </div>
                                <Badge className={`text-[10px] h-4 mt-1 font-bold tracking-tight uppercase ${getTypeColor(displayData.type)}`}>
                                  {displayData.type}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-slate-600">
                              <span className="font-medium">{blockLabel} {displayData.block}</span>
                              {displayData.floor && <span className="text-slate-400"> • {displayData.floor}</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm font-medium text-slate-700">
                              <Users className="h-4 w-4 mr-1.5 text-slate-400" />
                              {displayData.capacity} lugares
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`text-[11px] font-bold px-2 py-0.5 border ${
                                displayData.available 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              {displayData.available ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-1">
                              {isDeleted ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUndoPendingChange(env.id)}
                                  className="text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-bold"
                                >
                                  Desfazer
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleStartEdit(displayData)}
                                    className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteEnvironment(env.id)}
                                    className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição */}
      {editingEnvironment && (
        <Dialog open={!!editingEnvironment} onOpenChange={(open) => !open && setEditingEnvironment(null)}>
          <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-indigo-950">
                <Edit className="h-5 w-5 text-indigo-600" />
                Editar Ambiente
              </DialogTitle>
              <DialogDescription>
                Atualize os dados físicos deste ambiente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-env-name" className="text-xs font-bold text-slate-800">Nome do Ambiente *</Label>
                  <Input
                    id="edit-env-name"
                    value={editingEnvironment.name}
                    onChange={(e) => setEditingEnvironment({
                      ...editingEnvironment, 
                      name: e.target.value
                    })}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <Label htmlFor="edit-env-type" className="text-xs font-bold text-slate-800">Tipo de Ambiente *</Label>
                  <DynamicCreatableSelect
                    value={editingEnvironment.type}
                    onValueChange={(val) => setEditingEnvironment({
                      ...editingEnvironment, 
                      type: val
                    })}
                    options={environmentTypes}
                    unitId={selectedUnitId}
                    metadataKey="roomTypes"
                    label="Tipo de Ambiente"
                  />
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <Label htmlFor="edit-env-block" className="text-xs font-bold text-slate-800">{blockLabel} *</Label>
                  <DynamicCreatableSelect
                    value={editingEnvironment.block}
                    onValueChange={(val) => setEditingEnvironment({
                      ...editingEnvironment, 
                      block: val
                    })}
                    options={blocks}
                    unitId={selectedUnitId}
                    metadataKey="blocks"
                    label={blockLabel}
                  />
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <Label htmlFor="edit-env-floor" className="text-xs font-bold text-slate-800">{floorLabel}</Label>
                  <DynamicCreatableSelect
                    value={editingEnvironment.floor}
                    onValueChange={(val) => setEditingEnvironment({
                      ...editingEnvironment, 
                      floor: val
                    })}
                    options={floors}
                    unitId={selectedUnitId}
                    metadataKey="floors"
                    label={floorLabel}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-env-capacity" className="text-xs font-bold text-slate-800">Capacidade de Alunos</Label>
                  <Input
                    id="edit-env-capacity"
                    type="number"
                    value={editingEnvironment.capacity}
                    onChange={(e) => setEditingEnvironment({
                      ...editingEnvironment, 
                      capacity: parseInt(e.target.value) || 0
                    })}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-env-available" className="text-xs font-bold text-slate-800">Status de Disponibilidade</Label>
                  <select
                    id="edit-env-available"
                    value={editingEnvironment.available ? "true" : "false"}
                    onChange={(e) => setEditingEnvironment({
                      ...editingEnvironment,
                      available: e.target.value === "true"
                    })}
                    className="w-full h-9 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-3 font-semibold text-slate-700"
                  >
                    <option value="true">Ativo / Disponível</option>
                    <option value="false">Inativo / Indisponível</option>
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setEditingEnvironment(null)} disabled={isUpdating}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateEnvironment} disabled={isUpdating} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
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
                  ambientes rascunhados
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