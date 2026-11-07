import React from "react";
import { Filter, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PartnerFiltersProps {
  isAdminOrUser: boolean;
  filterEscola: string;
  setFilterEscola: (v: string) => void;
  escolas: string[];
  filterCurso: string;
  setFilterCurso: (v: string) => void;
  cursos: string[];
  filterTurma: string;
  setFilterTurma: (v: string) => void;
  turmas: string[];
  filterAluno: string;
  setFilterAluno: (v: string) => void;
  filterRA: string;
  setFilterRA: (v: string) => void;
  filterData: string;
  setFilterData: (v: string) => void;
}

export function PartnerFilters({
  isAdminOrUser,
  filterEscola,
  setFilterEscola,
  escolas,
  filterCurso,
  setFilterCurso,
  cursos,
  filterTurma,
  setFilterTurma,
  turmas,
  filterAluno,
  setFilterAluno,
  filterRA,
  setFilterRA,
  filterData,
  setFilterData
}: PartnerFiltersProps) {
  return (
    <Card className="border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm border border-gray-100">
      <CardHeader className="pb-3 border-b bg-gray-50/50">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Filter className="h-4 w-4 text-primary" /> Painel de Filtros
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isAdminOrUser && (
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Escola</Label>
              <Select value={filterEscola} onValueChange={setFilterEscola}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Escolas</SelectItem>
                  {escolas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Curso</Label>
            <Select value={filterCurso} onValueChange={setFilterCurso}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Cursos</SelectItem>
                {cursos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Turma</Label>
            <Select value={filterTurma} onValueChange={setFilterTurma}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Turmas</SelectItem>
                {turmas.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Nome do Aluno</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar aluno..." 
                value={filterAluno} 
                onChange={(e) => setFilterAluno(e.target.value)} 
                className="pl-9 bg-white"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">RA</Label>
            <Input 
              placeholder="Filtrar por RA" 
              value={filterRA} 
              onChange={(e) => setFilterRA(e.target.value)} 
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Data da Aula</Label>
            <Input 
              type="date" 
              value={filterData} 
              onChange={(e) => setFilterData(e.target.value)} 
              className="bg-white"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
