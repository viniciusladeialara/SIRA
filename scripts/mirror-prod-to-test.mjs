#!/usr/bin/env node
/**
 * SIRA - Script de Espelhamento: Produção -> Teste (sira -> sira_teste)
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  console.log('=================================================================');
  console.log(' SIRA - ESPELHAMENTO DE DADOS: PRODUÇÃO -> TESTE');
  console.log(' Origem:  sira (PostgreSQL :5432)');
  console.log(' Destino: sira_teste (PostgreSQL :5432)');
  console.log('=================================================================\n');

  console.log('[1/3] Verificando se os contêineres Docker estão ativos...');
  try {
    await execAsync('docker exec sira-postgres pg_isready -U sira_admin -d sira');
  } catch {
    console.error('[ERRO] O contêiner sira-postgres não está pronto ou offline!');
    process.exit(1);
  }

  console.log('[2/3] Recriando banco sira_teste e executando cópia com pg_dump...');
  const cmd = `docker exec sira-postgres sh -c "psql -U sira_admin -d postgres -c 'DROP DATABASE IF EXISTS sira_teste WITH (FORCE);' && psql -U sira_admin -d postgres -c 'CREATE DATABASE sira_teste;' && pg_dump -U sira_admin -d sira | psql -U sira_admin -d sira_teste > /dev/null 2>&1"`;

  const startTime = Date.now();
  await execAsync(cmd);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`[3/3] Espelhamento finalizado com sucesso em ${duration}s!`);
  console.log('\n[SUCESSO] O banco de dados [sira_teste] agora é uma cópia idêntica de [sira].\n');
}

main().catch((err) => {
  console.error('\n[ERRO]:', err.message);
  process.exit(1);
});
