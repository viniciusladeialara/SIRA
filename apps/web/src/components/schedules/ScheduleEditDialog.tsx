import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { createLocalDate } from "@/lib/dateUtils";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/AuthContext";
import { logAction, AuditAction } from "@/lib/AuditLog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { updateSchedule } from "@/services/scheduleService";
import { Timestamp } from "@/lib/sira-sql-adapter";
import { Search, AlertCircle, XCircle, Calendar, Download, CalendarClock } from "lucide-react";
import { getUnitName } from "@/lib/utils";
import { generateGoogleCalendarUrl, downloadIcsFile } from "@/lib/calendarExport";

interface Class { id: string; name: string; teacherIds: string[]; teacherNames: string[]; period: string; }
interface Room { id: string; name: string; block: string; }
interface Teacher { id: string; name: string; }
interface Schedule { 
    id: string; 
    className: string; 
    roomName: string; 
    teacherName: string; 
    startTime: any; 
    endTime: any; 
    roomId: string; 
    teacherId: string; 
    classId: string; 
    observation?: string; 
}

interface ScheduleEditDialogProps {
    schedule: Schedule | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    classes: Class[];
    teachers: Teacher[];
    rooms: Room[];
    schedules: Schedule[];
}

const getTurnoFromHour = (hour: number): string => {
    if (hour >= 7 && hour < 12) return 'matutino';
    if (hour >= 13 && hour < 18) return 'vespertino';
    return 'noturno';
};

const calculateDurationInHours = (startTime: Date, endTime: Date): number => {
    return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
};

const toJsDate = (value: any): Date => {
    if (!value) return new Date();
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    return new Date(value);
};

export function ScheduleEditDialog({ schedule, open, onOpenChange, classes, teachers, rooms, schedules }: ScheduleEditDialogProps) {
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const { isUserAdmin, isUserOperational } = usePermissions();
    const isAdmin = isUserAdmin() || isUserOperational();
    
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        classId: '',
        teacherId: '',
        roomId: '',
        date: '',
        startTime: '',
        endTime: '',
        observation: ''
    });
    const [profSearch, setProfSearch] = useState("");

    const filteredTeachers = React.useMemo(() => {
        if (!formData.classId || !classes.length || !teachers.length) return [];
        const selectedClass = classes.find(c => c.id === formData.classId);
        
        if (!selectedClass || !selectedClass.teacherIds || !Array.isArray(selectedClass.teacherIds)) {
            return teachers.filter(t => t.name.toLowerCase().includes(profSearch.toLowerCase()));
        }

        const classTeachers = teachers.filter(teacher => selectedClass.teacherIds.includes(teacher.id));
        
        if (!profSearch) return classTeachers;
        return classTeachers.filter(t => t.name.toLowerCase().includes(profSearch.toLowerCase()));
    }, [formData.classId, classes, teachers, profSearch]);

    useEffect(() => {
        if (schedule) {
            const start = toJsDate(schedule.startTime);
            const end = toJsDate(schedule.endTime);
            setFormData({
                classId: schedule.classId || '',
                teacherId: schedule.teacherId || '',
                roomId: schedule.roomId || '',
                date: format(start, 'yyyy-MM-dd'),
                startTime: format(start, 'HH:mm'),
                endTime: format(end, 'HH:mm'),
                observation: schedule.observation || ''
            });
        }
    }, [schedule]);

    // Validação preventiva em tempo real de conflitos na edição
    const editConflicts = React.useMemo(() => {
        if (!schedule || !formData.date || !formData.startTime || !formData.endTime || !formData.roomId) {
            return [];
        }
        try {
            const start = createLocalDate(formData.date, formData.startTime);
            const end = createLocalDate(formData.date, formData.endTime);
            if (start >= end) {
                return ["O horário de término deve ser posterior ao horário de início."];
            }

            const errors: string[] = [];
            for (const other of schedules) {
                if (other.id === schedule.id) continue;
                const oStart = toJsDate(other.startTime);
                const oEnd = toJsDate(other.endTime);

                const overlaps = (start < oEnd && end > oStart);
                if (overlaps) {
                    if (other.roomId === formData.roomId) {
                        errors.push(`Ambiente ocupado por "${other.className || other.roomName || 'Reserva'}" (${format(oStart, 'HH:mm')} - ${format(oEnd, 'HH:mm')})`);
                    }
                    if (formData.teacherId && formData.teacherId !== 'direct_booking' && other.teacherId === formData.teacherId) {
                        errors.push(`Professor "${other.teacherName}" já possui aula (${format(oStart, 'HH:mm')} - ${format(oEnd, 'HH:mm')})`);
                    }
                    if (formData.classId && formData.classId !== 'direct_booking' && other.classId === formData.classId) {
                        errors.push(`Turma "${other.className}" já possui aula (${format(oStart, 'HH:mm')} - ${format(oEnd, 'HH:mm')})`);
                    }
                }
            }
            return errors;
        } catch (e) {
            return [];
        }
    }, [schedule, formData, schedules]);

    const handleSave = async () => {
        if (!schedule) return;
        if (editConflicts.length > 0) {
            toast({
                title: "Edição Bloqueada",
                description: "Não é possível salvar enquanto houver conflito de horários.",
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        try {
            const start = createLocalDate(formData.date, formData.startTime);
            const end = createLocalDate(formData.date, formData.endTime);
            
            const selectedClass = classes.find(c => c.id === formData.classId);
            const selectedTeacher = teachers.find(t => t.id === formData.teacherId);
            const selectedRoom = rooms.find(r => r.id === formData.roomId);

            await updateSchedule(schedule.id, {
                classId: formData.classId,
                className: selectedClass?.name || schedule.className,
                teacherId: formData.teacherId,
                teacherName: selectedTeacher?.name || schedule.teacherName,
                roomId: formData.roomId,
                roomName: selectedRoom?.name || schedule.roomName,
                startTime: Timestamp.fromDate(start),
                endTime: Timestamp.fromDate(end),
                observation: formData.observation,
                unitId: (schedule as any).unitId || (selectedClass as any)?.unitId || "caceres",
                unitName: (schedule as any).unitName || (selectedClass as any)?.unitName || getUnitName((schedule as any).unitId || (selectedClass as any)?.unitId || "caceres")
            });

            if (currentUser) {
                await logAction(
                    AuditAction.UPDATE_SCHEDULE,
                    currentUser as any,
                    `Atualizado agendamento: ${selectedClass?.name || schedule.className} em ${selectedRoom?.name || schedule.roomName}`,
                    { 
                        scheduleId: schedule.id, 
                        before: schedule, 
                        after: {
                            classId: formData.classId,
                            teacherId: formData.teacherId,
                            roomId: formData.roomId,
                            startTime: start,
                            endTime: end
                        }
                    }
                );
            }

            toast({ title: "Sucesso", description: "Agendamento atualizado com sucesso." });
            onOpenChange(false);
        } catch (error: any) {
            console.error(error);
            toast({ 
                title: "Alteração Não Permitida", 
                description: error.message || "Erro ao atualizar agendamento.", 
                variant: "destructive" 
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] w-full max-h-[92vh] flex flex-col p-6 overflow-hidden">
                <DialogHeader className="shrink-0 pb-1">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <CalendarClock className="h-5 w-5 text-primary" />
                        Editar Agendamento
                    </DialogTitle>
                    <DialogDescription>
                        Altere os detalhes do agendamento abaixo. Conflitos de horário são bloqueados automaticamente.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="class" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Turma</Label>
                        <Select value={formData.classId} onValueChange={(val) => {
                            setFormData(f => ({ ...f, classId: val, teacherId: '' }));
                            setProfSearch("");
                        }}>
                            <SelectTrigger id="class">
                                <SelectValue placeholder="Selecione a turma" />
                            </SelectTrigger>
                            <SelectContent>
                                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                {formData.classId === 'direct_booking' && (
                                    <SelectItem value="direct_booking">Reserva Direta ({schedule?.className || 'Evento'})</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="teacher" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Professor</Label>
                        <Select value={formData.teacherId} onValueChange={(val) => setFormData(f => ({ ...f, teacherId: val }))} disabled={!formData.classId}>
                            <SelectTrigger id="teacher">
                                <SelectValue placeholder={formData.classId ? "Selecione o professor" : "Selecione a turma"} />
                            </SelectTrigger>
                            <SelectContent>
                                <div className="flex items-center px-3 pb-2 border-b">
                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <input
                                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Buscar professor..."
                                        value={profSearch}
                                        onChange={(e) => setProfSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="max-h-[200px] overflow-y-auto pt-1">
                                    {formData.teacherId === 'direct_booking' && (
                                        <SelectItem value="direct_booking">Reserva Direta ({schedule?.teacherName || 'Sem Professor'})</SelectItem>
                                    )}
                                    {filteredTeachers.length > 0 ? (
                                        filteredTeachers.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))
                                    ) : (
                                        formData.teacherId !== 'direct_booking' && (
                                            <div className="py-4 text-center text-sm text-muted-foreground">
                                                {formData.classId ? "Nenhum professor habilitado encontrado." : "Selecione uma turma primeiro."}
                                            </div>
                                        )
                                    )}
                                </div>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="room" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Ambiente</Label>
                        <Select value={formData.roomId} onValueChange={(val) => setFormData(f => ({ ...f, roomId: val }))}>
                            <SelectTrigger id="room">
                                <SelectValue placeholder="Selecione o ambiente" />
                            </SelectTrigger>
                            <SelectContent>
                                {rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name} (Bloco {r.block})</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="date" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Data</Label>
                        <Input id="date" type="date" value={formData.date} onChange={e => setFormData(f => ({ ...f, date: e.target.value }))} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="startTime" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Início</Label>
                            <Input id="startTime" type="time" value={formData.startTime} onChange={e => setFormData(f => ({ ...f, startTime: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="endTime" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Fim</Label>
                            <Input id="endTime" type="time" value={formData.endTime} onChange={e => setFormData(f => ({ ...f, endTime: e.target.value }))} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="observation" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Observação</Label>
                            <span className="text-[10px] text-muted-foreground">{formData.observation.length}/100</span>
                        </div>
                        <Input 
                            id="observation" 
                            value={formData.observation} 
                            onChange={e => setFormData(f => ({ ...f, observation: e.target.value }))} 
                            maxLength={100} 
                            placeholder="Observações adicionais (opcional)" 
                        />
                    </div>

                    {editConflicts.length > 0 && (
                        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg space-y-1.5 animate-in fade-in">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-red-800 dark:text-red-400">
                                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                                <span>Conflito Detectado:</span>
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-xs text-red-700 dark:text-red-300">
                                {editConflicts.map((err, idx) => (
                                    <li key={idx}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Sincronização / Exportação */}
                <div className="shrink-0 pt-3 border-t mt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 px-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            Exportar:
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2.5 gap-1.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                onClick={() => {
                                    if (!schedule) return;
                                    const url = generateGoogleCalendarUrl(schedule as any);
                                    window.open(url, "_blank", "noopener,noreferrer");
                                }}
                            >
                                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                                Google Agenda
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2.5 gap-1.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
                                onClick={() => {
                                    if (!schedule) return;
                                    downloadIcsFile([schedule as any], `${schedule.className || 'evento'}.ics`);
                                }}
                            >
                                <Download className="h-3.5 w-3.5 text-emerald-600" />
                                Baixar .ics
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="shrink-0 pt-3 border-t mt-2 flex flex-row justify-end items-center gap-2 sm:space-x-0">
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => onOpenChange(false)} 
                        disabled={isSaving}
                    >
                        Cancelar
                    </Button>
                    <Button 
                        type="button" 
                        onClick={handleSave} 
                        disabled={isSaving || editConflicts.length > 0} 
                        className={editConflicts.length > 0 ? "opacity-50 cursor-not-allowed" : ""}
                    >
                        {isSaving ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
