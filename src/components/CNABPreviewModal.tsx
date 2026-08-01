import React, { useState } from 'react';
import { CompanySettings, BoletoItem, CNABLineHighlight } from '../types';
import { generateCNAB240 } from '../utils/cnabGenerator240';
import { generateCNAB400 } from '../utils/cnabGenerator400';
import { X, Download, Copy, Check, Eye, FileText, Info, Code, Layers, UserCheck, PlusCircle } from 'lucide-react';

interface CNABPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanySettings;
  boletos: BoletoItem[];
  onSaveToHistory: (
    fileContent: string,
    totalBoletos: number,
    totalValor: number,
    filename: string,
    nsa: number,
    analista?: string
  ) => void;
}

export const CNABPreviewModal: React.FC<CNABPreviewModalProps> = ({
  isOpen,
  onClose,
  company,
  boletos,
  onSaveToHistory,
}) => {
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const [analista, setAnalista] = useState(() => localStorage.getItem('last_analyst_name') || '');

  if (!isOpen) return null;

  const validBoletos = boletos.filter((b) => b.selected && b.isValid);

  const result =
    company.padraoCNAB === '400'
      ? generateCNAB400(company, validBoletos)
      : generateCNAB240(company, validBoletos);

  const lines = result.fileContent.split('\r\n');

  // Filename formatting (ex: CB300701.REM or CNAB240_ITAU_NSA1.REM)
  const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2); // YYMMDD
  const defaultFilename = `CB${todayStr}${String(company.nsa).padStart(2, '0')}.REM`;

  const handleDownload = () => {
    const formattedAnalyst = analista.trim() || 'Analista Financeiro';
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
      formattedAnalyst
    );
    onClose();
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-extrabold text-slate-900">
                  Arquivo CNAB {company.padraoCNAB} Gerado
                </h3>
                <span className="bg-blue-50 text-blue-800 text-xs px-2.5 py-0.5 rounded-full border border-blue-200 font-mono font-bold">
                  {defaultFilename}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {result.totalBoletos} boletos incluídos | Somatório Total: R${' '}
                {result.totalValor.toFixed(2)} | NSA #{company.nsa}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Main Visual CNAB Code Viewer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 font-bold text-slate-700">
                <Code className="w-4 h-4 text-blue-600" />
                Conteúdo do Arquivo (Posição Fixa de {company.padraoCNAB} caracteres por linha)
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
              onClick={onClose}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-blue-600" />
              <span>+ Inserir Mais Boletos neste Lote</span>
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              onClick={handleDownload}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Arquivo .REM</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
