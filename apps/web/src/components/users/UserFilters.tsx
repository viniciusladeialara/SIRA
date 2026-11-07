import React from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { UserRole } from "@/lib/UserRoles";

interface UserFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  roleFilter: string;
  setRoleFilter: (value: string) => void;
}

export function UserFilters({ searchTerm, setSearchTerm, roleFilter, setRoleFilter }: UserFiltersProps) {
  return (
    <Card className="border-none shadow-sm bg-muted/20">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-64">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="bg-white">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por Perfil" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Perfis</SelectItem>
                <SelectItem value={UserRole.ADMIN}>Administrador</SelectItem>
                <SelectItem value={UserRole.USER}>Usuário</SelectItem>
                <SelectItem value={UserRole.PARTNER_SCHOOL}>Escola Parceira</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(searchTerm || roleFilter !== 'all') && (
            <Button 
              variant="ghost" 
              onClick={() => { setSearchTerm(''); setRoleFilter('all'); }}
              className="h-10"
            >
              Limpar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
