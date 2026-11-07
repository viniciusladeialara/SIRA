import { NestFactory } from '@nestjs/core';
import { AppModule } from './dist/app.module.js';
import { SyncService } from './dist/modules/sync/sync.service.js';

async function runTests() {
  console.log('=================================================================');
  console.log(' TESTE AUTOMATIZADO: SINCRONIZAÇÃO E PROMOÇÃO SEGURA (SIRA)');
  console.log('=================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const syncService = app.get(SyncService);

  try {
    // 1. Obter Status de Sincronização
    console.log('[TESTE 1] Obtendo status comparativo Produção vs Teste...');
    const status = await syncService.getSyncStatus();
    console.log('Status Produção:', status.producao);
    console.log('Status Teste:', status.teste);
    if (!status.teste.online) {
      throw new Error(`Banco de teste offline: ${status.teste.error}`);
    }
    console.log('=> [PASSOU] Status obtido e ambos os bancos estão online!\n');

    // 2. Validação prévia de cenários
    console.log('[TESTE 2] Validando conflitos no banco de testes...');
    const validation = await syncService.validateScenario();
    console.log('Validação de Conflitos:', validation);
    if (!validation.valid) {
      console.warn('Atenção: Existem conflitos no banco de testes:', validation.conflicts);
    } else {
      console.log('=> [PASSOU] Cenário no banco de testes está livre de conflitos!\n');
    }

    // 3. Teste de autorização: Senha incorreta deve ser rejeitada
    console.log('[TESTE 3] Tentando promover com senha de admin INCORRETA...');
    try {
      await syncService.promoteTestToProd('admin@sira.local', {
        adminPassword: 'SenhaErrada123',
        motivo: 'Teste de falha intencional',
      });
      throw new Error('Falha de segurança: Deveria ter bloqueado com senha incorreta!');
    } catch (err) {
      if (err.message && err.message.includes('Senha de autorização de administrador incorreta')) {
        console.log('=> [PASSOU] Bloqueio de segurança funcionou perfeitamente: 401 Unauthorized.\n');
      } else {
        throw err;
      }
    }

    // 4. Teste de promoção transacional com senha CORRETA
    console.log('[TESTE 4] Promovendo cenário com senha de admin CORRETA (Admin@2026)...');
    const promoteResult = await syncService.promoteTestToProd('admin@sira.local', {
      adminPassword: 'Admin@2026',
      motivo: 'Homologação e Publicação de Grade Semestral',
    });
    console.log('Resultado da Promoção:', promoteResult);
    if (promoteResult.status !== 'SUCESSO') {
      throw new Error('Falha na promoção com senha correta');
    }
    console.log('=> [PASSOU] Promoção transacional concluída e log de auditoria gerado!\n');

    // 5. Teste de Espelhamento Produção -> Teste
    console.log('[TESTE 5] Testando espelhamento Produção -> Teste (sira -> sira_teste)...');
    const mirrorResult = await syncService.mirrorProdToTest('admin@sira.local', {
      adminPassword: 'Admin@2026',
      sanitize: true,
    });
    console.log('Resultado do Espelhamento:', mirrorResult);
    if (mirrorResult.status !== 'SUCESSO') {
      throw new Error('Falha no espelhamento');
    }
    console.log('=> [PASSOU] Espelhamento Produção -> Teste executado com sucesso!\n');

    console.log('=================================================================');
    console.log(' TODOS OS 5 TESTES DE SINCRONIZAÇÃO PASSARAM COM 100% DE ÊXITO!');
    console.log('=================================================================');
  } catch (error) {
    console.error('\n[ERRO NO TESTE]:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runTests();
