import { db, functions } from "@/lib/db";
import { collection, query, where, getDocs, Timestamp, addDoc, doc, updateDoc, getDoc, runTransaction } from "@/lib/sira-sql-adapter";
import { httpsCallable } from "@/lib/sira-functions-adapter";
import { Schedule } from "./reservationService";
import { startOfDay, endOfDay } from "date-fns";

export async function getSwapOptions(sourceSchedule: Schedule, teacherId: string, unitId?: string): Promise<Schedule[]> {
    const sTime = sourceSchedule.startTime.toDate();
    const dayStart = startOfDay(sTime);
    const dayEnd = endOfDay(sTime);
    const targetUnitId = unitId || (sourceSchedule as any).unitId;

    const getShift = (date: Date) => {
        // Ajuste consistente para fuso horário de Cuiabá/Mato Grosso (UTC-4)
        const hour = (date.getUTCHours() - 4 + 24) % 24;
        if (hour >= 7 && hour < 13) return 'matutino';
        if (hour >= 13 && hour < 18) return 'vespertino';
        return 'noturno';
    };

    const sourceShift = getShift(sTime);

    const schedulesRef = collection(db, "schedules");
    const q = query(
        schedulesRef,
        where("startTime", ">=", Timestamp.fromDate(dayStart)),
        where("startTime", "<=", Timestamp.fromDate(dayEnd))
    );

    const snapshot = await getDocs(q);
    const schedules: Schedule[] = [];

    snapshot.forEach((doc) => {
        const data = doc.data() as Omit<Schedule, "id">;
        const targetShift = getShift(data.startTime.toDate());

        // Isolamento por unidade: garantir que a troca ocorra na mesma unidade
        if (targetUnitId && (data as any).unitId && (data as any).unitId !== targetUnitId) {
            return;
        }

        // Check for same shift and different teacher
        if (data.teacherId !== teacherId && targetShift === sourceShift) {
            schedules.push({ id: doc.id, ...data });
        }
    });

    return schedules;
}

export async function requestSwap(params: {
    teacherId: string;
    teacherName: string;
    requesterSchedule: Schedule;
    targetTeacherId: string;
    targetTeacherName: string;
    targetSchedule: Schedule;
    message: string;
}): Promise<void> {
    const swapRequestsRef = collection(db, "scheduleSwaps");
    await addDoc(swapRequestsRef, {
        requesterTeacherId: params.teacherId,
        requesterTeacherName: params.teacherName,
        requesterScheduleId: params.requesterSchedule.id,
        requesterSchedule: {
            className: params.requesterSchedule.className,
            roomName: params.requesterSchedule.roomName,
            roomId: params.requesterSchedule.roomId || null,
        },
        targetTeacherId: params.targetTeacherId,
        targetTeacherName: params.targetTeacherName,
        targetScheduleId: params.targetSchedule.id,
        targetSchedule: {
            className: params.targetSchedule.className,
            roomName: params.targetSchedule.roomName,
            roomId: params.targetSchedule.roomId || null,
        },
        // unitId para filtro por unidade no analytics
        unitId: (params.requesterSchedule as any).unitId || null,
        status: "pending",
        message: params.message,
        justification: params.message,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
}

export async function getIncomingSwapRequests(teacherIds: string | string[]): Promise<any[]> {
    const ids = Array.isArray(teacherIds) 
        ? Array.from(new Set(teacherIds.filter(Boolean))) 
        : [teacherIds].filter(Boolean);

    if (ids.length === 0) return [];

    const swapRequestsRef = collection(db, "scheduleSwaps");
    const resultsMap = new Map<string, any>();

    await Promise.all(
        ids.map(async (id) => {
            try {
                const q = query(
                    swapRequestsRef,
                    where("targetTeacherId", "==", id),
                    where("status", "==", "pending")
                );
                const snapshot = await getDocs(q);
                snapshot.docs.forEach((docSnap) => {
                    resultsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
                });
            } catch (err) {
                console.error(`Erro ao buscar trocas para teacherId ${id}:`, err);
            }
        })
    );

    return Array.from(resultsMap.values());
}

export async function respondToSwapRequest(swapId: string, status: "accepted" | "rejected"): Promise<void> {
    const swapRef = doc(db, "scheduleSwaps", swapId);
    const swapSnap = await getDoc(swapRef);

    if (!swapSnap.exists()) throw new Error("Solicitação não encontrada");
    const swapData = swapSnap.data();

    if (status === "accepted") {
        try {
            // Tenta executar via Cloud Function segura
            const executeSwap = httpsCallable(functions, "executeScheduleSwap");
            await executeSwap({
                swapRequestId: swapId,
                schedule1Id: swapData.requesterScheduleId,
                schedule2Id: swapData.targetScheduleId
            });
        } catch (fnErr: any) {
            console.warn("Cloud Function executeScheduleSwap falhou ou indisponível, executando fallback transacional no Firestore:", fnErr);
            
            // Fallback atômico client-side com verificação de agendamentos e swap de salas
            await runTransaction(db, async (transaction) => {
                const s1Ref = doc(db, "schedules", swapData.requesterScheduleId);
                const s2Ref = doc(db, "schedules", swapData.targetScheduleId);
                const currentSwapRef = doc(db, "scheduleSwaps", swapId);

                const [s1Snap, s2Snap] = await Promise.all([
                    transaction.get(s1Ref),
                    transaction.get(s2Ref)
                ]);

                if (!s1Snap.exists() || !s2Snap.exists()) {
                    throw new Error("Um ou ambos os agendamentos da troca não foram encontrados.");
                }

                const s1 = s1Snap.data();
                const s2 = s2Snap.data();

                // Troca de sala entre os dois agendamentos
                transaction.update(s1Ref, {
                    roomId: s2.roomId,
                    roomName: s2.roomName,
                    swapRequestId: swapId,
                    updatedAt: Timestamp.now()
                });

                transaction.update(s2Ref, {
                    roomId: s1.roomId,
                    roomName: s1.roomName,
                    swapRequestId: swapId,
                    updatedAt: Timestamp.now()
                });

                transaction.update(currentSwapRef, {
                    status: "accepted",
                    acceptedAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
            });
        }
    } else {
        await updateDoc(swapRef, { 
            status: "rejected", 
            rejectedAt: Timestamp.now(),
            updatedAt: Timestamp.now() 
        });
    }
}
export async function getVacantRooms(startTime: Date, endTime: Date, unitId?: string): Promise<any[]> {
    const roomsRef = collection(db, "rooms");
    const roomsSnap = await getDocs(roomsRef);
    let allRooms = roomsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (unitId) {
        allRooms = allRooms.filter((r: any) => !r.unitId || r.unitId === unitId);
    }

    const dayStart = startOfDay(startTime);
    const dayEnd = endOfDay(startTime);
    
    const schedulesRef = collection(db, "schedules");
    const q = query(
        schedulesRef,
        where("startTime", ">=", Timestamp.fromDate(dayStart)),
        where("startTime", "<=", Timestamp.fromDate(dayEnd))
    );
    
    const schedulesSnap = await getDocs(q);
    const occupiedRoomIds = new Set<string>();
    
    schedulesSnap.forEach(doc => {
        const data = doc.data();
        if (unitId && (data as any).unitId && (data as any).unitId !== unitId) {
            return;
        }
        const sStart = data.startTime.toDate();
        const sEnd = data.endTime.toDate();
        
        if (startTime < sEnd && endTime > sStart) {
            occupiedRoomIds.add(data.roomId);
        }
    });

    return allRooms.filter((room: any) => room.available !== false && !occupiedRoomIds.has(room.id));
}

export async function requestRoomChange(params: { scheduleId: string, roomId: string, roomName: string }): Promise<void> {
    const scheduleRef = doc(db, "schedules", params.scheduleId);
    await updateDoc(scheduleRef, {
        roomId: params.roomId,
        roomName: params.roomName,
        updatedAt: Timestamp.now()
    });
}
