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

async function checkGhostData() {
  console.log("🔍 INICIANDO DIAGNÓSTICO DE DADOS FANTASMAS (INCONSISTÊNCIAS)...");

  // 1. Carregar todos os dados de referência
  console.log("Loading reference data from firestore...");
  
  const [unitsSnap, roomsSnap, classesSnap, teachersSnap, coursesSnap, schedulesSnap] = await Promise.all([
    db.collection("units").get(),
    db.collection("rooms").get(),
    db.collection("classes").get(),
    db.collection("teachers").get(),
    db.collection("courses").get(),
    db.collection("schedules").get()
  ]);

  const units = new Map(unitsSnap.docs.map(d => [d.id, d.data()]));
  const rooms = new Map(roomsSnap.docs.map(d => [d.id, d.data()]));
  const classes = new Map(classesSnap.docs.map(d => [d.id, d.data()]));
  const teachers = new Map(teachersSnap.docs.map(d => [d.id, d.data()]));
  const courses = new Map(coursesSnap.docs.map(d => [d.id, d.data()]));
  const schedules = schedulesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Summary loaded:`);
  console.log(`- Units: ${units.size}`);
  console.log(`- Rooms: ${rooms.size}`);
  console.log(`- Classes: ${classes.size}`);
  console.log(`- Teachers: ${teachers.size}`);
  console.log(`- Courses: ${courses.size}`);
  console.log(`- Schedules: ${schedules.length}`);
  console.log("--------------------------------------------------");

  let inconsistenciesCount = 0;

  // 2. Diagnosticar Agendamentos (Schedules)
  console.log("\nChecking 'schedules' collection...");
  schedules.forEach(sched => {
    const issues = [];

    // Validar unidade
    if (!sched.unitId) {
      issues.push("Sem unitId definido");
    } else if (!units.has(sched.unitId)) {
      issues.push(`unitId inexistente: "${sched.unitId}"`);
    }

    // Validar ambiente (Room)
    if (!sched.roomId) {
      issues.push("Sem roomId definido");
    } else if (!rooms.has(sched.roomId)) {
      issues.push(`roomId fantasma (não existe em 'rooms'): "${sched.roomId}"`);
    }

    // Validar professor
    if (!sched.teacherId) {
      issues.push("Sem teacherId definido");
    } else if (!teachers.has(sched.teacherId) && sched.teacherId !== "direct_booking") {
      issues.push(`teacherId fantasma (não existe em 'teachers'): "${sched.teacherId}"`);
    }

    // Validar turma
    if (!sched.classId) {
      issues.push("Sem classId definido");
    } else if (!classes.has(sched.classId) && sched.classId !== "direct_booking") {
      issues.push(`classId fantasma (não existe em 'classes'): "${sched.classId}"`);
    }

    if (issues.length > 0) {
      inconsistenciesCount++;
      console.log(`⚠️ Agendamento ID "${sched.id}" (${sched.className || "Sem nome"} em ${sched.roomName || "Sem sala"}):`);
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
  });

  // 3. Diagnosticar Turmas (Classes)
  console.log("\nChecking 'classes' collection...");
  classes.forEach((cls, id) => {
    const issues = [];

    // Validar unidade
    if (!cls.unitId) {
      issues.push("Sem unitId definido");
    } else if (!units.has(cls.unitId)) {
      issues.push(`unitId inexistente: "${cls.unitId}"`);
    }

    // Validar curso
    if (!cls.courseId) {
      issues.push("Sem courseId definido");
    } else if (!courses.has(cls.courseId)) {
      issues.push(`courseId fantasma (não existe em 'courses'): "${cls.courseId}"`);
    }

    // Validar professores habilitados
    if (cls.teacherIds && Array.isArray(cls.teacherIds)) {
      cls.teacherIds.forEach(tId => {
        if (!teachers.has(tId)) {
          issues.push(`Vinculado a professor fantasma ID: "${tId}"`);
        }
      });
    }

    // Validar ambientes padrão
    if (cls.environmentIds && Array.isArray(cls.environmentIds)) {
      cls.environmentIds.forEach(rId => {
        if (!rooms.has(rId)) {
          issues.push(`Vinculado a ambiente fantasma ID: "${rId}"`);
        }
      });
    }

    if (issues.length > 0) {
      inconsistenciesCount++;
      console.log(`⚠️ Turma ID "${id}" ("${cls.name || "Sem nome"}"):`);
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
  });

  // 4. Diagnosticar Ambientes (Rooms)
  console.log("\nChecking 'rooms' collection...");
  rooms.forEach((room, id) => {
    const issues = [];

    // Validar unidade
    if (!room.unitId) {
      issues.push("Sem unitId definido");
    } else if (!units.has(room.unitId)) {
      issues.push(`unitId inexistente: "${room.unitId}"`);
    }

    // Validar se o bloco/andar faz sentido com os metadados da unidade
    if (room.unitId && units.has(room.unitId)) {
      const unit = units.get(room.unitId);
      const metadata = unit.metadata || {};
      
      if (room.block && metadata.blocks && !metadata.blocks.includes(room.block)) {
        issues.push(`Bloco "${room.block}" não está listado nos metadados da unidade`);
      }
      if (room.floor && metadata.floors && !metadata.floors.includes(room.floor)) {
        issues.push(`Andar "${room.floor}" não está listado nos metadados da unidade`);
      }
      if (room.type && metadata.roomTypes && !metadata.roomTypes.includes(room.type)) {
        issues.push(`Tipo "${room.type}" não está listado nos metadados da unidade`);
      }
    }

    if (issues.length > 0) {
      inconsistenciesCount++;
      console.log(`⚠️ Ambiente ID "${id}" ("${room.name || "Sem nome"}"):`);
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
  });

  console.log("\n--------------------------------------------------");
  if (inconsistenciesCount === 0) {
    console.log("🎉 DIAGNÓSTICO CONCLUÍDO: Nenhum dado fantasma ou inconsistência detectada!");
  } else {
    console.log(`⚠️ DIAGNÓSTICO CONCLUÍDO: Encontradas ${inconsistenciesCount} inconsistências.`);
    console.log("Nota: Você pode usar scripts específicos para limpar esses dados órfãos se desejar.");
  }
}

checkGhostData().catch(err => {
  console.error("❌ Ocorreu um erro no diagnóstico:", err);
});
