import React, { useState } from 'react';
import { CompanySettings, CompanyProfile, BoletoItem, CNABLineHighlight, AuthUser } from '../types';
import { generateCNAB240 } from '../utils/cnabGenerator240';
import { generateCNAB400 } from '../utils/cnabGenerator400';
import {
  X,
  Download,
  Copy,
  Check,
  FileText,
  Code,
  Layers,
  UserCheck,
  PlusCircle,
  Building2,
  ListFilter,
  RefreshCw,
  CheckCircle2,
  SlidersHorizontal,
  Square,
  CheckSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CNABPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanySettings;
  companies: CompanyProfile[];
  activeCompanyId: string;
  activeBankId: string;
  currentUser?: AuthUser | null;
  onSelectCompany: (companyId: string) => void;
  onSelectBank: (bankId: string) => void;
  boletos: BoletoItem[];
  onToggleSelectBoleto: (id: string) => void;
  onSelectAllBoletos: (selectAll: boolean) => void;
  onOpenNewBoletoModal: () => void;
  onSaveToHistory: (
    fileContent: string,
    totalBoletos: number,
    totalValor: number,
    filename: string,
    nsa: number,
    analista?: string,
    removeExported?: boolean
  ) => void;
}

export const CNABPreviewModal: React.FC<CNABPreviewModalProps> = ({
  isOpen,
  onClose,
  company,
  companies,
  activeCompanyId,
  activeBankId,
  currentUser,
  onSelectCompany,
  onSelectBank,
  boletos,
  onToggleSelectBoleto,
  onSelectAllBoletos,
  onOpenNewBoletoModal,
  onSaveToHistory,
}) => {
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const [analista, setAnalista] = useState(() => localStorage.getItem('last_analyst_name') || currentUser?.email || '');
  const [showBoletosManager, setShowBoletosManager] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const validBoletos = boletos.filter((b) => b.selected && b.isValid);

  const result =
    company.padraoCNAB === '400'
      ? generateCNAB400(company, validBoletos)
      : generateCNAB240(company, validBoletos);

  const lines = result.fileContent.split('\r\n');

  // Filename formatting (ex: CB300701.REM)
  const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2); // YYMMDD
  const defaultFilename = `CB${todayStr}${String(company.nsa).padStart(2, '0')}.REM`;

  const currentCompanyProfile = companies.find((c) => c.id === activeCompanyId) || companies[0];
  const companyBanks = currentCompanyProfile ? currentCompanyProfile.bancos : [];

  const handleDownload = (removeProcessed: boolean = false) => {
    const formattedAnalyst = analista.trim() || currentUser?.email || 'financeiro@wanfinance.com.br';
    localStorage.setItem('last_analyst_name', formattedAnalyst);

    const blob = new Blob([result.fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onSaveToHistory(
      result.fileContent,
      result.totalBoletos,
      result.totalValor,
      defaultFilename,
      company.nsa,
      formattedAnalyst,
      removeProcessed
    );

    setDownloadSuccessMessage(`Arquivo ${defaultFilename} baixado e registrado no histórico!`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result.fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeHighlight =
    selectedLineIndex !== null && result.highlights[selectedLineIndex]
      ? result.highlights[selectedLineIndex]
      : null;

  const allSelected = boletos.length > 0 && boletos.every((b) => b.selected);

  // Check boletos missing beneficiary CNPJ/CPF for Santander J-52 compliance
  const isSantanderAccount = company.bancoCodigo === '033' || company.padraoCNAB === '240';
  const boletosMissingDoc = validBoletos.filter((b) => {
    const docClean = (b.favorecidoCnpjCpf || b.beneficiarioCnpjCpf || '').replace(/\D/g, '');
    return !docClean || docClean === '00000000000000' || docClean === '0';
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="bg-slate-900 text-white px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-extrabold text-white">
                  Gerador CNAB {company.padraoCNAB}
                </h3>
                <span className="bg-amber-500/10 text-amber-400 text-xs px-2.5 py-0.5 rounded-full border border-amber-500/30 font-mono font-bold">
                  {defaultFilename}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {result.totalBoletos} boletos | R$ {result.totalValor.toFixed(2)} | NSA #{company.bancoCodigo === '033' && (company.nsa || 1) < 11 ? 11 : company.nsa} {company.bancoCodigo === '033' ? '(Produção Santander)' : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Company & Bank Selection Quick Toolbar */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
              <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold text-slate-700">Empresa:</span>
              <select
                value={activeCompanyId}
                onChange={(e) => {
                  onSelectCompany(e.target.value);
                  setDownloadSuccessMessage(null);
                }}
                className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer pr-1"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nomeFantasia || c.razaoSocial} ({c.cnpjCpf})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
              <span className="font-bold text-slate-700">Conta / Banco:</span>
              <select
                value={activeBankId}
                onChange={(e) => {
                  onSelectBank(e.target.value);
                  setDownloadSuccessMessage(null);
                }}
                className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer pr-1"
              >
                {companyBanks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.apelido} ({b.bancoNome} - CNAB {b.padraoCNAB})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => setShowBoletosManager(!showBoletosManager)}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            <span>{showBoletosManager ? 'Ocultar Seleção de Boletos' : 'Adicionar / Remover Boletos'}</span>
            {showBoletosManager ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Post-Download Success Banner */}
        {downloadSuccessMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 animate-fade-in">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-emerald-900">{downloadSuccessMessage}</h4>
                <p className="text-xs text-emerald-700">
                  Deseja gerar novamente este lote com outra empresa ou alterar os boletos?
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => setDownloadSuccessMessage(null)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Gerar Novamente / Regerar</span>
              </button>
              <button
                onClick={onClose}
                className="bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-bold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Concluir & Fechar
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {/* Santander Beneficiary CNPJ Compliance Alert */}
          {isSantanderAccount && boletosMissingDoc.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start space-x-3 text-xs text-amber-950 shadow-xs animate-fade-in">
              <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                ⚠️
              </div>
              <div className="space-y-1">
                <p className="font-extrabold text-amber-950 text-sm flex items-center gap-1.5">
                  <span>Validação Santander V11.7: {boletosMissingDoc.length} boleto(s) sem CNPJ/CPF do Beneficiário</span>
                </p>
                <p className="text-amber-900">
                  O Banco Santander exige obrigatoriamente no <strong>Segmento J-52 (Posições 76 e 77-91)</strong> o Tipo e o Número de Inscrição real do Beneficiário/Favorecido para evitar rejeição com ocorrência <strong>"AT" (Inscrição do Beneficiário Inválida)</strong>.
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {boletosMissingDoc.map((b) => (
                    <span key={b.id} className="bg-amber-100 border border-amber-300 text-amber-950 px-2 py-0.5 rounded font-mono text-[11px] font-bold">
                      {b.favorecidoNome} ({b.seuNumero || 'Sem Ref'})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Boletos Management Drawer / Section */}
          {showBoletosManager && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-fade-in shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center space-x-2">
                  <ListFilter className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Gerenciar Boletos Incluídos no Lote ({validBoletos.length} de {boletos.length} selecionados)
                  </h4>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onSelectAllBoletos(!allSelected)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center space-x-1"
                  >
                    {allSelected ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                    <span>{allSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}</span>
                  </button>
                  <button
                    onClick={onOpenNewBoletoModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center space-x-1 shadow-2xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Inserir Boleto</span>
                  </button>
                </div>
              </div>

              {boletos.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Nenhum boleto cadastrado no sistema.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-200 pr-1">
                  {boletos.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => onToggleSelectBoleto(b.id)}
                      className={`py-2 px-3 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs my-1 ${
                        b.selected ? 'bg-blue-50/80 border border-blue-200 text-slate-900' : 'bg-white border border-slate-200 text-slate-500 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <input
                          type="checkbox"
                          checked={b.selected}
                          onChange={() => {}}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="truncate">
                          <span className="font-bold text-slate-900 block truncate">
                            {b.favorecidoNome}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 block truncate">
                            {b.linhaDigitavel || b.codigoBarras}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <span className="font-extrabold text-slate-900 block">
                          R$ {b.valor.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Venc: {b.dataVencimento || 'N/I'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Main Visual CNAB Code Viewer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 font-bold text-slate-700">
                <Code className="w-4 h-4 text-blue-600" />
                Conteúdo do Arquivo CNAB (Posição Fixa de {company.padraoCNAB} caracteres por linha)
              </span>
              <span className="font-mono text-slate-500 font-semibold">
                Linhas Totais: {lines.length}
              </span>
            </div>

            {/* Line-by-line monospace display */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-xs overflow-x-auto divide-y divide-slate-800/40 max-h-72 shadow-inner text-slate-200">
              {lines.map((line, idx) => {
                const isSelected = selectedLineIndex === idx;
                const highlight = result.highlights[idx];

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedLineIndex(idx)}
                    className={`py-1.5 px-2 rounded cursor-pointer transition-colors flex items-center space-x-3 hover:bg-slate-800/80 ${
                      isSelected ? 'bg-blue-900/90 border border-blue-400 text-blue-100' : 'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-500 font-bold select-none w-8 text-right shrink-0">
                      {idx + 1}
                    </span>
                    <span className="whitespace-pre truncate flex-1 tracking-widest text-[11px]">
                      {line}
                    </span>
                    {highlight && (
                      <span className="text-[10px] bg-slate-800 text-blue-300 px-2 py-0.5 rounded font-sans font-bold shrink-0">
                        {highlight.description.split(' - ')[0]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financial Analyst Identification Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-900 block">
                  Analista Financeiro Responsável
                </label>
                <p className="text-[11px] text-slate-500 font-medium">
                  Identifique quem está gerando e transmitindo esta remessa no histórico
                </p>
              </div>
            </div>
            <input
              type="text"
              value={analista}
              onChange={(e) => setAnalista(e.target.value)}
              placeholder="Ex: Carlos Andrade (Financeiro)"
              className="w-full sm:w-64 bg-white border border-slate-300 text-slate-900 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-600 font-semibold"
            />
          </div>

          {/* Line Inspector breakdown */}
          {activeHighlight && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Inspetor de Campos da Linha #{activeHighlight.lineNumber} - {activeHighlight.description}
                  </h4>
                </div>
                <span className="text-[11px] text-slate-500 font-mono font-bold">
                  {company.padraoCNAB} colunas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {activeHighlight.fields.map((field, fIdx) => (
                  <div key={fIdx} className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold font-mono bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded">
                        Pos {field.pos}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">{field.name}</span>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-900 truncate">
                      {field.value || '(brancos)'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">{field.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado!' : 'Copiar Texto CNAB'}</span>
            </button>

            <button
              onClick={() => setShowBoletosManager(!showBoletosManager)}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              <span>Modificar Boletos no Lote</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>

            <button
              onClick={() => handleDownload(false)}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center space-x-1.5 cursor-pointer"
              title="Baixa o arquivo e mantém os boletos para regerar com outra empresa"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Baixar (Manter Boletos)</span>
            </button>

            <button
              onClick={() => handleDownload(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
              title="Baixa o arquivo e conclui os boletos processados"
            >
              <Download className="w-4 h-4" />
              <span>Baixar & Concluir Lote</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
