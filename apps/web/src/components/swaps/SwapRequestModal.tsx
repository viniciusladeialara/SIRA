import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { Schedule } from "@/services/reservationService";
import { getSwapOptions, requestSwap, getVacantRooms, requestRoomChange } from "@/services/swapService";
import { Loader, ArrowRightLeft, Calendar, Users, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface SwapRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceSchedule: Schedule | null;
    teacherId: string;
    teacherName: string;
    initialTab?: "swaps" | "rooms";
}

export function SwapRequestModal({ isOpen, onClose, sourceSchedule, teacherId, teacherName, initialTab = "rooms" }: SwapRequestModalProps) {
    const { toast } = useToast();
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [sendingRequest, setSendingRequest] = useState(false);
    const [compatibleSchedules, setCompatibleSchedules] = useState<Schedule[]>([]);
    const [vacantRooms, setVacantRooms] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState(initialTab);

    // Estados para confirmação e justificativa da troca
    const [targetForSwap, setTargetForSwap] = useState<Schedule | null>(null);
    const [justification, setJustification] = useState("");
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    useEffect(() => {
        if (isOpen && sourceSchedule) {
            const unitId = (sourceSchedule as any).unitId;
            if (activeTab === "swaps") {
                setLoadingOptions(true);
                getSwapOptions(sourceSchedule, teacherId, unitId)
                    .then(setCompatibleSchedules)
                    .catch(err => {
                        console.error(err);
                        toast({ title: "Erro", description: "Falha ao buscar compatibilidades", variant: "destructive" });
                    })
                    .finally(() => setLoadingOptions(false));
            } else {
                setLoadingRooms(true);
                getVacantRooms(sourceSchedule.startTime.toDate(), sourceSchedule.endTime.toDate(), unitId)
                    .then(setVacantRooms)
                    .catch(err => {
                        console.error(err);
                        toast({ title: "Erro", description: "Falha ao buscar salas vagas", variant: "destructive" });
                    })
                    .finally(() => setLoadingRooms(false));
            }
        }
    }, [isOpen, sourceSchedule, teacherId, activeTab, toast]);

    if (!sourceSchedule) return null;

    const handleOpenConfirm = (targetSchedule: Schedule) => {
        setTargetForSwap(targetSchedule);
        setJustification("");
        setIsConfirmOpen(true);
    };

    const handleConfirmSend = async () => {
        if (!targetForSwap || !sourceSchedule) return;

        if (!justification.trim()) {
            toast({
                title: "Justificativa obrigatória",
                description: "Por favor, informe a justificativa da troca para o colega docente.",
                variant: "destructive"
            });
            return;
        }

        setSendingRequest(true);
        try {
            await requestSwap({
                teacherId,
                teacherName,
                requesterSchedule: sourceSchedule,
                targetTeacherId: targetForSwap.teacherId,
                targetTeacherName: targetForSwap.teacherName,
                targetSchedule: targetForSwap,
                message: justification.trim()
            });
            toast({
                title: "Solicitação Enviada!",
                description: `Enviamos a solicitação de troca com sucesso para ${targetForSwap.teacherName}.`
            });
            setIsConfirmOpen(false);
            setTargetForSwap(null);
            setJustification("");
            onClose();
        } catch (err: any) {
            console.error(err);
            toast({
                title: "Erro ao solicitar",
                description: err.message || "Tente novamente mais tarde.",
                variant: "destructive"
            });
        } finally {
            setSendingRequest(false);
        }
    };

    const handleRelocate = async (room: any) => {
        setSendingRequest(true);
        try {
            await requestRoomChange({
                scheduleId: sourceSchedule.id,
                roomId: room.id,
                roomName: room.name
            });
            toast({
                title: "Ambiente Alterado!",
                description: `Seu agendamento foi movido para ${room.name}.`
            });
            onClose();
        } catch (err: any) {
            console.error(err);
            toast({
                title: "Erro ao alterar",
                description: err.message || "Tente novamente mais tarde.",
                variant: "destructive"
            });
        } finally {
            setSendingRequest(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[95vw] lg:max-w-[1100px] xl:max-w-[1250px] h-[88vh] flex flex-col p-6 overflow-hidden">
                <DialogHeader className="shrink-0 pb-2">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                            <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-slate-800">
                                <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
                                Solicitar Troca de Agendamento
                            </DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                                Gerencie opções de permuta ou realocação para o dia <strong>{format(sourceSchedule.startTime.toDate(), "dd/MM/yyyy", { locale: ptBR })}</strong>.
                            </DialogDescription>
                        </div>

                        {/* Banner do Agendamento Atual em layout horizontal */}
                        <div className="bg-indigo-50/80 border border-indigo-200/80 p-3 rounded-xl flex items-center gap-3 shrink-0">
                            <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 border border-indigo-100">
                                <Calendar className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="text-left">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Agendamento Atual:</span>
                                    <span className="text-xs font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-indigo-100">
                                        {format(sourceSchedule.startTime.toDate(), "HH:mm")} às {format(sourceSchedule.endTime.toDate(), "HH:mm")}
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-indigo-950 mt-0.5">
                                    {sourceSchedule.className} • <span className="text-indigo-700 font-semibold">{sourceSchedule.roomName}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="flex-1 flex flex-col min-h-0 mt-3">
                    <TabsList className="grid w-full max-w-md grid-cols-2 p-1 bg-slate-100 rounded-xl mb-4 shrink-0">
                        <TabsTrigger value="swaps" className="flex items-center gap-2 rounded-lg py-2 transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-700 font-bold text-slate-600 text-xs sm:text-sm">
                            <Users className="w-4 h-4" />
                            Docente x Docente
                        </TabsTrigger>
                        <TabsTrigger value="rooms" className="flex items-center gap-2 rounded-lg py-2 transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-700 font-bold text-slate-600 text-xs sm:text-sm">
                            <MapPin className="w-4 h-4" />
                            Docente x Sala Vaga
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="swaps" className="flex-1 min-h-0 overflow-hidden outline-none data-[state=inactive]:hidden flex flex-col">
                        <ScrollArea className="flex-1 pr-4">
                            {loadingOptions ? (
                                <div className="flex flex-col justify-center items-center h-64 text-slate-400 gap-3">
                                    <Loader className="w-8 h-8 animate-spin text-indigo-600" />
                                    <p className="text-sm font-medium">Buscando aulas compatíveis para permuta...</p>
                                </div>
                            ) : compatibleSchedules.length === 0 ? (
                                <div className="text-center p-16 text-muted-foreground border-2 border-dashed rounded-2xl bg-slate-50 flex flex-col items-center gap-3">
                                    <ArrowRightLeft className="w-10 h-10 text-slate-300" />
                                    <h4 className="font-bold text-slate-700 text-base">Nenhuma aula compatível no momento</h4>
                                    <p className="text-xs text-slate-500 max-w-sm">Não há outros docentes com aulas no mesmo turno e dia disponíveis para permuta direta.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                                    {compatibleSchedules.map((opt) => (
                                        <div 
                                            key={opt.id} 
                                            className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between transition-all hover:border-indigo-300 hover:shadow-md bg-white group hover:-translate-y-0.5 space-y-3"
                                        >
                                            <div>
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-mono font-bold">
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {format(opt.startTime.toDate(), "HH:mm")} - {format(opt.endTime.toDate(), "HH:mm")}
                                                    </Badge>
                                                </div>
                                                <h4 className="font-black text-slate-900 text-sm sm:text-base group-hover:text-indigo-700 transition-colors">
                                                    {opt.teacherName}
                                                </h4>
                                                <p className="text-xs font-semibold text-slate-700 mt-1 line-clamp-1">
                                                    {opt.className}
                                                </p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                    <MapPin className="w-3 h-3 text-slate-400" />
                                                    {opt.roomName}
                                                </p>
                                            </div>

                                            <Button
                                                onClick={() => handleOpenConfirm(opt)}
                                                disabled={sendingRequest}
                                                size="sm"
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-sm font-bold text-xs h-9 text-white gap-1.5"
                                            >
                                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                                Propor Troca
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="rooms" className="flex-1 min-h-0 overflow-hidden outline-none data-[state=inactive]:hidden flex flex-col">
                        <ScrollArea className="flex-1 pr-4">
                            {loadingRooms ? (
                                <div className="flex flex-col justify-center items-center h-64 text-slate-400 gap-3">
                                    <Loader className="w-8 h-8 animate-spin text-indigo-600" />
                                    <p className="text-sm font-medium">Buscando salas livres no horário...</p>
                                </div>
                            ) : vacantRooms.length === 0 ? (
                                <div className="text-center p-16 text-muted-foreground border-2 border-dashed rounded-2xl bg-slate-50 flex flex-col items-center gap-3">
                                    <MapPin className="w-10 h-10 text-slate-300" />
                                    <h4 className="font-bold text-slate-700 text-base">Não há salas vagas neste horário</h4>
                                    <p className="text-xs text-slate-500 max-w-sm">Todos os ambientes da unidade estão ocupados durante este período.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
                                    {vacantRooms.map((room) => (
                                        <div 
                                            key={room.id} 
                                            className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between transition-all hover:border-indigo-300 hover:shadow-md bg-white group hover:-translate-y-0.5 space-y-3"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-indigo-50 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0 border border-slate-100">
                                                    <MapPin className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-black text-slate-900 text-sm group-hover:text-indigo-700 transition-colors truncate">
                                                        {room.name}
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                        <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-tight bg-slate-50 text-slate-700">
                                                            {room.type || 'Sala'}
                                                        </Badge>
                                                        <span className="text-[11px] text-muted-foreground font-medium">
                                                            Cap: <strong>{room.capacity || '?'}</strong>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                onClick={() => handleRelocate(room)}
                                                disabled={sendingRequest}
                                                variant="outline"
                                                size="sm"
                                                className="w-full border-indigo-200 bg-indigo-50/50 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 font-bold text-xs h-9 text-indigo-700 uppercase transition-all shadow-sm"
                                            >
                                                Alocar Nesta Sala
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </DialogContent>

            {/* Modal de Confirmação com Caixa de Texto de Justificativa */}
            <Dialog open={isConfirmOpen} onOpenChange={(open) => !open && !sendingRequest && setIsConfirmOpen(false)}>
                <DialogContent className="max-w-md sm:max-w-lg p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                            <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                            Confirmar Proposta de Troca de Sala
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Informe a justificativa da troca para que o colega docente possa avaliar antes de aceitar.
                        </DialogDescription>
                    </DialogHeader>

                    {targetForSwap && (
                        <div className="space-y-4 my-2">
                            {/* Comparativo de Salas e Aulas */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                                <div className="flex items-start justify-between gap-3 text-xs">
                                    <div className="flex-1">
                                        <span className="text-[10px] uppercase font-bold text-indigo-700 block">Sua Aula Atual:</span>
                                        <p className="font-semibold text-slate-900 mt-0.5">{sourceSchedule.className}</p>
                                        <p className="text-slate-600 font-medium flex items-center gap-1 mt-0.5">
                                            <MapPin className="w-3 h-3 text-slate-400" />
                                            {sourceSchedule.roomName}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center p-2 rounded-full bg-indigo-100/70 text-indigo-600 shrink-0 self-center">
                                        <ArrowRightLeft className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 text-right">
                                        <span className="text-[10px] uppercase font-bold text-emerald-700 block">Aula do Colega:</span>
                                        <p className="font-semibold text-slate-900 mt-0.5">{targetForSwap.className}</p>
                                        <p className="text-slate-600 font-medium flex items-center justify-end gap-1 mt-0.5">
                                            <MapPin className="w-3 h-3 text-slate-400" />
                                            {targetForSwap.roomName}
                                        </p>
                                        <p className="text-[11px] text-slate-500 font-bold mt-0.5">{targetForSwap.teacherName}</p>
                                    </div>
                                </div>

                                <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-2.5 text-xs text-indigo-950 flex items-center gap-2">
                                    <span className="text-base shrink-0">💡</span>
                                    <span>
                                        Ao aceitar, sua aula será na sala <strong>{targetForSwap.roomName}</strong> e a aula de {targetForSwap.teacherName} será na sala <strong>{sourceSchedule.roomName}</strong>.
                                    </span>
                                </div>
                            </div>

                            {/* Caixa de Texto para Justificativa */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                                    <span>Justificativa da Troca <span className="text-rose-500">*</span></span>
                                    <span className="text-[10px] font-normal text-slate-400">Obrigatório</span>
                                </label>
                                <Textarea
                                    value={justification}
                                    onChange={(e) => setJustification(e.target.value)}
                                    placeholder="Ex: Necessidade de laboratório de informática para prática / Turma maior precisa de sala com maior capacidade / Adaptação pedagógica..."
                                    rows={4}
                                    className="text-xs resize-none focus-visible:ring-indigo-500"
                                    disabled={sendingRequest}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Esta justificativa será apresentada a <strong>{targetForSwap.teacherName}</strong> antes do aceite.
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex gap-2 sm:justify-end mt-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsConfirmOpen(false)}
                            disabled={sendingRequest}
                        >
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                            onClick={handleConfirmSend}
                            disabled={sendingRequest || !justification.trim()}
                        >
                            {sendingRequest ? (
                                <>
                                    <Loader className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                                    Confirmar e Enviar
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}
