import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Crown, User, UserCheck, Shield } from "lucide-react";
import { UserRole, UserScope } from "@/lib/UserRoles";
import { UserPermissionSummary } from "./UserPermissionSummary";

interface UserCreateDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  newUser: any;
  setNewUser: (user: any) => void;
  shouldInvite: boolean;
  setShouldInvite: (invite: boolean) => void;
  getAvailableRoles: () => UserRole[];
  schools: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  getScopeFromData: (data: any) => UserScope;
  onCreate: () => void;
  isCreating: boolean;
  units: { id: string; name: string }[];
  isSuperAdmin: boolean;
}

export function UserCreateDialog({
  isOpen,
  setIsOpen,
  newUser,
  setNewUser,
  shouldInvite,
  setShouldInvite,
  getAvailableRoles,
  schools,
  teachers,
  getScopeFromData,
  onCreate,
  isCreating,
  units,
  isSuperAdmin
}: UserCreateDialogProps) {
  const availableRoles = getAvailableRoles();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo(a) Usuário(a)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Criar Novo(a) Usuário(a)</DialogTitle>
          <DialogDescription>
            Adicione um novo usuário ao sistema com suas permissões.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="user-email">E-mail</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  placeholder="usuario@exemplo.com"
                />
              </div>
              <div>
                <Label htmlFor="user-name">Nome</Label>
                <Input
                  id="user-name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  placeholder="Nome completo"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                <div className="space-y-0.5">
                  <Label className="text-blue-900 cursor-pointer" htmlFor="invite-toggle">Convidar via E-mail</Label>
                  <p className="text-[10px] text-blue-600/80">O usuário receberá um link para ativar a conta.</p>
                </div>
                <Switch id="invite-toggle" checked={shouldInvite} onCheckedChange={setShouldInvite} />
              </div>

              {!shouldInvite && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="user-password">Senha Inicial</Label>
                  <Input
                    id="user-password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}

              {units && units.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between items-center">
                    <Label>
                      {newUser.role === UserRole.USER ? 'Unidade de Lotação (Única)' : 'Unidades SENAI Permitidas'}
                    </Label>
                    {newUser.role === UserRole.USER && (
                      <span className="text-[10px] text-muted-foreground font-semibold">Operacional pertence a 1 unidade</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    {units.map(u => {
                      const isUserRole = newUser.role === UserRole.USER;
                      const isChecked = newUser.unitIds?.includes(u.id) || false;
                      return (
                        <label key={u.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-100/50 p-1.5 rounded transition-all">
                          <input
                            type={isUserRole ? "radio" : "checkbox"}
                            name="new-user-units"
                            checked={isChecked}
                            onChange={(e) => {
                              if (isUserRole) {
                                setNewUser({ ...newUser, unitIds: [u.id], selectedUnitId: u.id });
                              } else {
                                const current = newUser.unitIds || [];
                                const updated = e.target.checked
                                  ? [...current, u.id]
                                  : current.filter((id: string) => id !== u.id);
                                setNewUser({ ...newUser, unitIds: updated, selectedUnitId: updated[0] || u.id });
                              }
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{u.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="user-role">Perfil</Label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser({...newUser, role: value as UserRole})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.includes(UserRole.SUPER_ADMIN) && (
                      <SelectItem value={UserRole.SUPER_ADMIN}>
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-purple-600" />
                          Super Administrador (Governança Global)
                        </div>
                      </SelectItem>
                    )}
                    {availableRoles.includes(UserRole.ADMIN) && (
                      <SelectItem value={UserRole.ADMIN}>
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4" />
                          Administrador (Controle Total)
                        </div>
                      </SelectItem>
                    )}
                    {availableRoles.includes(UserRole.USER) && (
                      <SelectItem value={UserRole.USER}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Usuário (Acesso Operacional)
                        </div>
                      </SelectItem>
                    )}
                    {availableRoles.includes(UserRole.PARTNER_SCHOOL) && (
                      <SelectItem value={UserRole.PARTNER_SCHOOL}>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Escola Parceira (Acesso Externo)
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {newUser.role === UserRole.PARTNER_SCHOOL && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="new-user-school">Escola Vinculada</Label>
                  <Select value={newUser.escolaId} onValueChange={(v) => setNewUser({...newUser, escolaId: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma escola" /></SelectTrigger>
                    <SelectContent>
                      {schools.length > 0 ? (
                        schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                      ) : (
                        <SelectItem value="none" disabled>Nenhuma escola encontrada</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">O usuário verá apenas dados desta escola.</p>
                </div>
              )}

              {newUser.role === UserRole.PROFESSOR && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="new-user-teacher">Professor Vinculado</Label>
                  <Select value={newUser.teacherId} onValueChange={(v) => setNewUser({...newUser, teacherId: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione um professor" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <UserPermissionSummary 
                role={newUser.role} 
                scope={getScopeFromData(newUser)}
                teachers={teachers}
                schools={schools}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            disabled={isCreating}
          >
            Cancelar
          </Button>
          <Button 
            onClick={onCreate}
            disabled={isCreating}
          >
            {isCreating ? "Criando..." : "Criar Usuário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
