import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Brain,
  BarChart3,
  Building2,
  Sparkles,
  Layers,
} from 'lucide-react';
import { CompanySettings } from '../../types';
import { ExcelToCnabExtratoView } from './ExcelToCnabExtratoView';
import { ModelCnabAnalyzerView } from './ModelCnabAnalyzerView';
import { ExtratoDashboardAndHistoryView } from './ExtratoDashboardAndHistoryView';

interface ExtratoBancarioMainPanelProps {
  company: CompanySettings;
  onShowToast?: (msg: string) => void;
}

export const ExtratoBancarioMainPanel: React.FC<ExtratoBancarioMainPanelProps> = ({
  company,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'EXCEL_CONVERT' | 'MODEL_LEARN' | 'DASHBOARD'>(
    'EXCEL_CONVERT'
  );

  return (
    <div className="space-y-6">
      {/* Tab Navigation Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => setActiveTab('EXCEL_CONVERT')}
            className={`p-3.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'EXCEL_CONVERT'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Opção 1: Planilha Excel → CNAB</span>
          </button>

          <button
            onClick={() => setActiveTab('MODEL_LEARN')}
            className={`p-3.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'MODEL_LEARN'
                ? 'bg-purple-700 text-white shadow-lg shadow-purple-700/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>Opção 2: CNAB Modelo (Análise & IA)</span>
          </button>

          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`p-3.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'DASHBOARD'
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Painel, Gráficos & Histórico</span>
          </button>
        </div>
      </div>

      {/* Main Content Render */}
      {activeTab === 'EXCEL_CONVERT' && (
        <ExcelToCnabExtratoView company={company} onShowToast={onShowToast} />
      )}

      {activeTab === 'MODEL_LEARN' && (
        <ModelCnabAnalyzerView onShowToast={onShowToast} />
      )}

      {activeTab === 'DASHBOARD' && (
        <ExtratoDashboardAndHistoryView />
      )}
    </div>
  );
};
