import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Crown, User } from "lucide-react";
import { UserRole, UserWithRole } from "@/lib/UserRoles";

interface UserStatsProps {
  users: (UserWithRole & { id: string })[];
  userRole: UserRole;
}

export function UserStats({ users, userRole }: UserStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4 text-center sm:text-left sm:flex sm:items-center sm:gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 mb-2 sm:mb-0">
            <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase">Total</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </div>
        </CardContent>
      </Card>
      
      {userRole === UserRole.ADMIN && (
        <Card>
          <CardContent className="p-4 text-center sm:text-left sm:flex sm:items-center sm:gap-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30 mb-2 sm:mb-0">
              <Crown className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase">Admins</p>
              <p className="text-2xl font-bold">
                {users.filter(u => u.role === UserRole.ADMIN).length}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardContent className="p-4 text-center sm:text-left sm:flex sm:items-center sm:gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 mb-2 sm:mb-0">
            <User className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase">Ativos</p>
            <p className="text-2xl font-bold">
              {users.filter(u => u.isActive).length}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
