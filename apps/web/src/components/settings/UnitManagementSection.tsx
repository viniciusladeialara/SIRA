import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/apiService';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Unit {
  id: string;
  name: string;
  code?: string;
  createdAt?: any;
}

export const UnitManagementSection: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitId, setNewUnitId] = useState('');
  const [newUnitCode, setNewUnitCode] = useState('');

  const loadUnits = async () => {
    try {
      setLoading(true);
      const data = await apiService.request('/api/units');
      setUnits(data || []);
    } catch (error) {
      console.error("Erro ao carregar unidades da API:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/senai\s*/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  };

  const handleNameChange = (name: string) => {
    setNewUnitName(name);
    if (!newUnitId || newUnitId === generateSlug(newUnitName)) {
      setNewUnitId(generateSlug(name));
    }
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim() || !newUnitId.trim()) {
      toast({ title: "Erro", description: "Preencha o nome e ID da unidade.", variant: "destructive" });
      return;
    }

    const cleanId = newUnitId.trim().toLowerCase();

    setIsSaving(true);
    try {
      await apiService.request('/api/units', {
        method: 'POST',
        body: JSON.stringify({
          id: cleanId,
          code: (newUnitCode || cleanId.substring(0, 3)).toUpperCase(),
          name: newUnitName.trim()
        })
      });

      toast({
        title: "Unidade Criada com Sucesso!",
        description: `Unidade ${newUnitName} registrada no PostgreSQL.`
      });

      setNewUnitName('');
      setNewUnitId('');
      setNewUnitCode('');
      setIsOpen(false);
      loadUnits();
    } catch (err: any) {
      console.error("Erro ao cadastrar unidade:", err);
      toast({ title: "Erro ao Salvar", description: err.message || "Falha ao criar unidade.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUnit = async (unit: Unit) => {
    if (!window.confirm(`Tem certeza que deseja excluir a unidade "${unit.name}" (${unit.id})?`)) return;
    try {
      await apiService.request(`/api/units/${unit.id}`, { method: 'DELETE' });
      toast({ title: "Sucesso", description: `Unidade ${unit.name} excluída.` });
      loadUnits();
    } catch (err: any) {
      console.error("Erro ao excluir unidade:", err);
      toast({ title: "Erro ao Excluir", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-slate-900 dark:to-slate-950">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Gestão de Unidades SENAI
                <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 text-xs">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Super Admin
                </Badge>
              </CardTitle>
              <CardDescription className="mt-0.5">
                Cadastre e parametrize as unidades operacionais da instituição ({units.length} cadastradas).
              </CardDescription>
            </div>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" />
                Nova Unidade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Cadastrar Nova Unidade SENAI</DialogTitle>
                <DialogDescription>
                  Adicione uma nova unidade regional ao sistema para liberar o módulo Multi-Tenant.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateUnit} className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="unit-name">Nome Exibido da Unidade</Label>
                  <Input
                    id="unit-name"
                    value={newUnitName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ex: SENAI Várzea Grande"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="unit-id">ID de Sistema (Slug)</Label>
                    <Input
                      id="unit-id"
                      value={newUnitId}
                      onChange={(e) => setNewUnitId(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                      placeholder="Ex: varzea-grande"
                      required
                    />
                    <p className="text-[10px] text-slate-500">Identificador único de banco.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="unit-code">Sigla/Código</Label>
                    <Input
                      id="unit-code"
                      value={newUnitCode}
                      onChange={(e) => setNewUnitCode(e.target.value.toUpperCase())}
                      placeholder="Ex: CBO"
                      maxLength={6}
                    />
                    <p className="text-[10px] text-slate-500">Abreviação para relatórios.</p>
                  </div>
                </div>

                <DialogFooter className="pt-3">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                    Salvar Unidade
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {loading ? (
          <div className="flex items-center justify-center p-6 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando unidades...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {units.map((unit) => (
              <div
                key={unit.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase border border-slate-200 dark:border-slate-700">
                    {unit.code || unit.id.substring(0, 3).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{unit.name}</p>
                    <p className="text-xs text-slate-500 font-mono">ID: {unit.id}</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 h-8 w-8 p-0"
                  onClick={() => handleDeleteUnit(unit)}
                  title="Excluir Unidade"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
