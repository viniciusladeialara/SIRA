import React from 'react';
import { ModuleRegistry } from './ModuleRegistry';
import { ModuleDefinition } from './types';
import { UserRole } from '@/lib/UserRoles';
import {
  LayoutDashboard,
  Crown,
  User,
  Users,
  BookOpen,
  MapPin,
  CalendarRange,
  ShieldAlert,
  ArrowRightLeft,
  GraduationCap,
  Shirt,
  ExternalLink,
  FileText,
  Settings,
  Cpu,
  Wrench,
  Sparkles
} from 'lucide-react';

// Lazy loading dos módulos
const OverviewCharts = React.lazy(() => import('@/components/modules/OverviewCharts').then(m => ({ default: m.OverviewCharts })));
const CoreEventosAdminModule = React.lazy(() => import('@/modules/core-eventos').then(m => ({ default: m.CoreEventosAdminModule })));
const UserManagementModule = React.lazy(() => import('@/components/modules/UserManagementModule').then(m => ({ default: m.UserManagementModule })));
const TeacherIssueModule = React.lazy(() => import('@/components/modules/TeacherIssueModule').then(m => ({ default: m.TeacherIssueModule })));
const ProfessorModule = React.lazy(() => import('@/components/modules/ProfessorModule').then(m => ({ default: m.ProfessorModule })));
const ClassModule = React.lazy(() => import('@/components/modules/ClassModule').then(m => ({ default: m.ClassModule })));
const CourseModule = React.lazy(() => import('@/components/modules/CourseModule'));
const EnvironmentModule = React.lazy(() => import('@/components/modules/EnvironmentModule').then(m => ({ default: m.EnvironmentModule })));
const ScheduleModule = React.lazy(() => import('@/components/modules/ScheduleModule').then(m => ({ default: m.ScheduleModule })));
const ConflictModule = React.lazy(() => import('@/components/modules/ConflictModule').then(m => ({ default: m.ConflictModule })));
const ScheduleSwapAnalyticsModule = React.lazy(() => import('@/components/modules/ScheduleSwapAnalyticsModule').then(m => ({ default: m.ScheduleSwapAnalyticsModule })));
const TeacherAllocationModule = React.lazy(() => import('@/components/modules/TeacherAllocationModule'));
const TeacherMonitoringModule = React.lazy(() => import('@/components/modules/TeacherMonitoringModule').then(m => ({ default: m.TeacherMonitoringModule })));
const UniformsModule = React.lazy(() => import('@/components/modules/UniformsModule').then(m => ({ default: m.UniformsModule })));
const AssetModule = React.lazy(() => import('@/components/modules/AssetModule').then(m => ({ default: m.AssetModule })));
const PartnerSchoolModule = React.lazy(() => import('@/components/modules/PartnerSchoolModule').then(m => ({ default: m.PartnerSchoolModule })));
const ReportModule = React.lazy(() => import('@/components/modules/ReportModule').then(m => ({ default: m.ReportModule })));
const SystemSettingsModule = React.lazy(() => import('@/components/modules/SystemSettingsModule').then(m => ({ default: m.SystemSettingsModule })));
const TeacherDashboardModule = React.lazy(() => import('@/components/modules/TeacherDashboardModule').then(m => ({ default: m.TeacherDashboardModule })));
const CoreDemoModule = React.lazy(() => import('@/components/modules/CoreDemoModule'));

// Lista de definições de módulos
export const APP_MODULES: ModuleDefinition[] = [
  // --- OUTROS / PRINCIPAL ---
  {
    id: 'overview',
    title: 'Visão Geral (Overview)',
    description: 'Indicadores gerais e métricas do ecossistema',
    icon: LayoutDashboard,
    category: 'outros',
    order: 1,
    defaultRoles: [UserRole.ADMIN, UserRole.USER],
    component: OverviewCharts
  },

  // --- CADASTROS GERAIS ---
  {
    id: 'user-management',
    title: 'Usuários(as)',
    description: 'Gestão de permissões, papéis e acessos',
    icon: Crown,
    category: 'cadastros',
    order: 10,
    defaultRoles: [UserRole.ADMIN],
    component: UserManagementModule
  },
  {
    id: 'professors',
    title: 'Professores(as)',
    description: 'Quadro docente e especialidades',
    icon: User,
    category: 'cadastros',
    order: 20,
    defaultRoles: [UserRole.ADMIN, UserRole.USER],
    component: ProfessorModule
  },
  {
    id: 'classes',
    title: 'Turmas',
    description: 'Turmas cadastradas e seus cronogramas',
    icon: Users,
    category: 'cadastros',
    order: 30,
    defaultRoles: [UserRole.ADMIN, UserRole.USER],
    component: ClassModule
  },
  {
    id: 'courses',
    title: 'Cursos',
    description: 'Matrizes curriculares e unidades curriculares',
    icon: BookOpen,
    category: 'cadastros',
    order: 40,
    defaultRoles: [UserRole.ADMIN, UserRole.USER],
    component: CourseModule
  },
  {
    id: 'environments',
    title: 'Ambientes',
    description: 'Salas, laboratórios e blocos de ensino',
    icon: MapPin,
    category: 'cadastros',
    order: 50,
    defaultRoles: [UserRole.ADMIN, UserRole.USER],
    component: EnvironmentModule
  },

  // --- GESTÃO EDUCACIONAL ---
  {
    id: 'schedules',
    title: 'Agendamentos',
    description: 'Grade de horários e planejamento de aulas',
    icon: CalendarRange,
    category: 'gestao',
    order: 10,
    defaultRoles: [UserRole.ADMIN, UserRole.USER],
    component: ScheduleModule
  },
  {
    id: 'conflicts',
    title: 'Conflitos',
    description: 'Central de detecção e conciliação de colisões',
    icon: ShieldAlert,
    category: 'gestao',
    order: 20,
    defaultRoles: [UserRole.ADMIN, UserRole.USER],
    component: ConflictModule,
    badge: (ctx) => (ctx.pendingConflictsCount > 0 ? ctx.pendingConflictsCount : null)
  },
  {
    id: 'swaps',
    title: 'Trocas',
    description: 'Permutas e substituições de turnos',
    icon: ArrowRightLeft,
    category: 'gestao',
    order: 30,
    defaultRoles: [UserRole.ADMIN, UserRole.USER, UserRole.PROFESSOR],
    component: ScheduleSwapAnalyticsModule
  },
  {
    id: 'teacher-allocation',
    title: 'Alocação Docente',
    description: 'Distribuição e carga horária dos professores',
    icon: CalendarRange,
    category: 'gestao',
    order: 40,
    defaultRoles: [UserRole.ADMIN],
    component: TeacherAllocationModule
  },
  {
    id: 'teacher-monitoring',
    title: 'Acompanhamento Docente',
    description: 'Avaliações pedagógicas e desenvolvimento profissional',
    icon: GraduationCap,
    category: 'gestao',
    order: 50,
    superAdminOnly: true,
    defaultRoles: [UserRole.ADMIN],
    component: TeacherMonitoringModule
  },
  {
    id: 'teacher-week',
    title: 'Minha Semana',
    description: 'Cronograma semanal personalizado do professor',
    icon: CalendarRange,
    category: 'gestao',
    order: 60,
    defaultRoles: [UserRole.PROFESSOR],
    exactRolesOnly: true,
    component: TeacherDashboardModule,
    defaultProps: { initialSection: 'scheduling' }
  },
  {
    id: 'partner-tracking',
    title: 'Acompanhamento',
    description: 'Visão de turmas e presenças para escolas parceiras',
    icon: Users,
    category: 'gestao',
    order: 70,
    defaultRoles: [UserRole.PARTNER_SCHOOL],
    exactRolesOnly: true,
    component: PartnerSchoolModule
  },

  // --- LOGÍSTICA & RECURSOS ---
  {
    id: 'uniforms',
    title: 'Uniformes & EPIs',
    description: 'Controle de estoque e movimentações de vestuário',
    icon: Shirt,
    category: 'logistica',
    order: 10,
    defaultRoles: [UserRole.ADMIN, UserRole.USER],
    component: UniformsModule
  },
  {
    id: 'assets',
    title: 'Gestão de Ativos',
    description: 'Equipamentos e manutenções de ambientes',
    icon: ShieldAlert,
    category: 'logistica',
    order: 20,
    defaultRoles: [UserRole.ADMIN, UserRole.USER],
    component: AssetModule,
    defaultProps: { initialTab: 'usage' }
  },
  {
    id: 'report-issue',
    title: 'Reportar Problema',
    description: 'Chamados para manutenção de salas e equipamentos',
    icon: Wrench,
    category: 'logistica',
    order: 30,
    defaultRoles: [UserRole.ADMIN],
    component: TeacherIssueModule
  },

  // --- RELATÓRIOS & INTELIGÊNCIA ---
  {
    id: 'diary-import',
    title: 'Importação Diário',
    description: 'Integração de frequências e dados acadêmicos',
    icon: ExternalLink,
    category: 'relatorios',
    order: 10,
    defaultRoles: [UserRole.ADMIN, UserRole.USER],
    component: PartnerSchoolModule
  },
  {
    id: 'reports',
    title: 'Relatórios',
    description: 'Relatórios operacionais e exportação para Excel',
    icon: FileText,
    category: 'relatorios',
    order: 20,
    defaultRoles: [UserRole.ADMIN, UserRole.USER],
    component: ReportModule
  },
  {
    id: 'core-eventos',
    title: 'CORE Eventos (BI)',
    description: 'Importação de formulários, governança e BI de eventos SENAI',
    icon: Sparkles,
    category: 'relatorios',
    order: 25,
    defaultRoles: [UserRole.ADMIN, UserRole.USER],
    component: CoreEventosAdminModule
  },

  // --- MOTOR & GOVERNANÇA (SISTEMA) ---
  {
    id: 'core-demo',
    title: 'Diagnóstico do Core & Exemplo',
    description: 'Laboratório de falhas e status da arquitetura micro-kernel',
    icon: Cpu,
    category: 'sistema',
    order: 5,
    defaultRoles: [UserRole.ADMIN],
    component: CoreDemoModule
  },
  {
    id: 'system-settings',
    title: 'Configurações do Sistema',
    description: 'Parâmetros globais de funcionamento',
    icon: Settings,
    category: 'sistema',
    order: 10,
    defaultRoles: [UserRole.ADMIN],
    component: SystemSettingsModule
  }
];

// Função de inicialização e auto-registro
export function initModuleRegistry(): void {
  APP_MODULES.forEach((mod) => {
    ModuleRegistry.registerModule(mod);
  });
}

// Auto-inicializar na carga do módulo
initModuleRegistry();
