import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { BarChart2 } from 'lucide-react';

interface ScoreHistogramProps {
  data: {
    score: number;
    count: number;
    group: 'detrator' | 'neutro' | 'promotor';
  }[];
}

const COLOR_MAP = {
  detrator: '#ef4444', // Vermelho Coral
  neutro: '#f59e0b',   // Âmbar
  promotor: '#10b981', // Verde Esmeralda
};

export const ScoreHistogram: React.FC<ScoreHistogramProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0';
      const groupLabel =
        item.group === 'promotor'
          ? 'Promotor (Nota 9-10)'
          : item.group === 'neutro'
          ? 'Neutro (Nota 7-8)'
          : 'Detrator (Nota 0-6)';

      return (
        <div className="bg-popover border border-border p-2.5 rounded-lg shadow-lg text-xs space-y-1">
          <div className="font-bold text-foreground">Nota {item.score}</div>
          <div className="text-muted-foreground">{groupLabel}</div>
          <div className="font-semibold text-primary">
            {item.count} respostas ({pct}%)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border border-slate-300 dark:border-slate-700/90 shadow-sm hover:shadow-md hover:border-slate-400/90 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
      <CardHeader className="pb-2.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold">Distribuição das Notas (0 a 10)</CardTitle>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Detratores (0-6)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Neutros (7-8)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Promotores (9-10)
            </span>
          </div>
        </div>
        <CardDescription className="text-xs">
          Frequência absoluta de respostas na pergunta: "Quanto você recomendaria este evento para outra pessoa?"
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {total === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-sm">
            Nenhuma avaliação registrada no período filtrado.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis
                  dataKey="score"
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8', opacity: 0.3 }}
                  tick={{ fontSize: 12, fill: 'currentColor' }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8', opacity: 0.3 }}
                  tick={{ fontSize: 12, fill: 'currentColor' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLOR_MAP[entry.group]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
