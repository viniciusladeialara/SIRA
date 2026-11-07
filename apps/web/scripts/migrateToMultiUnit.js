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
  console.log("🚀 Iniciando migração para Multi-Unidade...");

  // 1. Criar Coleção de Unidades
  console.log("Creating units collection...");
  await db.collection("units").doc("caceres").set({
    name: "SENAI Cáceres",
    code: "CAC",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await db.collection("units").doc("varzea-grande").set({
    name: "SENAI Várzea Grande",
    code: "VG",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await db.collection("units").doc("barra-do-bugres").set({
    name: "SENAI Barra do Bugres",
    code: "BB",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log("✅ Units collection populated!");

  // 2. Migrar Coleções Principais para Cáceres
  const collectionsToMigrate = ["classes", "rooms", "teachers", "schedules", "absences", "projects", "diario_turmas"];

  for (const collName of collectionsToMigrate) {
    console.log(`Migrating collection: ${collName}...`);
    const snapshot = await db.collection(collName).get();
    
    if (snapshot.empty) {
      console.log(`  No documents in ${collName}.`);
      continue;
    }

    console.log(`  Found ${snapshot.size} documents in ${collName}. Migrating in batches...`);
    
    // Batch updates (limite do firestore é 500 por lote)
    let batch = db.batch();
    let count = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Apenas atualiza se já não tiver unitId
      if (!data.unitId) {
        batch.update(doc.ref, {
          unitId: "caceres",
          unitName: "SENAI Cáceres"
        });
        count++;
      }

      if (count === 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
    
    console.log(`✅ Collection ${collName} migration completed!`);
  }

  // 3. Configurar o Super Admin no multi-unit
  console.log("Configuring Super Admin (viniciusladeialara@gmail.com)...");
  const usersSnapshot = await db.collection("users").where("email", "==", "viniciusladeialara@gmail.com").get();

  if (usersSnapshot.empty) {
    console.log("⚠️ Super Admin user document not found in /users collection. Make sure the user exists!");
  } else {
    const adminDoc = usersSnapshot.docs[0];
    await adminDoc.ref.update({
      role: "ADMIN",
      unitIds: ["caceres", "varzea-grande", "barra-do-bugres"],
      selectedUnitId: "caceres"
    });
    console.log("✅ Super Admin config updated!");
  }

  // 4. Configurar todos os outros usuários sem unitId para Cáceres por padrão
  console.log("Migrating other users...");
  const otherUsersSnap = await db.collection("users").get();
  let userBatch = db.batch();
  let userCount = 0;

  for (const doc of otherUsersSnap.docs) {
    const data = doc.data();
    if (data.email === "viniciusladeialara@gmail.com") continue;

    if (!data.unitIds) {
      userBatch.update(doc.ref, {
        unitIds: ["caceres"],
        selectedUnitId: "caceres"
      });
      userCount++;
    }

    if (userCount === 400) {
      await userBatch.commit();
      userBatch = db.batch();
      userCount = 0;
    }
  }

  if (userCount > 0) {
    await userBatch.commit();
  }
  console.log("✅ All other users migrated to Cáceres!");

  console.log("🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!");
  process.exit(0);
}

runMigration().catch(err => {
  console.error("❌ Ocorreu um erro na migração:", err);
  process.exit(1);
});
