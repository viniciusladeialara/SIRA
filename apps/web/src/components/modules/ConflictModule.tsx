import React, { useState, useEffect, useMemo } from "react";
import { Timestamp } from "@/lib/sira-sql-adapter";
import { startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, format, getHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertCircle, AlertTriangle, Calendar, MapPin, User, Users, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useFirestoreCache } from "@/hooks/useCache";
import { fetchClasses, fetchRooms, fetchTeachers } from "@/services/dataService";
import { subscribeToSchedules } from "@/services/scheduleService";
import { deleteSchedule } from "@/services/scheduleService";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Loader2, Share2, Copy, ShieldAlert } from "lucide-react";
import { ConflictsDashboard } from "@/components/schedules/ConflictsDashboard";

// --- TIPAGEM ---
interface Schedule { 
  id: string; 
  className: string; 
  roomName: string; 
  teacherName: string; 
  startTime: Timestamp; 
  endTime: Timestamp; 
  roomId: string; 
  teacherId: string; 
  classId: string; 
  createdAt?: Timestamp | any;
  scheduleStatus?: string;
}
interface Class { id: string; name: string; daysOfWeek?: string[]; teacherIds: string[]; teacherNames: string[]; courseName?: string; }

interface Conflict {
  id: string;
  type: 'CRITICAL' | 'WARNING';
  category: 'CHOQUE_PROFESSOR' | 'CHOQUE_AMBIENTE' | 'DIA_NAO_PREVISTO' | 'DIA_FALTANTE';
  title: string;
  description: string;
  items: string[]; // IDs envolvidos
  details: any;
}

const dayMapping: Record<number, string> = {
  1: 'SEG', 2: 'TER', 3: 'QUA', 4: 'QUI', 5: 'SEX', 6: 'SAB'
};

export function ConflictModule() {
  const { isUserAdmin, isUserOperational } = usePermissions();
  const isAdmin = isUserAdmin() || isUserOperational();

  if (!isAdmin) {
    return (
      <PageLayout>
        <PageHeader>
          <h1 className="text-2xl font-bold tracking-tight">Painel de Conflitos</h1>
        </PageHeader>
        <PageContent>
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Acesso Restrito
              </CardTitle>
              <CardDescription className="text-red-700">
                Apenas administradores podem acessar o painel de gestão de conflitos.
              </CardDescription>
            </CardHeader>
          </Card>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader>
        <div className="flex items-center justify-between w-full">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hub de Conflitos</h1>
            <p className="text-muted-foreground text-sm">Central de monitoramento e resolução de integridade da grade.</p>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            Vigilância Ativa (Backend)
          </div>
        </div>
      </PageHeader>

      <PageContent className="space-y-6">
        <ConflictsDashboard />
      </PageContent>
    </PageLayout>
  );
}
