// src/lib/UserRoles.ts

/**
 * Tipos de usuarios e suas permissoes
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
  PROFESSOR = 'PROFESSOR',
  PARTNER_SCHOOL = 'PARTNER_SCHOOL'
}

import { Timestamp } from "@/lib/sira-sql-adapter";

/**
 * Interface para escopo de acesso do usuário
 */
export interface UserScope {
  level: 'global' | 'internal' | 'restricted';
  teacherId?: string;
  schoolIds?: string[];
}

/**
 * Estados do usuário (PRD)
 */
export enum UserStatus {
  INVITED = 'invited',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked'
}

/**
 * Interface para usuario com role
 */
export interface UserWithRole {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  createdAt?: Date | Timestamp;
  lastLogin?: Date | Timestamp;
  isActive: boolean; // Mantido para compatibilidade legado
  status?: UserStatus;
  escolaId?: string; // FK para Escolas Parceiras
  teacherId?: string; // FK para Perfil de Professor
  scope?: UserScope;
  invitedAt?: Date | Timestamp;
  activatedAt?: Date | Timestamp;
  createdBy?: string;
  updatedAt?: Date | Timestamp;
  updatedBy?: string;
  unitIds?: string[]; // IDs das unidades às quais o usuário tem acesso
  selectedUnitId?: string; // ID da unidade ativa na sessão atual
  allowedModules?: string[]; // IDs de módulos liberados explicitamente para este usuário
  blockedModules?: string[]; // IDs de módulos bloqueados explicitamente para este usuário
}

/**
 * Permissoes por modulo
 */
export interface ModulePermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canImport: boolean;
}

const noAccess: ModulePermissions = {
  canView: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canExport: false,
  canImport: false
};

const readOnly: ModulePermissions = {
  canView: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canExport: false,
  canImport: false
};

const fullAccess: ModulePermissions = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canExport: true,
  canImport: true
};

const operationalAccess: ModulePermissions = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: false, // Perfil USER NUNCA exclui recursos (apenas Administradores excluem)
  canExport: true,
  canImport: true
};

const operationalScheduleAccess: ModulePermissions = {
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: true, // Agendamentos podem ser cancelados/excluídos pelo coordenador
  canExport: true,
  canImport: true
};

/**
 * Mapa de permissoes por role (Alinhado ao PRD e Modelo em 4 Niveis)
 */
export const ROLE_PERMISSIONS: Record<UserRole, Record<string, ModulePermissions>> = {
  [UserRole.SUPER_ADMIN]: {
    overview: fullAccess,
    schedules: fullAccess,
    classes: fullAccess,
    environments: fullAccess,
    courses: fullAccess,
    professors: fullAccess,
    users: fullAccess,
    'user-management': fullAccess,
    swaps: fullAccess,
    assets: fullAccess,
    uniforms: fullAccess,
    'partner-school': fullAccess,
    'diary-import': fullAccess,
    audit: fullAccess,
    conflicts: fullAccess,
    'teacher-allocation': fullAccess,
    'teacher-monitoring': fullAccess,
    'system-settings': fullAccess,
    'core-demo': fullAccess,
  },
  [UserRole.ADMIN]: {
    overview: readOnly,
    schedules: fullAccess,
    classes: fullAccess,
    environments: fullAccess,
    courses: fullAccess,
    professors: fullAccess,
    users: fullAccess,
    'user-management': fullAccess,
    swaps: fullAccess,
    assets: fullAccess,
    uniforms: fullAccess,
    'partner-school': fullAccess,
    'diary-import': fullAccess,
    audit: readOnly,
    conflicts: fullAccess,
    'teacher-allocation': fullAccess,
    'system-settings': noAccess, // Super admin apenas
  },
  [UserRole.USER]: {
    overview: readOnly,
    schedules: operationalScheduleAccess,
    classes: operationalAccess,
    environments: operationalAccess,
    courses: operationalAccess,
    professors: operationalAccess, // Cria e edita professores, mas canDelete: false (não exclui!)
    users: noAccess, // Não acessa nem cria/exclui usuários do sistema
    'user-management': noAccess,
    swaps: operationalAccess,
    assets: operationalAccess,
    uniforms: operationalAccess,
    'partner-school': readOnly,
    'diary-import': fullAccess,
    audit: noAccess,
    conflicts: readOnly,
    'teacher-allocation': readOnly,
    'system-settings': noAccess,
  },
  [UserRole.PROFESSOR]: {
    'teacher-week': fullAccess, // Visualização da sua grade semanal
    swaps: { canView: true, canCreate: true, canEdit: false, canDelete: false, canExport: false, canImport: false }, // Apenas troca!
    schedules: readOnly,
    environments: readOnly,
    classes: noAccess,
    professors: noAccess,
    users: noAccess,
    'user-management': noAccess,
    overview: noAccess,
    audit: noAccess,
    conflicts: noAccess,
    assets: noAccess,
    uniforms: noAccess,
    reports: noAccess,
    'system-settings': noAccess,
  },
  [UserRole.PARTNER_SCHOOL]: {
    'partner-tracking': readOnly,
    'partner-attendance': readOnly,
    'partner-content': readOnly,
    'partner-export': { ...readOnly, canExport: true },
    overview: noAccess,
    audit: noAccess,
  }
};

/**
 * Funcao para verificar se usuario tem permissao
 * Suporta permissoes estaticas por Role e liberacao dinamica pontual por usuario (allowedModules / blockedModules)
 */
export const hasPermission = (
  userRole: UserRole,
  module: string,
  action: keyof ModulePermissions,
  userOverrides?: { allowedModules?: string[]; blockedModules?: string[] }
): boolean => {
  // 1. Verificação de módulo explicitamente bloqueado para este usuário
  if (userOverrides?.blockedModules?.includes(module)) {
    return false;
  }

  // 2. Verificação de liberação dinâmica de módulo para este usuário (promoção por competência)
  if (userOverrides?.allowedModules?.includes(module)) {
    // Se o perfil for USER, ele ganha acesso operacional ao módulo liberado,
    // mas a regra estrita de não poder excluir (canDelete = false) permanece garantida!
    if (action === 'canDelete' && userRole === UserRole.USER) {
      return false;
    }
    return operationalAccess[action];
  }

  // 3. Verificação padrão da Role
  const permissions = ROLE_PERMISSIONS[userRole]?.[module];
  return permissions?.[action] || false;
};

/**
 * Funcao para obter todas as permissoes de um usuario para um modulo
 */
export const getModulePermissions = (
  userRole: UserRole, 
  module: string,
  userOverrides?: { allowedModules?: string[]; blockedModules?: string[] }
): ModulePermissions => {
  if (userOverrides?.blockedModules?.includes(module)) {
    return noAccess;
  }
  if (userOverrides?.allowedModules?.includes(module)) {
    return userRole === UserRole.USER ? operationalAccess : fullAccess;
  }
  return ROLE_PERMISSIONS[userRole]?.[module] || noAccess;
};

/**
 * Funcao para verificar se usuario e administrador
 */
export const isAdmin = (userRole: UserRole): boolean => {
  return userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;
};

/**
 * Funcao para verificar se usuario e super administrador
 */
export const isSuperAdmin = (userRole: UserRole): boolean => {
  return userRole === UserRole.SUPER_ADMIN;
};

/**
 * Funcao para verificar se usuario e operacional
 */
export const isUser = (userRole: UserRole): boolean => {
  return userRole === UserRole.USER;
};

/**
 * Verifica se dois usuários compartilham ao menos uma unidade (Multitenancy Enterprise)
 * Conforme especificado no middleware da documentação de papéis.
 */
export function sharesUnit(
  actor: { unitIds?: string[]; selectedUnitId?: string; role?: UserRole; email?: string } | null | undefined,
  target: { unitIds?: string[]; selectedUnitId?: string; role?: UserRole; email?: string; unitId?: string } | null | undefined
): boolean {
  if (!actor || !target) return false;
  
  // Super Admin tem acesso global a todas as unidades
  if (actor.role === UserRole.SUPER_ADMIN || actor.email === 'viniciusladeialara@gmail.com') {
    return true;
  }

  const actorUnits = actor.unitIds && actor.unitIds.length > 0 
    ? actor.unitIds 
    : (actor.selectedUnitId ? [actor.selectedUnitId] : ['caceres']);
    
  let targetUnits: string[] = [];
  if (target.unitIds && target.unitIds.length > 0) {
    targetUnits = target.unitIds;
  } else if (target.unitId) {
    targetUnits = [target.unitId];
  } else if (target.selectedUnitId) {
    targetUnits = [target.selectedUnitId];
  } else {
    targetUnits = ['caceres'];
  }

  return actorUnits.some(id => targetUnits.includes(id));
}

/**
 * Middleware centralizado de controle de acesso a usuários e professores
 * Baseado na Matriz de Permissões da documentação Estrutura de Papéis.md
 */
export function canManageUser(
  actor: (UserWithRole | { uid: string; email?: string; role: UserRole; unitIds?: string[]; selectedUnitId?: string }) | null | undefined,
  target: (UserWithRole & { id?: string; unitId?: string }) | null | undefined,
  action: 'create' | 'edit' | 'delete' = 'edit'
): boolean {
  if (!actor || !target) return false;

  const isActorSuperAdmin = actor.role === UserRole.SUPER_ADMIN || actor.email === 'viniciusladeialara@gmail.com';

  // 1. SUPER_ADMIN pode gerenciar qualquer um (exceto auto-exclusão para evitar lock-out)
  if (isActorSuperAdmin) {
    if (action === 'delete' && (actor.uid === target.uid || actor.uid === target.id)) {
      return false;
    }
    return true;
  }

  // 2. ADMIN só gerencia usuários das suas unidades permitidas
  if (actor.role === UserRole.ADMIN) {
    // ADMIN não pode alterar ou excluir SUPER_ADMIN ou outros ADMINs
    if (target.role === UserRole.SUPER_ADMIN || target.role === UserRole.ADMIN) {
      if (action === 'edit' && (actor.uid === target.uid || actor.uid === target.id)) {
        return true;
      }
      return false;
    }

    // Deve compartilhar ao menos uma unidade atribuída
    return sharesUnit(actor, target);
  }

  // 3. USUARIO comum só gerencia professores da própria unidade
  if (actor.role === UserRole.USER) {
    if (target.role === UserRole.PROFESSOR) {
      return sharesUnit(actor, target);
    }
    return false;
  }

  return false;
}
