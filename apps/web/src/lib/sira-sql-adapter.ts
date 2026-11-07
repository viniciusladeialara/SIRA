import { apiService } from '@/services/apiService';
import { Timestamp } from './sira-timestamp';

export { Timestamp };

export interface DocumentData {
  [field: string]: any;
}

export interface DocumentSnapshot<T = DocumentData> {
  id: string;
  exists: () => boolean;
  data: () => T;
}

export interface QueryDocumentSnapshot<T = DocumentData> extends DocumentSnapshot<T> {}

export interface QuerySnapshot<T = DocumentData> {
  docs: QueryDocumentSnapshot<T>[];
  empty: boolean;
  size: number;
  forEach: (callback: (result: QueryDocumentSnapshot<T>) => void) => void;
}

export interface CollectionReference {
  id: string;
  path: string;
  type: 'collection';
}

export interface DocumentReference {
  id: string;
  path: string;
  parent: CollectionReference;
  type: 'document';
}

export interface QueryClause {
  type: 'where' | 'orderBy' | 'limit' | 'startAfter';
  field?: string;
  op?: string;
  value?: any;
}

export interface Query {
  collection: CollectionReference;
  clauses: QueryClause[];
  type: 'query';
}

// In-memory / Local storage fallback for auxiliary client-side mock collections
const localStore: Record<string, Record<string, any>> = {};

function getLocalCollection(name: string): Record<string, any> {
  if (!localStore[name]) {
    try {
      const saved = localStorage.getItem(`sira_mock_${name}`);
      localStore[name] = saved ? JSON.parse(saved) : {};
    } catch {
      localStore[name] = {};
    }
  }
  return localStore[name];
}

function saveLocalCollection(name: string) {
  try {
    localStorage.setItem(`sira_mock_${name}`, JSON.stringify(localStore[name]));
  } catch {}
}

export const collection = (dbOrParent: any, path: string, ...segments: string[]): CollectionReference => {
  const fullPath = [path, ...segments].filter(Boolean).join('/');
  return {
    id: fullPath.split('/').pop() || fullPath,
    path: fullPath,
    type: 'collection',
  };
};

export const doc = (dbOrCol: any, path: string, ...segments: string[]): DocumentReference => {
  const parts = [path, ...segments].filter(Boolean);
  let fullPath: string;
  if (dbOrCol && dbOrCol.path) {
    fullPath = `${dbOrCol.path}/${parts.join('/')}`;
  } else {
    fullPath = parts.join('/');
  }

  const splitParts = fullPath.split('/');
  const docId = splitParts.pop() || '';
  const colPath = splitParts.join('/');

  return {
    id: docId,
    path: fullPath,
    parent: { id: splitParts.pop() || '', path: colPath, type: 'collection' },
    type: 'document',
  };
};

export const where = (field: string, op: string, value: any): QueryClause => ({
  type: 'where',
  field,
  op,
  value,
});

export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): QueryClause => ({
  type: 'orderBy',
  field,
  value: dir,
});

export const limit = (n: number): QueryClause => ({
  type: 'limit',
  value: n,
});

export const startAfter = (...args: any[]): QueryClause => ({
  type: 'startAfter',
  value: args,
});

export const query = (col: CollectionReference | Query, ...clauses: QueryClause[]): Query => {
  const baseCol = col.type === 'query' ? col.collection : col;
  const prevClauses = col.type === 'query' ? col.clauses : [];
  return {
    collection: baseCol,
    clauses: [...prevClauses, ...clauses],
    type: 'query',
  };
};

// Data Mapper: Converts SIRA SQL Backend records to match legacy Firestore frontend structures
function mapSqlToDocData(colName: string, item: any): any {
  if (!item) return item;
  switch (colName) {
    case 'rooms':
    case 'environments':
    case 'ambientes':
      return {
        id: item.id,
        name: item.nome || item.name,
        type: item.tipo || item.type || 'Sala de Aula',
        capacity: item.capacidade || item.capacity || 30,
        block: item.bloco || item.block || 'Bloco A',
        floor: item.andar || item.floor || 'Térreo',
        available: item.ativo !== undefined ? item.ativo : true,
        items: [],
        unitId: item.unidade_id || item.unitId,
        unitName: item.unidades?.nome || item.unitName,
        createdAt: item.criado_em ? Timestamp.fromDate(new Date(item.criado_em)) : Timestamp.now(),
        ...item,
      };

    case 'classes':
    case 'turmas':
      return {
        id: item.id,
        name: item.nome || item.name,
        code: item.codigo || item.code,
        period: item.turno || item.period || 'Noturno',
        startDate: item.data_inicio || item.startDate,
        endDate: item.data_fim || item.endDate,
        studentCount: item.vagas || item.studentCount || 30,
        courseId: item.curso_id || item.courseId,
        courseName: item.cursos?.nome || item.courseName,
        teacherIds: [],
        teacherNames: [],
        environmentIds: [],
        unitId: item.unidade_id || item.unitId,
        unitName: item.unidades?.nome || item.unitName,
        ...item,
      };

    case 'courses':
    case 'cursos':
      return {
        id: item.id,
        name: item.nome || item.name,
        code: item.codigo || item.code,
        workload: item.carga_horaria || item.workload || 0,
        unitId: item.unidade_id || item.unitId,
        unitName: item.unidades?.nome,
        ...item,
      };

    case 'teachers':
    case 'professors':
    case 'docentes':
      return {
        id: item.id,
        name: item.nome || item.name,
        email: item.email,
        phone: item.telefone || item.phone,
        specialty: item.especialidade || item.specialty,
        registration: item.matricula || item.registration,
        maxWeeklyHours: item.carga_horaria_max || item.maxWeeklyHours || 40,
        isActive: item.ativo !== undefined ? item.ativo : true,
        unitId: item.unidade_id || item.unitId,
        unitName: item.unidades?.nome,
        ...item,
      };

    case 'schedules':
    case 'agendamentos':
      return {
        id: item.id,
        classId: item.turma_id || item.classId,
        className: item.turmas?.nome || item.className || 'Turma',
        courseId: item.turmas?.curso_id || item.courseId || '',
        courseName: item.turmas?.cursos?.nome || item.courseName || '',
        roomId: item.ambiente_id || item.roomId,
        roomName: item.ambientes?.nome || item.roomName || 'Ambiente',
        teacherId: item.docente_id || item.teacherId,
        teacherName: item.docentes?.nome || item.teacherName || 'Docente',
        startTime: item.data_inicio ? Timestamp.fromDate(new Date(item.data_inicio)) : Timestamp.now(),
        endTime: item.data_fim ? Timestamp.fromDate(new Date(item.data_fim)) : Timestamp.now(),
        observation: item.observacao || item.observation,
        unitId: item.unidade_id || item.unitId,
        unitName: item.unidades?.nome,
        scheduleStatus: item.status || 'agendado',
        ...item,
      };

    case 'holidays':
    case 'feriados':
      return {
        id: item.id,
        name: item.nome || item.name,
        date: item.data ? Timestamp.fromDate(new Date(item.data)) : Timestamp.now(),
        type: item.tipo || item.type,
      };

    case 'units':
    case 'unidades':
      return {
        id: item.id,
        name: item.nome || item.name || 'Unidade SENAI',
        nome: item.nome || item.name || 'Unidade SENAI',
        code: item.sigla || item.codigo || item.code || 'SENAI',
        sigla: item.sigla || item.codigo || item.code || 'SENAI',
        cidade: item.cidade || '',
        estado: item.estado || 'MT',
        ativo: item.ativo !== undefined ? item.ativo : true,
        ...item,
      };

    default:
      return item;
  }
}

export const getDocs = async (target: CollectionReference | Query): Promise<QuerySnapshot> => {
  const col = target.type === 'query' ? target.collection : target;
  const colName = col.id;
  const clauses = target.type === 'query' ? target.clauses : [];

  let rawList: any[] = [];

  try {
    switch (colName) {
      case 'rooms':
      case 'environments':
      case 'ambientes':
        rawList = await apiService.getAmbientes();
        break;

      case 'classes':
      case 'turmas':
        rawList = await apiService.getTurmas();
        break;

      case 'courses':
      case 'cursos':
        rawList = await apiService.getCursos();
        break;

      case 'teachers':
      case 'professors':
      case 'docentes':
        rawList = await apiService.getDocentes();
        break;

      case 'schedules':
      case 'agendamentos':
        rawList = await apiService.getAgendamentos();
        break;

      case 'holidays':
      case 'feriados':
        rawList = await apiService.getHolidays();
        break;

      case 'users':
      case 'usuarios':
        rawList = await apiService.getUsuarios();
        break;

      case 'units':
      case 'unidades':
        rawList = await apiService.getUnits();
        break;

      default: {
        const local = getLocalCollection(colName);
        rawList = Object.values(local);
        break;
      }
    }
  } catch (err) {
    console.warn(`[SIRA Adapter] Erro ao buscar dados de "${colName}":`, err);
    const local = getLocalCollection(colName);
    rawList = Object.values(local);
  }

  let mappedList = rawList.map((item) => mapSqlToDocData(colName, item));

  // Aplica filtros 'where'
  for (const clause of clauses) {
    if (clause.type === 'where' && clause.field && clause.op) {
      mappedList = mappedList.filter((item) => {
        const val = item[clause.field!];
        if (clause.op === '==' || clause.op === '===') {
          return String(val) === String(clause.value);
        }
        if (clause.op === '!=') {
          return String(val) !== String(clause.value);
        }
        if (clause.op === 'in' && Array.isArray(clause.value)) {
          return clause.value.includes(val);
        }
        return true;
      });
    }
  }

  const docs: QueryDocumentSnapshot[] = mappedList.map((item) => ({
    id: item.id || `doc_${Math.random().toString(36).substring(2, 9)}`,
    exists: () => true,
    data: () => item,
  }));

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback) => docs.forEach(callback),
  };
};

export const getDoc = async (docRef: DocumentReference): Promise<DocumentSnapshot> => {
  const colName = docRef.parent.id;
  const docId = docRef.id;

  // Unidade especial: retorna metadados com blocos, andares e turnos
  if (colName === 'units' || colName === 'unidades') {
    const defaultMetadata = {
      blockLabel: 'Bloco',
      floorLabel: 'Andar',
      blocks: ['Bloco A', 'Bloco B', 'Bloco C', 'Bloco D'],
      floors: ['Térreo', '1º Andar', '2º Andar'],
      roomTypes: ['Sala de Aula', 'Laboratório', 'Oficina', 'Auditório'],
      shifts: ['Matutino', 'Vespertino', 'Noturno'],
    };
    return {
      id: docId,
      exists: () => true,
      data: () => ({ id: docId, metadata: defaultMetadata }),
    };
  }

  try {
    let item: any = null;
    switch (colName) {
      case 'rooms':
      case 'environments':
      case 'ambientes':
        item = await apiService.getAmbienteById(docId);
        break;
      case 'classes':
      case 'turmas':
        item = await apiService.getTurmaById(docId);
        break;
      case 'courses':
      case 'cursos':
        item = await apiService.getCursoById(docId);
        break;
      case 'teachers':
      case 'professors':
      case 'docentes':
        item = await apiService.getDocenteById(docId);
        break;
      case 'schedules':
      case 'agendamentos':
        item = await apiService.getAgendamentoById(docId);
        break;
      default: {
        const local = getLocalCollection(colName);
        item = local[docId];
        break;
      }
    }

    if (item) {
      const data = mapSqlToDocData(colName, item);
      return {
        id: docId,
        exists: () => true,
        data: () => data,
      };
    }
  } catch (err) {
    console.warn(`[SIRA Adapter] Erro ao carregar getDoc de "${colName}/${docId}":`, err);
  }

  const local = getLocalCollection(colName);
  const localItem = local[docId];
  return {
    id: docId,
    exists: () => !!localItem,
    data: () => localItem || {},
  };
};

export const addDoc = async (colRef: CollectionReference, data: any): Promise<DocumentReference> => {
  const colName = colRef.id;
  try {
    let created: any = null;
    switch (colName) {
      case 'rooms':
      case 'environments':
      case 'ambientes':
        created = await apiService.createAmbiente(data);
        break;
      case 'classes':
      case 'turmas':
        created = await apiService.createTurma(data);
        break;
      case 'courses':
      case 'cursos':
        created = await apiService.createCurso(data);
        break;
      case 'teachers':
      case 'professors':
      case 'docentes':
        created = await apiService.createDocente(data);
        break;
      case 'schedules':
      case 'agendamentos':
        created = await apiService.createAgendamento(data);
        break;
      case 'holidays':
      case 'feriados':
        created = await apiService.createHoliday(data);
        break;
      case 'users':
      case 'usuarios':
        created = await apiService.createUser(data);
        break;
      default:
        break;
    }

    const docId = created?.id || `doc_${Date.now()}`;
    const local = getLocalCollection(colName);
    local[docId] = { id: docId, ...data, ...(created || {}) };
    saveLocalCollection(colName);

    return doc(colRef, docId);
  } catch (err) {
    console.error(`[SIRA Adapter] Falha no addDoc para "${colName}":`, err);
    throw err;
  }
};

export const updateDoc = async (docRef: DocumentReference, data: any): Promise<void> => {
  const colName = docRef.parent.id;
  const docId = docRef.id;

  try {
    switch (colName) {
      case 'rooms':
      case 'environments':
      case 'ambientes':
        await apiService.updateAmbiente(docId, data);
        break;
      case 'classes':
      case 'turmas':
        await apiService.updateTurma(docId, data);
        break;
      case 'courses':
      case 'cursos':
        await apiService.updateCurso(docId, data);
        break;
      case 'teachers':
      case 'professors':
      case 'docentes':
        await apiService.updateDocente(docId, data);
        break;
      case 'schedules':
      case 'agendamentos':
        await apiService.updateAgendamento(docId, data);
        break;
      case 'users':
      case 'usuarios':
        await apiService.updateUser(docId, data);
        break;
      default:
        break;
    }
  } catch (err) {
    console.warn(`[SIRA Adapter] Erro ao atualizar "${colName}/${docId}":`, err);
  }

  const local = getLocalCollection(colName);
  local[docId] = { ...(local[docId] || {}), ...data };
  saveLocalCollection(colName);
};

export const setDoc = async (docRef: DocumentReference, data: any, options: { merge?: boolean } = {}): Promise<void> => {
  if (options.merge) {
    await updateDoc(docRef, data);
  } else {
    const colName = docRef.parent.id;
    const docId = docRef.id;
    const local = getLocalCollection(colName);
    local[docId] = { id: docId, ...data };
    saveLocalCollection(colName);
  }
};

export const deleteDoc = async (docRef: DocumentReference): Promise<void> => {
  const colName = docRef.parent.id;
  const docId = docRef.id;

  try {
    switch (colName) {
      case 'rooms':
      case 'environments':
      case 'ambientes':
        await apiService.deleteAmbiente(docId);
        break;
      case 'classes':
      case 'turmas':
        await apiService.deleteTurma(docId);
        break;
      case 'courses':
      case 'cursos':
        await apiService.deleteCurso(docId);
        break;
      case 'teachers':
      case 'professors':
      case 'docentes':
        await apiService.deleteDocente(docId);
        break;
      case 'schedules':
      case 'agendamentos':
        await apiService.deleteAgendamento(docId);
        break;
      case 'holidays':
      case 'feriados':
        await apiService.deleteHoliday(docId);
        break;
      case 'users':
      case 'usuarios':
        await apiService.deleteUser(docId);
        break;
      default:
        break;
    }
  } catch (err) {
    console.warn(`[SIRA Adapter] Erro ao excluir "${colName}/${docId}":`, err);
  }

  const local = getLocalCollection(colName);
  delete local[docId];
  saveLocalCollection(colName);
};

export const onSnapshot = (
  target: CollectionReference | Query | DocumentReference,
  callback: (snapshot: any) => void,
  errCallback?: (error: any) => void,
): (() => void) => {
  let active = true;

  const refresh = async () => {
    if (!active) return;
    try {
      if (target.type === 'document') {
        const snap = await getDoc(target as DocumentReference);
        if (active) callback(snap);
      } else {
        const snap = await getDocs(target as CollectionReference | Query);
        if (active) callback(snap);
      }
    } catch (err) {
      if (active && errCallback) errCallback(err);
    }
  };

  refresh();
  const timer = setInterval(refresh, 5000);

  return () => {
    active = false;
    clearInterval(timer);
  };
};

export const serverTimestamp = () => new Date();
export const arrayUnion = (...args: any[]) => args;
export const arrayRemove = (...args: any[]) => args;
export const increment = (n: number) => n;

export const writeBatch = (db?: any) => {
  const operations: Array<() => Promise<void>> = [];

  return {
    set: (docRef: DocumentReference, data: any) => {
      operations.push(() => setDoc(docRef, data));
    },
    update: (docRef: DocumentReference, data: any) => {
      operations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: DocumentReference) => {
      operations.push(() => deleteDoc(docRef));
    },
    commit: async () => {
      for (const op of operations) {
        await op();
      }
    },
  };
};

export const runTransaction = async (db: any, updateFunction: any) => {
  const transaction = {
    get: async (docRef: DocumentReference) => getDoc(docRef),
    set: (docRef: DocumentReference, data: any) => setDoc(docRef, data),
    update: (docRef: DocumentReference, data: any) => updateDoc(docRef, data),
    delete: (docRef: DocumentReference) => deleteDoc(docRef),
  };
  return updateFunction(transaction);
};

export const initializeFirestore = (app?: any, options?: any) => ({});
export const getFirestore = (app?: any) => ({});
export const persistentLocalCache = (options?: any) => ({});
export const persistentMultipleTabManager = (options?: any) => ({});
