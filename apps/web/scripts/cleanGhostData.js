import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Procurar arquivo de conta de serviço
const keyFile = path.resolve(__dirname, "../agendador-ambiente2-firebase-adminsdk-fbsvc-9e330caf9b.json");

if (!fs.existsSync(keyFile)) {
  console.error(`❌ Erro: Chave da conta de serviço não encontrada em: ${keyFile}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyFile, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function runCleanup() {
  console.log("🚀 INICIANDO LIMPEZA DE DADOS FANTASMAS (INCONSISTÊNCIAS)...");

  // 1. Carregar dados de referência
  const [roomsSnap, classesSnap, teachersSnap, coursesSnap, schedulesSnap] = await Promise.all([
    db.collection("rooms").get(),
    db.collection("classes").get(),
    db.collection("teachers").get(),
    db.collection("courses").get(),
    db.collection("schedules").get()
  ]);

  const rooms = new Map(roomsSnap.docs.map(d => [d.id, d.data()]));
  const classes = new Map(classesSnap.docs.map(d => [d.id, d.data()]));
  const teachers = new Map(teachersSnap.docs.map(d => [d.id, d.data()]));
  const courses = new Map(coursesSnap.docs.map(d => [d.id, d.data()]));
  const schedules = schedulesSnap.docs.map(d => ({ id: d.id, ...d.data(), ref: d.ref }));

  let deletedSchedules = 0;
  let fixedClasses = 0;
  let batch = db.batch();
  let count = 0;

  const commitBatchIfNeeded = async () => {
    count++;
    if (count === 400) {
      console.log("Saving batch to Firestore...");
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  };

  // 2. Limpar Agendamentos (Schedules) Órfãos
  for (const sched of schedules) {
    let shouldDelete = false;

    // Se a sala não existe
    if (sched.roomId && !rooms.has(sched.roomId)) {
      shouldDelete = true;
    }
    // Se o professor não existe (e não for reserva direta)
    if (sched.teacherId && sched.teacherId !== "direct_booking" && !teachers.has(sched.teacherId)) {
      shouldDelete = true;
    }
    // Se a turma não existe (e não for reserva direta)
    if (sched.classId && sched.classId !== "direct_booking" && !classes.has(sched.classId)) {
      shouldDelete = true;
    }
    // Se não tiver professor definido
    if (!sched.teacherId) {
      shouldDelete = true;
    }

    if (shouldDelete) {
      console.log(`🗑️ Preparando remoção do Agendamento ID "${sched.id}" (${sched.className || "Sem nome"} em ${sched.roomName || "Sem sala"})`);
      batch.delete(sched.ref);
      deletedSchedules++;
      await commitBatchIfNeeded();
    }
  }

  // 3. Corrigir Turmas (Classes) com referências inválidas
  for (const doc of classesSnap.docs) {
    const cls = doc.data();
    let changed = false;
    let updatedTeachers = cls.teacherIds || [];
    let updatedTeacherNames = cls.teacherNames || [];

    // Validar e filtrar professores fantasmas
    if (cls.teacherIds && Array.isArray(cls.teacherIds)) {
      const validIds = [];
      const validNames = [];
      
      cls.teacherIds.forEach((tId, idx) => {
        if (teachers.has(tId)) {
          validIds.push(tId);
          // Manter o nome correspondente do array ou do doc do professor
          const profName = teachers.get(tId).name || cls.teacherNames?.[idx] || "Professor";
          validNames.push(profName);
        } else {
          console.log(`🔧 Removendo professor fantasma ID "${tId}" da Turma "${cls.name}"`);
          changed = true;
        }
      });

      if (changed) {
        updatedTeachers = validIds;
        updatedTeacherNames = validNames;
      }
    }

    // Validar e filtrar ambientes fantasmas
    if (cls.environmentIds && Array.isArray(cls.environmentIds)) {
      const validRoomIds = cls.environmentIds.filter(rId => {
        if (rooms.has(rId)) {
          return true;
        } else {
          console.log(`🔧 Removendo ambiente fantasma ID "${rId}" da Turma "${cls.name}"`);
          changed = true;
          return false;
        }
      });
      if (changed) {
        cls.environmentIds = validRoomIds;
      }
    }

    if (changed) {
      batch.update(doc.ref, {
        teacherIds: updatedTeachers,
        teacherNames: updatedTeacherNames,
        environmentIds: cls.environmentIds || []
      });
      fixedClasses++;
      await commitBatchIfNeeded();
    }
  }

  // Commit final se houver operações pendentes
  if (count > 0) {
    console.log("Commiting final changes...");
    await batch.commit();
  }

  console.log("\n--------------------------------------------------");
  console.log(`🎉 LIMPEZA CONCLUÍDA COM SUCESSO!`);
  console.log(`- Agendamentos excluídos: ${deletedSchedules}`);
  console.log(`- Turmas corrigidas: ${fixedClasses}`);
  process.exit(0);
}

runCleanup().catch(err => {
  console.error("❌ Ocorreu um erro na limpeza de dados:", err);
  process.exit(1);
});
