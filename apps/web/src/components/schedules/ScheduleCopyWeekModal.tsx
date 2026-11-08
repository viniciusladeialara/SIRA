/**
 * @file ScheduleCopyWeekModal.tsx
 * @description Diálogo para clonar e replicar grades semanais de horários (Templates e Recorrência).
 * Permite copiar os agendamentos de uma semana de referência para uma ou várias semanas consecutivas,
 * com detecção e exclusão automática de feriados cadastrados e prevenção de conflitos.
 */

import React, { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  format, 
  isSameDay, 
  isBefore, 
  startOfDay 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Copy, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Sparkles, 
  ShieldCheck,
  CalendarDays
} from 'lucide-react';
import { collection, writeBatch, doc, Timestamp, getDocs, query, where } from "@/lib/sira-sql-adapter";
import { db } from "@/lib/db";
import { useToast } from '@/hooks/use-toast';
import { logAction, AuditAction } from '@/lib/AuditLog';
import { useAuth } from '@/lib/AuthContext';

interface Schedule {
  id: string;
  className: string;
  roomName: string;
  teacherName: string;
  startTime: Timestamp;
  endTime: Timestamp;
  roomId: string;
  teacherId: string;
  classId: string;
  observation?: string;
  scheduleStatus?: string;
  unitId?: string;
  courseId?: string;
  courseName?: string;
  isDirectBooking?: boolean;
}

interface Holiday {
  id: string;
  name: string;
  date: Timestamp | { toDate: () => Date };
}

interface ScheduleCopyWeekModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
  schedules: Schedule[];
  holidays: Holiday[];
  selectedUnitId: string;
  onSuccess?: () => void;
}

export function ScheduleCopyWeekModal({
  isOpen,
  onClose,
  currentDate,
  schedules,
  holidays,
  selectedUnitId,
  onSuccess
}: ScheduleCopyWeekModalProps) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  // Semana de origem calculada a partir da data atual da grade
  const sourceWeekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const sourceWeekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);

  // Agendamentos pertencentes à semana de origem
  const sourceWeekSchedules = useMemo(() => {
    return schedules.filter(s => {
      const sDate = s.startTime.toDate();
      return sDate >= sourceWeekStart && sDate <= sourceWeekEnd;
    });
  }, [schedules, sourceWeekStart, sourceWeekEnd]);

  // Estados de configuração da cópia
  const [targetWeeksCount, setTargetWeeksCount] = useState<string>('1'); // 1 a 6 semanas
  const [skipHolidays, setSkipHolidays] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Semanas de destino calculadas
  const targetWeeks = useMemo(() => {
    const count = parseInt(targetWeeksCount, 10) || 1;
    const weeks: { start: Date; end: Date; weekOffset: number; label: string }[] = [];
    for (let i = 1; i <= count; i++) {
      const start = addWeeks(sourceWeekStart, i);
      const end = addWeeks(sourceWeekEnd, i);
      weeks.push({
        start,
        end,
        weekOffset: i,
        label: `${format(start, "dd/MM")} a ${format(end, "dd/MM/yyyy")}`
      });
    }
    return weeks;
  }, [sourceWeekStart, sourceWeekEnd, targetWeeksCount]);

  // Pré-visualização da contagem de agendamentos que serão criados vs pulados por feriados
  const previewStats = useMemo(() => {
    let projectedTotal = 0;
    let holidaysSkipped = 0;

    targetWeeks.forEach(targetWeek => {
      sourceWeekSchedules.forEach(schedule => {
        const origStart = schedule.startTime.toDate();
        const projectedDate = addWeeks(origStart, targetWeek.weekOffset);

        if (skipHolidays) {
          const isHoliday = holidays.some(h => {
            const hDate = typeof h.date?.toDate === 'function' ? h.date.toDate() : (h.date instanceof Date ? h.date : new Date(h.date));
            return isSameDay(hDate, projectedDate);
          });

          if (isHoliday) {
            holidaysSkipped++;
            return;
          }
        }
        projectedTotal++;
      });
    });

    return { projectedTotal, holidaysSkipped };
  }, [sourceWeekSchedules, targetWeeks, skipHolidays, holidays]);

  const handleExecuteCopy = async () => {
    if (sourceWeekSchedules.length === 0) {
      toast({
        title: "Nenhum agendamento para copiar",
        description: "A semana de origem selecionada não possui agendamentos cadastrados.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      let createdCount = 0;
      let skippedHolidaysCount = 0;
      const batches: ReturnType<typeof writeBatch>[] = [writeBatch(db)];
      let currentBatchIndex = 0;
      let operationsInBatch = 0;

      for (const targetWeek of targetWeeks) {
        for (const schedule of sourceWeekSchedules) {
          const origStart = schedule.startTime.toDate();
          const origEnd = schedule.endTime.toDate();

          const newStart = addWeeks(origStart, targetWeek.weekOffset);
          const newEnd = addWeeks(origEnd, targetWeek.weekOffset);

          // Checa feriado
          if (skipHolidays) {
            const holidayMatch = holidays.find(h => {
              const hDate = typeof h.date?.toDate === 'function' ? h.date.toDate() : (h.date instanceof Date ? h.date : new Date(h.date));
              return isSameDay(hDate, newStart);
            });

            if (holidayMatch) {
              skippedHolidaysCount++;
              continue; // Pula este agendamento
            }
          }

          // Cria novo documento no batch
          const newDocRef = doc(collection(db, "schedules"));
          const newScheduleData: Record<string, any> = {
            className: schedule.className || "",
            classId: schedule.classId || "",
            roomName: schedule.roomName || "",
            roomId: schedule.roomId || "",
            teacherName: schedule.teacherName || "",
            teacherId: schedule.teacherId || "",
            startTime: Timestamp.fromDate(newStart),
            endTime: Timestamp.fromDate(newEnd),
            unitId: schedule.unitId || selectedUnitId || "caceres",
            createdBy: currentUser?.uid || "system_copy_week",
            createdAt: Timestamp.now(),
            observation: schedule.observation ? `[Copiado da semana de ${format(sourceWeekStart, 'dd/MM')}] ${schedule.observation}` : `[Cópia programada]`,
            scheduleStatus: "original"
          };

          if (schedule.courseId) newScheduleData.courseId = schedule.courseId;
          if (schedule.courseName) newScheduleData.courseName = schedule.courseName;
          if (schedule.isDirectBooking) newScheduleData.isDirectBooking = schedule.isDirectBooking;

          batches[currentBatchIndex].set(newDocRef, newScheduleData);
          operationsInBatch++;
          createdCount++;

          // Limite seguro de 400 operações por batch (Firestore suporta até 500)
          if (operationsInBatch >= 400) {
            batches.push(writeBatch(db));
            currentBatchIndex++;
            operationsInBatch = 0;
          }
        }
      }

      // Executa todos os batches
      for (const b of batches) {
        await b.commit();
      }

      // Registro de Auditoria Corporativa
      await logAction(
        AuditAction.SCHEDULE_CREATED,
        `Replicação de grade semanal: ${createdCount} novos agendamentos gerados a partir da semana ${format(sourceWeekStart, 'dd/MM')}. ${skippedHolidaysCount} feriados respeitados/pulados.`,
        {
          sourceWeek: format(sourceWeekStart, 'yyyy-MM-dd'),
          weeksTargetCount: targetWeeks.length,
          totalCreated: createdCount,
          skippedHolidays: skippedHolidaysCount,
          unitId: selectedUnitId
        }
      );

      toast({
        title: "Grade Replicada com Sucesso!",
        description: `${createdCount} novos agendamentos foram criados.${skippedHolidaysCount > 0 ? ` ${skippedHolidaysCount} datas de feriados foram puladas automaticamente.` : ''}`,
        variant: "default"
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Erro ao copiar grade da semana:", error);
      toast({
        title: "Erro ao replicar grade",
        description: error?.message || "Ocorreu um erro ao salvar os novos agendamentos.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              <Copy className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Copiar Grade da Semana</DialogTitle>
              <DialogDescription>
                Replique todos os horários desta semana para as próximas semanas com um clique.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Card da Semana de Origem */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                Semana de Origem (Modelo)
              </span>
              <Badge variant="outline" className="font-mono bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200">
                {sourceWeekSchedules.length} agendamentos encontrados
              </Badge>
            </div>
            <p className="text-base font-medium text-slate-800 dark:text-slate-100">
              {format(sourceWeekStart, "dd 'de' MMMM", { locale: ptBR })} a {format(sourceWeekEnd, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          {/* Configuração de Destino */}
          <div className="space-y-3">
            <Label htmlFor="target-weeks" className="text-sm font-semibold">
              Replicar para quantas semanas futuras?
            </Label>
            <Select value={targetWeeksCount} onValueChange={setTargetWeeksCount} disabled={isProcessing}>
              <SelectTrigger id="target-weeks" className="w-full">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 semana (Próxima semana)</SelectItem>
                <SelectItem value="2">2 semanas consecutivas (Próximas 2 semanas)</SelectItem>
                <SelectItem value="3">3 semanas consecutivas</SelectItem>
                <SelectItem value="4">4 semanas (Mês completo)</SelectItem>
                <SelectItem value="6">6 semanas (Um mês e meio)</SelectItem>
                <SelectItem value="8">8 semanas (Dois meses)</SelectItem>
              </SelectContent>
            </Select>

            {/* Lista das Semanas que serão preenchidas */}
            <div className="mt-2 space-y-1.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border text-xs">
              <span className="font-semibold text-muted-foreground block mb-1">Semanas que receberão a grade:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {targetWeeks.map((tw, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <ArrowRight className="h-3 w-3 text-blue-500 shrink-0" />
                    <span>Semana {tw.weekOffset}: <strong>{tw.label}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Opção Inteligente de Feriados */}
          <div className="flex items-start space-x-3 p-3.5 rounded-lg border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50">
            <Checkbox
              id="skip-holidays"
              checked={skipHolidays}
              onCheckedChange={(c) => setSkipHolidays(!!c)}
              disabled={isProcessing}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="skip-holidays" className="text-sm font-semibold text-amber-900 dark:text-amber-300 cursor-pointer flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                Pular automaticamente feriados cadastrados
              </Label>
              <p className="text-xs text-amber-800/80 dark:text-amber-400/80">
                Se alguma aula cair em um feriado oficial ou recesso cadastrado na unidade, o sistema irá ignorar o agendamento daquele dia específico.
              </p>
            </div>
          </div>

          {/* Resumo da Ação */}
          <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>Total de aulas a serem criadas:</span>
            </div>
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-blue-700 dark:text-blue-300 text-base">{previewStats.projectedTotal} aulas</span>
              {previewStats.holidaysSkipped > 0 && (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                  {previewStats.holidaysSkipped} em feriados (puladas)
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button 
            onClick={handleExecuteCopy} 
            disabled={isProcessing || sourceWeekSchedules.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Replicando horários...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Confirmar e Replicar Grade
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
