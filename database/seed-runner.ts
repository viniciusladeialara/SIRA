/**
 * @file seed-runner.ts
 * @description Executor idempotente de seeds com controle de versão em core.seed_history
 * @author SIRA Enterprise Architecture
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '../apps/api/node_modules/@prisma/client/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://sira_admin:Sira@2026@localhost:5432/sira?schema=core',
    },
  },
});

interface SeedDefinition {
  version: string;
  file: string;
  description: string;
}

const SEED_REGISTRY: SeedDefinition[] = [
  {
    version: '2026.11.01',
    file: '01_seed_producao.sql',
    description: 'Carga essencial de produção (RBAC, Unidades SENAI, Admin e Permissões)',
  },
  {
    version: '2026.11.02',
    file: '02_seed_teste_carga.sql',
    description: 'Carga de teste para 3 unidades (Cuiabá, Cáceres, Rondonópolis com cursos, salas e turmas)',
  },
];

async function ensureSeedHistoryTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "core"."seed_history" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "versao" VARCHAR(50) NOT NULL,
      "descricao" VARCHAR(255) NOT NULL,
      "executado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "executado_por" VARCHAR(100) NOT NULL DEFAULT 'sistema',
      CONSTRAINT "seed_history_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "seed_history_versao_key" UNIQUE ("versao")
    );
  `);
}

async function runSeed(seed: SeedDefinition, force = false): Promise<boolean> {
  const seedsDir = path.join(__dirname, 'seeds');
  const filePath = path.join(seedsDir, seed.file);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ [ERRO] Arquivo de seed não encontrado: ${filePath}`);
    return false;
  }

  // Verificar se o seed já foi executado
  if (!force) {
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "core"."seed_history" WHERE "versao" = $1 LIMIT 1`,
      seed.version
    );

    if (existing && existing.length > 0) {
      console.log(`⏩ [PULADO] Seed v${seed.version} (${seed.file}) já executado em ${existing[0].executado_em} por ${existing[0].executado_por}`);
      return true;
    }
  }

  console.log(`\n🚀 [INICIANDO] Executando Seed v${seed.version}: ${seed.description}...`);

  try {
    // Execução via psql no contêiner docker sira-postgres para compatibilidade total com comandos SQL complexos
    const containerName = process.env.POSTGRES_CONTAINER || 'sira-postgres';
    const dbUser = process.env.POSTGRES_USER || 'sira_admin';
    const dbName = process.env.POSTGRES_DB || 'sira';

    const normalizedSql = fs.readFileSync(filePath, 'utf-8');

    // Executa comando no contêiner
    execSync(`docker exec -i ${containerName} psql -U ${dbUser} -d ${dbName}`, {
      input: normalizedSql,
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    const executor = process.env.USER || process.env.USERNAME || 'sira_cli';

    // Gravar no histórico
    await prisma.$executeRawUnsafe(
      `INSERT INTO "core"."seed_history" ("versao", "descricao", "executado_por", "executado_em")
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT ("versao") DO UPDATE 
       SET "executado_em" = CURRENT_TIMESTAMP, "executado_por" = EXCLUDED."executado_por"`,
      seed.version,
      seed.description,
      executor
    );

    console.log(`✅ [SUCESSO] Seed v${seed.version} gravado em core.seed_history.`);
    return true;
  } catch (error: any) {
    console.error(`❌ [FALHA] Erro ao executar seed v${seed.version}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('================================================================');
  console.log('   SIRA Enterprise – Executor Idempotente de Seeds (v2.0)       ');
  console.log('================================================================');

  const args = process.argv.slice(2);
  const target = args.find((a) => a.startsWith('--target='))?.split('=')[1] || 'all';
  const force = args.includes('--force');

  await ensureSeedHistoryTable();

  let selectedSeeds = SEED_REGISTRY;

  if (target === 'prod') {
    selectedSeeds = SEED_REGISTRY.filter((s) => s.file.includes('producao'));
  } else if (target === 'load' || target === 'carga') {
    selectedSeeds = SEED_REGISTRY.filter((s) => s.file.includes('teste_carga'));
  }

  let successCount = 0;

  for (const seed of selectedSeeds) {
    const ok = await runSeed(seed, force);
    if (ok) successCount++;
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Concluído: ${successCount} de ${selectedSeeds.length} seeds processados.`);
  console.log('----------------------------------------------------------------');
}

main()
  .catch((err) => {
    console.error('Erro fatal no seed-runner:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
