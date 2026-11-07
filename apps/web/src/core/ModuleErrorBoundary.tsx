import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check, Terminal, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  moduleId: string;
  moduleTitle?: string;
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ModuleErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[Core Engine] Erro capturado no módulo "${this.props.moduleId}":`, error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleCopyError = () => {
    const errorText = `[Módulo: ${this.props.moduleId}]
Erro: ${this.state.error?.message || 'Desconhecido'}
Stack Trace:
${this.state.error?.stack || ''}
Component Stack:
${this.state.errorInfo?.componentStack || ''}`;

    navigator.clipboard.writeText(errorText);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2500);
  };

  public render() {
    if (this.state.hasError) {
      const moduleName = this.props.moduleTitle || this.props.moduleId;

      return (
        <div className="h-full flex items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-red-200 dark:border-red-900/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header com aviso de isolamento de falha */}
            <div className="bg-red-50 dark:bg-red-950/40 p-6 border-b border-red-100 dark:border-red-900/30 flex items-start gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-xl text-red-600 dark:text-red-400 shrink-0">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-red-200 dark:bg-red-900/60 text-red-800 dark:text-red-200">
                    Isolamento de Falha Ativo
                  </span>
                  <span className="text-xs text-gray-500 font-mono">id: {this.props.moduleId}</span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Falha de execução no módulo: <span className="text-red-600 dark:text-red-400">{moduleName}</span>
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  O Core do sistema conteve esta falha. Seus dados de sessão e todos os outros módulos continuam funcionando normalmente.
                </p>
              </div>
            </div>

            {/* Mensagem e ações */}
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Você pode continuar usando outros módulos pela barra lateral enquanto trabalha na correção deste.
                </span>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={this.handleReset}
                  className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Recarregar Módulo
                </Button>

                <Button
                  variant="outline"
                  onClick={this.handleCopyError}
                  className="flex items-center gap-2"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copiar Erro para Suporte</span>
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1.5 ml-auto"
                >
                  <Terminal className="h-3.5 w-3.5" />
                  {this.state.showDetails ? "Ocultar Detalhes Técnicos" : "Ver Detalhes Técnicos"}
                </Button>
              </div>

              {/* Detalhes do erro colapsáveis */}
              {this.state.showDetails && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2 animate-in fade-in duration-200">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Mensagem da Exceção:
                  </p>
                  <pre className="p-3 bg-gray-900 text-red-300 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                    {this.state.error?.message || 'Nenhuma mensagem disponível'}
                  </pre>

                  {this.state.error?.stack && (
                    <>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-2">
                        Stack Trace:
                      </p>
                      <pre className="p-3 bg-gray-900 text-gray-300 rounded-lg text-[11px] font-mono overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {this.state.error.stack}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
