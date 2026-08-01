import React, { useState, useMemo } from 'react';
import { BoletoItem, CNABBatchHistory } from '../types';
import { parseLinhaDigitavel, formatCurrencyBRL } from '../utils/boletoParser';
import { getBankInfo } from '../utils/banks';
import { X, Sparkles, FileText, CheckCircle2, AlertCircle, Plus, Copy, FileCode, AlertTriangle, Calendar } from 'lucide-react';
import { detectBoletoDuplicate } from '../utils/duplicateDetector';

interface BatchPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBoletos: (boletos: BoletoItem[]) => void;
  existingBoletos?: BoletoItem[];
  history?: CNABBatchHistory[];
}

export const BatchPasteModal: React.FC<BatchPasteModalProps> = ({
  isOpen,
  onClose,
  onImportBoletos,
  existingBoletos = [],
  history = [],
}) => {
  const [rawText, setRawText] = useState('');
  const [batchPaymentDate, setBatchPaymentDate] = useState('');
  const [customPaymentDates, setCustomPaymentDates] = useState<Record<string, string>>({});

  // Extract all lines or numbers with 44-48 digits from textarea
  const parsedItems = useMemo(() => {
    if (!rawText.trim()) return [];

    // Split by newlines or semicolons
    const lines = rawText
      .split(/[\n;\r]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const items: BoletoItem[] = [];

    lines.forEach((line, index) => {
      const parsed = parseLinhaDigitavel(line);

      const bankInfo = getBankInfo(parsed.bancoCodigo);
      const itemId = `bol-batch-${index}`;

      const due = parsed.dataVencimento || new Date().toISOString().split('T')[0];
      const selectedPayDate = customPaymentDates[itemId] || batchPaymentDate || due;

      items.push({
        id: itemId,
        linhaDigitavel: parsed.linhaDigitavelLimpa || line.replace(/\D/g, ''),
        codigoBarras: parsed.codigoBarras || line.replace(/\D/g, ''),
        bancoCodigo: parsed.bancoCodigo,
        bancoNome: bankInfo.shortName,
        favorecidoNome: `BOLETO IMPORTADO #${index + 1}`,
        favorecidoCnpjCpf: '',
        valor: parsed.valor || 0,
        dataVencimento: due,
        dataPagamento: selectedPayDate,
        seuNumero: `IMP-${index + 1}`,
        desconto: 0,
        jurosMulta: 0,
        categoria: 'Importado em Lote',
        observacoes: 'Linha digitável importada em lote',
        isValid: parsed.isValid,
        validationError: parsed.errorMessage,
        selected: true,
        createdAt: new Date().toISOString(),
      });
    });

    return items;
  }, [rawText, batchPaymentDate, customPaymentDates]);

  // Duplicates map for parsedItems
  const duplicateMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof detectBoletoDuplicate>>();
    parsedItems.forEach((item) => {
      const dup = detectBoletoDuplicate(item, parsedItems, existingBoletos, history);
      map.set(item.id, dup);
    });
    return map;
  }, [parsedItems, existingBoletos, history]);

  const duplicateCount = useMemo(() => {
    let count = 0;
    duplicateMap.forEach((dup) => {
      if (dup.isDuplicate) count++;
    });
    return count;
  }, [duplicateMap]);

  const validItems = useMemo(() => parsedItems.filter((item) => item.isValid), [parsedItems]);
  const totalValorValid = useMemo(
    () => validItems.reduce((acc, item) => acc + item.valor, 0),
    [validItems]
  );

  const handleRemoveDuplicates = () => {
    const seen = new Set<string>();
    const lines = rawText
      .split(/[\n;\r]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const filteredLines = lines.filter((line, idx) => {
      const item = parsedItems[idx];
      if (!item) return true;
      const dup = duplicateMap.get(item.id);
      if (dup?.isSystemDuplicate || dup?.isHistoryDuplicate) return false;

      const key = item.linhaDigitavel || item.codigoBarras;
      if (key && seen.has(key)) return false;
      if (key) seen.add(key);
      return true;
    });

    setRawText(filteredLines.join('\n'));
  };

  const handleImport = () => {
    if (parsedItems.length === 0) return;
    onImportBoletos(parsedItems);
    setRawText('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
        {/* Modal Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Importação / Colagem em Lote</h3>
              <p className="text-xs text-slate-500 font-medium">
                Cole várias linhas digitáveis (uma por linha) para processar de uma só vez
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Linhas Digitáveis (Uma por Linha)
            </label>
            <textarea
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Cole aqui as linhas digitáveis, por exemplo:\n00190000090123456700400001234567885000000012345\n23790000020111122220300003333444585000000085000\n34191234560000012345612345678901285000000150000`}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono rounded-xl p-3 focus:outline-none focus:border-blue-600 focus:bg-white placeholder-slate-400 font-semibold"
            />
          </div>

          {/* Quick Examples */}
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              Exemplo: Cole texto exportado da sua planilha ou sistema financeiro
            </span>
            <button
              type="button"
              onClick={() =>
                setRawText(
                  `00190000090123456700400001234567885000000012345\n23790000020111122220300003333444585000000085000\n34191234560000012345612345678901285000000150000`
                )
              }
              className="text-blue-600 hover:underline font-bold cursor-pointer"
            >
              + Inserir Linhas de Exemplo
            </button>
          </div>

          {/* Real-time Preview Table of Parsed Items */}
          {parsedItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-900 font-bold">
                    {validItems.length} de {parsedItems.length} boletos reconhecidos com sucesso!
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {duplicateCount > 0 && (
                    <button
                      type="button"
                      onClick={handleRemoveDuplicates}
                      className="text-[11px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg border border-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      <span>Remover {duplicateCount} Duplicado(s)</span>
                    </button>
                  )}
                  <div className="font-mono text-emerald-900 font-black">
                    Total: {formatCurrencyBRL(totalValorValid)}
                  </div>
                  {validItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleImport}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar {validItems.length} Pronto{validItems.length !== 1 ? 's' : ''}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Batch Payment Date Selector Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs shadow-xs">
                <div className="flex items-center space-x-2.5 text-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-extrabold block text-slate-900 text-xs">Data de Pagamento para os Boletos do Lote</span>
                    <span className="text-[11px] text-slate-500 font-medium">Agende a data do débito para todos os itens colados</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={batchPaymentDate}
                    onChange={(e) => setBatchPaymentDate(e.target.value)}
                    className="bg-white border border-slate-300 text-blue-900 font-mono text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-blue-600 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setBatchPaymentDate(new Date().toISOString().split('T')[0])}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBatchPaymentDate('');
                      setCustomPaymentDates({});
                    }}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer"
                  >
                    Vencimento
                  </button>
                </div>
              </div>

              {duplicateCount > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between text-amber-900 text-xs shadow-xs">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Foram detectadas <strong>{duplicateCount} linha(s) repetida(s)</strong> no lote ou já cadastradas no sistema.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveDuplicates}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Excluir Repetidos
                  </button>
                </div>
              )}

              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-200 bg-slate-50/50 text-xs">
                {parsedItems.map((item, idx) => {
                  const dup = duplicateMap.get(item.id);

                  return (
                    <div
                      key={item.id || idx}
                      className={`p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        dup?.isDuplicate ? 'bg-amber-50' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        {item.isValid ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                        )}
                        <span className="font-mono text-slate-500 font-bold">[{item.bancoCodigo}]</span>
                        <span className="font-mono text-slate-800 truncate max-w-xs font-semibold">{item.linhaDigitavel}</span>

                        {dup?.isSameBatchDuplicate && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded shrink-0">
                            Repetido no lote
                          </span>
                        )}

                        {(dup?.isSystemDuplicate || dup?.isHistoryDuplicate) && (
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300 px-1.5 py-0.5 rounded shrink-0">
                            Já cadastrado
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 shrink-0 justify-between sm:justify-end">
                        <span className="font-mono text-slate-900 font-black">
                          {formatCurrencyBRL(item.valor)}
                        </span>
                        <div className="flex items-center space-x-1 text-[11px]">
                          <span className="text-slate-500 hidden md:inline font-medium">Venc: {item.dataVencimento}</span>
                          <span className="text-slate-600 font-bold">Pgto:</span>
                          <input
                            type="date"
                            value={item.dataPagamento}
                            onChange={(e) =>
                              setCustomPaymentDates((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            className="bg-white border border-slate-300 text-blue-900 font-mono text-[11px] px-2 py-0.5 rounded focus:outline-none focus:border-blue-600 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setRawText('')}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
            >
              Limpar Texto
            </button>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={parsedItems.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Importar {parsedItems.length} Boletos
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
