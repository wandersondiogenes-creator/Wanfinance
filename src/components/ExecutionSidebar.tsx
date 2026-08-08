import React, { useState, useRef } from 'react';
import { CompanySettings, BoletoItem, CNABBatchHistory } from '../types';
import { formatCurrencyBRL } from '../utils/boletoParser';
import { getBankInfo } from '../utils/banks';
import {
  Download,
  Sparkles,
  Copy,
  Plus,
  Trash2,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle,
  FileText,
  UploadCloud,
  CheckSquare,
  Square,
  Clock,
  TrendingDown,
  TrendingUp,
  CreditCard,
} from 'lucide-react';

interface ExecutionSidebarProps {
  company: CompanySettings;
  boletos: BoletoItem[];
  history?: CNABBatchHistory[];
  onGenerateCNAB: () => void;
  onOpenPDFModal: () => void;
  onOpenBatchModal: () => void;
  onOpenNewModal: () => void;
  onSelectAll: (select: boolean) => void;
  onDeleteSelected: () => void;
  onBatchUpdatePaymentDate?: (date: string) => void;
  filterType: 'ALL' | 'DISCOUNT' | 'INTEREST' | 'DUPLICATE' | 'OVERDUE';
  setFilterType: (type: 'ALL' | 'DISCOUNT' | 'INTEREST' | 'DUPLICATE' | 'OVERDUE') => void;
  duplicateCount: number;
  overdueCount: number;
  discountCount: number;
  interestCount: number;
  onDirectPDFDrop?: (files: FileList) => void;
}

export const ExecutionSidebar: React.FC<ExecutionSidebarProps> = ({
  company,
  boletos,
  history = [],
  onGenerateCNAB,
  onOpenPDFModal,
  onOpenBatchModal,
  onOpenNewModal,
  onSelectAll,
  onDeleteSelected,
  onBatchUpdatePaymentDate,
  filterType,
  setFilterType,
  duplicateCount,
  overdueCount,
  discountCount,
  interestCount,
  onDirectPDFDrop,
}) => {
  const [batchDate, setBatchDate] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const bankInfo = getBankInfo(company.bancoCodigo);

  const selectedBoletos = boletos.filter((b) => b.selected && b.isValid);
  const totalSelectedValor = selectedBoletos.reduce(
    (acc, b) => acc + (b.valor - (b.desconto || 0) + (b.jurosMulta || 0)),
    0
  );

  const allSelected = boletos.length > 0 && boletos.every((b) => b.selected);
  const someSelected = boletos.some((b) => b.selected);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (onDirectPDFDrop) {
        onDirectPDFDrop(e.dataTransfer.files);
      } else {
        onOpenPDFModal();
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (onDirectPDFDrop) {
        onDirectPDFDrop(e.target.files);
      } else {
        onOpenPDFModal();
      }
    }
  };

  return (
    <aside className="w-full lg:w-80 xl:w-96 shrink-0 space-y-5">
      {/* Container Principal do Painel de Execução */}
      <div className="bg-[#0f141d] text-slate-100 rounded-3xl p-5 border border-slate-800 shadow-2xl space-y-5 sticky top-24">
        {/* Painel Title */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-white uppercase">
                Painel de Execução
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">Controle de Lote & Remessa</p>
            </div>
          </div>
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
            CNAB {company.padraoCNAB}
          </span>
        </div>

        {/* Card Destaque: Boletos Selecionados & Botão de Processar CNAB */}
        <div className="bg-gradient-to-b from-[#1a2334] to-[#121927] rounded-2xl p-4 border border-amber-500/30 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none"></div>

          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Total do Lote Selecionado
          </p>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-amber-400 font-mono tracking-tight">
              {formatCurrencyBRL(totalSelectedValor)}
            </span>
            <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {selectedBoletos.length} / {boletos.length}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col gap-2">
            <button
              onClick={onGenerateCNAB}
              disabled={selectedBoletos.length === 0}
              className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 disabled:opacity-30 disabled:pointer-events-none text-slate-950 font-black text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>Gerar Arquivo CNAB ({selectedBoletos.length})</span>
            </button>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Arquivo NSA: <strong className="text-slate-200">#{company.nsa}</strong></span>
              <span>Banco: <strong className="text-amber-400">[{company.bancoCodigo}] {bankInfo.shortName}</strong></span>
            </div>
          </div>
        </div>

        {/* Zona de Inserção / Upload Rápido de Boletos */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Inserir Boletos</span>
            <span className="text-[10px] text-emerald-400">IA & Lote Ativos</span>
          </p>

          {/* Drag & Drop Quick Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-3.5 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-amber-400 bg-amber-500/10 text-amber-300 scale-[1.02]'
                : 'border-slate-800 bg-[#141b27] hover:border-slate-700 hover:bg-[#182130] text-slate-300'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept=".pdf,image/*"
              multiple
              className="hidden"
            />
            <div className="flex items-center justify-center space-x-2">
              <UploadCloud className="w-5 h-5 text-amber-400 animate-bounce" />
              <p className="text-xs font-bold text-slate-200">
                Arraste PDFs ou fotos de boletos
              </p>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Extração automática de favorecido, valor e linha digitável por Inteligência Artificial
            </p>
          </div>

          {/* Quick Add Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={onOpenPDFModal}
              className="bg-[#1a2334] hover:bg-[#222d42] border border-slate-700 text-amber-300 text-xs font-bold p-2.5 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Extrair PDF (IA)</span>
            </button>

            <button
              onClick={onOpenBatchModal}
              className="bg-[#1a2334] hover:bg-[#222d42] border border-slate-700 text-emerald-300 text-xs font-bold p-2.5 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-400" />
              <span>Colar em Lote</span>
            </button>
          </div>

          <button
            onClick={onOpenNewModal}
            className="w-full bg-[#161e2c] hover:bg-[#1f2a3e] border border-slate-800 text-slate-200 text-xs font-bold p-2.5 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Novo Boleto Manual</span>
          </button>
        </div>

        {/* Operações em Lote */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Ações do Lote
          </p>

          <div className="flex items-center justify-between text-xs bg-[#141b27] p-2 rounded-xl border border-slate-800">
            <button
              onClick={() => onSelectAll(!allSelected)}
              className="flex items-center space-x-2 text-slate-300 hover:text-white font-semibold cursor-pointer"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-amber-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>{allSelected ? 'Desmarcar Todos' : 'Marcar Todos'}</span>
            </button>

            {someSelected && (
              <button
                onClick={onDeleteSelected}
                className="text-rose-400 hover:text-rose-300 font-bold flex items-center space-x-1 text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir</span>
              </button>
            )}
          </div>

          {/* Alterar Data de Pagamento em Lote */}
          <div className="bg-[#141b27] p-2.5 rounded-2xl border border-slate-800 space-y-2">
            <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Mudar Data Pgto em Lote</span>
            </p>
            <div className="flex items-center space-x-1.5">
              <input
                type="date"
                value={batchDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setBatchDate(e.target.value)}
                className="flex-1 bg-[#0a0e16] border border-slate-700 text-amber-300 font-mono text-xs px-2 py-1.5 rounded-xl focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => {
                  if (batchDate && onBatchUpdatePaymentDate) {
                    onBatchUpdatePaymentDate(batchDate);
                    setBatchDate('');
                  }
                }}
                disabled={!batchDate || selectedBoletos.length === 0}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>

        {/* Filtros Rápidos por Alerta */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Filtros por Categoria
          </p>

          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              onClick={() => setFilterType('ALL')}
              className={`p-2 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                filterType === 'ALL'
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-[#141b27] text-slate-300 border-slate-800 hover:bg-[#1c2637]'
              }`}
            >
              Todos ({boletos.length})
            </button>

            {overdueCount > 0 && (
              <button
                onClick={() => setFilterType(filterType === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
                className={`p-2 rounded-xl border text-left font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  filterType === 'OVERDUE'
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/60'
                }`}
              >
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">Vencidos ({overdueCount})</span>
              </button>
            )}

            {duplicateCount > 0 && (
              <button
                onClick={() => setFilterType(filterType === 'DUPLICATE' ? 'ALL' : 'DUPLICATE')}
                className={`p-2 rounded-xl border text-left font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  filterType === 'DUPLICATE'
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/60'
                }`}
              >
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="truncate">Repetidos ({duplicateCount})</span>
              </button>
            )}

            {discountCount > 0 && (
              <button
                onClick={() => setFilterType(filterType === 'DISCOUNT' ? 'ALL' : 'DISCOUNT')}
                className={`p-2 rounded-xl border text-left font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  filterType === 'DISCOUNT'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                }`}
              >
                <TrendingDown className="w-3 h-3 shrink-0" />
                <span className="truncate">Descontos ({discountCount})</span>
              </button>
            )}

            {interestCount > 0 && (
              <button
                onClick={() => setFilterType(filterType === 'INTEREST' ? 'ALL' : 'INTEREST')}
                className={`p-2 rounded-xl border text-left font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  filterType === 'INTEREST'
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/60'
                }`}
              >
                <TrendingUp className="w-3 h-3 shrink-0" />
                <span className="truncate">Juros ({interestCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Resumo da Empresa e Banco Ativos */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
          <div className="flex items-center space-x-2 text-slate-300 font-bold">
            <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{company.razaoSocial}</span>
          </div>
          <p className="text-[11px] text-slate-400 pl-5">
            CNPJ: <span className="font-mono text-slate-300">{company.cnpjCpf}</span>
          </p>
          <p className="text-[11px] text-slate-400 pl-5">
            Ag/Cc: <span className="font-mono text-slate-300">{company.agencia} / {company.conta}</span>
          </p>
        </div>
      </div>
    </aside>
  );
};
