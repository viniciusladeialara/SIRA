import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useToast } from "@/components/ui/use-toast";
import { createTeacherReservation } from "@/services/reservationService";

import { Loader, CalendarPlus, Clock, Info, GraduationCap } from "lucide-react";
import { createLocalDate } from "@/lib/dateUtils";

interface RoomReservationModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableRooms: { id: string; name: string }[];
    teacherClasses: { id: string; name: string; courseName?: string; unitName?: string }[];
    onSuccess: () => void;
    initialValues?: {
        roomId?: string;
        date?: string;
        startTime?: string;
        endTime?: string;
        classId?: string;
        observation?: string;
    };
}

export function RoomReservationModal({
    isOpen,
    onClose,
    availableRooms,
    teacherClasses,
    onSuccess,
    initialValues
}: RoomReservationModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [roomId, setRoomId] = useState("");
    const [classId, setClassId] = useState("");
    const [date, setDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [observation, setObservation] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        setRoomId(initialValues?.roomId ?? "");
        setClassId(initialValues?.classId ?? "");
        setDate(initialValues?.date ?? "");
        setStartTime(initialValues?.startTime ?? "");
        setEndTime(initialValues?.endTime ?? "");
        setObservation(initialValues?.observation ?? "");
    }, [initialValues, isOpen]);

    const selectedRoomName = useMemo(
        () => availableRooms.find((room) => room.id === roomId)?.name,
        [availableRooms, roomId]
    );

    const selectedClass = useMemo(
        () => teacherClasses.find((item) => item.id === classId),
        [teacherClasses, classId]
    );

    const selectedClassName = selectedClass?.name;
    const selectedCourseName = selectedClass?.courseName;

    const handleReserve = async () => {
        const normalizedClassId = classId === "none" ? "" : classId;
        const trimmedObservation = observation.trim();

        if (!roomId) {
            toast({ title: "Erro", description: "Selecione a sala.", variant: "destructive" });
            return;
        }
        if (!date || !startTime || !endTime) {
            toast({ title: "Erro", description: "Preencha a data e o horario.", variant: "destructive" });
            return;
        }
        if (endTime <= startTime) {
            toast({ title: "Erro", description: "O horario de fim precisa ser maior que o horario de inicio.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const startDateTime = createLocalDate(date, startTime).toISOString();
            const endDateTime = createLocalDate(date, endTime).toISOString();

            await createTeacherReservation({
                roomId,
                classId: normalizedClassId || null,
                scheduleSlots: [{ startTime: startDateTime, endTime: endDateTime }],
                observation: trimmedObservation || undefined
            });

            toast({ title: "Sucesso!", description: "Sua reserva foi criada." });
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Erro ao reservar sala",
                description: error.message || "Verifique se o horario ja esta em uso.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarPlus className="h-5 w-5" /> Reservar Sala
                    </DialogTitle>
                    <DialogDescription>
                        Criar um agendamento novo como professor. Conflitos de horário são permitidos, mas serão sinalizados para análise no Painel de Conflitos.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {(selectedRoomName || selectedClassName || date) && (
                        <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <div className="flex items-start gap-2">
                                <Info className="mt-0.5 h-4 w-4 text-slate-500" />
                                <div className="space-y-1">
                                    <p className="font-medium text-slate-900">Resumo da reserva</p>
                                    <p>
                                        {selectedRoomName || "Escolha um ambiente"}
                                        {date ? ` em ${date}` : ""}
                                        {startTime && endTime ? `, das ${startTime} as ${endTime}` : ""}
                                    </p>
                                    <p className="text-slate-500 flex items-center gap-1">
                                        {selectedClassName || "Sem turma vinculada"}
                                        {selectedCourseName && (
                                            <>
                                                <span className="mx-1">•</span>
                                                <span className="flex items-center gap-0.5"><GraduationCap className="h-3 w-3" /> {selectedCourseName}</span>
                                            </>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Turma / Disciplina (Opcional)</Label>
                        <Select value={classId || "none"} onValueChange={setClassId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a disciplina/turma" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhuma (Atividade Extra)</SelectItem>
                                {teacherClasses.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        <div className="flex flex-col">
                                            <span>{c.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{c.courseName || "Sem Curso"}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Ambiente (Sala/Lab)</Label>
                        <Select value={roomId} onValueChange={setRoomId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a sala..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableRooms.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Data</Label>
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Inicio</Label>
                            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Fim</Label>
                            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Observacao (Opcional)</Label>
                        <Textarea
                            placeholder="Exemplo: Preciso testar os computadores com os alunos."
                            value={observation}
                            onChange={(e) => setObservation(e.target.value)}
                            maxLength={250}
                            className="min-h-[96px]"
                        />
                        <p className="text-xs text-muted-foreground text-right">{observation.trim().length}/250</p>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handleReserve} disabled={loading}>
                        {loading ? <Loader className="animate-spin w-4 h-4 mr-2" /> : null}
                        Confirmar Reserva
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
