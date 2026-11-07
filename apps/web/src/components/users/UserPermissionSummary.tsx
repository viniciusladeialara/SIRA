import React from "react";
import { Info, ShieldCheck, Users, Activity, Calendar, BookOpen, UserCheck, CheckCircle, Edit, Shield } from "lucide-react";
import { UserRole, UserScope } from "@/lib/UserRoles";
import { Badge } from "@/components/ui/badge";

interface UserPermissionSummaryProps {
  role: UserRole;
  scope: UserScope;
  teachers: { id: string; name: string }[];
  schools: { id: string; name: string }[];
}

export function UserPermissionSummary({ role, scope, teachers, schools }: UserPermissionSummaryProps) {
  const permissions = {
    [UserRole.ADMIN]: [
      { icon: <ShieldCheck className="h-4 w-4" />, label: "Controle total do sistema" },
      { icon: <Users className="h-4 w-4" />, label: "Gestão completa de usuários" },
      { icon: <Activity className="h-4 w-4" />, label: "Acesso a logs de auditoria" }
    ],
    [UserRole.USER]: [
      { icon: <Calendar className="h-4 w-4" />, label: "Gestão de agendamentos" },
      { icon: <BookOpen className="h-4 w-4" />, label: "Gestão de cursos e turmas" },
      { icon: <UserCheck className="h-4 w-4" />, label: "Operação de professores" }
    ],
    [UserRole.PROFESSOR]: [
      { icon: <Activity className="h-4 w-4" />, label: "Dashboard do professor" },
      { icon: <Calendar className="h-4 w-4" />, label: "Visualização de horários" },
      { icon: <Edit className="h-4 w-4" />, label: "Solicitação de trocas" }
    ],
    [UserRole.PARTNER_SCHOOL]: [
      { icon: <CheckCircle className="h-4 w-4" />, label: "Acompanhamento de frequência" },
      { icon: <BookOpen className="h-4 w-4" />, label: "Visualização de conteúdos" },
      { icon: <Shield className="h-4 w-4" />, label: "Acesso restrito à unidade" }
    ]
  };

  const currentPermissions = permissions[role] || [];

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 p-4 rounded-lg border border-border space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Info className="h-3 w-3" /> Resumo de Permissões
        </p>
        <div className="grid grid-cols-1 gap-1">
          {currentPermissions.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              {p.icon}
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
          <ShieldCheck className="h-3 w-3" /> Escopo de Acesso
        </p>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Nível:</span>
            <Badge variant="outline" className="capitalize">{scope.level}</Badge>
          </div>
          {scope.level === 'restricted' && (
            <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-blue-100 dark:border-blue-900/20">
              {scope.teacherId && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vínculo:</span>
                  <span className="font-medium truncate max-w-[150px]">
                    {teachers.find(t => t.id === scope.teacherId)?.name || 'Professor'}
                  </span>
                </div>
              )}
              {scope.schoolIds && scope.schoolIds.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Escolas:</span>
                  <span className="font-medium truncate max-w-[150px]">
                    {scope.schoolIds.map(id => schools.find(s => s.id === id)?.name || id).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
