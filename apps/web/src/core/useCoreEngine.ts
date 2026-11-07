import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ModuleRegistry } from './ModuleRegistry';
import { ModuleDefinition, CategoryGroup } from './types';
import { useSearchParams } from 'react-router-dom';

export interface UseCoreEngineReturn {
  activeModuleId: string;
  setActiveModuleId: (id: string) => void;
  authorizedModules: ModuleDefinition[];
  navGroups: {
    category: CategoryGroup;
    modules: ModuleDefinition[];
  }[];
  currentModuleDef: ModuleDefinition | undefined;
  canAccess: (moduleId: string) => boolean;
}

export function useCoreEngine(): UseCoreEngineReturn {
  const { currentUser } = useAuth();
  const { userRole, userData, isUserSuperAdmin } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  const isSuperAdmin = isUserSuperAdmin();

  // 1. Obter módulos autorizados para o usuário corrente
  const authorizedModules = useMemo(() => {
    return ModuleRegistry.getModulesForUser(userRole, userData, isSuperAdmin);
  }, [userRole, userData, isSuperAdmin]);

  // 2. Agrupamento por categoria para o menu lateral
  const navGroups = useMemo(() => {
    return ModuleRegistry.groupModulesByCategory(authorizedModules);
  }, [authorizedModules]);

  // 3. Determinar módulo inicial padrão (Dashboard / Visão Geral como prioridade absoluta)
  const defaultModuleId = useMemo(() => {
    if (userRole === 'PROFESSOR') return 'teacher-week';
    if (userRole === 'PARTNER_SCHOOL') return 'partner-tracking';
    
    // Para administradores, usuários operacionais e qualquer perfil com acesso,
    // a tela inicial após login DEVE SEMPRE ser o Dashboard principal ('overview')
    if (authorizedModules.length > 0) {
      const hasOverview = authorizedModules.some(m => m.id === 'overview');
      if (hasOverview) return 'overview';
      return authorizedModules[0]?.id || 'overview';
    }
    return 'overview';
  }, [userRole, authorizedModules]);

  // 4. Estado do módulo ativo com suporte a query param (?module=xyz)
  const initialModuleParam = searchParams.get('module');
  const [activeModuleId, setActiveModuleIdState] = useState<string>(
    initialModuleParam || defaultModuleId
  );

  // Sincronizar parâmetro da URL caso mude
  useEffect(() => {
    const param = searchParams.get('module');
    if (param && param !== activeModuleId) {
      setActiveModuleIdState(param);
    }
  }, [searchParams, activeModuleId]);

  // Garantir que o módulo selecionado seja válido e acessível pelo usuário
  useEffect(() => {
    if (authorizedModules.length === 0) return;

    const isCurrentValid = authorizedModules.some(m => m.id === activeModuleId);
    if (!isCurrentValid) {
      // Se não for válido, redireciona para o primeiro módulo permitido
      const fallback = defaultModuleId;
      setActiveModuleIdState(fallback);
    }
  }, [authorizedModules, activeModuleId, defaultModuleId]);

  const setActiveModuleId = useCallback((id: string) => {
    setActiveModuleIdState(id);
    const url = new URL(window.location.href);
    if (url.searchParams.has('module')) {
      url.searchParams.delete('module');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const currentModuleDef = useMemo(() => {
    return ModuleRegistry.getModule(activeModuleId);
  }, [activeModuleId]);

  const canAccess = useCallback((moduleId: string): boolean => {
    return authorizedModules.some(m => m.id === moduleId);
  }, [authorizedModules]);

  return {
    activeModuleId,
    setActiveModuleId,
    authorizedModules,
    navGroups,
    currentModuleDef,
    canAccess
  };
}
