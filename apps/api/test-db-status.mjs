import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const schemas = await prisma.$queryRawUnsafe(`SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('core', 'academico', 'planejamento', 'producao', 'relatorios', 'auditoria')`);
  console.log('Schemas:', schemas);
  
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema IN ('core', 'academico', 'planejamento', 'producao', 'relatorios', 'auditoria')
    ORDER BY table_schema, table_name
  `);
  console.log('Tables:', tables);
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
