import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

import { Loader2, BrainCircuit, CheckCircle2, AlertCircle, BookOpen, Layers, Download } from "lucide-react";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { 
  getCourses, getCurricularUnits, getCapabilities, getKnowledges,
  Course, CurricularUnit, Capability, Knowledge
} from '@/services/coursePlanService';
import { useToast } from "@/components/ui/use-toast";
import { buildProfessorPlanningPrompt, buildTeachingPlanTable } from "@/services/eduPlanPromptService";

export function EduPlanAITestModule() {
  const { toast } = useToast();
  
  // Data states
  const [courses, setCourses] = useState<Course[]>([]);
  const [ucs, setUcs] = useState<CurricularUnit[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [knowledgesMap, setKnowledgesMap] = useState<Record<string, Knowledge[]>>({});
  
  // Selection states
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [isCourseOpen, setIsCourseOpen] = useState(false);
  const [selectedUc, setSelectedUc] = useState<string>("");

  // Loading states
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [planningTable, setPlanningTable] = useState<any>(null);

  // Initial load
  useEffect(() => {
    const fetchInitial = async () => {
      setIsLoadingData(true);
      const data = await getCourses();
      setCourses(data);
      setIsLoadingData(false);
    };
    fetchInitial();
  }, []);

  const handleCourseChange = async (courseId: string) => {
    setSelectedCourse(courseId);
    setSelectedUc("");
    setCapabilities([]);
    setKnowledgesMap({});
    setAiSuggestions(null);
    setGeneratedPrompt("");
    setPlanningTable(null);
    
    setIsLoadingData(true);
    const data = await getCurricularUnits(courseId);
    setUcs(data);
    setIsLoadingData(false);
  };

  const handleUcChange = async (ucId: string) => {
    setSelectedUc(ucId);
    setAiSuggestions(null);
    setGeneratedPrompt("");
    setPlanningTable(null);

    setIsLoadingData(true);
    const caps = await getCapabilities(ucId);
    setCapabilities(caps);

    const kMap: Record<string, Knowledge[]> = {};
    await Promise.all(
      caps.map(async (cap) => {
        if (cap.id) {
          kMap[cap.id] = await getKnowledges(cap.id);
        }
      })
    );
    setKnowledgesMap(kMap);
    setIsLoadingData(false);
  };

  const selectedCourseData = courses.find((course) => course.id === selectedCourse) || null;
  const selectedUcData = ucs.find((uc) => uc.id === selectedUc) || null;

  const handleTriggerAI = () => {
    if (!selectedCourse || !selectedUc) {
      toast({ title: "Atenção", description: "Selecione o curso e a unidade curricular antes de gerar o planejamento.", variant: "destructive" });
      return;
    }

    if (!selectedUcData) {
      toast({ title: "Atenção", description: "Nenhuma UC selecionada para gerar o planejamento.", variant: "destructive" });
      return;
    }

    const prompt = buildProfessorPlanningPrompt({
      course: selectedCourseData,
      uc: selectedUcData,
      capabilities,
      knowledgesMap,
    });

    const table = buildTeachingPlanTable({
      course: selectedCourseData,
      uc: selectedUcData,
      capabilities,
      knowledgesMap,
    });

    setGeneratedPrompt(prompt);
    setPlanningTable(table);
    setIsAiLoading(true);
    setAiSuggestions({
      blocks: table.blocks,
      totalHours: table.totalHours,
      strategy: "Aprendizagem Baseada em Projetos (PBL)",
      message: "O plano foi estruturado em blocos e já pode ser visualizado e exportado para Excel.",
      prompt,
      table,
    });
    setIsAiLoading(false);
  };

  const handleExportExcel = () => {
    if (!planningTable || !selectedCourseData) {
      toast({ title: "Atenção", description: "Gere o plano antes de exportar o arquivo Excel.", variant: "destructive" });
      return;
    }

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Plano de Ensino', ''],
      ['Curso', selectedCourseData?.name || ''],
      ['UC', selectedUcData?.name || ''],
      ['Carga horária total', `${selectedUcData?.workload || 0}h`],
      ['Blocos', planningTable.blocks],
      [],
      ['Bloco', 'Categoria', 'Descrição'],
      ...planningTable.rows.map((row: any) => [row.bloco, row.categoria, row.descricao]),
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plano de Ensino');
    XLSX.writeFile(workbook, `plano_ensino_${selectedUcData?.name || 'uc'}.xlsx`);
  };

  return (
    <PageLayout>
      <PageHeader className="space-y-4">
        <Card className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md border-0">
          <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <BrainCircuit className="h-8 w-8 text-emerald-100" />
                <h2 className="text-3xl font-bold mb-2">EduPlan AI (Planejamento)</h2>
              </div>
              <p className="text-emerald-50 text-lg">
                Selecione sua disciplina e utilize a IA para gerar estratégias de aula.
              </p>
            </div>
            <div className="bg-white/10 p-3 rounded-lg border border-white/20 backdrop-blur-sm max-w-xs">
              <div className="flex items-start gap-2 text-sm text-emerald-50">
                <AlertCircle className="h-5 w-5 shrink-0 text-emerald-200" />
                <p>A IA atua apenas como <strong>orquestradora</strong>, consumindo os dados do Plano de Curso oficial.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageHeader>

      <PageContent className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Seletor de Curso */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                1. Selecione o Curso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Popover open={isCourseOpen} onOpenChange={setIsCourseOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isCourseOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedCourse
                      ? courses.find((course) => course.id === selectedCourse)?.name
                      : "Buscar e selecionar curso..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Digite para buscar um curso..." />
                    <CommandList>
                      <CommandEmpty>Nenhum curso encontrado.</CommandEmpty>
                      <CommandGroup>
                        {courses.map((course) => (
                          <CommandItem
                            key={course.id}
                            value={course.name}
                            onSelect={() => {
                              handleCourseChange(course.id || '');
                              setIsCourseOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCourse === course.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {course.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          {/* Seletor de UC */}
          <Card className={!selectedCourse ? 'opacity-50 pointer-events-none' : ''}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-600" />
                2. Selecione a Unidade Curricular
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedUc} onValueChange={handleUcChange} disabled={!selectedCourse}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={isLoadingData ? "Carregando..." : "Selecione a UC..."} />
                </SelectTrigger>
                <SelectContent>
                  {ucs.map(uc => (
                    <SelectItem key={uc.id} value={uc.id || ''}>{uc.name} ({uc.workload}h)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {isLoadingData && (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        )}

        {/* Tabela de Capacidades */}
        {selectedUc && !isLoadingData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Esquerda: A Matriz */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layers className="h-5 w-5 text-emerald-600" />
                    3. Base de Capacidades e Conhecimentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {capabilities.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      Nenhuma capacidade cadastrada para esta UC no Plano de Curso oficial.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Capacidade Oficial</TableHead>
                          <TableHead>Conhecimentos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {capabilities.map(cap => {
                          const kList = cap.id ? knowledgesMap[cap.id] || [] : [];
                          return (
                            <TableRow key={cap.id}>
                              <TableCell>
                                <Badge variant={cap.type === 'Básica' ? 'secondary' : 'default'} className={cap.type === 'Básica' ? 'bg-slate-200 text-slate-800' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}>
                                  {cap.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">{cap.description}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {kList.length > 0 ? (
                                  <ul className="list-disc pl-4 space-y-1">
                                    {kList.map(k => (
                                      <li key={k.id}>{k.description}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Sem conhecimentos atrelados.</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Direita: O Copilot AI */}
            <div className="space-y-4">
              <Card className="border-emerald-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -z-10" />
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-emerald-600" />
                    Assistente EduPlan
                  </CardTitle>
                  <CardDescription>
                    Peça à IA para distribuir a carga horária ({ucs.find(u => u.id === selectedUc)?.workload}h) e sugerir estratégias baseadas nos conhecimentos ao lado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={handleTriggerAI} 
                    disabled={isAiLoading || !selectedCourse || !selectedUc}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isAiLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando Modelos...
                      </>
                    ) : (
                      <>
                        <BrainCircuit className="mr-2 h-4 w-4" />
                        Gerar Estratégia de Aula (IA)
                      </>
                    )}
                  </Button>

                  {aiSuggestions && (
                    <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-4">
                      <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-emerald-900">Plano Gerado!</p>
                            <p className="text-sm text-emerald-700 mt-1">{aiSuggestions.message}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-white border rounded-lg text-center">
                          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Blocos de Aula</p>
                          <p className="text-2xl font-black text-slate-800">{aiSuggestions.blocks}</p>
                        </div>
                        <div className="p-3 bg-white border rounded-lg text-center">
                          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Carga Horária</p>
                          <p className="text-2xl font-black text-slate-800">{aiSuggestions.totalHours}h</p>
                        </div>
                      </div>

                      <div className="p-3 bg-white border rounded-lg">
                         <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Metodologia Recomendada</p>
                         <Badge variant="outline" className="bg-slate-50">{aiSuggestions.strategy}</Badge>
                      </div>

                      <Button
                        onClick={handleExportExcel}
                        variant="outline"
                        className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar tabela para Excel
                      </Button>

                      <div className="p-3 bg-white border rounded-lg">
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Tabela visual do plano</p>
                        <div className="max-h-72 overflow-auto rounded-md border bg-slate-50 p-2">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-20">Bloco</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Descrição</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {planningTable?.rows?.map((row: any) => (
                                <TableRow key={`${row.bloco}-${row.categoria}`}>
                                  <TableCell className="font-semibold">{row.bloco}</TableCell>
                                  <TableCell>{row.categoria}</TableCell>
                                  <TableCell className="text-xs text-slate-700">{row.descricao}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      <div className="p-3 bg-white border rounded-lg">
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Prompt gerado para IA</p>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950 p-3 text-xs text-emerald-100">{generatedPrompt}</pre>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
