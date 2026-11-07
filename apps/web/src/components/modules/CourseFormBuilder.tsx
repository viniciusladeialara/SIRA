import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Layers, BookOpen, Library, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FormUC, FormCapability, FormKnowledge, CoursePlanTree } from '@/services/coursePlanService';
import { useToast } from "@/hooks/use-toast";

// Interfaces for the Course Data
export interface CourseGeneralData {
  id?: string;
  name: string;
  code?: string;
  duration?: number;
  workload?: number;
  description?: string;
}

interface CourseFormBuilderProps {
  initialCourseData?: CourseGeneralData;
  initialTreeData?: CoursePlanTree;
  onSave: (courseData: CourseGeneralData, treeData: CoursePlanTree) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export function CourseFormBuilder({ initialCourseData, initialTreeData, onSave, onCancel, isSaving }: CourseFormBuilderProps) {
  const { toast } = useToast();
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelAlert, setShowCancelAlert] = useState(false);
  const [showDraftAlert, setShowDraftAlert] = useState(false);
  
  // General Course Data State
  const [courseData, setCourseData] = useState<CourseGeneralData>({
    name: '',
    code: '',
    duration: undefined,
    workload: undefined,
    description: '',
    ...initialCourseData
  });

  // Tree Data State
  const [ucs, setUcs] = useState<FormUC[]>(initialTreeData?.ucs || []);

  const draftKey = `draft_course_${initialCourseData?.id || 'new'}`;

  // Check for existing drafts on mount
  useEffect(() => {
    const draft = localStorage.getItem(draftKey);
    if (draft && !initialCourseData?.id) { // Only prompt for drafts on "New Course" to avoid overriding fetched real data, or we can do it for both if timestamps are checked. For simplicity, do it if draft exists.
      try {
        const parsed = JSON.parse(draft);
        if (parsed.courseData?.name || (parsed.ucs && parsed.ucs.length > 0)) {
           setShowDraftAlert(true);
        }
      } catch (e) {
        // Invalid draft
        localStorage.removeItem(draftKey);
      }
    }
  }, [draftKey]);

  const restoreDraft = () => {
    try {
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.courseData) setCourseData(parsed.courseData);
        if (parsed.ucs) setUcs(parsed.ucs);
        setIsDirty(true);
        toast({ title: "Rascunho Restaurado", description: "O progresso anterior foi recuperado com sucesso." });
      }
    } catch(e) {}
    setShowDraftAlert(false);
  };

  const discardDraft = () => {
    localStorage.removeItem(draftKey);
    setShowDraftAlert(false);
  };

  // Auto-save to localStorage
  useEffect(() => {
    if (isDirty) {
      const timer = setTimeout(() => {
        localStorage.setItem(draftKey, JSON.stringify({ courseData, ucs }));
      }, 1000); // 1s debounce
      return () => clearTimeout(timer);
    }
  }, [courseData, ucs, isDirty, draftKey]);

  // Window beforeunload lock
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Make sure to set dirty on any initial load changes
  useEffect(() => {
    if (initialCourseData && !isDirty) {
      setCourseData({
        name: '',
        code: '',
        duration: undefined,
        workload: undefined,
        description: '',
        ...initialCourseData
      });
    }
  }, [initialCourseData]);

  useEffect(() => {
    if (initialTreeData && !isDirty) {
      setUcs(initialTreeData.ucs);
    }
  }, [initialTreeData]);

  // --- Handlers wrapping state changes to mark dirty ---
  const updateCourseData = (updater: Partial<CourseGeneralData>) => {
    setCourseData(prev => ({ ...prev, ...updater }));
    setIsDirty(true);
  };

  // --- Helpers for Tree Manipulation ---
  const generateTempId = () => `temp_${Math.random().toString(36).substr(2, 9)}`;

  // UC Actions
  const addUc = () => {
    setUcs([...ucs, { id: generateTempId(), name: '', workload: 0, capabilities: [] }]);
    setIsDirty(true);
  };
  
  const updateUc = (index: number, field: keyof FormUC, value: any) => {
    const newUcs = [...ucs];
    newUcs[index] = { ...newUcs[index], [field]: value };
    setUcs(newUcs);
    setIsDirty(true);
  };
  
  const removeUc = (index: number) => {
    const newUcs = [...ucs];
    if (newUcs[index].id?.startsWith('temp_')) {
      newUcs.splice(index, 1);
    } else {
      newUcs[index].isDeleted = true;
    }
    setUcs(newUcs);
    setIsDirty(true);
  };

  // Capability Actions
  const addCapability = (ucIndex: number) => {
    const newUcs = [...ucs];
    newUcs[ucIndex].capabilities.push({ id: generateTempId(), type: 'Técnica', description: '', knowledges: [] });
    setUcs(newUcs);
    setIsDirty(true);
  };

  const updateCapability = (ucIndex: number, capIndex: number, field: keyof FormCapability, value: any) => {
    const newUcs = [...ucs];
    newUcs[ucIndex].capabilities[capIndex] = { ...newUcs[ucIndex].capabilities[capIndex], [field]: value };
    setUcs(newUcs);
    setIsDirty(true);
  };

  const removeCapability = (ucIndex: number, capIndex: number) => {
    const newUcs = [...ucs];
    const cap = newUcs[ucIndex].capabilities[capIndex];
    if (cap.id?.startsWith('temp_')) {
      newUcs[ucIndex].capabilities.splice(capIndex, 1);
    } else {
      newUcs[ucIndex].capabilities[capIndex].isDeleted = true;
    }
    setUcs(newUcs);
    setIsDirty(true);
  };

  // Knowledge Actions
  const addKnowledge = (ucIndex: number, capIndex: number) => {
    const newUcs = [...ucs];
    newUcs[ucIndex].capabilities[capIndex].knowledges.push({ id: generateTempId(), description: '' });
    setUcs(newUcs);
    setIsDirty(true);
  };

  const updateKnowledge = (ucIndex: number, capIndex: number, knowIndex: number, value: string) => {
    const newUcs = [...ucs];
    newUcs[ucIndex].capabilities[capIndex].knowledges[knowIndex].description = value;
    setUcs(newUcs);
    setIsDirty(true);
  };

  const removeKnowledge = (ucIndex: number, capIndex: number, knowIndex: number) => {
    const newUcs = [...ucs];
    const know = newUcs[ucIndex].capabilities[capIndex].knowledges[knowIndex];
    if (know.id?.startsWith('temp_')) {
      newUcs[ucIndex].capabilities[capIndex].knowledges.splice(knowIndex, 1);
    } else {
      newUcs[ucIndex].capabilities[capIndex].knowledges[knowIndex].isDeleted = true;
    }
    setUcs(newUcs);
    setIsDirty(true);
  };

  const handleSave = async () => {
    await onSave(courseData, { ucs });
    // On success, clean draft
    localStorage.removeItem(draftKey);
    setIsDirty(false);
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setShowCancelAlert(true);
    } else {
      onCancel();
    }
  };

  const confirmCancel = () => {
    setShowCancelAlert(false);
    onCancel();
  };

  return (
    <div className="flex flex-col h-full max-h-[90vh]">
      <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-2 border-b flex justify-between items-end">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Dados Gerais
            </TabsTrigger>
            <TabsTrigger value="plan" className="flex items-center gap-2">
              <Library className="h-4 w-4" />
              Plano de Curso
            </TabsTrigger>
          </TabsList>
          {isDirty && (
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Save className="h-3 w-3" />
              Rascunho salvo localmente
            </div>
          )}
        </div>

        {/* DADOS GERAIS */}
        <TabsContent value="general" className="flex-1 overflow-y-auto p-6 m-0 focus-visible:outline-none focus-visible:ring-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="space-y-2">
              <Label htmlFor="course-name">Nome do Curso <span className="text-destructive">*</span></Label>
              <Input
                id="course-name"
                value={courseData.name}
                onChange={(e) => updateCourseData({ name: e.target.value })}
                placeholder="Ex: Técnico em Eletrotécnica"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="course-code">Projeto / Código</Label>
              <Input
                id="course-code"
                value={courseData.code}
                onChange={(e) => updateCourseData({ code: e.target.value })}
                placeholder="Ex: SETASC"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="course-duration">Duração (Semestres)</Label>
              <Input
                id="course-duration"
                type="number"
                value={courseData.duration || ''}
                onChange={(e) => updateCourseData({ duration: parseInt(e.target.value) || undefined })}
                placeholder="Ex: 4"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="course-workload">Carga Horária Total (h)</Label>
              <Input
                id="course-workload"
                type="number"
                value={courseData.workload || ''}
                onChange={(e) => updateCourseData({ workload: parseInt(e.target.value) || undefined })}
                placeholder="Ex: 1200"
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="course-description">Descrição do Curso</Label>
              <Textarea
                id="course-description"
                value={courseData.description}
                onChange={(e) => updateCourseData({ description: e.target.value })}
                placeholder="Detalhes sobre o curso..."
                rows={4}
              />
            </div>
          </div>
        </TabsContent>

        
        {/* PLANO DE CURSO */}
        <TabsContent value="plan" className="flex-1 overflow-y-auto p-6 m-0 bg-white focus-visible:outline-none focus-visible:ring-0">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Estrutura Curricular</h3>
                <p className="text-sm text-slate-500">Unidades Curriculares, Capacidades e Conhecimentos exigidos.</p>
              </div>
              <Button onClick={addUc} variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar UC
              </Button>
            </div>

            <div className="space-y-6">
              {ucs.map((uc, ucIndex) => {
                if (uc.isDeleted) return null;
                return (
                  <div key={uc.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 shadow-sm">
                    {/* UC Header */}
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center mb-4 pb-4 border-b border-slate-200">
                      <div className="flex-1 w-full flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                          UC
                        </div>
                        <Input 
                          placeholder="Nome da Unidade Curricular" 
                          value={uc.name} 
                          onChange={(e) => updateUc(ucIndex, 'name', e.target.value)}
                          className="font-semibold bg-white border-slate-200 focus-visible:ring-blue-500 text-base"
                        />
                      </div>
                      <div className="w-32 flex items-center gap-2">
                        <span className="text-sm text-slate-500 font-medium">C.H.</span>
                        <Input 
                          type="number" 
                          placeholder="(h)" 
                          value={uc.workload || ''} 
                          onChange={(e) => updateUc(ucIndex, 'workload', parseInt(e.target.value) || 0)}
                          className="bg-white focus-visible:ring-blue-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 font-medium" onClick={() => addCapability(ucIndex)}>
                          <Plus className="h-4 w-4 mr-1" /> Capacidade
                        </Button>
                        <Button size="icon" variant="ghost" className="text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeUc(ucIndex)} title="Remover UC">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Capabilities List */}
                    <div className="pl-4 md:pl-11 space-y-4">
                      {uc.capabilities.filter(c => !c.isDeleted).length === 0 ? (
                        <p className="text-sm text-slate-400 italic">Nenhuma capacidade adicionada.</p>
                      ) : (
                        uc.capabilities.map((cap, capIndex) => {
                          if (cap.isDeleted) return null;
                          return (
                            <div key={cap.id} className="relative pl-6 border-l-2 border-slate-200 py-2">
                              {/* Connector line dot */}
                              <div className="absolute -left-[5px] top-4 w-2 h-2 rounded-full bg-slate-300"></div>
                              
                              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                                <Select value={cap.type} onValueChange={(v: any) => updateCapability(ucIndex, capIndex, 'type', v)}>
                                  <SelectTrigger className="w-[110px] shrink-0 bg-white border-slate-200 h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Básica">Básica</SelectItem>
                                    <SelectItem value="Técnica">Técnica</SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                <Input 
                                  placeholder="Descrição da Capacidade" 
                                  value={cap.description} 
                                  onChange={(e) => updateCapability(ucIndex, capIndex, 'description', e.target.value)}
                                  className="flex-1 bg-white h-9"
                                />
                                
                                <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => removeCapability(ucIndex, capIndex)} title="Remover Capacidade">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              {/* Knowledges List */}
                              <div className="mt-3 pl-4 space-y-2">
                                {cap.knowledges.filter(k => !k.isDeleted).length > 0 && (
                                  <div className="space-y-2 mb-2">
                                    {cap.knowledges.map((know, knowIndex) => {
                                      if (know.isDeleted) return null;
                                      return (
                                        <div key={know.id} className="flex gap-2 items-center group">
                                          <div className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                                          <Input 
                                            placeholder="Descrição do Conhecimento" 
                                            value={know.description}
                                            onChange={(e) => updateKnowledge(ucIndex, capIndex, knowIndex, e.target.value)}
                                            className="h-8 text-sm bg-white shadow-sm border-slate-200 focus-visible:ring-1 focus-visible:border-blue-500"
                                          />
                                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all" onClick={() => removeKnowledge(ucIndex, capIndex, knowIndex)} title="Remover Conhecimento">
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => addKnowledge(ucIndex, capIndex)}>
                                  <Plus className="h-3 w-3 mr-1" /> Adicionar Conhecimento
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* FOOTER DA PÁGINA/MODAL */}
      <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 mt-auto">
        <Button variant="outline" onClick={handleCancelClick} disabled={isSaving} className="bg-white">
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !courseData.name} className="shadow-sm">
          {isSaving ? "Salvando..." : "Salvar Curso"}
        </Button>
      </div>

      {/* Alerta de Rascunho */}
      <AlertDialog open={showDraftAlert} onOpenChange={setShowDraftAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rascunho Encontrado</AlertDialogTitle>
            <AlertDialogDescription>
              Identificamos um planejamento anterior que não foi salvo no banco de dados. Deseja recuperar essas informações ou descartá-las?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={discardDraft}>Descartar</AlertDialogCancel>
            <AlertDialogAction onClick={restoreDraft} className="bg-blue-600 hover:bg-blue-700">Recuperar Rascunho</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alerta de Cancelamento */}
      <AlertDialog open={showCancelAlert} onOpenChange={setShowCancelAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você fez modificações que ainda não foram salvas. Se sair agora, elas ficarão armazenadas apenas no rascunho local, mas não estarão disponíveis para o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar Editando</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-red-600 hover:bg-red-700">
              Sair mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
