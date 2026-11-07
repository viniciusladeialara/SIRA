const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'agendamento_db',
});

async function runReset() {
  try {
    console.log('🔄 Conectando ao PostgreSQL (agendamento_db)...');
    const sqlPath = path.join(__dirname, '../docs/db/reset_limpar_dados_manter_superadmin.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🧹 Executando reset e limpando dados de teste...');
    const res = await pool.query(sql);
    console.log('✅ Reset executado com sucesso!');
    
    if (Array.isArray(res)) {
      const lastRes = res[res.length - 1];
      console.log('📊 Resultado:', lastRes.rows);
    }
  } catch (err) {
    console.error('❌ Erro ao executar reset no PostgreSQL:', err.message);
  } finally {
    await pool.end();
  }
}

runReset();
