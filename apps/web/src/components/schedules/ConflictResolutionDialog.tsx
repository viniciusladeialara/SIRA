import React, { useState, useEffect } from "react";
import { AlertTriangle, Check, X, User, Home, Calendar, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { resolveScheduleConflict } from "@/services/scheduleService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Timestamp, collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { startOfDay, endOfDay } from "date-fns";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

interface ConflictResolutionDialogProps {
  conflict: any | null;
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
  teachers: any[];
  rooms: any[];
}

export function ConflictResolutionDialog({ conflict, onOpenChange, onResolved, teachers, rooms }: ConflictResolutionDialogProps) {
  const { toast } = useToast();
  const [isResolving, setIsResolving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    teacherId: '',
    roomId: ''
  });

  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [conflictingSchedules, setConflictingSchedules] = useState<any[]>([]);
  const [isLoadingConflicts, setIsLoadingConflicts] = useState(false);

  useEffect(() => {
    if (!conflict) return;
    setEditMode(false); 
    
    // Buscar detalhes dos agendamentos que estão causando o conflito
    const fetchConflictingDetails = async () => {
      if (!conflict.conflictingScheduleIds || conflict.conflictingScheduleIds.length === 0) {
        setConflictingSchedules([]);
        return;
      }
      
      setIsLoadingConflicts(true);
      try {
        const promises = conflict.conflictingScheduleIds.map(async (id: string) => {
          const snap = await getDoc(doc(db, "schedules", id));
          if (snap.exists()) {
            return { id: snap.id, ...snap.data() };
          }
          return null;
        });
        const results = await Promise.all(promises);
        setConflictingSchedules(results.filter(Boolean));
      } catch (error) {
        console.error("Erro ao buscar detalhes dos conflitos:", error);
      } finally {
        setIsLoadingConflicts(false);
      }
    };

    fetchConflictingDetails();
    
    // Buscar disponibilidade de salas automaticamente para sugestões
    const checkAvailability = async () => {
      setIsCheckingAvailability(true);
      try {
        const startTime = conflict.suggestedData?.startTime?.toDate?.() || new Date();
        const endTime = conflict.suggestedData?.endTime?.toDate?.() || new Date();
        
        // 1. Buscar agendamentos do dia
        const dayStart = startOfDay(startTime);
        const dayEnd = endOfDay(startTime);
        
        const q = query(
          collection(db, "schedules"),
          where("startTime", ">=", Timestamp.fromDate(dayStart)),
          where("startTime", "<=", Timestamp.fromDate(dayEnd))
        );
        
        const snapshot = await getDocs(q);
        const daySchedules = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() as any }))
          .filter(s => s.id !== conflict.sourceScheduleId && !conflict.conflictingScheduleIds?.includes(s.id)); 
        
        // 2. Filtrar salas
        const filtered = rooms.filter(room => {
          if (room.available === false) return false;
          const hasOverlap = daySchedules.some(s => {
            if (s.roomId !== room.id) return false;
            const sStart = s.startTime?.toDate?.() || new Date();
            const sEnd = s.endTime?.toDate?.() || new Date();
            return startTime < sEnd && sStart < endTime;
          });
          return !hasOverlap;
        });
        
        setAvailableRooms(filtered);
      } catch (error) {
        console.error("Erro ao verificar disponibilidade:", error);
        setAvailableRooms(rooms.filter(r => r.available !== false));
      } finally {
        setIsCheckingAvailability(false);
      }
    };

    checkAvailability();
  }, [conflict?.id, rooms]);

  useEffect(() => {
    if (conflict) {
      setFormData({
        teacherId: conflict.suggestedData?.teacherId || '',
        roomId: conflict.suggestedData?.roomId || ''
      });
    }
  }, [conflict]);

  if (!conflict) return null;

  const quickApplyRoom = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    setFormData(p => ({ ...p, roomId }));
    setEditMode(true);
    toast({
        title: "Ambiente selecionado",
        description: `O ambiente ${room.name} foi aplicado à sugestão.`
    });
  };

  const handleResolve = async (action: 'ignore' | 'accept_anyway' | 'resolve') => {
    setIsResolving(true);
    try {
      let updateData = undefined;
      
      if (action === 'resolve') {
        const selectedTeacher = teachers.find(t => t.id === formData.teacherId);
        const selectedRoom = rooms.find(r => r.id === formData.roomId);
        
        updateData = {
          teacherId: formData.teacherId,
          teacherName: selectedTeacher?.name || conflict.suggestedData.teacherName,
          roomId: formData.roomId,
          roomName: selectedRoom?.name || conflict.suggestedData.roomName
        };
      }

      await resolveScheduleConflict({
        conflictId: conflict.id,
        action,
        updateData
      });
      
      const titleLabel = action === 'ignore' ? "Novo agendamento descartado" : "Conflito Substituído";
      const descLabel = action === 'ignore' 
        ? "O novo registro foi removido, mantendo o original." 
        : "O registro antigo foi removido e o novo foi consolidado.";

      toast({
        title: titleLabel,
        description: descLabel
      });
      
      onResolved();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao resolver conflito",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive"
      });
    } finally {
      setIsResolving(false);
    }
  };

  const originalStart = conflict.suggestedData?.startTime?.toDate?.() || new Date();
  const originalEnd = conflict.suggestedData?.endTime?.toDate?.() || new Date();

  return (
    <Dialog open={!!conflict} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-amber-100 rounded-full text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl">Análise de Conflito</DialogTitle>
          </div>
          <DialogDescription>
            Decida como tratar este agendamento que apresentou incompatibilidade durante a cópia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-4">
          {/* COLUNA ESQUERDA: DETALHES DO CONFLITO */}
          <div className="lg:col-span-7 space-y-6">
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Motivo do Conflito</AlertTitle>
              <AlertDescription className="font-medium">
                {conflict.description}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-blue-600 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Novo Agendamento
                </h4>
                <div className="p-4 border-2 border-blue-100 rounded-lg bg-blue-50/30 space-y-3 shadow-sm">
                  <p className="text-sm font-bold text-blue-900">{format(originalStart, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
                  <p className="text-xs text-blue-700 flex items-center gap-1.5 font-medium">
                    <Clock className="h-3.5 w-3.5" /> {format(originalStart, "HH:mm")} - {format(originalEnd, "HH:mm")}
                  </p>
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase h-5 bg-white border-blue-200">Prof.</Badge>
                        <span className="text-xs truncate font-semibold text-slate-700">{conflict.suggestedData?.teacherName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase h-5 bg-white border-blue-200">Sala</Badge>
                        <span className="text-xs truncate font-semibold text-slate-700">{conflict.suggestedData?.roomName}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Registros Existentes
                </h4>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {isLoadingConflicts ? (
                    <div className="p-6 border border-dashed rounded-lg flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : conflictingSchedules.length > 0 ? (
                    conflictingSchedules.map((s, idx) => (
                        <div key={idx} className="p-3 border border-amber-200 rounded-lg bg-white text-[11px] shadow-sm hover:border-amber-400 transition-colors">
                            <div className="font-bold text-amber-900 truncate mb-1.5 text-xs">{s.className || 'Reserva'}</div>
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="truncate mr-2">{s.teacherName}</span>
                                <Badge variant="secondary" className="font-mono text-[10px] bg-amber-50 text-amber-700 hover:bg-amber-100">{s.roomName}</Badge>
                            </div>
                        </div>
                    ))
                  ) : (
                    <div className="p-6 border border-dashed rounded-lg text-xs text-center text-muted-foreground italic bg-slate-50/50">
                        Nenhum detalhe extra encontrado.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
               <h4 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Turma / Projeto</h4>
               <p className="text-sm font-bold text-slate-800 leading-tight">
                  {conflict.suggestedData?.className} 
                  <span className="text-slate-500 font-medium block mt-0.5">{conflict.suggestedData?.courseName}</span>
               </p>
            </div>
          </div>

          {/* COLUNA DIREITA: ALTERNATIVAS E AJUSTES */}
          <div className="lg:col-span-5 space-y-6 lg:border-l lg:pl-8">
            <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase text-green-600 flex items-center gap-1">
                  <Home className="h-3 w-3" /> Ambientes Livres (Alternativas)
                </h4>
                <div className="bg-green-50/30 border border-green-100 rounded-lg p-4">
                  <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                      {isCheckingAvailability ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-green-600" />
                              Verificando disponibilidade em tempo real...
                          </div>
                      ) : availableRooms.length > 0 ? (
                          availableRooms.map((room) => (
                              <Badge 
                                  key={room.id} 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-green-600 hover:text-white hover:border-green-600 transition-all py-1.5 px-3 border-green-200 bg-white text-green-700 text-xs font-medium shadow-sm"
                                  onClick={() => quickApplyRoom(room.id)}
                              >
                                  {room.name}
                              </Badge>
                          ))
                      ) : (
                          <span className="text-xs text-muted-foreground italic py-2">Nenhum outro ambiente disponível neste horário.</span>
                      )}
                  </div>
                  <p className="text-[10px] text-green-600/70 mt-3 italic flex items-start gap-1">
                    <span className="font-bold">Dica:</span> 
                    Clique em um ambiente para sugerir a mudança ao invés de substituir o ocupante atual.
                  </p>
                </div>
            </div>

            <div className="space-y-4">
              {!editMode ? (
                <>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 font-bold text-amber-900">
                      <AlertCircle className="h-4 w-4" />
                      <span>Impacto da Resolução</span>
                    </div>
                    Ao selecionar <span className="font-bold underline">Substituir</span>, os registros existentes serão removidos para dar lugar a este novo agendamento.
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-xs text-blue-600 font-semibold border-blue-200 hover:bg-blue-50 hover:border-blue-300 h-10"
                    onClick={() => setEditMode(true)}
                  >
                    <User className="h-3.5 w-3.5 mr-2" />
                    Deseja ajustar professor ou ambiente antes de salvar?
                  </Button>
                </>
              ) : (
                <div className="space-y-4 border border-blue-200 rounded-lg p-4 bg-blue-50/30">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-blue-700">Ajustes Manuais</h4>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setEditMode(false)}>Cancelar</Button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-slate-600">Novo Professor</Label>
                      <Select value={formData.teacherId} onValueChange={(val) => setFormData(p => ({ ...p, teacherId: val }))}>
                        <SelectTrigger className="h-9 text-xs bg-white">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-slate-600">Novo Ambiente</Label>
                      <Select value={formData.roomId} onValueChange={(val) => setFormData(p => ({ ...p, roomId: val }))}>
                        <SelectTrigger className="h-9 text-xs bg-white">
                          {isCheckingAvailability ? (
                              <div className="flex items-center gap-2">
                                 <Loader2 className="h-3 w-3 animate-spin" />
                                 <span>Verificando...</span>
                              </div>
                          ) : (
                              <SelectValue placeholder="Selecione" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {availableRooms.length === 0 && !isCheckingAvailability ? (
                              <SelectItem value="none" disabled>Nenhum ambiente livre no horário</SelectItem>
                          ) : (
                              availableRooms.map(r => <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>)
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t flex flex-col sm:flex-row gap-3">
          <Button 
            variant="ghost" 
            className="text-slate-500 hover:text-red-600 hover:bg-red-50 font-medium" 
            onClick={() => handleResolve('ignore')}
            disabled={isResolving}
          >
            <X className="h-4 w-4 mr-2" /> Descartar Novo
          </Button>
          
          <div className="flex-1" />
          
          <Button 
            variant="outline" 
            className="border-slate-200 hover:bg-slate-50 text-slate-700 font-medium"
            onClick={() => handleResolve('accept_anyway')}
            disabled={isResolving}
          >
            <Check className="h-4 w-4 mr-2" /> Forçar Substituição
          </Button>
          
          <Button 
            onClick={() => handleResolve('resolve')}
            disabled={isResolving || (editMode && (!formData.teacherId || !formData.roomId))}
            className="bg-blue-600 hover:bg-blue-700 px-8 font-bold shadow-md"
          >
            {editMode ? "Confirmar e Aplicar" : "Substituir Registro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
