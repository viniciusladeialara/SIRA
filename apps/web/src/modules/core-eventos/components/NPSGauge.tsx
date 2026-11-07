import React from 'react';
import { NPSMetrics } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, Meh, ThumbsDown, Award, HelpCircle } from 'lucide-react';

interface NPSGaugeProps {
  metrics: NPSMetrics;
}

export const NPSGauge: React.FC<NPSGaugeProps> = ({ metrics }) => {
  const {
    npsScore,
    promotersPct,
    passivesPct,
    detractorsPct,
    promotersCount,
    passivesCount,
    detractorsCount,
    validScoresCount,
    zone,
    zoneLabel,
    zoneColor,
    averageScore,
  } = metrics;

  // Normaliza o score de -100..100 para 0..100% de largura no ponteiro
  const gaugePercent = Math.min(100, Math.max(0, ((npsScore + 100) / 200) * 100));

  return (
    <Card className="border border-slate-300 dark:border-slate-700/90 shadow-sm hover:shadow-md hover:border-slate-400/90 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold">Net Promoter Score (NPS)</CardTitle>
          </div>
          <Badge
            variant="outline"
            className="font-semibold text-xs px-2.5 py-0.5"
            style={{ borderColor: zoneColor, color: zoneColor, backgroundColor: `${zoneColor}15` }}
          >
            {zoneLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">
        {/* Placar Central do NPS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="flex items-baseline gap-2">
              <span
                className="text-4xl sm:text-5xl font-black tracking-tight"
                style={{ color: zoneColor }}
              >
                {npsScore > 0 ? `+${npsScore}` : npsScore}
              </span>
              <span className="text-sm font-semibold text-muted-foreground">pts</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Base de cálculo: <strong className="text-foreground">{validScoresCount}</strong> avaliações válidas
            </p>
          </div>

          <div className="text-center sm:text-right bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
            <div className="text-xs text-muted-foreground font-medium">Nota Média de Satisfação</div>
            <div className="text-2xl font-bold text-foreground mt-0.5">{averageScore.toFixed(1)} / 10</div>
          </div>
        </div>

        {/* Termômetro Visual Graduado */}
        <div className="space-y-1.5">
          <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 shadow-inner">
            {/* Marcador do Score Atual */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-900 border-2 border-foreground rounded-full shadow-md transition-all duration-500"
              style={{ left: `${gaugePercent}%` }}
              title={`NPS: ${npsScore}`}
            />
          </div>
          <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
            <span>-100 (Crítico)</span>
            <span>0 (Aperfeiçoamento)</span>
            <span>+50 (Qualidade)</span>
            <span>+100 (Excelência)</span>
          </div>
        </div>

        {/* Breakdown dos Grupos (Promotores, Neutros, Detratores) */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          {/* Promotores */}
          <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-300 dark:border-emerald-700/60 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
              <ThumbsUp className="h-3.5 w-3.5" />
              <span>Promotores</span>
            </div>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 mt-1">
              {promotersPct}%
            </div>
            <div className="text-[11px] text-muted-foreground">{promotersCount} resp. (9-10)</div>
          </div>

          {/* Neutros */}
          <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/25 border border-amber-300 dark:border-amber-700/60 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1 text-amber-700 dark:text-amber-400 font-semibold text-xs">
              <Meh className="h-3.5 w-3.5" />
              <span>Neutros</span>
            </div>
            <div className="text-lg font-black text-amber-700 dark:text-amber-400 mt-1">
              {passivesPct}%
            </div>
            <div className="text-[11px] text-muted-foreground">{passivesCount} resp. (7-8)</div>
          </div>

          {/* Detratores */}
          <div className="p-2.5 rounded-lg bg-red-50/70 dark:bg-red-950/25 border border-red-300 dark:border-red-700/60 text-center shadow-xs">
            <div className="flex items-center justify-center gap-1 text-red-700 dark:text-red-400 font-semibold text-xs">
              <ThumbsDown className="h-3.5 w-3.5" />
              <span>Detratores</span>
            </div>
            <div className="text-lg font-black text-red-700 dark:text-red-400 mt-1">
              {detractorsPct}%
            </div>
            <div className="text-[11px] text-muted-foreground">{detractorsCount} resp. (0-6)</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
