import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { UserRole, UserWithRole, UserScope, UserStatus, sharesUnit, canManageUser } from '@/lib/UserRoles';
import { logAction, AuditAction } from '@/lib/AuditLog';
import { db, auth } from "@/lib/db";
import { collection, onSnapshot, updateDoc, deleteDoc, doc, getDocs, setDoc } from "@/lib/sira-sql-adapter";

import { httpsCallable } from "@/lib/sira-functions-adapter";
import { functions } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PermissionGuard } from '@/components/PermissionGuard';
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";

// Novos componentes
import { UserFilters } from '@/components/users/UserFilters';
import { UserStats } from '@/components/users/UserStats';
import { UserTable } from '@/components/users/UserTable';
import { UserCreateDialog } from '@/components/users/UserCreateDialog';
import { UserEditDialog } from '@/components/users/UserEditDialog';

interface CreateUserResponse {
  success?: boolean;
  status?: string;
  message?: string;
  uid?: string;
}

export function UserManagementModule() {
  const { currentUser } = useAuth();
  const { userRole, isUserAdmin, isUserSuperAdmin, canCreate, canEdit, canDelete, userData } = usePermissions();
  const selectedUnitId = userData?.selectedUnitId || "caceres";
  const [users, setUsers] = useState<(UserWithRole & { id: string })[]>([]);
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: UserRole.USER, escolaId: '', teacherId: '', unitIds: ['caceres'] as string[] });
  const [units, setUnits] = useState<{id: string, name: string}[]>([]);
  const isSuperAdmin = isUserSuperAdmin();

  // Unidades permitidas para gestão (Super Admin: todas; Admin: somente atribuídas)
  const allowedUnits = useMemo(() => {
    if (isSuperAdmin) return units;
    const adminUnitIds = userData?.unitIds && userData.unitIds.length > 0 ? userData.unitIds : [selectedUnitId];
    return units.filter(u => adminUnitIds.includes(u.id));
  }, [isSuperAdmin, units, userData, selectedUnitId]);

  const [editingUser, setEditingUser] = useState<(UserWithRole & { id: string }) | null>(null);
  const [schools, setSchools] = useState<{id: string, name: string}[]>([]);
  const [teachers, setTeachers] = useState<{id: string, name: string}[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shouldInvite, setShouldInvite] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const allUsers = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (UserWithRole & { id: string })[];

      const usersData = allUsers.filter(user => 
        user.role !== UserRole.PROFESSOR && 
        user.email !== 'viniciusladeialara@gmail.com'
      );

      usersData.sort((a, b) => {
        const getTimestamp = (val: any) => {
          if (!val) return 0;
          if (val && typeof val.toDate === 'function') return val.toDate().getTime();
          return new Date(val).getTime();
        };
        return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
      });
      setUsers(usersData);
      toast({ title: "Atualizado!", description: "Lista de usuários sincronizada com o banco de dados." });
    } catch (err) {
      console.error("Erro ao sincronizar usuários:", err);
      toast({ title: "Erro", description: "Falha ao recarregar usuários.", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Carregar usuários
  useEffect(() => {
    if (!isUserAdmin()) return;
    const usersCollection = collection(db, 'users');
    const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (UserWithRole & { id: string })[];
      
      // Filter out PROFESSOR role and the super admin to prevent modification
      const usersData = allUsers.filter(user => 
        user.role !== UserRole.PROFESSOR && 
        user.email !== 'viniciusladeialara@gmail.com'
      );
      
      usersData.sort((a, b) => {
        const getTimestamp = (val: any) => {
          if (!val) return 0;
          if (val && typeof val.toDate === 'function') return val.toDate().getTime();
          return new Date(val).getTime();
        };
        return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
      });
      setUsers(usersData);
    }, (error) => {
      console.error('Erro ao carregar usuários:', error);
      toast({ title: "Erro", description: "Erro ao carregar lista de usuários.", variant: "destructive" });
    });
    return unsubscribe;
  }, [isUserAdmin, toast]);

  // Carregar Escolas, Professores e Unidades (Sob demanda com getDocs para economia de custos)
  useEffect(() => {
    if (!isUserAdmin()) return;

    const loadMetadata = async () => {
      try {
        const [schoolsSnap, teachersSnap, unitsSnap] = await Promise.all([
          getDocs(collection(db, 'schools')),
          getDocs(collection(db, 'teachers')),
          getDocs(collection(db, 'units'))
        ]);
        setSchools(schoolsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
        setTeachers(teachersSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
        setUnits(unitsSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
      } catch (err) {
        console.error("Erro ao carregar metadados em UserManagementModule:", err);
      }
    };

    loadMetadata();
  }, [isUserAdmin]);


  const getAvailableRoles = (currentEditingRole?: UserRole) => {
    if (isSuperAdmin) return [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER, UserRole.PARTNER_SCHOOL];
    if (userRole === UserRole.ADMIN) {
      if (currentEditingRole === UserRole.ADMIN) {
        return [UserRole.ADMIN, UserRole.USER, UserRole.PARTNER_SCHOOL];
      }
      return [UserRole.USER, UserRole.PARTNER_SCHOOL];
    }
    return [];
  };

  const canEditUser = (targetUser: UserWithRole & { id: string }) => {
    return canManageUser(
      userData || (currentUser ? { uid: currentUser.uid, role: userRole!, unitIds: [selectedUnitId] } as any : null),
      targetUser,
      'edit'
    );
  };

  const canDeleteUser = (targetUser: UserWithRole & { id: string }) => {
    return canManageUser(
      userData || (currentUser ? { uid: currentUser.uid, role: userRole!, unitIds: [selectedUnitId] } as any : null),
      targetUser,
      'delete'
    );
  };

  const getScopeFromData = (data: Partial<UserWithRole>): UserScope => {
    if (data.role === UserRole.SUPER_ADMIN || data.role === UserRole.ADMIN) return { level: 'global' };
    if (data.role === UserRole.USER) return { level: 'internal' };
    if (data.role === UserRole.PROFESSOR) return { level: 'restricted', teacherId: data.teacherId };
    if (data.role === UserRole.PARTNER_SCHOOL) return { level: 'restricted', schoolIds: data.escolaId ? [data.escolaId] : [] };
    return { level: 'internal' };
  };

  const handleCreateUser = async () => {
    if (!currentUser || !canCreate('users')) return;
    if (!newUser.email || !newUser.name || (!shouldInvite && !newUser.password)) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    if (newUser.role === UserRole.PARTNER_SCHOOL && !newUser.escolaId) {
      toast({ title: "Erro", description: "Selecione uma escola para vincular.", variant: "destructive" });
      return;
    }
    if (newUser.role === UserRole.PROFESSOR && !newUser.teacherId) {
      toast({ title: "Erro", description: "Selecione um professor para vincular.", variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      const createUserFunction = httpsCallable<any, CreateUserResponse>(functions, 'createUser');
      const scope = getScopeFromData(newUser);
      const password = shouldInvite ? Math.random().toString(36).slice(-10) + 'A1!' : newUser.password;

      const createUserResult = await createUserFunction({
        email: newUser.email,
        name: newUser.name,
        password: password,
        role: newUser.role,
        escolaId: newUser.escolaId || null,
        teacherId: newUser.teacherId || null,
        scope,
        invite: shouldInvite,
        status: shouldInvite ? UserStatus.INVITED : UserStatus.ACTIVE,
        unitIds: newUser.unitIds || ['caceres'],
        selectedUnitId: newUser.unitIds?.[0] || 'caceres'
      });

      const isSuccess = createUserResult.data?.success || createUserResult.data?.status === 'success';
      const createdUid = createUserResult.data?.uid;

      if (isSuccess) {
        if (createdUid) {
          try {
            await setDoc(doc(db, 'users', createdUid), {
              unitIds: newUser.unitIds || ['caceres'],
              selectedUnitId: newUser.unitIds?.[0] || 'caceres'
            }, { merge: true });
          } catch (e) {
            console.warn("Aviso ao salvar unidades do usuário no Firestore:", e);
          }
        }

        await logAction(
          shouldInvite ? AuditAction.USER_INVITE_SENT : AuditAction.CREATE_USER,
          currentUser,
          shouldInvite ? `Enviou convite para ${newUser.email}` : `Criou novo usuário: ${newUser.email}`,
          { newUser: { ...newUser, password: '[REDACTED]', scope, status: shouldInvite ? 'invited' : 'active' } }
        );
        toast({ title: "Sucesso", description: `Usuário ${newUser.name} criado com sucesso!` });
        setNewUser({ email: '', name: '', password: '', role: UserRole.USER, escolaId: '', teacherId: '', unitIds: ['caceres'] as string[] });
        setShouldInvite(false);
        setIsCreateDialogOpen(false);
        await handleManualRefresh();
      }
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      toast({ title: "Erro", description: "Erro ao criar usuário.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!currentUser || !editingUser || !canEdit('users') || isUpdating) return;

    if (!canManageUser(userData || { uid: currentUser.uid, role: userRole! } as any, editingUser, 'edit')) {
      toast({ title: "Acesso negado", description: "Você não tem permissão para alterar este usuário ou este usuário pertence a outra unidade.", variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    try {
      const userRef = doc(db, 'users', editingUser.id!);
      const oldData = users.find(u => u.id === editingUser.id);
      const newScope = getScopeFromData(editingUser);

      await updateDoc(userRef, {
        name: editingUser.name,
        role: editingUser.role,
        isActive: editingUser.isActive,
        escolaId: editingUser.escolaId || null,
        teacherId: editingUser.teacherId || null,
        scope: newScope,
        unitIds: editingUser.unitIds || ['caceres'],
        selectedUnitId: editingUser.selectedUnitId || editingUser.unitIds?.[0] || 'caceres',
        allowedModules: editingUser.allowedModules || []
      });

      if (oldData?.role !== editingUser.role) {
        await logAction(AuditAction.USER_ROLE_CHANGED, currentUser, `Alterou perfil de ${editingUser.email}`, { userId: editingUser.id, oldRole: oldData?.role, newRole: editingUser.role });
      }

      // Auditoria imutável para concessão/revogação dinâmica de módulos (PRD Enterprise)
      const oldAllowed = oldData?.allowedModules || [];
      const newAllowed = editingUser.allowedModules || [];
      const isAllowedChanged = oldAllowed.length !== newAllowed.length || !oldAllowed.every(m => newAllowed.includes(m));
      if (isAllowedChanged) {
        await logAction(
          AuditAction.USER_MODULE_PERMISSION_CHANGED,
          currentUser,
          `Alterou concessão de módulos dinâmicos para ${editingUser.email}`,
          {
            userId: editingUser.id,
            email: editingUser.email,
            previousModules: oldAllowed,
            newModules: newAllowed
          }
        );
      }
      toast({ title: "Sucesso", description: "Usuário atualizado com sucesso." });
      setEditingUser(null);
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      toast({ title: "Erro", description: "Erro ao atualizar usuário.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!currentUser || !canDelete('users')) return;

    const targetUser = users.find(u => u.id === userId);
    if (!canManageUser(userData || { uid: currentUser.uid, role: userRole! } as any, targetUser, 'delete')) {
      toast({ title: "Acesso negado", description: "Você não tem permissão para excluir este usuário ou este usuário pertence a outra unidade.", variant: "destructive" });
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir o usuário ${userEmail}?`)) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      await logAction(AuditAction.DELETE_USER, currentUser, `Usuário ${userEmail} excluído`, { userId, userEmail });
      toast({ title: "Sucesso", description: "Usuário excluído com sucesso." });
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast({ title: "Erro", description: "Erro ao excluir usuário.", variant: "destructive" });
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    // Regra de Consulta (docs/Estrutura de Papéis.md):
    // 1. SUPER_ADMIN: visualiza todos os usuários de todas as unidades
    if (isSuperAdmin) {
      if (selectedUnitId && selectedUnitId !== 'all') {
        const userUnits = user.unitIds || (user.selectedUnitId ? [user.selectedUnitId] : []);
        const isGlobal = user.scope?.level === 'global' || user.role === UserRole.SUPER_ADMIN;
        if (!isGlobal && userUnits.length > 0 && !userUnits.includes(selectedUnitId)) {
          return false;
        }
      }
      return matchesSearch && matchesRole;
    }

    // 2. ADMIN: visualiza SOMENTE usuários das unidades autorizadas atribuídas
    const hasSharedUnit = sharesUnit(userData, user);
    if (!hasSharedUnit) return false;

    // E quando uma unidade específica está selecionada no topo, refina para ela
    const userUnits = user.unitIds || (user.selectedUnitId ? [user.selectedUnitId] : []);
    const matchesSelected = userUnits.length === 0 || userUnits.includes(selectedUnitId) || user.selectedUnitId === selectedUnitId;

    return matchesSearch && matchesRole && matchesSelected;
  });

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      const d = (date && typeof date.toDate === 'function') ? date.toDate() : new Date(date);
      return d.toLocaleDateString('pt-BR');
    } catch { return 'Data inválida'; }
  };

  return (
    <PermissionGuard module="users" action="view">
      <PageLayout>
      <PageHeader className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">Gestão de Usuários(as)</h2>
            <p className="text-muted-foreground">Administre contas, permissões e acesso ao sistema</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
              title="Atualizar lista de usuários do banco de dados"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>Atualizar</span>
            </Button>

            <PermissionGuard module="users" action="create">
              <UserCreateDialog
                isOpen={isCreateDialogOpen}
                setIsOpen={setIsCreateDialogOpen}
                newUser={newUser}
                setNewUser={setNewUser}
                shouldInvite={shouldInvite}
                setShouldInvite={setShouldInvite}
                getAvailableRoles={getAvailableRoles}
                schools={schools}
                teachers={teachers}
                getScopeFromData={getScopeFromData}
                onCreate={handleCreateUser}
                isCreating={isCreating}
                units={allowedUnits}
                isSuperAdmin={isSuperAdmin}
              />
            </PermissionGuard>
          </div>
        </div>

        <UserFilters 
          searchTerm={searchTerm} 
          setSearchTerm={setSearchTerm} 
          roleFilter={roleFilter} 
          setRoleFilter={setRoleFilter} 
        />

        <UserStats users={filteredUsers} userRole={userRole!} />
      </PageHeader>

      <PageContent>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lista de Usuários(as)</CardTitle>
            <CardDescription>{filteredUsers.length} usuários nesta unidade</CardDescription>
          </CardHeader>
          <CardContent>
            <UserTable 
              users={filteredUsers}
              currentUserId={currentUser?.uid}
              schools={schools}
              teachers={teachers}
              canEditUser={canEditUser}
              canDeleteUser={canDeleteUser}
              onEdit={(user) => { setEditingUser(user); setIsEditDialogOpen(true); }}
              onDelete={handleDeleteUser}
              formatDate={formatDate}
            />
          </CardContent>
        </Card>

        {editingUser && (
          <UserEditDialog 
            isOpen={isEditDialogOpen}
            setIsOpen={setIsEditDialogOpen}
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            getAvailableRoles={getAvailableRoles}
            schools={schools}
            teachers={teachers}
            getScopeFromData={getScopeFromData}
            onUpdate={handleUpdateUser}
            isUpdating={isUpdating}
            units={allowedUnits}
            isSuperAdmin={isSuperAdmin}
          />
        )}
      </PageContent>
      </PageLayout>
    </PermissionGuard>
  );
}
