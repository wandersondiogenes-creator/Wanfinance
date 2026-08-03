import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Edit3,
  Check,
  Building2,
  Calendar,
  DollarSign,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { BoletoItem, CNABBatchHistory } from '../types';
import { parseLinhaDigitavel, formatCurrencyBRL, formatDateBR, onlyNumbers } from '../utils/boletoParser';
import { getBankInfo } from '../utils/banks';
import { detectBoletoDuplicate } from '../utils/duplicateDetector';
import { extractBoletosLocallyInBrowser } from '../utils/pdfLocalExtractor';

interface PDFExtractedItem {
  id: string;
  fileName: string;
  boletoIndex?: number;
  totalInFile?: number;
  status: 'pending' | 'loading' | 'success' | 'error';
  errorMessage?: string;
  data?: {
    linhaDigitavel: string;
    codigoBarras: string;
    favorecidoNome: string;
    favorecidoCnpjCpf: string;
    valor: number;
    dataVencimento: string;
    dataPagamento?: string;
    seuNumero: string;
    nossoNumero: string;
    bancoCodigo: string;
    bancoNome: string;
    observacoes: string;
    desconto?: number;
    jurosMulta?: number;
    confidence: number;
  };
}

interface PDFBoletoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBoletos: (boletos: BoletoItem[]) => void;
  existingBoletos?: BoletoItem[];
  history?: CNABBatchHistory[];
}

function parseExtractedValor(val: any, fallbackVal: number): number {
  if (typeof val === 'number' && !isNaN(val) && val > 0) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d.,]/g, '');
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      const whole = parts[0].replace(/\./g, '');
      const decimals = parts[1];
      const num = parseFloat(`${whole}.${decimals}`);
      if (!isNaN(num) && num > 0) return num;
    } else {
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return fallbackVal > 0 ? fallbackVal : 0;
}

export const PDFBoletoImportModal: React.FC<PDFBoletoImportModalProps> = ({
  isOpen,
  onClose,
  onImportBoletos,
  existingBoletos = [],
  history = [],
}) => {
  const [items, setItems] = useState<PDFExtractedItem[]>([]);
  const [batchPaymentDate, setBatchPaymentDate] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApplyBatchPaymentDate = (date: string) => {
    setBatchPaymentDate(date);
    if (!date) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.data) {
          return { ...item, data: { ...item.data, dataPagamento: date } };
        }
        return item;
      })
    );
  };

  const processFile = async (file: File): Promise<PDFExtractedItem[]> => {
    try {
      // Convert file to Base64
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      let rawBoletos: any[] = [];
      let serverSuccess = false;
      let serverErrorMsg = '';

      // 1. Attempt Server API Extraction
      try {
        const response = await fetch('/api/extract-boleto-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64,
            mimeType: file.type || 'application/pdf',
            fileName: file.name,
          }),
        });

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const result = await response.json();
          if (result && result.success && Array.isArray(result.boletos) && result.boletos.length > 0) {
            rawBoletos = result.boletos;
            serverSuccess = true;
          } else if (result && result.geminiApiError) {
            serverErrorMsg = `Erro na API Gemini: ${result.geminiApiError}`;
          }
        } else {
          serverErrorMsg = `Servidor respondeu com status ${response.status}`;
          console.warn('[PDF Import] Server endpoint returned non-JSON/error status:', response.status, contentType);
        }
      } catch (fetchErr: any) {
        serverErrorMsg = `Falha na requisição ao servidor: ${fetchErr?.message || fetchErr}`;
        console.warn('[PDF Import] Server fetch failed, falling back to browser extractor:', fetchErr);
      }

      // 2. Client-Side Fallback Extractor if Server API failed or returned 0 boletos
      if (!serverSuccess || rawBoletos.length === 0) {
        console.log('[PDF Import] Executando leitor de PDF local no navegador...');
        const localExtracted = await extractBoletosLocallyInBrowser(fileBase64, file.name);
        if (localExtracted.length > 0) {
          rawBoletos = localExtracted;
        }
      }

      if (rawBoletos.length === 0) {
        const detailMsg = serverErrorMsg ? ` (${serverErrorMsg})` : '';
        return [
          {
            id: `pdf-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            fileName: file.name,
            status: 'error',
            errorMessage: `Nenhum boleto válido com linha digitável/código de barras foi identificado neste arquivo${detailMsg}. Se o arquivo for uma imagem digitalizada sem texto, cole a linha digitável abaixo.`,
          },
        ];
      }

      return rawBoletos.map((extracted, idx) => {
        const itemId = `pdf-item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
        const rawDigits = extracted.linhaDigitavel || extracted.codigoBarras || '';
        const cleanLinha = onlyNumbers(rawDigits);
        const parsedCheck = parseLinhaDigitavel(cleanLinha);

        const finalBancoCodigo = extracted.bancoCodigo || parsedCheck.bancoCodigo || '000';
        const bankInfo = getBankInfo(finalBancoCodigo);
        const finalValor = parseExtractedValor(extracted.valor, parsedCheck.valor);

        const finalFavorecido = extracted.favorecidoNome || extracted.beneficiario || extracted.cedente || 'Favorecido Não Identificado';
        const finalCnpj = extracted.favorecidoCnpjCpf || extracted.CNPJ || '';
        const finalSeuNumero = extracted.numeroDocumento || extracted.seuNumero || `DOC-${Math.floor(Math.random() * 89999 + 10000)}`;
        const finalBancoNome = bankInfo.shortName || extracted.bancoNome || extracted.banco || 'Banco Não Identificado';

        return {
          id: itemId,
          fileName: file.name,
          boletoIndex: idx + 1,
          totalInFile: rawBoletos.length,
          status: 'success',
          data: {
            linhaDigitavel: cleanLinha || extracted.linhaDigitavel || '',
            codigoBarras: extracted.codigoBarras || parsedCheck.codigoBarras || '',
            favorecidoNome: finalFavorecido,
            favorecidoCnpjCpf: finalCnpj,
            valor: finalValor,
            dataVencimento: extracted.dataVencimento || parsedCheck.dataVencimento || new Date().toISOString().split('T')[0],
            dataPagamento: batchPaymentDate || extracted.dataVencimento || parsedCheck.dataVencimento || new Date().toISOString().split('T')[0],
            seuNumero: finalSeuNumero,
            nossoNumero: extracted.nossoNumero || '',
            bancoCodigo: finalBancoCodigo,
            bancoNome: finalBancoNome,
            observacoes: extracted.observacoes || (rawBoletos.length > 1 ? `Boleto ${idx + 1}/${rawBoletos.length} de ${file.name}` : `Extraído de ${file.name}`),
            confidence: extracted.confidence || 0.9,
          },
        };
      });
    } catch (err: any) {
      return [
        {
          id: `pdf-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          fileName: file.name,
          status: 'error',
          errorMessage: err.message || 'Erro desconhecido ao processar arquivo.',
        },
      ];
    }
  };

  const handleManualConvert = (itemId: string, fileName: string, rawInput: string) => {
    if (!rawInput.trim()) return;

    // Extract all digits or search for 47/48 digit sequence in input
    let finalLinha = onlyNumbers(rawInput);

    if (finalLinha.length !== 47 && finalLinha.length !== 48) {
      const match = rawInput.match(/\d{47,48}/);
      if (match) {
        finalLinha = match[0];
      }
    }

    const parsed = parseLinhaDigitavel(finalLinha);

    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          return {
            ...it,
            status: 'success',
            errorMessage: undefined,
            data: {
              linhaDigitavel: finalLinha,
              codigoBarras: parsed.codigoBarras || finalLinha,
              favorecidoNome: 'Favorecido Preenchido Manualmente',
              favorecidoCnpjCpf: '',
              valor: parsed.valor || 0,
              dataVencimento: parsed.dataVencimento || new Date().toISOString().split('T')[0],
              dataPagamento: batchPaymentDate || parsed.dataVencimento || new Date().toISOString().split('T')[0],
              seuNumero: `MANUAL-${Math.floor(Math.random() * 8999 + 1000)}`,
              nossoNumero: '',
              bancoCodigo: parsed.bancoCodigo || '000',
              bancoNome: parsed.bancoNome || 'Banco Não Identificado',
              observacoes: `Manual do arquivo ${fileName}`,
              confidence: 1.0,
            },
          };
        }
        return it;
      })
    );
  };

  const handleFilesAdded = async (filesList: FileList | File[]) => {
    const files = Array.from(filesList).filter(
      (f) => f.type.includes('pdf') || f.type.includes('image') || f.name.toLowerCase().endsWith('.pdf')
    );

    if (files.length === 0) return;

    setIsProcessingAll(true);

    // Placeholders while reading
    const loadingPlaceholders: PDFExtractedItem[] = files.map((f, i) => ({
      id: `loading-${f.name}-${Date.now()}-${i}`,
      fileName: f.name,
      status: 'loading',
    }));

    setItems((prev) => [...prev, ...loadingPlaceholders]);

    for (const file of files) {
      const processedItems = await processFile(file);

      setItems((prev) => {
        const filtered = prev.filter(
          (item) => !(item.fileName === file.name && item.status === 'loading')
        );

        // Deduplicate processedItems against filtered existing items by linhaDigitavel/codigoBarras
        const existingKeys = new Set<string>();
        filtered.forEach((it) => {
          if (it.data) {
            const key = onlyNumbers(it.data.linhaDigitavel || it.data.codigoBarras || '');
            if (key.length >= 10) existingKeys.add(key);
          }
        });

        const uniqueNew: PDFExtractedItem[] = [];
        for (const newIt of processedItems) {
          if (newIt.data) {
            const newKey = onlyNumbers(newIt.data.linhaDigitavel || newIt.data.codigoBarras || '');
            if (newKey.length >= 10) {
              if (!existingKeys.has(newKey)) {
                existingKeys.add(newKey);
                uniqueNew.push(newIt);
              }
            } else {
              uniqueNew.push(newIt);
            }
          } else {
            uniqueNew.push(newIt);
          }
        }

        return [...filtered, ...uniqueNew];
      });
    }

    setIsProcessingAll(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleFieldChange = (id: string, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id && item.data) {
          const updatedData = { ...item.data, [field]: value };
          // If linha digitavel changed, re-parse bank / value / due date if valid
          if (field === 'linhaDigitavel') {
            const parsed = parseLinhaDigitavel(value);
            if (parsed.isValid) {
              if (!updatedData.valor) updatedData.valor = parsed.valor;
              if (parsed.dataVencimento) updatedData.dataVencimento = parsed.dataVencimento;
              if (parsed.bancoCodigo) {
                updatedData.bancoCodigo = parsed.bancoCodigo;
                updatedData.bancoNome = parsed.bancoNome;
              }
            }
          }
          return { ...item, data: updatedData };
        }
        return item;
      })
    );
  };

  const handleConfirmImport = () => {
    const validItems = items.filter((item) => item.status === 'success' && item.data);
    if (validItems.length === 0) return;

    const newBoletos: BoletoItem[] = validItems.map((item) => {
      const d = item.data!;
      const cleanLinha = onlyNumbers(d.linhaDigitavel);
      const parsed = parseLinhaDigitavel(cleanLinha);

      return {
        id: `bol-pdf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        linhaDigitavel: cleanLinha,
        codigoBarras: d.codigoBarras || parsed.codigoBarras,
        bancoCodigo: d.bancoCodigo || parsed.bancoCodigo,
        bancoNome: d.bancoNome || parsed.bancoNome,
        favorecidoNome: d.favorecidoNome || 'Favorecido Não Identificado',
        favorecidoCnpjCpf: d.favorecidoCnpjCpf,
        valor: d.valor,
        dataVencimento: d.dataVencimento,
        dataPagamento: d.dataPagamento || d.dataVencimento, // Custom selected payment date
        seuNumero: d.seuNumero || `DOC-${Math.floor(Math.random() * 89999 + 10000)}`,
        nossoNumero: d.nossoNumero,
        desconto: d.desconto || 0,
        jurosMulta: d.jurosMulta || 0,
        observacoes: d.observacoes,
        isValid: cleanLinha.length === 47 || cleanLinha.length === 48,
        selected: true,
        createdAt: new Date().toISOString(),
      };
    });

    onImportBoletos(newBoletos);
    onClose();
  };

  const successfulCount = items.filter((i) => i.status === 'success').length;

  // Extract candidate items data for batch duplicate check
  const allExtractedData = useMemo(() => {
    return items
      .filter((item) => item.status === 'success' && item.data)
      .map((item) => ({ ...item.data!, id: item.id }));
  }, [items]);

  const duplicateCount = useMemo(() => {
    return items.filter((item) => {
      if (item.status !== 'success' || !item.data) return false;
      const dup = detectBoletoDuplicate(
        { ...item.data, id: item.id },
        allExtractedData,
        existingBoletos,
        history
      );
      return dup.isDuplicate;
    }).length;
  }, [items, allExtractedData, existingBoletos, history]);

  const handleRemoveDuplicates = () => {
    const seenKeys = new Set<string>();
    setItems((prev) =>
      prev.filter((item) => {
        if (item.status !== 'success' || !item.data) return true;
        const dup = detectBoletoDuplicate(
          { ...item.data, id: item.id },
          allExtractedData,
          existingBoletos,
          history
        );

        if (dup.isSystemDuplicate || dup.isHistoryDuplicate) {
          return false;
        }

        const key = onlyNumbers(item.data.linhaDigitavel || item.data.codigoBarras);
        if (key && seenKeys.has(key)) {
          return false;
        }
        if (key) seenKeys.add(key);
        return true;
      })
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full my-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                Extrair Boletos via PDF (IA Gemini)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Envie um ou mais arquivos PDF/Imagens de boletos para extração automática da linha digitável, valor e dados.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-blue-600 bg-blue-50 scale-[0.99]'
                : 'border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesAdded(e.target.files);
              }}
            />
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 font-bold">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              Arraste e solte seus boletos em PDF aqui ou clique para selecionar
            </p>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Suporta PDF individual, faturas de concessionárias, tributos e imagens (PNG, JPG)
            </p>
          </div>

          {/* List of Processed Files */}
          {items.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-2">
                  <span>Boletos Processados ({items.length})</span>
                </h3>
                <div className="flex items-center gap-2">
                  {duplicateCount > 0 && (
                    <button
                      type="button"
                      onClick={handleRemoveDuplicates}
                      className="text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-full border border-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      <span>Remover {duplicateCount} Duplicado(s)</span>
                    </button>
                  )}
                  {successfulCount > 0 && (
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={isProcessingAll}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar {successfulCount} Boleto{successfulCount !== 1 ? 's' : ''} Pronto{successfulCount !== 1 ? 's' : ''}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Duplicate summary warning banner */}
              {duplicateCount > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-3 text-amber-900 text-xs shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-extrabold text-amber-900">
                      Atenção: {duplicateCount} boleto(s) repetido(s) identificado(s)!
                    </p>
                    <p className="text-amber-800 font-medium mt-0.5">
                      Foi detectada duplicação de linha digitável/código de barras no mesmo arquivo ou em relação a boletos já cadastrados no sistema.
                    </p>
                  </div>
                  <button
                    onClick={handleRemoveDuplicates}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors cursor-pointer"
                  >
                    Excluir Repetidos
                  </button>
                </div>
              )}

              {/* Batch Payment Date Selector Control */}
              {successfulCount > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
                  <div className="flex items-center space-x-2.5 text-slate-800">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-extrabold block text-slate-900 text-xs">Data de Pagamento para os Boletos do Lote</span>
                      <span className="text-[11px] text-slate-500 font-medium">Agende a data de débito para todos os boletos extraídos de uma só vez</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <input
                      type="date"
                      value={batchPaymentDate}
                      onChange={(e) => handleApplyBatchPaymentDate(e.target.value)}
                      className="bg-white border border-slate-300 text-blue-900 font-mono text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:border-blue-600 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyBatchPaymentDate(new Date().toISOString().split('T')[0])}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2.5 py-1.5 rounded-xl text-[11px] transition-colors cursor-pointer"
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBatchPaymentDate('');
                        setItems((prev) =>
                          prev.map((item) => {
                            if (item.data) {
                              return { ...item, data: { ...item.data, dataPagamento: item.data.dataVencimento } };
                            }
                            return item;
                          })
                        );
                      }}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2.5 py-1.5 rounded-xl text-[11px] transition-colors cursor-pointer"
                    >
                      Mesmo do Vencimento
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {items.map((item) => {
                  const dupInfo = item.data
                    ? detectBoletoDuplicate(
                        { ...item.data, id: item.id },
                        allExtractedData,
                        existingBoletos,
                        history
                      )
                    : null;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-xl p-4 transition-all ${
                        dupInfo?.isDuplicate
                          ? 'border-amber-300 bg-amber-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      {/* Item Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2 overflow-hidden flex-wrap gap-y-1">
                          <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800 truncate max-w-xs">
                            {item.fileName}
                          </span>
                          {item.totalInFile && item.totalInFile > 1 && item.boletoIndex && (
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md shrink-0">
                              Boleto {item.boletoIndex} de {item.totalInFile}
                            </span>
                          )}

                          {dupInfo?.isSameBatchDuplicate && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Repetido no mesmo arquivo</span>
                            </span>
                          )}

                          {(dupInfo?.isSystemDuplicate || dupInfo?.isHistoryDuplicate) && (
                            <span className="text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>{dupInfo.duplicateReason}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {item.status === 'loading' && (
                            <span className="text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 flex items-center space-x-1.5 font-bold">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                              <span>Extraindo dados com IA...</span>
                            </span>
                          )}

                          {item.status === 'success' && !dupInfo?.isDuplicate && (
                            <span className="text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center space-x-1 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Extraído com Sucesso</span>
                            </span>
                          )}

                          {item.status === 'error' && (
                            <span className="text-xs text-red-800 bg-red-50 px-2.5 py-1 rounded-full border border-red-200 flex items-center space-x-1 font-bold">
                              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                              <span>Erro na extração</span>
                            </span>
                          )}

                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Remover este item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                    {/* Error Message with Manual Digitation Fallback */}
                    {item.status === 'error' && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-900 space-y-2.5">
                        <div>
                          <p className="font-extrabold text-red-900 flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                            <span>{item.errorMessage || 'Não foi possível extrair os dados do boleto automaticamente.'}</span>
                          </p>
                          <p className="text-[11px] text-slate-600 mt-1 font-medium">
                            Seu arquivo PDF pode ser uma imagem digitalizada sem camada de texto. Cole ou digite a linha digitável (47 ou 48 dígitos) abaixo para cadastrar este boleto:
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pt-0.5">
                          <input
                            type="text"
                            placeholder="Cole a linha digitável (ex: 23793.38128 60000.123456...)"
                            className="flex-1 bg-white border border-slate-300 text-slate-900 font-mono text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-blue-600 placeholder:text-slate-400 font-semibold"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value;
                                if (val) handleManualConvert(item.id, item.fileName, val);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              const inputEl = (e.currentTarget.previousElementSibling as HTMLInputElement);
                              const val = inputEl ? inputEl.value : '';
                              if (val) handleManualConvert(item.id, item.fileName, val);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                          >
                            Converter e Incluir
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Success Data Form Fields */}
                    {item.status === 'success' && item.data && (
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        {/* Linha digitavel */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                            Linha Digitável (47 ou 48 dígitos)
                          </label>
                          <input
                            type="text"
                            value={item.data.linhaDigitavel}
                            onChange={(e) => handleFieldChange(item.id, 'linhaDigitavel', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white font-bold"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {/* Favorecido */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                              Favorecido / Beneficiário
                            </label>
                            <input
                              type="text"
                              value={item.data.favorecidoNome}
                              onChange={(e) => handleFieldChange(item.id, 'favorecidoNome', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                            />
                          </div>

                          {/* Valor */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                              Valor (R$)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.data.valor}
                              onChange={(e) => handleFieldChange(item.id, 'valor', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white font-bold"
                            />
                          </div>

                          {/* Data Vencimento */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                              Vencimento
                            </label>
                            <input
                              type="date"
                              value={item.data.dataVencimento}
                              onChange={(e) => handleFieldChange(item.id, 'dataVencimento', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                            />
                          </div>

                          {/* Data Pagamento */}
                          <div>
                            <label className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
                              Data de Pagamento
                            </label>
                            <input
                              type="date"
                              value={item.data.dataPagamento || item.data.dataVencimento}
                              onChange={(e) => handleFieldChange(item.id, 'dataPagamento', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-blue-900 font-mono text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white font-bold"
                            />
                          </div>

                          {/* Banco */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                              Banco / Emissor
                            </label>
                            <div className="flex items-center space-x-2">
                              <span className="bg-blue-100 text-blue-900 font-mono text-[10px] px-2 py-1 rounded font-bold">
                                {item.data.bancoCodigo}
                              </span>
                              <input
                                type="text"
                                value={item.data.bancoNome}
                                onChange={(e) => handleFieldChange(item.id, 'bancoNome', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                              />
                            </div>
                          </div>

                          {/* Seu Numero */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                              Seu Número / NF
                            </label>
                            <input
                              type="text"
                              value={item.data.seuNumero}
                              onChange={(e) => handleFieldChange(item.id, 'seuNumero', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                            />
                          </div>

                          {/* CNPJ Favorecido */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                              CNPJ/CPF Favorecido
                            </label>
                            <input
                              type="text"
                              value={item.data.favorecidoCnpjCpf}
                              placeholder="Opcional"
                              onChange={(e) => handleFieldChange(item.id, 'favorecidoCnpjCpf', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                            />
                          </div>

                          {/* Desconto */}
                          <div>
                            <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                              Desconto (R$)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.data.desconto || 0}
                              onChange={(e) => handleFieldChange(item.id, 'desconto', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-50 border border-slate-200 text-emerald-800 font-mono text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white font-bold"
                            />
                          </div>

                          {/* Juros e Multa */}
                          <div>
                            <label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
                              Juros / Multa (R$)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.data.jurosMulta || 0}
                              onChange={(e) => handleFieldChange(item.id, 'jurosMulta', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-50 border border-slate-200 text-amber-800 font-mono text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-amber-600 focus:bg-white font-bold"
                            />
                          </div>
                        </div>

                        {/* Adjustments Alert Banner if discount or interest present */}
                        {((item.data.desconto && item.data.desconto > 0) || (item.data.jurosMulta && item.data.jurosMulta > 0)) && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
                            <div className="flex items-center space-x-2">
                              {item.data.desconto && item.data.desconto > 0 && (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                  🎁 Desconto: -{formatCurrencyBRL(item.data.desconto)}
                                </span>
                              )}
                              {item.data.jurosMulta && item.data.jurosMulta > 0 && (
                                <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                  ⚡ Juros/Multa: +{formatCurrencyBRL(item.data.jurosMulta)}
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-black text-slate-900">
                              Valor Líquido: {formatCurrencyBRL((item.data.valor || 0) - (item.data.desconto || 0) + (item.data.jurosMulta || 0))}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            onClick={handleConfirmImport}
            disabled={successfulCount === 0 || isProcessingAll}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              Importar {successfulCount} Boleto{successfulCount !== 1 ? 's' : ''} Extraído{successfulCount !== 1 ? 's' : ''}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
