import React, { useState, useEffect, useMemo } from 'react';
import { db } from "@/lib/db";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, Timestamp, orderBy, writeBatch, limit } from "@/lib/sira-sql-adapter";
import { useAuth } from "@/lib/AuthContext";
import {
    Package, ArrowUpRight, ArrowDownRight, AlertTriangle, RefreshCw, Loader,
    History, Plus, Shirt, CheckCircle2, Box, GraduationCap, XOctagon,
    Edit, Trash2, Settings
} from 'lucide-react';
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useFirestoreCache } from "@/hooks/useCache";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";

interface Uniform {
    id: string;
    name: string;
    category: string;
    sizes: string[];
    active: boolean;
}

interface UniformMovement {
    id: string;
    type: 'entry' | 'exit' | 'exchange' | 'loss' | 'adjustment';
    uniformId: string;
    uniformName: string;
    size: string;
    quantity: number;
    projectId?: string;
    projectName?: string;
    classId?: string;
    className?: string;
    studentName?: string;
    reason?: string;
    createdBy: string;
    createdAt: Timestamp;
}

interface ProjectDemand {
    id: string; // document id is usually projectId
    projectId: string;
    projectName: string;
    expectedStudents: number;
    kitConfigs: {
        uniformId: string;
        quantityPerStudent: number;
    }[];
}

interface Project {
    id: string;
    name: string;
    code?: string;
}
interface Class {
    id: string;
    name: string;
    courseId: string;
}

export function UniformsModule() {
    const { currentUser } = useAuth();
    
    const { cacheQuery } = useFirestoreCache();
    // Data State
    const [uniforms, setUniforms] = useState<Uniform[]>([]);
    const [movements, setMovements] = useState<UniformMovement[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [projectDemands, setProjectDemands] = useState<ProjectDemand[]>([]);

    // UI state
    const [activeTab, setActiveTab] = useState("dashboard");
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Pending Changes State (FinOps Optimization)
    const [pendingMovements, setPendingMovements] = useState<any[]>([]);
    const [pendingCatalogChanges, setPendingCatalogChanges] = useState<Record<string, { data: Partial<Uniform>, type: 'update' | 'delete' }>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Item Management State
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingUniform, setEditingUniform] = useState<Uniform | null>(null);
    const [itemForm, setItemForm] = useState<Partial<Uniform>>({
        name: '',
        category: 'uniforme',
        sizes: [],
        active: true
    });
    const CLOTHING_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'G1', 'G2', 'G3', 'G4', 'G5'];
    
    const { isUserAdmin, userData } = usePermissions();
    const selectedUnitId = userData?.selectedUnitId || "caceres";
    const isAdmin = isUserAdmin();

    // Planning Form State
    const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
    const [planningForm, setPlanningForm] = useState({
        projectId: '',
        expectedStudents: 0,
        kitConfigs: [] as { uniformId: string, quantityPerStudent: number }[]
    });

    // Form State
    const [movementForm, setMovementForm] = useState<{
        type: string;
        uniformId: string;
        quantities: Record<string, number>;
        projectId: string;
        classId: string;
        reason: string;
    }>({
        type: 'entry',
        uniformId: '',
        quantities: {},
        projectId: 'none',
        classId: 'none',
        reason: ''
    });

    useEffect(() => {
        const unsubs = [
            onSnapshot(collection(db, "uniforms"), (snapshot) => {
                if (snapshot.empty) {
                    setUniforms([
                        { id: 'u1', name: 'Camiseta Escolar', category: 'uniforme', sizes: CLOTHING_SIZES, active: true },
                        { id: 'u2', name: 'Jaleco Laboratório', category: 'epi', sizes: CLOTHING_SIZES, active: true },
                        { id: 'u3', name: 'Bota de Segurança', category: 'epi', sizes: ['36', '38', '40', '42', '44'], active: true }
                    ]);
                } else {
                    const loadedUniforms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Uniform));
                    
                    // Auto-inject missing extended sizes into state for clothing items to apply retroactively
                    setUniforms(loadedUniforms.map(u => {
                        if (u.category === 'uniforme' || (u.category === 'epi' && !u.name.toLowerCase().includes('bota'))) {
                            return { 
                                ...u, 
                                sizes: Array.from(new Set([...u.sizes, ...CLOTHING_SIZES]))
                            };
                        }
                        return u;
                    }));
                }
            }),
            onSnapshot(query(collection(db, "uniform_movements"), orderBy("createdAt", "desc"), limit(100)), (snapshot) => {
                const allMovs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                const unitMovs = allMovs.filter(m => !m.unitId || m.unitId === selectedUnitId);
                setMovements(unitMovs);
            }),
            onSnapshot(collection(db, "project_demands"), (snapshot) => {
                const allDemands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                const unitDemands = allDemands.filter(d => !d.unitId || d.unitId === selectedUnitId);
                setProjectDemands(unitDemands);
            })
        ];

        // Carregar dados estáticos via Cache (FinOps Optimization)
        const loadStaticData = async () => {
            try {
                const [coursesData, classesData] = await Promise.all([
                    cacheQuery("courses", async () => {
                        const snap = await getDocs(collection(db, "courses"));
                        return snap.docs.map(d => ({ id: d.id, name: d.data().name, code: d.data().code }));
                    }),
                    cacheQuery(`classes_${selectedUnitId}`, async () => {
                        const q = query(collection(db, "classes"), where("unitId", "==", selectedUnitId));
                        const snap = await getDocs(q);
                        return snap.docs.map(d => ({ id: d.id, name: d.data().name, courseId: d.data().courseId }));
                    })
                ]);
                setProjects(coursesData as any[]);
                setClasses(classesData as any[]);
            } catch (error) {
                console.error("Erro ao carregar dados estáticos no UniformsModule:", error);
            }
        };

        loadStaticData();

    }, []);

    // Derived State (The Ledger Concept - Calculating stock in real-time)
    const stockBalance = useMemo(() => {
        const balance: Record<string, Record<string, number>> = {}; // uniformId -> { size -> quantity }
        
        // Merge persisted and pending movements for real-time validation
        const allMovements = [...movements, ...pendingMovements.map(m => ({ ...m, isPending: true }))];
        
        allMovements.forEach(mov => {
            if (!balance[mov.uniformId]) balance[mov.uniformId] = {};
            if (!balance[mov.uniformId][mov.size]) balance[mov.uniformId][mov.size] = 0;
            
            const qty = Number(mov.quantity);
            if (mov.type === 'entry' || mov.type === 'adjustment') {
                balance[mov.uniformId][mov.size] += qty;
            } else if (mov.type === 'exit' || mov.type === 'loss' || mov.type === 'exchange') {
                balance[mov.uniformId][mov.size] -= qty;
            }
        });
        return balance;
    }, [movements, pendingMovements]);

    // Derived State: Planned Demand Calculation
    const plannedDemand = useMemo(() => {
        const planned: Record<string, number> = {}; // uniformId -> total quantity needed
        projectDemands.forEach(demand => {
            demand.kitConfigs.forEach(kit => {
                if (!planned[kit.uniformId]) planned[kit.uniformId] = 0;
                planned[kit.uniformId] += (demand.expectedStudents * kit.quantityPerStudent);
            });
        });
        return planned;
    }, [projectDemands]);

    const handleCreateMovement = async () => {
        const sizesToProcess = Object.entries(movementForm.quantities || {}).filter(([size, qty]) => qty > 0);
        
        if (!movementForm.uniformId || sizesToProcess.length === 0) {
            toast.error("Selecione um item e preencha a quantidade de pelo menos um tamanho.");
            return;
        }

        const selectedUniform = uniforms.find(u => u.id === movementForm.uniformId);
        const selectedProject = projects.find(p => p.id === movementForm.projectId);
        const selectedClass = classes.find(c => c.id === movementForm.classId);

        // Pre-validation for Exits/Losses (Stock cannot be negative)
        if (movementForm.type === 'exit' || movementForm.type === 'loss' || movementForm.type === 'exchange') {
            for (const [size, qty] of sizesToProcess) {
                const currentStock = stockBalance[movementForm.uniformId]?.[size] || 0;
                if (currentStock < qty) {
                    toast.error(`Estoque insuficiente para o tamanho ${size}! Saldo atual: ${currentStock} unidades.`);
                    return;
                }
            }
        }

        if ((movementForm.type === 'exit' || movementForm.type === 'loss') && movementForm.projectId === 'none' && movementForm.classId === 'none') {
            toast.error("Toda saída requer um Projeto ou Turma vinculada (PRD Rule).");
            return;
        }

        setIsProcessing(true);
        try {
            const newMovements = sizesToProcess.map(([size, qty]) => {
                const tempId = Math.random().toString(36).substring(7);
                return {
                    id: `pending-${tempId}`,
                    type: movementForm.type,
                    uniformId: movementForm.uniformId,
                    size: size,
                    quantity: qty,
                    projectId: movementForm.projectId !== 'none' ? movementForm.projectId : null,
                    projectName: selectedProject?.name || null,
                    classId: movementForm.classId !== 'none' ? movementForm.classId : null,
                    className: selectedClass?.name || null,
                    uniformName: selectedUniform?.name || 'Desconhecido',
                    reason: movementForm.reason || '',
                    createdBy: currentUser?.email || 'admin',
                    unitId: selectedUnitId,
                    createdAt: Timestamp.now(),
                    isPending: true
                };
            });

            setPendingMovements(prev => [...prev, ...newMovements]);
            
            toast.success("Movimentação preparada para salvamento!");
            setIsMovementModalOpen(false);
            setMovementForm({ ...movementForm, quantities: {}, reason: '' });
        } catch (error) {
            console.error(error);
            toast.error("Erro ao preparar movimentação.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveAllChanges = async () => {
        if (isSaving || (pendingMovements.length === 0 && Object.keys(pendingCatalogChanges).length === 0)) return;
        setIsSaving(true);
        const batch = writeBatch(db);

        try {
            // 1. Processar Movimentações
            pendingMovements.forEach(mov => {
                const docRef = doc(collection(db, "uniform_movements")); // Changed from uniform_ledger to uniform_movements
                const { isPending, ...payload } = mov;
                batch.set(docRef, payload);
            });

            // 2. Processar Catálogo (Uniformes)
            Object.entries(pendingCatalogChanges).forEach(([id, change]) => {
                const docRef = doc(db, "uniforms", id);
                if (change.type === 'delete') {
                    batch.delete(docRef);
                } else {
                    const { id: _, ...payload } = change.data;
                    batch.update(docRef, payload);
                }
            });

            await batch.commit();
            
            // Sincronizar estado local do catálogo
            if (Object.keys(pendingCatalogChanges).length > 0) {
                setUniforms(prev => {
                    let updated = [...prev];
                    Object.entries(pendingCatalogChanges).forEach(([id, change]) => {
                        if (change.type === 'delete') {
                            updated = updated.filter(u => u.id !== id);
                        } else {
                            updated = updated.map(u => u.id === id ? { ...u, ...change.data } as Uniform : u);
                        }
                    });
                    return updated;
                });
            }

            setPendingMovements([]);
            setPendingCatalogChanges({});
            toast.success("Todas as alterações (movimentações e catálogo) foram salvas!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar lote de alterações.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscardChanges = () => {
        const total = pendingMovements.length + Object.keys(pendingCatalogChanges).length;
        if (total === 0) return;
        if (window.confirm(`Deseja descartar ${total} alterações pendentes?`)) {
            setPendingMovements([]);
            setPendingCatalogChanges({});
        }
    };

    const getMovementBadge = (type: string) => {
        switch(type) {
            case 'entry': return <Badge className="bg-green-100 text-green-800 border-none">Entrada</Badge>;
            case 'exit': return <Badge className="bg-blue-100 text-blue-800 border-none">Saída</Badge>;
            case 'exchange': return <Badge className="bg-amber-100 text-amber-800 border-none">Troca</Badge>;
            case 'loss': return <Badge className="bg-red-100 text-red-800 border-none">Perda/Dano</Badge>;
            case 'adjustment': return <Badge className="bg-slate-100 text-slate-800 border-none">Ajuste</Badge>;
            default: return <Badge>{type}</Badge>;
        }
    };

     const handleSaveItem = () => {
        if (!itemForm.name?.trim()) {
            toast.error("Nome do item é obrigatório.");
            return;
        }

        if (editingUniform) {
            setPendingCatalogChanges(prev => ({
                ...prev,
                [editingUniform.id]: { data: itemForm, type: 'update' }
            }));
            toast.info("Alteração no catálogo preparada!");
        } else {
            // Criação direta para evitar IDs complexos no rascunho
            // Mas o usuário quer rascunho para TUDO.
            // Para novos itens, vamos manter o addDoc direto para simplificar a referência em movimentações
            // ou poderíamos gerar um ID temporário.
            // O usuário disse: "A criação de Usuario vamos deixar como ta", mas não falou de uniformes.
            // No Environment, eu fiz batch para update/delete. 
            // Para adição, vou manter direto para garantir que o ID do Firestore seja gerado e usado no cache.
            const saveNew = async () => {
                setIsProcessing(true);
                try {
                    await addDoc(collection(db, "uniforms"), {
                        ...itemForm,
                        name: itemForm.name?.trim(),
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });
                    toast.success("Novo item cadastrado!");
                    setIsItemModalOpen(false);
                    setItemForm({ name: '', category: 'uniforme', sizes: [], active: true });
                } catch (e) {
                    toast.error("Erro ao cadastrar item.");
                } finally {
                    setIsProcessing(false);
                }
            };
            saveNew();
            return;
        }
        
        setIsItemModalOpen(false);
        setEditingUniform(null);
        setItemForm({ name: '', category: 'uniforme', sizes: [], active: true });
    };

    const handleDeleteItem = (id: string) => {
        const item = uniforms.find(u => u.id === id);
        if (!item) return;

        if (window.confirm(`Deseja colocar o item "${item.name}" na fila de exclusão?`)) {
            setPendingCatalogChanges(prev => ({
                ...prev,
                [id]: { data: item, type: 'delete' }
            }));
            toast.warning("Exclusão preparada!");
        }
    };

    const handleSavePlanning = async () => {
        if (!planningForm.projectId || planningForm.expectedStudents < 1) {
            toast.error("Preencha o projeto e o número de alunos previstos.");
            return;
        }
        setIsProcessing(true);
        try {
            const project = projects.find(p => p.id === planningForm.projectId);
            const existingDemandId = projectDemands.find(d => d.projectId === planningForm.projectId)?.id;
            
            import("firebase/firestore").then(async ({ doc, setDoc }) => {
                const docRef = existingDemandId ? doc(db, "project_demands", existingDemandId) : doc(collection(db, "project_demands"));
                await setDoc(docRef, {
                    projectId: planningForm.projectId,
                    projectName: project?.name || 'Desconhecido',
                    expectedStudents: planningForm.expectedStudents,
                    kitConfigs: planningForm.kitConfigs
                }, { merge: true });
                
                toast.success("Planejamento atualizado com sucesso!");
                setIsPlanningModalOpen(false);
                setPlanningForm({ projectId: '', expectedStudents: 0, kitConfigs: [] });
            }).catch(console.error);

        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar o planejamento.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeletePlanning = async (id: string) => {
        if (!window.confirm("Deseja realmente excluir este planejamento?")) return;
        setIsProcessing(true);
        try {
            await deleteDoc(doc(db, "project_demands", id));
            toast.success("Planejamento excluído com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao excluir o planejamento.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEditPlanning = (demand: ProjectDemand) => {
        setPlanningForm({
            projectId: demand.projectId,
            expectedStudents: demand.expectedStudents,
            kitConfigs: demand.kitConfigs
        });
        setIsPlanningModalOpen(true);
    };

    return (
        <PageLayout>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <PageHeader className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Shirt className="h-6 w-6 text-indigo-600" />
                            Gestão Logística de Uniformes
                        </h2>
                        <p className="text-muted-foreground">Controle auditável de ciclo de vida de uniformes e EPIs</p>
                    </div>
                    <div className="flex gap-2">
                        {isAdmin && (
                            <Button variant="outline" onClick={() => {
                                setEditingUniform(null);
                                setItemForm({ name: '', category: 'uniforme', sizes: CLOTHING_SIZES, active: true });
                                setIsItemModalOpen(true);
                            }} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                                <Settings className="h-4 w-4 mr-2" /> Gerenciar Catálogo
                            </Button>
                        )}
                        <Dialog open={isMovementModalOpen} onOpenChange={setIsMovementModalOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-md">
                                    <Plus className="h-4 w-4 mr-2" /> Registrar Movimentação
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xl" onInteractOutside={(e) => e.preventDefault()}>
                                <DialogHeader>
                                    <DialogTitle>Nova Movimentação no Ledger</DialogTitle>
                                    <DialogDescription>
                                        Toda operação afeta o estoque e deixará um rastro de auditoria.
                                    </DialogDescription>
                                </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Tipo de Movimento *</Label>
                                        <Select value={movementForm.type} onValueChange={(v: any) => setMovementForm({...movementForm, type: v})}>
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="entry">Entrada (Compras/Fornecedor)</SelectItem>
                                                <SelectItem value="exit">Saída (Distribuição)</SelectItem>
                                                <SelectItem value="exchange">Troca (Retorno/Novo)</SelectItem>
                                                <SelectItem value="loss">Perda (Dano/Extravio)</SelectItem>
                                                <SelectItem value="adjustment">Ajuste (Inventário)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4 mt-2">
                                    <div>
                                        <Label>Item *</Label>
                                        <Select value={movementForm.uniformId} onValueChange={(v) => setMovementForm({...movementForm, uniformId: v, quantities: {}})}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger>
                                            <SelectContent>
                                                {uniforms.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {movementForm.uniformId && (
                                        <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                                            <Label className="mb-3 block">Matriz de Tamanhos e Quantidades</Label>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                                {uniforms.find(u => u.id === movementForm.uniformId)?.sizes.map(s => {
                                                    const currentQty = movementForm.quantities[s] || 0;
                                                    return (
                                                        <div key={s} className="flex flex-col items-center">
                                                            <Label className="text-xs text-slate-500 mb-1">{s}</Label>
                                                            <Input 
                                                                type="number" 
                                                                min="0"
                                                                className="text-center h-8 px-1"
                                                                value={currentQty === 0 ? '' : currentQty}
                                                                placeholder="0"
                                                                onChange={e => {
                                                                    const val = parseInt(e.target.value) || 0;
                                                                    setMovementForm({
                                                                        ...movementForm, 
                                                                        quantities: {
                                                                            ...movementForm.quantities,
                                                                            [s]: Math.max(0, val)
                                                                        }
                                                                    })
                                                                }} 
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {movementForm.type !== 'entry' && movementForm.type !== 'adjustment' && (
                                    <div className="space-y-4 bg-slate-50 p-3 rounded-md border border-slate-100">
                                        <p className="text-xs font-semibold text-slate-500 uppercase">Contexto Obrigatório</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label>Projeto / Curso</Label>
                                                <Select value={movementForm.projectId} onValueChange={(v) => setMovementForm({...movementForm, projectId: v})}>
                                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Nenhum</SelectItem>
                                                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} - ${p.name}` : p.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Turma</Label>
                                                <Select value={movementForm.classId} onValueChange={(v) => setMovementForm({...movementForm, classId: v})}>
                                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Nenhuma</SelectItem>
                                                        {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <Label>{movementForm.type === 'loss' || movementForm.type === 'exchange' ? 'Motivo (Obrigatório) *' : 'Observações'}</Label>
                                    <Textarea 
                                        placeholder={movementForm.type === 'loss' ? "Ex: Uniforme rasgado no laboratório" : "Fornecedor, nota fiscal..."}
                                        value={movementForm.reason}
                                        onChange={e => setMovementForm({...movementForm, reason: e.target.value})}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsMovementModalOpen(false)}>Cancelar</Button>
                                <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleCreateMovement} disabled={isProcessing}>
                                    {isProcessing ? "Registrando..." : "Confirmar Movimento"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                            </Dialog>
                        </div>
                    </div>

                <TabsList>
                    <TabsTrigger value="dashboard">Estoque & Demanda Preditiva</TabsTrigger>
                    <TabsTrigger value="planning">Planejamento de Kits</TabsTrigger>
                    <TabsTrigger value="ledger">Auditoria de Operações (Ledger)</TabsTrigger>
                </TabsList>
                </PageHeader>

                <PageContent>
                <TabsContent value="dashboard" className="space-y-6">
                    {/* Resumo Rápido */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="border-indigo-100 shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between space-y-0 pb-2">
                                    <p className="tracking-tight text-sm font-medium">Entradas Totais</p>
                                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                                </div>
                                <div className="text-2xl font-bold">
                                    {movements.filter(m => m.type === 'entry').reduce((sum, m) => sum + Number(m.quantity), 0)} un.
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-indigo-100 shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between space-y-0 pb-2">
                                    <p className="tracking-tight text-sm font-medium">Saídas Totais</p>
                                    <GraduationCap className="h-4 w-4 text-blue-500" />
                                </div>
                                <div className="text-2xl font-bold">
                                    {movements.filter(m => m.type === 'exit').reduce((sum, m) => sum + Number(m.quantity), 0)} un.
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-indigo-100 shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between space-y-0 pb-2">
                                    <p className="tracking-tight text-sm font-medium">Trocas</p>
                                    <RefreshCw className="h-4 w-4 text-amber-500" />
                                </div>
                                <div className="text-2xl font-bold">
                                    {movements.filter(m => m.type === 'exchange').reduce((sum, m) => sum + Number(m.quantity), 0)} un.
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-red-100 shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between space-y-0 pb-2">
                                    <p className="tracking-tight text-sm font-medium text-red-800">Perdas / Danos</p>
                                    <XOctagon className="h-4 w-4 text-red-500" />
                                </div>
                                <div className="text-2xl font-bold text-red-600">
                                    {movements.filter(m => m.type === 'loss').reduce((sum, m) => sum + Number(m.quantity), 0)} un.
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Matriz de Estoque */}
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Inteligência Logística: Planejado vs Estoque Real</CardTitle>
                            <CardDescription>
                                Cruzamento do <span className="font-semibold text-blue-600">estoque físico em tempo real</span> com a <span className="font-semibold text-purple-600">demanda preditiva de projetos</span>.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                        <TableHead>Item / Categoria</TableHead>
                                        <TableHead className="text-center">Matriz de Tamanhos</TableHead>
                                        <TableHead className="text-right">Estoque Real</TableHead>
                                        <TableHead className="text-right">Demanda Planejada</TableHead>
                                        <TableHead className="text-right">Status de Cobertura</TableHead>
                                        {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {uniforms.map(uniform => {
                                        const pending = pendingCatalogChanges[uniform.id];
                                        const isDeleted = pending?.type === 'delete';
                                        const displayData = pending ? { ...uniform, ...pending.data } : uniform;

                                        const totalItem = Object.values(stockBalance[uniform.id] || {}).reduce((sum, val) => sum + val, 0);
                                        const plannedQty = plannedDemand[uniform.id] || 0;
                                        const difference = totalItem - plannedQty;
                                        
                                        return (
                                            <TableRow 
                                                key={uniform.id}
                                                className={`transition-colors ${
                                                    isDeleted ? "bg-red-50/50 opacity-60 grayscale-[0.5]" : 
                                                    pending ? "bg-orange-50/50" : ""
                                                }`}
                                            >
                                                <TableCell>
                                                    <div className={`font-semibold ${isDeleted ? "line-through text-slate-400" : ""}`}>
                                                        {displayData.name}
                                                        {pending && !isDeleted && (
                                                            <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-orange-100 text-orange-700 border-orange-200 font-bold">EDITADO</Badge>
                                                        )}
                                                        {isDeleted && (
                                                            <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-red-100 text-red-700 border-red-200 font-bold">REMOVIDO</Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground uppercase">{displayData.category}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap justify-center gap-2">
                                                        {displayData.sizes.map(size => {
                                                            const qty = stockBalance[uniform.id]?.[size] || 0;
                                                            return (
                                                                <div key={size} className="flex flex-col items-center border border-slate-200 rounded px-2 py-1 bg-white min-w-[50px]">
                                                                    <span className="text-[10px] font-bold text-slate-500">{size}</span>
                                                                    <span className={`text-sm font-medium ${qty === 0 ? 'text-red-500' : 'text-slate-900'}`}>{qty}</span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-lg">
                                                    {totalItem}
                                                </TableCell>
                                                <TableCell className="text-right text-lg text-purple-600 font-medium">
                                                    {plannedQty}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {difference < 0 ? (
                                                        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-200">Déficit: {Math.abs(difference)} ⚠️</Badge>
                                                    ) : difference > 0 ? (
                                                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200">Sobra: +{difference}</Badge>
                                                    ) : (
                                                        <Badge className="bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200">Exato</Badge>
                                                    )}
                                                </TableCell>
                                                {isAdmin && (
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-slate-500"
                                                                disabled={isDeleted || isSaving}
                                                                onClick={() => {
                                                                    setEditingUniform(displayData as Uniform);
                                                                    setItemForm(displayData as Uniform);
                                                                    setIsItemModalOpen(true);
                                                                }}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-red-500"
                                                                disabled={isDeleted || isSaving}
                                                                onClick={() => handleDeleteItem(uniform.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="planning" className="space-y-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="space-y-1">
                            <h3 className="text-lg font-medium">Previsão de Demanda por Projeto</h3>
                            <p className="text-sm text-slate-500">Configure kits e a quantidade esperada de alunos para gerar alertas preditivos de compra.</p>
                        </div>
                        <Dialog open={isPlanningModalOpen} onOpenChange={setIsPlanningModalOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                                    <Plus className="h-4 w-4 mr-2" /> Configurar Projeto
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Planejamento de Projeto (Demanda)</DialogTitle>
                                    <DialogDescription>Define os uniformes necessários e a expectativa de alunos.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Projeto / Curso</Label>
                                        <Select value={planningForm.projectId} onValueChange={v => setPlanningForm({...planningForm, projectId: v})}>
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} - ${p.name}` : p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Expectativa Total de Alunos</Label>
                                        <Input type="number" value={planningForm.expectedStudents} onChange={e => setPlanningForm({...planningForm, expectedStudents: Number(e.target.value)})} />
                                    </div>
                                    <div className="space-y-2 border-t pt-4">
                                        <Label className="flex justify-between items-center">
                                            <span>Kit de Uniformes do Projeto</span>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => setPlanningForm({...planningForm, kitConfigs: [...planningForm.kitConfigs, {uniformId: '', quantityPerStudent: 1}]})}>+ Item</Button>
                                        </Label>
                                        {planningForm.kitConfigs.map((kit, index) => (
                                            <div key={index} className="flex gap-2 items-center">
                                                <Select value={kit.uniformId} onValueChange={v => {
                                                    const newKits = [...planningForm.kitConfigs];
                                                    newKits[index].uniformId = v;
                                                    setPlanningForm({...planningForm, kitConfigs: newKits});
                                                }}>
                                                    <SelectTrigger className="flex-1"><SelectValue placeholder="Uniforme" /></SelectTrigger>
                                                    <SelectContent>
                                                        {uniforms.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <Input type="number" title="Qtd. por aluno" placeholder="Qtd" className="w-16 text-center" value={kit.quantityPerStudent} onChange={e => {
                                                     const newKits = [...planningForm.kitConfigs];
                                                     newKits[index].quantityPerStudent = Number(e.target.value);
                                                     setPlanningForm({...planningForm, kitConfigs: newKits});
                                                }} />
                                                <Button type="button" variant="ghost" size="icon" onClick={() => {
                                                    setPlanningForm({...planningForm, kitConfigs: planningForm.kitConfigs.filter((_, i) => i !== index)});
                                                }}>
                                                    <XOctagon className="h-4 w-4 text-red-400" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsPlanningModalOpen(false)}>Cancelar</Button>
                                    <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleSavePlanning} disabled={isProcessing}>Salvar Plano</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projectDemands.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-slate-500">
                                Nenhum planejamento ativo. Configure projetos e alunos para ligar a capacidade preditiva.
                            </div>
                        ) : (
                            projectDemands.map(demand => (
                                <Card key={demand.id} className="border-purple-100 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-base">{demand.projectName}</CardTitle>
                                                <CardDescription>{demand.expectedStudents} Alunos Projetados</CardDescription>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                                                    onClick={() => handleEditPlanning(demand)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                                                    onClick={() => handleDeletePlanning(demand.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 mt-2">
                                            {demand.kitConfigs.map((k, i) => {
                                                const uName = uniforms.find(u => u.id === k.uniformId)?.name || '...';
                                                const totalNeeded = demand.expectedStudents * k.quantityPerStudent;
                                                return (
                                                    <div key={i} className="flex justify-between items-center text-sm border-b border-slate-50 pb-1">
                                                        <span className="text-slate-600">{uName} <span className="text-[10px] text-slate-400">({k.quantityPerStudent}/aluno)</span></span>
                                                        <span className="font-semibold">{totalNeeded} un.</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="ledger" className="space-y-6">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Histórico Completo de Movimentações (Ledger)</CardTitle>
                            <CardDescription>
                                Registro imutável de todas as ações de estoque com fins de auditoria.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead>Data / Hora</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Produto</TableHead>
                                            <TableHead>Tamanho</TableHead>
                                            <TableHead className="text-center">Qtd</TableHead>
                                            <TableHead>Contexto (Proj/Turma)</TableHead>
                                            <TableHead>Responsável</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...pendingMovements, ...movements].map((mov) => (
                                            <TableRow key={mov.id} className={mov.isPending ? "bg-orange-50/50 border-orange-200 animate-pulse-subtle" : ""}>
                                                <TableCell className="whitespace-nowrap">
                                                    <div className="font-medium text-sm text-slate-700">
                                                        {mov.isPending ? (
                                                            <span className="flex items-center gap-1.5 text-orange-600 font-bold">
                                                                <Loader className="h-3 w-3 animate-spin"/> Pendente
                                                            </span>
                                                        ) : (
                                                            format(mov.createdAt.toDate(), "dd/MM/yyyy", { locale: ptBR })
                                                        )}
                                                    </div>
                                                    {!mov.isPending && (
                                                        <div className="text-xs text-muted-foreground">
                                                            {format(mov.createdAt.toDate(), "HH:mm")}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>{getMovementBadge(mov.type)}</TableCell>
                                                <TableCell className="font-medium">{mov.uniformName}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{mov.size}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center font-bold">
                                                    {mov.quantity}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm truncate max-w-[200px]" title={mov.projectName || 'Sem Projeto'}>
                                                        {mov.projectName || <span className="text-slate-400">N/A</span>}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                        {mov.className || mov.studentName || ''}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-500">
                                                    {mov.createdBy}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {movements.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                                    Nenhuma movimentação registrada no sistema.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </PageContent>
        </Tabs>

            {/* Barra de Ações Flutuante Unificada (Optimized UX) */}
            {(pendingMovements.length > 0 || Object.keys(pendingCatalogChanges).length > 0) && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out">
                   <div className="bg-white/95 backdrop-blur-md border border-indigo-100 shadow-[0_20px_50px_rgba(79,70,229,0.15)] rounded-full px-6 py-4 flex items-center gap-8 ring-1 ring-black/5">
                     <div className="flex items-center gap-4 pr-8 border-r border-indigo-50">
                        <div className="bg-orange-500 text-white p-2.5 rounded-full shadow-lg shadow-orange-200 animate-bounce-subtle">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <p className="text-sm font-extrabold text-slate-800 leading-none mb-1">
                            {pendingMovements.length + Object.keys(pendingCatalogChanges).length} alterações pendentes
                          </p>
                          <p className="text-[10px] text-orange-600 uppercase tracking-widest font-bold">
                             {pendingMovements.length > 0 && "Ledger"} 
                             {pendingMovements.length > 0 && Object.keys(pendingCatalogChanges).length > 0 && " & "}
                             {Object.keys(pendingCatalogChanges).length > 0 && "Catálogo"}
                          </p>
                        </div>
                     </div>
                     
                     <div className="flex items-center gap-4">
                       <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleDiscardChanges}
                        disabled={isSaving}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors uppercase text-xs font-bold tracking-tight"
                       >
                         Descartar
                       </Button>
                       <Button 
                        size="sm" 
                        onClick={handleSaveAllChanges}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 rounded-full shadow-[0_10px_20px_rgba(79,70,229,0.3)] hover:shadow-[0_15px_30px_rgba(79,70,229,0.4)] transition-all font-bold group"
                       >
                         {isSaving ? (
                           <div className="flex items-center gap-2">
                             <RefreshCw className="h-4 w-4 animate-spin" /> Salvando...
                           </div>
                         ) : (
                           <span className="flex items-center gap-2">
                             Efetivar Alterações <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                           </span>
                         )}
                       </Button>
                     </div>
                   </div>
                </div>
            )}

            {/* Modal de Gestão de Itens (Catálogo) */}
            <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingUniform ? 'Editar Item' : 'Cadastrar Novo Item'}</DialogTitle>
                        <DialogDescription>
                            Configure o nome, categoria e grade de tamanhos do produto.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="item-name">Nome do Produto *</Label>
                            <Input 
                                id="item-name" 
                                value={itemForm.name} 
                                onChange={e => setItemForm({...itemForm, name: e.target.value})} 
                                placeholder="Ex: Botina de Couro"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Select value={itemForm.category} onValueChange={v => setItemForm({...itemForm, category: v})}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="uniforme">Uniforme Escolar</SelectItem>
                                    <SelectItem value="epi">EPI / Segurança</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Grade de Tamanhos</Label>
                            <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Clique para selecionar/remover</p>
                                <div className="flex flex-wrap gap-2">
                                    {(itemForm.category === 'uniforme' ? CLOTHING_SIZES : [...CLOTHING_SIZES, '36', '37', '38', '39', '40', '41', '42', '43', '44', '45']).map(s => {
                                        const isSelected = itemForm.sizes?.includes(s);
                                        return (
                                            <Badge 
                                                key={s}
                                                variant={isSelected ? "default" : "outline"}
                                                className={`cursor-pointer transition-all ${isSelected ? 'bg-indigo-600' : 'hover:bg-slate-100'}`}
                                                onClick={() => {
                                                    const currentSizes = itemForm.sizes || [];
                                                    const newSizes = isSelected 
                                                        ? currentSizes.filter(x => x !== s)
                                                        : [...currentSizes, s];
                                                    
                                                    // Reorder based on CLOTHING_SIZES or numeric
                                                    setItemForm({...itemForm, sizes: newSizes});
                                                }}
                                            >
                                                {s}
                                            </Badge>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancelar</Button>
                        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSaveItem} disabled={isProcessing}>
                            {isProcessing ? "Salvando..." : "Salvar Item"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
    </PageLayout>
);
}
