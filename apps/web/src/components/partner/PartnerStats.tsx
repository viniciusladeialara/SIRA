import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, CheckCircle2, XCircle, CalendarDays, TrendingUp } from "lucide-react";

interface PartnerStatsProps {
  stats: {
    totalAlunos: number;
    totalPresencas: number;
    totalFaltas: number;
    totalAulas: number;
  };
}

export function PartnerStats({ stats }: PartnerStatsProps) {
  const presenceRate = stats.totalPresencas + stats.totalFaltas > 0 
    ? Math.round((stats.totalPresencas / (stats.totalPresencas + stats.totalFaltas)) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {[
        { label: "Alunos", value: stats.totalAlunos, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
        { label: "Aulas", value: stats.totalAulas, icon: CalendarDays, color: "text-amber-600", bg: "bg-amber-100" },
        { label: "Presenças", value: stats.totalPresencas, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
        { label: "Faltas", value: stats.totalFaltas, icon: XCircle, color: "text-rose-600", bg: "bg-rose-100" },
        { label: "Tx. Presença", value: `${presenceRate}%`, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-100" },
      ].map((stat, i) => (
        <Card key={i} className="border-none shadow-sm transition-all hover:shadow-md">
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-gray-900">{stat.value}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
