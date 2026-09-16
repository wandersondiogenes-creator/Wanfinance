import React, { useState, useRef } from 'react';
import { CompanyProfile } from '../types';
import { parseCompaniesWorkbook, mergeCompaniesWithExisting, CompanyImportResult } from '../utils/importCompaniesExcel';
import { downloadCompaniesExcel } from '../utils/exportCompaniesExcel';
import { getBankInfo } from '../utils/banks';
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  Building2,
  CreditCard,
  Layers,
  ArrowRight,
  Download,
  Check,
  RefreshCw,
  FileUp,
  Info,
} from 'lucide-react';

interface CompanyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCompanies: CompanyProfile[];
  onApplyImport: (updatedCompanies: CompanyProfile[], newActiveCompanyId?: string) => void;
  initialFile?: File | null;
}

export const CompanyImportModal: React.FC<CompanyImportModalProps> = ({
  isOpen,
  onClose,
  existingCompanies,
  onApplyImport,
  initialFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<CompanyImportResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [selectedPreviewCompanyId, setSelectedPreviewCompanyId] = useState<string>('');

  React.useEffect(() => {
    if (isOpen && initialFile) {
      handleFile(initialFile);
    }
  }, [isOpen, initialFile]);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setIsProcessing(true);
    setImportResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseCompaniesWorkbook(buffer);
      setImportResult(result);
      if (result.success && result.companies.length > 0) {
        setSelectedPreviewCompanyId(result.companies[0].id);
      }
    } catch (err: any) {
      setImportResult({
        success: false,
        error: `Erro ao processar o arquivo: ${err?.message || 'Arquivo inválido'}`,
        companies: [],
        stats: { totalCompanies: 0, totalBanks: 0, sheetNames: [], newCompaniesCount: 0, updatedCompaniesCount: 0, warnings: [] },
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleConfirmImport = () => {
    if (!importResult || !importResult.success || importResult.companies.length === 0) return;

    let finalCompanies: CompanyProfile[] = [];
    if (importMode === 'replace') {
      finalCompanies = importResult.companies;
    } else {
      const { merged } = mergeCompaniesWithExisting(existingCompanies, importResult.companies);
      finalCompanies = merged;
    }

    const firstCompanyId = finalCompanies[0]?.id;
    onApplyImport(finalCompanies, firstCompanyId);
    handleClose();
  };

  const handleClose = () => {
    setImportResult(null);
    setFileName('');
    setIsProcessing(false);
    onClose();
  };

  const previewCompany = importResult?.companies.find((c) => c.id === selectedPreviewCompanyId) || importResult?.companies[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        id="modal-import-companies-container"
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Importar Planilha de Empresas & Contas Bancárias
              </h2>
              <p className="text-xs text-slate-400">
                Envie sua planilha Excel (.xlsx, .xls) ou CSV para cadastrar e atualizar as empresas e contas diretamente
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Upload Zone */}
          {!importResult?.success && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-600/10 scale-[0.99]'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleInputChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Arraste e solte sua planilha aqui, ou{' '}
                      <span className="text-blue-400 underline decoration-blue-400/50">clique para selecionar</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Formatos aceitos: <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] text-slate-400">
                    <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                      🏢 Reconhece Razão Social & CNPJ
                    </span>
                    <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                      💳 Agência, Conta & DV
                    </span>
                    <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                      🔑 Convênio & Estação Santander Pagfor
                    </span>
                  </div>
                </div>
              </div>

              {/* Helper Bar with Sample Download */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    Você pode enviar a mesma planilha que você já exportou do sistema, ou qualquer planilha com colunas de CNPJ, Razão Social, Banco, Agência e Conta.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => downloadCompaniesExcel(existingCompanies)}
                  className="shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-colors font-medium text-xs"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Baixar Modelo Exemplo (.xlsx)</span>
                </button>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isProcessing && (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-sm font-medium text-slate-300">Lendo e estruturando os dados da planilha...</p>
            </div>
          )}

          {/* Error Message */}
          {importResult && !importResult.success && (
            <div className="bg-red-950/40 border border-red-800/80 rounded-2xl p-4 flex items-start space-x-3 text-xs text-red-200">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Não foi possível processar a planilha</p>
                <p>{importResult.error}</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-red-300 underline font-semibold hover:text-red-100"
                >
                  Tentar com outro arquivo
                </button>
              </div>
            </div>
          )}

          {/* Success Preview Screen */}
          {importResult && importResult.success && (
            <div className="space-y-5">
              {/* Summary Badges */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Planilha lida com sucesso: <span className="font-mono text-emerald-400">{fileName}</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      {importResult.stats.sheetNames.length} aba(s) identificada(s): {importResult.stats.sheetNames.join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="bg-blue-900/40 text-blue-300 border border-blue-700/50 text-xs px-3 py-1 rounded-xl font-bold flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {importResult.stats.totalCompanies} Empresas
                  </span>
                  <span className="bg-indigo-900/40 text-indigo-300 border border-indigo-700/50 text-xs px-3 py-1 rounded-xl font-bold flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    {importResult.stats.totalBanks} Contas Bancárias
                  </span>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Escolha como aplicar os dados importados:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    onClick={() => setImportMode('merge')}
                    className={`cursor-pointer p-3.5 rounded-2xl border transition-all flex items-start space-x-3 ${
                      importMode === 'merge'
                        ? 'bg-blue-600/15 border-blue-500 text-white shadow-md shadow-blue-500/10'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                        Mesclar & Atualizar (Recomendado)
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Atualiza as empresas e contas já cadastradas que coincidirem pelo CNPJ e adiciona as novas da planilha, sem apagar o que você já tem.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setImportMode('replace')}
                    className={`cursor-pointer p-3.5 rounded-2xl border transition-all flex items-start space-x-3 ${
                      importMode === 'replace'
                        ? 'bg-amber-600/15 border-amber-500 text-white shadow-md shadow-amber-500/10'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        Substituir Todas as Empresas
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        Limpa todas as empresas cadastradas atualmente e deixa exatamente as {importResult.stats.totalCompanies} empresas da planilha.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Data Preview Accordion/Table */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    Pré-visualização das Empresas Detectadas ({importResult.companies.length})
                  </h5>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
                  >
                    Trocar Planilha
                  </button>
                </div>

                {/* Company pill selector */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {importResult.companies.map((comp) => {
                    const isSelected = comp.id === selectedPreviewCompanyId;
                    return (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => setSelectedPreviewCompanyId(comp.id)}
                        className={`px-3 py-2 rounded-xl border text-xs text-left whitespace-nowrap transition-all shrink-0 flex items-center space-x-2 ${
                          isSelected
                            ? 'bg-blue-600/25 border-blue-500 text-white font-semibold'
                            : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>{comp.nomeFantasia || comp.razaoSocial}</span>
                        <span className="text-[10px] bg-slate-700/80 px-1.5 py-0.5 rounded text-slate-400">
                          {comp.bancos.length} conta(s)
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Company Details Card */}
                {previewCompany && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div>
                        <p className="text-xs font-bold text-white">{previewCompany.razaoSocial}</p>
                        <p className="text-[11px] text-slate-400">
                          CNPJ: <span className="font-mono text-slate-200">{previewCompany.cnpjCpf}</span> | {previewCompany.cidade}/{previewCompany.uf}
                        </p>
                      </div>
                      <span className="text-xs text-blue-300 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-lg self-start sm:self-auto font-medium">
                        {previewCompany.bancos.length} conta(s) bancária(s) associada(s)
                      </span>
                    </div>

                    {/* Bank accounts list */}
                    <div className="space-y-2">
                      {previewCompany.bancos.map((banco, bIdx) => {
                        const bankInfo = getBankInfo(banco.bancoCodigo);
                        const isSantander = banco.bancoCodigo === '033';

                        return (
                          <div
                            key={bIdx}
                            className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center space-x-2.5">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] text-slate-900 shrink-0"
                                style={{ backgroundColor: bankInfo.bgColor, color: bankInfo.color }}
                              >
                                {banco.bancoCodigo}
                              </div>
                              <div>
                                <p className="font-bold text-slate-200">
                                  {banco.apelido || bankInfo.shortName}
                                </p>
                                <p className="text-[11px] text-slate-400 font-mono">
                                  Agência: {banco.agencia}-{banco.agenciaDV || '0'} | Conta: {banco.conta}-{banco.contaDV || '0'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              {banco.convenio && (
                                <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono">
                                  Convênio: <strong>{banco.convenio}</strong>
                                </span>
                              )}
                              {isSantander && banco.codigoEstacao && (
                                <span className="bg-red-950/60 text-red-300 px-2 py-0.5 rounded border border-red-800/60 font-mono font-bold">
                                  Estação: {banco.codigoEstacao}
                                </span>
                              )}
                              <span className="bg-slate-800/60 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 text-[10px]">
                                CNAB {banco.padraoCNAB}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-800 flex items-center justify-between bg-slate-950/80">
          <button
            type="button"
            onClick={handleClose}
            className="text-xs font-semibold text-slate-400 hover:text-white px-4 py-2 rounded-xl transition-colors"
          >
            Cancelar
          </button>

          {importResult && importResult.success && (
            <button
              type="button"
              onClick={handleConfirmImport}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>
                {importMode === 'merge' ? 'Mesclar e Atualizar Empresas' : 'Substituir e Cadastrar Tudo'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
