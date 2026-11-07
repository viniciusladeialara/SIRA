import admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./db.js";
import { 
  findScheduleCollisions,
  invalidateCache
} from "./cache.js";

// --- CONFIGURAÇÃO ---
const functionConfig = {
  region: "us-central1",
  maxInstances: 3,
  timeoutSeconds: 60,
  cors: true,
};

// --- HELPER DE NOTIFICAÇÃO ---
async function triggerBatchNotifications(batchId: string) {
  try {
    const schedulesSnap = await db.collection("schedules")
      .where("batchId", "==", batchId)
      .get();

    if (schedulesSnap.empty) return;

    // Coletar professores únicos
    const teacherIds = new Set<string>();
    schedulesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.teacherId) teacherIds.add(data.teacherId);
    });

    console.log(`[Notification] Notificando ${teacherIds.size} professores vinculados ao lote ${batchId}`);

    // Notificar professores via sistema interno (coleção 'notifications')
    for (const teacherId of teacherIds) {
      await db.collection("notifications").add({
        userId: teacherId,
        type: 'schedule_copied',
        message: 'Novos agendamentos foram validados e inseridos no seu cronograma.',
        batchId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false
      });
    }
  } catch (error) {
    console.error("Erro ao disparar notificações de lote:", error);
  }
}

/**
 * Função para resolver um conflito específico no Hub de Conflitos.
 */
export const resolveScheduleConflict = onCall(functionConfig, async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "A operação requer autenticação.");
  }

  const { conflictId, action, updateData } = request.data;

  if (!conflictId || !action) {
    throw new HttpsError("invalid-argument", "ID do conflito e ação são obrigatórios.");
  }

  try {
    const conflictRef = db.collection("schedule_conflicts").doc(conflictId);
    const conflictSnap = await conflictRef.get();

    if (!conflictSnap.exists) {
      throw new HttpsError("not-found", "Conflito não encontrado.");
    }

    const conflictData = conflictSnap.data()!;
    if (conflictData.status !== 'pending') {
      throw new HttpsError("failed-precondition", "Este conflito já foi resolvido ou ignorado.");
    }

    const firestoreBatch = db.batch();

    if (action === 'ignore') {
      // Se for edição manual, apagar o registro que gerou o conflito (está com 'conflict_flagged')
      if (conflictData.sourceType === 'MANUAL_EDIT' && conflictData.sourceScheduleId) {
        firestoreBatch.delete(db.collection("schedules").doc(conflictData.sourceScheduleId));
      }

      firestoreBatch.update(conflictRef, {
        status: 'ignored',
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedBy: request.auth.uid
      });
    } else {
      // Aceitar ou Editar (ação 'accept_anyway' ou 'resolve')
      
      // Validação estrita ao resolver manualmente com nova sala/professor
      if (action === 'resolve') {
        const targetRoomId = updateData?.roomId || conflictData.suggestedData?.roomId;
        const targetTeacherId = updateData?.teacherId || conflictData.suggestedData?.teacherId;
        const targetClassId = updateData?.classId || conflictData.suggestedData?.classId;

        const targetStartTime = updateData?.startTime
          ? new Date(updateData.startTime)
          : (conflictData.suggestedData?.startTime?.toDate ? conflictData.suggestedData.startTime.toDate() : new Date(conflictData.suggestedData?.startTime));
        const targetEndTime = updateData?.endTime
          ? new Date(updateData.endTime)
          : (conflictData.suggestedData?.endTime?.toDate ? conflictData.suggestedData.endTime.toDate() : new Date(conflictData.suggestedData?.endTime));

        const collisionCheck = await findScheduleCollisions({
          teacherId: targetTeacherId,
          roomId: targetRoomId,
          classId: targetClassId,
          startTime: targetStartTime,
          endTime: targetEndTime,
          excludeScheduleId: conflictData.sourceScheduleId
        });

        // Ignorar os agendamentos que já serão excluídos nesta mesma resolução
        const pendingDeleteSet = new Set(conflictData.conflictingScheduleIds || []);
        const realCollisions = collisionCheck.allCollisions.filter(s => !pendingDeleteSet.has(s.id));

        if (realCollisions.length > 0) {
          throw new HttpsError(
            "already-exists",
            `Ajuste inválido: o novo ambiente ou professor selecionado já possui aula no horário (${realCollisions.map(s => s.className || s.roomName).join(', ')}). Por favor, selecione outro recurso livre.`
          );
        }
      }

      // 1. Apagar registros conflitantes ("Limpar o caminho")
      const conflictingIds = conflictData.conflictingScheduleIds || [];
      conflictingIds.forEach((id: string) => {
        // Não apagar a si mesmo se for uma edição manual
        if (id !== conflictData.sourceScheduleId) {
          firestoreBatch.delete(db.collection("schedules").doc(id));
        }
      });

      const finalData = { ...conflictData.suggestedData, ...updateData };
      
      // Limpeza de dados indesejados
      const cleanData = { ...finalData };
      delete cleanData.id;
      delete cleanData.batchId; 

      // Conversão de datas
      if (updateData?.startTime) {
        cleanData.startTime = admin.firestore.Timestamp.fromDate(new Date(updateData.startTime));
      } else if (conflictData.suggestedData.startTime) {
         if (!(cleanData.startTime instanceof admin.firestore.Timestamp)) {
            const st = conflictData.suggestedData.startTime;
            cleanData.startTime = admin.firestore.Timestamp.fromDate(new Date(st.toDate ? st.toDate() : st));
         }
      }

      if (updateData?.endTime) {
        cleanData.endTime = admin.firestore.Timestamp.fromDate(new Date(updateData.endTime));
      } else if (conflictData.suggestedData.endTime) {
         if (!(cleanData.endTime instanceof admin.firestore.Timestamp)) {
            const et = conflictData.suggestedData.endTime;
            cleanData.endTime = admin.firestore.Timestamp.fromDate(new Date(et.toDate ? et.toDate() : et));
         }
      }
      
      // 2. Criar ou Atualizar agendamento
      const status = action === 'accept_anyway' ? 'manually_adjusted' : 'original';
      
      if (conflictData.sourceType === 'MANUAL_EDIT' && conflictData.sourceScheduleId) {
        // Se já existe (editado manualmente), atualizar para remover o flag de conflito
        const scheduleRef = db.collection("schedules").doc(conflictData.sourceScheduleId);
        firestoreBatch.update(scheduleRef, {
          ...cleanData,
          scheduleStatus: status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Se for REPLICATION ou sistema, criar novo doc
        const newScheduleRef = db.collection("schedules").doc();
        firestoreBatch.set(newScheduleRef, {
          ...cleanData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          scheduleStatus: status,
          batchId: conflictData.batchId || null
        });
      }

      // Marcar conflito como resolvido
      firestoreBatch.update(conflictRef, {
        status: 'resolved',
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedBy: request.auth.uid,
        resolutionAction: action
      });
    }

    await firestoreBatch.commit();
    invalidateCache("schedules");

    // Verificar se ainda há conflitos pendentes para o lote (apenas se houver batchId)
    if (conflictData.batchId) {
      const pendingConflicts = await db.collection("schedule_conflicts")
        .where("batchId", "==", conflictData.batchId)
        .where("status", "==", "pending")
        .limit(1)
        .get();

      if (pendingConflicts.empty) {
        // Se não houver mais pendentes, notificar professores
        await triggerBatchNotifications(conflictData.batchId);
        
        // Atualizar status do batch se necessário
        await db.collection("schedule_copy_batches").doc(conflictData.batchId).update({
          status: 'completed'
        });
      }
    }

    return { 
      status: "success", 
      message: "Conflito resolvido com sucesso." 
    };

  } catch (error: any) {
    console.error("Erro ao resolver conflito:", error);
    throw new HttpsError("internal", error.message || "Erro interno ao resolver conflito.");
  }
});
