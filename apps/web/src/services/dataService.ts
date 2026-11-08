import { apiService } from "./apiService";

export async function fetchClasses(unitId?: string) {
    const turmas = await apiService.getTurmas();
    return turmas.map((t: any) => ({
        id: t.id,
        name: t.nome,
        code: t.codigo,
        shift: t.turno,
        startDate: t.data_inicio,
        endDate: t.data_fim,
        studentsCount: t.vagas,
        courseId: t.curso_id,
        courseName: t.cursos?.nome,
        unitId: t.unidade_id,
        unitName: t.unidades?.nome,
        ...t,
    }));
}

export async function fetchRooms(unitId?: string) {
    const ambientes = await apiService.getAmbientes();
    return ambientes.map((a: any) => ({
        id: a.id,
        name: a.nome,
        type: a.tipo,
        capacity: a.capacidade,
        block: a.bloco,
        floor: a.andar,
        available: a.ativo,
        unitId: a.unidade_id,
        unitName: a.unidades?.nome,
        ...a,
    }));
}

export async function fetchTeachers(unitId?: string) {
    const docentes = await apiService.getDocentes();
    return docentes.map((d: any) => ({
        id: d.id,
        name: d.nome,
        email: d.email,
        registration: d.matricula,
        phone: d.telefone,
        specialty: d.especialidade,
        maxWeeklyHours: d.carga_horaria_max,
        unitId: d.unidade_id,
        unitName: d.unidades?.nome,
        ...d,
    }));
}

function toHolidayTimestamp(d: any) {
    if (!d) {
        const now = new Date();
        return {
            seconds: Math.floor(now.getTime() / 1000),
            nanoseconds: 0,
            toDate: () => now,
            toMillis: () => now.getTime(),
            toISOString: () => now.toISOString(),
        };
    }
    if (typeof d?.toDate === 'function') return d;
    const date = d instanceof Date ? d : new Date(d);
    return {
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: (date.getTime() % 1000) * 1e6,
        toDate: () => date,
        toMillis: () => date.getTime(),
        toISOString: () => date.toISOString(),
    };
}

export function subscribeToHolidays(callback: (holidays: any[]) => void) {
    let active = true;
    const fetchHolidays = async () => {
        try {
            const data = await apiService.getHolidays();
            if (active && Array.isArray(data)) {
                callback(data.map((h: any) => ({
                    id: h.id,
                    name: h.nome || h.name,
                    date: toHolidayTimestamp(h.data || h.date),
                    type: h.tipo || h.type,
                })));
            }
        } catch (err) {
            console.warn('Erro ao obter feriados via API:', err);
        }
    };

    fetchHolidays();
    const interval = setInterval(fetchHolidays, 60000); // Polling suave a cada 60s
    return () => {
        active = false;
        clearInterval(interval);
    };
}

export async function createHoliday(name: string, date: Date) {
    return apiService.createHoliday({ name, date: date.toISOString().split('T')[0] });
}

export async function deleteHoliday(id: string) {
    return apiService.deleteHoliday(id);
}
