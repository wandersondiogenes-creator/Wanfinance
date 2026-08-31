import React, { useState, useRef, useMemo } from 'react';
import {
  Sparkles,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Download,
  PlusCircle,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  Search,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Cpu,
  X,
  Code
} from 'lucide-react';
import { SmartDocCategory, SmartExtractedDocument } from '../../utils/smartExtractor/smartDocTypes';
import { SmartDocTypeSelector } from './SmartDocTypeSelector';
import { SmartDocValidationCard } from './SmartDocValidationCard';
import {
  processSmartDocumentsFromFile,
  processSmartDocument,
  convertSmartDocToBoletoItem,
} from '../../utils/smartExtractor/smartExtractionEngine';
import { learnSmartDocLayout } from '../../utils/smartExtractor/smartLayoutMemory';
import { BoletoItem, CompanySettings, CompanyProfile, CNABBatchHistory } from '../../types';
import { generateCNAB240 } from '../../utils/cnabGenerator240';
import { generateCNAB400 } from '../../utils/cnabGenerator400';

interface SmartExtractionPanelProps {
  company: CompanySettings;
  companies: CompanyProfile[];
  onImportBoletosToMainList: (newBoletos: BoletoItem[]) => void;
  onOpenTraditionalExtractor: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onSaveToHistory?: (
    fileContent: string,
    totalBoletos: number,
    totalValor: number,
    filename: string,
    nsa: number,
    analista?: string
  ) => void;
}

export const SmartExtractionPanel: React.FC<SmartExtractionPanelProps> = ({
  company,
  companies,
  onImportBoletosToMainList,
  onOpenTraditionalExtractor,
  onShowToast,
  onSaveToHistory,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<SmartDocCategory>('auto_detect');
  const [documents, setDocuments] = useState<SmartExtractedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'VALID' | 'WARNING' | 'ERROR'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Upload Handler
  const handleFilesUpload = async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length === 0) {
      onShowToast('Por favor, selecione arquivos em formato PDF válido.', 'warning');
      return;
    }

    setIsProcessing(true);
    setCurrentProgress(0);
    setStatusMessage(`Iniciando leitura de ${pdfFiles.length} arquivo(s) PDF...`);

    const extractedDocs: SmartExtractedDocument[] = [];
    let completed = 0;

    for (const file of pdfFiles) {
      try {
        setStatusMessage(`Processando: ${file.name}...`);
        const docs = await processSmartDocumentsFromFile(
          file,
          selectedCategory,
          (prog, msg) => {
            const overall = Math.round(((completed + prog / 100) / pdfFiles.length) * 100);
            setCurrentProgress(overall);
            setStatusMessage(`${file.name}: ${msg}`);
          }
        );
        extractedDocs.push(...docs);
      } catch (err: any) {
        console.error(`Erro ao processar ${file.name}:`, err);
      }
      completed++;
      setCurrentProgress(Math.round((completed / pdfFiles.length) * 100));
    }

    setDocuments((prev) => [...extractedDocs, ...prev]);
    setIsProcessing(false);
    setStatusMessage('');
    onShowToast(`${extractedDocs.length} documento(s) processado(s) com sucesso!`, 'success');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  // Metrics Calculation
  const metrics = useMemo(() => {
    const total = documents.length;
    const valid = documents.filter((d) => d.validation.overallStatus === 'valid').length;
    const warning = documents.filter((d) => d.validation.overallStatus === 'warning').length;
    const error = documents.filter((d) => d.validation.overallStatus === 'error').length;
    const totalValor = documents.reduce((acc, d) => acc + (d.valor || 0), 0);
    const selectedCount = documents.filter((d) => d.selected).length;
    const selectedValor = documents
      .filter((d) => d.selected)
      .reduce((acc, d) => acc + (d.valor || 0), 0);

    return { total, valid, warning, error, totalValor, selectedCount, selectedValor };
  }, [documents]);

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Status filter
      if (filterStatus === 'VALID' && doc.validation.overallStatus !== 'valid') return false;
      if (filterStatus === 'WARNING' && doc.validation.overallStatus !== 'warning') return false;
      if (filterStatus === 'ERROR' && doc.validation.overallStatus !== 'error') return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = doc.fileName.toLowerCase().includes(q);
        const matchesFav = doc.favorecidoNome.toLowerCase().includes(q);
        const matchesCnpj = doc.favorecidoCnpjCpf.includes(q);
        const matchesNum = doc.seuNumero.toLowerCase().includes(q);
        const matchesChassi = (doc.chassi || '').toLowerCase().includes(q);
        return matchesName || matchesFav || matchesCnpj || matchesNum || matchesChassi;
      }

      return true;
    });
  }, [documents, filterStatus, searchQuery]);

  // Document update & delete handlers
  const handleUpdateDocument = (updated: SmartExtractedDocument) => {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    try {
      learnSmartDocLayout(updated, updated.rawTextPreview || updated.fileName);
    } catch (e) {
      console.warn('[SmartExtractionPanel] Auto-learn on update notice:', e);
    }
  };

  const handleDeleteDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    onShowToast('Documento removido do lote.', 'info');
  };

  const handleSelectAll = (select: boolean) => {
    setDocuments((prev) => prev.map((d) => ({ ...d, selected: select })));
  };

  // Import to Main List Handler
  const handleImportToMain = () => {
    const selected = documents.filter((d) => d.selected && d.status === 'success');
    if (selected.length === 0) {
      onShowToast('Nenhum documento selecionado para importação.', 'warning');
      return;
    }

    const convertedBoletos = selected.map(convertSmartDocToBoletoItem);
    onImportBoletosToMainList(convertedBoletos);
    onShowToast(`${convertedBoletos.length} boleto(s) transferidos com sucesso para a lista de pagamentos!`, 'success');
  };

  // Direct CNAB Generation Handler
  const handleGenerateDirectCNAB = () => {
    const selected = documents.filter((d) => d.selected && d.status === 'success');
    if (selected.length === 0) {
      onShowToast('Selecione ao menos um documento válido para gerar a remessa.', 'warning');
      return;
    }

    const boletos = selected.map(convertSmartDocToBoletoItem);
    let cnabContent = '';
    const isCNAB400 = company.padraoCNAB === '400';
    const nsa = company.nsa || 1;

    if (isCNAB400) {
      const result = generateCNAB400(company, boletos);
      cnabContent = result.fileContent;
    } else {
      const result = generateCNAB240(company, boletos);
      cnabContent = result.fileContent;
    }

    const filename = `CB${String(company.bancoCodigo).padStart(3, '0')}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${nsa}.REM`;
    const blob = new Blob([cnabContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onSaveToHistory) {
      onSaveToHistory(
        cnabContent,
        boletos.length,
        metrics.selectedValor,
        filename,
        nsa,
        'Módulo Extração Inteligente'
      );
    }

    onShowToast(`Arquivo de remessa CNAB (${filename}) gerado com sucesso!`, 'success');
  };

  // Export to CSV Handler
  const handleExportCSV = () => {
    if (documents.length === 0) {
      onShowToast('Nenhum documento disponível para exportação.', 'warning');
      return;
    }

    const headers = [
      'Arquivo',
      'Categoria',
      'Beneficiário',
      'CNPJ Beneficiário',
      'Valor (R$)',
      'Vencimento',
      'Linha Digitável',
      'Compromisso / Doc',
      'Chassi / Veículo',
      'Score Validação (%)',
      'Status',
    ];

    const rows = documents.map((d) => [
      `"${d.fileName}"`,
      `"${d.montadoraMarca || d.detectedCategory}"`,
      `"${d.favorecidoNome}"`,
      `"${d.favorecidoCnpjCpf}"`,
      `"${d.valor.toFixed(2).replace('.', ',')}"`,
      `"${d.dataVencimento.split('-').reverse().join('/')}"`,
      `"${d.linhaDigitavel}"`,
      `"${d.seuNumero}"`,
      `"${d.chassi || d.placa || ''}"`,
      `"${d.validation.score}"`,
      `"${d.validation.overallStatus}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Extracao_Inteligente_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onShowToast('Planilha CSV gerada com sucesso!', 'success');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner with Apple iPadOS Aesthetics */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white shadow-xl shadow-indigo-500/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Novo Módulo 100% Independente & Isolado</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Extração Inteligente Multi-Documentos
            </h2>
            <p className="text-white/80 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Extratores especializados por tipo de documento com auditoria visual rigorosa de código de barras, valores, vencimentos, CNPJ/CPF e compatibilidade FEBRABAN.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenTraditionalExtractor}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold backdrop-blur-md border border-white/20 transition-all cursor-pointer"
              title="Abrir o extrator tradicional sem qualquer interferência"
            >
              <span>Extrator Tradicional</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Document Type Selector Component */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-sm">
        <SmartDocTypeSelector
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          disabled={isProcessing}
        />
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`p-8 sm:p-10 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer relative overflow-hidden ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10 scale-[0.99]'
            : 'border-black/[0.1] dark:border-white/[0.1] bg-white/50 dark:bg-[#1c1c1e]/50 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
        } ${isProcessing ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
          className="hidden"
        />

        {isProcessing ? (
          <div className="w-full max-w-md space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto animate-spin">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Processando Documentos em Alta Velocidade...
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                {statusMessage}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-black/[0.06] dark:bg-white/[0.08] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${currentProgress}%` }}
              />
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {currentProgress}% concluído
            </span>
          </div>
        ) : (
          <div className="space-y-3 max-w-md">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center mx-auto shadow-md shadow-blue-500/25">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Arraste ou Selecione Múltiplos Arquivos PDF
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Suporta múltiplos boletos simultâneos com extração vetorial rápida e OCR sob demanda.
              </p>
            </div>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-black/[0.08] dark:hover:bg-white/[0.12] transition-colors"
            >
              Procurar Arquivos no Computador
            </button>
          </div>
        )}
      </div>

      {/* Extracted Results Section */}
      {documents.length > 0 && (
        <div className="space-y-4">
          {/* Metrics & Filter Bar */}
          <div className="p-4 rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-4 shadow-sm">
            {/* Realtime Metrics Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'ALL'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-400'
                }`}
              >
                Todos ({metrics.total})
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus('VALID')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  filterStatus === 'VALID'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>100% Validados ({metrics.valid})</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus('WARNING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  filterStatus === 'WARNING'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Conferir ({metrics.warning})</span>
              </button>

              {metrics.error > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterStatus('ERROR')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    filterStatus === 'ERROR'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Críticos ({metrics.error})</span>
                </button>
              )}
            </div>

            {/* Total Selected Amount */}
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                  Total Selecionado ({metrics.selectedCount})
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {metrics.selectedValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            {/* Search and Bulk Select */}
            <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
              <button
                type="button"
                onClick={() => handleSelectAll(metrics.selectedCount < documents.length)}
                className="p-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                title="Selecionar todos os documentos"
              >
                {metrics.selectedCount === documents.length ? (
                  <CheckSquare className="w-4 h-4 text-blue-500" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Selecionar Todos</span>
              </button>

              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por beneficiário, CNPJ, documento ou chassi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span>Exportar Planilha</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateDirectCNAB}
                disabled={metrics.selectedCount === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Gerar CNAB ({metrics.selectedCount})</span>
              </button>

              <button
                type="button"
                onClick={handleImportToMain}
                disabled={metrics.selectedCount === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Importar p/ Lista Principal ({metrics.selectedCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setDocuments([])}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                title="Limpar lote atual"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="space-y-3">
            {filteredDocuments.map((doc) => (
              <SmartDocValidationCard
                key={doc.id}
                document={doc}
                onUpdateDocument={handleUpdateDocument}
                onDeleteDocument={handleDeleteDocument}
                onShowToast={onShowToast}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
