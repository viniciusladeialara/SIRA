import { apiService } from '@/services/apiService';

export const getFunctions = (app?: any, region?: string) => ({});

export const httpsCallable = (functions: any, name: string) => {
  return async (data: any) => {
    try {
      if (name === 'createScheduleBatch') {
        if (data.scheduleSlots && Array.isArray(data.scheduleSlots)) {
          for (const slot of data.scheduleSlots) {
            await apiService.createAgendamento({
              turma_id: data.classId,
              ambiente_id: data.roomId,
              docente_id: data.teacherId,
              data_inicio: slot.startTime,
              data_fim: slot.endTime,
              observacao: data.observation,
              unidade_id: data.unitId,
              ignoreLimits: data.ignoreLimits,
            });
          }
        }
        return { data: { success: true } };
      }

      if (name === 'deleteSchedule') {
        if (data.scheduleId) {
          await apiService.deleteAgendamento(data.scheduleId);
        }
        return { data: { success: true } };
      }

      if (name === 'updateSchedule') {
        if (data.scheduleId && data.updateData) {
          await apiService.updateAgendamento(data.scheduleId, data.updateData);
        }
        return { data: { success: true } };
      }

      if (name === 'createUser') {
        const created = await apiService.createUser(data);
        return { data: { success: true, status: 'success', uid: created?.id, ...created } };
      }
    } catch (err: any) {
      console.warn(`[SIRA Functions Adapter] Erro na função "${name}":`, err);
      throw err;
    }

    return { data: { success: true } };
  };
};
