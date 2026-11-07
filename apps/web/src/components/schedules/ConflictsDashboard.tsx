import React, { useState, useEffect, useMemo } from "react";
import { AlertCircle, AlertTriangle, ArrowRight, RefreshCw, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { subscribeToConflicts } from "@/services/scheduleService";
import { fetchTeachers, fetchRooms } from "@/services/dataService";
import { ConflictResolutionDialog } from "./ConflictResolutionDialog";
import { useFirestoreCache } from "@/hooks/useCache";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 as CheckCircle } from "lucide-react";

export function ConflictsDashboard() {
  const { toast } = useToast();
  const { isUserAdmin, isUserOperational } = usePermissions();
  const { cacheQuery } = useFirestoreCache();
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);

  const isAdmin = isUserAdmin() || isUserOperational();

  useEffect(() => {
    if (!isAdmin) return;
    
    const loadSupportData = async () => {
      try {
        const [teachersData, roomsData] = await Promise.all([
          cacheQuery("teachers", fetchTeachers),
          cacheQuery("rooms", fetchRooms)
        ]);
        setTeachers(teachersData);
        setRooms(roomsData);
      } catch (error) {
        console.error("Erro ao carregar dados de suporte:", error);
      }
    };
    loadSupportData();

    setIsLoading(true);
    const unsubscribe = subscribeToConflicts((data) => {
      setConflicts(data);
      setIsLoading(false);
    });
    return () => {
      unsubscribe();
    };
  }, [cacheQuery, isAdmin]);

  const sortedConflicts = useMemo(() => {
    return [...conflicts].sort((a, b) => {
      const getMillis = (obj: any) => {
        if (!obj?.suggestedData?.startTime) return 0;
        const ts = obj.suggestedData.startTime;
        if (ts.toMillis) return ts.toMillis();
        if (ts.seconds) return ts.seconds * 1000;
        if (ts instanceof Date) return ts.getTime();
        return new Date(ts).getTime() || 0;
      };
      return getMillis(a) - getMillis(b);
    });
  }, [conflicts]);

  const getConflictBadge = (type: string) => {
    switch (type) {
      case 'teacher_busy': return <Badge variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">Professor</Badge>;
      case 'room_busy': return <Badge variant="destructive" className="bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border-orange-500/20">Ambiente</Badge>;
      case 'class_overlap': return <Badge variant="destructive" className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20">Turma</Badge>;
      case 'calendar_mismatch': return <Badge variant="secondary" className="bg-slate-500/10 text-slate-500 hover:bg-slate-500/20 border-slate-500/20">Calendário</Badge>;
      case 'room_maintenance': return <Badge variant="destructive" className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20">Manutenção</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <XCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground">Acesso Restrito</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Você não possui permissões administrativas para visualizar a fila de conflitos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-100 bg-amber-50/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-2xl flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              Fila de Resolução de Conflitos
            </CardTitle>
            <CardDescription>
              Conflitos de agendamento detectados automaticamente pelo motor de integridade.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-20rem)] border rounded-md bg-white">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando fila...</span>
              </div>
            ) : conflicts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 py-20 text-center">
                <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-muted-foreground">Tudo limpo!</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Nenhum conflito pendente detectado no Hub.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Turma / Professor</TableHead>
                    <TableHead>Data / Turno</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedConflicts.map((conflict) => {
                    const start = conflict.suggestedData?.startTime?.toDate?.() || 
                                  (conflict.suggestedData?.startTime?.seconds ? new Date(conflict.suggestedData.startTime.seconds * 1000) : new Date());
                    const isManual = conflict.sourceType === 'MANUAL_EDIT';
                    const isSystem = conflict.sourceType === 'SYSTEM';
                    return (
                      <TableRow key={conflict.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <Badge variant="outline" className={
                            isManual ? "border-blue-200 text-blue-600 bg-blue-50/50" : 
                            isSystem ? "border-orange-200 text-orange-600 bg-orange-50/50" :
                            "border-purple-200 text-purple-600 bg-purple-50/50"
                          }>
                            {isManual ? 'Manual' : isSystem ? 'Sistema' : 'Cópia'}
                          </Badge>
                        </TableCell>
                        <TableCell>{getConflictBadge(conflict.conflictType)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">{conflict.suggestedData?.className}</span>
                            <span className="text-xs text-muted-foreground">{conflict.suggestedData?.teacherName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{format(start, "dd/MM/yyyy")}</span>
                            <span className="text-xs text-muted-foreground capitalize">{conflict.suggestedData?.shift || "---"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-xs text-muted-foreground truncate">{conflict.description}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelectedConflict(conflict)}>
                            Analisar <ArrowRight className="h-3 w-3 ml-2" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <ConflictResolutionDialog 
        conflict={selectedConflict} 
        onOpenChange={(open) => !open && setSelectedConflict(null)}
        onResolved={() => setSelectedConflict(null)}
        teachers={teachers}
        rooms={rooms}
      />
    </div>
  );
}


