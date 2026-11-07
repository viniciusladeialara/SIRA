import { onDocumentWritten, onDocumentDeleted } from "firebase-functions/v2/firestore";
import admin from "firebase-admin";
import { db } from "./db.js";
import { findScheduleCollisions } from "./cache.js";

/**
 * Gatilho Unificado de Detecção de Conflitos e Integridade.
 * Executado em toda criação ou atualização de agendamento.
 */
export const onScheduleWritten = onDocumentWritten("schedules/{scheduleId}", async (event) => {
  const scheduleId = event.params.scheduleId;
  const newData = event.data?.after.exists ? event.data.after.data() : null;
  const oldData = event.data?.before.exists ? event.data.before.data() : null;

  // 1. Delete case: remover da fila de conflitos se o agendamento sumiu
  if (!newData) {
    const conflictsSnap = await db.collection("schedule_conflicts")
      .where("sourceScheduleId", "==", scheduleId)
      .where("status", "==", "pending")
      .get();
    
    if (!conflictsSnap.empty) {
      const batch = db.batch();
      conflictsSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    return;
  }

  // Prevenção de recursão infinita
  if (oldData) {
    const relevantChange = 
      oldData.startTime?.toMillis() !== newData.startTime?.toMillis() ||
      oldData.endTime?.toMillis() !== newData.endTime?.toMillis() ||
      oldData.teacherId !== newData.teacherId ||
      oldData.roomId !== newData.roomId ||
      oldData.classId !== newData.classId;

    if (!relevantChange && newData.scheduleStatus !== 'original') {
        return;
    }
  }

  // 2. Detecção de Conflitos (Backend Level)
  try {
    const startTime = newData.startTime?.toDate?.() || null;
    const endTime = newData.endTime?.toDate?.() || null;

    if (!startTime || !endTime) {
      console.warn(`[onScheduleWritten] Agendamento ${scheduleId} incompleto (faltam horários).`);
      return;
    }

    const { teacherId, roomId, classId } = newData;

    const collision = await findScheduleCollisions({
      teacherId,
      roomId,
      classId,
      startTime,
      endTime,
      excludeScheduleId: scheduleId
    });

    if (collision.hasCollision) {
      // A. Persistir Conflito
      let conflictType = 'overlap';
      if (collision.roomCollisions.length > 0) conflictType = 'room_busy';
      else if (collision.teacherCollisions.length > 0) conflictType = 'teacher_busy';
      else if (collision.classCollisions.length > 0) conflictType = 'class_overlap';

      const existingConflicts = await db.collection("schedule_conflicts")
        .where("sourceScheduleId", "==", scheduleId)
        .where("status", "==", "pending")
        .limit(1)
        .get();

      const conflictingScheduleIds = collision.allCollisions.map(s => s.id).filter(Boolean);

      const conflictData = {
        sourceScheduleId: scheduleId,
        conflictingScheduleIds,
        conflictType,
        description: collision.description,
        status: 'pending',
        startTime: newData.startTime, // Denormalizado para ordenação
        sourceType: newData.batchId ? 'REPLICATION' : 'MANUAL_EDIT',
        suggestedData: newData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (existingConflicts.empty) {
        await db.collection("schedule_conflicts").add({
          ...conflictData,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        await existingConflicts.docs[0].ref.update(conflictData);
      }

      if (newData.scheduleStatus !== 'conflict_flagged') {
        await event.data?.after.ref.update({
          scheduleStatus: 'conflict_flagged',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } else {
      // 3. Limpeza
      const existingConflicts = await db.collection("schedule_conflicts")
        .where("sourceScheduleId", "==", scheduleId)
        .where("status", "==", "pending")
        .get();

      if (!existingConflicts.empty) {
        const batch = db.batch();
        existingConflicts.docs.forEach(doc => {
          batch.update(doc.ref, {
            status: 'resolved',
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            resolvedBy: 'system_auto_fix'
          });
        });
        await batch.commit();
      }

      if (newData.scheduleStatus === 'conflict_flagged') {
        await event.data?.after.ref.update({
          scheduleStatus: 'original',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error(`[onScheduleWritten Error] Falha crítica no agendamento ${scheduleId}:`, error);
  }
});

/**
 * Gatilho para detectar mudança de status de disponibilidade do ambiente (Manutenção).
 */
export const onRoomUpdated = onDocumentWritten("rooms/{roomId}", async (event) => {
  const roomId = event.params.roomId;
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return; // Criação ou Deleção não tratamos aqui por enquanto

  const maintenanceStarted = before.available === true && after.available === false;
  const maintenanceEnded = before.available === false && after.available === true;

  if (maintenanceStarted) {
    // 1. Buscar agendamentos futuros
    const now = admin.firestore.Timestamp.now();
    const schedulesSnap = await db.collection("schedules")
      .where("roomId", "==", roomId)
      .where("startTime", ">=", now)
      .get();

    if (schedulesSnap.empty) return;

    const batch = db.batch();
    const teacherIds = new Set<string>();

    schedulesSnap.docs.forEach(doc => {
      const schedule = doc.data();
      const conflictRef = db.collection("schedule_conflicts").doc();
      
      batch.set(conflictRef, {
        sourceScheduleId: doc.id,
        roomId: roomId, // Denormalizado para facilitar busca na volta
        conflictType: 'room_maintenance',
        startTime: schedule.startTime, // Denormalizado para ordenação
        description: `Ambiente ${after.name} entrou em manutenção.`,
        status: 'pending',
        sourceType: 'SYSTEM',
        suggestedData: schedule,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Marcar agendamento como em conflito
      batch.update(doc.ref, {
        scheduleStatus: 'conflict_flagged',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (schedule.teacherId) teacherIds.add(schedule.teacherId);
    });

    // Notificar professores
    for (const teacherId of teacherIds) {
      const notifRef = db.collection("notifications").doc();
      batch.set(notifRef, {
        userId: teacherId,
        type: 'room_maintenance',
        message: `O ambiente ${after.name} entrou em manutenção. Verifique seus agendamentos.`,
        roomId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false
      });
    }

    await batch.commit();
  } else if (maintenanceEnded) {
    // 2. Resolver conflitos pendentes de manutenção para esta sala
    const conflictsSnap = await db.collection("schedule_conflicts")
      .where("roomId", "==", roomId)
      .where("conflictType", "==", "room_maintenance")
      .where("status", "==", "pending")
      .get();

    if (conflictsSnap.empty) return;

    const batch = db.batch();
    const scheduleIds = new Set<string>();
    const teacherIds = new Set<string>();

    conflictsSnap.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'resolved',
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedBy: 'system_auto_fix'
      });
      const data = doc.data();
      if (data.sourceScheduleId) scheduleIds.add(data.sourceScheduleId);
      if (data.suggestedData?.teacherId) teacherIds.add(data.suggestedData.teacherId);
    });

    // Restaurar status dos agendamentos
    for (const sId of scheduleIds) {
      batch.update(db.collection("schedules").doc(sId), {
        scheduleStatus: 'original',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Notificar que a sala voltou
    for (const teacherId of teacherIds) {
       const notifRef = db.collection("notifications").doc();
       batch.set(notifRef, {
         userId: teacherId,
         type: 'room_available',
         message: `O ambiente ${after.name} já está disponível novamente.`,
         roomId,
         createdAt: admin.firestore.FieldValue.serverTimestamp(),
         read: false
       });
    }

    await batch.commit();
  }
});

/**
 * Gatilho para limpeza de professor (Safe-Delete).
 * Remove do Firebase Auth e limpa o perfil de usuário ao excluir o professor.
 */
export const onTeacherDeleted = onDocumentDeleted("teachers/{teacherId}", async (event) => {
    const teacherId = event.params.teacherId;
    const deletedData = event.data?.data() as any;

    console.log(`Iniciando exclusão segura para professor: ${teacherId} (${deletedData?.email})`);

    const batch = db.batch();

    try {
        // 1. Remover do Firebase Auth (se existir)
        try {
            await admin.auth().deleteUser(teacherId);
            console.log(`Usuário ${teacherId} removido do Firebase Auth.`);
        } catch (authError: any) {
            if (authError.code === 'auth/user-not-found') {
                console.log(`Usuário ${teacherId} não encontrado no Auth, ignorando.`);
            } else {
                console.error(`Erro ao remover usuário do Auth:`, authError);
            }
        }

        // 2. Remover da coleção 'users'
        const userRef = db.collection("users").doc(teacherId);
        batch.delete(userRef);

        // 3. Identificar agendamentos futuros e marcar conflito
        const now = admin.firestore.Timestamp.now();
        const schedulesSnap = await db.collection("schedules")
            .where("teacherId", "==", teacherId)
            .where("startTime", ">=", now)
            .get();

        schedulesSnap.forEach(doc => {
            const scheduleRef = db.collection("schedules").doc(doc.id);
            const conflictRef = db.collection("schedule_conflicts").doc();

            // Marcar agendamento com conflito
            batch.update(scheduleRef, {
                scheduleStatus: 'conflict_flagged',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Criar registro de conflito
            batch.set(conflictRef, {
                sourceScheduleId: doc.id,
                teacherId: teacherId,
                conflictType: 'teacher_missing',
                description: `Professor ${deletedData?.name || 'excluído'} não faz mais parte do quadro.`,
                status: 'pending',
                startTime: doc.data().startTime,
                sourceType: 'SYSTEM',
                suggestedData: doc.data(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        console.log(`Exclusão segura de professor ${teacherId} concluída.`);
    } catch (error) {
        console.error(`Erro fatal na exclusão segura de professor ${teacherId}:`, error);
    }
});

/**
 * Gatilho para sincronização de status de professor (Ativo / Inativo).
 * Ao inativar o professor, desativa a conta no Firebase Auth para revogação imediata de token
 * e sincroniza o documento correspondente na coleção 'users'.
 */
export const onTeacherStatusUpdated = onDocumentWritten("teachers/{teacherId}", async (event) => {
    const beforeData = event.data?.before?.data() as any;
    const afterData = event.data?.after?.data() as any;

    // Se o documento foi excluído, o onTeacherDeleted já cuida da remoção
    if (!afterData) return;

    // Apenas age se houve alteração no campo isActive
    if (beforeData?.isActive !== afterData?.isActive && afterData?.isActive !== undefined) {
        const teacherId = event.params.teacherId;
        const isNowActive = afterData.isActive === true;

        console.log(`Atualizando status do professor ${teacherId} para active=${isNowActive}`);

        // 1. Atualizar disabled no Firebase Auth
        try {
            await admin.auth().updateUser(teacherId, { disabled: !isNowActive });
            console.log(`Firebase Auth para ${teacherId} atualizado: disabled=${!isNowActive}`);
        } catch (authError: any) {
            if (authError.code === 'auth/user-not-found') {
                console.log(`Usuário ${teacherId} não existe no Auth, pulando.`);
            } else {
                console.error(`Erro ao atualizar disabled no Auth para ${teacherId}:`, authError);
            }
        }

        // 2. Sincronizar na coleção users
        try {
            await db.collection("users").doc(teacherId).set({
                isActive: isNowActive,
                status: isNowActive ? 'active' : 'inactive',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (dbErr) {
            console.error(`Erro ao sincronizar status em users para ${teacherId}:`, dbErr);
        }
    }
});

