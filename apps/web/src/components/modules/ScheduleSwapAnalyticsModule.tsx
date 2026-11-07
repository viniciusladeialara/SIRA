/**
 * @file ScheduleSwapAnalyticsModule.tsx
 * @description Módulo de análise e estatísticas de trocas de agendamento.
 * Filtra por unidade via usePermissions (unitId global do Dashboard).
 */

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { TrendingUp, CheckCircle, XCircle, Clock } from "lucide-react";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { usePermissions } from "@/hooks/usePermissions";

interface SwapStatistics {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  expired: number;
}

interface SwapByTeacher {
  teacherName: string;
  requested: number;
  accepted: number;
  rejected: number;
}

export function ScheduleSwapAnalyticsModule() {
  // Unidade controlada globalmente pelo Dashboard (sidebar)
  const { userData } = usePermissions();
  const selectedUnitId = userData?.selectedUnitId || "caceres";

  const [stats, setStats] = useState<SwapStatistics>({
    total: 0, pending: 0, accepted: 0, rejected: 0, expired: 0,
  });
  const [swapsByTeacher, setSwapsByTeacher] = useState<SwapByTeacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historicalNote, setHistoricalNote] = useState(false);

  const statusColors = {
    pending: "#f59e0b",
    accepted: "#10b981",
    rejected: "#ef4444",
    expired: "#6b7280",
  };

  // Recarrega sempre que a unidade global mudar
  useEffect(() => {
    if (!selectedUnitId) return;
    setIsLoading(true);

    const unsubscribe = onSnapshot(
      collection(db, "scheduleSwaps"),
      async (snapshot) => {
        const allSwaps = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];

        // Separa registros com e sem unitId (dados históricos)
        const swapsWithUnit = allSwaps.filter((s) => s.unitId);
        const swapsWithoutUnit = allSwaps.filter((s) => !s.unitId);

        let resolvedHistorical: any[] = [];

        if (swapsWithoutUnit.length > 0) {
          setHistoricalNote(true);
          const scheduleIds = [
            ...new Set(
              swapsWithoutUnit
                .map((s) => s.requesterScheduleId)
                .filter(Boolean)
            )
          ].slice(0, 30);

          if (scheduleIds.length > 0) {
            try {
              const schedulesSnap = await getDocs(
                query(collection(db, "schedules"), where("__name__", "in", scheduleIds))
              );
              const scheduleUnitMap: Record<string, string> = {};
              schedulesSnap.docs.forEach(d => {
                scheduleUnitMap[d.id] = d.data().unitId || "";
              });
              resolvedHistorical = swapsWithoutUnit.map(s => ({
                ...s,
                unitId: scheduleUnitMap[s.requesterScheduleId] || null,
              }));
            } catch {
              resolvedHistorical = swapsWithoutUnit;
            }
          } else {
            resolvedHistorical = swapsWithoutUnit;
          }
        }

        // Filtra pela unidade global
        const swaps = [...swapsWithUnit, ...resolvedHistorical].filter(
          (s) => s.unitId === selectedUnitId
        );

        setStats({
          total: swaps.length,
          pending: swaps.filter((s) => s.status === "pending").length,
          accepted: swaps.filter((s) => s.status === "accepted").length,
          rejected: swaps.filter((s) => s.status === "rejected").length,
          expired: swaps.filter((s) => s.status === "expired").length,
        });

        const byTeacher: Record<string, SwapByTeacher> = {};
        swaps.forEach((swap) => {
          const teacherName = swap.requesterTeacherName || "Desconhecido";
          if (!byTeacher[teacherName]) {
            byTeacher[teacherName] = { teacherName, requested: 0, accepted: 0, rejected: 0 };
          }
          byTeacher[teacherName].requested += 1;
          if (swap.status === "accepted") byTeacher[teacherName].accepted += 1;
          if (swap.status === "rejected") byTeacher[teacherName].rejected += 1;
        });

        setSwapsByTeacher(
          Object.values(byTeacher)
            .sort((a, b) => b.requested - a.requested)
            .slice(0, 10)
        );

        setIsLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar estatísticas de trocas:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedUnitId]);

  const pieData = [
    { name: "Pendentes", value: stats.pending, color: statusColors.pending },
    { name: "Aceitas", value: stats.accepted, color: statusColors.accepted },
    { name: "Negadas", value: stats.rejected, color: statusColors.rejected },
    { name: "Expiradas", value: stats.expired, color: statusColors.expired },
  ].filter(item => item.value > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando estatísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <PageLayout>
      <PageHeader>
        <h2 className="text-3xl font-bold">Análise de Trocas de Agendamento</h2>
        <p className="text-muted-foreground mt-2">
          Visualize estatísticas sobre solicitações e execuções de trocas de agendamento entre professores
        </p>
        {historicalNote && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mt-3">
            ⚠️ Alguns registros históricos não possuíam unidade salva — foram inferidos pelo agendamento de origem.
            Novas trocas são automaticamente vinculadas à unidade correta.
          </p>
        )}
      </PageHeader>

      <PageContent>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Trocas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">Solicitações registradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">Aguardando resposta</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aceitas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
              <p className="text-xs text-muted-foreground mt-1">Trocas executadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negadas</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground mt-1">Solicitações recusadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.accepted + stats.rejected > 0
                  ? Math.round((stats.accepted / (stats.accepted + stats.rejected)) * 100)
                  : 0}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Trocas aceitas vs negadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Status</CardTitle>
              <CardDescription>Proporção de trocas em cada status</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Sem dados de trocas</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Professores (Solicitações)</CardTitle>
              <CardDescription>Professores que mais solicitaram trocas</CardDescription>
            </CardHeader>
            <CardContent>
              {swapsByTeacher.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={swapsByTeacher}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="teacherName"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="requested" fill="#f59e0b" name="Solicitadas" />
                    <Bar dataKey="accepted" fill="#10b981" name="Aceitas" />
                    <Bar dataKey="rejected" fill="#ef4444" name="Negadas" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Sem dados de professores</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Detalhes */}
        {swapsByTeacher.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Detalhes por Professor</CardTitle>
              <CardDescription>Análise detalhada de trocas solicitadas por cada professor</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold">Professor</th>
                      <th className="text-center py-3 px-4 font-semibold">Solicitadas</th>
                      <th className="text-center py-3 px-4 font-semibold">Aceitas</th>
                      <th className="text-center py-3 px-4 font-semibold">Negadas</th>
                      <th className="text-center py-3 px-4 font-semibold">Taxa de Sucesso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {swapsByTeacher.map((teacher) => {
                      const totalResponses = teacher.accepted + teacher.rejected;
                      const successRate =
                        totalResponses > 0
                          ? Math.round((teacher.accepted / totalResponses) * 100)
                          : 0;
                      return (
                        <tr key={teacher.teacherName} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">{teacher.teacherName}</td>
                          <td className="text-center py-3 px-4">
                            <Badge variant="outline">{teacher.requested}</Badge>
                          </td>
                          <td className="text-center py-3 px-4">
                            <Badge className="bg-green-100 text-green-800">{teacher.accepted}</Badge>
                          </td>
                          <td className="text-center py-3 px-4">
                            <Badge className="bg-red-100 text-red-800">{teacher.rejected}</Badge>
                          </td>
                          <td className="text-center py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{ width: `${successRate}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium">{successRate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

      </PageContent>
    </PageLayout>
  );
}
