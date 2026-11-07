import React from "react";
import { format, subWeeks, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, RefreshCw, Clock, Copy, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ScheduleCreationModal } from "./ScheduleCreationModal";

interface ScheduleFiltersProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  activeTurno: string;
  setActiveTurno: (turno: string) => void;
  creationModal: React.ReactNode;
  rooms: { id: string; name: string }[];
  selectedRoom: string;
  setSelectedRoom: (roomId: string) => void;
  isProcessing?: boolean;
  isAdmin?: boolean;
  shifts?: string[];
  onCopyWeek?: () => void;
  onExportWeekIcs?: () => void;
  occupancyStats?: { rate: number; occupiedCount: number; totalCount: number };
}

export function ScheduleFilters({
  currentDate,
  setCurrentDate,
  activeTurno,
  setActiveTurno,
  creationModal,
  rooms,
  selectedRoom,
  setSelectedRoom,
  isProcessing,
  isAdmin,
  shifts,
  onCopyWeek,
  onExportWeekIcs,
  occupancyStats,
}: ScheduleFiltersProps) {
  const start = format(currentDate, "d MMM", { locale: ptBR });
  
  return (
    <header className="flex-shrink-0 p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestão de Agendamentos</h2>
          <p className="text-muted-foreground">Visualize e gerencie a grade de horários semanal</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {occupancyStats && occupancyStats.totalCount > 0 && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-900/50 text-xs shadow-sm">
              <span className="text-muted-foreground">Ocupação das Salas:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {occupancyStats.rate}% ({occupancyStats.occupiedCount}/{occupancyStats.totalCount})
              </span>
            </div>
          )}
          {onCopyWeek && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onCopyWeek} 
              disabled={isProcessing}
              className="gap-1.5 text-xs font-semibold hover:border-blue-300 hover:text-blue-600 shadow-sm"
              title="Copiar a grade desta semana para semanas futuras com bloqueio de feriados"
            >
              <Copy className="h-3.5 w-3.5 text-blue-600" />
              Copiar Semana
            </Button>
          )}
          {onExportWeekIcs && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onExportWeekIcs} 
              disabled={isProcessing}
              className="gap-1.5 text-xs font-semibold hover:border-emerald-300 hover:text-emerald-600 shadow-sm"
              title="Baixar todos os horários da semana em arquivo .ics para Google Calendar/Outlook"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              Exportar .ics
            </Button>
          )}
          {creationModal}
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="flex items-center text-lg font-semibold">
              <Calendar className="h-5 w-5 mr-2 text-primary" />
              Semana Selecionada
            </CardTitle>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
                className="h-8 px-3"
              >
                Anterior
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentDate(new Date())}
                className="h-8 px-3"
              >
                Hoje
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
                className="h-8 px-3"
              >
                Próxima
              </Button>
            </div>
          </div>
          <CardDescription className="flex items-center gap-2 mt-1">
            <Clock className="h-4 w-4" />
            Período: {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </CardDescription>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
            <Tabs value={activeTurno} onValueChange={setActiveTurno} className="w-full sm:w-auto">
              <TabsList className="flex flex-wrap h-auto p-1 bg-muted/50 border rounded-md justify-start gap-1 w-full sm:w-auto">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                {(shifts || ["Matutino", "Vespertino", "Noturno"]).map(shift => (
                  <TabsTrigger key={shift} value={shift.toLowerCase()}>{shift}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2 w-full sm:w-64">
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filtrar por Ambiente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Ambientes</SelectItem>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>
    </header>
  );
}
