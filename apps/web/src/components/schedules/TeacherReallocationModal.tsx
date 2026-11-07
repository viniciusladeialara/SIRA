import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  UserCheck, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building
} from 'lucide-react';

interface Teacher {
  id: string;
  name: string;
  isActive: boolean;
  allowedShifts?: string[];
}

export interface ReallocationTarget {
  scheduleId?: string;
  allocationId?: string;
  teacherId: string;
  teacherName: string;
  date: Date;
  shift: 'matutino' | 'vespertino' | 'noturno';
  hours: number;
  className: string;
  roomName?: string;
  projectId?: string;
  projectName?: string;
}

interface TeacherReallocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetData: ReallocationTarget | null;
  teachers: Teacher[];
  weeklyHours: Record<string, number>;
  schedulesMap: Map<string, any[]>;
  allocationsMap: Map<string, any>;
  onConfirmReallocation: (newTeacherId: string, newTeacherName: string, reason?: string) => Promise<void>;
}

export function TeacherReallocationModal({
  isOpen,
  onClose,
  targetData,
  teachers,
  weeklyHours,
  schedulesMap,
  allocationsMap,
  onConfirmReallocation
}: TeacherReallocationModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [hideBusy, setHideBusy] = useState(true);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Análise preditiva e ranqueamento de candidatos
  const rankedCandidates = useMemo(() => {
    if (!targetData) return [];

    const dateKey = format(targetData.date, 'yyyy-MM-dd');
    const shift = targetData.shift;

    const candidates = teachers
      .filter(t => t.id !== targetData.teacherId && t.isActive !== false)
      .map(teacher => {
        const cellKey = `${teacher.id}_${dateKey}_${shift}`;
        
        // 1. Verificar conflito de alocação ou agendamento
        const existingAlloc = allocationsMap.get(cellKey);
        const matchingSchedules = schedulesMap.get(cellKey) || [];

        const isAllocatedInClass = existingAlloc && existingAlloc.status === 'EM AULA';
        const hasScheduleConflict = matchingSchedules.length > 0;
        const isBusy = isAllocatedInClass || hasScheduleConflict;

        // Status atual do candidato no turno
        let currentStatusLabel = "Livre / Disponível";
        if (isBusy) {
          currentStatusLabel = `Ocupado (${existingAlloc?.className || matchingSchedules[0]?.className || 'Em Aula'})`;
        } else if (existingAlloc && existingAlloc.status) {
          currentStatusLabel = existingAlloc.status;
        }

        // 2. Verificar habilitação de turno
        const isShiftEligible = !teacher.allowedShifts || 
          teacher.allowedShifts.length === 0 || 
          teacher.allowedShifts.includes(shift);

        // 3. Carga horária
        const currentHours = weeklyHours[teacher.id] || 0;
        const projectedHours = currentHours + targetData.hours;
        const willExceedWeeklyLimit = projectedHours > 40;

        // 4. Score de Compatibilidade (0 a 100)
        let score = 100;
        if (isBusy) score -= 60;
        if (!isShiftEligible) score -= 25;
        if (willExceedWeeklyLimit) score -= 20;

        // Bônus para quem tem menos horas na semana (equilíbrio de carga)
        const loadBalanceBonus = Math.max(0, 15 - Math.floor(currentHours / 3));
        score += loadBalanceBonus;

        return {
          teacher,
          isBusy,
          currentStatusLabel,
          isShiftEligible,
          currentHours,
          projectedHours,
          willExceedWeeklyLimit,
          score: Math.max(0, Math.min(100, score))
        };
      });

    // Ordenar: primeiro os disponíveis (não ocupados), depois por maior score, e menor carga atual
    return candidates.sort((a, b) => {
      if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
      if (b.score !== a.score) return b.score - a.score;
      return a.currentHours - b.currentHours;
    });
  }, [targetData, teachers, weeklyHours, schedulesMap, allocationsMap]);

  const filteredCandidates = useMemo(() => {
    return rankedCandidates.filter(c => {
      if (hideBusy && c.isBusy) return false;
      if (searchTerm.trim()) {
        return c.teacher.name.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    });
  }, [rankedCandidates, hideBusy, searchTerm]);

  const selectedCandidate = useMemo(() => {
    return rankedCandidates.find(c => c.teacher.id === selectedTeacherId);
  }, [rankedCandidates, selectedTeacherId]);

  const handleConfirm = async () => {
    if (!selectedCandidate) return;
    setIsSubmitting(true);
    try {
      await onConfirmReallocation(
        selectedCandidate.teacher.id,
        selectedCandidate.teacher.name,
        justification.trim()
      );
      onClose();
      setSelectedTeacherId(null);
      setJustification("");
    } catch (err) {
      console.error("Erro na realocação:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!targetData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header Tecnológico */}
        <DialogHeader className="p-6 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Motor de Realocação Docente
                <Badge variant="outline" className="bg-blue-950/60 text-blue-300 border-blue-800 text-[11px]">
                  Sugestão Inteligente
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs mt-0.5">
                Identificação de disponibilidade, compatibilidade de turno e redistribuição preditiva de carga horária.
              </DialogDescription>
            </div>
          </div>

          {/* Card da Aula a ser Realocada */}
          <div className="mt-4 p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Professor Atual</span>
              <span className="font-semibold text-slate-100 truncate block mt-0.5" title={targetData.teacherName}>
                {targetData.teacherName}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Data & Turno</span>
              <span className="font-semibold text-slate-100 flex items-center gap-1.5 mt-0.5 capitalize">
                <Clock className="h-3 w-3 text-blue-400" />
                {format(targetData.date, "dd/MM (EEE)", { locale: ptBR })} • {targetData.shift}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Turma / Carga</span>
              <span className="font-semibold text-slate-100 flex items-center gap-1.5 mt-0.5">
                <BookOpen className="h-3 w-3 text-amber-400" />
                {targetData.className} ({targetData.hours}h)
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Ambiente / Sala</span>
              <span className="font-semibold text-slate-100 flex items-center gap-1.5 mt-0.5">
                <MapPin className="h-3 w-3 text-emerald-400" />
                {targetData.roomName || "Não atribuído"}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo com Lista de Candidatos Ranqueados */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar professor substituto..."
                className="pl-9 h-9 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer self-center">
              <input
                type="checkbox"
                checked={hideBusy}
                onChange={(e) => setHideBusy(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              Ocultar docentes ocupados no turno
            </label>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            {filteredCandidates.length} docente(s) encontrado(s) • Ranqueados por disponibilidade e equilíbrio de horas
          </div>

          <ScrollArea className="h-[260px] rounded-lg border border-slate-200 dark:border-slate-800 p-2">
            <div className="space-y-2">
              {filteredCandidates.map(({ teacher, isBusy, currentStatusLabel, isShiftEligible, currentHours, projectedHours, willExceedWeeklyLimit, score }) => {
                const isSelected = selectedTeacherId === teacher.id;

                return (
                  <div
                    key={teacher.id}
                    onClick={() => !isBusy && setSelectedTeacherId(teacher.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-400 shadow-sm"
                        : isBusy
                        ? "border-slate-200 bg-slate-50/50 opacity-60 cursor-not-allowed"
                        : "border-slate-200 dark:border-slate-800 hover:border-blue-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        score >= 80 ? "bg-emerald-100 text-emerald-700" :
                        score >= 60 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {score}%
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {teacher.name}
                          </span>
                          {!isShiftEligible && (
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">
                              Turno ñ preferencial
                            </Badge>
                          )}
                          {isBusy && (
                            <Badge variant="destructive" className="text-[10px]">
                              Ocupado no Turno
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>Status: <strong className="text-slate-700 dark:text-slate-300">{currentStatusLabel}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Carga Semanal</span>
                        <span className={`text-xs font-bold ${willExceedWeeklyLimit ? "text-red-600" : "text-slate-700 dark:text-slate-200"}`}>
                          {currentHours}h ➔ <span className="text-blue-600 font-extrabold">{projectedHours}h</span> / 40h
                        </span>
                      </div>

                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"
                      }`}>
                        {isSelected && <CheckCircle2 className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredCandidates.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-sm">
                  Nenhum professor compatível com os filtros atuais.
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Justificativa da Realocação */}
          {selectedCandidate && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-300">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Motivo / Justificativa da Realocação (Opcional):
              </Label>
              <Input
                placeholder="Ex: Atestado médico, troca de turno, substituição de emergência..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {selectedCandidate ? (
              <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-medium">
                <ShieldCheck className="h-4 w-4" />
                Realocando para <strong>{selectedCandidate.teacher.name}</strong>
              </span>
            ) : (
              <span>Selecione um professor substituto para prosseguir</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!selectedCandidate || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isSubmitting ? "Realocando..." : "Confirmar Realocação"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
