import { db } from "@/lib/db";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "@/lib/sira-sql-adapter";
import * as XLSX from 'xlsx';
import {
  CoreEvent,
  CoreEventAlias,
  CoreFormResponse,
  CoreImportBatch,
  CoreImportIssue,
  EventFilterState,
} from '../types';
import { generateSyntheticDataset } from './syntheticData';

const LOCAL_STORAGE_KEY_RESPONSES = 'core_eventos_responses_cache';
const LOCAL_STORAGE_KEY_EVENTS = 'core_eventos_events_cache';
const LOCAL_STORAGE_KEY_BATCHES = 'core_eventos_batches_cache';
const LOCAL_STORAGE_KEY_ALIASES = 'core_eventos_aliases_cache';

// Auto-purga dados de demonstração sintéticos antigos do cache local se existirem
if (typeof window !== 'undefined') {
  try {
    const cachedResp = localStorage.getItem(LOCAL_STORAGE_KEY_RESPONSES);
    if (cachedResp && (cachedResp.includes('batch-synthetic-demo-001') || cachedResp.includes('resp-syn-') || cachedResp.includes('demo.participante'))) {
      localStorage.removeItem(LOCAL_STORAGE_KEY_RESPONSES);
      localStorage.removeItem(LOCAL_STORAGE_KEY_EVENTS);
      localStorage.removeItem(LOCAL_STORAGE_KEY_BATCHES);
      localStorage.removeItem(LOCAL_STORAGE_KEY_ALIASES);
    }
  } catch {}
}

/**
 * Obtém os eventos canônicos
 */
export async function getCoreEvents(): Promise<CoreEvent[]> {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY_EVENTS);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  try {
    const snap = await getDocs(collection(db, 'core_events'));
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CoreEvent));
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_EVENTS, JSON.stringify(list));
      } catch {}
      return list;
    }
  } catch (err) {
    console.warn('Firestore offline ou não inicializado para core_events:', err);
  }

  return [];
}

/**
 * Escuta eventos em tempo real
 */
export function subscribeToEvents(
  onData: (events: CoreEvent[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const q = query(collection(db, 'core_events'), orderBy('canonicalName', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CoreEvent));
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY_EVENTS, JSON.stringify(list));
        } catch {}
        onData(list);
      },
      (err) => {
        console.warn('Erro na subscription de core_events:', err);
        if (onError) onError(err);
        getCoreEvents().then(onData);
      }
    );
  } catch (err) {
    getCoreEvents().then(onData);
    return () => {};
  }
}

/**
 * Escuta respostas de formulários em tempo real (otimizado para baixo custo)
 */
export function subscribeToFormResponses(
  onData: (responses: CoreFormResponse[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const q = query(collection(db, 'core_event_responses'), limit(500));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CoreFormResponse));
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY_RESPONSES, JSON.stringify(list));
        } catch {}
        onData(list);
      },
      (err) => {
        console.warn('Erro na subscription de core_event_responses:', err);
        if (onError) onError(err);
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY_RESPONSES);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) return onData(parsed);
          } catch {}
        }
        onData([]);
      }
    );
  } catch (err) {
    onData([]);
    return () => {};
  }
}

/**
 * Obtém respostas de formulários com cache local prioritário (Zero-cost first)
 */
export async function getCoreResponses(): Promise<CoreFormResponse[]> {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY_RESPONSES);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  try {
    const snap = await getDocs(query(collection(db, 'core_event_responses'), limit(500)));
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CoreFormResponse));
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_RESPONSES, JSON.stringify(list));
      } catch {}
      return list;
    }
  } catch (err) {
    console.warn('Firestore indisponível para core_event_responses:', err);
  }

  return [];
}

/**
 * Escuta lotes de importação
 */
export function subscribeToBatches(onData: (batches: CoreImportBatch[]) => void): () => void {
  try {
    const q = query(collection(db, 'core_event_imports'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CoreImportBatch));
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY_BATCHES, JSON.stringify(list));
        } catch {}
        onData(list);
      },
      () => {
        getCoreBatches().then(onData);
      }
    );
  } catch {
    getCoreBatches().then(onData);
    return () => {};
  }
}

export async function getCoreBatches(): Promise<CoreImportBatch[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'core_event_imports'), orderBy('createdAt', 'desc'), limit(50))
    );
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CoreImportBatch));
      return list;
    }
  } catch {}

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY_BATCHES);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  return [];
}

/**
 * Alimenta a base com dados de demonstração BI completos
 */
export async function seedSyntheticDataset(): Promise<void> {
  const syn = generateSyntheticDataset();
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_RESPONSES, JSON.stringify(syn.responses));
    localStorage.setItem(LOCAL_STORAGE_KEY_EVENTS, JSON.stringify(syn.events));
    localStorage.setItem(LOCAL_STORAGE_KEY_BATCHES, JSON.stringify([syn.batch]));
  } catch {}

  try {
    await commitImportBatch(syn.batch, syn.responses, []);
    for (const ev of syn.events) {
      await saveCoreEvent(ev);
    }
    for (const al of syn.aliases) {
      await addEventAlias(al);
    }
  } catch (err) {
    console.warn('Aviso ao sincronizar dados sintéticos no Firestore:', err);
  }
}

/**
 * Limpa completamente todos os dados de teste e importações do CORE Eventos
 */
export async function clearAllCoreEventosData(): Promise<void> {
  // 1. Limpar caches locais
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY_RESPONSES);
    localStorage.removeItem(LOCAL_STORAGE_KEY_EVENTS);
    localStorage.removeItem(LOCAL_STORAGE_KEY_BATCHES);
    localStorage.removeItem(LOCAL_STORAGE_KEY_ALIASES);
  } catch (e) {
    console.error('Erro ao limpar localStorage:', e);
  }

  // 2. Limpar documentos no Firestore se existirem
  try {
    const collectionsToClear = [
      'core_event_responses',
      'core_events',
      'core_event_imports',
      'core_event_aliases',
      'core_event_issues',
    ];

    for (const colName of collectionsToClear) {
      const snap = await getDocs(query(collection(db, colName), limit(500)));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    }
  } catch (err) {
    console.warn('Aviso ao limpar coleções no Firestore (ou sem permissão/offline):', err);
  }
}

/**
 * Salva transacionalmente um novo lote de importação e suas respostas
 */
export async function commitImportBatch(
  batch: CoreImportBatch,
  responses: CoreFormResponse[],
  issues: CoreImportIssue[]
): Promise<void> {
  try {
    // 1. Grava no Firestore se disponível em chunks de até 500 operações por writeBatch
    const batchDocRef = doc(db, 'core_event_imports', batch.id);
    await setDoc(batchDocRef, batch);

    // Chunks de 400 documentos para respeitar limite do Firestore
    const chunkSize = 400;
    for (let i = 0; i < responses.length; i += chunkSize) {
      const chunk = responses.slice(i, i + chunkSize);
      const writeB = writeBatch(db);
      chunk.forEach((resp) => {
        const respRef = doc(db, 'core_event_responses', resp.id);
        writeB.set(respRef, resp);
      });
      await writeB.commit();
    }

    if (issues.length > 0) {
      for (let i = 0; i < issues.length; i += chunkSize) {
        const chunk = issues.slice(i, i + chunkSize);
        const writeB = writeBatch(db);
        chunk.forEach((issue) => {
          const issueRef = doc(db, 'core_event_issues', issue.id);
          writeB.set(issueRef, issue);
        });
        await writeB.commit();
      }
    }
  } catch (err) {
    console.warn('Erro ao salvar no Firestore. Persistindo em armazenamento local resiliente:', err);
  }

  // Atualizar cache local persistente
  try {
    const existing = await getCoreResponses();
    const existingIds = new Set(existing.map((e) => e.sourceId || e.id));
    const merged = [...existing];
    responses.forEach((r) => {
      if (!existingIds.has(r.sourceId || r.id)) {
        merged.push(r);
      }
    });
    localStorage.setItem(LOCAL_STORAGE_KEY_RESPONSES, JSON.stringify(merged));

    const existingBatches = await getCoreBatches();
    localStorage.setItem(LOCAL_STORAGE_KEY_BATCHES, JSON.stringify([batch, ...existingBatches]));
  } catch (storageErr) {
    console.error('Erro ao gravar cache local:', storageErr);
  }
}

/**
 * Salva ou atualiza um evento canônico
 */
export async function saveCoreEvent(event: CoreEvent): Promise<void> {
  try {
    const docRef = doc(db, 'core_events', event.id);
    await setDoc(docRef, event, { merge: true });
  } catch (err) {
    console.warn('Erro ao salvar evento no Firestore:', err);
  }

  try {
    const events = await getCoreEvents();
    const idx = events.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      events[idx] = event;
    } else {
      events.push(event);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_EVENTS, JSON.stringify(events));
  } catch {}
}

/**
 * Adiciona um novo alias para um evento
 */
export async function addEventAlias(alias: CoreEventAlias): Promise<void> {
  try {
    const docRef = doc(db, 'core_event_aliases', alias.id);
    await setDoc(docRef, alias);
  } catch (err) {
    console.warn('Erro ao salvar alias no Firestore:', err);
  }

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY_ALIASES);
    const list: CoreEventAlias[] = cached ? JSON.parse(cached) : [];
    list.push(alias);
    localStorage.setItem(LOCAL_STORAGE_KEY_ALIASES, JSON.stringify(list));
  } catch {}
}

/**
 * Filtra respostas em memória de acordo com os filtros ativos
 */
export function filterResponses(
  responses: CoreFormResponse[],
  filters: EventFilterState
): CoreFormResponse[] {
  const now = new Date();

  return responses.filter((r) => {
    // 1. Filtro por Evento
    if (filters.eventId !== 'all') {
      if (r.eventId !== filters.eventId && r.canonicalEventName !== filters.eventId) {
        return false;
      }
    }

    // 2. Filtro por Ação
    if (filters.action !== 'all' && r.action !== filters.action) {
      return false;
    }

    // 3. Filtro por Categoria
    if (filters.category !== 'all' && r.category !== filters.category) {
      return false;
    }

    // 4. Filtro por Turma
    if (filters.classCode !== 'all' && r.classCode !== filters.classCode) {
      return false;
    }

    // 5. Filtro por Período
    if (r.startedAt) {
      const respDate = new Date(r.startedAt);
      if (!isNaN(respDate.getTime())) {
        if (filters.periodType === '7d') {
          const limitDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (respDate < limitDate) return false;
        } else if (filters.periodType === '30d') {
          const limitDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (respDate < limitDate) return false;
        } else if (filters.periodType === 'month') {
          if (
            respDate.getMonth() !== now.getMonth() ||
            respDate.getFullYear() !== now.getFullYear()
          ) {
            return false;
          }
        } else if (filters.periodType === 'custom') {
          if (filters.startDate) {
            const start = new Date(filters.startDate);
            if (respDate < start) return false;
          }
          if (filters.endDate) {
            const end = new Date(`${filters.endDate}T23:59:59`);
            if (respDate > end) return false;
          }
        }
      }
    }

    // 6. Busca textual (comentários ou nomes)
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchComment = r.comment ? r.comment.toLowerCase().includes(q) : false;
      const matchClass = r.classCode ? r.classCode.toLowerCase().includes(q) : false;
      const matchCat = r.category ? r.category.toLowerCase().includes(q) : false;
      const matchEv = r.canonicalEventName ? r.canonicalEventName.toLowerCase().includes(q) : false;
      if (!matchComment && !matchClass && !matchCat && !matchEv) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Exporta dados públicos de forma segura (sem PII e com neutralização de fórmulas maliciosas - RF-016)
 */
export function exportPublicReport(
  responses: CoreFormResponse[],
  eventName: string = 'Geral'
): void {
  // Neutralizar fórmulas maliciosas
  const sanitize = (val?: string | number | null) => {
    if (val === undefined || val === null) return '';
    const s = String(val);
    if (s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@')) {
      return `'${s}`;
    }
    return s;
  };

  const exportRows = responses.map((r) => ({
    'Ação': r.action,
    'Evento': sanitize(r.canonicalEventName),
    'Data': r.startedAt ? r.startedAt.substring(0, 10) : '',
    'Categoria': sanitize(r.category || 'Não informada'),
    'Turma': sanitize(r.classCode || '—'),
    'Nota Recomendação (NPS)': r.recommendationScore !== null && r.recommendationScore !== undefined ? r.recommendationScore : '—',
    'Comentário': sanitize(r.comment || ''),
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório Público Eventos');

  const cleanEvent = eventName.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(wb, `CORE_Eventos_Publico_${cleanEvent}_${new Date().toISOString().substring(0, 10)}.xlsx`);
}
