import React from 'react';
import { PauseCircle, ArrowLeft, ShieldCheck, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StandbyNoticeProps {
  title?: string;
  description?: string;
  reason?: string;
}

export const StandbyNotice: React.FC<StandbyNoticeProps> = ({
  title = "Módulo Temporariamente em Standby",
  description = "Este painel foi pausado preventivamente para otimização de leitura e contenção de custos de nuvem.",
  reason = "Política de Redução de Gastos (FinOps Cloud Firestore)"
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
          <PauseCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Modo Economia Ativo (FinOps)
          </span>
          <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
          <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
        </div>

        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 text-left text-xs text-slate-400 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Motivo:</span>
          </div>
          <p>{reason}</p>
          <p className="text-slate-500 pt-1">
            Os arquivos originais foram preservados com segurança na pasta <code className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">src/standby/</code>.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-600/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Sistema Principal
          </button>
        </div>
      </div>
    </div>
  );
};

export default StandbyNotice;
