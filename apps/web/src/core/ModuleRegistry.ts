import { UserRole, UserWithRole } from '@/lib/UserRoles';
import { ModuleDefinition, ModuleCategory, CategoryGroup } from './types';
import { Settings, School, Package, FileText, LayoutDashboard, Cpu } from 'lucide-react';

export const CATEGORY_DEFINITIONS: Record<ModuleCategory, CategoryGroup> = {
  cadastros: {
    id: 'cadastros',
    label: 'Cadastros Gerais',
    icon: Settings,
    order: 1
  },
  gestao: {
    id: 'gestao',
    label: 'Gestão Educacional',
    icon: School,
    order: 2
  },
  logistica: {
    id: 'logistica',
    label: 'Logística & Recursos',
    icon: Package,
    order: 3
  },
  relatorios: {
    id: 'relatorios',
    label: 'Relatórios & Inteligência',
    icon: FileText,
    order: 4
  },
  sistema: {
    id: 'sistema',
    label: 'Motor & Governança',
    icon: Cpu,
    order: 5
  },
  outros: {
    id: 'outros',
    label: 'Outros Recursos',
    icon: LayoutDashboard,
    order: 6
  }
};

class ModuleRegistryClass {
  private modules: Map<string, ModuleDefinition> = new Map();

  /**
   * Registra um novo módulo no catálogo do Core
   */
  public registerModule(module: ModuleDefinition): void {
    if (this.modules.has(module.id)) {
      console.warn(`[ModuleRegistry] Módulo com ID "${module.id}" já registrado. Atualizando definição.`);
    }
    this.modules.set(module.id, module);
  }

  /**
   * Remove um módulo registrado
   */
  public unregisterModule(id: string): boolean {
    return this.modules.delete(id);
  }

  /**
   * Retorna a definição de um módulo específico
   */
  public getModule(id: string): ModuleDefinition | undefined {
    return this.modules.get(id);
  }

  /**
   * Retorna todos os módulos registrados ordenados por categoria e ordem
   */
  public getAllModules(): ModuleDefinition[] {
    return Array.from(this.modules.values()).sort((a, b) => {
      const catOrderA = CATEGORY_DEFINITIONS[a.category]?.order ?? 99;
      const catOrderB = CATEGORY_DEFINITIONS[b.category]?.order ?? 99;
      if (catOrderA !== catOrderB) return catOrderA - catOrderB;
      return (a.order ?? 50) - (b.order ?? 50);
    });
  }

  /**
   * Retorna a lista de módulos que o usuário logado tem permissão para acessar
   * Suporta permissões estáticas por Role e liberação dinâmica pontual por usuário (allowedModules)
   */
  public getModulesForUser(
    userRole: UserRole | null,
    userData: UserWithRole | null,
    isSuperAdmin: boolean = false
  ): ModuleDefinition[] {
    const all = this.getAllModules();

    return all.filter((module) => {
      // 1. Módulos restritos ao Super Admin
      if (module.superAdminOnly && !isSuperAdmin) {
        return false;
      }

      // 2. Módulos bloqueados explicitamente para este usuário no banco
      if (userData?.blockedModules && userData.blockedModules.includes(module.id)) {
        return false;
      }

      // 3. Módulos liberados explicitamente para este usuário no banco (override dinâmico)
      if (userData?.allowedModules && userData.allowedModules.includes(module.id)) {
        return true;
      }

      // 4. Módulos com restrição estrita de perfil (ex: apenas PROFESSOR)
      // Não fazem sentido para outros perfis e não devem aparecer nem para o Super Admin
      if (module.exactRolesOnly) {
        return userRole ? module.defaultRoles.includes(userRole) : false;
      }

      // 5. Se for Super Admin, tem acesso aos demais módulos administrativos/gerais não bloqueados
      if (isSuperAdmin) {
        return true;
      }

      // 5. Verificação padrão baseada no perfil (Role)
      if (userRole && module.defaultRoles.includes(userRole)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Agrupa uma lista de módulos por suas respectivas categorias
   */
  public groupModulesByCategory(modules: ModuleDefinition[]): {
    category: CategoryGroup;
    modules: ModuleDefinition[];
  }[] {
    const groupsMap = new Map<ModuleCategory, ModuleDefinition[]>();

    modules.forEach((mod) => {
      const current = groupsMap.get(mod.category) || [];
      current.push(mod);
      groupsMap.set(mod.category, current);
    });

    return Object.keys(CATEGORY_DEFINITIONS)
      .map((catKey) => {
        const cat = catKey as ModuleCategory;
        const catModules = groupsMap.get(cat) || [];
        return {
          category: CATEGORY_DEFINITIONS[cat],
          modules: catModules.sort((a, b) => (a.order ?? 50) - (b.order ?? 50))
        };
      })
      .filter((g) => g.modules.length > 0);
  }
}

export const ModuleRegistry = new ModuleRegistryClass();
