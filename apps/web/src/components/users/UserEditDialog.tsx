import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, User, UserCheck, Shield } from "lucide-react";
import { UserRole, UserScope, UserWithRole } from "@/lib/UserRoles";
import { UserPermissionSummary } from "./UserPermissionSummary";
import { ModuleRegistry } from "@/core/ModuleRegistry";

interface UserEditDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  editingUser: (UserWithRole & { id: string }) | null;
  setEditingUser: (user: any) => void;
  getAvailableRoles: (currentRole?: UserRole) => UserRole[];
  schools: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  getScopeFromData: (data: any) => UserScope;
  onUpdate: () => void;
  isUpdating: boolean;
  units: { id: string; name: string }[];
  isSuperAdmin: boolean;
}

export function UserEditDialog({
  isOpen,
  setIsOpen,
  editingUser,
  setEditingUser,
  getAvailableRoles,
  schools,
  teachers,
  getScopeFromData,
  onUpdate,
  isUpdating,
  units,
  isSuperAdmin
}: UserEditDialogProps) {
  if (!editingUser) return null;

  const availableRoles = getAvailableRoles(editingUser.role);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize as informações e permissões do usuário.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-user-email">E-mail</Label>
                <Input
                  id="edit-user-email"
                  value={editingUser.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  O e-mail não pode ser alterado
                </p>
              </div>
              <div>
                <Label htmlFor="edit-user-name">Nome</Label>
                <Input
                  id="edit-user-name"
                  value={editingUser.name || ''}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  placeholder="Nome completo"
                />
              </div>

              {units && units.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between items-center">
                    <Label>
                      {editingUser.role === UserRole.USER ? 'Unidade de Lotação (Única)' : 'Unidades SENAI Permitidas'}
                    </Label>
                    {editingUser.role === UserRole.USER && (
                      <span className="text-[10px] text-muted-foreground font-semibold">Operacional pertence a 1 unidade</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    {units.map(u => {
                      const isUserRole = editingUser.role === UserRole.USER;
                      const isChecked = editingUser.unitIds?.includes(u.id) || false;
                      return (
                        <label key={u.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-100/50 p-1.5 rounded transition-all">
                          <input
                            type={isUserRole ? "radio" : "checkbox"}
                            name="edit-user-units"
                            checked={isChecked}
                            onChange={(e) => {
                              if (isUserRole) {
                                setEditingUser({ 
                                  ...editingUser, 
                                  unitIds: [u.id],
                                  selectedUnitId: u.id
                                });
                              } else {
                                const current = editingUser.unitIds || [];
                                const updated = e.target.checked
                                  ? [...current, u.id]
                                  : current.filter((id: string) => id !== u.id);
                                setEditingUser({ 
                                  ...editingUser, 
                                  unitIds: updated,
                                  selectedUnitId: editingUser.selectedUnitId && updated.includes(editingUser.selectedUnitId)
                                    ? editingUser.selectedUnitId
                                    : updated[0] || u.id
                                });
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
                <Label htmlFor="edit-user-role">Perfil</Label>
                <Select 
                  value={editingUser.role} 
                  onValueChange={(value) => setEditingUser({...editingUser, role: value as UserRole})}
                  disabled={!isSuperAdmin && editingUser.role === UserRole.ADMIN}
                >
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
                    {availableRoles.includes(UserRole.PROFESSOR) && (
                      <SelectItem value={UserRole.PROFESSOR}>
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          Professor
                        </div>
                      </SelectItem>
                    )}
                    {availableRoles.includes(UserRole.PARTNER_SCHOOL) && (
                      <SelectItem value={UserRole.PARTNER_SCHOOL}>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Escola Parceira
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {editingUser.role === UserRole.PARTNER_SCHOOL && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="edit-user-school">Escola Vinculada</Label>
                  <Select value={editingUser.escolaId} onValueChange={(v) => setEditingUser({...editingUser, escolaId: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma escola" /></SelectTrigger>
                    <SelectContent>
                      {schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editingUser.role === UserRole.PROFESSOR && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="edit-user-teacher">Professor Vinculado</Label>
                  <Select value={editingUser.teacherId} onValueChange={(v) => setEditingUser({...editingUser, teacherId: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione um professor" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <UserPermissionSummary  
                role={editingUser.role} 
                scope={getScopeFromData(editingUser)}
                teachers={teachers}
                schools={schools}
              />

              {/* Liberação Granular de Módulos (Core Engine) */}
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <Label className="font-bold text-xs">Liberação Dinâmica de Módulos (Core)</Label>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Conceda acesso a módulos adicionais para este usuário além das permissões padrão do perfil:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 max-h-44 overflow-y-auto">
                  {ModuleRegistry.getAllModules()
                    .filter(m => !m.superAdminOnly && (!m.exactRolesOnly || m.defaultRoles.includes(editingUser.role)))
                    .map(mod => {
                      const isGrantedByRole = mod.defaultRoles.includes(editingUser.role);
                      const isExplicitlyAllowed = editingUser.allowedModules?.includes(mod.id);
                      const isChecked = isGrantedByRole || isExplicitlyAllowed;

                      return (
                        <label 
                          key={mod.id} 
                          className={`flex items-center gap-2 p-1.5 rounded text-xs transition-all ${
                            isGrantedByRole 
                              ? 'opacity-65 bg-slate-100/50 dark:bg-slate-800/40 cursor-default' 
                              : 'hover:bg-blue-50/50 dark:hover:bg-slate-800 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isGrantedByRole}
                            checked={isChecked}
                            onChange={(e) => {
                              const current = editingUser.allowedModules || [];
                              const updated = e.target.checked
                                ? [...current, mod.id]
                                : current.filter(id => id !== mod.id);
                              setEditingUser({ ...editingUser, allowedModules: updated });
                            }}
                            className="rounded border-slate-300 text-blue-600 h-3.5 w-3.5 disabled:opacity-50"
                          />
                          <span className="truncate text-slate-700 dark:text-slate-300">{mod.title}</span>
                          {isGrantedByRole && <span className="text-[10px] text-slate-400 font-mono ml-auto">(perfil)</span>}
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-lg border border-border">
                <Switch
                  id="edit-user-active"
                  checked={editingUser.isActive}
                  onCheckedChange={(checked) => setEditingUser({...editingUser, isActive: checked})}
                />
                <Label htmlFor="edit-user-active" className="font-bold">Usuário ativo no sistema</Label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isUpdating}>
            Cancelar
          </Button>
          <Button onClick={onUpdate} disabled={isUpdating}>
            {isUpdating ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
