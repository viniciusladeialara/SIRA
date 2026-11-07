import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Building2, MapPin } from "lucide-react";

interface School {
  id: string;
  name: string;
  city: string;
  active: boolean;
  isDeleting?: boolean;
}

interface SchoolManagementProps {
  schoolsList: School[];
  isAddingSchool: boolean;
  setIsAddingSchool: (v: boolean) => void;
  newSchool: { name: string; city: string };
  setNewSchool: (v: any) => void;
  handleAddSchool: () => void;
  handleDeleteSchool: (id: string) => void;
  isAdding?: boolean;
  isDeleting?: boolean;
}

export function SchoolManagement({
  schoolsList,
  isAddingSchool,
  setIsAddingSchool,
  newSchool,
  setNewSchool,
  handleAddSchool,
  handleDeleteSchool,
  isAdding,
  isDeleting
}: SchoolManagementProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Escolas Cadastradas</h2>
          <p className="text-sm text-muted-foreground">Gerencie as unidades parceiras do sistema.</p>
        </div>
        {!isAddingSchool && (
          <Button onClick={() => setIsAddingSchool(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Escola
          </Button>
        )}
      </div>

      {isAddingSchool && (
        <Card className="animate-in slide-in-from-top-2">
          <CardHeader>
            <CardTitle>Adicionar Nova Escola</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Escola</Label>
                <Input 
                  value={newSchool.name} 
                  onChange={(e) => setNewSchool({...newSchool, name: e.target.value})}
                  placeholder="Ex: SENAI Caceres"
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input 
                  value={newSchool.city} 
                  onChange={(e) => setNewSchool({...newSchool, city: e.target.value})}
                  placeholder="Ex: Caceres"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddingSchool(false)} disabled={isAdding}>Cancelar</Button>
              <Button onClick={handleAddSchool} disabled={isAdding}>
                {isAdding ? "Salvando..." : "Salvar Escola"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schoolsList.map((school) => (
          <Card 
            key={school.id} 
            className={`hover:shadow-md transition-all duration-300 ${
              school.isDeleting ? "bg-red-50/50 border-red-200 opacity-60 grayscale-[0.5]" : ""
            }`}
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className={`flex items-center gap-2 ${school.isDeleting ? "text-red-500" : "text-primary"}`}>
                    <Building2 className="h-5 w-5" />
                    <h3 className={`font-bold ${school.isDeleting ? "line-through" : ""}`}>{school.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{school.city}</span>
                  </div>
                  {school.isDeleting && (
                    <div className="text-[10px] font-bold text-red-600 uppercase tracking-tighter bg-red-100 px-2 py-0.5 rounded-full inline-block">
                      Exclusão Pendente
                    </div>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`${school.isDeleting ? "text-slate-400" : "text-rose-500 hover:text-rose-600 hover:bg-rose-50"}`} 
                  onClick={() => handleDeleteSchool(school.id)}
                  disabled={isDeleting || school.isDeleting}
                >
                  {isDeleting ? "..." : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
