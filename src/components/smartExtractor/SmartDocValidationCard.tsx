import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Trash2, 
  Brain, 
  Calendar, 
  DollarSign, 
  Hash, 
  User, 
  Barcode, 
  Car, 
  Clock,
  Edit2,
  Check,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { SmartExtractedDocument } from '../../utils/smartExtractor/smartDocTypes';
import { SmartValidationBadge } from './SmartValidationBadge';
import { validateExtractedDocument } from '../../utils/smartExtractor/smartValidator';
import { learnSmartDocLayout } from '../../utils/smartExtractor/smartLayoutMemory';

interface SmartDocValidationCardProps {
  document: SmartExtractedDocument;
  onUpdateDocument: (updated: SmartExtractedDocument) => void;
  onDeleteDocument: (id: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'warning' | 'info') => void;
}

export const SmartDocValidationCard: React.FC<SmartDocValidationCardProps> = ({
  document,
  onUpdateDocument,
  onDeleteDocument,
  onShowToast,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [editForm, setEditForm] = useState({
    linhaDigitavel: document.linhaDigitavel,
    codigoBarras: document.codigoBarras,
    valor: document.valor,
    dataVencimento: document.dataVencimento,
    dataPagamento: document.dataPagamento || document.dataVencimento,
    favorecidoNome: document.favorecidoNome,
    favorecidoCnpjCpf: document.favorecidoCnpjCpf,
    pagadorNome: document.pagadorNome,
    pagadorCnpjCpf: document.pagadorCnpjCpf,
    seuNumero: document.seuNumero,
    nossoNumero: document.nossoNumero,
    chassi: document.chassi || '',
    placa: document.placa || '',
    renavam: document.renavam || '',
  });

  const handleSaveEdits = () => {
    const updatedValidation = validateExtractedDocument({
      linhaDigitavel: editForm.linhaDigitavel,
      codigoBarras: editForm.codigoBarras,
      valor: editForm.valor,
      dataVencimento: editForm.dataVencimento,
      favorecidoNome: editForm.favorecidoNome,
      favorecidoCnpjCpf: editForm.favorecidoCnpjCpf,
      pagadorNome: editForm.pagadorNome,
      pagadorCnpjCpf: editForm.pagadorCnpjCpf,
      seuNumero: editForm.seuNumero,
      nossoNumero: editForm.nossoNumero,
      chassi: editForm.chassi,
      placa: editForm.placa,
      docCategory: document.detectedCategory,
    });

    const updatedDoc: SmartExtractedDocument = {
      ...document,
      ...editForm,
      validation: updatedValidation,
    };

    onUpdateDocument(updatedDoc);
    setIsEditing(false);
    onShowToast('Dados do documento atualizados e revalidados com sucesso!', 'success');
  };

  const handleMemorizeLayout = () => {
    learnSmartDocLayout(document, document.rawTextPreview || '');
    onShowToast(`Layout de "${document.favorecidoNome}" memorizado para a IA da Nova Aba!`, 'info');
  };

  const { validation } = document;

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        validation.overallStatus === 'valid'
          ? 'bg-white/95 dark:bg-[#1f1f21]/95 border-emerald-500/30 shadow-xs'
          : validation.overallStatus === 'warning'
          ? 'bg-amber-500/[0.02] dark:bg-amber-500/[0.03] border-amber-500/40 shadow-xs'
          : 'bg-rose-500/[0.02] dark:bg-rose-500/[0.03] border-rose-500/40 shadow-xs'
      }`}
    >
      {/* Top Header Row */}
      <div className="px-4 py-3 border-b border-black/[0.05] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2 bg-black/[0.01] dark:bg-white/[0.02]">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={document.selected}
            onChange={(e) => onUpdateDocument({ ...document, selected: e.target.checked })}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
          />

          <div className="flex items-center space-x-2">
            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-[300px]">
              {document.fileName}
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wide">
              {document.montadoraMarca || document.detectedCategory.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Status Score & Actions */}
        <div className="flex items-center space-x-2">
          {/* Score Badge */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08]">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Score de Precisão:</span>
            <span
              className={`text-xs font-black ${
                validation.score >= 90
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : validation.score >= 60
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {validation.score}%
            </span>
          </div>

          <SmartValidationBadge status={validation.overallStatus} />

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
            title="Editar campos manualmente"
          >
            <Edit2 className="w-4 h-4 text-blue-500" />
          </button>

          <button
            type="button"
            onClick={handleMemorizeLayout}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
            title="Aprender este layout"
          >
            <Brain className="w-4 h-4 text-purple-500" />
          </button>

          <button
            type="button"
            onClick={() => onDeleteDocument(document.id)}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
            title="Remover documento"
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
          </button>
        </div>
      </div>

      {/* Review Warnings Box if needed */}
      {validation.requiresReview && validation.reviewReasons.length > 0 && (
        <div className="px-4 py-2 bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Pontos de Atenção para Conferência:</span>
            <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px]">
              {validation.reviewReasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Main Extracted Grid Form */}
      <div className="p-4">
        {isEditing ? (
          /* Edit Mode Form */
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Beneficiário / Favorecido
                </label>
                <input
                  type="text"
                  value={editForm.favorecidoNome}
                  onChange={(e) => setEditForm({ ...editForm, favorecidoNome: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.1] dark:border-white/[0.1] focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  CNPJ / CPF Beneficiário
                </label>
                <input
                  type="text"
                  value={editForm.favorecidoCnpjCpf}
                  onChange={(e) => setEditForm({ ...editForm, favorecidoCnpjCpf: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.1] dark:border-white/[0.1] focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.valor}
                  onChange={(e) => setEditForm({ ...editForm, valor: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.1] dark:border-white/[0.1] focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data de Vencimento
                </label>
                <input
                  type="date"
                  value={editForm.dataVencimento}
                  onChange={(e) => setEditForm({ ...editForm, dataVencimento: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.1] dark:border-white/[0.1] focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Linha Digitável (47 ou 48 dígitos)
                </label>
                <input
                  type="text"
                  value={editForm.linhaDigitavel}
                  onChange={(e) => setEditForm({ ...editForm, linhaDigitavel: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.1] dark:border-white/[0.1] focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Compromisso / Seu Número
                </label>
                <input
                  type="text"
                  value={editForm.seuNumero}
                  onChange={(e) => setEditForm({ ...editForm, seuNumero: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.1] dark:border-white/[0.1] focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chassi do Veículo
                </label>
                <input
                  type="text"
                  value={editForm.chassi}
                  onChange={(e) => setEditForm({ ...editForm, chassi: e.target.value.toUpperCase() })}
                  className="w-full px-2.5 py-1.5 rounded-xl text-xs bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.1] dark:border-white/[0.1] focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdits}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Salvar e Revalidar</span>
              </button>
            </div>
          </div>
        ) : (
          /* View Mode Display with Field Badges */
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Favorecido Card */}
              <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <User className="w-3 h-3 text-blue-500" /> Beneficiário
                  </span>
                  <SmartValidationBadge validation={validation.beneficiario} size="sm" showLabel={false} />
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={document.favorecidoNome}>
                  {document.favorecidoNome}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    {document.favorecidoCnpjCpf || 'Sem CNPJ'}
                  </span>
                  <SmartValidationBadge validation={validation.beneficiarioCnpjCpf} size="sm" showLabel={false} />
                </div>
              </div>

              {/* Valor Card */}
              <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-500" /> Valor a Pagar
                  </span>
                  <SmartValidationBadge validation={validation.valor} size="sm" showLabel={false} />
                </div>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {document.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Banco: {document.bancoNome} ({document.bancoCodigo})
                </span>
              </div>

              {/* Vencimento Card */}
              <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-purple-500" /> Vencimento
                  </span>
                  <SmartValidationBadge validation={validation.vencimento} size="sm" showLabel={false} />
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {document.dataVencimento.split('-').reverse().join('/')}
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Doc / Compromisso: {document.seuNumero}
                </span>
              </div>

              {/* Chassi / Identificador Card */}
              <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Car className="w-3 h-3 text-amber-500" /> Identificador Veicular / Guia
                  </span>
                  {validation.veiculoDados && (
                    <SmartValidationBadge validation={validation.veiculoDados} size="sm" showLabel={false} />
                  )}
                </div>
                <p className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate">
                  {document.chassi || document.placa || document.codigoReceita || document.seuNumero || 'N/A'}
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                  {document.pagadorNome ? `Pagador: ${document.pagadorNome}` : 'Pronto para remessa'}
                </span>
              </div>
            </div>

            {/* Linha Digitável Banner */}
            <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2 overflow-hidden">
                <Barcode className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 truncate select-all">
                  {document.linhaDigitavel || document.codigoBarras || 'Linha digitável não identificada'}
                </span>
              </div>
              <SmartValidationBadge validation={validation.barcode} size="sm" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
