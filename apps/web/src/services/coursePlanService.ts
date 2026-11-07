import { collection, doc, getDocs, getDoc, query, where, addDoc, updateDoc, deleteDoc, writeBatch } from "@/lib/sira-sql-adapter";
import { db } from "../lib/db";
import { logger } from "../lib/logger";

// --- Interfaces ---

export interface Course {
  id?: string;
  name: string;
  status: "active" | "inactive";
  createdAt?: string;
}

export interface CurricularUnit {
  id?: string;
  courseId: string;
  name: string;
  workload: number; // Carga horária
  createdAt?: string;
}

export interface Capability {
  id?: string;
  ucId: string;
  type: "Básica" | "Técnica";
  description: string;
  createdAt?: string;
}

export interface Knowledge {
  id?: string;
  capabilityId: string;
  description: string;
  createdAt?: string;
}

export interface TeacherAllocation {
  id?: string;
  teacherId: string; // auth.currentUser.uid
  courseId: string;
  ucId: string;
  term: string; // Ex: "2026.1"
  createdAt?: string;
}

// Tree types for Builder
export interface FormKnowledge {
  id?: string;
  description: string;
  isDeleted?: boolean;
}

export interface FormCapability {
  id?: string;
  type: "Básica" | "Técnica";
  description: string;
  knowledges: FormKnowledge[];
  isDeleted?: boolean;
}

export interface FormUC {
  id?: string;
  name: string;
  workload: number;
  capabilities: FormCapability[];
  isDeleted?: boolean;
}

export interface CoursePlanTree {
  ucs: FormUC[];
}

// --- Coleções do Firestore ---
const COURSES_COLLECTION = "courses";
const UCS_COLLECTION = "curricular_units";
const CAPABILITIES_COLLECTION = "capabilities";
const KNOWLEDGE_COLLECTION = "knowledges";
const ALLOCATIONS_COLLECTION = "teacher_allocations";

// --- Funções de Leitura ---

export const getCourses = async (): Promise<Course[]> => {
  try {
    const q = query(collection(db, COURSES_COLLECTION));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
  } catch (error) {
    logger.error("Erro ao buscar cursos", error);
    return [];
  }
};

export const getCurricularUnits = async (courseId: string): Promise<CurricularUnit[]> => {
  try {
    const q = query(collection(db, UCS_COLLECTION), where("courseId", "==", courseId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CurricularUnit));
  } catch (error) {
    logger.error(`Erro ao buscar UCs para o curso ${courseId}`, error);
    return [];
  }
};

export const getCapabilities = async (ucId: string): Promise<Capability[]> => {
  try {
    const q = query(collection(db, CAPABILITIES_COLLECTION), where("ucId", "==", ucId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Capability));
  } catch (error) {
    logger.error(`Erro ao buscar capacidades para a UC ${ucId}`, error);
    return [];
  }
};

export const getKnowledges = async (capabilityId: string): Promise<Knowledge[]> => {
  try {
    const q = query(collection(db, KNOWLEDGE_COLLECTION), where("capabilityId", "==", capabilityId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Knowledge));
  } catch (error) {
    logger.error(`Erro ao buscar conhecimentos para a capacidade ${capabilityId}`, error);
    return [];
  }
};

export const getTeacherAllocations = async (teacherId: string): Promise<TeacherAllocation[]> => {
  try {
    const q = query(collection(db, ALLOCATIONS_COLLECTION), where("teacherId", "==", teacherId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherAllocation));
  } catch (error) {
    logger.error(`Erro ao buscar alocações para o professor ${teacherId}`, error);
    return [];
  }
};

// --- Funções de Escrita (Admin) ---

export const createCourse = async (course: Omit<Course, "id">) => {
  return addDoc(collection(db, COURSES_COLLECTION), { ...course, createdAt: new Date().toISOString() });
};

export const createCurricularUnit = async (uc: Omit<CurricularUnit, "id">) => {
  return addDoc(collection(db, UCS_COLLECTION), { ...uc, createdAt: new Date().toISOString() });
};

export const createCapability = async (capability: Omit<Capability, "id">) => {
  return addDoc(collection(db, CAPABILITIES_COLLECTION), { ...capability, createdAt: new Date().toISOString() });
};

export const createKnowledge = async (knowledge: Omit<Knowledge, "id">) => {
  return addDoc(collection(db, KNOWLEDGE_COLLECTION), { ...knowledge, createdAt: new Date().toISOString() });
};

export const allocateTeacher = async (allocation: Omit<TeacherAllocation, "id">) => {
  return addDoc(collection(db, ALLOCATIONS_COLLECTION), { ...allocation, createdAt: new Date().toISOString() });
};

// --- Batch Operations para o Builder ---

export const saveCoursePlanTree = async (courseId: string, tree: CoursePlanTree) => {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  for (const uc of tree.ucs) {
    const isTempUc = uc.id?.startsWith('temp_');
    let ucRef;
    if (uc.id && !isTempUc && uc.isDeleted) {
       batch.delete(doc(db, UCS_COLLECTION, uc.id));
       continue;
    } else if (uc.id && !isTempUc) {
       ucRef = doc(db, UCS_COLLECTION, uc.id);
       batch.update(ucRef, { name: uc.name, workload: uc.workload });
    } else {
       ucRef = doc(collection(db, UCS_COLLECTION));
       batch.set(ucRef, { courseId, name: uc.name, workload: uc.workload, createdAt: now });
    }

    const currentUcId = uc.id && !isTempUc ? uc.id : ucRef.id;

    for (const cap of uc.capabilities) {
      const isTempCap = cap.id?.startsWith('temp_');
      let capRef;
      if (cap.id && !isTempCap && cap.isDeleted) {
        batch.delete(doc(db, CAPABILITIES_COLLECTION, cap.id));
        continue;
      } else if (cap.id && !isTempCap) {
        capRef = doc(db, CAPABILITIES_COLLECTION, cap.id);
        batch.update(capRef, { description: cap.description, type: cap.type });
      } else {
        capRef = doc(collection(db, CAPABILITIES_COLLECTION));
        batch.set(capRef, { ucId: currentUcId, description: cap.description, type: cap.type, createdAt: now });
      }

      const currentCapId = cap.id && !isTempCap ? cap.id : capRef.id;

      for (const k of cap.knowledges) {
        const isTempK = k.id?.startsWith('temp_');
        if (k.id && !isTempK && k.isDeleted) {
          batch.delete(doc(db, KNOWLEDGE_COLLECTION, k.id));
        } else if (k.id && !isTempK) {
          batch.update(doc(db, KNOWLEDGE_COLLECTION, k.id), { description: k.description });
        } else {
          const kRef = doc(collection(db, KNOWLEDGE_COLLECTION));
          batch.set(kRef, { capabilityId: currentCapId, description: k.description, createdAt: now });
        }
      }
    }
  }

  await batch.commit();
};

export const fetchCoursePlanTree = async (courseId: string): Promise<CoursePlanTree> => {
  const ucs = await getCurricularUnits(courseId);
  const tree: CoursePlanTree = { ucs: [] };
  
  for (const uc of ucs) {
    if (!uc.id) continue;
    const caps = await getCapabilities(uc.id);
    const formCaps: FormCapability[] = [];
    
    for (const cap of caps) {
      if (!cap.id) continue;
      const knows = await getKnowledges(cap.id);
      formCaps.push({
        id: cap.id,
        description: cap.description,
        type: cap.type,
        knowledges: knows.map(k => ({ id: k.id, description: k.description }))
      });
    }
    
    tree.ucs.push({
      id: uc.id,
      name: uc.name,
      workload: uc.workload,
      capabilities: formCaps
    });
  }
  
  return tree;
};
