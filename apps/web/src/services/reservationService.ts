import { db, functions, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { startOfDay, endOfMonth, addDays, subDays } from "date-fns";

export interface Schedule {
    id: string;
    className: string;
    courseName: string;
    roomName: string;
    roomId: string;
    teacherName: string;
    teacherId: string;
    startTime: Timestamp;
    endTime: Timestamp;
    observation?: string;
    status?: 'pendente' | 'concluida';
    derivedStatus?: 'pendente' | 'concluida';
    comments?: {
        id: string;
        userId: string;
        userName: string;
        text: string;
        createdAt: Timestamp;
    }[];
    checkInCompleted?: boolean;
    checkOutCompleted?: boolean;
    checklist?: {
        updatedAt: Timestamp;
        [key: string]: any;
    };
}

export interface TeacherReservationParams {
    roomId: string;
    classId?: string | null;
    teacherId?: string;
    scheduleSlots: { startTime: string; endTime: string }[];
    observation?: string;
}

/**
 * Busca todos os agendamentos de um professor a partir de 7 dias atrás até 45 dias no futuro.
 */
export async function fetchTeacherSchedules(teacherId: string, _targetMonth?: Date): Promise<Schedule[]> {
    const todayStart = startOfDay(new Date());
    const minPastDate = subDays(todayStart, 2);
    const maxFutureDate = addDays(todayStart, 14);

    const schedulesQuery = query(
        collection(db, "schedules"),
        where("teacherId", "==", teacherId),
        where("startTime", ">=", Timestamp.fromDate(minPastDate)),
        where("startTime", "<=", Timestamp.fromDate(maxFutureDate))
    );

    const snapshot = await getDocs(schedulesQuery);

    const schedules = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as Schedule[];

    return schedules.sort((a, b) => a.startTime.toDate().getTime() - b.startTime.toDate().getTime());
}

/**
 * Criação da reserva em lote unificada via Cloud Function createScheduleBatch
 */
export async function createTeacherReservation(params: TeacherReservationParams) {
    const createScheduleBatch = httpsCallable(functions, "createScheduleBatch");
    return createScheduleBatch({
        ...params,
        classId: params.classId || "direct_booking",
        teacherId: params.teacherId || auth.currentUser?.uid
    });
}
