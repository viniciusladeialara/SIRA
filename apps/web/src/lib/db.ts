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
  get currentUser() {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        return {
          uid: u.id || u.uid || 'uid',
          id: u.id || u.uid || 'uid',
          email: u.email || '',
          displayName: u.nome || u.name || '',
        };
      }
    } catch {}
    return null;
  },
};

export const functions = {};
export const storage = {};

export default db;
