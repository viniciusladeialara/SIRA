/**
 * Estratégia de Otimização de Read Operations - Firestore
 * 
 * Este arquivo documenta as estratégias para otimizar custos do Firestore
 * reduzindo operações de leitura desnecessárias.
 * 
 * Redução potencial: 30-50% dos custos de read
 */

// ===== ESTRATÉGIA 1: onSnapshot vs getDocs =====

/**
 * ❌ EVITAR:
 * - onSnapshot para dados que não mudam frequentemente (cursos, salas, professores)
 * - Múltiplos listeners ativos a mesmo tempo
 * - Listeners sem cleanup apropriado
 * 
 * ✅ USAR:
 * - onSnapshot APENAS para agendamentos em tempo real
 * - getDocs + cache para dados estáticos
 * - Polling com interval para dados que mudam ocasionalmente
 */

// EXEMPLO ANTES (CARO):
// ❌ Cada mudança em courses = 1 read
await onSnapshot(collection(db, "courses"), (snapshot) => {
  // ... atualizar dados
});

// EXEMPLO DEPOIS (OTIMIZADO):
// ✅ Carrega uma vez, usa cache, atualiza a cada 5 min (polling)
const [courses, setCourses] = useState<Course[]>([]);
const [lastFetch, setLastFetch] = useState<number>(0);

const loadCourses = async () => {
  const now = Date.now();
  // Só recarregar se passou 5 minutos
  if (now - lastFetch < 5 * 60 * 1000) return courses;
  
  const snapshot = await getDocs(query(
    collection(db, "courses"),
    limit(1000)  // Nunca trazer mais de 1000
  ));
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  setCourses(data);
  setLastFetch(now);
  return data;
};

// ---

// ===== ESTRATÉGIA 2: Adicionar Limites em Queries =====

/**
 * ❌ ANTES (sem limite):
 * - getDocs(collection(db, "teachers"))  // Se houver 10.000, traz todos
 * 
 * ✅ DEPOIS (com limite):
 */

import { query, collection, limit, orderBy } from 'firebase/firestore';

const q = query(
  collection(db, "teachers"),
  orderBy("name"),
  limit(5000)  // Máximo realista de professores
);

const snapshot = await getDocs(q);

// ---

// ===== ESTRATÉGIA 3: Consolidar Múltiplas Queries =====

/**
 * ❌ ANTES (3 queries paralelas = 3 reads):
 */
const profsSnap = await getDocs(collection(db, "teachers"));
const classesSnap = await getDocs(collection(db, "classes"));
const roomsSnap = await getDocs(collection(db, "rooms"));
// Total: 3 reads

/**
 * ✅ DEPOIS (usar cache + lotes):
 */
// Se já tem os dados em cache local, não fazer nada
// Se precisa atualizar, fazer 1 vez e reutilizar

const loadFilterOptions = async () => {
  const cache = getFromLocalStorage("filterOptions");
  if (cache && cache.timestamp > Date.now() - 30 * 60 * 1000) {
    return cache.data;  // 0 reads, usa cache local
  }
  
  // Carregar uma vez, em paralelo
  const [profs, classes, rooms] = await Promise.all([
    getDocs(query(collection(db, "teachers"), limit(5000))),
    getDocs(query(collection(db, "classes"), limit(5000))),
    getDocs(query(collection(db, "rooms"), limit(5000)))
  ]);
  // Total: 3 reads
  
  const data = {
    teachers: profs.docs.map(d => ({ id: d.id, ...d.data() })),
    classes: classes.docs.map(d => ({ id: d.id, ...d.data() })),
    rooms: rooms.docs.map(d => ({ id: d.id, ...d.data() }))
  };
  
  saveToLocalStorage("filterOptions", { data, timestamp: Date.now() });
  return data;
};

// ---

// ===== ESTRATÉGIA 4: Usar Cloud Functions como Cache Layer =====

/**
 * ❌ ANTES:
 * - Cliente faz 3+ queries para validar agendamentos
 * - Cada validação = múltiplas reads
 * 
 * ✅ DEPOIS:
 * - Cloud Function faz validação (usa cache layer interno)
 * - Cliente chama função 1x
 */

// No cliente:
const validateSchedule = httpsCallable(functions, 'validateSchedule');
const result = await validateSchedule({
  teacherId, roomId, classId, startTime, endTime
});

// Na Cloud Function (tem cache interno):
// - Usa getCachedSchedulesByTeacher(), etc.
// - 1 call = até 3 reads (mas usa cache, muitas vezes 0!)

// ---

// ===== ESTRATÉGIA 5: Lazy Loading e Pagination =====

/**
 * ❌ ANTES:
 * - Carrega todos os dados de uma vez
 * 
 * ✅ DEPOIS:
 * - Carrega apenas primeira página (100 itens)
 * - Carregar mais sob demanda
 */

const [reports, setReports] = useState<Report[]>([]);
const [pageSize] = useState(100);
const [hasMore, setHasMore] = useState(true);
let lastDoc: any = null;

const loadReports = async (isFirstPage = true) => {
  let q: any = query(
    collection(db, "schedules"),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  
  if (!isFirstPage && lastDoc) {
    q = query(
      collection(db, "schedules"),
      orderBy("createdAt", "desc"),
      startAfter(lastDoc),
      limit(pageSize)
    );
  }
  
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  
  if (docs.length < pageSize) {
    setHasMore(false);
  }
  
  if (!isFirstPage) {
    setReports(prev => [...prev, ...docs.map(d => ({ id: d.id, ...d.data() }))]);
  } else {
    setReports(docs.map(d => ({ id: d.id, ...d.data() })));
  }
  
  if (docs.length > 0) {
    lastDoc = docs[docs.length - 1];
  }
};

// ---

// ===== ESTRATÉGIA 6: Cleanup de Dados Antigos =====

/**
 * ❌ ANTES:
 * - audit_logs crescem infinitamente
 * - Cada read custa igual (logs novos e antigos)
 * 
 * ✅ DEPOIS:
 * - Cloud Task limpa logs > 90 dias nightly
 * - Mantém apenas últimos 90 dias ativos
 */

// Cloud Task (Cloud Scheduler trigger nightly):
export const cleanupOldAuditLogs = onSchedule("0 2 * * *", async (context) => {
  // Roda 2am todos os dias
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const q = query(
    collection(db, "audit_logs"),
    where("createdAt", "<", Timestamp.fromDate(ninetyDaysAgo))
  );
  
  const snapshot = await getDocs(q);
  const batch = db.batch();
  
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  logger.info(`Deleted ${snapshot.docs.length} old audit logs`);
});

// ---

// ===== RESUMO DAS ESTRATÉGIAS =====
// 1. Usar getDocs + cache para dados estáticos
// 2. Usar onSnapshot APENAS para real-time crítico
// 3. Adicionar limits em todas as queries
// 4. Consolidar queries paralelas quando possível
// 5. Implementar Cloud Functions como cache layer
// 6. Usar lazy loading e pagination para listas grandes
// 7. Limpar dados antigos automaticamente
// 8. Usar Firestore Rules para validar (previne writes inválidas)

// Economia potencial: 30-50% de read operations
