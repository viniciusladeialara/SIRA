#!/usr/bin/env node
/**
 * SIRA - Script de Promoção: Teste -> Produção com Senha de Admin (sira_teste -> sira)
 */
import readline from 'readline';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/api/dist/app.module.js';
import { SyncService } from '../apps/api/dist/modules/sync/sync.service.js';

function ask(question, isPassword = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('=================================================================');
  console.log(' SIRA - PROMOÇÃO TRANSACIONAL DE CENÁRIO (TESTE -> PRODUÇÃO)');
  console.log(' Origem:  sira_teste (Sandbox / Homologação)');
  console.log(' Destino: sira (Produção Ativa)');
  console.log('=================================================================\n');

  console.log('[ATENÇÃO] Esta operação irá promover turmas, ambientes, docentes e');
  console.log('agendamentos testados para o banco de produção oficial do SIRA.\n');

  const adminEmail = (await ask('>> Digite o email do Administrador [admin@sira.local]: ')) || 'admin@sira.local';
  const adminPassword = await ask('>> Digite a SENHA de autorização do Administrador: ');
  const motivo = (await ask('>> Digite a justificativa/motivo da publicação: ')) || 'Publicação de Grade Aprovada';

  if (!adminPassword) {
    console.error('\n[ERRO] A senha do administrador é estritamente obrigatória para autorizar!');
    process.exit(1);
  }

  console.log('\n[1/3] Inicializando serviço de sincronização do SIRA...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const syncService = app.get(SyncService);

  try {
    console.log('[2/3] Executando validação de conflitos e autenticando administrador...');
    const result = await syncService.promoteTestToProd(adminEmail, {
      adminPassword,
      motivo,
    });

    console.log('[3/3] Promoção concluída com sucesso!');
    console.log('\n=================================================================');
    console.log(' DADOS PROMOVIDOS PARA PRODUÇÃO:');
    console.log(' - Cursos:       ', result.registrosPromovidos.cursos);
    console.log(' - Ambientes:    ', result.registrosPromovidos.ambientes);
    console.log(' - Docentes:     ', result.registrosPromovidos.docentes);
    console.log(' - Turmas:       ', result.registrosPromovidos.turmas);
    console.log(' - Feriados:     ', result.registrosPromovidos.feriados);
    console.log(' - Agendamentos: ', result.registrosPromovidos.agendamentos);
    console.log(' - Responsável:  ', result.auditoria.responsavel);
    console.log(' - Motivo:       ', result.auditoria.motivo);
    console.log('=================================================================\n');
  } catch (error) {
    console.error('\n[ERRO NA PROMOÇÃO]:', error.message || error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('\n[ERRO]:', err);
  process.exit(1);
});
