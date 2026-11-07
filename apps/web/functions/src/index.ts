/**
 * @file index.ts
 * @description Arquivo principal das Cloud Functions do projeto.
 * v2.0 - Otimizado e consolidado: 12 Cloud Functions essenciais.
 */

// --- IMPORTAÇÕES ---
import admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import {
  findScheduleCollisions,
  invalidateCache
} from "./cache.js";
import isRateLimited from "./rateLimiter.js";

// --- INICIALIZAÇÃO E CONFIGURAÇÃO GLOBAL ---
import { db } from "./db.js";
export { db };

// Define configurações globais para TODAS as funções neste arquivo
setGlobalOptions({
  region: "us-central1",
  maxInstances: 3,
  timeoutSeconds: 30,
});

// Configuração para funções onCall
const functionConfig = {
  region: "us-central1",
  maxInstances: 3, 
  timeoutSeconds: 30,
  cors: true,
};

// --- INTERFACES ---
interface ScheduleRequestData {
  classId: string; 
  roomId: string; 
  teacherId?: string;
  scheduleSlots: { startTime: string; endTime: string; }[];
  className?: string; 
  courseId?: string; 
  courseName?: string; 
  unitId?: string; 
  unitName?: string;
  roomName?: string; 
  teacherName?: string;
  ignoreLimits?: boolean;
}

interface CreateUserData {
  email: string;
  name: string;
  password: string;
  role: string;
  escolaId?: string;
  teacherId?: string;
  scope?: any;
  invite?: boolean;
  status?: string;
  unitIds?: string[];
  selectedUnitId?: string;
}


/**
 * Obtém os dados e papel do usuário autenticado chamador.
 */
async function getCallerUser(auth: any) {
  if (!auth || !auth.uid) return null;
  if (auth.token?.email === 'viniciusladeialara@gmail.com') {
    return { role: 'SUPER_ADMIN', selectedUnitId: 'caceres', unitIds: ['caceres', 'varzea-grande'] };
  }
  const userDoc = await db.collection("users").doc(auth.uid).get();
  return userDoc.exists ? userDoc.data() : null;
}

// --- FUNÇÕES UTILITÁRIAS ---

/**
 * Helper para identificar o turno e ajustar para o fuso horário de Cuiabá (UTC-4)
 */
const getShiftInfo = (date: Date) => {
    const hour = (date.getUTCHours() - 4 + 24) % 24;
    const dateStr = date.toISOString().split('T')[0];
    let shift = "noturno";
    if (hour >= 7 && hour < 13) shift = "matutino";
    else if (hour >= 13 && hour < 18) shift = "vespertino";
    
    return { shift, dateStr, key: `${dateStr}_${shift}` };
};

/**
 * Verifica se a inclusão dos novos slots excede o limite de 5h da sala no turno.
 */
async function checkRoomShiftLimit(roomId: string, slots: { startTime: string; endTime: string; }[]): Promise<boolean> {
    const shiftUsage: Record<string, number> = {};
    
    for (const slot of slots) {
        const start = new Date(slot.startTime);
        const end = new Date(slot.endTime);
        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const { key } = getShiftInfo(start);
        shiftUsage[key] = (shiftUsage[key] || 0) + duration;
    }

    for (const key in shiftUsage) {
        const [dateStr, shift] = key.split('_');
        const startOfDay = new Date(`${dateStr}T00:00:00Z`);
        const endOfDay = new Date(`${dateStr}T23:59:59Z`);

        const roomSchedules = await db.collection("schedules")
            .where("roomId", "==", roomId)
            .where("startTime", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
            .where("startTime", "<=", admin.firestore.Timestamp.fromDate(endOfDay))
            .get();

        let existingHoursInShift = 0;
        roomSchedules.docs.forEach(doc => {
            const s = doc.data();
            if (getShiftInfo(s.startTime.toDate()).shift === shift) {
                existingHoursInShift += (s.endTime.toDate().getTime() - s.startTime.toDate().getTime()) / (1000 * 60 * 60);
            }
        });

        if (existingHoursInShift + shiftUsage[key] > 5.01) return true;
    }
    return false;
}

// --- FUNÇÕES DE VALIDAÇÃO DE AGENDAMENTO ---

/**
 * Função Chamável (onCall) unificada para criar agendamentos em lote (Admin e Reserva de Professores).
 */
export const createScheduleBatch = onCall(functionConfig, async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "A operação requer autenticação.");
  }

  // Rate limiting: máx 10 criações de agendamentos por minuto por usuário
  if (isRateLimited(`createScheduleBatch:${request.auth.uid}`, 60000, 10)) {
    throw new HttpsError("resource-exhausted", "Muitas requisições. Tente novamente em alguns minutos.");
  }

  const data = request.data as ScheduleRequestData & { observation?: string; teacherName?: string; className?: string };
  const teacherId = data.teacherId || request.auth.uid;
  const { roomId, classId, scheduleSlots, observation } = data;
  if (!teacherId || !roomId || !classId || !scheduleSlots || !scheduleSlots.length) {
    throw new HttpsError("invalid-argument", "Dados insuficientes para criar o agendamento.");
  }

  // Validação de limite para evitar custos excessivos
  if (scheduleSlots.length > 50) {
    throw new HttpsError("invalid-argument", "Máximo de 50 agendamentos por operação para evitar timeout.");
  }

  // 1. Validação Intra-Lote (detectar slots sobrepostos dentro do próprio payload enviado)
  for (let i = 0; i < scheduleSlots.length; i++) {
    const slotA_start = new Date(scheduleSlots[i].startTime).getTime();
    const slotA_end = new Date(scheduleSlots[i].endTime).getTime();
    if (isNaN(slotA_start) || isNaN(slotA_end) || slotA_start >= slotA_end) {
      throw new HttpsError("invalid-argument", "Horário com datas inválidas ou término anterior ao início.");
    }
    for (let j = i + 1; j < scheduleSlots.length; j++) {
      const slotB_start = new Date(scheduleSlots[j].startTime).getTime();
      const slotB_end = new Date(scheduleSlots[j].endTime).getTime();
      if (slotA_start < slotB_end && slotA_end > slotB_start) {
        throw new HttpsError(
          "invalid-argument",
          `O lote enviado contém horários sobrepostos entre si no mesmo envio (${new Date(slotA_start).toLocaleString('pt-BR')}).`
        );
      }
    }
  }

  // --- RESOLUÇÃO DE DADOS CORE (PDR 1) ---
  const isDirectBooking = classId === "direct_booking";
  let classData: any = {};
  let courseId = "N/A";
  let courseNameStr = "N/A";

  if (!isDirectBooking) {
    const classRef = db.collection("classes").doc(classId);
    const classSnap = await classRef.get();
    if (!classSnap.exists) {
      throw new HttpsError("not-found", "Turma não encontrada. O agendamento deve ser centrado em uma Turma válida.");
    }
    classData = classSnap.data()!;
    courseId = classData.courseId || "N/A";
    const courseRef = db.collection("courses").doc(courseId);
    const courseSnap = await courseRef.get();
    courseNameStr = courseSnap.exists ? courseSnap.data()?.name : (classData.courseName || "N/A");
  } else {
    classData = {
      name: data.className || "Reserva Direta",
      dailyWorkload: 4,
      executionModel: '4h'
    };
    courseId = "direct_booking";
    courseNameStr = "Reserva Direta";
  }
  
  const teacherRef = db.collection("teachers").doc(teacherId);
  const teacherSnap = await teacherRef.get();
  let teacherData: any = {};
  if (teacherSnap.exists) {
    teacherData = teacherSnap.data()!;
  } else {
    teacherData = {
      name: data.teacherName || request.auth.token?.name || "Docente / Usuário"
    };
  }

  const roomRef = db.collection("rooms").doc(roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) {
    throw new HttpsError("not-found", "Ambiente não encontrado.");
  }
  const roomData = roomSnap.data()!;

  // 2. Validação Estrita de Conflitos no Banco de Dados (findScheduleCollisions)
  const collectedConflicts: string[] = [];

  for (const slot of scheduleSlots) {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);

    const collision = await findScheduleCollisions({
      teacherId,
      roomId,
      classId,
      startTime: start,
      endTime: end
    });

    if (collision.hasCollision) {
      collectedConflicts.push(collision.description || "Conflito desconhecido");
    }
  }

  if (collectedConflicts.length > 0) {
    throw new HttpsError(
      "already-exists",
      `Não foi possível agendar devido a conflitos no banco:\n- ${collectedConflicts.join("\n- ")}`
    );
  }

  // 3. Validação do Limite de 5h da Sala no Turno
  if (!data.ignoreLimits) {
    const exceedsShift = await checkRoomShiftLimit(roomId, scheduleSlots);
    if (exceedsShift) {
        throw new HttpsError(
            "failed-precondition",
            "A inclusão destes horários excede o limite operacional de 5 horas para esta sala no mesmo turno."
        );
    }
  }

  // 4. Gravação em Lote com Atributos Enriquecidos
  const batch = db.batch();
  const dailyWorkload = classData.dailyWorkload || 4;

  scheduleSlots.forEach(slot => {
    const scheduleRef = db.collection("schedules").doc();
    const scheduleData = {
      unitId: data.unitId || classData.unitId || roomData.unitId || "caceres",
      unitName: data.unitName || classData.unitName || roomData.unitName || "SENAI Cáceres",
      classId: classId,
      className: classData.name || data.className,
      courseId: courseId,
      courseName: courseNameStr,
      roomId: roomId,
      roomName: roomData.name || data.roomName,
      teacherId: teacherId,
      teacherName: teacherData.name || data.teacherName,
      startTime: admin.firestore.Timestamp.fromDate(new Date(slot.startTime)),
      endTime: admin.firestore.Timestamp.fromDate(new Date(slot.endTime)),
      dailyWorkload: dailyWorkload, 
      executionModel: classData.executionModel || '4h',
      observation: observation || null,
      scheduleStatus: 'original',
      createdBy: request.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    batch.set(scheduleRef, scheduleData);
  });

  try {
    await batch.commit();

    // Invalidar cache relacionado a agendamentos
    invalidateCache("schedules");

    return { 
      status: "success", 
      message: `${scheduleSlots.length} agendamentos criados com sucesso!` 
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "internal",
      error instanceof Error ? error.message : "Não foi possível salvar os agendamentos."
    );
  }
});

/**
 * Função para criar usuários tanto no Firebase Auth quanto no Firestore
 */
export const createUser = onCall(functionConfig, async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "A operação requer autenticação.");
  }

  // Rate limiting: máx 5 criações de usuários por minuto
  if (isRateLimited(`createUser:${request.auth.uid}`, 60000, 5)) {
    throw new HttpsError("resource-exhausted", "Muitas requisições. Tente novamente em alguns minutos.");
  }

  const callerUser = await getCallerUser(request.auth);
  if (!callerUser) {
    throw new HttpsError("permission-denied", "Usuário não autenticado ou registro não encontrado.");
  }

  const callerRole = (callerUser.role || "").toUpperCase();
  const isSuperAdmin = callerRole === "SUPER_ADMIN";
  const isAdmin = callerRole === "ADMIN";
  const isUser = callerRole === "USER";

  if (!isSuperAdmin && !isAdmin && !isUser) {
    throw new HttpsError("permission-denied", "Apenas administradores ou usuários operacionais podem criar registros.");
  }

  const { email, name, password, role, escolaId, teacherId, scope, invite, status, unitIds, selectedUnitId } = request.data as CreateUserData;

  if (!email || !name || !role) {
    throw new HttpsError("invalid-argument", "Email, nome e função são obrigatórios.");
  }

  const targetRole = role.toUpperCase();

  // Usuário operacional (USER) só tem permissão para cadastrar PROFESSOR
  if (isUser && targetRole !== "PROFESSOR") {
    throw new HttpsError("permission-denied", "Usuários operacionais só podem cadastrar professores.");
  }

  // Administrador (ADMIN) não pode criar ADMIN nem SUPER_ADMIN
  if (isAdmin && (targetRole === "SUPER_ADMIN" || targetRole === "ADMIN")) {
    throw new HttpsError("permission-denied", "Administradores não têm permissão para criar outros administradores ou super administradores.");
  }

  // Validar se as unidades solicitadas pertencem às unidades do próprio chamador (para ADMIN e USER)
  if (!isSuperAdmin) {
    const callerUnits: string[] = callerUser.unitIds && callerUser.unitIds.length > 0 
      ? callerUser.unitIds 
      : [callerUser.selectedUnitId || "caceres"];
    const targetUnits: string[] = unitIds && Array.isArray(unitIds) && unitIds.length > 0 
      ? unitIds 
      : (selectedUnitId ? [selectedUnitId] : []);
      
    if (targetUnits.length > 0) {
      const hasUnauthorizedUnit = targetUnits.some((uId: string) => !callerUnits.includes(uId));
      if (hasUnauthorizedUnit) {
        throw new HttpsError("permission-denied", "Você só pode vincular usuários às suas próprias unidades autorizadas.");
      }
    }
  }

  if (!invite && !password) {
    throw new HttpsError("invalid-argument", "Senha é obrigatória quando não for convite.");
  }

  try {
    const finalPassword = password || `Temp@${Math.random().toString(36).slice(-8)}A1!`;

    let userRecord: any;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password: finalPassword,
        displayName: name,
        disabled: status === "inactive",
      });
    } catch (authError: any) {
      if (authError.code === "auth/email-already-exists") {
        const existingAuth = await admin.auth().getUserByEmail(email);
        const existingTeacherDoc = await db.collection("teachers").doc(existingAuth.uid).get();
        // Se a criação anterior de professor foi interrompida antes de gravar em teachers, recupera o UID
        if (role === "PROFESSOR" && !existingTeacherDoc.exists) {
          userRecord = existingAuth;
        } else {
          throw authError;
        }
      } else {
        throw authError;
      }
    }

    const userDoc: Record<string, any> = {
      uid: userRecord.uid,
      email,
      name,
      role,
      isActive: status !== "inactive",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    };

    if (escolaId) userDoc.escolaId = escolaId;
    if (teacherId) userDoc.teacherId = teacherId;
    if (scope) userDoc.scope = scope;
    if (unitIds && Array.isArray(unitIds)) userDoc.unitIds = unitIds;
    if (selectedUnitId) userDoc.selectedUnitId = selectedUnitId;
    if (invite) userDoc.invitedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection("users").doc(userRecord.uid).set(userDoc, { merge: true });

    return {
      status: "success",
      success: true,
      message: "Usuário criado com sucesso!",
      uid: userRecord.uid,
      userData: {
        uid: userRecord.uid,
        email,
        name,
        role,
      }
    };
  } catch (error: any) {
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Este email já está em uso.");
    } else if (error.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "Email inválido.");
    } else if (error.code === "auth/weak-password") {
      throw new HttpsError("invalid-argument", "Senha muito fraca.");
    }

    throw new HttpsError("internal", error instanceof Error ? error.message : "Erro interno do servidor");
  }
});

/**
 * Função Cloud para executar a troca de salas entre dois agendamentos de professores.
 * Valida permissões, se ambos os agendamentos existem e permuta as salas de forma transacional.
 */
export const executeScheduleSwap = onCall(functionConfig, async (request: any) => {
  const data = request.data;
  const { swapRequestId, schedule1Id, schedule2Id } = data;

  if (!swapRequestId || !schedule1Id || !schedule2Id) {
    throw new HttpsError("invalid-argument", "IDs de swap e agendamentos são obrigatórios.");
  }

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "A operação requer autenticação logada.");
  }

  if (isRateLimited(`executeScheduleSwap:${request.auth.uid}`, 60000, 5)) {
    throw new HttpsError("resource-exhausted", "Muitas requisições. Tente novamente em alguns minutos.");
  }

  try {
    const primarySwapRef = db.collection("scheduleSwaps").doc(swapRequestId);
    const fallbackSwapRef = db.collection("schedule_swap_requests").doc(swapRequestId);
    const sched1Ref = db.collection("schedules").doc(schedule1Id);
    const sched2Ref = db.collection("schedules").doc(schedule2Id);

    const result = await db.runTransaction(async (transaction) => {
      let swapDoc = await transaction.get(primarySwapRef);
      let activeSwapRef = primarySwapRef;

      if (!swapDoc.exists) {
        swapDoc = await transaction.get(fallbackSwapRef);
        activeSwapRef = fallbackSwapRef;
      }

      if (!swapDoc.exists) {
        throw new HttpsError("not-found", "Solicitação de troca não encontrada.");
      }

      const swapData = swapDoc.data()!;
      const validStatuses = ["pending", "pendente", "aprovada"];
      if (!validStatuses.includes(swapData.status)) {
        throw new HttpsError("failed-precondition", `A solicitação não pode ser executada com status: ${swapData.status}`);
      }

      // Validação de permissão do usuário
      const callerUid = request.auth.uid;
      const callerEmail = request.auth.token?.email;
      const userDoc = await transaction.get(db.collection("users").doc(callerUid));
      const userData = userDoc.exists ? userDoc.data() : null;
      const userRole = userData?.role || "";
      const callerTeacherId = userData?.teacherId || callerUid;

      const isPrivileged = ["ADMIN", "admin", "SUPER_ADMIN", "super_admin", "USER", "user"].includes(userRole);
      const isTargetTeacher = swapData.targetTeacherId === callerUid || 
                             swapData.targetTeacherId === callerTeacherId ||
                             (swapData.targetTeacherEmail && swapData.targetTeacherEmail === callerEmail);
      const isRequesterTeacher = swapData.requesterTeacherId === callerUid || 
                                swapData.requesterTeacherId === callerTeacherId;

      if (!isPrivileged && !isTargetTeacher && !isRequesterTeacher) {
        throw new HttpsError("permission-denied", "Você não tem permissão para aceitar esta solicitação de troca.");
      }

      const [s1Doc, s2Doc] = await Promise.all([
        transaction.get(sched1Ref),
        transaction.get(sched2Ref)
      ]);

      if (!s1Doc.exists || !s2Doc.exists) {
        throw new HttpsError("not-found", "Um ou ambos os agendamentos da troca não foram encontrados.");
      }

      const s1 = s1Doc.data()!;
      const s2 = s2Doc.data()!;

      // Permutação de salas (troca de sala entre professores)
      const room1 = { id: s1.roomId, name: s1.roomName };
      const room2 = { id: s2.roomId, name: s2.roomName };

      transaction.update(sched1Ref, {
        roomId: room2.id,
        roomName: room2.name,
        swapRequestId: swapRequestId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(sched2Ref, {
        roomId: room1.id,
        roomName: room1.name,
        swapRequestId: swapRequestId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(activeSwapRef, {
        status: "accepted",
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        acceptedBy: callerUid,
        executedAt: admin.firestore.FieldValue.serverTimestamp(),
        executedBy: callerUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        message: "Troca de sala executada com sucesso!",
        details: {
          schedule1: { id: schedule1Id, teacher: s1.teacherName, newRoom: room2.name },
          schedule2: { id: schedule2Id, teacher: s2.teacherName, newRoom: room1.name }
        }
      };
    });

    invalidateCache("schedules");
    return result;

  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "internal",
      error instanceof Error ? error.message : "Erro ao executar swap de agendamento"
    );
  }
});

/**
 * Função para atualizar agendamento com todas as validações de segurança
 */
export const updateSchedule = onCall(functionConfig, async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "A operação requer autenticação.");
  }

  const { scheduleId, updateData } = request.data;
  if (!scheduleId || !updateData) {
    throw new HttpsError("invalid-argument", "ID do agendamento e dados de atualização são obrigatórios.");
  }

  try {
    const scheduleRef = db.collection("schedules").doc(scheduleId);
    const scheduleSnap = await scheduleRef.get();

    if (!scheduleSnap.exists) {
      throw new HttpsError("not-found", "Agendamento não encontrado.");
    }

    const currentData = scheduleSnap.data()!;

    // Verificar permissões: Admin ou Operacional
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    const isAdmin = callerDoc.exists && (callerDoc.data()?.role === "ADMIN" || callerDoc.data()?.role === "USER");

    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Apenas administradores podem editar agendamentos diretamente.");
    }

    // Se houver mudança de horário, professor, sala ou turma, re-validar conflitos e limites
    const timeChanged = (updateData.startTime && updateData.startTime !== currentData.startTime.toDate().toISOString()) ||
      (updateData.endTime && updateData.endTime !== currentData.endTime.toDate().toISOString());
    const teacherChanged = updateData.teacherId && updateData.teacherId !== currentData.teacherId;
    const roomChanged = updateData.roomId && updateData.roomId !== currentData.roomId;
    const classChanged = updateData.classId && updateData.classId !== currentData.classId;

    if (timeChanged || teacherChanged || roomChanged || classChanged) {
      const targetTeacherId = updateData.teacherId || currentData.teacherId;
      const targetRoomId = updateData.roomId || currentData.roomId;
      const targetClassId = updateData.classId || currentData.classId;
      const targetStartTime = new Date(updateData.startTime || currentData.startTime.toDate().toISOString());
      const targetEndTime = new Date(updateData.endTime || currentData.endTime.toDate().toISOString());

      const collision = await findScheduleCollisions({
        teacherId: targetTeacherId,
        roomId: targetRoomId,
        classId: targetClassId,
        startTime: targetStartTime,
        endTime: targetEndTime,
        excludeScheduleId: scheduleId
      });

      if (collision.hasCollision) {
        throw new HttpsError("already-exists", `Alteração bloqueada por conflito de horário: ${collision.description}`);
      }
    }

    const finalUpdate: any = { ...updateData };
    delete finalUpdate.ignoreLimits;
    
    // Se mudou a turma, atualizar className/courseName e carga horária (PDR 1)
    if (classChanged) {
      const targetClassRef = await db.collection("classes").doc(updateData.classId).get();
      if (targetClassRef.exists) {
        const targetClassData = targetClassRef.data()!;
        finalUpdate.className = targetClassData.name;
        finalUpdate.dailyWorkload = targetClassData.dailyWorkload;
        finalUpdate.executionModel = targetClassData.executionModel;
      }
    }

    if (updateData.startTime) finalUpdate.startTime = admin.firestore.Timestamp.fromDate(new Date(updateData.startTime));
    if (updateData.endTime) finalUpdate.endTime = admin.firestore.Timestamp.fromDate(new Date(updateData.endTime));
    finalUpdate.updatedBy = request.auth.uid;
    finalUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await scheduleRef.update(finalUpdate);
    invalidateCache("schedules");

    return { status: "success", message: "Agendamento atualizado com sucesso!" };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error instanceof Error ? error.message : "Erro ao atualizar agendamento.");
  }
});

/**
 * Função para excluir agendamento com validação de permissão
 */
export const deleteSchedule = onCall(functionConfig, async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "A operação requer autenticação.");
  }

  const { scheduleId } = request.data;
  if (!scheduleId) {
    throw new HttpsError("invalid-argument", "ID do agendamento é obrigatório.");
  }

  try {
    const scheduleRef = db.collection("schedules").doc(scheduleId);
    const scheduleSnap = await scheduleRef.get();

    if (!scheduleSnap.exists) {
      return { status: "success", message: "Agendamento já não existe." };
    }

    const scheduleData = scheduleSnap.data()!;
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    const role = callerDoc.data()?.role;
    const isAdmin = role === "ADMIN" || role === "USER";

    // Professor só deleta o que criou
    if (!isAdmin && (role !== "PROFESSOR" || scheduleData.createdBy !== request.auth.uid)) {
      throw new HttpsError("permission-denied", "Você não tem permissão para excluir este agendamento.");
    }

    await scheduleRef.delete();
    invalidateCache("schedules");

    return { status: "success", message: "Agendamento excluído com sucesso!" };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error instanceof Error ? error.message : "Erro ao excluir agendamento.");
  }
});

/**
 * Função Chamável (onCall) para disparar o motor de geração automática de agenda (PDR 2).
 */
export const runScheduleGenerator = onCall(functionConfig, async (request: any) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "A operação requer autenticação.");
  }

  const { turmaId, mode = 'preserve' } = request.data;
  if (!turmaId) {
    throw new HttpsError("invalid-argument", "O ID da turma é obrigatório.");
  }

  // Rate limiting: 1 geração por minuto por turma
  if (isRateLimited(`generateSchedule:${turmaId}`, 60000, 1)) {
    throw new HttpsError("resource-exhausted", "Já existe uma geração em andamento ou solicitada recentemente para esta turma.");
  }

  try {
    const { generateSchedule } = await import("./generator/generatorCore.js");
    
    generateSchedule({
      turmaId,
      userId: request.auth.uid,
      mode: mode as 'overwrite' | 'preserve'
    }).catch(err => console.error("Erro em background na geração:", err));

    return {
      status: "success",
      message: "Motor de geração iniciado com sucesso. Acompanhe o progresso nos logs."
    };
  } catch (error) {
    console.error("Erro fatal ao iniciar runScheduleGenerator:", error);
    throw new HttpsError("internal", error instanceof Error ? error.message : "Erro ao iniciar o motor de geração.");
  }
});

// --- GATILHOS DE NOTIFICAÇÃO E AGENDAMENTO EM BACKGROUND ---
export { onScheduleWritten, onRoomUpdated, onTeacherDeleted, onTeacherStatusUpdated } from "./notifications.js";
export { cleanupOldAuditLogs } from "./FinOps_CleanupLogs_Prototype.js";

// --- RESOLUÇÃO DE CONFLITOS (HUB DE CONFLITOS) ---
export { resolveScheduleConflict } from "./copySchedules.js";
