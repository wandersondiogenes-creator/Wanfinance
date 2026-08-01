import React, { useState, useMemo } from 'react';
import { CNABBatchHistory } from '../types';
import { formatCurrencyBRL } from '../utils/boletoParser';
import { getBankInfo } from '../utils/banks';
import { History, Download, Trash2, FileText, UserCheck, Search, Building2 } from 'lucide-react';

interface HistoryPanelProps {
  history: CNABBatchHistory[];
  onClearHistory: () => void;
  onDownloadBatch: (batch: CNABBatchHistory) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  onClearHistory,
  onDownloadBatch,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(
      (h) =>
        h.filename.toLowerCase().includes(term) ||
        (h.analista && h.analista.toLowerCase().includes(term)) ||
        h.bancoCodigo.includes(term)
    );
  }, [history, searchTerm]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Histórico de Arquivos de Remessa</h2>
            <p className="text-xs text-slate-400">
              Registros e backups dos arquivos CNAB gerados, com identificação do analista responsável
            </p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>Limpar Histórico</span>
          </button>
        )}
      </div>

      {/* Search & Stats Filter */}
      {history.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por analista, arquivo ou banco..."
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-purple-500 placeholder-slate-500"
            />
          </div>

          <div className="text-xs text-slate-400">
            Exibindo <strong className="text-white">{filteredHistory.length}</strong> de{' '}
            <strong className="text-white">{history.length}</strong> remessas registradas
          </div>
        </div>
      )}

      {/* History List */}
      {history.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-3">
          <FileText className="w-12 h-12 mx-auto text-slate-700" />
          <p className="text-base font-semibold text-slate-300">Nenhum arquivo gerado ainda</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Ao gerar ou baixar um arquivo CNAB, o arquivo será salvo no histórico juntamente com o nome do analista financeiro responsável.
          </p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          Nenhum registro encontrado para o termo "{searchTerm}".
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((batch) => {
            const bankInfo = getBankInfo(batch.bancoCodigo);

            return (
              <div
                key={batch.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start sm:items-center space-x-4">
                  <div className="w-11 h-11 rounded-2xl bg-slate-800 flex flex-col items-center justify-center font-bold text-xs text-slate-300 font-mono shrink-0">
                    <span className="text-[10px] text-slate-500 font-sans">NSA</span>
                    <span>#{batch.nsa}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono font-bold text-white text-sm">{batch.filename}</p>
                      <span className="bg-blue-950 text-blue-300 text-[11px] px-2 py-0.5 rounded-full border border-blue-800/60 font-semibold">
                        CNAB {batch.padraoCNAB}
                      </span>
                      <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded-full border border-slate-700 flex items-center gap-1 font-medium">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        [{batch.bancoCodigo}] {bankInfo.shortName}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {/* Analyst Badge */}
                      <span className="bg-purple-950/80 text-purple-300 border border-purple-500/30 text-[11px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-purple-400" />
                        <span>Gerado por: <strong className="text-white">{batch.analista || 'Analista Financeiro'}</strong></span>
                      </span>

                      <span>•</span>
                      <span>Gerado em: {new Date(batch.createdDate).toLocaleString('pt-BR')}</span>
                      <span>•</span>
                      <span className="text-slate-300 font-semibold">{batch.totalBoletos} boletos</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {formatCurrencyBRL(batch.totalValor)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto justify-end shrink-0">
                  <button
                    onClick={() => onDownloadBatch(batch)}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center space-x-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Novamente</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
