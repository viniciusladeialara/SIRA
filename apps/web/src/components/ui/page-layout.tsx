import React from 'react';
import { cn } from "@/lib/utils";

/**
 * Envolve a página inteira. Garante que ela ocupe toda a altura restante do dashboard sem rolar.
 */
export const PageLayout = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={cn("flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden", className)}>
      {children}
    </div>
  );
};

/**
 * Cabeçalho e área de filtros da página. Fica "sticky" / não rola ao deslizar a tela.
 */
export const PageHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={cn("shrink-0 p-6 pb-2", className)}>
      {children}
    </div>
  );
};

/**
 * Wrapper para a área de conteúdo (tabela, painéis, grids). 
 * É este container que recebe o scroll vertical e horizontal (overflow: auto).
 */
export const PageContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={cn("flex-1 overflow-auto min-h-0 p-6 pt-0 custom-scrollbar", className)}>
      {children}
    </div>
  );
};
