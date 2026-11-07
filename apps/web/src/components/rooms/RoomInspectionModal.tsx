/**
 * @file RoomInspectionModal.tsx
 * @description Modal de Conferência e Cadeia de Custódia (Check-in na Entrada e Check-out na Saída).
 */

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { 
    RoomItemConfig, 
    ItemInspectionState, 
    getExpectedRoomItems, 
    saveRoomInspection,
    getLatestRoomInspection,
    uploadInspectionPhoto,
    RoomInspectionData 
} from "@/services/inspectionService";
import { 
    CheckCircle2, 
    AlertTriangle, 
    XCircle, 
    ShieldCheck, 
    Clock, 
    MapPin, 
    Sparkles, 
    Power, 
    Lock, 
    Lightbulb, 
    Monitor,
    Camera,
    Image as ImageIcon,
    Trash2,
    Upload,
    Loader2,
    Wrench,
    Box,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RoomInspectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: any;
    room?: any;
    type: "CHECK_IN" | "CHECK_OUT";
    onSuccess?: () => void;
}

export function RoomInspectionModal({
    isOpen,
    onClose,
    schedule,
    room,
    type,
    onSuccess
}: RoomInspectionModalProps) {
    const { toast } = useToast();
    const { currentUser } = useAuth();

    const [itemsState, setItemsState] = useState<ItemInspectionState[]>([]);
    const [turnOffChecks, setTurnOffChecks] = useState({
        acTurnedOff: true,
        projectorTurnedOff: true,
        lightsTurnedOff: true,
        doorLocked: false
    });
    const [generalObservation, setGeneralObservation] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [previousInspection, setPreviousInspection] = useState<RoomInspectionData | null>(null);
    const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);

    // Inicializa a lista de itens da sala
    useEffect(() => {
        if (!isOpen || !schedule) return;

        const expectedItems: RoomItemConfig[] = getExpectedRoomItems(room || { type: schedule.roomType, resources: schedule.resources });
        
        // Se já tiver conferência prévia salva ou carregar padrão
        const initialStates: ItemInspectionState[] = expectedItems.map(item => ({
            itemId: item.id,
            itemName: item.name,
            category: item.category,
            status: "ok",
            notes: "",
            subItems: item.subItems,
            subItemsDiscrepancy: []
        }));

        setItemsState(initialStates);
        setGeneralObservation("");
        setTurnOffChecks({
            acTurnedOff: true,
            projectorTurnedOff: true,
            lightsTurnedOff: true,
            doorLocked: false
        });

        // Buscar última vistoria da sala para referência
        if (schedule.roomId) {
            setIsLoadingPrevious(true);
            getLatestRoomInspection(schedule.roomId)
                .then(prev => setPreviousInspection(prev))
                .finally(() => setIsLoadingPrevious(false));
        }
    }, [isOpen, schedule, room]);

    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

    const handlePhotoUpload = async (index: number, file: File) => {
        if (!file) return;
        
        if (file.size > 10 * 1024 * 1024) {
            toast({
                title: "Arquivo muito grande",
                description: "A foto deve ter no máximo 10MB.",
                variant: "destructive"
            });
            return;
        }

        setUploadingIndex(index);
        try {
            const downloadUrl = await uploadInspectionPhoto(file, schedule.roomId || "general");
            setItemsState(prev => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    photoUrl: downloadUrl
                };
                return updated;
            });
            toast({
                title: "Foto Anexada",
                description: "Imagem do item anexada com sucesso."
            });
        } catch (error: any) {
            console.error("Erro no upload da foto:", error);
            toast({
                title: "Erro no Upload",
                description: "Não foi possível carregar a imagem.",
                variant: "destructive"
            });
        } finally {
            setUploadingIndex(null);
        }
    };

    const handleRemovePhoto = (index: number) => {
        setItemsState(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                photoUrl: undefined
            };
            return updated;
        });
    };

    const handleItemStatusChange = (index: number, newStatus: "ok" | "danificado" | "faltando") => {
        setItemsState(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                status: newStatus
            };
            return updated;
        });
    };

    const handleItemNoteChange = (index: number, note: string) => {
        setItemsState(prev => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                notes: note
            };
            return updated;
        });
    };

    const handleToggleSubItemDiscrepancy = (itemIndex: number, subItemName: string) => {
        setItemsState(prev => {
            const updated = [...prev];
            const item = updated[itemIndex];
            const currentDiscrepancies = item.subItemsDiscrepancy || [];
            const exists = currentDiscrepancies.includes(subItemName);
            const nextDiscrepancies = exists 
                ? currentDiscrepancies.filter(s => s !== subItemName)
                : [...currentDiscrepancies, subItemName];
            
            let newNotes = item.notes || "";
            if (nextDiscrepancies.length > 0) {
                newNotes = `Ferramenta(s) ${item.status === 'faltando' ? 'faltante(s)' : 'avariada(s)'}: ${nextDiscrepancies.join(', ')}`;
            }
            
            updated[itemIndex] = {
                ...item,
                subItemsDiscrepancy: nextDiscrepancies,
                notes: newNotes
            };
            return updated;
        });
    };

    const handleMarkAllAsOk = () => {
        setItemsState(prev => prev.map(item => ({
            ...item,
            status: "ok",
            notes: "",
            photoUrl: undefined
        })));
        toast({
            title: "Todos os itens marcados como Conforme",
            description: "Equipamentos definidos como 100% OK."
        });
    };

    const handleSave = async () => {
        if (!schedule) return;

        // Validar se os itens marcados como danificado/faltando possuem nota explicativa
        const invalidItem = itemsState.find(it => it.status !== "ok" && (!it.notes || it.notes.trim().length < 3));
        if (invalidItem) {
            toast({
                title: "Descrição Necessária",
                description: `Por favor, informe um breve detalhe sobre o item "${invalidItem.itemName}" marcado como ${invalidItem.status}.`,
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        try {
            const discrepancies = itemsState.filter(it => it.status !== "ok");
            const hasDiscrepancy = discrepancies.length > 0;

            const payload: RoomInspectionData = {
                scheduleId: schedule.id,
                roomId: schedule.roomId,
                roomName: schedule.roomName || room?.name || "Ambiente",
                unitId: schedule.unitId || "caceres",
                teacherId: schedule.teacherId || currentUser?.uid || "docente",
                teacherName: schedule.teacherName || currentUser?.displayName || "Professor",
                className: schedule.className || "Aula",
                type,
                itemsState,
                turnOffChecks: type === "CHECK_OUT" ? turnOffChecks : undefined,
                generalObservation: generalObservation.trim() || undefined,
                hasDiscrepancy,
                previousInspectionId: previousInspection?.id,
                previousTeacherName: previousInspection?.teacherName
            };

            const result = await saveRoomInspection(payload, currentUser);

            if (result.createdIssuesCount > 0) {
                toast({
                    title: "Vistoria Salva com Ocorrências",
                    description: `${result.createdIssuesCount} chamado(s) de manutenção aberto(s) automaticamente para a equipe técnica. Sua responsabilidade foi devidamente resguardada.`,
                });
            } else {
                toast({
                    title: `Vistoria de ${type === "CHECK_IN" ? "Entrada" : "Saída"} Concluída`,
                    description: "Ambiente e equipamentos conferidos com 100% de conformidade."
                });
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Erro ao salvar vistoria:", error);
            toast({
                title: "Erro ao Salvar",
                description: error?.message || "Não foi possível gravar a conferência.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!schedule) return null;

    const discrepanciesCount = itemsState.filter(it => it.status !== "ok").length;
    const isCheckIn = type === "CHECK_IN";

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                {/* Header com visual moderno */}
                <div className={`p-6 text-white ${isCheckIn ? 'bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800' : 'bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-white/15 backdrop-blur-md rounded-lg">
                                <ShieldCheck className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                                    {isCheckIn ? "Check-in de Entrada (Vistoria Inicial)" : "Check-out de Saída (Devolução e Fechamento)"}
                                </DialogTitle>
                                <DialogDescription className="text-blue-100/90 text-xs">
                                    Conferência de integridade e custódia patrimonial da sala
                                </DialogDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-xs font-mono">
                            {isCheckIn ? "ENTRADA" : "SAÍDA"}
                        </Badge>
                    </div>

                    {/* Informações da Aula e Sala */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/20 text-xs">
                        <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-blue-200" />
                            <span className="font-semibold truncate">{schedule.roomName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-blue-200" />
                            <span className="truncate">{schedule.className || "Reserva"}</span>
                        </div>
                        <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5 text-blue-100">
                            <span>Prof: {schedule.teacherName || "Docente"}</span>
                        </div>
                    </div>
                </div>

                {/* Conteúdo com Scroll */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Alerta de Cadeia de Custódia */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-900">
                        <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold">Garantia de Custódia: </span>
                            {isCheckIn 
                                ? "Ao reportar itens faltantes ou danificados na entrada, o sistema isenta você de qualquer responsabilidade e notifica a equipe de TI/Apoio."
                                : "Ao realizar o check-out, você formaliza a devolução da sala em perfeito estado ou registra qualquer avaria ocorrida durante o período."}
                            {previousInspection && isCheckIn && (
                                <p className="mt-1 text-[11px] text-blue-700">
                                    Último check-out nesta sala realizado por: <strong>{previousInspection.teacherName}</strong>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Barra de Ações Rápidas */}
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-indigo-600" /> Itens e Equipamentos da Sala
                        </h4>
                        {itemsState.length > 0 && (
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="outline" 
                                onClick={handleMarkAllAsOk}
                                className="h-8 text-xs font-semibold text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 gap-1.5"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                Marcar Todos como Conforme (OK)
                            </Button>
                        )}
                    </div>

                    {/* Lista de Itens com 3 Estados */}
                    <div className="space-y-3">
                        {itemsState.length === 0 ? (
                            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-muted-foreground bg-slate-50/50">
                                Nenhum equipamento registrado no inventário para este ambiente.
                            </div>
                        ) : (
                            itemsState.map((item, idx) => (
                            <div 
                                key={item.itemId || idx}
                                className={`p-3.5 rounded-xl border transition-all ${
                                    item.status === 'ok' 
                                        ? 'bg-slate-50/70 border-slate-200' 
                                        : item.status === 'danificado' 
                                            ? 'bg-amber-50/80 border-amber-300 shadow-sm' 
                                            : 'bg-red-50/80 border-red-300 shadow-sm'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                    <div>
                                        <span className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                                            {item.subItems && item.subItems.length > 0 && (
                                                <Wrench className="h-3.5 w-3.5 text-indigo-600" />
                                            )}
                                            {item.itemName}
                                        </span>
                                        {item.subItems && item.subItems.length > 0 && (
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                Caixa / Kit com {item.subItems.length} ferramentas registradas
                                            </p>
                                        )}
                                    </div>

                                    {/* Seletor de 3 Estados (Pills) */}
                                    <div className="inline-flex rounded-lg p-1 bg-slate-200/80 gap-1 shrink-0 self-start sm:self-auto">
                                        <button
                                            type="button"
                                            onClick={() => handleItemStatusChange(idx, "ok")}
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-all ${
                                                item.status === "ok"
                                                    ? "bg-emerald-600 text-white shadow-sm"
                                                    : "text-slate-600 hover:text-slate-900"
                                            }`}
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" /> OK
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleItemStatusChange(idx, "danificado")}
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-all ${
                                                item.status === "danificado"
                                                    ? "bg-amber-600 text-white shadow-sm"
                                                    : "text-slate-600 hover:text-slate-900"
                                            }`}
                                        >
                                            <AlertTriangle className="h-3.5 w-3.5" /> Danificado
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleItemStatusChange(idx, "faltando")}
                                            className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-all ${
                                                item.status === "faltando"
                                                    ? "bg-red-600 text-white shadow-sm"
                                                    : "text-slate-600 hover:text-slate-900"
                                            }`}
                                        >
                                            <XCircle className="h-3.5 w-3.5" /> Faltando
                                        </button>
                                    </div>
                                </div>

                                {/* Campo para notas, subitens e foto se houver problema */}
                                {item.status !== "ok" && (
                                    <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-3 animate-in fade-in slide-in-from-top-1">
                                        {/* Seletor específico de ferramentas da caixa quando houver subitens */}
                                        {item.subItems && item.subItems.length > 0 && (
                                            <div className="space-y-1.5 p-2.5 bg-white/90 border border-slate-200 rounded-lg">
                                                <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                    <Wrench className="h-3.5 w-3.5 text-indigo-600" />
                                                    Marque a(s) ferramenta(s) da caixa com problema:
                                                </Label>
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {item.subItems.map((sub, sIdx) => {
                                                        const isSelected = (item.subItemsDiscrepancy || []).includes(sub);
                                                        return (
                                                            <button
                                                                key={sIdx}
                                                                type="button"
                                                                onClick={() => handleToggleSubItemDiscrepancy(idx, sub)}
                                                                className={`px-2 py-1 text-xs rounded-md font-medium border transition-all flex items-center gap-1 ${
                                                                    isSelected
                                                                        ? item.status === "faltando"
                                                                            ? "bg-red-600 text-white border-red-700 shadow-xs"
                                                                            : "bg-amber-600 text-white border-amber-700 shadow-xs"
                                                                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                                                }`}
                                                            >
                                                                {isSelected ? <XCircle className="h-3 w-3" /> : <Box className="h-3 w-3 text-slate-400" />}
                                                                <span>{sub}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <Label className="text-xs font-bold text-slate-700">
                                                {item.status === "danificado" ? "Detalhes da avaria / defeito:" : "Observação sobre o item faltante:"}
                                            </Label>
                                            <Input
                                                placeholder={item.status === "danificado" ? "Ex: Botão quebrado, cabo rompido, display com defeito..." : "Ex: Não encontrado na bancada nem no armário..."}
                                                value={item.notes || ""}
                                                onChange={(e) => handleItemNoteChange(idx, e.target.value)}
                                                className="mt-1 h-8 text-xs bg-white"
                                            />
                                        </div>

                                        {/* Upload de Foto da Avaria / Item */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Camera className="h-4 w-4 text-indigo-600 shrink-0" />
                                                <span className="text-xs font-semibold text-slate-700">Foto / Comprovante do Item:</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {item.photoUrl ? (
                                                    <div className="flex items-center gap-2">
                                                        <a 
                                                            href={item.photoUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="relative group block shrink-0"
                                                            title="Clique para ver imagem ampliada"
                                                        >
                                                            <img 
                                                                src={item.photoUrl} 
                                                                alt="Foto da Avaria" 
                                                                className="h-10 w-10 object-cover rounded-md border border-indigo-200 shadow-sm group-hover:scale-105 transition-transform" 
                                                            />
                                                            <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold">
                                                                Ver
                                                            </div>
                                                        </a>
                                                        <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Foto anexada
                                                        </span>
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => handleRemovePhoto(idx)}
                                                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            title="Remover foto"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            capture="environment"
                                                            id={`photo-upload-${idx}`}
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handlePhotoUpload(idx, file);
                                                            }}
                                                        />
                                                        <label htmlFor={`photo-upload-${idx}`}>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={uploadingIndex === idx}
                                                                className="h-8 text-xs font-semibold text-indigo-700 bg-indigo-50/80 border-indigo-200 hover:bg-indigo-100 gap-1.5 cursor-pointer shadow-sm"
                                                                asChild
                                                            >
                                                                <span>
                                                                    {uploadingIndex === idx ? (
                                                                        <>
                                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            Enviando foto...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Camera className="h-3.5 w-3.5" />
                                                                            Tirar / Anexar Foto
                                                                        </>
                                                                    )}
                                                                </span>
                                                            </Button>
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    </div>

                    {/* Procedimento Operacional de Saída (Apenas no Check-out) */}
                    {!isCheckIn && (
                        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                                <Power className="h-4 w-4 text-emerald-700" /> Procedimentos de Fechamento do Ambiente
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox 
                                        checked={turnOffChecks.acTurnedOff}
                                        onCheckedChange={(c) => setTurnOffChecks(prev => ({ ...prev, acTurnedOff: !!c }))}
                                    />
                                    <span>Ar Condicionado desligado</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox 
                                        checked={turnOffChecks.projectorTurnedOff}
                                        onCheckedChange={(c) => setTurnOffChecks(prev => ({ ...prev, projectorTurnedOff: !!c }))}
                                    />
                                    <span>Projetor / Data Show desligado</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox 
                                        checked={turnOffChecks.lightsTurnedOff}
                                        onCheckedChange={(c) => setTurnOffChecks(prev => ({ ...prev, lightsTurnedOff: !!c }))}
                                    />
                                    <span>Luzes apagadas</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox 
                                        checked={turnOffChecks.doorLocked}
                                        onCheckedChange={(c) => setTurnOffChecks(prev => ({ ...prev, doorLocked: !!c }))}
                                    />
                                    <span>Portas e janelas fechadas</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Observações Gerais */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">Observações Adicionais (Opcional)</Label>
                        <Textarea 
                            placeholder="Comentários sobre a organização, limpeza ou estado geral da sala..."
                            value={generalObservation}
                            onChange={(e) => setGeneralObservation(e.target.value)}
                            className="text-xs min-h-[60px]"
                        />
                    </div>
                </div>

                {/* Footer com Ações */}
                <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
                    <div className="text-xs">
                        {discrepanciesCount > 0 ? (
                            <span className="font-bold text-red-600 flex items-center gap-1">
                                <AlertTriangle className="h-4 w-4" /> {discrepanciesCount} ocorrência(s) detectada(s)
                            </span>
                        ) : (
                            <span className="font-medium text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> Todos os itens em conformidade
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
                            Cancelar
                        </Button>
                        <Button 
                            size="sm" 
                            onClick={handleSave} 
                            disabled={isSaving}
                            className={discrepanciesCount > 0 ? "bg-amber-600 hover:bg-amber-700 text-white" : isCheckIn ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Gravando...
                                </>
                            ) : (
                                isCheckIn ? "Confirmar Check-in de Entrada" : "Confirmar Check-out de Saída"
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
