import React, { useState, useMemo } from 'react';
import { BoletoItem, CNABBatchHistory } from '../types';
import { formatCurrencyBRL, formatDateBR, formatLinhaDigitavelDisplay } from '../utils/boletoParser';
import { getBankInfo } from '../utils/banks';
import { Search, Filter, Trash2, Edit2, Download, AlertCircle, CheckCircle, Plus, Copy, FileText, CheckSquare, Square, Sparkles, FileUp, AlertTriangle, TrendingDown, TrendingUp, Clock, Tag, Percent, Calendar, ChevronDown, PlusCircle, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getBoletosDuplicateMap } from '../utils/duplicateDetector';

export type SortColumn = 'banco' | 'favorecido' | 'seuNumero' | 'vencimento' | 'pagamento' | 'valor' | 'status';
export type SortOrder = 'asc' | 'desc';

interface BoletoTableProps {
  boletos: BoletoItem[];
  history?: CNABBatchHistory[];
  filterType?: 'ALL' | 'DISCOUNT' | 'INTEREST' | 'DUPLICATE' | 'OVERDUE' | 'HIGH_VALUE';
  setFilterType?: (type: 'ALL' | 'DISCOUNT' | 'INTEREST' | 'DUPLICATE' | 'OVERDUE' | 'HIGH_VALUE') => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: (select: boolean) => void;
  onDeleteBoleto: (id: string) => void;
  onDeleteSelected: () => void;
  onEditBoleto: (boleto: BoletoItem) => void;
  onDuplicateBoleto: (boleto: BoletoItem) => void;
  onOpenNewModal: () => void;
  onOpenBatchModal: () => void;
  onOpenPDFModal: () => void;
  onOpenSmartExtractor?: () => void;
  onGenerateCNAB: () => void;
  onBatchUpdatePaymentDate?: (date: string) => void;
}

export const BoletoTable: React.FC<BoletoTableProps> = ({
  boletos,
  history = [],
  filterType: propFilterType,
  setFilterType: propSetFilterType,
  onToggleSelect,
  onSelectAll,
  onDeleteBoleto,
  onDeleteSelected,
  onEditBoleto,
  onDuplicateBoleto,
  onOpenNewModal,
  onOpenBatchModal,
  onOpenPDFModal,
  onOpenSmartExtractor,
  onGenerateCNAB,
  onBatchUpdatePaymentDate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [bankFilter, setBankFilter] = useState('ALL');
  const [internalFilterType, setInternalFilterType] = useState<'ALL' | 'DISCOUNT' | 'INTEREST' | 'DUPLICATE' | 'OVERDUE' | 'HIGH_VALUE'>('ALL');

  const filterType = propFilterType !== undefined ? propFilterType : internalFilterType;
  const setFilterType = propSetFilterType || setInternalFilterType;
  const [batchPayDateInput, setBatchPayDateInput] = useState<string>('');
  const [showInsertMenu, setShowInsertMenu] = useState(false);

  // Column sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>('vencimento');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Calculate duplicate map across all boletos
  const duplicatesMap = useMemo(() => {
    return getBoletosDuplicateMap(boletos, [], history);
  }, [boletos, history]);

  const duplicateCount = useMemo(() => {
    let count = 0;
    duplicatesMap.forEach((dup) => {
      if (dup.isDuplicate) count++;
    });
    return count;
  }, [duplicatesMap]);

  const duplicateBoletosList = useMemo(() => {
    const list: Array<{
      boleto: BoletoItem;
      reason: string;
      filename?: string;
    }> = [];

    boletos.forEach((b) => {
      const dupInfo = duplicatesMap.get(b.id);
      if (dupInfo && dupInfo.isDuplicate) {
        let reason = '';
        if (dupInfo.isHistoryDuplicate) {
          reason = 'Já enviado em remessa CNAB anterior';
        } else if (dupInfo.isSameBatchDuplicate) {
          reason = 'Duplicado na mesma lista (mesmo lote)';
        } else {
          reason = 'Duplicado no sistema';
        }
        list.push({
          boleto: b,
          reason,
          filename: dupInfo.matchedBatchFilename,
        });
      }
    });

    return list;
  }, [boletos, duplicatesMap]);

  // Discount & Interest Statistics
  const discountBoletos = useMemo(() => boletos.filter((b) => (b.desconto || 0) > 0), [boletos]);
  const totalDiscountVal = useMemo(
    () => discountBoletos.reduce((acc, b) => acc + (b.desconto || 0), 0),
    [discountBoletos]
  );

  const interestBoletos = useMemo(() => boletos.filter((b) => (b.jurosMulta || 0) > 0), [boletos]);
  const totalInterestVal = useMemo(
    () => interestBoletos.reduce((acc, b) => acc + (b.jurosMulta || 0), 0),
    [interestBoletos]
  );

  const overdueBoletos = useMemo(
    () => boletos.filter((b) => b.dataVencimento < todayStr),
    [boletos, todayStr]
  );

  // High Value (> R$ 250.000,00) Boletos Alert Statistics
  const highValueBoletos = useMemo(
    () => boletos.filter((b) => (b.valor - (b.desconto || 0) + (b.jurosMulta || 0)) >= 250000 || b.valor >= 250000),
    [boletos]
  );
  const totalHighValueVal = useMemo(
    () => highValueBoletos.reduce((acc, b) => acc + (b.valor - (b.desconto || 0) + (b.jurosMulta || 0)), 0),
    [highValueBoletos]
  );

  // Filter logic
  const filteredBoletos = useMemo(() => {
    return boletos.filter((b) => {
      const matchSearch =
        b.favorecidoNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.linhaDigitavel.includes(searchTerm) ||
        (b.seuNumero && b.seuNumero.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (b.categoria && b.categoria.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchBank = bankFilter === 'ALL' || b.bancoCodigo === bankFilter;

      const dupInfo = duplicatesMap.get(b.id);

      let matchFilterType = true;
      if (filterType === 'DISCOUNT') matchFilterType = (b.desconto || 0) > 0;
      if (filterType === 'INTEREST') matchFilterType = (b.jurosMulta || 0) > 0;
      if (filterType === 'DUPLICATE') matchFilterType = !!(dupInfo && dupInfo.isDuplicate);
      if (filterType === 'OVERDUE') matchFilterType = b.dataVencimento < todayStr;
      if (filterType === 'HIGH_VALUE')
        matchFilterType = (b.valor - (b.desconto || 0) + (b.jurosMulta || 0)) >= 250000 || b.valor >= 250000;

      return matchSearch && matchBank && matchFilterType;
    });
  }, [boletos, searchTerm, bankFilter, filterType, duplicatesMap, todayStr]);

  // Sort filtered boletos according to sortColumn and sortOrder
  const sortedBoletos = useMemo(() => {
    const list = [...filteredBoletos];

    list.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'banco': {
          const bankA = getBankInfo(a.bancoCodigo).shortName;
          const bankB = getBankInfo(b.bancoCodigo).shortName;
          comparison = bankA.localeCompare(bankB, 'pt-BR');
          if (comparison === 0) comparison = a.bancoCodigo.localeCompare(b.bancoCodigo);
          break;
        }
        case 'favorecido': {
          comparison = (a.favorecidoNome || '').localeCompare(b.favorecidoNome || '', 'pt-BR');
          break;
        }
        case 'seuNumero': {
          comparison = (a.seuNumero || '').localeCompare(b.seuNumero || '', 'pt-BR');
          break;
        }
        case 'vencimento': {
          comparison = (a.dataVencimento || '').localeCompare(b.dataVencimento || '');
          break;
        }
        case 'pagamento': {
          const dateA = a.dataPagamento || a.dataVencimento || '';
          const dateB = b.dataPagamento || b.dataVencimento || '';
          comparison = dateA.localeCompare(dateB);
          break;
        }
        case 'valor': {
          const valA = a.valor - (a.desconto || 0) + (a.jurosMulta || 0);
          const valB = b.valor - (b.desconto || 0) + (b.jurosMulta || 0);
          comparison = valA - valB;
          break;
        }
        case 'status': {
          const statusA = a.isValid ? 1 : 0;
          const statusB = b.isValid ? 1 : 0;
          comparison = statusA - statusB;
          break;
        }
        default:
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [filteredBoletos, sortColumn, sortOrder]);

  // Unique bank codes for filter
  const availableBanks = useMemo(() => {
    const set = new Set(boletos.map((b) => b.bancoCodigo));
    return Array.from(set);
  }, [boletos]);

  // Selected stats
  const selectedBoletos = useMemo(() => boletos.filter((b) => b.selected && b.isValid), [boletos]);
  const totalValorSelected = useMemo(
    () => selectedBoletos.reduce((acc, b) => acc + (b.valor - (b.desconto || 0) + (b.jurosMulta || 0)), 0),
    [selectedBoletos]
  );

  const allSelected = boletos.length > 0 && boletos.every((b) => b.selected);
  const someSelected = boletos.some((b) => b.selected);

  const invalidCount = useMemo(() => boletos.filter((b) => !b.isValid).length, [boletos]);

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total de Boletos</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{boletos.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Boletos Selecionados</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {selectedBoletos.length} <span className="text-xs text-slate-400 font-normal">/ {boletos.length}</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Valor Total Selecionado</p>
            <p className="text-2xl font-black text-blue-700 mt-1">{formatCurrencyBRL(totalValorSelected)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold font-mono">
            R$
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Status de Validação</p>
            {invalidCount === 0 ? (
              <p className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Todos Válidos
              </p>
            ) : (
              <p className="text-sm font-bold text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {invalidCount} com Alerta
              </p>
            )}
          </div>
          <button
            onClick={onGenerateCNAB}
            disabled={selectedBoletos.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Gerar CNAB</span>
          </button>
        </div>
      </div>

      {/* Discount & Interest Alert Banners */}
      {discountBoletos.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-900 text-xs shadow-xs">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                <span>🎁 Alerta de Descontos Concedidos</span>
                <span className="bg-emerald-200 text-emerald-900 border border-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {discountBoletos.length} boleto(s)
                </span>
              </p>
              <p className="text-slate-600 mt-0.5">
                Economia total estimada em <strong className="text-emerald-800 font-mono font-bold">{formatCurrencyBRL(totalDiscountVal)}</strong> de desconto aplicado sobre os valores brutos.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterType(filterType === 'DISCOUNT' ? 'ALL' : 'DISCOUNT')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all border text-xs shrink-0 cursor-pointer ${
              filterType === 'DISCOUNT'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {filterType === 'DISCOUNT' ? 'Ver Todos os Boletos' : `Filtrar os ${discountBoletos.length} com Desconto`}
          </button>
        </div>
      )}

      {interestBoletos.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs shadow-xs">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-amber-800 text-sm flex items-center gap-1.5">
                <span>⚡ Alerta de Juros e Multas Aplicados</span>
                <span className="bg-amber-200 text-amber-900 border border-amber-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {interestBoletos.length} boleto(s)
                </span>
              </p>
              <p className="text-slate-600 mt-0.5">
                Acréscimo total de <strong className="text-amber-800 font-mono font-bold">{formatCurrencyBRL(totalInterestVal)}</strong> decorrente de juros ou multas por atraso.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterType(filterType === 'INTEREST' ? 'ALL' : 'INTEREST')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all border text-xs shrink-0 cursor-pointer ${
              filterType === 'INTEREST'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            {filterType === 'INTEREST' ? 'Ver Todos os Boletos' : `Filtrar os ${interestBoletos.length} com Juros/Multa`}
          </button>
        </div>
      )}

      {/* High Value (> R$ 250k) Alert Banner */}
      {highValueBoletos.length > 0 && (
        <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-purple-950 text-xs shadow-xs">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-purple-950 text-sm flex items-center gap-1.5">
                <span>⚡ ALERTA DE ALTA ALÇADA: {highValueBoletos.length} boleto(s) acima de R$ 250.000,00</span>
                <span className="bg-purple-200 text-purple-950 border border-purple-300 text-[10px] font-mono font-black px-2 py-0.5 rounded-full">
                  {formatCurrencyBRL(totalHighValueVal)}
                </span>
              </p>
              <p className="text-purple-900 mt-0.5 font-medium">
                Boletos com valor igual ou superior a R$ 250.000,00 exigem atenção e autorização prévia de diretoria/alçada antes de gerar a remessa de pagamento.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterType(filterType === 'HIGH_VALUE' ? 'ALL' : 'HIGH_VALUE')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all border text-xs shrink-0 cursor-pointer ${
              filterType === 'HIGH_VALUE'
                ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                : 'bg-white text-purple-900 border-purple-300 hover:bg-purple-100'
            }`}
          >
            {filterType === 'HIGH_VALUE' ? 'Ver Todos os Boletos' : `Filtrar os ${highValueBoletos.length} com Valor > R$ 250k`}
          </button>
        </div>
      )}

      {/* Duplicate Alert Banner */}
      {duplicateCount > 0 && (
        <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-4 flex flex-col gap-3 text-orange-950 text-xs shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-black text-orange-950 text-base">
                  Atenção: {duplicateCount} boleto(s) repetido(s) ou já enviado(s)
                </p>
                <p className="text-orange-900 text-xs mt-0.5 font-medium">
                  Lista detalhada de boletos duplicados, motivo da duplicidade e nome do arquivo de remessa original:
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => setFilterType(filterType === 'DUPLICATE' ? 'ALL' : 'DUPLICATE')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all border text-xs cursor-pointer ${
                  filterType === 'DUPLICATE'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                    : 'bg-white text-orange-900 border-orange-300 hover:bg-orange-100'
                }`}
              >
                {filterType === 'DUPLICATE' ? 'Ver Todos os Boletos' : `Filtrar Apenas Repetidos (${duplicateCount})`}
              </button>
            </div>
          </div>

          {/* Breakdown List of Repeated Boletos */}
          <div className="mt-1 pt-3 border-t border-orange-200 space-y-2">
            <p className="font-bold text-orange-950 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <span>Detalhamento dos Boletos Repetidos e Origem:</span>
            </p>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
              {duplicateBoletosList.map(({ boleto, reason, filename }, idx) => (
                <div
                  key={boleto.id || idx}
                  className="bg-white/95 border-2 border-orange-300 rounded-xl p-2.5 text-xs text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs hover:border-orange-400 transition-all"
                >
                  <div className="flex items-start space-x-2.5 min-w-0">
                    <span className="font-mono text-[11px] bg-orange-500 text-white font-bold px-2 py-0.5 rounded-lg shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="font-extrabold text-slate-900 truncate max-w-[260px]">
                          {boleto.favorecidoNome || 'Beneficiário'}
                        </span>
                        {boleto.seuNumero && (
                          <span className="text-[11px] text-slate-500 font-mono font-medium">
                            Doc: {boleto.seuNumero}
                          </span>
                        )}
                        <span className="font-black text-orange-700 font-mono text-sm">
                          {formatCurrencyBRL(boleto.valor - (boleto.desconto || 0) + (boleto.jurosMulta || 0))}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1">
                          <strong className="text-slate-800">Motivo:</strong>{' '}
                          <span className="text-orange-950 font-semibold">{reason}</span>
                        </span>
                        {filename ? (
                          <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-950 border border-orange-300 font-mono font-bold px-2 py-0.5 rounded-md text-[10px]">
                            📄 Arquivo: {filename}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold px-2 py-0.5 rounded-md text-[10px]">
                            Lote Atual (Lista)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSearchTerm(boleto.seuNumero || boleto.favorecidoNome || boleto.linhaDigitavel);
                      setFilterType('DUPLICATE');
                    }}
                    className="text-[11px] font-bold text-orange-800 hover:text-orange-950 hover:underline shrink-0 self-end sm:self-center cursor-pointer bg-orange-100 hover:bg-orange-200 px-2.5 py-1 rounded-lg border border-orange-300 transition-all"
                  >
                    Localizar Boleto →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Filter Pills Toolbar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500 font-bold mr-1">Filtrar por Alertas:</span>
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
            filterType === 'ALL'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Todos ({boletos.length})
        </button>

        {discountBoletos.length > 0 && (
          <button
            onClick={() => setFilterType(filterType === 'DISCOUNT' ? 'ALL' : 'DISCOUNT')}
            className={`px-3 py-1.5 rounded-xl font-bold border flex items-center space-x-1.5 transition-all cursor-pointer ${
              filterType === 'DISCOUNT'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Com Desconto ({discountBoletos.length})</span>
          </button>
        )}

        {interestBoletos.length > 0 && (
          <button
            onClick={() => setFilterType(filterType === 'INTEREST' ? 'ALL' : 'INTEREST')}
            className={`px-3 py-1.5 rounded-xl font-bold border flex items-center space-x-1.5 transition-all cursor-pointer ${
              filterType === 'INTEREST'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Com Juros/Multa ({interestBoletos.length})</span>
          </button>
        )}

        {overdueBoletos.length > 0 && (
          <button
            onClick={() => setFilterType(filterType === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
            className={`px-3 py-1.5 rounded-xl font-bold border flex items-center space-x-1.5 transition-all cursor-pointer ${
              filterType === 'OVERDUE'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Vencidos ({overdueBoletos.length})</span>
          </button>
        )}

        {duplicateCount > 0 && (
          <button
            onClick={() => setFilterType(filterType === 'DUPLICATE' ? 'ALL' : 'DUPLICATE')}
            className={`px-3 py-1.5 rounded-xl font-bold border flex items-center space-x-1.5 transition-all cursor-pointer ${
              filterType === 'DUPLICATE'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Repetidos ({duplicateCount})</span>
          </button>
        )}

        {highValueBoletos.length > 0 && (
          <button
            onClick={() => setFilterType(filterType === 'HIGH_VALUE' ? 'ALL' : 'HIGH_VALUE')}
            className={`px-3 py-1.5 rounded-xl font-bold border flex items-center space-x-1.5 transition-all cursor-pointer ${
              filterType === 'HIGH_VALUE'
                ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                : 'bg-purple-50 text-purple-900 border-purple-300 hover:bg-purple-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Alta Alçada (&gt; R$ 250k) ({highValueBoletos.length})</span>
          </button>
        )}
      </div>

      {/* Sticky / Highlighted Selection Banner when items are selected */}
      {someSelected && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{selectedBoletos.length} boleto(s) selecionado(s) no lote</span>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
                  {formatCurrencyBRL(totalValorSelected)}
                </span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Você pode inserir mais boletos neste lote antes de gerar e processar o arquivo CNAB.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
            {/* Insert More Boletos Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowInsertMenu(!showInsertMenu)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center space-x-2 border border-emerald-500 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-emerald-100 animate-pulse" />
                <span>+ Inserir Mais Boletos</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showInsertMenu && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100"
                  onMouseLeave={() => setShowInsertMenu(false)}
                >
                  <div className="p-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowInsertMenu(false);
                        onOpenPDFModal();
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-slate-800 hover:bg-blue-50 rounded-xl transition-colors flex items-center space-x-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-slate-900 font-bold">Extrair via PDF (IA)</p>
                        <p className="text-[10px] text-slate-500 font-normal">Enviar arquivo PDF ou imagem</p>
                      </div>
                    </button>

                    {onOpenSmartExtractor && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowInsertMenu(false);
                          onOpenSmartExtractor();
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-800 hover:bg-indigo-50 rounded-xl transition-colors flex items-center space-x-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <div>
                          <p className="text-slate-900 font-bold">Extração Inteligente</p>
                          <p className="text-[10px] text-slate-500 font-normal">Reconhecimento por tipo de documento</p>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowInsertMenu(false);
                        onOpenBatchModal();
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-slate-800 hover:bg-emerald-50 rounded-xl transition-colors flex items-center space-x-2 cursor-pointer"
                    >
                      <Copy className="w-4 h-4 text-emerald-600" />
                      <div>
                        <p className="text-slate-900 font-bold">Colar Várias Linhas</p>
                        <p className="text-[10px] text-slate-500 font-normal">Importar em lote via texto</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowInsertMenu(false);
                        onOpenNewModal();
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-slate-800 hover:bg-amber-50 rounded-xl transition-colors flex items-center space-x-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-amber-600" />
                      <div>
                        <p className="text-slate-900 font-bold">Digitado Manualmente</p>
                        <p className="text-[10px] text-slate-500 font-normal">Preencher formulário individual</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Batch Payment Date Input */}
            <div className="flex items-center space-x-1.5 bg-white border border-blue-300 p-1.5 rounded-xl text-xs shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-blue-600 ml-1 shrink-0" />
              <input
                type="date"
                value={batchPayDateInput}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setBatchPayDateInput(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-blue-900 font-mono text-xs px-2 py-1 rounded-lg focus:outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={() => {
                  if (batchPayDateInput && onBatchUpdatePaymentDate) {
                    onBatchUpdatePaymentDate(batchPayDateInput);
                    setBatchPayDateInput('');
                  }
                }}
                disabled={!batchPayDateInput}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold px-2.5 py-1 rounded-lg text-xs transition-all shrink-0 cursor-pointer"
              >
                Data Pgto ({selectedBoletos.length})
              </button>
            </div>

            <button
              onClick={onDeleteSelected}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-2.5 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir</span>
            </button>

            <button
              onClick={onGenerateCNAB}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center space-x-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Processar & Gerar CNAB ({selectedBoletos.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Action Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por favorecido, linha digitável, ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-blue-600 focus:bg-white placeholder-slate-400 font-medium"
            />
          </div>

          {/* Bank Select Filter */}
          <div className="relative">
            <select
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="ALL">Todos os Bancos ({boletos.length})</option>
              {availableBanks.map((code) => {
                const info = getBankInfo(code);
                const count = boletos.filter((b) => b.bancoCodigo === code).length;
                return (
                  <option key={code} value={code}>
                    [{code}] {info.shortName} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Column Sort Dropdown */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-slate-500 font-bold hidden sm:inline">Ordem:</span>
            <select
              value={sortColumn}
              onChange={(e) => setSortColumn(e.target.value as SortColumn)}
              className="bg-transparent text-slate-800 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="vencimento" className="bg-white text-slate-800">Data Vencimento</option>
              <option value="pagamento" className="bg-white text-slate-800">Data Pagamento</option>
              <option value="favorecido" className="bg-white text-slate-800">Favorecido (Nome)</option>
              <option value="valor" className="bg-white text-slate-800">Valor Final</option>
              <option value="banco" className="bg-white text-slate-800">Banco</option>
              <option value="seuNumero" className="bg-white text-slate-800">Seu Número / Ref</option>
              <option value="status" className="bg-white text-slate-800">Status de Validação</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={sortOrder === 'asc' ? 'Ordem Crescente' : 'Ordem Decrescente'}
              className="p-1 hover:bg-slate-200 rounded-lg text-blue-700 font-mono font-bold text-[11px] transition-colors cursor-pointer"
            >
              {sortOrder === 'asc' ? '▲ ASC' : '▼ DESC'}
            </button>
          </div>

          {/* Duplicate Filter Toggle Button */}
          {duplicateCount > 0 && (
            <button
              onClick={() => setFilterType(filterType === 'DUPLICATE' ? 'ALL' : 'DUPLICATE')}
              className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center space-x-1.5 transition-colors cursor-pointer ${
                filterType === 'DUPLICATE'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Repetidos ({duplicateCount})</span>
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={onOpenPDFModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
            title="Extrair boletos via PDF com IA tradicional"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-100 animate-pulse" />
            <span>Extrair PDF (IA)</span>
          </button>

          {onOpenSmartExtractor && (
            <button
              onClick={onOpenSmartExtractor}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
              title="Acessar painel de Extração Inteligente com detecção de tipos"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Extração Inteligente</span>
            </button>
          )}

          <button
            onClick={onOpenBatchModal}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-blue-600" />
            <span>Colar Vários</span>
          </button>

          <button
            onClick={onOpenNewModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Boleto</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 select-none font-bold">
              <tr>
                <th className="p-4 w-10">
                  <button
                    onClick={() => onSelectAll(!allSelected)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>

                {/* Banco */}
                <th className="p-4">
                  <button
                    type="button"
                    onClick={() => handleSort('banco')}
                    className={`flex items-center space-x-1 hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider ${
                      sortColumn === 'banco' ? 'text-blue-700 font-black' : 'text-slate-600 font-bold'
                    }`}
                  >
                    <span>Banco</span>
                    {sortColumn === 'banco' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>
                </th>

                {/* Favorecido / Linha Digitável */}
                <th className="p-4">
                  <button
                    type="button"
                    onClick={() => handleSort('favorecido')}
                    className={`flex items-center space-x-1 hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider ${
                      sortColumn === 'favorecido' ? 'text-blue-700 font-black' : 'text-slate-600 font-bold'
                    }`}
                  >
                    <span>Favorecido / Linha Digitável</span>
                    {sortColumn === 'favorecido' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>
                </th>

                {/* Seu Número */}
                <th className="p-4">
                  <button
                    type="button"
                    onClick={() => handleSort('seuNumero')}
                    className={`flex items-center space-x-1 hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider ${
                      sortColumn === 'seuNumero' ? 'text-blue-700 font-black' : 'text-slate-600 font-bold'
                    }`}
                  >
                    <span>Seu Número</span>
                    {sortColumn === 'seuNumero' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>
                </th>

                {/* Venc. / Pgto */}
                <th className="p-4">
                  <button
                    type="button"
                    onClick={() => handleSort(sortColumn === 'vencimento' ? 'pagamento' : 'vencimento')}
                    className={`flex items-center space-x-1 hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider ${
                      sortColumn === 'vencimento' || sortColumn === 'pagamento' ? 'text-blue-700 font-black' : 'text-slate-600 font-bold'
                    }`}
                    title="Clique para alternar ordenação por Vencimento ou Pagamento"
                  >
                    <span>{sortColumn === 'pagamento' ? 'Pgto / Venc.' : 'Venc. / Pgto'}</span>
                    {sortColumn === 'vencimento' || sortColumn === 'pagamento' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>
                </th>

                {/* Valor Final */}
                <th className="p-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('valor')}
                    className={`inline-flex items-center space-x-1 hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider ${
                      sortColumn === 'valor' ? 'text-blue-700 font-black' : 'text-slate-600 font-bold'
                    }`}
                  >
                    <span>Valor Final</span>
                    {sortColumn === 'valor' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>
                </th>

                {/* Status */}
                <th className="p-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('status')}
                    className={`inline-flex items-center space-x-1 hover:text-slate-900 transition-colors cursor-pointer uppercase tracking-wider ${
                      sortColumn === 'status' ? 'text-blue-700 font-black' : 'text-slate-600 font-bold'
                    }`}
                  >
                    <span>Status</span>
                    {sortColumn === 'status' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>
                </th>

                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedBoletos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <div className="max-w-md mx-auto py-6 space-y-4">
                      <FileText className="w-12 h-12 mx-auto text-slate-300" />
                      <div>
                        <p className="text-base font-bold text-slate-800">Nenhum boleto cadastrado</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Envie boletos em PDF para extração inteligente por IA, insira manualmente ou cole linhas digitáveis em lote.
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2 pt-2">
                        <button
                          onClick={onOpenPDFModal}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 shadow-xs cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-blue-100" />
                          <span>Extrair Boleto em PDF (IA)</span>
                        </button>
                        <button
                          onClick={onOpenNewModal}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                        >
                          Inserir Manualmente
                        </button>
                        <button
                          onClick={onOpenBatchModal}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                        >
                          Colar em Lote
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedBoletos.map((boleto) => {
                  const bankInfo = getBankInfo(boleto.bancoCodigo);
                  const valorFinal = boleto.valor - (boleto.desconto || 0) + (boleto.jurosMulta || 0);
                  const dupInfo = duplicatesMap.get(boleto.id);

                  return (
                    <tr
                      key={boleto.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        dupInfo?.isDuplicate
                          ? 'bg-orange-100/80 hover:bg-orange-200/80 border-l-4 border-l-orange-500 font-medium'
                          : boleto.selected
                          ? 'bg-blue-50/60 hover:bg-blue-50'
                          : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={boleto.selected}
                          onChange={() => onToggleSelect(boleto.id)}
                          className="w-4 h-4 rounded border-slate-300 bg-slate-50 text-blue-600 focus:ring-blue-600/20 cursor-pointer"
                        />
                      </td>

                      {/* Bank Badge */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: bankInfo.color }}
                          ></span>
                          <span className="font-mono text-xs font-bold text-slate-800">
                            [{boleto.bancoCodigo}]
                          </span>
                          <span className="text-xs text-slate-500 hidden sm:inline font-medium">
                            {bankInfo.shortName}
                          </span>
                        </div>
                      </td>

                      {/* Favorecido & Linha Digitável */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-bold text-slate-900 truncate max-w-[280px]">
                              {boleto.favorecidoNome}
                            </p>

                            {/* Boleto Type Tag */}
                            {boleto.tipoBoleto === 'ipva_sefaz' && (
                              <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-black px-2 py-0.5 rounded-md">
                                IPVA / SEFAZ
                              </span>
                            )}
                            {boleto.tipoBoleto === 'taxa_detran' && (
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-md">
                                DETRAN Taxas
                              </span>
                            )}
                            {boleto.tipoBoleto === 'multa_transito' && (
                              <span className="bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black px-2 py-0.5 rounded-md">
                                Multa Trânsito
                              </span>
                            )}
                            {boleto.tipoBoleto === 'concessionaria' && (
                              <span className="bg-teal-100 text-teal-900 border border-teal-300 text-[10px] font-black px-2 py-0.5 rounded-md">
                                Concessionária
                              </span>
                            )}
                            {boleto.tipoBoleto === 'tributo' && (
                              <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-md">
                                Tributo / DARF
                              </span>
                            )}

                            {(boleto.valor >= 250000 || valorFinal >= 250000) && (
                              <span
                                className="inline-flex items-center gap-1 bg-purple-100 text-purple-950 border border-purple-300 text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs animate-pulse"
                                title="Valor igual ou superior a R$ 250.000,00 - Exige autorização de alta alçada"
                              >
                                <AlertTriangle className="w-3 h-3 text-purple-700" />
                                Alta Alçada (&gt; 250k)
                              </span>
                            )}

                            {dupInfo?.isDuplicate && (
                              <span
                                className="inline-flex items-center gap-1 bg-orange-500 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shrink-0 shadow-xs"
                                title={dupInfo.duplicateReason}
                              >
                                <AlertTriangle className="w-3 h-3 text-white fill-orange-600" />
                                {dupInfo.duplicateSourceLabel || 'Boleto Duplicado'}
                              </span>
                            )}
                          </div>

                          {dupInfo?.isDuplicate && (
                            <div className="bg-orange-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-xs my-1 border border-orange-600">
                              <AlertTriangle className="w-4 h-4 text-white shrink-0" />
                              <span>{dupInfo.duplicateReason}</span>
                            </div>
                          )}

                          {/* Vehicle Details (Placa, RENAVAM, Auto de Infração) */}
                          {(boleto.placa || boleto.renavam || boleto.autoInfracao) && (
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              {boleto.placa && (
                                <span className="bg-slate-900 text-amber-300 font-mono font-black px-1.5 py-0.5 rounded border border-slate-700">
                                  PLACA: {boleto.placa}
                                </span>
                              )}
                              {boleto.renavam && (
                                <span className="bg-slate-100 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded border border-slate-300">
                                  RENAVAM: {boleto.renavam}
                                </span>
                              )}
                              {boleto.autoInfracao && (
                                <span className="bg-rose-50 text-rose-800 font-mono font-bold px-1.5 py-0.5 rounded border border-rose-200">
                                  AUTO: {boleto.autoInfracao}
                                </span>
                              )}
                            </div>
                          )}

                          <p className="font-mono text-xs text-slate-500 tracking-tight font-medium">
                            {formatLinhaDigitavelDisplay(boleto.linhaDigitavel)}
                          </p>
                          {boleto.favorecidoCnpjCpf ? (
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="bg-slate-100 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                CNPJ/CPF Beneficiário: {boleto.favorecidoCnpjCpf}
                              </span>
                              {boleto.pagadorCnpjCpf && (
                                <span className="bg-slate-50 text-slate-500 font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200">
                                  Pagador: {boleto.pagadorCnpjCpf}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                              <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                              <span>CNPJ/CPF Beneficiário não informado (Obrigatório Santander J-52)</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Seu Número / Ref */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-mono font-bold border border-slate-200">
                          {boleto.seuNumero || '--'}
                        </span>
                      </td>

                      {/* Vencimento e Data de Pagamento */}
                      <td className="p-4 whitespace-nowrap font-mono text-xs">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                            <span className="text-[10px] text-slate-400 font-sans font-bold uppercase">Venc:</span>
                            <span>{formatDateBR(boleto.dataVencimento)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-blue-600 font-sans font-bold uppercase">Pgto:</span>
                            <span
                              className={`font-bold ${
                                boleto.dataPagamento && boleto.dataPagamento !== boleto.dataVencimento
                                  ? 'text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200'
                                  : 'text-slate-600'
                              }`}
                            >
                              {formatDateBR(boleto.dataPagamento || boleto.dataVencimento)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Valor */}
                      <td className="p-4 text-right whitespace-nowrap font-mono">
                        <p className="text-sm font-black text-slate-900">{formatCurrencyBRL(valorFinal)}</p>

                        {((boleto.desconto && boleto.desconto > 0) || (boleto.jurosMulta && boleto.jurosMulta > 0)) && (
                          <p className="text-[10px] text-slate-400 line-through">
                            Bruto: {formatCurrencyBRL(boleto.valor)}
                          </p>
                        )}

                        {boleto.desconto && boleto.desconto > 0 ? (
                          <p className="text-[10px] font-bold text-emerald-600 flex items-center justify-end gap-1 mt-0.5">
                            <TrendingDown className="w-3 h-3" />
                            <span>Desc: -{formatCurrencyBRL(boleto.desconto)}</span>
                          </p>
                        ) : null}

                        {boleto.jurosMulta && boleto.jurosMulta > 0 ? (
                          <p className="text-[10px] font-bold text-amber-600 flex items-center justify-end gap-1 mt-0.5">
                            <TrendingUp className="w-3 h-3" />
                            <span>Juros: +{formatCurrencyBRL(boleto.jurosMulta)}</span>
                          </p>
                        ) : null}
                      </td>

                      {/* Validation Status & Alert Badges */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          {boleto.isValid ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Válido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                              <AlertCircle className="w-3 h-3 text-rose-600" /> Inválido
                            </span>
                          )}

                          {boleto.desconto && boleto.desconto > 0 ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              <TrendingDown className="w-3 h-3 text-emerald-600" /> Desconto
                            </span>
                          ) : null}

                          {boleto.jurosMulta && boleto.jurosMulta > 0 ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              <TrendingUp className="w-3 h-3 text-amber-600" /> Juros/Multa
                            </span>
                          ) : null}

                          {boleto.dataVencimento < todayStr ? (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3 text-rose-600" /> Vencido
                            </span>
                          ) : null}

                          {(boleto.valor >= 250000 || valorFinal >= 250000) && (
                            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-950 border border-purple-300 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                              <AlertTriangle className="w-3 h-3 text-purple-700" /> &gt; R$ 250k
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => onDuplicateBoleto(boleto)}
                            title="Duplicar boleto"
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEditBoleto(boleto)}
                            title="Editar boleto"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteBoleto(boleto.id)}
                            title="Excluir boleto"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
