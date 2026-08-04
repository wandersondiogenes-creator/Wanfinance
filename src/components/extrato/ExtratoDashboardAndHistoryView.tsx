import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  Calendar,
  Building2,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { ExtratoConversionRecord, LearnedCNABExtratoLayout } from '../../types';
import {
  loadExtratoConversionHistory,
  saveExtratoConversionHistory,
  loadLearnedExtratoLayouts,
} from '../../utils/cnabExtratoEngine';
import { formatCurrencyBRL } from '../../utils/boletoParser';

export const ExtratoDashboardAndHistoryView: React.FC = () => {
  const [history, setHistory] = useState<ExtratoConversionRecord[]>(() => loadExtratoConversionHistory());
  const [learnedLayouts] = useState<LearnedCNABExtratoLayout[]>(() => loadLearnedExtratoLayouts());

  const [searchTerm, setSearchTerm] = useState('');

  // Calculate Aggregated Metrics
  const metrics = React.useMemo(() => {
    let totalArquivos = history.length;
    let totalLancamentos = 0;
    let totalCreditos = 0;
    let totalDebitos = 0;

    history.forEach((h) => {
      totalLancamentos += h.qtdLancamentos;
      totalCreditos += h.totalCreditos;
      totalDebitos += h.totalDebitos;
    });

    return {
      totalArquivos,
      totalLancamentos,
      totalCreditos,
      totalDebitos,
      saldoLiquido: totalCreditos - totalDebitos,
      totalModelos: learnedLayouts.length,
    };
  }, [history, learnedLayouts]);

  // Download converted file from history
  const handleDownloadFromHistory = (item: ExtratoConversionRecord) => {
    const element = document.createElement('a');
    const file = new Blob([item.cnabContent], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = item.nomeArquivoCNAB;
    document.body.appendChild(element);
    element.click();
    element.remove();
  };

  // Clear History
  const handleClearHistory = () => {
    if (confirm('Tem certeza que deseja limpar o histórico de extratos convertidos?')) {
      setHistory([]);
      saveExtratoConversionHistory([]);
    }
  };

  const filteredHistory = history.filter((item) => {
    return (
      item.nomeArquivoOriginal.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nomeArquivoCNAB.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.layoutNome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Extratos Convertidos
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics.totalArquivos}</p>
          <p className="text-xs text-slate-400 font-medium">
            Total de <strong>{metrics.totalLancamentos}</strong> lançamentos processados
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Créditos (Entradas)
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600">{formatCurrencyBRL(metrics.totalCreditos)}</p>
          <p className="text-xs text-emerald-700/70 font-medium">Soma total de depósitos/PIX/TED</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Débitos (Saídas)
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600">{formatCurrencyBRL(metrics.totalDebitos)}</p>
          <p className="text-xs text-rose-700/70 font-medium">Soma total de pagamentos/saídas</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Modelos CNAB Aprendidos
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-700">{metrics.totalModelos}</p>
          <p className="text-xs text-purple-800/70 font-medium">Prontos para reutilização em conversões</p>
        </div>
      </div>

      {/* History Table Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
              Histórico de Extratos Convertidos ({filteredHistory.length})
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Acesse e baixe novamente qualquer arquivo CNAB de extrato gerado anteriormente.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar no histórico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-emerald-600 font-medium"
              />
            </div>

            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {filteredHistory.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-black uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Data e Hora</th>
                  <th className="px-4 py-3">Arquivo Original</th>
                  <th className="px-4 py-3">Arquivo CNAB Gerado</th>
                  <th className="px-4 py-3">Layout Utilizado</th>
                  <th className="px-4 py-3">Lançamentos</th>
                  <th className="px-4 py-3 text-right">Créditos</th>
                  <th className="px-4 py-3 text-right">Débitos</th>
                  <th className="px-4 py-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {new Date(item.dataConversao).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{item.nomeArquivoOriginal}</td>
                    <td className="px-4 py-3 font-mono text-emerald-700 font-bold">{item.nomeArquivoCNAB}</td>
                    <td className="px-4 py-3 text-slate-600">{item.layoutNome}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-700">{item.qtdLancamentos} itens</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 font-bold">
                      {formatCurrencyBRL(item.totalCreditos)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-600 font-bold">
                      {formatCurrencyBRL(item.totalDebitos)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDownloadFromHistory(item)}
                        className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title="Baixar arquivo CNAB de extrato"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 font-medium text-xs">
            Nenhum histórico de conversão de extrato encontrado.
          </div>
        )}
      </div>
    </div>
  );
};
