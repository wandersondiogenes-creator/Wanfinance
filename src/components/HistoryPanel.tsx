import React, { useState, useMemo } from 'react';
import { CNABBatchHistory, AuthUser } from '../types';
import { formatCurrencyBRL } from '../utils/boletoParser';
import { getBankInfo } from '../utils/banks';
import {
  History,
  Download,
  Trash2,
  FileText,
  UserCheck,
  Search,
  Building2,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface HistoryPanelProps {
  history: CNABBatchHistory[];
  currentUser?: AuthUser | null;
  onClearHistory: () => void;
  onDownloadBatch: (batch: CNABBatchHistory) => void;
  onDeleteHistoryItem?: (id: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  currentUser,
  onClearHistory,
  onDownloadBatch,
  onDeleteHistoryItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'GERADO' | 'PROCESSADO' | 'ERRO' | 'PARCIAL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  // 1. Filter by Current User (Ensure user sees only their own records)
  const userHistory = useMemo(() => {
    if (!currentUser) return history;
    return history.filter((h) => {
      if (!h.userId && !h.userEmail && !h.analista) return true; // Legacy records
      const matchesUserId = h.userId && h.userId === currentUser.id;
      const matchesUserEmail =
        h.userEmail && (h.userEmail === currentUser.email || h.analista === currentUser.email);
      const matchesAnalyst = h.analista && (h.analista === currentUser.email || h.analista === currentUser.name);
      return matchesUserId || matchesUserEmail || matchesAnalyst;
    });
  }, [history, currentUser]);

  // 2. Filter by Search Term, Selected Date, and Status
  const filteredHistory = useMemo(() => {
    return userHistory.filter((h) => {
      // Search by text (filename, analyst, bank code)
      const term = searchTerm.toLowerCase().trim();
      const matchesText =
        !term ||
        h.filename.toLowerCase().includes(term) ||
        (h.analista && h.analista.toLowerCase().includes(term)) ||
        h.bancoCodigo.includes(term) ||
        (h.createdDate && new Date(h.createdDate).toLocaleDateString('pt-BR').includes(term));

      // Search by date (calendar input)
      let matchesDate = true;
      if (dateFilter) {
        const itemDateStr = h.createdDate
          ? new Date(h.createdDate).toISOString().split('T')[0]
          : '';
        matchesDate = itemDateStr === dateFilter;
      }

      // Filter by status
      let matchesStatus = true;
      if (statusFilter !== 'ALL') {
        const itemStatus = h.status || 'GERADO';
        matchesStatus = itemStatus === statusFilter;
      }

      return matchesText && matchesDate && matchesStatus;
    });
  }, [userHistory, searchTerm, dateFilter, statusFilter]);

  // 3. Pagination calculation
  const totalItems = filteredHistory.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedHistory = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, safeCurrentPage, pageSize]);

  // Calculate days remaining before 30-day deletion
  const getDaysRemaining = (createdDate: string, timestamp?: number) => {
    const itemMs = timestamp || new Date(createdDate).getTime();
    const ageMs = Date.now() - itemMs;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const remainingMs = thirtyDaysMs - ageMs;
    const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    return days > 0 ? days : 0;
  };

  const toggleExpand = (id: string) => {
    setExpandedBatchId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold shrink-0 shadow-inner">
            <History className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Histórico de Gerações
              </h2>
              <span className="bg-purple-950 text-purple-300 border border-purple-500/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-purple-400" />
                <span>Registros Exclusivos do Usuário</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Consulta completa e persistente de arquivos CNAB gerados e lotes de boletos processados.
              Cada usuário visualiza estritamente os seus próprios registros.
            </p>
          </div>
        </div>

        {userHistory.length > 0 && (
          <button
            onClick={onClearHistory}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold px-4 py-2.5 rounded-2xl transition-all flex items-center space-x-2 shrink-0 cursor-pointer shadow-xs"
          >
            <Trash2 className="w-4 h-4" />
            <span>Limpar Meu Histórico</span>
          </button>
        )}
      </div>

      {/* 30-Day Retention Notice Banner */}
      <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-amber-300">
              Política de Retenção de Dados (30 Dias)
            </p>
            <p className="text-amber-200/80 text-[11px]">
              Os registros de arquivos CNAB e boletos processados são mantidos com segurança por 30 dias a partir da data de geração e são <strong>excluídos automaticamente</strong> após esse prazo.
            </p>
          </div>
        </div>
        <div className="bg-amber-900/50 text-amber-300 border border-amber-700/60 font-mono text-[11px] font-bold px-3 py-1.5 rounded-xl shrink-0 self-end sm:self-center">
          Ativo: {currentUser?.email || 'Usuário Atual'}
        </div>
      </div>

      {/* Search, Date Filter & Status Tabs Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-center">
          
          {/* Search Input */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por nome do arquivo (ex: CB030801.REM), banco ou analista..."
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs pl-10 pr-4 py-2.5 rounded-2xl focus:outline-none focus:border-purple-500 placeholder-slate-500 font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Date Selector Filter */}
          <div className="md:col-span-3 relative">
            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2">
              <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-200 text-xs focus:outline-none w-full font-medium cursor-pointer"
                title="Filtrar por data exata de geração"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="text-slate-500 hover:text-slate-300 text-xs cursor-pointer font-bold"
                  title="Limpar filtro de data"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Items Per Page Selector */}
          <div className="md:col-span-3 flex items-center justify-end space-x-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-400 shrink-0">Exibir por pág:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value={5}>5 por página</option>
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
            </select>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-purple-400" />
              <span>Status:</span>
            </span>

            <button
              onClick={() => {
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              Todos ({userHistory.length})
            </button>

            <button
              onClick={() => {
                setStatusFilter('GERADO');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                statusFilter === 'GERADO'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gerados / Sucesso</span>
            </button>

            <button
              onClick={() => {
                setStatusFilter('ERRO');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                statusFilter === 'ERRO'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Com Erros</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Exibindo <strong className="text-white">{filteredHistory.length}</strong> de{' '}
            <strong className="text-white">{userHistory.length}</strong> registros
          </div>
        </div>
      </div>

      {/* History Items List */}
      {userHistory.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-3xl bg-slate-800 text-slate-600 flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold text-slate-200">Nenhum histórico gerado ainda</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Assim que você gerar ou exportar um arquivo CNAB 240/400 ou processar um lote de boletos, o registro completo com data, hora, nome do arquivo e logs de erro ficará armazenado aqui durante 30 dias.
            </p>
          </div>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400 space-y-2 shadow-xl">
          <p className="text-sm font-bold text-slate-300">Nenhum registro encontrado com os filtros aplicados.</p>
          <p className="text-xs text-slate-500">
            Tente remover a busca por termo "{searchTerm}" ou o filtro de data.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setDateFilter('');
              setStatusFilter('ALL');
            }}
            className="mt-2 text-xs text-purple-400 hover:text-purple-300 underline font-bold cursor-pointer"
          >
            Limpar todos os filtros
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedHistory.map((batch) => {
            const bankInfo = getBankInfo(batch.bancoCodigo);
            const isExpanded = expandedBatchId === batch.id;
            const daysRemaining = getDaysRemaining(batch.createdDate, batch.timestamp);
            const itemStatus = batch.status || 'GERADO';

            return (
              <div
                key={batch.id}
                className={`bg-slate-900 border rounded-3xl p-5 sm:p-6 transition-all shadow-xl space-y-4 ${
                  itemStatus === 'ERRO'
                    ? 'border-rose-900/60 bg-rose-950/10'
                    : isExpanded
                    ? 'border-purple-500/50 shadow-purple-950/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Card Main Info */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  
                  {/* Left Side: NSA, Filename, Status, Date & Time, Bank */}
                  <div className="flex items-start space-x-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center font-bold text-xs text-slate-200 font-mono shrink-0 shadow-inner">
                      <span className="text-[9px] text-slate-500 font-sans tracking-tight">NSA</span>
                      <span>#{batch.nsa}</span>
                    </div>

                    <div className="space-y-2 min-w-0 flex-1">
                      {/* Line 1: Filename + Status Badge + CNAB Pattern + Bank */}
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono font-black text-white text-base tracking-wide">
                          {batch.filename}
                        </p>

                        {/* Status Badge */}
                        {itemStatus === 'ERRO' ? (
                          <span className="bg-rose-950 text-rose-300 border border-rose-800/80 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-400" />
                            <span>Com Erro</span>
                          </span>
                        ) : itemStatus === 'PARCIAL' ? (
                          <span className="bg-amber-950 text-amber-300 border border-amber-800/80 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Parcial</span>
                          </span>
                        ) : (
                          <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/80 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Gerado / Ok</span>
                          </span>
                        )}

                        <span className="bg-blue-950 text-blue-300 text-[11px] px-2.5 py-0.5 rounded-full border border-blue-800/60 font-semibold font-mono">
                          CNAB {batch.padraoCNAB}
                        </span>

                        <span className="bg-slate-800 text-slate-300 text-[11px] px-2.5 py-0.5 rounded-full border border-slate-700 flex items-center gap-1 font-medium">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>[{batch.bancoCodigo}] {bankInfo.shortName}</span>
                        </span>
                      </div>

                      {/* Line 2: Date & Time, Analyst, Values, Expire Countdown */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-400">
                        {/* Analyst / User Badge */}
                        <span className="bg-purple-950/80 text-purple-300 border border-purple-500/30 text-[11px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-purple-400" />
                          <span>Gerado por: <strong className="text-white">{(!batch.analista || batch.analista === 'Analista Financeiro') ? (currentUser?.email || 'financeiro@wanfinance.com.br') : batch.analista}</strong></span>
                        </span>

                        <span>•</span>

                        {/* Date and Time */}
                        <span className="flex items-center gap-1 text-slate-300 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-purple-400" />
                          <span>{new Date(batch.createdDate).toLocaleDateString('pt-BR')} às {new Date(batch.createdDate).toLocaleTimeString('pt-BR')}</span>
                        </span>

                        <span>•</span>

                        {/* Total Boletos and Value */}
                        <span>
                          <strong className="text-slate-200">{batch.totalBoletos}</strong> boleto(s)
                        </span>

                        <span>•</span>

                        <span className="text-emerald-400 font-mono font-bold text-sm">
                          {formatCurrencyBRL(batch.totalValor)}
                        </span>

                        <span>•</span>

                        {/* Expiration Countdown */}
                        <span className="text-amber-400/90 bg-amber-950/50 border border-amber-800/40 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>Expira em {daysRemaining} dias</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Re-download Button & Expand Details */}
                  <div className="flex items-center space-x-2.5 w-full lg:w-auto justify-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                    {/* Re-download Button */}
                    <button
                      onClick={() => onDownloadBatch(batch)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-2xl transition-all shadow-md shadow-blue-600/20 flex items-center space-x-2 cursor-pointer"
                      title="Baixar novamente o arquivo CNAB (.REM) gerado"
                    >
                      <Download className="w-4 h-4 text-white" />
                      <span>Baixar Novamente</span>
                    </button>

                    {/* Delete Item Button */}
                    {onDeleteHistoryItem && (
                      <button
                        onClick={() => onDeleteHistoryItem(batch.id)}
                        className="bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 p-2.5 rounded-2xl border border-slate-700 transition-colors cursor-pointer"
                        title="Excluir este registro do histórico"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Expand Details Toggle */}
                    <button
                      onClick={() => toggleExpand(batch.id)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-2.5 rounded-2xl border border-slate-700 transition-all flex items-center space-x-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Ocultar' : 'Detalhes'}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error Logs Banner (if any) */}
                {((batch.errorLogs && batch.errorLogs.length > 0) || itemStatus === 'ERRO') && (
                  <div className="bg-rose-950/80 border border-rose-800/80 rounded-2xl p-4 space-y-2 text-xs text-rose-200">
                    <div className="flex items-center space-x-2 text-rose-300 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Logs e Mensagens de Erro Gravadas:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-rose-200/90 pl-1">
                      {batch.errorLogs && batch.errorLogs.length > 0 ? (
                        batch.errorLogs.map((log, lIdx) => <li key={lIdx}>{log}</li>)
                      ) : (
                        <li>Arquivo ou dados inconsistentes durante a transmissão ao banco.</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Expandable Drawer: Boletos List & Raw File Preview */}
                {isExpanded && (
                  <div className="pt-4 border-t border-slate-800 space-y-4 animate-fade-in">
                    
                    {/* Processed Boletos List Table */}
                    {batch.boletos && batch.boletos.length > 0 ? (
                      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-purple-400" />
                            <span>Boletos Processados neste Lote ({batch.boletos.length})</span>
                          </h4>
                          <span className="text-[11px] font-mono font-bold text-emerald-400">
                            Total: {formatCurrencyBRL(batch.totalValor)}
                          </span>
                        </div>

                        <div className="overflow-x-auto max-h-56 overflow-y-auto">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-bold sticky top-0">
                              <tr>
                                <th className="p-2">Favorecido / Sacado</th>
                                <th className="p-2">Linha Digitável / Barra</th>
                                <th className="p-2">Vencimento</th>
                                <th className="p-2 text-right">Valor</th>
                                <th className="p-2 text-center">Ref. (Seu Nº)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                              {batch.boletos.map((b, bIdx) => (
                                <tr key={bIdx} className="hover:bg-slate-900/60">
                                  <td className="p-2 font-sans font-bold text-white truncate max-w-[180px]">
                                    {b.favorecidoNome}
                                  </td>
                                  <td className="p-2 text-slate-400 truncate max-w-[220px]">
                                    {b.linhaDigitavel || b.codigoBarras || 'N/A'}
                                  </td>
                                  <td className="p-2 text-slate-300">
                                    {b.dataVencimento || 'N/I'}
                                  </td>
                                  <td className="p-2 text-right font-bold text-emerald-400">
                                    {formatCurrencyBRL(b.valor)}
                                  </td>
                                  <td className="p-2 text-center text-slate-400">
                                    {b.seuNumero || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs text-slate-500 bg-slate-950 border border-slate-800 rounded-2xl">
                        Nenhum detalhe de boleto individual salvo para este lote antigo.
                      </div>
                    )}

                    {/* Raw CNAB Preview snippet */}
                    {batch.content && (
                      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-bold text-slate-300 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-400" />
                            <span>Visualização das Linhas do Arquivo CNAB</span>
                          </span>
                          <span className="font-mono text-[11px]">
                            {batch.content.split('\n').length} linhas
                          </span>
                        </div>
                        <pre className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-40 leading-relaxed tracking-wider">
                          {batch.content}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="text-xs text-slate-400 font-medium">
            Página <strong className="text-white">{safeCurrentPage}</strong> de{' '}
            <strong className="text-white">{totalPages}</strong> (Total de {totalItems} registros)
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={safeCurrentPage === 1}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition-all flex items-center space-x-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            {/* Page number buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= safeCurrentPage - 1 && pageNum <= safeCurrentPage + 1)
              ) {
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      pageNum === safeCurrentPage
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              }
              if (pageNum === 2 && safeCurrentPage > 3) {
                return <span key="dots-1" className="text-slate-600 text-xs px-1">...</span>;
              }
              if (pageNum === totalPages - 1 && safeCurrentPage < totalPages - 2) {
                return <span key="dots-2" className="text-slate-600 text-xs px-1">...</span>;
              }
              return null;
            })}

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={safeCurrentPage === totalPages}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition-all flex items-center space-x-1 cursor-pointer"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
