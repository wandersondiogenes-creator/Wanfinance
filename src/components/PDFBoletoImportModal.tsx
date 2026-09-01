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
  Calendar,
  AlertTriangle,
  Plus,
  RefreshCw,
  Brain,
  Zap,
  Table,
  List,
  Layers,
  Check,
  User,
  Hash,
  Barcode,
  Info,
  Terminal,
  Copy,
} from 'lucide-react';
import { BoletoItem, CNABBatchHistory } from '../types';
import { parseLinhaDigitavel, formatCurrencyBRL, onlyNumbers, validateAndClampPaymentDate } from '../utils/boletoParser';
import { getBankInfo } from '../utils/banks';
import { detectBoletoDuplicate, getBoletoCleanKey, isGenericRef } from '../utils/duplicateDetector';
import { extractBoletosLocallyInBrowser, extractRawTextFromPDFInBrowser } from '../utils/pdfLocalExtractor';
import { technicalLogger } from '../utils/technicalLogger';

import {
  matchLayoutPattern,
  extractViaLearnedLayout,
  learnNewLayoutPattern,
  recordFastPathSuccess,
} from '../utils/layoutLearningEngine';
import { applyLearnedCorrectionsToBoleto } from '../utils/correctionsMemoryEngine';
import { consolidateAndDeduplicateBoletos } from '../utils/boletoExtractorEngine';

export interface DetailedErrorInfo {
  errorType: string;
  stepWhereOccurred: string;
  unidentifiedFields: string[];
  probableCause: string;
  partialExtracted: {
    banco: boolean;
    beneficiario: boolean;
    vencimento: boolean;
    valor: boolean;
    codigoBarras: boolean;
    linhaDigitavel: boolean;
  };
  recommendedAction: string;
}

export interface PDFExtractedItem {
  id: string;
  fileName: string;
  fileSize?: number;
  boletoIndex?: number;
  totalInFile?: number;
  status: 'pending' | 'loading' | 'success' | 'error' | 'partial';
  progress: number; // 0 to 100
  stepMessage: string;
  layoutRecognized?: boolean;
  layoutName?: string;
  isFastPath?: boolean;
  errorMessage?: string;
  detailedError?: DetailedErrorInfo;
  processingTimeMs?: number;
  data?: {
    linhaDigitavel: string;
    codigoBarras: string;
    favorecidoNome: string;
    favorecidoCnpjCpf: string;
    pagadorNome?: string;
    pagadorCnpjCpf?: string;
    valor: number;
    dataVencimento: string;
    dataEmissao?: string;
    dataPagamento?: string;
    seuNumero: string;
    nossoNumero: string;
    bancoCodigo: string;
    bancoNome: string;
    observacoes: string;
    desconto?: number;
    jurosMulta?: number;
    valorDocumento?: number;
    valorCobrado?: number;
    confidence: number;
    confianca?: number;
    alertas?: string[];
    camposDivergentes?: string[];
    beneficiario?: string;
    beneficiarioCnpjCpf?: string;
    pagador?: string;
    numeroDocumento?: string;
    agenciaConta?: string;
    juros?: number;
    multa?: number;
    tipoDocumento?: string;
    tipoBoleto?: string;
    placa?: string;
    renavam?: string;
    chassi?: string;
    autoInfracao?: string;
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
  const [overallProgress, setOverallProgress] = useState(0);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [learnedCountInSession, setLearnedCountInSession] = useState(0);
  const [reusedCountInSession, setReusedCountInSession] = useState(0);
  const [savedModelIds, setSavedModelIds] = useState<Set<string>>(new Set());
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [copiedLinhaId, setCopiedLinhaId] = useState<string | null>(null);

  const handleCopyLinha = (itemId: string, linha: string) => {
    if (!linha) return;
    navigator.clipboard?.writeText(linha);
    setCopiedLinhaId(itemId);
    setTimeout(() => setCopiedLinhaId((cur) => (cur === itemId ? null : cur)), 2000);
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileMapRef = useRef<Map<string, File>>(new Map());

  const handleSaveLayoutModel = (item: PDFExtractedItem) => {
    if (!item.data) return;
    try {
      const d = item.data;
      const cleanLinha = onlyNumbers(d.linhaDigitavel || d.codigoBarras || '');
      const textToLearn = `${d.favorecidoNome || ''} ${d.bancoNome || ''} ${cleanLinha} ${item.fileName || ''} ${d.seuNumero || ''} ${d.nossoNumero || ''}`;
      
      const learnRes = learnNewLayoutPattern(textToLearn, {
        linhaDigitavel: cleanLinha,
        bancoCodigo: d.bancoCodigo,
        favorecidoNome: d.favorecidoNome,
        valor: d.valor,
        dataVencimento: d.dataVencimento,
      });

      setSavedModelIds((prev) => new Set([...prev, item.id]));
      setLearnedCountInSession((c) => c + 1);

      updateItemState(item.id, {
        layoutRecognized: true,
        layoutName: learnRes.pattern?.layoutName || item.layoutName || 'Modelo Aprendido',
      });
    } catch (e) {
      console.warn('[Continuous Learning] Erro ao salvar modelo manualmente:', e);
    }
  };

  const handleApplyBatchPaymentDate = (date: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const clampedBatchDate = date ? validateAndClampPaymentDate(date, undefined, todayStr) : date;
    setBatchPaymentDate(clampedBatchDate);
    if (!clampedBatchDate) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.data) {
          const clamped = validateAndClampPaymentDate(clampedBatchDate, item.data.dataVencimento, todayStr);
          return { ...item, data: { ...item.data, dataPagamento: clamped } };
        }
        return item;
      })
    );
  };

  const updateItemState = (
    itemId: string,
    updates: Partial<PDFExtractedItem>
  ) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, ...updates } : it))
    );
  };

  const processFile = async (
    file: File,
    fileIndex: number,
    totalFiles: number
  ): Promise<PDFExtractedItem[]> => {
    const startTime = performance.now();
    const itemId = `pdf-item-${Date.now()}-${fileIndex}-${Math.random().toString(36).substring(2, 7)}`;

    // 0% — Arquivo recebido (Mostra nome do arquivo IMEDIATAMENTE)
    const initialItem: PDFExtractedItem = {
      id: itemId,
      fileName: file.name,
      fileSize: file.size,
      status: 'loading',
      progress: 0,
      stepMessage: '0% — Arquivo recebido',
    };

    setItems((prev) => [...prev, initialItem]);

    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    try {
      // 10% — Identificando e lendo documento
      updateItemState(itemId, {
        progress: 15,
        stepMessage: '15% — Lendo documento PDF',
      });
      await delay(15);

      // Convert file to Base64
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      // Extract full document text in browser for layout matching and fast-path
      let docText = '';
      try {
        docText = await extractRawTextFromPDFInBrowser(fileBase64, file.name);
      } catch {}

      // 30% — Consultando padrões e memória local
      updateItemState(itemId, {
        progress: 30,
        stepMessage: '30% — Analisando layout e campos',
      });
      await delay(15);

      // Check Layout Engine Memory First with extracted text or filename
      const memoryMatch = matchLayoutPattern(docText || file.name);
      let isFastPathUsed = false;
      let layoutRecognized = false;
      let layoutName = 'Layout Desconhecido';

      if (memoryMatch.pattern && memoryMatch.confidence >= 0.60) {
        layoutRecognized = true;
        layoutName = memoryMatch.pattern.layoutName;
        updateItemState(itemId, {
          progress: 45,
          stepMessage: `45% — 🧠 Layout reconhecido: ${layoutName}`,
          layoutRecognized: true,
          layoutName: layoutName,
        });
      }

      let rawBoletos: any[] = [];
      let serverSuccess = false;
      let serverErrorMsg = '';

      // 1. Try Fast-Path via learned layout first if memory matched
      if (layoutRecognized && memoryMatch.pattern && docText) {
        const fastRes = extractViaLearnedLayout(docText, memoryMatch.pattern);
        if (fastRes.success && fastRes.boletos.length > 0) {
          rawBoletos = fastRes.boletos;
          isFastPathUsed = true;
          setReusedCountInSession((c) => c + 1);
          recordFastPathSuccess(1200);
        }
      }

      // 2. Local-First High-Speed Extraction (Instant in-browser PDF parser ~20ms)
      if (rawBoletos.length === 0) {
        updateItemState(itemId, {
          progress: 55,
          stepMessage: '55% — Extraindo dados do boleto instantaneamente',
        });
        await delay(15);

        try {
          const localExtracted = await extractBoletosLocallyInBrowser(fileBase64, file.name);
          const validLocal = (localExtracted || []).filter((b) => {
            const rawDigits = onlyNumbers(b.linhaDigitavel || b.codigoBarras || '');
            const parsed = parseLinhaDigitavel(rawDigits);
            return parsed.isValid && (rawDigits.length === 48 || (parsed.bancoCodigo !== '000' && !parsed.bancoCodigo.startsWith('8')));
          });
          if (validLocal.length > 0) {
            rawBoletos = validLocal;
            technicalLogger.log({
              step: 'Extração Local do Navegador',
              fileName: file.name,
              fileSize: file.size,
              severity: 'info',
              errorMessage: `Sucesso Local-First: ${validLocal.length} boleto(s) extraído(s) em tempo recorde`,
            });
          }
        } catch (localErr: any) {
          console.warn('[PDF Import] Local extractor notice:', localErr);
        }
      }

      // 3. Fallback to Server API / Gemini OCR ONLY if local parser found 0 boletos (e.g. scanned image/photo)
      if (rawBoletos.length === 0) {
        updateItemState(itemId, {
          progress: 65,
          stepMessage: '65% — Documento digitalizado: Processando via OCR Inteligente',
        });

        const base64Len = fileBase64.length;
        const reqStartTime = performance.now();

        if (base64Len <= 70_000_000) {
          try {
            technicalLogger.log({
              step: 'Chamada API Servidor (/api/extract-boleto-pdf)',
              fileName: file.name,
              fileSize: file.size,
              endpoint: '/api/extract-boleto-pdf',
              severity: 'info',
            });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const response = await fetch('/api/extract-boleto-pdf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileBase64,
                mimeType: file.type || 'application/pdf',
                fileName: file.name,
                fileSize: file.size,
              }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const reqTimeMs = Math.round(performance.now() - reqStartTime);
            const contentType = response.headers.get('content-type') || '';

            if (response.ok && contentType.includes('application/json')) {
              const result = await response.json();
              if (result && result.success && Array.isArray(result.boletos) && result.boletos.length > 0) {
                rawBoletos = result.boletos;
                serverSuccess = true;
              } else if (result && result.geminiApiError) {
                serverErrorMsg = String(result.geminiApiError);
              }
            } else {
              serverErrorMsg = `Status HTTP ${response.status}`;
            }
          } catch (fetchErr: any) {
            serverErrorMsg = `Falha na requisição ao servidor: ${fetchErr?.message || fetchErr}`;
          }
        }
      }


      // 75% — Validando dados
      updateItemState(itemId, {
        progress: 75,
        stepMessage: '75% — Validando campos, vencimento e valores',
      });
      await delay(120);

      // Handle Case where 0 boletos found or extraction failed
      if (rawBoletos.length === 0) {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        const detailedError: DetailedErrorInfo = {
          errorType: 'Linha Digitável / Código de Barras Não Identificado',
          stepWhereOccurred: 'Localizando campos (Etapa 40%-60%)',
          unidentifiedFields: ['Linha Digitável', 'Código de Barras'],
          probableCause: serverErrorMsg
            ? `Detalhe do processamento: ${serverErrorMsg}`
            : 'PDF digitalizado como imagem sem camada de texto ou arquivo corrompido.',
          partialExtracted: {
            banco: false,
            beneficiario: false,
            vencimento: false,
            valor: false,
            codigoBarras: false,
            linhaDigitavel: false,
          },
          recommendedAction:
            'Cole a linha digitável (47 ou 48 dígitos) no campo de conversão manual abaixo para cadastrar este boleto mantendo o arquivo no lote.',
        };

        const errorItem: PDFExtractedItem = {
          id: itemId,
          fileName: file.name,
          fileSize: file.size,
          status: 'error',
          progress: 100,
          stepMessage: '100% — Erro na extração automática',
          errorMessage: `Não foi possível extrair a linha digitável do arquivo '${file.name}'.`,
          detailedError,
          processingTimeMs: duration,
        };

        updateItemState(itemId, errorItem);
        return [errorItem];
      }

      // Filter out table-row sub-items or invalid partial lines if a valid primary boleto exists
      const validLinhas = rawBoletos.filter((b) => {
        const d = onlyNumbers(b.linhaDigitavel || b.codigoBarras || '');
        if (d.length === 47 && d.startsWith('8')) return false; // Arrecadação deve ter 48 dígitos
        const parsed = parseLinhaDigitavel(d);
        return (d.length === 47 && !d.startsWith('8') && parsed.isValid) || (d.length === 48 && d.startsWith('8')) || d.length === 44;
      });

      if (validLinhas.length > 0) {
        rawBoletos = validLinhas;
      }

      // If a 48-digit concessionária/tributo line exists, purge any residual 47-digit substring false positives
      const has48 = rawBoletos.some((b) => onlyNumbers(b.linhaDigitavel || b.codigoBarras || '').length === 48);
      if (has48) {
        const full48Digits = rawBoletos
          .filter((b) => onlyNumbers(b.linhaDigitavel || b.codigoBarras || '').length === 48)
          .map((b) => onlyNumbers(b.linhaDigitavel || b.codigoBarras || ''));

        rawBoletos = rawBoletos.filter((b) => {
          const d = onlyNumbers(b.linhaDigitavel || b.codigoBarras || '');
          if (d.length === 48) return true;
          // Discard any 47-digit line that is a substring/subsequence of a 48-digit line
          return !full48Digits.some((f48) => f48.includes(d.substring(0, 30)) || f48.includes(d.slice(-30)));
        });
      }

      // Robust multi-tier deduplication and consolidation (unifies 44-digit barcode, nosso número, and multi-vias like Via Usuário + Via Banco)
      rawBoletos = consolidateAndDeduplicateBoletos(rawBoletos);

      // Process raw extracted boletos
      const processedItems: PDFExtractedItem[] = rawBoletos.map((extracted, idx) => {
        const rawDigits = extracted.linhaDigitavel || extracted.codigoBarras || '';
        const cleanLinha = onlyNumbers(rawDigits);
        const parsedCheck = parseLinhaDigitavel(cleanLinha);

        const finalBancoCodigo = extracted.bancoCodigo || parsedCheck.bancoCodigo || '000';
        const bankInfo = getBankInfo(finalBancoCodigo);
        
        // Value resolution:
        // 1. For 47-digit bank boletos with parsedCheck.valor > 0, barcode nominal value is authoritative
        // 2. For 48-digit concessionárias/tributos or when barcode has no value, use extracted.valor
        let finalValor = 0;
        if (cleanLinha.length === 47 && !cleanLinha.startsWith('8') && parsedCheck.valor > 0) {
          finalValor = parsedCheck.valor;
        } else if (typeof extracted.valor === 'number' && extracted.valor > 0) {
          finalValor = extracted.valor;
        } else if (typeof extracted.valor === 'string') {
          finalValor = parseExtractedValor(extracted.valor, 0);
        }
        if (finalValor <= 0 && parsedCheck.valor > 0) {
          finalValor = parsedCheck.valor;
        }

        const finalFavorecido =
          extracted.favorecidoNome ||
          extracted.beneficiario ||
          extracted.cedente ||
          'Favorecido Não Identificado';
        const finalCnpj = extracted.favorecidoCnpjCpf || extracted.CNPJ || '';
        const finalSeuNumero =
          extracted.numeroDocumento ||
          extracted.seuNumero ||
          `DOC-${Math.floor(Math.random() * 89999 + 10000)}`;
        const finalBancoNome =
          bankInfo.shortName || extracted.bancoNome || extracted.banco || 'Banco Não Identificado';

        // 90% — Armazenando aprendizado na memória
        try {
          const textToLearn = docText || `${finalFavorecido} ${finalBancoNome} ${cleanLinha} ${file.name} ${finalSeuNumero}`;
          const learnRes = learnNewLayoutPattern(
            textToLearn,
            {
              linhaDigitavel: cleanLinha,
              bancoCodigo: finalBancoCodigo,
              favorecidoNome: finalFavorecido,
              valor: finalValor,
              dataVencimento: extracted.dataVencimento || parsedCheck.dataVencimento,
            }
          );
          if (learnRes.isNew) {
            setLearnedCountInSession((c) => c + 1);
          }
        } catch (learnErr) {
          console.warn('[Continuous Learning] Notificação de aprendizado:', learnErr);
        }

        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        const isLinhaValid = cleanLinha.length === 47 || cleanLinha.length === 48;

        const partialExtracted = {
          banco: !!finalBancoCodigo && finalBancoCodigo !== '000',
          beneficiario: !!finalFavorecido && finalFavorecido !== 'Favorecido Não Identificado',
          vencimento: !!extracted.dataVencimento || !!parsedCheck.dataVencimento,
          valor: finalValor > 0,
          codigoBarras: !!extracted.codigoBarras || !!parsedCheck.codigoBarras,
          linhaDigitavel: isLinhaValid,
        };

        const unidentifiedFields: string[] = [];
        if (!partialExtracted.linhaDigitavel) unidentifiedFields.push('Linha Digitável Válida');
        if (!partialExtracted.valor) unidentifiedFields.push('Valor');
        if (!partialExtracted.vencimento) unidentifiedFields.push('Vencimento');

        const isPartial = !isLinhaValid || unidentifiedFields.length > 0;

        return {
          id: idx === 0 ? itemId : `${itemId}-${idx}`,
          fileName: file.name,
          fileSize: file.size,
          boletoIndex: idx + 1,
          totalInFile: rawBoletos.length,
          status: isPartial ? 'partial' : 'success',
          progress: 100,
          stepMessage: isPartial ? '100% — Concluído com pendências' : '100% — Extração concluída com sucesso',
          layoutRecognized: layoutRecognized,
          layoutName: layoutName,
          isFastPath: isFastPathUsed,
          processingTimeMs: duration,
          detailedError: isPartial
            ? {
                errorType: 'Campos Parcialmente Identificados',
                stepWhereOccurred: 'Validando dados (Etapa 75%)',
                unidentifiedFields,
                probableCause: 'Alguns campos não atingiram o nível de confiança exigido ou a linha digitável possui dígitos faltando.',
                partialExtracted,
                recommendedAction: 'Verifique e complete os campos destacados em amarelo/vermelho abaixo.',
              }
            : undefined,
          data: {
            linhaDigitavel: cleanLinha || extracted.linhaDigitavel || '',
            codigoBarras: extracted.codigoBarras || parsedCheck.codigoBarras || '',
            favorecidoNome: finalFavorecido,
            favorecidoCnpjCpf: finalCnpj,
            beneficiario: extracted.beneficiario || finalFavorecido,
            beneficiarioCnpjCpf: extracted.beneficiarioCnpjCpf || finalCnpj,
            pagador: extracted.pagador || extracted.pagadorNome || '',
            pagadorCnpjCpf: extracted.pagadorCnpjCpf || '',
            pagadorNome: extracted.pagador || extracted.pagadorNome || '',
            valor: finalValor,
            valorDocumento: typeof extracted.valorDocumento === 'number' && extracted.valorDocumento > 0 ? extracted.valorDocumento : finalValor,
            valorCobrado: typeof extracted.valorCobrado === 'number' && extracted.valorCobrado > 0 ? extracted.valorCobrado : finalValor,
            desconto: typeof extracted.desconto === 'number' ? extracted.desconto : 0,
            juros: typeof extracted.juros === 'number' && (typeof extracted.valorCobrado === 'number' && typeof extracted.valorDocumento === 'number' && extracted.valorCobrado > extracted.valorDocumento) ? extracted.juros : 0,
            multa: typeof extracted.multa === 'number' && (typeof extracted.valorCobrado === 'number' && typeof extracted.valorDocumento === 'number' && extracted.valorCobrado > extracted.valorDocumento) ? extracted.multa : 0,
            jurosMulta: (() => {
              const docV = typeof extracted.valorDocumento === 'number' && extracted.valorDocumento > 0 ? extracted.valorDocumento : finalValor;
              const cobV = typeof extracted.valorCobrado === 'number' && extracted.valorCobrado > 0 ? extracted.valorCobrado : finalValor;
              if (cobV > 0 && docV > 0 && cobV > docV) {
                return Number((cobV - docV + (typeof extracted.desconto === 'number' ? extracted.desconto : 0)).toFixed(2));
              }
              return 0;
            })(),
            dataVencimento:
              extracted.dataVencimento ||
              parsedCheck.dataVencimento ||
              new Date().toISOString().split('T')[0],
            dataEmissao: extracted.dataEmissao || extracted.dataDocumento || '',
            dataPagamento: validateAndClampPaymentDate(
              batchPaymentDate || extracted.dataVencimento || parsedCheck.dataVencimento || new Date().toISOString().split('T')[0],
              extracted.dataVencimento || parsedCheck.dataVencimento,
              new Date().toISOString().split('T')[0]
            ),
            seuNumero: finalSeuNumero,
            numeroDocumento: extracted.numeroDocumento || finalSeuNumero,
            nossoNumero: extracted.nossoNumero || '',
            agenciaConta: extracted.agenciaConta || '',
            bancoCodigo: finalBancoCodigo,
            bancoNome: finalBancoNome,
            tipoBoleto: extracted.tipoBoleto || 'titulo_bancario',
            tipoDocumento: extracted.tipoDocumento || 'boleto',
            placa: extracted.placa || '',
            renavam: extracted.renavam || '',
            autoInfracao: extracted.autoInfracao || '',
            observacoes:
              extracted.observacoes ||
              (rawBoletos.length > 1
                ? `Boleto ${idx + 1}/${rawBoletos.length} de ${file.name}`
                : `Extraído de ${file.name}`),
            confidence: typeof extracted.confianca === 'number' ? extracted.confianca / 100 : (extracted.confidence || 0.95),
            confianca: extracted.confianca || 95,
            alertas: (() => {
              const list = Array.isArray(extracted.alertas) ? [...extracted.alertas] : [];
              if (finalValor >= 250000 && !list.some((a) => a.includes('250'))) {
                list.push('⚡ ALERTA DE ALTA ALÇADA: Valor elevado (> R$ 250.000,00) - Exige autorização prévia');
              }
              return list;
            })(),
            camposDivergentes: extracted.camposDivergentes || [],
          },
        };
      });

      // Update the loading item with all extracted boletos from this file
      if (processedItems.length > 0) {
        setItems((prev) => {
          const itemIdx = prev.findIndex((it) => it.id === itemId);
          if (itemIdx === -1) {
            return [...prev, ...processedItems];
          }
          const next = [...prev];
          next.splice(itemIdx, 1, ...processedItems);
          return next;
        });
      }

      return processedItems;
    } catch (err: any) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      const errorItem: PDFExtractedItem = {
        id: itemId,
        fileName: file.name,
        fileSize: file.size,
        status: 'error',
        progress: 100,
        stepMessage: '100% — Erro na extração',
        errorMessage: err.message || 'Erro inesperado ao processar arquivo.',
        processingTimeMs: duration,
        detailedError: {
          errorType: 'Falha de Leitura no Arquivo',
          stepWhereOccurred: 'Identificando documento (Etapa 10%)',
          unidentifiedFields: ['Todos os campos'],
          probableCause: 'O arquivo PDF está corrompido, protegido por senha ou não suportado.',
          partialExtracted: {
            banco: false,
            beneficiario: false,
            vencimento: false,
            valor: false,
            codigoBarras: false,
            linhaDigitavel: false,
          },
          recommendedAction: 'Verifique a integridade do PDF ou envie novamente o arquivo.',
        },
      };

      updateItemState(itemId, errorItem);
      return [errorItem];
    }
  };

  const handleManualConvert = (itemId: string, fileName: string, rawInput: string) => {
    if (!rawInput.trim()) return;

    let finalLinha = onlyNumbers(rawInput);
    if (finalLinha.length !== 47 && finalLinha.length !== 48) {
      const match = rawInput.match(/\d{47,48}/);
      if (match) finalLinha = match[0];
    }

    const parsed = parseLinhaDigitavel(finalLinha);

    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          const currentData = it.data;
          return {
            ...it,
            status: 'success',
            progress: 100,
            stepMessage: '100% — Convertido e validado manualmente',
            errorMessage: undefined,
            detailedError: undefined,
            data: {
              linhaDigitavel: finalLinha,
              codigoBarras: parsed.codigoBarras || finalLinha,
              favorecidoNome: currentData?.favorecidoNome || 'Favorecido Preenchido Manualmente',
              favorecidoCnpjCpf: currentData?.favorecidoCnpjCpf || '',
              valor: parsed.valor || currentData?.valor || 0,
              dataVencimento:
                parsed.dataVencimento || currentData?.dataVencimento || new Date().toISOString().split('T')[0],
              dataPagamento:
                batchPaymentDate ||
                parsed.dataVencimento ||
                currentData?.dataVencimento ||
                new Date().toISOString().split('T')[0],
              seuNumero: currentData?.seuNumero || `MANUAL-${Math.floor(Math.random() * 8999 + 1000)}`,
              nossoNumero: currentData?.nossoNumero || '',
              bancoCodigo: parsed.bancoCodigo || currentData?.bancoCodigo || '000',
              bancoNome: parsed.bancoNome || currentData?.bancoNome || 'Banco Não Identificado',
              observacoes: `Convertido manualmente do arquivo ${fileName}`,
              confidence: 1.0,
            },
          };
        }
        return it;
      })
    );
  };

  const handleRetryFile = async (fileName: string, itemId: string) => {
    const file = fileMapRef.current.get(fileName);
    if (!file) {
      alert('Arquivo original não encontrado. Por favor, envie o arquivo novamente.');
      return;
    }

    setItems((prev) => prev.filter((it) => it.id !== itemId));
    await processFile(file, 0, 1);
  };

  const handleFilesAdded = async (filesList: FileList | File[]) => {
    const files = Array.from(filesList).filter(
      (f) => f.type.includes('pdf') || f.type.includes('image') || /\.(pdf|png|jpe?g|webp|bmp|tiff)$/i.test(f.name)
    );

    if (files.length === 0) return;

    files.forEach((f) => fileMapRef.current.set(f.name, f));
    setIsProcessingAll(true);
    setOverallProgress(5);

    const total = files.length;
    for (let i = 0; i < total; i++) {
      await processFile(files[i], i, total);
      setOverallProgress(Math.round(((i + 1) / total) * 100));
    }

    setIsProcessingAll(false);
    setOverallProgress(100);
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
    const todayStr = new Date().toISOString().split('T')[0];
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id && item.data) {
          let updatedValue = value;
          if (field === 'dataPagamento') {
            updatedValue = validateAndClampPaymentDate(value, item.data.dataVencimento, todayStr);
          }

          const updatedData = { ...item.data, [field]: updatedValue };

          if (field === 'dataVencimento') {
            updatedData.dataPagamento = validateAndClampPaymentDate(
              updatedData.dataPagamento,
              value,
              todayStr
            );
          }

          if (field === 'linhaDigitavel') {
            const parsed = parseLinhaDigitavel(value);
            if (parsed.isValid) {
              if (!updatedData.valor) updatedData.valor = parsed.valor;
              if (parsed.dataVencimento) {
                updatedData.dataVencimento = parsed.dataVencimento;
                updatedData.dataPagamento = validateAndClampPaymentDate(
                  updatedData.dataPagamento,
                  parsed.dataVencimento,
                  todayStr
                );
              }
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

  const handleImportSingleItem = (item: PDFExtractedItem) => {
    if (!item.data) return;
    const d = item.data;
    const cleanLinha = onlyNumbers(d.linhaDigitavel);
    const parsed = parseLinhaDigitavel(cleanLinha);

    const newBoleto: BoletoItem = {
      id: `bol-pdf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      linhaDigitavel: cleanLinha,
      codigoBarras: d.codigoBarras || parsed.codigoBarras,
      bancoCodigo: d.bancoCodigo || parsed.bancoCodigo,
      bancoNome: d.bancoNome || parsed.bancoNome,
      favorecidoNome: d.favorecidoNome || d.beneficiario || 'Favorecido Não Identificado',
      favorecidoCnpjCpf: d.favorecidoCnpjCpf || d.beneficiarioCnpjCpf,
      beneficiario: d.beneficiario || d.favorecidoNome,
      beneficiarioCnpjCpf: d.beneficiarioCnpjCpf || d.favorecidoCnpjCpf,
      pagador: d.pagador || d.pagadorNome || 'Pagador Não Identificado',
      pagadorCnpjCpf: d.pagadorCnpjCpf,
      valor: d.valor,
      valorDocumento: d.valorDocumento || d.valor,
      valorCobrado: d.valorCobrado || d.valor,
      dataVencimento: d.dataVencimento,
      dataPagamento: d.dataPagamento || d.dataVencimento,
      seuNumero: d.seuNumero || `DOC-${Math.floor(Math.random() * 89999 + 10000)}`,
      numeroDocumento: d.numeroDocumento || d.seuNumero,
      nossoNumero: d.nossoNumero,
      agenciaConta: d.agenciaConta,
      desconto: d.desconto || 0,
      juros: d.juros || 0,
      multa: d.multa || 0,
      jurosMulta: (() => {
        const docV = d.valorDocumento || d.valor;
        const cobV = d.valorCobrado || d.valor;
        if (cobV > 0 && docV > 0 && cobV > docV) {
          return Number((cobV - docV + (d.desconto || 0)).toFixed(2));
        }
        return d.jurosMulta || 0;
      })(),
      observacoes: d.observacoes,
      confianca: d.confianca || Math.round((d.confidence || 0.95) * 100),
      alertas: d.alertas || [],
      camposDivergentes: d.camposDivergentes || [],
      tipoDocumento: d.tipoDocumento || 'boleto',
      isValid: cleanLinha.length === 47 || cleanLinha.length === 48,
      selected: true,
      createdAt: new Date().toISOString(),
    };

    onImportBoletos([newBoleto]);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const handleConfirmImport = () => {
    const validItems = items.filter(
      (item) => (item.status === 'success' || item.status === 'partial') && item.data
    );
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
        favorecidoNome: d.favorecidoNome || d.beneficiario || 'Favorecido Não Identificado',
        favorecidoCnpjCpf: d.favorecidoCnpjCpf || d.beneficiarioCnpjCpf,
        beneficiario: d.beneficiario || d.favorecidoNome,
        beneficiarioCnpjCpf: d.beneficiarioCnpjCpf || d.favorecidoCnpjCpf,
        pagador: d.pagador || d.pagadorNome || 'Pagador Não Identificado',
        pagadorCnpjCpf: d.pagadorCnpjCpf,
        valor: d.valor,
        valorDocumento: d.valorDocumento || d.valor,
        valorCobrado: d.valorCobrado || d.valor,
        dataVencimento: d.dataVencimento,
        dataPagamento: d.dataPagamento || d.dataVencimento,
        seuNumero: d.seuNumero || `DOC-${Math.floor(Math.random() * 89999 + 10000)}`,
        numeroDocumento: d.numeroDocumento || d.seuNumero,
        nossoNumero: d.nossoNumero,
        agenciaConta: d.agenciaConta,
        desconto: d.desconto || 0,
        juros: d.juros || 0,
        multa: d.multa || 0,
        jurosMulta: (() => {
          const docV = d.valorDocumento || d.valor;
          const cobV = d.valorCobrado || d.valor;
          if (cobV > 0 && docV > 0 && cobV > docV) {
            return Number((cobV - docV + (d.desconto || 0)).toFixed(2));
          }
          return d.jurosMulta || 0;
        })(),
        observacoes: d.observacoes,
        confianca: d.confianca || Math.round((d.confidence || 0.95) * 100),
        alertas: d.alertas || [],
        camposDivergentes: d.camposDivergentes || [],
        tipoDocumento: d.tipoDocumento || 'boleto',
        isValid: cleanLinha.length === 47 || cleanLinha.length === 48,
        selected: true,
        createdAt: new Date().toISOString(),
      };
    });

    onImportBoletos(newBoletos);

    const importedIds = new Set(validItems.map((i) => i.id));
    setItems((prev) => prev.filter((item) => !importedIds.has(item.id)));
    onClose();
  };

  const successfulCount = items.filter((i) => i.status === 'success' || i.status === 'partial').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const totalFiles = items.length;

  const totalExtractedFields = useMemo(() => {
    return items.reduce((acc, item) => {
      if (item.data) {
        let count = 0;
        if (item.data.linhaDigitavel) count++;
        if (item.data.valor > 0) count++;
        if (item.data.dataVencimento) count++;
        if (item.data.favorecidoNome) count++;
        if (item.data.bancoCodigo) count++;
        if (item.data.seuNumero) count++;
        return acc + count;
      }
      return acc;
    }, 0);
  }, [items]);

  const totalProcessingTimeSec = useMemo(() => {
    const totalMs = items.reduce((acc, item) => acc + (item.processingTimeMs || 0), 0);
    return (totalMs / 1000).toFixed(1);
  }, [items]);

  const allExtractedData = useMemo(() => {
    return items
      .filter((item) => (item.status === 'success' || item.status === 'partial') && item.data)
      .map((item) => ({ ...item.data!, id: item.id }));
  }, [items]);

  const duplicateItemIds = useMemo(() => {
    const ids = new Set<string>();
    const seenKeys = new Set<string>();
    const seenRefs = new Set<string>();

    for (const item of items) {
      if (!item.data) continue;

      const dup = detectBoletoDuplicate(
        { ...item.data, id: item.id },
        [],
        existingBoletos,
        history
      );

      if (dup.isSystemDuplicate || dup.isHistoryDuplicate) {
        ids.add(item.id);
        continue;
      }

      const key = getBoletoCleanKey(item.data.linhaDigitavel, item.data.codigoBarras);
      const cnpj = onlyNumbers(item.data.favorecidoCnpjCpf || item.data.beneficiarioCnpjCpf || '');
      const rawRef = item.data.seuNumero?.trim().toUpperCase();
      const hasValidRef = !isGenericRef(rawRef) && cnpj.length >= 11;
      const ref = hasValidRef ? `${rawRef}_${cnpj}` : '';

      if (key) {
        if (seenKeys.has(key)) {
          ids.add(item.id);
          continue;
        }
        seenKeys.add(key);
      } else if (ref) {
        if (seenRefs.has(ref)) {
          ids.add(item.id);
          continue;
        }
        seenRefs.add(ref);
      }
    }

    return ids;
  }, [items, existingBoletos, history]);

  const duplicateCount = duplicateItemIds.size;

  const handleRemoveDuplicates = () => {
    setItems((prev) => prev.filter((item) => !duplicateItemIds.has(item.id)));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full my-4 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                Sistema Inteligente de Extração e Memória de Boletos
                <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-0.5 rounded-full tracking-wide">
                  Wanfinance IA
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Aprendizado contínuo de layouts, reconhecimento automático de padrões e extração acelerada.
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
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
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
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2 font-bold">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-extrabold text-slate-800">
              Arraste e solte seus boletos em PDF aqui ou clique para selecionar
            </p>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Suporta múltiplos PDFs, boletos de concessionárias, tributos (SEFAZ/DAR) e faturas de veículos
            </p>
          </div>

          {/* Overall Batch Progress Banner */}
          {isProcessingAll && (
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-4 shadow-md space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-300" />
                  <span>Processando Lote de Arquivos... ({overallProgress}%)</span>
                </span>
                <span className="bg-blue-800/80 px-2.5 py-1 rounded-lg border border-blue-700">
                  Progresso geral: {overallProgress}%
                </span>
              </div>
              <div className="w-full bg-blue-950/80 rounded-full h-2.5 overflow-hidden p-0.5 border border-blue-700/50">
                <div
                  className="bg-gradient-to-r from-blue-400 to-emerald-400 h-1.5 rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* List of Processed Files */}
          {items.length > 0 && (
            <div className="space-y-4">
              {/* Batch Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-100/80 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Fila de Processamento ({items.length})</span>
                  </span>

                  {/* View Mode Switch */}
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setViewMode('cards')}
                      className={`px-2 py-1 text-xs rounded-md font-bold flex items-center gap-1 transition-colors ${
                        viewMode === 'cards'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Visualização em Cartões Detalhados"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>Cartões</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`px-2 py-1 text-xs rounded-md font-bold flex items-center gap-1 transition-colors ${
                        viewMode === 'table'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Painel de Tabela Sintético"
                    >
                      <Table className="w-3.5 h-3.5" />
                      <span>Painel Tabela</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setItems([])}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    title="Limpar todos os itens da fila"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Limpar Fila</span>
                  </button>

                  {duplicateCount > 0 && (
                    <button
                      type="button"
                      onClick={handleRemoveDuplicates}
                      className="text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl border border-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      <span>Remover {duplicateCount} Repetidos</span>
                    </button>
                  )}

                  {successfulCount > 0 && (
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={isProcessingAll}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        Adicionar {successfulCount} Boleto{successfulCount !== 1 ? 's' : ''} Prontos
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Duplicate Summary Alert */}
              {duplicateCount > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-3 text-amber-900 text-xs shadow-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-extrabold text-amber-900">
                      Atenção: {duplicateCount} boleto(s) repetido(s) identificado(s) no lote!
                    </p>
                    <p className="text-amber-800 font-medium mt-0.5">
                      Linhas digitáveis duplicadas foram identificadas em relação a outros boletos do arquivo ou do sistema.
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

              {/* Batch Payment Date Selector */}
              {successfulCount > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
                  <div className="flex items-center space-x-2.5 text-slate-800">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-black block text-slate-900 text-xs">
                        Agendar Data de Pagamento para os Boletos
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Aplica a data de débito para todos os boletos extraídos de uma só vez
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <input
                      type="date"
                      value={batchPaymentDate}
                      min={new Date().toISOString().split('T')[0]}
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
                              return {
                                ...item,
                                data: { ...item.data, dataPagamento: item.data.dataVencimento },
                              };
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

              {/* View Mode 1: Synthetic Processing Table (Painel de Processamento) */}
              {viewMode === 'table' ? (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                  <div className="p-3 bg-slate-900 text-white text-xs font-black flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Table className="w-4 h-4 text-blue-400" />
                      <span>Painel Geral de Processamento dos Arquivos</span>
                    </span>
                    <span className="text-[11px] font-normal text-slate-300">
                      {successfulCount} Sucessos | {errorCount} Erros
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-600 font-black uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">Arquivo</th>
                          <th className="py-2.5 px-3">Banco / Emissor</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-center">Progresso</th>
                          <th className="py-2.5 px-3">Layout Memória</th>
                          <th className="py-2.5 px-3 text-right">Valor Extraído</th>
                          <th className="py-2.5 px-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                        {items.map((item, idx) => {
                          const bankCode = item.data?.bancoCodigo || '000';
                          const bankInfo = getBankInfo(bankCode);
                          const dupInfo = item.data
                            ? detectBoletoDuplicate(
                                { ...item.data, id: item.id },
                                allExtractedData,
                                existingBoletos,
                                history
                              )
                            : null;

                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${
                                dupInfo?.isDuplicate
                                  ? 'bg-orange-50/90 hover:bg-orange-100/90 border-l-4 border-l-orange-500 font-bold'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span className="truncate max-w-[180px]" title={item.fileName}>
                                  {item.fileName}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-semibold">
                                {item.data ? (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100/90 border border-slate-200/80">
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{ backgroundColor: bankInfo.color }}
                                    />
                                    <span className="font-mono text-[10px] font-bold text-slate-800">
                                      [{item.data.bancoCodigo}]
                                    </span>
                                    <span className="text-[11px] text-slate-600 truncate max-w-[100px]">{item.data.bancoNome}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">Identificando...</span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex flex-col items-start gap-1">
                                  {item.status === 'loading' && (
                                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 font-bold text-[10px]">
                                      <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-600" />
                                      <span>{item.stepMessage.split('—')[1] || 'Processando'}</span>
                                    </span>
                                  )}
                                  {item.status === 'success' && (
                                    <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold text-[10px]">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                      <span>Concluído</span>
                                    </span>
                                  )}
                                  {item.status === 'partial' && (
                                    <span className="inline-flex items-center gap-1 text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-bold text-[10px]">
                                      <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                      <span>Parcial</span>
                                    </span>
                                  )}
                                  {item.status === 'error' && (
                                    <span className="inline-flex items-center gap-1 text-red-800 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 font-bold text-[10px]">
                                      <AlertCircle className="w-2.5 h-2.5 text-red-600" />
                                      <span>Erro</span>
                                    </span>
                                  )}
                                  {dupInfo?.isDuplicate && (
                                    <span className="inline-flex items-center gap-1 text-white bg-orange-500 font-black px-2 py-0.5 rounded-full text-[9px] shadow-2xs" title={dupInfo.duplicateReason}>
                                      <AlertTriangle className="w-2.5 h-2.5 text-white" />
                                      <span>{dupInfo.duplicateSourceLabel || 'Duplicado'}</span>
                                    </span>
                                  )}
                                  {item.data?.valor && item.data.valor >= 250000 ? (
                                    <span className="inline-flex items-center gap-1 text-purple-950 bg-purple-100 border border-purple-300 font-extrabold px-2 py-0.5 rounded-full text-[9px] shadow-2xs">
                                      <AlertTriangle className="w-2.5 h-2.5 text-purple-700" />
                                      <span>&gt; 250k</span>
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex flex-col items-center">
                                  <span className="font-mono text-[10.5px] font-bold text-slate-800">
                                    {item.progress}%
                                  </span>
                                  <div className="w-16 bg-slate-200 rounded-full h-1 mt-1 overflow-hidden">
                                    <div
                                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                                      style={{ width: `${item.progress}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                {item.layoutRecognized ? (
                                  <span className="text-[9.5px] font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md flex items-center gap-1 w-fit">
                                    <Zap className="w-2.5 h-2.5 text-indigo-600 fill-indigo-100" />
                                    <span>Conhecido</span>
                                  </span>
                                ) : (
                                  <span className="text-[9.5px] font-extrabold text-blue-900 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md flex items-center gap-1 w-fit">
                                    <Brain className="w-2.5 h-2.5 text-blue-600" />
                                    <span>Aprendido</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-black text-slate-900 text-[12px]">
                                {item.data?.valor ? formatCurrencyBRL(item.data.valor) : '—'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 transition-colors"
                                  title="Remover este boleto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* View Mode 2: Detailed Cards (Modo Cartões com Progresso em Tempo Real) */
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const dupInfo = item.data
                      ? detectBoletoDuplicate(
                          { ...item.data, id: item.id },
                          allExtractedData,
                          existingBoletos,
                          history
                        )
                      : null;

                    const rawDigits = item.data ? onlyNumbers(item.data.linhaDigitavel || item.data.codigoBarras || '') : '';
                    const isCopied = copiedLinhaId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`bg-white/95 backdrop-blur-sm border rounded-2xl p-3 sm:p-3.5 transition-all shadow-xs hover:shadow-sm ${
                          dupInfo?.isDuplicate
                            ? 'border-orange-500 bg-orange-50/40 ring-1 ring-orange-400/40'
                            : item.status === 'error'
                            ? 'border-red-300 bg-red-50/20'
                            : item.status === 'partial'
                            ? 'border-amber-300 bg-amber-50/20'
                            : 'border-slate-200/90 hover:border-slate-300'
                        }`}
                      >
                        {/* Apple Dynamic Header Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                              <FileText className="w-4 h-4 text-slate-200" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                                  {item.data?.favorecidoNome || item.fileName}
                                </h4>
                                
                                {item.totalInFile && item.totalInFile > 1 ? (
                                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full shrink-0">
                                    Boleto {item.boletoIndex || 1} de {item.totalInFile}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                                    Doc {idx + 1}/{totalFiles}
                                  </span>
                                )}

                                {item.layoutRecognized && (
                                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                    <Zap className="w-2.5 h-2.5 fill-blue-600 text-blue-600" />
                                    <span>Fast-Path</span>
                                  </span>
                                )}

                                {dupInfo?.isDuplicate && (
                                  <span className="text-[10px] font-black text-orange-800 bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0" title={dupInfo.duplicateReason}>
                                    <AlertTriangle className="w-3 h-3 text-orange-600" />
                                    <span>{dupInfo.duplicateSourceLabel || 'Duplicado'}</span>
                                  </span>
                                )}

                                {item.data?.valor && item.data.valor >= 250000 ? (
                                  <span className="text-[10px] font-black text-purple-900 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                    <AlertTriangle className="w-3 h-3 text-purple-600" />
                                    <span>Alta Alçada</span>
                                  </span>
                                ) : null}
                              </div>

                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                                <span className="truncate max-w-[240px] text-slate-400 font-mono text-[10px]">
                                  {item.fileName}
                                </span>
                                <span>•</span>
                                <span className="font-semibold text-blue-600">
                                  {item.stepMessage}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Preço de Destaque & Ações Rápidas */}
                          <div className="flex items-center gap-2 shrink-0">
                            {item.data?.valor ? (
                              <div className="text-right mr-1">
                                <div className="text-xs sm:text-sm font-mono font-black text-slate-900 tracking-tight">
                                  {formatCurrencyBRL(item.data.valor)}
                                </div>
                                <div className="text-[10px] font-bold text-slate-500">
                                  Venc: {item.data.dataVencimento ? item.data.dataVencimento.split('-').reverse().join('/') : '--/--/----'}
                                </div>
                              </div>
                            ) : null}

                            {item.status === 'loading' && (
                              <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 font-bold">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                <span>{item.progress}%</span>
                              </div>
                            )}

                            {(item.status === 'success' || item.status === 'partial') && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSaveLayoutModel(item)}
                                  className={`text-[11px] font-bold px-2 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer border ${
                                    savedModelIds.has(item.id) || item.layoutRecognized
                                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                  title="Salvar modelo na memória contínua"
                                >
                                  <Brain className="w-3 h-3 text-indigo-600" />
                                  <span className="hidden sm:inline">{savedModelIds.has(item.id) || item.layoutRecognized ? 'Salvo' : 'Memorizar'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleImportSingleItem(item)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                                  title="Importar boleto"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Importar</span>
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Remover da fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Barra de Progresso Durante Carregamento */}
                        {item.status === 'loading' && (
                          <div className="py-1.5">
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/80">
                              <div
                                className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Alerta de Duplicidade */}
                        {dupInfo?.isDuplicate && (
                          <div className="my-2 bg-orange-50 border border-orange-200 text-orange-950 p-2.5 rounded-xl flex items-start gap-2 text-xs font-semibold">
                            <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-orange-900 block">Boleto possivelmente duplicado</span>
                              <span className="text-[11px] text-orange-800">{dupInfo.duplicateReason}</span>
                            </div>
                          </div>
                        )}

                        {/* Tratamento Detalhado de Erros */}
                        {(item.status === 'error' || item.status === 'partial') && item.detailedError && (
                          <div className="bg-red-50/90 border border-red-200 rounded-xl p-2.5 my-2 text-xs text-red-900 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-red-950 flex items-center gap-1 text-xs">
                                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                <span>{item.detailedError.errorType}</span>
                              </span>
                              <span className="text-[10px] font-semibold bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                                {item.detailedError.stepWhereOccurred}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-700">
                              {item.detailedError.probableCause}
                            </p>
                            <div className="flex items-center gap-1.5 pt-1">
                              <input
                                type="text"
                                placeholder="Cole a linha digitável (47 ou 48 dígitos)..."
                                className="flex-1 bg-white border border-slate-300 text-slate-900 font-mono text-xs px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-blue-600 font-bold"
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
                                  const inputEl = e.currentTarget.previousElementSibling as HTMLInputElement;
                                  const val = inputEl ? inputEl.value : '';
                                  if (val) handleManualConvert(item.id, item.fileName, val);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
                              >
                                Converter
                              </button>
                              {fileMapRef.current.has(item.fileName) && (
                                <button
                                  type="button"
                                  onClick={() => handleRetryFile(item.fileName, item.id)}
                                  className="bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs px-2.5 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Reanalisar</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Bento Grid Compacto com Campos Extraídos (Apple Pro Style) */}
                        {item.data && (
                          <div className="space-y-2 pt-2">
                            {/* Linha Digitável em Pílula de Acesso Rápido */}
                            <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-1.5 sm:px-2.5 sm:py-1.5 flex items-center gap-2">
                              <div className="flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0">
                                <Barcode className="w-3.5 h-3.5 text-slate-600" />
                                <span className="hidden sm:inline">Linha:</span>
                              </div>
                              
                              <input
                                type="text"
                                value={item.data.linhaDigitavel}
                                onChange={(e) => handleFieldChange(item.id, 'linhaDigitavel', e.target.value)}
                                className="flex-1 bg-transparent border-0 text-slate-900 font-mono text-xs font-bold focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5"
                                placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                              />

                              <button
                                type="button"
                                onClick={() => handleCopyLinha(item.id, rawDigits || item.data?.linhaDigitavel || '')}
                                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                                  isCopied
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs'
                                }`}
                                title="Copiar linha digitável completa"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-[10px]">Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-500" />
                                    <span className="text-[10px] hidden sm:inline">Copiar</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Bento Grid 3 Colunas: Financeiro | Partes | Identificação */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              {/* Célula 1: Financeiro & Agendamento */}
                              <div className="bg-slate-50/60 border border-slate-200/70 rounded-xl p-2 sm:p-2.5 space-y-1.5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                                  Valores & Datas
                                </span>
                                
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-600 block">Valor (R$)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.data.valor}
                                      onChange={(e) => handleFieldChange(item.id, 'valor', parseFloat(e.target.value) || 0)}
                                      className="w-full bg-white border border-slate-200 text-slate-900 font-mono text-xs font-black px-2 py-1 rounded-lg focus:border-blue-600 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-600 block">Vencimento</label>
                                    <input
                                      type="date"
                                      value={item.data.dataVencimento}
                                      onChange={(e) => handleFieldChange(item.id, 'dataVencimento', e.target.value)}
                                      className="w-full bg-white border border-slate-200 text-slate-900 text-xs font-semibold px-1.5 py-1 rounded-lg focus:border-blue-600 focus:outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="text-[9px] font-bold text-blue-700 block">Agendamento</label>
                                    <input
                                      type="date"
                                      value={item.data.dataPagamento || item.data.dataVencimento}
                                      min={new Date().toISOString().split('T')[0]}
                                      onChange={(e) => handleFieldChange(item.id, 'dataPagamento', e.target.value)}
                                      className="w-full bg-white border border-blue-200 text-blue-900 text-xs font-bold px-1.5 py-1 rounded-lg focus:border-blue-600 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-600 block">Desconto (R$)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.data.desconto || 0}
                                      onChange={(e) => handleFieldChange(item.id, 'desconto', parseFloat(e.target.value) || 0)}
                                      className="w-full bg-white border border-slate-200 text-slate-900 font-mono text-xs px-2 py-1 rounded-lg focus:border-blue-600 focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Célula 2: Beneficiário e Pagador */}
                              <div className="bg-slate-50/60 border border-slate-200/70 rounded-xl p-2 sm:p-2.5 space-y-1.5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                                  Beneficiário & Pagador
                                </span>

                                <div>
                                  <label className="text-[9px] font-bold text-slate-600 block">Beneficiário / Favorecido</label>
                                  <input
                                    type="text"
                                    value={item.data.favorecidoNome}
                                    onChange={(e) => handleFieldChange(item.id, 'favorecidoNome', e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 text-xs font-bold px-2 py-1 rounded-lg focus:border-blue-600 focus:outline-none truncate"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-600 block">CNPJ/CPF Beneficiário</label>
                                    <input
                                      type="text"
                                      value={item.data.favorecidoCnpjCpf || ''}
                                      placeholder="Opcional"
                                      onChange={(e) => handleFieldChange(item.id, 'favorecidoCnpjCpf', e.target.value)}
                                      className="w-full bg-white border border-slate-200 text-slate-900 text-xs px-2 py-1 rounded-lg focus:border-blue-600 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-600 block">Pagador (Sacado)</label>
                                    <input
                                      type="text"
                                      value={item.data.pagadorNome || ''}
                                      placeholder="Empresa Pagadora"
                                      onChange={(e) => handleFieldChange(item.id, 'pagadorNome', e.target.value)}
                                      className="w-full bg-white border border-slate-200 text-slate-900 text-xs px-2 py-1 rounded-lg focus:border-blue-600 focus:outline-none truncate"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Célula 3: Controle Bancário e Documento */}
                              <div className="bg-slate-50/60 border border-slate-200/70 rounded-xl p-2 sm:p-2.5 space-y-1.5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                                  Controle Bancário & Documento
                                </span>

                                <div className="flex items-center gap-1.5">
                                  <span className="bg-slate-200 text-slate-900 font-mono text-[10px] px-1.5 py-1 rounded-lg font-black shrink-0">
                                    {item.data.bancoCodigo}
                                  </span>
                                  <input
                                    type="text"
                                    value={item.data.bancoNome}
                                    onChange={(e) => handleFieldChange(item.id, 'bancoNome', e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 text-xs font-semibold px-2 py-1 rounded-lg focus:border-blue-600 focus:outline-none truncate"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-600 block">Nº Doc (Seu Nº)</label>
                                    <input
                                      type="text"
                                      value={item.data.seuNumero}
                                      onChange={(e) => handleFieldChange(item.id, 'seuNumero', e.target.value)}
                                      className="w-full bg-white border border-slate-200 text-slate-900 text-xs px-2 py-1 rounded-lg focus:border-blue-600 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-slate-600 block">Nosso Número</label>
                                    <input
                                      type="text"
                                      value={item.data.nossoNumero || ''}
                                      placeholder="Opcional"
                                      onChange={(e) => handleFieldChange(item.id, 'nossoNumero', e.target.value)}
                                      className="w-full bg-white border border-slate-200 text-slate-900 text-xs px-2 py-1 rounded-lg focus:border-blue-600 focus:outline-none"
                                    />
                                  </div>
                                </div>

                                {/* Se existirem campos de veículos / tributo (Placa, Renavam) */}
                                {(item.data.placa || item.data.renavam || item.data.autoInfracao) && (
                                  <div className="flex items-center gap-1.5 pt-0.5">
                                    {item.data.placa && (
                                      <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        Placa: {item.data.placa}
                                      </span>
                                    )}
                                    {item.data.renavam && (
                                      <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        Renavam: {item.data.renavam}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* RESUMO FINAL DE EXTRAÇÃO & APRENDIZADO DA SESSÃO */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-lg space-y-3 mt-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-blue-400">
                    <Brain className="w-4 h-4 text-blue-400" />
                    <span>Resumo Final de Processamento & Aprendizado</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Tempo total: {totalProcessingTimeSec}s
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 text-center text-xs">
                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2">
                    <span className="text-[10px] text-slate-400 font-semibold block">Total Arquivos</span>
                    <span className="text-sm font-black text-white">{totalFiles}</span>
                  </div>
                  <div className="bg-emerald-950/60 border border-emerald-800 rounded-xl p-2">
                    <span className="text-[10px] text-emerald-300 font-semibold block">Sucesso</span>
                    <span className="text-sm font-black text-emerald-400">{successfulCount}</span>
                  </div>
                  <div className="bg-red-950/60 border border-red-800 rounded-xl p-2">
                    <span className="text-[10px] text-red-300 font-semibold block">Com Erro</span>
                    <span className="text-sm font-black text-red-400">{errorCount}</span>
                  </div>
                  <div className="bg-indigo-950/60 border border-indigo-800 rounded-xl p-2">
                    <span className="text-[10px] text-indigo-300 font-semibold block">Layouts Conhecidos</span>
                    <span className="text-sm font-black text-indigo-300">{reusedCountInSession}</span>
                  </div>
                  <div className="bg-blue-950/60 border border-blue-800 rounded-xl p-2">
                    <span className="text-[10px] text-blue-300 font-semibold block">Novos Aprendidos</span>
                    <span className="text-sm font-black text-blue-300">{learnedCountInSession}</span>
                  </div>
                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2">
                    <span className="text-[10px] text-slate-400 font-semibold block">Campos Extraídos</span>
                    <span className="text-sm font-black text-amber-300">{totalExtractedFields}</span>
                  </div>
                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-2">
                    <span className="text-[10px] text-slate-400 font-semibold block">Inconsistências</span>
                    <span className="text-sm font-black text-red-300">{errorCount}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => setShowLogsModal(true)}
              className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-200/80 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-600" />
              <span>Logs Técnicos</span>
            </button>
          </div>

          <button
            onClick={handleConfirmImport}
            disabled={successfulCount === 0 || isProcessingAll}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              Importar {successfulCount} Boleto{successfulCount !== 1 ? 's' : ''} Pronto{successfulCount !== 1 ? 's' : ''}
            </span>
          </button>
        </div>

        {/* TECHNICAL LOGS DIAGNOSTIC MODAL */}
        {showLogsModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2 text-blue-400">
                  <Terminal className="w-5 h-5" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Logs Técnicos & Diagnóstico
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLogsModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs font-mono">
                {technicalLogger.getLogs().length === 0 ? (
                  <p className="text-slate-500 italic p-4 text-center">Nenhum log técnico registrado na sessão atual.</p>
                ) : (
                  technicalLogger.getLogs().map((l) => (
                    <div
                      key={l.id}
                      className={`p-3 rounded-xl border ${
                        l.severity === 'error'
                          ? 'bg-red-950/60 border-red-900/80 text-red-200'
                          : l.severity === 'warn'
                          ? 'bg-amber-950/60 border-amber-900/80 text-amber-200'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold border-b border-white/10 pb-1 mb-1.5 text-[11px]">
                        <span className="text-blue-300">[{l.step}]</span>
                        <span className="text-slate-400">{l.timestamp.split('T')[1].split('.')[0]}</span>
                      </div>
                      {l.fileName && <div>📄 Arquivo: <span className="font-semibold">{l.fileName}</span></div>}
                      {l.endpoint && <div>🔗 Endpoint: <span className="text-indigo-300">{l.endpoint}</span></div>}
                      {l.httpStatus && <div>⚡ Status HTTP: <span className="font-bold text-amber-400">{l.httpStatus}</span></div>}
                      {l.processingTimeMs && <div>⏱️ Tempo: <span>{l.processingTimeMs}ms</span></div>}
                      {l.errorMessage && <div className="font-semibold text-white mt-1">Detalhes: {l.errorMessage}</div>}
                      {l.backendResponse && (
                        <div className="mt-1 text-[10px] bg-black/40 p-1.5 rounded overflow-x-auto text-slate-400">
                          Resposta Backend: {l.backendResponse}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const text = technicalLogger.exportLogsAsString();
                    navigator.clipboard.writeText(text);
                    setCopiedLogs(true);
                    setTimeout(() => setCopiedLogs(false), 2000);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs px-4 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer"
                >
                  {copiedLogs ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLogs ? 'Copiado para Área de Transferência!' : 'Copiar Logs JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLogsModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2 rounded-xl"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

