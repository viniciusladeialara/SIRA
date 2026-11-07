import { Timestamp } from "@/lib/timestamp";
import { apiService } from "./apiService";
import { db } from "@/lib/db";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "@/lib/sira-sql-adapter";

export type HiringStepStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";

export interface HiringChecklist {
  [key: string]: boolean;
}

export interface HiringStep {
  status: HiringStepStatus;
  checklist: HiringChecklist;
}

export interface HiringProcess {
  id?: string;
  teacher_id?: string;
  teacher_name: string;
  class_id: string;
  class_name?: string;
  course_name: string;
  project: string;
  status: "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "NOT_STARTED";
  responsible_user: string;
  responsible_name?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  steps?: {
    documentacao: HiringStep;
    validacao: HiringStep;
    treinamento: HiringStep;
    assinaturas: HiringStep;
  };
  step_definicao_perfil?: HiringStep;
  step_divulgacao_triagem?: HiringStep;
  step_entrevista_tecnica?: HiringStep;
  step_encaminhamento_rh?: HiringStep;
  step_admissao_contratacao?: HiringStep;
}

export async function createHiringProcess(data: Omit<HiringProcess, "id" | "created_at" | "updated_at">): Promise<string> {
  try {
    const res = await apiService.request('/api/contratacoes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.id || 'id_mock';
  } catch (err) {
    const docRef = await addDoc(collection(db, "hiring_processes"), {
      ...data,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    return docRef.id;
  }
}

export async function updateHiringProcess(id: string, data: Partial<HiringProcess>): Promise<void> {
  try {
    await apiService.request(`/api/contratacoes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  } catch (err) {
    await updateDoc(doc(db, "hiring_processes", id), {
      ...data,
      updated_at: serverTimestamp()
    });
  }
}

export async function deleteHiringProcess(id: string): Promise<void> {
  try {
    await apiService.request(`/api/contratacoes/${id}`, {
      method: 'DELETE'
    });
  } catch (err) {
    await deleteDoc(doc(db, "hiring_processes", id));
  }
}

export function subscribeHiringProcesses(callback: (processes: HiringProcess[]) => void) {
  let isCancelled = false;
  let firestoreUnsub: (() => void) | null = null;
  let isUsingFirestore = false;

  const startFirestoreListener = () => {
    if (isUsingFirestore || isCancelled) return;
    isUsingFirestore = true;
    firestoreUnsub = onSnapshot(collection(db, "hiring_processes"), (snap) => {
      if (isCancelled) return;
      const list = snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as HiringProcess[];
      callback(list);
    }, (err) => {
      console.warn("Aviso ao carregar hiring_processes do Firestore:", err);
    });
  };

  const fetchProcesses = async () => {
    if (isUsingFirestore) return;
    try {
      const data = await apiService.request('/api/contratacoes');
      if (!isCancelled && Array.isArray(data)) {
        callback(data);
      }
    } catch (e: any) {
      // Se a rota backend SQL retornar 404 ou não responder, migra de forma transparente para Firestore
      startFirestoreListener();
    }
  };

  fetchProcesses();
  const interval = setInterval(fetchProcesses, 10000);

  return () => {
    isCancelled = true;
    clearInterval(interval);
    if (firestoreUnsub) {
      firestoreUnsub();
    }
  };
}

export const subscribeToProcesses = subscribeHiringProcesses;
export const createProcess = createHiringProcess;
export const updateProcess = updateHiringProcess;
export const deleteProcess = deleteHiringProcess;

export const hiringService = {
  createHiringProcess,
  updateHiringProcess,
  deleteHiringProcess,
  subscribeHiringProcesses,
  subscribeToProcesses,
  createProcess,
  updateProcess,
  deleteProcess
};
