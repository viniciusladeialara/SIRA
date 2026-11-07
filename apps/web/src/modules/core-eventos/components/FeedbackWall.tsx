import React, { useState, useMemo } from 'react';
import { CoreFormResponse } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Search, ChevronLeft, ChevronRight, Star, ShieldCheck } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FeedbackWallProps {
  responses: CoreFormResponse[];
}

export const FeedbackWall: React.FC<FeedbackWallProps> = ({ responses }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | 'promotor' | 'neutro' | 'detrator'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filtra apenas respostas de avaliação que possuem comentário não-vazio
  const feedbackList = useMemo(() => {
    return responses
      .filter((r) => r.comment && r.comment.trim().length > 0)
      .filter((r) => {
        if (groupFilter !== 'all') {
          const score = r.recommendationScore ?? -1;
          if (groupFilter === 'promotor' && score < 9) return false;
          if (groupFilter === 'neutro' && (score < 7 || score > 8)) return false;
          if (groupFilter === 'detrator' && (score < 0 || score > 6)) return false;
        }

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchComment = r.comment?.toLowerCase().includes(q);
          const matchEvent = r.canonicalEventName.toLowerCase().includes(q);
          return matchComment || matchEvent;
        }

        return true;
      })
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [responses, searchTerm, groupFilter]);

  const totalPages = Math.ceil(feedbackList.length / itemsPerPage) || 1;
  const paginatedList = feedbackList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getScoreBadge = (score?: number | null) => {
    if (score === null || score === undefined) {
      return <Badge variant="secondary" className="text-xs">Sem nota</Badge>;
    }
    if (score >= 9) {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1">
          <Star className="h-3 w-3 fill-current" /> Nota {score}
        </Badge>
      );
    }
    if (score >= 7) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1">
          <Star className="h-3 w-3 fill-current" /> Nota {score}
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs flex items-center gap-1">
        <Star className="h-3 w-3 fill-current" /> Nota {score}
      </Badge>
    );
  };

  const formatDate = (isoString: string) => {
    try {
      const d = parseISO(isoString);
      if (isValid(d)) {
        return format(d, "dd 'de' MMMM, HH:mm", { locale: ptBR });
      }
    } catch {}
    return 'Data não informada';
  };

  return (
    <Card className="border border-slate-300 dark:border-slate-700/90 shadow-sm hover:shadow-md hover:border-slate-400/90 dark:hover:border-slate-600 transition-all rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-bold">Mural de Feedbacks e Sugestões</CardTitle>
            </div>
            <CardDescription className="text-xs mt-0.5 flex items-center gap-1 text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Proteção de dados ativada (LGPD): Exibição segura sem dados pessoais identificáveis.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar comentários..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 pl-8 text-xs bg-background border-slate-300 dark:border-slate-700 focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Filtros de Categoria de Feedback */}
        <div className="flex items-center gap-1.5 pt-2 flex-wrap">
          <Button
            size="sm"
            variant={groupFilter === 'all' ? 'default' : 'outline'}
            onClick={() => { setGroupFilter('all'); setCurrentPage(1); }}
            className="h-7 text-xs px-2.5"
          >
            Todos ({responses.filter((r) => r.comment).length})
          </Button>
          <Button
            size="sm"
            variant={groupFilter === 'promotor' ? 'default' : 'outline'}
            onClick={() => { setGroupFilter('promotor'); setCurrentPage(1); }}
            className="h-7 text-xs px-2.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
          >
            Promotores (9-10)
          </Button>
          <Button
            size="sm"
            variant={groupFilter === 'neutro' ? 'default' : 'outline'}
            onClick={() => { setGroupFilter('neutro'); setCurrentPage(1); }}
            className="h-7 text-xs px-2.5 text-amber-600 dark:text-amber-400 border-amber-500/30"
          >
            Neutros (7-8)
          </Button>
          <Button
            size="sm"
            variant={groupFilter === 'detrator' ? 'default' : 'outline'}
            onClick={() => { setGroupFilter('detrator'); setCurrentPage(1); }}
            className="h-7 text-xs px-2.5 text-red-600 dark:text-red-400 border-red-500/30"
          >
            Detratores (0-6)
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {paginatedList.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-muted-foreground text-sm space-y-1">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-1" />
            <p>Nenhum comentário encontrado com os filtros ativos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedList.map((feedback) => (
              <div
                key={feedback.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 hover:border-primary/50 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-primary truncate" title={feedback.canonicalEventName}>
                      {feedback.canonicalEventName}
                    </span>
                    {getScoreBadge(feedback.recommendationScore)}
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed italic bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-md border border-slate-200 dark:border-slate-700/60">
                    "{feedback.comment}"
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-slate-100 dark:border-slate-700/60">
                  <span>{feedback.category || 'Participante'}</span>
                  <span>{formatDate(feedback.startedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs">
            <div className="text-muted-foreground">
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, feedbackList.length)} de {feedbackList.length} feedbacks
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 w-7"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 font-medium">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-7 w-7"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
