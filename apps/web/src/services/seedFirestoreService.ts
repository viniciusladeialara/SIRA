import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";

export async function runFullFirestoreSeed(currentUserEmail?: string, currentUserId?: string) {
  try {
    const batch = writeBatch(db);

    // 1. UNIDADES
    const unitsData = [
      { id: "caceres", name: "SENAI Cáceres", code: "CAC", city: "Cáceres", state: "MT" },
      { id: "barra-do-bugres", name: "SENAI Barra do Bugres", code: "BB", city: "Barra do Bugres", state: "MT" },
      { id: "cuiaba", name: "SENAI Cuiabá (FATEC)", code: "CBO", city: "Cuiabá", state: "MT" }
    ];

    for (const unit of unitsData) {
      const unitRef = doc(db, "units", unit.id);
      batch.set(unitRef, {
        ...unit,
        is_active: true,
        createdAt: serverTimestamp()
      }, { merge: true });
    }

    // 2. PROFESSORES
    const teachersData = [
      {
        id: "t1111111-1111-1111-1111-111111111111",
        name: "Prof. João Carlos Silva",
        email: "prof.joao@senai.br",
        phone1: "5565999112233",
        phone2: "",
        specialty: "Desenvolvimento de Software & Banco de Dados",
        isActive: true,
        allocated_hours: 40,
        unitId: "caceres",
        unitName: "SENAI Cáceres"
      },
      {
        id: "t2222222-2222-2222-2222-222222222222",
        name: "Profª. Ana Paula Mendes",
        email: "prof.ana@senai.br",
        phone1: "5565999445566",
        phone2: "",
        specialty: "Eletrotécnica & Automação Industrial",
        isActive: true,
        allocated_hours: 36,
        unitId: "caceres",
        unitName: "SENAI Cáceres"
      }
    ];

    for (const teacher of teachersData) {
      const teacherRef = doc(db, "teachers", teacher.id);
      batch.set(teacherRef, teacher, { merge: true });
    }

    // 3. CURSOS
    const coursesData = [
      {
        id: "c1111111-1111-1111-1111-111111111111",
        name: "TÉCNICO EM DESENVOLVIMENTO DE SISTEMAS",
        code: "TDS-2026",
        modality: "Presencial",
        workload_hours: 1200,
        unitId: "caceres"
      },
      {
        id: "c2222222-2222-2222-2222-222222222222",
        name: "TÉCNICO EM ELETROTÉCNICA",
        code: "ELE-2026",
        modality: "Presencial",
        workload_hours: 1400,
        unitId: "caceres"
      },
      {
        id: "c3333333-3333-3333-3333-333333333333",
        name: "QUALIFICAÇÃO EM PROGRAMAÇÃO WEB REACT/NODE",
        code: "WEB-2026",
        modality: "Semi-Presencial",
        workload_hours: 240,
        unitId: "caceres"
      }
    ];

    for (const course of coursesData) {
      const courseRef = doc(db, "courses", course.id);
      batch.set(courseRef, course, { merge: true });
    }

    // 4. SALAS E LABORATÓRIOS (COM EQUIPAMENTOS NO JSONB)
    const roomsData = [
      {
        id: "r1111111-1111-1111-1111-111111111111",
        name: "Lab de Informática 01 (Desenvolvimento)",
        block: "Bloco A",
        floor: "1º Andar",
        type: "Laboratório",
        capacity: 36,
        resources: [
          "35 Computadores Intel i7 16GB",
          "Projetor Epson 4K",
          "Ar-condicionado Split 24000 BTUs",
          "Quadro Branco",
          "Switch Gigabit 48p",
          "Nobreak Central"
        ],
        status: "Disponível",
        isActive: true,
        unitId: "caceres",
        unitName: "SENAI Cáceres"
      },
      {
        id: "r2222222-2222-2222-2222-222222222222",
        name: "Lab de Eletrotécnica & Automação",
        block: "Bloco B",
        floor: "Térreo",
        type: "Laboratório",
        capacity: 30,
        resources: [
          "Bancadas Didáticas Festo",
          "Kits PLC Siemens S7-1200",
          "Osciloscópios Digitais",
          "Impressora 3D Creality",
          "Quadros Elétricos"
        ],
        status: "Disponível",
        isActive: true,
        unitId: "caceres",
        unitName: "SENAI Cáceres"
      },
      {
        id: "r3333333-3333-3333-3333-333333333333",
        name: "Sala de Aula Teórica 102",
        block: "Bloco A",
        floor: "Térreo",
        type: "Sala de Aula",
        capacity: 40,
        resources: [
          "Projetor Multimídia",
          "Ar-condicionado 18000 BTUs",
          "40 Carteiras Ergonômicas",
          "Som Ambiente"
        ],
        status: "Disponível",
        isActive: true,
        unitId: "caceres",
        unitName: "SENAI Cáceres"
      }
    ];

    for (const room of roomsData) {
      const roomRef = doc(db, "rooms", room.id);
      batch.set(roomRef, room, { merge: true });
    }

    // 5. EQUIPAMENTOS / PATRIMÔNIOS
    const patrimoniesData = [
      {
        id: "pat-inf-001",
        tag: "PAT-INF-001",
        description: "Computador Workstation Dell OptiPlex i7 16GB SSD 512GB",
        roomId: "r1111111-1111-1111-1111-111111111111",
        status: "Operacional",
        unitId: "caceres"
      },
      {
        id: "pat-inf-002",
        tag: "PAT-INF-002",
        description: "Projetor Multimídia Epson PowerLite 1080p Full HD",
        roomId: "r1111111-1111-1111-1111-111111111111",
        status: "Operacional",
        unitId: "caceres"
      },
      {
        id: "pat-ele-001",
        tag: "PAT-ELE-001",
        description: "Bancada Didática de Treinamento em PLC Siemens S7-1200",
        roomId: "r2222222-2222-2222-2222-222222222222",
        status: "Operacional",
        unitId: "caceres"
      },
      {
        id: "pat-ele-002",
        tag: "PAT-ELE-002",
        description: "Impressora 3D Creality Ender 3 S1 Pro High Temp",
        roomId: "r2222222-2222-2222-2222-222222222222",
        status: "Operacional",
        unitId: "caceres"
      }
    ];

    for (const pat of patrimoniesData) {
      const patRef = doc(db, "patrimonies", pat.id);
      batch.set(patRef, pat, { merge: true });
    }

    // 6. INVENTÁRIO
    const inventoryData = [
      {
        id: "inv-001",
        name: "Notebook Lenovo ThinkPad E14 Intel i7 16GB",
        category: "TI & Informática",
        serial_number: "SN-LNV-2026-001",
        status: "Em uso",
        value: 4800,
        unitId: "caceres"
      },
      {
        id: "inv-002",
        name: "Kit de Desenvolvimento Arduino Ultimate Festo",
        category: "Laboratório",
        serial_number: "SN-ARD-2026-089",
        status: "Ativo",
        value: 1200,
        unitId: "caceres"
      }
    ];

    for (const inv of inventoryData) {
      const invRef = doc(db, "inventory_items", inv.id);
      batch.set(invRef, inv, { merge: true });
    }

    // 7. TURMAS
    const classesData = [
      {
        id: "b1111111-1111-1111-1111-111111111111",
        code: "TURMA-TDS-1M",
        name: "Desenvolvimento de Sistemas - 1º Módulo (Matutino)",
        courseId: "c1111111-1111-1111-1111-111111111111",
        courseName: "TÉCNICO EM DESENVOLVIMENTO DE SISTEMAS",
        teacherId: "t1111111-1111-1111-1111-111111111111",
        teacherName: "Prof. João Carlos Silva",
        roomId: "r1111111-1111-1111-1111-111111111111",
        roomName: "Lab de Informática 01 (Desenvolvimento)",
        shift: "MATUTINO",
        startDate: "2026-02-01",
        endDate: "2026-07-30",
        dailyHours: 4.0,
        studentCount: 32,
        status: "ATIVA",
        unitId: "caceres"
      },
      {
        id: "b2222222-2222-2222-2222-222222222222",
        code: "TURMA-ELE-1N",
        name: "Eletrotécnica Industrial - 1º Módulo (Noturno)",
        courseId: "c2222222-2222-2222-2222-222222222222",
        courseName: "TÉCNICO EM ELETROTÉCNICA",
        teacherId: "t2222222-2222-2222-2222-222222222222",
        teacherName: "Profª. Ana Paula Mendes",
        roomId: "r2222222-2222-2222-2222-222222222222",
        roomName: "Lab de Eletrotécnica & Automação",
        shift: "NOTURNO",
        startDate: "2026-02-01",
        endDate: "2026-07-30",
        dailyHours: 4.0,
        studentCount: 28,
        status: "ATIVA",
        unitId: "caceres"
      }
    ];

    for (const cls of classesData) {
      const clsRef = doc(db, "classes", cls.id);
      batch.set(clsRef, cls, { merge: true });
    }

    // 8. VINCULAR O USUÁRIO ATUAL / SUPER ADMIN ÀS 3 UNIDADES
    if (currentUserId) {
      const userRef = doc(db, "users", currentUserId);
      const userSnap = await getDoc(userRef);
      const currentUnitIds = userSnap.exists() ? (userSnap.data().unitIds || []) : [];
      const updatedUnitIds = Array.from(new Set([...currentUnitIds, "caceres", "barra-do-bugres", "cuiaba"]));
      batch.set(userRef, {
        email: currentUserEmail,
        role: "ADMIN",
        unitIds: updatedUnitIds,
        selectedUnitId: "caceres",
        isActive: true
      }, { merge: true });
    }

    await batch.commit();
    console.log("✅ Seed completo do Firestore executado com sucesso!");
    return { success: true };
  } catch (err) {
    console.error("Erro ao executar seed completo do Firestore:", err);
    throw err;
  }
}
