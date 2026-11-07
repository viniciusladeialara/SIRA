import { apiService } from "./apiService";

export interface ScheduleItem {
    id: string;
    classId: string;
    className: string;
    courseName: string;
    courseId: string;
    roomId: string;
    roomName: string;
    teacherId: string;
    teacherName: string;
    startTime: any;
    endTime: any;
    dailyWorkload?: number;
    executionModel?: '3h' | '4h' | '5h';
    observation?: string;
    createdBy?: string;
    unitId?: string;
    unitName?: string;
    isSubstitution?: boolean;
    originalTeacherId?: string | null;
    originalTeacherName?: string | null;
    absenceId?: string | null;
    substitutionAppliedAt?: any;
    substitutionAppliedBy?: string | null;
    checkInCompleted?: boolean;
    checkOutCompleted?: boolean;
    substitutionVersion?: number;
    scheduleStatus?: 'original' | 'pending_substitution' | 'substituted' | 'reverted' | 'manually_adjusted' | 'conflict_flagged';
}

export interface ScheduleBatchParams {
    classId: string;
    className: string;
    courseId: string;
    courseName: string;
    unitId: string;
    unitName: string;
    roomId: string;
    roomName: string;
    teacherId: string;
    teacherName: string;
    scheduleSlots: { startTime: string; endTime: string }[];
    observation?: string;
    ignoreLimits?: boolean;
}

export interface ScheduleUpdateData extends Partial<ScheduleItem> {
    ignoreLimits?: boolean;
}

function toTimestampObj(d: string | Date | any) {
    const date = new Date(d);
    return {
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: (date.getTime() % 1000) * 1e6,
        toDate: () => date,
        toISOString: () => date.toISOString(),
    };
}

/**
 * Retorna uma assinatura ativa para ouvir a agenda em um intervalo específico via API NestJS.
 */
export function subscribeToSchedules(start: Date, end: Date, callback: (schedules: ScheduleItem[]) => void) {
    let active = true;

    const fetchSchedules = async () => {
        try {
            const data = await apiService.getAgendamentos({
                start: start.toISOString(),
                end: end.toISOString(),
            });

            if (active && Array.isArray(data)) {
                const mapped: ScheduleItem[] = data.map((item: any) => ({
                    id: item.id,
                    classId: item.turma_id,
                    className: item.turmas?.nome || 'Turma',
                    courseId: item.turmas?.curso_id || '',
                    courseName: item.turmas?.cursos?.nome || '',
                    roomId: item.ambiente_id,
                    roomName: item.ambientes?.nome || 'Ambiente',
                    teacherId: item.docente_id,
                    teacherName: item.docentes?.nome || 'Docente',
                    startTime: toTimestampObj(item.data_inicio),
                    endTime: toTimestampObj(item.data_fim),
                    observation: item.observacao,
                    unitId: item.unidade_id,
                    unitName: item.unidades?.nome,
                    scheduleStatus: item.status,
                }));
                callback(mapped);
            }
        } catch (error) {
            console.error("Erro ao carregar agendamentos da API:", error);
        }
    };

    fetchSchedules();
    const interval = setInterval(fetchSchedules, 10000); // Polling regular a cada 10s
    return () => {
        active = false;
        clearInterval(interval);
    };
}

/**
 * Criação da reserva em lote via API NestJS
 */
export async function createScheduleBatch(params: ScheduleBatchParams) {
    const promises = params.scheduleSlots.map(slot =>
        apiService.createAgendamento({
            turma_id: params.classId,
            ambiente_id: params.roomId,
            docente_id: params.teacherId,
            data_inicio: slot.startTime,
            data_fim: slot.endTime,
            observacao: params.observation,
            unidade_id: params.unitId,
            ignoreLimits: params.ignoreLimits,
        })
    );
    const results = await Promise.all(promises);
    return { data: { success: true, count: results.length } };
}

/**
 * Exclui um agendamento via API NestJS
 */
export async function deleteSchedule(id: string) {
    await apiService.deleteAgendamento(id);
    return { data: { success: true } };
}

/**
 * Atualiza um agendamento via API NestJS
 */
export async function updateSchedule(id: string, data: ScheduleUpdateData) {
    const updatePayload: any = { ...data };
    if (data.startTime && typeof (data.startTime as any).toDate === 'function') {
        updatePayload.data_inicio = (data.startTime as any).toDate().toISOString();
    } else if (data.startTime) {
        updatePayload.data_inicio = new Date(data.startTime).toISOString();
    }

    if (data.endTime && typeof (data.endTime as any).toDate === 'function') {
        updatePayload.data_fim = (data.endTime as any).toDate().toISOString();
    } else if (data.endTime) {
        updatePayload.data_fim = new Date(data.endTime).toISOString();
    }

    if (data.roomId) updatePayload.ambiente_id = data.roomId;
    if (data.teacherId) updatePayload.docente_id = data.teacherId;
    if (data.classId) updatePayload.turma_id = data.classId;

    const res = await apiService.updateAgendamento(id, updatePayload);
    return { data: res };
}

/**
 * Resolve um conflito de agendamento
 */
export async function resolveScheduleConflict(params: {
    conflictId: string;
    action: 'ignore' | 'accept_anyway' | 'resolve';
    updateData?: Partial<ScheduleItem>;
}) {
    if (params.updateData && params.conflictId) {
        await updateSchedule(params.conflictId, {
            ...params.updateData,
            ignoreLimits: true,
        });
    }
    return { data: { success: true } };
}

/**
 * Subscreve aos conflitos pendentes
 */
export function subscribeToConflicts(callback: (conflicts: any[]) => void) {
    // Retorna vazio inicialmente
    callback([]);
    return () => {};
}
