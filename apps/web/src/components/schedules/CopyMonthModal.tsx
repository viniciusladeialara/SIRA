import React, { useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { copyMonthlySchedules, undoMonthlyCopy } from "@/services/scheduleService";
import { ToastAction } from "@/components/ui/toast";

export function CopyMonthModal() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [sourceMonth, setSourceMonth] = useState(new Date().getMonth().toString());
  const [sourceYear, setSourceYear] = useState(new Date().getFullYear().toString());
  const [targetMonth, setTargetMonth] = useState(addMonths(new Date(), 1).getMonth().toString());
  const [targetYear, setTargetYear] = useState(addMonths(new Date(), 1).getFullYear().toString());

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i.toString(),
    label: format(new Date(2024, i, 1), 'MMMM', { locale: ptBR })
  }));

  const years = [
    new Date().getFullYear() - 1,
    new Date().getFullYear(),
    new Date().getFullYear() + 1
  ].map(y => y.toString());

  const handleUndo = async (batchId: string) => {
    try {
      await undoMonthlyCopy(batchId);
      toast({
        title: "Operação desfeita",
        description: "Os agendamentos e conflitos criados foram removidos."
      });
    } catch (error: any) {
      toast({
        title: "Erro ao desfazer",
        description: error.message || "Não foi possível desfazer a operação.",
        variant: "destructive"
      });
    }
  };

  const handleCopy = async () => {
    setIsProcessing(true);
    try {
      const result = await copyMonthlySchedules({
        sourceMonth: parseInt(sourceMonth),
        sourceYear: parseInt(sourceYear),
        targetMonth: parseInt(targetMonth),
        targetYear: parseInt(targetYear)
      });
      
      const { batchId, stats } = (result as any).data;
      toast({
        title: "Cópia concluída",
        description: `Copiados: ${stats.copied}, Conflitos: ${stats.conflicts}. Verifique a aba de conflitos para detalhes.`,
        action: (
          <ToastAction altText="Desfazer" onClick={() => handleUndo(batchId)}>
            Desfazer
          </ToastAction>
        )
      });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro na cópia",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Copy className="h-4 w-4 mr-2" /> Copiar Mês
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Copiar Agendamentos</DialogTitle>
          <DialogDescription>
            Replique a estrutura de um mês para o outro. Conflitos serão enviados para análise manual.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-4 border p-3 rounded-md bg-muted/20">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Origem (De onde copiar)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={sourceMonth} onValueChange={setSourceMonth}>
                <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sourceYear} onValueChange={setSourceYear}>
                <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-center"><Copy className="h-4 w-4 text-muted-foreground rotate-90" /></div>

          <div className="space-y-4 border p-3 rounded-md bg-primary/5 border-primary/20">
            <Label className="text-xs font-bold uppercase text-primary/70">Destino (Para onde copiar)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={targetMonth} onValueChange={setTargetMonth}>
                <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={targetYear} onValueChange={setTargetYear}>
                <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isProcessing}>Cancelar</Button>
          <Button onClick={handleCopy} disabled={isProcessing}>
            {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</> : "Iniciar Cópia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
