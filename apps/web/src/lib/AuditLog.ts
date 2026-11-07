// src/lib/AuditLog.ts

import { db } from "./db";
import { collection, addDoc, Timestamp, query, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData, where } from "@/lib/sira-sql-adapter";
import { User } from "@/lib/sira-auth-adapter";

/**
 * Tipos de ações que podem ser registradas
 */
export enum AuditAction {
  // Autenticação
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  
  // Cursos
  CREATE_COURSE = 'CREATE_COURSE',
  UPDATE_COURSE = 'UPDATE_COURSE',
  DELETE_COURSE = 'DELETE_COURSE',
  IMPORT_COURSES = 'IMPORT_COURSES',
  
  // Disciplinas
  CREATE_UNIT = 'CREATE_UNIT',
  UPDATE_UNIT = 'UPDATE_UNIT',
  DELETE_UNIT = 'DELETE_UNIT',
  
  // Professores
  CREATE_TEACHER = 'CREATE_TEACHER',
  UPDATE_TEACHER = 'UPDATE_TEACHER',
  DELETE_TEACHER = 'DELETE_TEACHER',
  
  // Turmas
  CREATE_CLASS = 'CREATE_CLASS',
  UPDATE_CLASS = 'UPDATE_CLASS',
  DELETE_CLASS = 'DELETE_CLASS',
  
  // Ambientes
  CREATE_ENVIRONMENT = 'CREATE_ENVIRONMENT',
  UPDATE_ENVIRONMENT = 'UPDATE_ENVIRONMENT',
  DELETE_ENVIRONMENT = 'DELETE_ENVIRONMENT',
  
  // Agendamentos
  CREATE_SCHEDULE = 'CREATE_SCHEDULE',
  UPDATE_SCHEDULE = 'UPDATE_SCHEDULE',
  DELETE_SCHEDULE = 'DELETE_SCHEDULE',
  BULK_CREATE_SCHEDULES = 'BULK_CREATE_SCHEDULES',
  
  // Usuários
  CREATE_USER = 'CREATE_USER',
  UPDATE_USER = 'UPDATE_USER',
  DELETE_USER = 'DELETE_USER',
  USER_SCOPE_CHANGED = 'USER_SCOPE_CHANGED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_STATUS_CHANGED = 'USER_STATUS_CHANGED',
  USER_LOGIN = 'USER_LOGIN',
  USER_INVITE_SENT = 'USER_INVITE_SENT',
  USER_MODULE_PERMISSION_CHANGED = 'USER_MODULE_PERMISSION_CHANGED',
  
  // Conformidade & LGPD
  TEACHER_MONITORING_ACCESSED = 'TEACHER_MONITORING_ACCESSED',
  
  // Sistema
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  SYSTEM_CONFIG_UPDATED = 'SYSTEM_CONFIG_UPDATED',
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_IMPORT = 'DATA_IMPORT'
}

/**
 * Interface para logs de auditoria
 */
export interface AuditLogEntry {
  id?: string;
  action: AuditAction;
  adminId: string;
  adminEmail: string;
  description: string;
  details: Record<string, any>;
  timestamp: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Função para registrar uma ação de auditoria no Firestore.
 * @param action O tipo da ação (usar enum AuditAction).
 * @param user O objeto de usuário do Firebase Auth.
 * @param description Uma descrição detalhada da ação.
 * @param details (Opcional) Um objeto com detalhes adicionais da ação.
 */
export const logAction = async (
  action: AuditAction, 
  user: User, 
  description: string, 
  details?: Record<string, any>
) => {
  // --- FILTRO DE OTIMIZAÇÃO (Pedido do Usuário) ---
  // Gravar apenas ações críticas para economizar storage no Firestore
  const criticalActions = [
    // Usuários
    AuditAction.CREATE_USER,
    AuditAction.UPDATE_USER,
    AuditAction.DELETE_USER,
    AuditAction.USER_ROLE_CHANGED,
    AuditAction.USER_STATUS_CHANGED,
    AuditAction.USER_INVITE_SENT,
    AuditAction.USER_MODULE_PERMISSION_CHANGED,
    
    // Conformidade Pedagógica e LGPD
    AuditAction.TEACHER_MONITORING_ACCESSED,
    
    // Professores
    AuditAction.CREATE_TEACHER,
    AuditAction.UPDATE_TEACHER,
    AuditAction.DELETE_TEACHER,

    // Turmas e Disciplinas
    AuditAction.CREATE_CLASS,
    AuditAction.UPDATE_CLASS,
    AuditAction.DELETE_CLASS,
    AuditAction.CREATE_UNIT,
    AuditAction.UPDATE_UNIT,
    AuditAction.DELETE_UNIT,

    // Ambientes
    AuditAction.CREATE_ENVIRONMENT,
    AuditAction.UPDATE_ENVIRONMENT,
    AuditAction.DELETE_ENVIRONMENT,

    // Cursos
    AuditAction.CREATE_COURSE,
    AuditAction.UPDATE_COURSE,
    AuditAction.DELETE_COURSE,
    AuditAction.IMPORT_COURSES,

    // Agendamentos (Criação, Edição, Exclusão e Lote)
    AuditAction.CREATE_SCHEDULE,
    AuditAction.UPDATE_SCHEDULE,
    AuditAction.DELETE_SCHEDULE,
    AuditAction.BULK_CREATE_SCHEDULES,

    // Dados e Sistema
    AuditAction.DATA_IMPORT,
    AuditAction.DATA_EXPORT,
    AuditAction.SYSTEM_ERROR,
    AuditAction.SYSTEM_CONFIG_UPDATED,

    // Autenticação
    AuditAction.LOGIN,
    AuditAction.LOGIN_FAILED
  ];

  if (!criticalActions.includes(action)) {
    console.log(`ℹ️ [AUDIT] Ação ignorada por política de economia: ${action}`);
    return;
  }

  try {
    const logEntry: Omit<AuditLogEntry, 'id'> = {
      action,
      adminId: user.uid,
      adminEmail: user.email || 'unknown',
      description,
      details: details || {},
      timestamp: Timestamp.now(),
      ipAddress: await getClientIP(),
      userAgent: navigator.userAgent
    };

    await addDoc(collection(db, "audit_logs"), logEntry);
    console.log(`✅ Log de auditoria registrado: ${action} por ${user.email}`);
  } catch (error) {
    console.error("❌ Erro ao registrar log de auditoria:", error);
  }
};

/**
 * Função para obter o IP do cliente
 * TODO: Migrar para Cloud Function para melhor segurança e confiabilidade
 * Atualmente usa api.ipify.org como fallback
 */
const getClientIP = async (): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout de 5 segundos
    
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.ip || 'unknown';
  } catch (error: any) {
    // Silent fail for AbortError (timeout) - registrar com IP desconhecido é melhor que falhar completamente
    if (error.name === 'AbortError') {
      console.log('Timeout ao obter IP do cliente - registrando como unknown');
    } else {
      console.warn('Não foi possível obter IP do cliente:', error);
    }
    return 'unknown';
  }
};

/**
 * Função para buscar logs de auditoria com paginação
 * @param limitCount Número de logs por página
 * @param lastVisible Documento inicial para a próxima página
 */
export const getAuditLogsPaged = async (
  limitCount: number = 20,
  lastVisible: QueryDocumentSnapshot<DocumentData> | null = null
): Promise<{ logs: AuditLogEntry[], lastVisible: QueryDocumentSnapshot<DocumentData> | null }> => {
  try {
    let q = query(
      collection(db, "audit_logs"),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );

    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }
    
    const querySnapshot = await getDocs(q);
    const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
    
    const logs = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AuditLogEntry[];

    return { logs, lastVisible: lastDoc };
  } catch (error) {
    console.error("Erro ao buscar logs de auditoria paginados:", error);
    return { logs: [], lastVisible: null };
  }
};

/**
 * Função para buscar logs de auditoria (Legado - Mantido para compatibilidade)
 * @param limitCount Número máximo de logs a retornar (padrão: 100)
 */
export const getAuditLogs = async (limitCount: number = 100): Promise<AuditLogEntry[]> => {
  const result = await getAuditLogsPaged(limitCount);
  return result.logs;
};

/**
 * Função para buscar logs de um usuário específico
 * @param userId ID do usuário
 * @param limitCount Número máximo de logs a retornar
 */
export const getAuditLogsByUser = async (userId: string, limitCount: number = 50): Promise<AuditLogEntry[]> => {
  try {
    const q = query(
      collection(db, "audit_logs"),
      where("adminId", "==", userId),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as AuditLogEntry));
  } catch (error) {
    console.error("Erro ao buscar logs do usuário:", error);
    return [];
  }
};