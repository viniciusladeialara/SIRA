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

async function runMigration() {
  console.log("🚀 Iniciando migração de metadados das unidades...");

  // 1. Obter todas as unidades existentes
  const unitsSnap = await db.collection("units").get();
  if (unitsSnap.empty) {
    console.error("❌ Nenhuma unidade encontrada na coleção 'units'. Execute migrateToMultiUnit.js primeiro se necessário.");
    process.exit(1);
  }

  const units = unitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Encontradas ${units.length} unidades.`);

  // Dicionários para guardar os dados únicos por unidade
  const unitBlocks = {};
  const unitFloors = {};
  const unitRoomTypes = {};
  const unitShifts = {};

  // Inicializar dicionários para cada unidade
  for (const unit of units) {
    unitBlocks[unit.id] = new Set();
    unitFloors[unit.id] = new Set();
    unitRoomTypes[unit.id] = new Set();
    unitShifts[unit.id] = new Set();
  }

  // 2. Varrer 'rooms' (ambientes) para extrair blocos, andares e tipos
  console.log("Analisando coleção 'rooms'...");
  const roomsSnap = await db.collection("rooms").get();
  for (const doc of roomsSnap.docs) {
    const data = doc.data();
    const unitId = data.unitId || "caceres"; // fallback padrão
    
    if (!unitBlocks[unitId]) {
      unitBlocks[unitId] = new Set();
      unitFloors[unitId] = new Set();
      unitRoomTypes[unitId] = new Set();
      unitShifts[unitId] = new Set();
    }

    if (data.block) unitBlocks[unitId].add(data.block);
    if (data.floor) unitFloors[unitId].add(data.floor);
    if (data.type) unitRoomTypes[unitId].add(data.type);
  }

  // 3. Varrer 'classes' (turmas) para extrair turnos (periods)
  console.log("Analisando coleção 'classes'...");
  const classesSnap = await db.collection("classes").get();
  for (const doc of classesSnap.docs) {
    const data = doc.data();
    const unitId = data.unitId || "caceres"; // fallback padrão
    
    if (!unitShifts[unitId]) {
      unitBlocks[unitId] = new Set();
      unitFloors[unitId] = new Set();
      unitRoomTypes[unitId] = new Set();
      unitShifts[unitId] = new Set();
    }

    if (data.period) unitShifts[unitId].add(data.period);
  }

  // 4. Salvar os metadados em cada unidade
  console.log("Atualizando unidades com os metadados centralizados...");
  for (const unit of units) {
    const unitId = unit.id;

    // Valores padrão de fallback se as coleções estiverem vazias
    const defaultBlocks = ["A", "B", "C", "D"];
    const defaultFloors = ["Térreo", "1º", "2º", "3º"];
    const defaultRoomTypes = ["Sala de Aula", "Laboratório", "Auditório", "Biblioteca", "Outro"];
    const defaultShifts = ["Matutino", "Vespertino", "Noturno"];

    // Converter Sets para Arrays ordenados
    const blocks = unitBlocks[unitId].size > 0 ? Array.from(unitBlocks[unitId]).sort() : defaultBlocks;
    const floors = unitFloors[unitId].size > 0 ? Array.from(unitFloors[unitId]).sort() : defaultFloors;
    const roomTypes = unitRoomTypes[unitId].size > 0 ? Array.from(unitRoomTypes[unitId]).sort() : defaultRoomTypes;
    const shifts = unitShifts[unitId].size > 0 ? Array.from(unitShifts[unitId]).sort() : defaultShifts;

    const metadata = {
      blocks,
      floors,
      roomTypes,
      shifts
    };

    console.log(`Unidade: ${unitId} (${unit.name})`);
    console.log(`- Blocks:`, blocks);
    console.log(`- Floors:`, floors);
    console.log(`- Room Types:`, roomTypes);
    console.log(`- Shifts:`, shifts);

    await db.collection("units").doc(unitId).set({
      metadata
    }, { merge: true });

    console.log(`✅ Unidade ${unitId} atualizada com sucesso!`);
  }

  console.log("🎉 PROCESSAMENTO CONCLUÍDO COM SUCESSO!");
  process.exit(0);
}

runMigration().catch(err => {
  console.error("❌ Ocorreu um erro na migração:", err);
  process.exit(1);
});
