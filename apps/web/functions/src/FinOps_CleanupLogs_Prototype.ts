/**
 * @file CleanUpOldLogs.ts (PROTOTYPE)
 * @description Protótipo de Cloud Function para limpeza automática de logs antigos.
 * Atende à recomendação de Lifecycle de Dados (FinOps).
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

// Agendado para meia-noite (Midnight) todos os dias
export const cleanupOldAuditLogs = onSchedule('0 0 * * *', async (event) => {
  const db = admin.firestore();
  
  // Configurações de Retenção
  const RETENTION_GENERAL_DAYS = 7;
  const RETENTION_IMPORTANT_DAYS = 90;
  
  const now = new Date();
  const cutoffGeneral = new Date(now.getTime() - (RETENTION_GENERAL_DAYS * 24 * 60 * 60 * 1000));
  const cutoffImportant = new Date(now.getTime() - (RETENTION_IMPORTANT_DAYS * 24 * 60 * 60 * 1000));

  // Ações de suma importância que devem ser mantidas por mais tempo
  const IMPORTANT_ACTIONS = [
    'DELETE_COURSE', 'DELETE_UNIT', 'DELETE_TEACHER', 'DELETE_CLASS', 
    'DELETE_ENVIRONMENT', 'DELETE_SCHEDULE', 'DELETE_USER',
    'CREATE_USER', 'UPDATE_USER', 'USER_ROLE_CHANGED', 'USER_STATUS_CHANGED',
    'SYSTEM_ERROR', 'DATA_EXPORT', 'DATA_IMPORT', 'BULK_CREATE_SCHEDULES',
    'LOGIN_FAILED'
  ];
  
  // Buscar logs mais antigos que o limite geral (7 dias)
  const oldLogsQuery = db.collection('audit_logs')
    .where('timestamp', '<', admin.firestore.Timestamp.fromDate(cutoffGeneral))
    .limit(500);
    
  const snapshot = await oldLogsQuery.get();
  
  if (snapshot.empty) {
    console.log('Nenhum log para remoção nesta execução.');
    return;
  }
  
  const batch = db.batch();
  let deletedCount = 0;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const action = data.action;
    const timestamp = data.timestamp.toDate();

    // Se for uma ação importante e ainda não passou 90 dias, mantemos
    if (IMPORTANT_ACTIONS.includes(action) && timestamp > cutoffImportant) {
      return; // Skip deletion
    }
    
    batch.delete(doc.ref);
    deletedCount++;
  });
  
  if (deletedCount > 0) {
    await batch.commit();
    console.log(`${deletedCount} logs de auditoria removidos (Ciclo de Vida FinOps).`);
  } else {
    console.log('Nenhum log elegível para remoção (todos importantes dentro do prazo).');
  }
  return;
});
