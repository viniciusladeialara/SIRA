import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Building, AlertTriangle } from "lucide-react";
import { Timestamp } from "@/lib/sira-sql-adapter";
import { toSafeDate, toSafeMillis } from "@/lib/date-utils";

interface Schedule {
  id: string;
  className: string;
  startTime: Timestamp;
  endTime: Timestamp;
}

interface ScheduleSummarySidebarProps {
  schedules: Schedule[];
  activeTurno: string;
}

export function ScheduleSummarySidebar({ schedules, activeTurno }: ScheduleSummarySidebarProps) {
  // Filtras os agendamentos pelo turno se necessário
  const filteredSchedules = activeTurno === 'todos' 
    ? schedules 
    : schedules.filter(s => {
        const hour = toSafeDate(s.startTime).getHours();
        if (activeTurno === 'matutino') return hour >= 7 && hour < 13;
        if (activeTurno === 'vespertino') return hour >= 13 && hour < 18;
        if (activeTurno === 'noturno') return hour >= 18;
        return true;
      });

  const totalSchedules = filteredSchedules.length;
  const uniqueClasses = new Set(filteredSchedules.map(s => s.className)).size;
  
  // Cálculo de horas totais
  const totalHours = filteredSchedules.reduce((acc, s) => {
    const duration = (toSafeMillis(s.endTime) - toSafeMillis(s.startTime)) / (1000 * 60 * 60);
    return acc + duration;
  }, 0);

  return (
    <aside className="w-80 flex-shrink-0 space-y-4 overflow-y-auto pr-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Resumo da Semana
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total de Aulas</span>
            <span className="font-bold">{totalSchedules}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Turmas Atendidas</span>
            <span className="font-bold">{uniqueClasses}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Carga Horária</span>
            <span className="font-bold">{totalHours.toFixed(1)}h</span>
          </div>
          
          <div className="pt-4 border-t space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtro Ativo</h4>
            <Badge variant="outline" className="capitalize">
              Turno: {activeTurno}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Dicas de Otimização
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-amber-800 dark:text-amber-500 space-y-2">
          <p>• Verifique conflitos de professores antes de confirmar novos agendamentos.</p>
          <p>• Utilize o Bloco para visualizar ambientes próximos e facilitar o deslocamento.</p>
        </CardContent>
      </Card>
      
      <div className="p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-2">
        <Building className="h-8 w-8 text-slate-400" />
        <p className="text-xs text-muted-foreground font-medium">Capacidade Média de Salas</p>
        <span className="text-xl font-bold text-slate-700 dark:text-slate-300">~25</span>
        <p className="text-[10px] text-muted-foreground">alunos por ambiente</p>
      </div>
    </aside>
  );
}
