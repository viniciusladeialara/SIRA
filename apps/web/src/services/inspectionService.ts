/**
 * @file inspectionService.ts
 * @description Serviço para gestão de vistorias (Check-in / Check-out), cadeia de custódia e ocorrências de itens em salas/laboratórios.
 */

import { db, storage } from "@/lib/db";
import { 
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs, 
    onSnapshot, 
    Timestamp 
} from "@/lib/sira-sql-adapter";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { logAction, AuditAction } from "@/lib/AuditLog";

export interface RoomItemConfig {
    id: string;
    name: string;
    category: "climatizacao" | "audiovisual" | "informatica" | "ferramentas" | "epi" | "didatico" | "outro";
    isEssential?: boolean;
    quantity?: number;
    code?: string; // Código de patrimônio ou etiqueta
    subItems?: string[]; // Ferramentas ou itens contidos (Ex: ["Chave de Fenda", "Alicate Universal", "Multímetro"])
}

export interface ItemInspectionState {
    itemId: string;
    itemName: string;
    category?: string;
    status: "ok" | "danificado" | "faltando";
    notes?: string;
    photoUrl?: string;
    subItems?: string[];
    subItemsDiscrepancy?: string[]; // Subitens específicos avariados ou faltantes
}

export interface RoomInspectionData {
    id?: string;
    scheduleId: string;
    roomId: string;
    roomName: string;
    unitId: string;
    teacherId: string;
    teacherName: string;
    className: string;
    type: "CHECK_IN" | "CHECK_OUT";
    inspectedAt?: Timestamp;
    itemsState: ItemInspectionState[];
    turnOffChecks?: {
        acTurnedOff: boolean;
        projectorTurnedOff: boolean;
        lightsTurnedOff: boolean;
        doorLocked: boolean;
    };
    generalObservation?: string;
    hasDiscrepancy: boolean;
    discrepanciesSummary?: string;
    previousInspectionId?: string;
    previousTeacherName?: string;
}

export interface RoomIssue {
    id?: string;
    roomId: string;
    roomName: string;
    unitId: string;
    inspectionId?: string;
    scheduleId?: string;
    reportedByTeacherId: string;
    reportedByTeacherName: string;
    itemId?: string;
    itemName: string;
    issueType: "danificado" | "faltando" | "mau_funcionamento";
    severity: "low" | "medium" | "high";
    description: string;
    photoUrl?: string;
    reportedStage?: "CHECK_IN" | "CHECK_OUT";
    status: "open" | "in_progress" | "resolved";
    createdAt: Timestamp;
    resolvedAt?: Timestamp;
    resolvedBy?: string;
    resolvedByName?: string;
    resolutionNotes?: string;
}

/**
 * Faz upload de imagem/foto de comprovação da avaria para o Firebase Storage
 */
export async function uploadInspectionPhoto(file: File, roomId: string = "general"): Promise<string> {
    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `room_issues_photos/${roomId}_${timestamp}_${cleanFileName}`;
    const storageRef = ref(storage, storagePath);
    
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
}

/**
 * Templates padrão de itens para salas, laboratórios e oficinas
 */
export const DEFAULT_ROOM_TEMPLATES: Record<string, RoomItemConfig[]> = {
    "Sala de Aula Padrão": [
        { id: "ac_control", name: "Controle do Ar Condicionado", category: "climatizacao", isEssential: true },
        { id: "projector", name: "Projetor / Data Show", category: "audiovisual", isEssential: true },
        { id: "projector_control", name: "Controle do Data Show", category: "audiovisual", isEssential: false },
        { id: "multimedia_kit", name: "Kit Cabos (HDMI / VGA / Energia)", category: "audiovisual", isEssential: true },
        { id: "teacher_pc", name: "Computador / Mesa do Professor", category: "informatica", isEssential: true },
        { id: "whiteboard_kit", name: "Estojo com Pincéis e Apagador", category: "didatico", isEssential: false }
    ],
    "Laboratório de Informática": [
        { id: "ac_control", name: "Controle do Ar Condicionado", category: "climatizacao", isEssential: true },
        { id: "projector", name: "Projetor / Data Show e Cabos", category: "audiovisual", isEssential: true },
        { id: "teacher_pc", name: "Computador Principal do Docente", category: "informatica", isEssential: true },
        { id: "student_pcs", name: "Bancadas com Computadores dos Alunos", category: "informatica", isEssential: true, quantity: 25 },
        { id: "network_switch", name: "Rack de Rede / Conectividade e Internet", category: "informatica", isEssential: true },
        { id: "peripherals", name: "Teclados e Mouses das Bancadas", category: "informatica", isEssential: false }
    ],
    "Oficina Técnica / Eletromecânica": [
        { id: "ventilation", name: "Sistema de Exaustão / Climatização", category: "climatizacao", isEssential: true },
        { 
            id: "tool_box_mech", 
            name: "Caixa de Ferramentas Mecânicas", 
            category: "ferramentas", 
            isEssential: true,
            subItems: [
                "Jogo de Chaves de Fenda",
                "Jogo de Chaves Philips",
                "Jogo de Chaves Combinadas (6 a 22mm)",
                "Alicate Universal 8\"",
                "Alicate de Corte Diagonal",
                "Alicate de Pressão",
                "Martelo de Borracha / Mecânico",
                "Paquímetro Digital de Precisão"
            ]
        },
        { id: "safety_epc", name: "Equipamentos de Proteção Coletiva (EPC)", category: "didatico", isEssential: true },
        { id: "technical_benches", name: "Bancadas Didáticas com Tomadas Industriais", category: "didatico", isEssential: true },
        { id: "projector_pc", name: "Computador / Multimídia da Oficina", category: "audiovisual", isEssential: false }
    ],
    "Laboratório de Eletrônica / Maker": [
        { id: "ac_control", name: "Controle do Ar Condicionado", category: "climatizacao", isEssential: true },
        { 
            id: "tool_box_elec", 
            name: "Maleta de Ferramentas Eletroeletrônicas", 
            category: "ferramentas", 
            isEssential: true,
            subItems: [
                "Multímetro Digital True RMS",
                "Estação de Solda com Suporte e Esponja",
                "Alicate Decapador de Cabos",
                "Alicate de Bico Fino",
                "Sugador de Solda Térmico",
                "Kit Protoboard com Jumpers M/F"
            ]
        },
        { id: "oscilloscope", name: "Osciloscópio Digital de Bancada", category: "informatica", isEssential: true },
        { id: "source_bench", name: "Fonte de Tensão Regulável DC", category: "didatico", isEssential: true },
        { id: "projector", name: "Projetor Interativo / Telão", category: "audiovisual", isEssential: true }
    ]
};

/**
 * Retorna os itens esperados para um ambiente com base nos itens cadastrados no inventário da sala.
 */
export function getExpectedRoomItems(room: { type?: string; items?: RoomItemConfig[]; resources?: string[] }): RoomItemConfig[] {
    if (room?.items && Array.isArray(room.items)) {
        return room.items;
    }
    return [];
}

/**
 * Busca a última vistoria realizada em uma sala para verificar a cadeia de custódia anterior.
 */
export async function getLatestRoomInspection(roomId: string): Promise<RoomInspectionData | null> {
    try {
        const q = query(
            collection(db, "room_inspections"),
            where("roomId", "==", roomId),
            orderBy("inspectedAt", "desc"),
            limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as RoomInspectionData;
        }
        return null;
    } catch (error) {
        console.warn("Aviso ao buscar última vistoria da sala:", error);
        return null;
    }
}

/**
 * Salva uma vistoria de Entrada ou Saída, atualiza o agendamento e gera ocorrências automáticas se houver avarias.
 */
export async function saveRoomInspection(
    data: RoomInspectionData,
    currentUserAuth?: any
): Promise<{ inspectionId: string; createdIssuesCount: number }> {
    const inspectedAt = Timestamp.now();
    const discrepancies = data.itemsState.filter(item => item.status !== "ok");
    const hasDiscrepancy = discrepancies.length > 0;
    
    let discrepanciesSummary = "";
    if (hasDiscrepancy) {
        discrepanciesSummary = discrepancies
            .map(d => `${d.itemName}: ${d.status === "danificado" ? "Danificado" : "Faltando"}${d.notes ? ` (${d.notes})` : ""}`)
            .join("; ");
    }

    // 1. Gravar documento na coleção room_inspections
    const inspectionRef = await addDoc(collection(db, "room_inspections"), {
        ...data,
        inspectedAt,
        hasDiscrepancy,
        discrepanciesSummary: discrepanciesSummary || null,
        createdAt: inspectedAt
    });

    let createdIssuesCount = 0;

    // 2. Se houver itens danificados ou faltando, criar chamados em room_issues
    if (hasDiscrepancy) {
        for (const disc of discrepancies) {
            const isHigh = disc.status === "faltando" || disc.itemName.toLowerCase().includes("ar") || disc.itemName.toLowerCase().includes("data show") || disc.itemName.toLowerCase().includes("projetor");
            await addDoc(collection(db, "room_issues"), {
                roomId: data.roomId,
                roomName: data.roomName,
                unitId: data.unitId || "caceres",
                inspectionId: inspectionRef.id,
                scheduleId: data.scheduleId,
                reportedByTeacherId: data.teacherId,
                reportedByTeacherName: data.teacherName,
                itemName: disc.itemName,
                issueType: disc.status === "danificado" ? "danificado" : "faltando",
                severity: isHigh ? "high" : "medium",
                description: disc.notes || `Item ${disc.itemName} reportado como ${disc.status} durante vistoria de ${data.type === "CHECK_IN" ? "entrada" : "saída"}.`,
                photoUrl: disc.photoUrl || null,
                reportedStage: data.type,
                status: "open",
                createdAt: inspectedAt
            });
            createdIssuesCount++;
        }
    }

    // 3. Atualizar o agendamento com o status da vistoria
    if (data.scheduleId) {
        try {
            const scheduleRef = doc(db, "schedules", data.scheduleId);
            const updatePayload: Record<string, any> = {
                updatedAt: inspectedAt
            };

            if (data.type === "CHECK_IN") {
                updatePayload.checkInCompleted = true;
                updatePayload.checkInAt = inspectedAt;
                updatePayload.checkInDiscrepancy = hasDiscrepancy;
            } else {
                updatePayload.checkOutCompleted = true;
                updatePayload.checkOutAt = inspectedAt;
                updatePayload.checkOutDiscrepancy = hasDiscrepancy;
                // No checkout, podemos também marcar status concluído se estiver pendente
                updatePayload.status = "concluida";
                updatePayload.derivedStatus = "concluida";
            }

            await updateDoc(scheduleRef, updatePayload);
        } catch (scheduleErr) {
            console.warn("Aviso ao atualizar agendamento com vistoria:", scheduleErr);
        }
    }

    // 4. Registrar no log de auditoria
    if (currentUserAuth) {
        await logAction(
            AuditAction.UPDATE_SCHEDULE,
            currentUserAuth,
            `Vistoria de ${data.type === "CHECK_IN" ? "Entrada" : "Saída"} realizada na sala ${data.roomName} por ${data.teacherName}.${hasDiscrepancy ? ` Ocorrências: ${discrepanciesSummary}` : " Tudo 100% OK."}`,
            {
                inspectionId: inspectionRef.id,
                roomId: data.roomId,
                scheduleId: data.scheduleId,
                type: data.type,
                hasDiscrepancy,
                discrepancies
            }
        );
    }

    return { inspectionId: inspectionRef.id, createdIssuesCount };
}

/**
 * Escuta o histórico de vistorias de uma unidade em tempo real.
 */
export function subscribeToRoomInspections(unitId: string, callback: (inspections: RoomInspectionData[]) => void) {
    const q = query(
        collection(db, "room_inspections"),
        where("unitId", "==", unitId || "caceres"),
        limit(100)
    );

    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        })) as RoomInspectionData[];

        // Ordenação em memória resiliente (mais recente primeiro)
        data.sort((a, b) => {
            const timeA = a.inspectedAt?.toMillis ? a.inspectedAt.toMillis() : 0;
            const timeB = b.inspectedAt?.toMillis ? b.inspectedAt.toMillis() : 0;
            return timeB - timeA;
        });

        callback(data);
    }, (error) => {
        console.error("Erro no onSnapshot de vistorias:", error);
    });
}

/**
 * Escuta os chamados de problemas em salas abertos para a equipe de apoio/manutenção.
 */
export function subscribeToRoomIssues(unitId: string, callback: (issues: RoomIssue[]) => void) {
    const q = query(
        collection(db, "room_issues"),
        where("unitId", "==", unitId || "caceres"),
        limit(100)
    );

    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        })) as RoomIssue[];

        // Ordenação em memória resiliente (mais recente primeiro)
        data.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });

        callback(data);
    }, (error) => {
        console.error("Erro no onSnapshot de chamados de sala:", error);
    });
}

/**
 * Atualiza o status de um chamado de problema na sala (open -> in_progress -> resolved).
 */
export async function updateRoomIssueStatus(
    issueId: string,
    status: "open" | "in_progress" | "resolved",
    userAuth: any,
    resolutionNotes?: string
) {
    const issueRef = doc(db, "room_issues", issueId);
    const updateData: Record<string, any> = {
        status,
        updatedAt: Timestamp.now()
    };

    if (status === "resolved") {
        updateData.resolvedAt = Timestamp.now();
        updateData.resolvedBy = userAuth?.displayName || userAuth?.email || "Admin";
        updateData.resolvedById = userAuth?.uid || "admin";
        if (resolutionNotes) {
            updateData.resolutionNotes = resolutionNotes;
        }
        await updateDoc(issueRef, updateData);
    }
}

/**
 * Escuta os agendamentos da unidade para acompanhamento de custódia e status de check-in / check-out em tempo real.
 */
export function subscribeToUnitSchedulesWithInspections(unitId: string, callback: (schedules: any[]) => void) {
    const q = query(
        collection(db, "schedules"),
        where("unitId", "==", unitId || "caceres"),
        limit(300)
    );

    return onSnapshot(q, (snapshot) => {
        const schedules = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));

        // Ordenar por horário de início (mais recentes primeiro)
        schedules.sort((a: any, b: any) => {
            const timeA = a.startTime?.toMillis ? a.startTime.toMillis() : 0;
            const timeB = b.startTime?.toMillis ? b.startTime.toMillis() : 0;
            return timeB - timeA;
        });

        callback(schedules);
    }, (error) => {
        console.error("Erro no onSnapshot de agendamentos para custódia:", error);
    });
}

/**
 * Cria um chamado de suporte/ocorrência manual aberto pelo docente.
 */
export async function createManualRoomIssue(issueData: {
    roomId: string;
    roomName: string;
    unitId: string;
    reportedByTeacherId: string;
    reportedByTeacherName: string;
    itemName: string;
    issueType: "danificado" | "faltando" | "mau_funcionamento";
    severity: "low" | "medium" | "high";
    description: string;
    photoUrl?: string;
}): Promise<string> {
    const docRef = await addDoc(collection(db, "room_issues"), {
        ...issueData,
        reportedStage: "MANUAL",
        status: "open",
        createdAt: Timestamp.now()
    });
    return docRef.id;
}

