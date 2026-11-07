import React, { useState, useMemo } from "react";
import { format, getHours, isSameDay } from "date-fns";
import { Plus } from "lucide-react";
import { createLocalDate } from "@/lib/dateUtils";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/lib/AuthContext";
import { logAction, AuditAction } from "@/lib/AuditLog";
import { getUnitName, formatDisplayName } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

import { createScheduleBatch } from "@/services/scheduleService";
import { ScheduleForm } from "./ScheduleForm";
import { ScheduleConflictPanel, ValidationResult } from "./ScheduleConflictPanel";

interface Class { id: string; name: string; teacherIds: string[]; teacherNames: string[]; period: string; courseId?: string; courseName?: string; }
interface Room { id: string; name: string; block: string; floor: string; type: string; capacity: number; }
interface Teacher { id: string; name: string; }
interface Schedule { id: string; className: string; roomName: string; teacherName: string; startTime: any; endTime: any; roomId: string; teacherId: string; classId: string; observation?: string; }
interface Holiday { id: string; name: string; date: any; }

interface ScheduleCreationModalProps {
    classes: Class[];
    teachers: Teacher[];
    rooms: Room[];
    availableBlocks: string[];
    schedules: Schedule[];
    shifts?: string[];
    holidays?: Holiday[];
}

export function ScheduleCreationModal({ classes, teachers, rooms, availableBlocks, schedules, shifts, holidays = [] }: ScheduleCreationModalProps) {
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const { isUserAdmin, isUserOperational, userData } = usePermissions();
    const selectedUnitId = userData?.selectedUnitId || "caceres";
    const isAdmin = isUserAdmin() || isUserOperational();
    
    const [open, setOpen] = useState(false);

    // Internal States
    const [formData, setFormData] = useState({ classId: '', professorId: '', blockId: '', environmentId: '', startDate: '', endDate: '', observation: '', isDirectBooking: false, customEventName: '' });
    const [currentAllocation, setCurrentAllocation] = useState({ unitId: '', startTime: '', endTime: '', daysOfWeek: [] as number[] });
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const getShiftOrder = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes("matutino") || lower.includes("morning")) return 1;
        if (lower.includes("vespertino") || lower.includes("afternoon")) return 2;
        if (lower.includes("noturno") || lower.includes("night")) return 3;
        return 4;
    };
    const shiftsList = (shifts || ["Matutino", "Vespertino", "Noturno"])
        .slice()
        .sort((a, b) => getShiftOrder(a) - getShiftOrder(b));

    // Helpers
    const getTurnoFromHour = (hour: number): string => {
        let base = 'noturno';
        if (hour >= 7 && hour < 12) base = 'matutino';
        else if (hour >= 13 && hour < 18) base = 'vespertino';
        
        const matched = shiftsList.find(s => s.toLowerCase().includes(base));
        return matched ? matched.toLowerCase() : (shiftsList[0]?.toLowerCase() || base);
    };

    const calculateDurationInHours = (startTime: Date, endTime: Date): number => {
        return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    };

    const resetNewScheduleForm = () => {
        setFormData({ classId: '', professorId: '', blockId: '', environmentId: '', startDate: '', endDate: '', observation: '', isDirectBooking: false, customEventName: '' });
        setCurrentAllocation({ unitId: '', startTime: '', endTime: '', daysOfWeek: [] });
        setValidationResult(null);
    };

    // Validations (simulated frontend validation parity + intra-batch checks)
    const validateScheduleConflicts = (newSchedules: any[], existingSchedules: Schedule[], teacherId: string, roomId: string, classId: string): ValidationResult => {
        const errors: string[] = [];
        const warnings: string[] = [];

        // 0. Validação Intra-Lote (conflito entre os slots gerados na própria seleção)
        for (let i = 0; i < newSchedules.length; i++) {
            const startA = new Date(newSchedules[i].startTime).getTime();
            const endA = new Date(newSchedules[i].endTime).getTime();
            for (let j = i + 1; j < newSchedules.length; j++) {
                const startB = new Date(newSchedules[j].startTime).getTime();
                const endB = new Date(newSchedules[j].endTime).getTime();
                if (startA < endB && endA > startB) {
                    errors.push(`Conflito Interno: Há horários sobrepostos selecionados no dia ${format(new Date(startA), 'dd/MM/yyyy')}.`);
                }
            }
        }

        for (const newSchedule of newSchedules) {
            const newStartTime = new Date(newSchedule.startTime);
            const newEndTime = new Date(newSchedule.endTime);

            for (const existingSchedule of existingSchedules) {
                const existingStartTime = existingSchedule.startTime?.toDate ? existingSchedule.startTime.toDate() : new Date(existingSchedule.startTime);
                const existingEndTime = existingSchedule.endTime?.toDate ? existingSchedule.endTime.toDate() : new Date(existingSchedule.endTime);

                const isOverlapping = (newStartTime < existingEndTime && newEndTime > existingStartTime);

                if (isOverlapping) {
                    // 1. Conflito de Ambiente (Mesmo ambiente no mesmo horário)
                    if (existingSchedule.roomId === roomId) {
                        errors.push(`Ambiente Ocupado: "${existingSchedule.roomName || 'Selecionado'}" já reservado em ${format(newStartTime, 'dd/MM')} das ${format(existingStartTime, 'HH:mm')} às ${format(existingEndTime, 'HH:mm')}`);
                    }

                    // 2. Conflito de Professor (Apenas se um professor real for selecionado)
                    if (teacherId && teacherId !== 'direct_booking' && existingSchedule.teacherId === teacherId) {
                        errors.push(`Professor Ocupado: "${existingSchedule.teacherName || 'Selecionado'}" já tem aula em ${format(newStartTime, 'dd/MM')} das ${format(existingStartTime, 'HH:mm')} às ${format(existingEndTime, 'HH:mm')}`);
                    }

                    // 3. Conflito de Turma (Apenas se for aula de turma real, ignorando Reserva Direta)
                    if (classId && classId !== 'direct_booking' && existingSchedule.classId === classId) {
                        errors.push(`Turma Ocupada: "${existingSchedule.className || 'Selecionada'}" já tem aula em ${format(newStartTime, 'dd/MM')} das ${format(existingStartTime, 'HH:mm')} às ${format(existingEndTime, 'HH:mm')}`);
                    }
                }
            }
        }
        return { isValid: errors.length === 0, errors, warnings };
    };

    const runValidations = () => {
        const hasRequired = formData.isDirectBooking
            ? (formData.customEventName && formData.environmentId && formData.startDate && currentAllocation.startTime && currentAllocation.endTime && currentAllocation.daysOfWeek.length > 0)
            : (formData.classId && formData.professorId && formData.environmentId && formData.startDate && currentAllocation.startTime && currentAllocation.endTime && currentAllocation.daysOfWeek.length > 0);

        if (!hasRequired) {
            return;
        }

        setIsValidating(true);
        const startDate = new Date(formData.startDate + 'T00:00:00');
        const endDate = formData.endDate ? new Date(formData.endDate + 'T00:00:00') : startDate;

        let allDaysInRange: Date[] = [];
        for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
            allDaysInRange.push(new Date(dt));
        }

        const scheduleSlots: { startTime: string; endTime: string }[] = [];
        const detectedHolidays: string[] = [];

        currentAllocation.daysOfWeek.forEach(dayOfWeek => {
            const daysForThisAlloc = allDaysInRange.filter(day => day.getDay() === Number(dayOfWeek));
            daysForThisAlloc.forEach(day => {
                // Checa se o dia é feriado cadastrado
                const holidayMatch = holidays.find(h => {
                    const hDate = h.date && typeof h.date.toDate === 'function' ? h.date.toDate() : (h.date instanceof Date ? h.date : new Date(h.date));
                    return isSameDay(hDate, day);
                });

                if (holidayMatch) {
                    detectedHolidays.push(`${format(day, 'dd/MM')} (${holidayMatch.name})`);
                    return; // Pula este dia automaticamente
                }

                const datePrefix = format(day, 'yyyy-MM-dd');
                scheduleSlots.push({
                    startTime: createLocalDate(datePrefix, currentAllocation.startTime).toISOString(),
                    endTime: createLocalDate(datePrefix, currentAllocation.endTime).toISOString(),
                });
            });
        });

        const classId = formData.isDirectBooking ? "direct_booking" : formData.classId;
        const professorId = formData.isDirectBooking ? (formData.professorId || "direct_booking") : formData.professorId;

        const validation = validateScheduleConflicts(scheduleSlots, schedules, professorId, formData.environmentId, classId);
        if (detectedHolidays.length > 0) {
            validation.warnings.push(`Feriado(s) no período: ${detectedHolidays.join(", ")}. Estes dias foram pulados automaticamente.`);
        }
        setValidationResult(validation);
        setIsValidating(false);
    };

    React.useEffect(() => {
        const timer = setTimeout(() => {
            const hasRequired = formData.isDirectBooking
                ? (formData.customEventName && formData.environmentId && formData.startDate && currentAllocation.startTime && currentAllocation.endTime && currentAllocation.daysOfWeek.length > 0)
                : (formData.classId && formData.professorId && formData.environmentId && formData.startDate && currentAllocation.startTime && currentAllocation.endTime && currentAllocation.daysOfWeek.length > 0);

            if (hasRequired) {
                runValidations();
            } else {
                setValidationResult(null);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [formData, currentAllocation, schedules, holidays]);

    const handleCreateSchedule = async () => {
        setIsSaving(true);
        try {
            const startDate = new Date(formData.startDate + 'T00:00:00');
            const endDate = formData.endDate ? new Date(formData.endDate + 'T00:00:00') : startDate;

            let allDaysInRange: Date[] = [];
            for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
                allDaysInRange.push(new Date(dt));
            }

            const scheduleSlots: { startTime: string; endTime: string }[] = [];
            const detectedHolidays: string[] = [];

            currentAllocation.daysOfWeek.forEach(dayOfWeek => {
                const daysForThisAlloc = allDaysInRange.filter(day => day.getDay() === Number(dayOfWeek));
                daysForThisAlloc.forEach(day => {
                    const holidayMatch = holidays.find(h => {
                        const hDate = h.date && typeof h.date.toDate === 'function' ? h.date.toDate() : (h.date instanceof Date ? h.date : new Date(h.date));
                        return isSameDay(hDate, day);
                    });

                    if (holidayMatch) {
                        detectedHolidays.push(`${format(day, 'dd/MM')} (${holidayMatch.name})`);
                        return;
                    }

                    const datePrefix = format(day, 'yyyy-MM-dd');
                    scheduleSlots.push({
                        startTime: createLocalDate(datePrefix, currentAllocation.startTime).toISOString(),
                        endTime: createLocalDate(datePrefix, currentAllocation.endTime).toISOString(),
                    });
                });
            });

            if (scheduleSlots.length === 0) {
                setIsSaving(false);
                return toast({ 
                    title: "Nenhum dia disponível", 
                    description: detectedHolidays.length > 0
                        ? `Todos os dias selecionados coincidem com feriados (${detectedHolidays.join(", ")}).`
                        : "Nenhum dia válido encontrado no período selecionado.", 
                    variant: "destructive" 
                });
            }

            const classId = formData.isDirectBooking ? "direct_booking" : formData.classId;
            const professorId = formData.isDirectBooking ? (formData.professorId || "direct_booking") : formData.professorId;

            // Re-validação rigorosa antes do envio
            const validation = validateScheduleConflicts(scheduleSlots, schedules, professorId, formData.environmentId, classId);
            
            if (validation.errors.length > 0) {
                toast({
                    title: "Agendamento Bloqueado",
                    description: (
                        <div className="mt-2 space-y-1">
                            {validation.errors.slice(0, 4).map((error, idx) => (
                                <p key={idx} className="text-sm text-destructive">{error}</p>
                            ))}
                            {validation.errors.length > 4 && (
                                <p className="text-xs text-muted-foreground">...e mais {validation.errors.length - 4} conflitos.</p>
                            )}
                        </div>
                    ),
                    variant: "destructive"
                });
                setIsSaving(false);
                return;
            }

            toast({ title: "Validando...", description: "Verificando disponibilidade e criando agendamentos..." });

            const selectedClass = classes.find(c => c.id === formData.classId);
            const selectedTeacher = teachers.find(t => t.id === formData.professorId);
            const userRealName = userData?.name || currentUser?.displayName || (currentUser?.email ? formatDisplayName(currentUser.email) : "Reserva Direta");

            await createScheduleBatch({
                classId: classId,
                className: formData.isDirectBooking ? (formData.customEventName || "Reserva Direta") : (selectedClass?.name || ''),
                courseId: formData.isDirectBooking ? "direct_booking" : (selectedClass?.courseId || ''),
                courseName: formData.isDirectBooking ? "Reserva Direta" : (selectedClass?.courseName || ''),
                unitId: selectedUnitId,
                unitName: getUnitName(selectedUnitId),
                roomId: formData.environmentId,
                roomName: rooms.find(r => r.id === formData.environmentId)?.name || '',
                teacherId: professorId,
                teacherName: formData.isDirectBooking ? (selectedTeacher?.name || userRealName) : (selectedTeacher?.name || ""),
                scheduleSlots: scheduleSlots,
                observation: formData.observation ? formData.observation.trim() : undefined,
                ignoreLimits: false // Bloqueio total de colisão: sem bypass
            });

            if (currentUser) {
                await logAction(
                    AuditAction.BULK_CREATE_SCHEDULES,
                    currentUser as any,
                    formData.isDirectBooking 
                        ? `Criadas ${scheduleSlots.length} reservas diretas para: ${formData.customEventName}`
                        : `Criados ${scheduleSlots.length} agendamentos para a turma ${selectedClass?.name} com prof. ${selectedTeacher?.name}`,
                    { 
                        count: scheduleSlots.length, 
                        classId: classId, 
                        teacherId: professorId,
                        roomId: formData.environmentId,
                        slots: scheduleSlots 
                    }
                );
            }

            toast({ title: "Sucesso!", description: `${scheduleSlots.length} agendamento(s) criado(s) com sucesso!` });
            setOpen(false);
            resetNewScheduleForm();
        } catch (error: any) {
            toast({ 
                title: "Agendamento Não Autorizado", 
                description: error?.message || "Conflito detectado no servidor ao tentar salvar horários.", 
                variant: "destructive" 
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button onClick={resetNewScheduleForm}>
                    <Plus className="h-4 w-4 mr-2" />Nova Alocação
                </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Nova Alocação em Período</DialogTitle>
                    <DialogDescription>
                        Preencha os campos abaixo para criar uma nova alocação em período específico.
                    </DialogDescription>
                </DialogHeader>
                
                {classes.length === 0 || teachers.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-8">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                            <p className="text-muted-foreground">Carregando dados...</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-2">
                        <ScheduleForm 
                            classes={classes}
                            teachers={teachers}
                            rooms={rooms}
                            availableBlocks={availableBlocks}
                            formData={formData}
                            setFormData={setFormData}
                            currentAllocation={currentAllocation}
                            setCurrentAllocation={setCurrentAllocation}
                            loggedInUserName={userData?.name || currentUser?.displayName || (currentUser?.email ? formatDisplayName(currentUser.email) : undefined)}
                        />
                    </div>
                )}

                <div className="px-6 py-2">
                    <ScheduleConflictPanel 
                        validationResult={validationResult as any} 
                        isValidating={isValidating} 
                    />
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button onClick={handleCreateSchedule} disabled={(validationResult && !validationResult.isValid) || isSaving}>
                        {isSaving ? "Salvando..." : "Salvar Agendamentos"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
