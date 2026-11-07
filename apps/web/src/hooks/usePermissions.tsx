import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { UserRole, UserWithRole, UserStatus, hasPermission, getModulePermissions } from '@/lib/UserRoles';
import { auth, db } from "@/lib/db";
import { signOut } from "@/lib/sira-auth-adapter";
import { doc, getDoc, updateDoc, onSnapshot } from "@/lib/sira-sql-adapter"; 

/**
 * Hook para gerenciar permissões do usuário
 */
export function usePermissions() {
  const { currentUser } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userData, setUserData] = useState<UserWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setUserRole(null);
      setUserData(null);
      setLoading(false);
      return;
    }

    // Mapeamento imediato a partir do SIRA SQL / PostgreSQL
    const isSuper =
      currentUser.role === 'administrador' ||
      currentUser.perfis?.includes('administrador') ||
      currentUser.email === 'admin@sira.local' ||
      currentUser.email === 'viniciusladeialara@gmail.com';
    const mappedRole = isSuper
      ? UserRole.SUPER_ADMIN
      : currentUser.role === 'professor'
        ? UserRole.PROFESSOR
        : currentUser.role === 'gestor' || currentUser.role === 'coordenador'
          ? UserRole.ADMIN
          : UserRole.USER;

    const unitId =
      currentUser.unidadeId ||
      localStorage.getItem('selected_unit_id') ||
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    const mappedUserData: UserWithRole = {
      uid: currentUser.uid,
      email: currentUser.email,
      name: currentUser.displayName || currentUser.name || 'Administrador SIRA',
      role: mappedRole,
      isActive: true,
      status: UserStatus.ACTIVE,
      selectedUnitId: unitId,
      unitIds: [unitId],
    };

    setUserData(mappedUserData);
    setUserRole(mappedRole);
    setLoading(false);

    // Tentativa opcional de sincronização legada com Firestore sem travar o carregamento
    try {
      const unsubscribe = onSnapshot(
        doc(db, 'users', currentUser.uid),
        async (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data() as UserWithRole;
            if (data) {
              setUserData((prev) => ({ ...prev, ...data }));
              if (data.role) setUserRole(data.role);
            }
          }
        },
        (error) => {
          // Ignora silenciosamente erros de Firestore local
          console.debug('Firestore sync offline, operando em modo SIRA SQL puro.');
        },
      );
      return () => unsubscribe();
    } catch {
      // Modo SIRA SQL puro
    }
  }, [currentUser]);

  // Funções de verificação de permissão
  const canView = useCallback((module: string) => userRole ? hasPermission(userRole, module, 'canView') : false, [userRole]);
  const canCreate = useCallback((module: string) => userRole ? hasPermission(userRole, module, 'canCreate') : false, [userRole]);
  const canEdit = useCallback((module: string) => userRole ? hasPermission(userRole, module, 'canEdit') : false, [userRole]);
  const canDelete = useCallback((module: string) => userRole ? hasPermission(userRole, module, 'canDelete') : false, [userRole]);
  const canExport = useCallback((module: string) => userRole ? hasPermission(userRole, module, 'canExport') : false, [userRole]);
  const canImport = useCallback((module: string) => userRole ? hasPermission(userRole, module, 'canImport') : false, [userRole]);

  // Funções de verificação de role (PRD Enterprise)
  const isUserSuperAdmin = useCallback(() => {
    return userRole === UserRole.SUPER_ADMIN || currentUser?.email === 'viniciusladeialara@gmail.com' || currentUser?.email === 'admin@sira.local';
  }, [userRole, currentUser]);

  const isUserAdmin = useCallback(() => {
    return userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN || currentUser?.email === 'viniciusladeialara@gmail.com' || currentUser?.email === 'admin@sira.local';
  }, [userRole, currentUser]);

  const isUserOperational = useCallback(() => userRole === UserRole.USER, [userRole]);
  const isProfessor = useCallback(() => userRole === UserRole.PROFESSOR, [userRole]);
  const isPartnerSchool = useCallback(() => userRole === UserRole.PARTNER_SCHOOL, [userRole]);

  // Funções de Escopo
  const canAccessSchool = useCallback((schoolId: string) => {
    if (isUserAdmin() || isUserOperational()) return true;
    if (isPartnerSchool()) {
      return userData?.scope?.schoolIds?.includes(schoolId) || userData?.escolaId === schoolId;
    }
    return false;
  }, [isUserAdmin, isUserOperational, isPartnerSchool, userData]);

  const canAccessTeacher = useCallback((teacherId: string) => {
    if (isUserAdmin() || isUserOperational()) return true;
    if (isProfessor()) {
      return userData?.scope?.teacherId === teacherId || userData?.teacherId === teacherId;
    }
    return false;
  }, [isUserAdmin, isUserOperational, isProfessor, userData]);

  const loadUserRole = useCallback(async () => {
    // Escuta em tempo real ativa, recarregamento automático
  }, []);

  const getEffectiveScope = useCallback(() => {
    if (userData?.scope) return userData.scope;
    
    // Fallback para dados legados
    if (isUserAdmin()) return { level: 'global' };
    if (isUserOperational()) return { level: 'internal' };
    if (isPartnerSchool()) return { 
      level: 'restricted', 
      schoolIds: userData?.escolaId ? [userData.escolaId] : [] 
    };
    if (isProfessor()) return { 
      level: 'restricted', 
      teacherId: userData?.teacherId 
    };
    
    return null;
  }, [userData, isUserAdmin, isUserOperational, isPartnerSchool, isProfessor]);



  // Função para obter permissões completas de um módulo
  const getPermissions = useCallback((module: string) => userRole ? getModulePermissions(userRole, module) : {
    canView: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canExport: false,
    canImport: false
  }, [userRole]);

  return useMemo(() => ({
    // Estados
    userRole,
    userData,
    loading,
    
    // Funções de permissão
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport,
    canImport,
    
    // Funções de role
    isUserSuperAdmin,
    isUserAdmin,
    isUserOperational,
    isProfessor,
    isPartnerSchool,
    
    // Escopo
    canAccessSchool,
    canAccessTeacher,
    getEffectiveScope,
    
    // Função geral
    getPermissions,
    
    // Função para recarregar
    reloadUserRole: loadUserRole
  }), [
    userRole, 
    userData, 
    loading, 
    canView, 
    canCreate, 
    canEdit, 
    canDelete, 
    canExport, 
    canImport, 
    isUserSuperAdmin,
    isUserAdmin, 
    isUserOperational, 
    isProfessor, 
    isPartnerSchool, 
    canAccessSchool, 
    canAccessTeacher, 
    getEffectiveScope, 
    getPermissions, 
    loadUserRole
  ]);
}
