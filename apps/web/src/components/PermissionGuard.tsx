import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { UserRole } from '@/lib/UserRoles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock } from 'lucide-react';

interface PermissionGuardProps {
  children: ReactNode;
  module: string;
  action: 'view' | 'create' | 'edit' | 'delete' | 'export' | 'import';
  fallback?: ReactNode;
}

export function PermissionGuard({ 
  children, 
  module, 
  action, 
  fallback 
}: PermissionGuardProps) {
  const { canView, canCreate, canEdit, canDelete, canExport, canImport, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-muted-foreground">Verificando permissões...</div>
      </div>
    );
  }

  const hasPermission = (() => {
    switch (action) {
      case 'view': return canView(module);
      case 'create': return canCreate(module);
      case 'edit': return canEdit(module);
      case 'delete': return canDelete(module);
      case 'export': return canExport(module);
      case 'import': return canImport(module);
      default: return false;
    }
  })();

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Lock className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-xl">Acesso Negado</CardTitle>
          <CardDescription>
            Você não tem permissão para {action} {module}.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            Entre em contato com um administrador para solicitar acesso.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: ReactNode;
}

export function RoleGuard({ children, allowedRoles, fallback }: RoleGuardProps) {
  const { userRole, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-muted-foreground">Verificando permissões...</div>
      </div>
    );
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-xl">Acesso Restrito</CardTitle>
          <CardDescription>
            Esta área é restrita a usuários com perfil {allowedRoles.join(' ou ')}.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            Seu perfil atual: {userRole || 'Não definido'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
