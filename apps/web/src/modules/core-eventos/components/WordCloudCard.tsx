import React, { useState, useMemo } from 'react';
import { CoreFormResponse } from '../types';
import { generateWordCloudData, WordCloudItem } from '../services/wordCloudService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Cloud,
  ThumbsUp,
  AlertCircle,
  Search,
  BarChart2,
  Sparkles,
  Quote,
  X,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';

interface WordCloudCardProps {
  responses: CoreFormResponse[];
}

export const WordCloudCard: React.FC<WordCloudCardProps> = ({ responses }) => {
  const [selectedSentiment, setSelectedSentiment] = useState<'all' | 'positive' | 'improvement'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'cloud' | 'ranking'>('cloud');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  // Análise semântica das respostas de formulário
  const analysis = useMemo(() => {
    return generateWordCloudData(responses);
  }, [responses]);

  // Itens filtrados por busca e por sentimento
  const filteredItems = useMemo(() => {
    return analysis.items.filter((item) => {
      if (selectedSentiment !== 'all' && item.sentiment !== selectedSentiment) {
        return false;
      }
      if (searchTerm.trim()) {
        return item.text.toLowerCase().includes(searchTerm.toLowerCase().trim());
      }
      return true;
    });
  }, [analysis.items, selectedSentiment, searchTerm]);

  // Encontra os comentários que citam a palavra selecionada pelo usuário
  const matchingQuotes = useMemo(() => {
    if (!selectedWord) return [];
    const term = selectedWord.toLowerCase();
    return responses
      .filter((r) => r.comment && r.comment.toLowerCase().includes(term))
      .slice(0, 6);
  }, [responses, selectedWord]);

  // Determina classes de tamanho e escala baseadas na frequência relativa
  const maxVal = analysis.items.length > 0 ? analysis.items[0].value : 1;
  const minVal = analysis.items.length > 0 ? analysis.items[analysis.items.length - 1].value : 1;

  const getWordStyle = (item: WordCloudItem) => {
    // Normaliza de 0 a 1
    const weight = maxVal === minVal ? 0.5 : (item.value - minVal) / (maxVal - minVal);

    let fontSizeClass = 'text-xs sm:text-sm font-medium';
    if (weight > 0.8) fontSizeClass = 'text-2xl sm:text-3xl font-black tracking-tight';
    else if (weight > 0.6) fontSizeClass = 'text-xl sm:text-2xl font-extrabold';
    else if (weight > 0.4) fontSizeClass = 'text-base sm:text-lg font-bold';
    else if (weight > 0.2) fontSizeClass = 'text-sm sm:text-base font-semibold';

    let colorClasses = '';
    if (item.sentiment === 'positive') {
      colorClasses =
        'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100 hover:border-emerald-400';
    } else if (item.sentiment === 'improvement') {
      colorClasses =
        'bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 hover:bg-amber-100 hover:border-amber-400';
    } else {
      colorClasses =
        'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 hover:border-indigo-300';
    }

    return { fontSizeClass, colorClasses };
  };

  return (
    <Card className="border border-slate-300 dark:border-slate-700/90 shadow-sm hover:shadow-md transition-all rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
      {/* CABEÇALHO DO CARD EM DESTAQUE */}
      <CardHeader className="p-4 sm:p-5 border-b border-slate-200/90 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 dark:from-slate-800/50 dark:via-indigo-950/20 dark:to-slate-800/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Cloud className="h-5 w-5" />
              </div>
              <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                Nuvem de Palavras & Análise Semântica de Feedbacks
              </CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm mt-1 text-muted-foreground">
              Termos mais recorrentes da coluna:{' '}
              <span className="font-semibold text-foreground italic">
                "Comente o que você gostou e o que podemos melhorar em um próximo evento."
              </span>
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs border-indigo-300 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/30 px-2.5 py-1">
              <MessageSquare className="h-3 w-3 mr-1" />
              {analysis.totalComments} comentários analisados
            </Badge>

            {/* Alternar Visualização */}
            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-background">
              <Button
                variant={viewMode === 'cloud' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cloud')}
                className="h-7 text-xs px-2.5 gap-1"
              >
                <Cloud className="h-3.5 w-3.5" />
                Nuvem
              </Button>
              <Button
                variant={viewMode === 'ranking' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('ranking')}
                className="h-7 text-xs px-2.5 gap-1"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Ranking
              </Button>
            </div>
          </div>
        </div>

        {/* CARDS DE RESUMO SEMÂNTICO RÁPIDO */}
        {analysis.totalComments > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-200/60 dark:border-slate-800">
            {/* O que mais gostaram */}
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <ThumbsUp className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  O que mais gostaram
                </span>
                <p className="text-xs font-bold text-foreground mt-0.5">
                  {analysis.topStrengths.length > 0 ? analysis.topStrengths.join(', ') : 'Sem destaques'}
                </p>
              </div>
            </div>

            {/* O que podemos melhorar */}
            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Oportunidades de melhoria
                </span>
                <p className="text-xs font-bold text-foreground mt-0.5">
                  {analysis.topOpportunities.length > 0 ? analysis.topOpportunities.join(', ') : 'Nenhuma reclamação'}
                </p>
              </div>
            </div>

            {/* Balanço de Sentimento */}
            <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                  Balanço Qualitativo
                </span>
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  <span className="font-bold text-emerald-600">{analysis.positiveTermsCount} elogios</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-bold text-amber-600">{analysis.improvementTermsCount} melhorias</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* BARRA DE FILTROS E PESQUISA INTERNA NA NUVEM */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant={selectedSentiment === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedSentiment('all')}
              className="h-8 text-xs px-3"
            >
              Todas as Palavras ({analysis.items.length})
            </Button>
            <Button
              size="sm"
              variant={selectedSentiment === 'positive' ? 'default' : 'outline'}
              onClick={() => setSelectedSentiment('positive')}
              className="h-8 text-xs px-3 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-50"
            >
              <ThumbsUp className="h-3 w-3 mr-1" />
              O que Gostaram
            </Button>
            <Button
              size="sm"
              variant={selectedSentiment === 'improvement' ? 'default' : 'outline'}
              onClick={() => setSelectedSentiment('improvement')}
              className="h-8 text-xs px-3 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 hover:bg-amber-50"
            >
              <AlertCircle className="h-3 w-3 mr-1" />
              O que Melhorar
            </Button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar termo na nuvem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs border-slate-300 dark:border-slate-700 bg-background"
            />
          </div>
        </div>

        {/* CORPO: VIZ NUVEM OU RANKING */}
        {analysis.totalComments === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm space-y-2">
            <Cloud className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p>Nenhum comentário preenchido para extração da nuvem de palavras.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs">
            Nenhuma palavra encontrada com os filtros atuais.
          </div>
        ) : viewMode === 'cloud' ? (
          /* ================= MODO NUVEM VISUAL INTERATIVA ================= */
          <div className="min-h-[220px] p-6 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/30 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 content-center">
            {filteredItems.map((item) => {
              const { fontSizeClass, colorClasses } = getWordStyle(item);
              const isSelected = selectedWord === item.text;

              return (
                <button
                  key={item.text}
                  onClick={() => setSelectedWord(isSelected ? null : item.text)}
                  className={`group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shadow-xs transition-all duration-200 cursor-pointer ${fontSizeClass} ${colorClasses} ${
                    isSelected ? 'ring-2 ring-primary ring-offset-2 scale-110 shadow-md' : 'hover:scale-105'
                  }`}
                  title={`${item.text}: ${item.value} menções (${item.percentage}% dos comentários)`}
                >
                  <span>{item.text}</span>
                  <span className="text-[10px] font-bold opacity-75 bg-black/10 dark:bg-white/10 px-1.5 py-0.2 rounded-full">
                    {item.value}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* ================= MODO RANKING DE FREQUÊNCIA ================= */
          <div className="space-y-2.5 max-h-[340px] overflow-y-auto page-scrollbar pr-2">
            {filteredItems.slice(0, 15).map((item, index) => {
              const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
              const barColor =
                item.sentiment === 'positive'
                  ? 'bg-emerald-500'
                  : item.sentiment === 'improvement'
                  ? 'bg-amber-500'
                  : 'bg-indigo-500';

              return (
                <div
                  key={item.text}
                  onClick={() => setSelectedWord(selectedWord === item.text ? null : item.text)}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60 transition-all cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono w-5">#{index + 1}</span>
                      <span className="text-foreground">{item.text}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${
                          item.sentiment === 'positive'
                            ? 'border-emerald-300 text-emerald-600 bg-emerald-50/50'
                            : item.sentiment === 'improvement'
                            ? 'border-amber-300 text-amber-600 bg-amber-50/50'
                            : 'border-indigo-200 text-indigo-600'
                        }`}
                      >
                        {item.sentiment === 'positive'
                          ? 'Elogio'
                          : item.sentiment === 'improvement'
                          ? 'Melhoria'
                          : 'Neutro'}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">
                      <strong className="text-foreground">{item.value}</strong> menções ({item.percentage}%)
                    </div>
                  </div>

                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* GAVETA / SNIPPET DE COMENTÁRIOS AO CLICAR EM UMA PALAVRA */}
        {selectedWord && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Quote className="h-3.5 w-3.5 text-primary" />
                Comentários reais contendo o termo "{selectedWord}":
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedWord(null)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {matchingQuotes.map((r, i) => (
                <div
                  key={r.id || i}
                  className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 italic text-foreground/90 shadow-2xs"
                >
                  "{r.comment}"
                  <div className="text-[10px] text-muted-foreground font-sans mt-1 not-italic">
                    — {r.canonicalEventName} • {r.category || 'Participante'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
