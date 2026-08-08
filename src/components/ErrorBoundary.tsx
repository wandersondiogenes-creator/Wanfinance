import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Copy, Check, Terminal, Home } from 'lucide-react';
import { technicalLogger } from '../utils/technicalLogger';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showLogs: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showLogs: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
      showLogs: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    technicalLogger.log({
      step: 'React ErrorBoundary Catch',
      errorMessage: error.message || 'Exceção não tratada na renderização do React',
      severity: 'error',
      details: {
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      },
    });

    console.error('[ErrorBoundary] Unhandled React Render Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showLogs: false,
    });
  };

  private handleCopyLogs = () => {
    const logsStr = technicalLogger.exportLogsAsString();
    const fullReport = `=== DIAGNÓSTICO DE TELA BRANCA / EXCEÇÃO REACT ===\nData/Hora: ${new Date().toISOString()}\nErro: ${this.state.error?.message}\nStack: ${this.state.error?.stack}\n\n=== LOGS TÉCNICOS REGISTRADOS ===\n${logsStr}`;

    navigator.clipboard.writeText(fullReport);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2500);
  };

  public render() {
    if (this.state.hasError) {
      const logs = technicalLogger.getLogs();

      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1 flex-1">
                <h1 className="text-xl font-black text-white tracking-tight">
                  Falha no Processamento
                </h1>
                <p className="text-sm text-slate-300 font-medium leading-relaxed">
                  Não foi possível processar os boletos ou exibir esta tela. Verifique os detalhes técnicos ou tente novamente.
                </p>
              </div>
            </div>

            {/* Error detail box */}
            <div className="bg-slate-950/80 border border-red-900/40 rounded-2xl p-4 space-y-2 text-xs font-mono">
              <div className="text-red-400 font-bold flex items-center justify-between">
                <span>MENSAGEM DA EXCEÇÃO:</span>
                <span className="text-[10px] bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded">
                  React Render Error
                </span>
              </div>
              <p className="text-slate-200 break-words font-semibold">
                {this.state.error?.message || 'Exceção desconhecida no componente React.'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-700/80">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center space-x-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Tentar Novamente</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>Recarregar Página</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showLogs: !prev.showLogs }))}
                  className="bg-slate-900 hover:bg-slate-950 text-slate-300 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Terminal className="w-4 h-4 text-blue-400" />
                  <span>{this.state.showLogs ? 'Ocultar Logs' : 'Ver Logs'}</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleCopyLogs}
                  className="bg-slate-900 hover:bg-slate-950 text-slate-300 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>Copiar Diagnóstico</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Diagnostics log panel */}
            {this.state.showLogs && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 max-h-60 overflow-y-auto text-xs font-mono">
                <div className="text-slate-400 font-bold text-[11px] uppercase tracking-wider flex justify-between">
                  <span>Logs Recentes do Sistema ({logs.length}):</span>
                </div>
                {logs.length === 0 ? (
                  <p className="text-slate-500 italic">Nenhum log registrado ainda.</p>
                ) : (
                  logs.map((l) => (
                    <div
                      key={l.id}
                      className={`p-2 rounded border text-[11px] ${
                        l.severity === 'error'
                          ? 'bg-red-950/40 border-red-900/60 text-red-200'
                          : l.severity === 'warn'
                          ? 'bg-amber-950/40 border-amber-900/60 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>[{l.step}]</span>
                        <span className="text-[10px] text-slate-500">{l.timestamp.split('T')[1].split('.')[0]}</span>
                      </div>
                      {l.fileName && <div>Arquivo: {l.fileName}</div>}
                      {l.httpStatus && <div>HTTP Status: {l.httpStatus}</div>}
                      {l.errorMessage && <div className="font-semibold text-white mt-0.5">{l.errorMessage}</div>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
