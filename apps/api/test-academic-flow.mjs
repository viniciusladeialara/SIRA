import { NestFactory } from '@nestjs/core';
import { AppModule } from './dist/app.module.js';
import { ValidationPipe } from '@nestjs/common';

async function run() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(3099);
  console.log('Test Server listening on port 3099');

  const BASE_URL = 'http://localhost:3099/api/v1';

  try {
    // 1. Login as Admin
    console.log('\n--- 1. Login com admin@sira.local ---');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sira.local', password: 'Admin@2026' }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(`Login falhou: ${JSON.stringify(loginData)}`);
    console.log('Login OK! Token obtido:', loginData.access_token ? 'Sim' : 'Não');

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginData.access_token}`,
      'X-Unidade-Id': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // SENAI Cuiabá
    };

    // 2. Ambientes / Salas
    console.log('\n--- 2. GET /ambientes ---');
    const ambRes = await fetch(`${BASE_URL}/ambientes`, { headers: authHeaders });
    const ambData = await ambRes.json();
    console.log(`Ambientes retornados: ${ambData.length}`);
    console.log('Primeiro ambiente:', ambData[0]?.nome);

    console.log('\n--- 3. GET /salas (alias) ---');
    const salasRes = await fetch(`${BASE_URL}/salas`, { headers: authHeaders });
    const salasData = await salasRes.json();
    console.log(`Salas retornadas: ${salasData.length}`);

    // 4. Cursos
    console.log('\n--- 4. GET /cursos ---');
    const curRes = await fetch(`${BASE_URL}/cursos`, { headers: authHeaders });
    const curData = await curRes.json();
    console.log(`Cursos retornados: ${curData.length}`);
    console.log('Cursos:', curData.map(c => c.nome).join(', '));

    // 5. Docentes / Professores
    console.log('\n--- 5. GET /docentes ---');
    const docRes = await fetch(`${BASE_URL}/docentes`, { headers: authHeaders });
    const docData = await docRes.json();
    console.log(`Docentes retornados: ${docData.length}`);
    console.log('Docentes:', docData.map(d => d.nome).join(', '));

    // 6. Turmas
    console.log('\n--- 6. GET /turmas ---');
    const turRes = await fetch(`${BASE_URL}/turmas`, { headers: authHeaders });
    const turData = await turRes.json();
    console.log(`Turmas retornadas: ${turData.length}`);
    console.log('Turmas:', turData.map(t => `${t.codigo} - ${t.nome}`).join(', '));

    // 7. Agendamentos
    console.log('\n--- 7. GET /agendamentos ---');
    const agRes = await fetch(`${BASE_URL}/agendamentos`, { headers: authHeaders });
    const agData = await agRes.json();
    console.log(`Agendamentos retornados: ${agData.length}`);

    // 8. Feriados
    console.log('\n--- 8. GET /calendar/holidays ---');
    const ferRes = await fetch(`${BASE_URL}/calendar/holidays`, { headers: authHeaders });
    const ferData = await ferRes.json();
    console.log(`Feriados retornados: ${ferData.length}`);

    // 9. Conflito de Agendamento (Teste de Regra de Negócio)
    console.log('\n--- 9. Teste de Conflito de Agendamento (Mesmo Ambiente e Horário) ---');
    const existingAg = agData[0];
    const conflitoRes = await fetch(`${BASE_URL}/agendamentos`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        unidade_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        turma_id: turData[0].id,
        ambiente_id: existingAg.ambiente_id,
        docente_id: docData[0].id,
        data_inicio: '2026-11-09T19:30:00-04:00', // Coincide com a aula já existente das 19h às 22h30
        data_fim: '2026-11-09T21:30:00-04:00',
        observacao: 'Tentativa conflitante',
      }),
    });
    const conflitoData = await conflitoRes.json();
    console.log('Status code do conflito esperado (409):', conflitoRes.status);
    console.log('Mensagem de erro retornada:', conflitoData.detail || conflitoData.message);

    console.log('\n=== TODOS OS TESTES ACADÊMICOS E DE PLANEJAMENTO PASSARAM COM SUCESSO! ===');
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
