const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'agendamento_db',
});

async function runCleanReset() {
  try {
    console.log('⚡ Conectando ao PostgreSQL local (localhost:5432 / agendamento_db)...');
    
    // Lista tabelas existentes
    const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    const existingTables = tablesRes.rows.map(r => r.table_name);
    console.log('📋 Tabelas encontradas no banco:', existingTables);

    // Efetua TRUNCATE em tabelas de teste existentes
    const testTables = ['schedules', 'swaps', 'classes', 'rooms', 'teachers', 'courses', 'patrimonies', 'inventory_items', 'admin_audit_logs'];
    for (const tbl of testTables) {
      if (existingTables.includes(tbl)) {
        await pool.query(`TRUNCATE TABLE ${tbl} CASCADE;`);
        console.log(`🧹 Tabela ${tbl} limpa.`);
      }
    }

    // Garante usuários
    if (existingTables.includes('users')) {
      await pool.query("DELETE FROM users WHERE email NOT IN ('viniciusladeiala@gmail.com', 'viniciusladeialara@gmail.com');");
      console.log('👤 Usuários secundários removidos. Mantido apenas Super Admin.');
    }

    // Garante 3 unidades (CAC, BB, VG)
    if (existingTables.includes('units')) {
      await pool.query(`
        INSERT INTO units (id, code, name, city, state, is_active)
        VALUES 
            ('11111111-1111-1111-1111-111111111111', 'CAC', 'SENAI Cáceres', 'Cáceres', 'MT', true),
            ('22222222-2222-2222-2222-222222222222', 'BB', 'SENAI Barra do Bugres', 'Barra do Bugres', 'MT', true),
            ('33333333-3333-3333-3333-333333333333', 'VG', 'SENAI Várzea Grande', 'Várzea Grande', 'MT', true)
        ON CONFLICT (code) DO UPDATE SET 
            name = EXCLUDED.name, 
            city = EXCLUDED.city,
            is_active = true;
      `);
      console.log('🏢 As 3 Unidades (Cáceres, Barra do Bugres e Várzea Grande) garantidas.');
    }

    // Garante Super Admin em users
    if (existingTables.includes('users')) {
      await pool.query(`
        INSERT INTO users (unit_id, email, password_hash, name, role, is_active)
        VALUES ('11111111-1111-1111-1111-111111111111', 'viniciusladeiala@gmail.com', 'abcd@321**', 'Vinícius Lara (Super Admin)', 'ADMIN', true)
        ON CONFLICT (email) DO UPDATE SET 
            role = 'ADMIN',
            password_hash = 'abcd@321**',
            is_active = true;
      `);
      console.log('👑 Super Admin viniciusladeiala@gmail.com garantido.');
    }

    console.log('✨ Reset do Banco de Dados PostgreSQL concluído com sucesso!');
  } catch (err) {
    console.error('❌ Erro durante o reset:', err.message);
  } finally {
    await pool.end();
  }
}

runCleanReset();
