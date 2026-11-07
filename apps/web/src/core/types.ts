import React from 'react';
import { UserRole, UserWithRole } from '@/lib/UserRoles';

export type ModuleCategory = 
  | 'cadastros'
  | 'gestao'
  | 'logistica'
  | 'relatorios'
  | 'sistema'
  | 'outros';

export type ModuleStatus = 'active' | 'beta' | 'maintenance' | 'deprecated';

export interface ModuleBadgeContext {
  pendingConflictsCount: number;
  userRole?: UserRole | null;
  userData?: UserWithRole | null;
}

export interface ModuleDefinition {
  /** Identificador único e imutável do módulo */
  id: string;

  /** Nome de exibição na interface e nos menus */
  title: string;

  /** Breve descrição funcional do módulo */
  description?: string;

  /** Ícone para navegação lateral */
  icon: React.ComponentType<{ className?: string }>;

  /** Categoria para organização no menu lateral */
  category: ModuleCategory;

  /** Ordem de precedência dentro do grupo */
  order?: number;

  /** Perfis de acesso padrão */
  defaultRoles: UserRole[];

  /** Restrição exclusiva para a conta Super Admin */
  superAdminOnly?: boolean;

  /** Se verdadeiro, o módulo é estritamente restrito aos perfis em defaultRoles (ex: PROFESSOR), não sendo concedido a outros perfis nem para o Super Admin */
  exactRolesOnly?: boolean;

  /** Componente lazy-loaded do módulo */
  component: React.LazyExoticComponent<React.ComponentType<any>> | React.ComponentType<any>;

  /** Badge opcional ou função geradora de badge (ex: contador de pendências) */
  badge?: string | number | ((ctx: ModuleBadgeContext) => string | number | null | undefined);

  /** Propriedades iniciais a serem passadas para o componente */
  defaultProps?: Record<string, any>;

  /** Estado do ciclo de vida do módulo */
  status?: ModuleStatus;
}

export interface CategoryGroup {
  id: ModuleCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  order: number;
}
