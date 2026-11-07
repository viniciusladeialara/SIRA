/**
 * ==============================================================================
 * SIRA - Sistema Integrado de Recursos Acadêmicos
 * lib/db.ts: Provedor Unificado de Dados e Estado Local (PostgreSQL + NestJS API)
 * ==============================================================================
 */

export const db = {
  type: 'sira_sql',
  engine: 'postgresql',
  version: '16',
};

export const auth = {
  currentUser: null,
};

export const functions = {};
export const storage = {};

export default db;
