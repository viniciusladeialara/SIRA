import { db } from "../db.js";
import { getCachedSchedulesByTeacher, getCachedSchedulesByRoom } from "../cache.js";

interface ResourceOptions {
  classId: string;
  shift: string;
  day: Date;
  dailyWorkload: number;
}

/**
 * Busca um professor disponível para a turma no dia e turno especificados
 */
export async function pickTeacher(options: ResourceOptions): Promise<{ id: string, name: string } | null> {
  const { classId, shift, day } = options;
  const weekday = day.getDay(); // 0-6

  // 1. Buscar alocações docentes para esta turma que coincidam com o turno e dia da semana
  const allocationsSnap = await db.collection("teacher_allocations")
    .where("classId", "==", classId)
    .where("shift", "==", shift)
    .where("weekday", "==", weekday)
    .get();

  if (allocationsSnap.empty) {
    return null;
  }

  const startTime = new Date(day);
  const endTime = new Date(day);
  // Ajuste simplificado de horários baseado no turno para checagem de conflitos
  if (shift === 'matutino') { startTime.setHours(7, 30); endTime.setHours(11, 30); }
  else if (shift === 'vespertino') { startTime.setHours(13, 30); endTime.setHours(17, 30); }
  else { startTime.setHours(18, 50); endTime.setHours(22, 50); }

  // 2. Verificar qual professor não tem conflito no horário exato
  for (const doc of allocationsSnap.docs) {
    const data = doc.data();
    const teacherId = data.teacherId;
    const teacherName = data.teacherName;

    const conflicts = await getCachedSchedulesByTeacher(teacherId, startTime, endTime);
    if (conflicts.length === 0) {
      return { id: teacherId, name: teacherName };
    }
  }

  return null;
}

/**
 * Busca um ambiente disponível para a turma no dia e turno especificados
 */
export async function pickEnvironment(options: ResourceOptions, preferredRoomIds: string[]): Promise<{ id: string, name: string } | null> {
  const { shift, day } = options;

  const startTime = new Date(day);
  const endTime = new Date(day);
  if (shift === 'matutino') { startTime.setHours(7, 30); endTime.setHours(11, 30); }
  else if (shift === 'vespertino') { startTime.setHours(13, 30); endTime.setHours(17, 30); }
  else { startTime.setHours(18, 50); endTime.setHours(22, 50); }

  // 1. Tentar os ambientes preferidos da turma primeiro
  for (const roomId of preferredRoomIds) {
    const conflicts = await getCachedSchedulesByRoom(roomId, startTime, endTime);
    if (conflicts.length === 0) {
      const roomDoc = await db.collection("rooms").doc(roomId).get();
      if (roomDoc.exists) {
        return { id: roomId, name: roomDoc.data()?.name || "Sala sem nome" };
      }
    }
  }

  // 2. Fallback: Qualquer sala disponível (Opcional - pode ser restrito aos preferidos conforme PDR 2)
  // Por enquanto, seremos estritos aos preferidos para garantir qualidade pedagógica.
  return null;
}
