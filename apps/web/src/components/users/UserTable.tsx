import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Calendar, Activity, Edit, Trash2, Crown, Shield, UserCheck, User, Users, CheckCircle, XCircle } from "lucide-react";
import { UserRole, UserWithRole, UserStatus } from "@/lib/UserRoles";
import { PermissionGuard } from "@/components/PermissionGuard";

interface UserTableProps {
  users: (UserWithRole & { id: string })[];
  currentUserId?: string;
  schools: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  canEditUser?: (user: UserWithRole & { id: string }) => boolean;
  canDeleteUser?: (user: UserWithRole & { id: string }) => boolean;
  canManageUserRole?: (role: UserRole) => boolean;
  onEdit: (user: UserWithRole & { id: string }) => void;
  onDelete: (userId: string, userEmail: string) => void;
  formatDate: (date: any) => string;
}

export function UserTable({ 
  users, 
  currentUserId, 
  schools, 
  teachers, 
  canEditUser,
  canDeleteUser,
  canManageUserRole, 
  onEdit, 
  onDelete,
  formatDate
}: UserTableProps) {
  
  const getRoleIcon = (role: UserRole) => {
    if (role === UserRole.SUPER_ADMIN) return <Crown className="h-4 w-4 text-purple-600 animate-pulse" />;
    if (role === UserRole.ADMIN) return <Crown className="h-4 w-4 text-yellow-500" />;
    if (role === UserRole.PARTNER_SCHOOL) return <Shield className="h-4 w-4 text-emerald-500" />;
    if (role === UserRole.PROFESSOR) return <UserCheck className="h-4 w-4 text-amber-500" />;
    return <User className="h-4 w-4 text-blue-500" />;
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    if (role === UserRole.SUPER_ADMIN) return 'default';
    if (role === UserRole.ADMIN) return 'default';
    if (role === UserRole.PARTNER_SCHOOL) return 'outline';
    return 'secondary';
  };

  const getRoleLabel = (role: UserRole) => {
    switch(role) {
      case UserRole.SUPER_ADMIN: return 'Super Administrador';
      case UserRole.ADMIN: return 'Administrador';
      case UserRole.PARTNER_SCHOOL: return 'Escola Parceira';
      case UserRole.PROFESSOR: return 'Professor';
      default: return 'Usuário';
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted-foreground/[0.02]">
          <TableHead className="w-[30%]">Usuário</TableHead>
          <TableHead className="w-[20%] text-center">Perfil / Vínculo</TableHead>
          <TableHead className="w-[15%] text-center">Status</TableHead>
          <TableHead className="w-[20%] text-center">Acesso</TableHead>
          <TableHead className="w-[15%] text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <Users className="h-8 w-8 opacity-20" />
                <p>Nenhum usuário encontrado</p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{user.name || 'Nome não definido'}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-center gap-1">
                  <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center gap-1 w-fit">
                    {getRoleIcon(user.role)}
                    {getRoleLabel(user.role)}
                  </Badge>
                  {(user.escolaId || user.teacherId) && (
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight text-center max-w-[120px] truncate">
                      {user.escolaId ? schools.find(s => s.id === user.escolaId)?.name || user.escolaId : teachers.find(t => t.id === user.teacherId)?.name || user.teacherId}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex flex-col items-center gap-1">
                  {user.status === UserStatus.INVITED ? (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 capitalize font-bold text-[10px]">
                      <Mail className="h-3 w-3" /> Convidado
                    </Badge>
                  ) : user.status === UserStatus.BLOCKED ? (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1 capitalize font-bold text-[10px]">
                      <XCircle className="h-3 w-3" /> Bloqueado
                    </Badge>
                  ) : (user.status === UserStatus.INACTIVE || user.isActive === false) ? (
                    <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 gap-1 capitalize font-bold text-[10px]">
                      <CheckCircle className="h-3 w-3 opacity-50" /> Inativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 capitalize font-bold text-[10px]">
                      <CheckCircle className="h-3 w-3" /> Ativo
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
                  {user.lastLogin ? (
                    <div className="flex items-center gap-1" title="Último login">
                      <Activity className="h-3 w-3 text-primary" />
                      <span className="font-medium">{formatDate(user.lastLogin)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 opacity-50">
                      <Activity className="h-3 w-3" />
                      <span>Nunca</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 opacity-60 scale-90" title="Criado em">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(user.createdAt)}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <PermissionGuard module="users" action="edit">
                    {(canEditUser ? canEditUser(user) : canManageUserRole ? canManageUserRole(user.role) : false) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(user)}
                        title="Editar Usuário"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </PermissionGuard>
                  
                  <PermissionGuard module="users" action="delete">
                    {(canDeleteUser ? canDeleteUser(user) : canManageUserRole ? canManageUserRole(user.role) : false) && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(user.id, user.email)}
                        disabled={user.id === currentUserId}
                        title="Excluir Usuário"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </PermissionGuard>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
