import React from 'react';
import { 
  PanelLeft, 
  PanelLeftClose, 
  Sparkles, 
  Download, 
  Plus, 
  UploadCloud, 
  Settings2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { CompanySettings, CompanyProfile } from '../types';
import { getBankInfo } from '../utils/banks';

interface AppleTopNavProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  title: string;
  subtitle?: string;
  selectedBoletosCount: number;
  totalSelectedValor: number;
  onQuickGenerateCNAB: () => void;
  onOpenPDFModal: () => void;
  onOpenBatchModal: () => void;
  onOpenNewModal: () => void;
  activeTab: string;
}

export const AppleTopNav: React.FC<AppleTopNavProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  title,
  subtitle,
  selectedBoletosCount,
  totalSelectedValor,
  onQuickGenerateCNAB,
  onOpenPDFModal,
  onOpenBatchModal,
  onOpenNewModal,
  activeTab,
}) => {
  return (
    <header className="h-16 px-4 sm:px-6 bg-[#fbfbfd]/80 dark:bg-[#161618]/80 backdrop-blur-2xl border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between sticky top-0 z-30 transition-all">
      {/* Left: Sidebar Toggle + Title */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          title={isSidebarOpen ? 'Recolher Barra Lateral' : 'Expandir Barra Lateral'}
        >
          <PanelLeft className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none">
              {title}
            </h1>
            {subtitle && (
              <span className="hidden sm:inline text-xs font-semibold px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-slate-500 dark:text-slate-400">
                {subtitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Apple Primary Actions / Pill Buttons */}
      <div className="flex items-center space-x-2">
        {/* Quick Add Button */}
        {activeTab === 'boletos' && (
          <>
            <button
              type="button"
              onClick={onOpenNewModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 text-xs font-semibold border border-black/[0.05] dark:border-white/[0.06] transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-blue-500" />
              <span>Novo Boleto</span>
            </button>

            <button
              type="button"
              onClick={onOpenBatchModal}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 text-xs font-semibold border border-black/[0.05] dark:border-white/[0.06] transition-all active:scale-[0.98] cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Colar em Lote</span>
            </button>
          </>
        )}

        {/* Generate CNAB Action Button if selected */}
        {selectedBoletosCount > 0 && (
          <button
            type="button"
            onClick={onQuickGenerateCNAB}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Gerar CNAB ({selectedBoletosCount})</span>
          </button>
        )}
      </div>
    </header>
  );
};
