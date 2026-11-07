import admin from "firebase-admin";
import { db } from "../db.js";
import { generateWorkDays } from "./calendarUtils.js";
import { getCourseUnits } from "./ucResolver.js";
import { pickTeacher, pickEnvironment } from "./resourcePicker.js";

interface GeneratorOptions {
  turmaId: string;
  userId: string;
  mode: 'overwrite' | 'preserve';
}

/**
 * Motor de geração automática de agenda (PDR 2)
 */
export async function generateSchedule(options: GeneratorOptions) {
  const { turmaId, userId, mode } = options;
  const logRef = db.collection("generation_logs").doc();
  
  await logRef.set({
    turmaId,
    status: 'pending',
    userId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    processedUcs: 0,
    errors: [],
    conflicts: []
  });

  try {
    // 1. Buscar dados da Turma
    const turmaSnap = await db.collection("classes").doc(turmaId).get();
    if (!turmaSnap.exists) throw new Error("Turma não encontrada.");
    const turmaData = turmaSnap.data()!;
    
    const { startDate, dailyWorkload, executionModel, courseId, environmentIds = [] } = turmaData;
    // Normaliza o turno para minúsculo para evitar falhas na lógica de horários
    const shift = (turmaData.shift || turmaData.period || "").toLowerCase(); 

    if (!startDate || !dailyWorkload || !courseId || !shift) {
      throw new Error(`Dados da Turma incompletos (Início: ${!!startDate}, Carga: ${!!dailyWorkload}, Curso: ${!!courseId}, Turno: ${!!shift})`);
    }

    // 2. Resolver Unidades Curriculares
    const units = await getCourseUnits(courseId, dailyWorkload);
    if (units.length === 0) throw new Error("O curso desta turma não possui unidades curriculares cadastradas.");

    // 3. Limpar agenda anterior se mode for overwrite
    if (mode === 'overwrite') {
      const existingSchedules = await db.collection("schedules").where("classId", "==", turmaId).get();
      const deleteBatch = db.batch();
      existingSchedules.docs.forEach(doc => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();
    }

    // 4. Executar geração dia a dia
    const totalDaysNeeded = units.reduce((sum, unit) => sum + unit.daysNeeded, 0);
    const availableDates = await generateWorkDays(startDate.toDate(), totalDaysNeeded);
    
    const writeBatchSize = 100;
    let currentBatch = db.batch();
    let batchCount = 0;
    let dateIndex = 0;
    const conflicts: any[] = [];

    for (const unit of units) {
      for (let i = 0; i < unit.daysNeeded; i++) {
        const currentDate = availableDates[dateIndex++];
        if (!currentDate) break;

        // Tentar buscar Professor e Ambiente
        const teacher = await pickTeacher({ classId: turmaId, shift, day: currentDate, dailyWorkload });
        const room = await pickEnvironment({ classId: turmaId, shift, day: currentDate, dailyWorkload }, environmentIds);

        if (!teacher || !room) {
          conflicts.push({
            date: currentDate.toISOString(),
            uc: unit.name,
            reason: !teacher ? "Professor não disponível" : "Ambiente não disponível"
          });
          continue;
        }

        // Preparar Horários baseados no turno
        const startTime = new Date(currentDate);
        const endTime = new Date(currentDate);
        if (shift === 'matutino') { startTime.setHours(7, 30); endTime.setHours(11, 30); }
        else if (shift === 'vespertino') { startTime.setHours(13, 30); endTime.setHours(17, 30); }
        else { startTime.setHours(18, 50); endTime.setHours(22, 50); }

        const scheduleRef = db.collection("schedules").doc();
        currentBatch.set(scheduleRef, {
          classId: turmaId,
          className: turmaData.name,
          courseId: courseId,
          courseName: turmaData.courseName || "N/A",
          unitId: unit.id,
          unitName: unit.name,
          roomId: room.id,
          roomName: room.name,
          teacherId: teacher.id,
          teacherName: teacher.name,
          startTime: admin.firestore.Timestamp.fromDate(startTime),
          endTime: admin.firestore.Timestamp.fromDate(endTime),
          dailyWorkload,
          executionModel,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: userId,
          type: 'automatic'
        });

        batchCount++;
        if (batchCount >= writeBatchSize) {
          await currentBatch.commit();
          currentBatch = db.batch();
          batchCount = 0;
        }
      }
      
      // Atualizar progresso no log
      await logRef.update({ processedUcs: admin.firestore.FieldValue.increment(1) });
    }

    if (batchCount > 0) {
      await currentBatch.commit();
    }

    // Finalizar Log
    await logRef.update({
      status: 'completed',
      conflicts,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (error) {
    console.error("Erro na geração automática:", error);
    await logRef.update({
      status: 'error',
      errors: [error instanceof Error ? error.message : "Erro desconhecido"],
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}
