import { SmartDocCategory, SmartExtractedDocument } from './smartDocTypes';
import { classifySmartDocument } from './smartClassifier';
import { validateExtractedDocument } from './smartValidator';
import { matchSmartLayout, learnSmartDocLayout } from './smartLayoutMemory';
import { parseAutomotiveDocument } from './parsers/automotiveParser';
import { parseStandardBoletoDocument } from './parsers/standardBoletoParser';
import { parseDetranIpvaDocument } from './parsers/detranIpvaParser';
import { parseTaxDarfDasDocument } from './parsers/taxDarfDasParser';
import { parseGruUniaoDocument } from './parsers/gruParser';
import { parseGnreDocument } from './parsers/gnreParser';
import { parseUtilityDocument } from './parsers/utilityParser';
import { BoletoItem } from '../../types';
import { recognizeTextFromImage } from '../imageOcrService';

let pdfjsModule: any = null;

async function getPdfJs(): Promise<any> {
  if (pdfjsModule) return pdfjsModule;
  try {
    const lib = await import('pdfjs-dist');
    if (lib) {
      try {
        if (lib.GlobalWorkerOptions) {
          const version = (lib as any).version || '4.10.38';
          lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
        }
      } catch {}
      if ('verbosity' in lib) {
        (lib as any).verbosity = 0;
      }
      pdfjsModule = lib;
    }
  } catch (e) {
    console.warn('[SmartExtractionEngine] Aviso ao carregar pdfjs-dist:', e);
  }
  return pdfjsModule;
}

function rotateCanvas(srcCanvas: HTMLCanvasElement, angleDegrees: number): HTMLCanvasElement {
  const destCanvas = document.createElement('canvas');
  if (angleDegrees === 90 || angleDegrees === 270) {
    destCanvas.width = srcCanvas.height;
    destCanvas.height = srcCanvas.width;
  } else {
    destCanvas.width = srcCanvas.width;
    destCanvas.height = srcCanvas.height;
  }
  const ctx = destCanvas.getContext('2d');
  if (ctx) {
    ctx.translate(destCanvas.width / 2, destCanvas.height / 2);
    ctx.rotate((angleDegrees * Math.PI) / 180);
    ctx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);
  }
  return destCanvas;
}

function hasLikelyBoletoData(text: string): boolean {
  if (!text) return false;
  const t = text.toUpperCase();
  const digitsOnly = text.replace(/\D/g, '');
  const hasLineDigitavel = digitsOnly.length >= 44 ||
    /\b(8\d{10,11}[-\s.]*\d)/.test(text) ||
    /\b(\d{5}\.?\d{5})/.test(text) ||
    /\b(8[0-9\s.-]{40,65})\b/.test(text);
  const hasKeywords = t.includes('SEFAZ') || t.includes('IPVA') || t.includes('DETRAN') || t.includes('CTTU') ||
    t.includes('PAGADOR') || t.includes('BENEFICI') || t.includes('VENCIMENTO') || t.includes('VALOR') ||
    t.includes('RECEITA') || t.includes('AUTARQUIA') || t.includes('PLACA') || t.includes('INFRAC') ||
    t.includes('MULTA') || t.includes('PREFEITURA');
  return hasLineDigitavel || (hasKeywords && digitsOnly.length >= 20);
}

async function performOcrWithAutoRotation(canvas: HTMLCanvasElement, fileName: string): Promise<string> {
  // Teste 1: Rotação padrão 0°
  const text0 = await recognizeTextFromImage(canvas, fileName);
  if (hasLikelyBoletoData(text0)) {
    return text0;
  }

  // Teste 2: Rotação 180° (Documento escaneado de cabeça para baixo / invertido)
  try {
    const canvas180 = rotateCanvas(canvas, 180);
    const text180 = await recognizeTextFromImage(canvas180, `${fileName}_180deg`);
    if (hasLikelyBoletoData(text180) || text180.length > text0.length + 30) {
      return text180;
    }
  } catch (err) {
    console.warn('[SmartEngine] Falha ao rotacionar 180°:', err);
  }

  // Teste 3: Rotações laterais 90° e 270° (Documentos em paisagem)
  try {
    const canvas90 = rotateCanvas(canvas, 90);
    const text90 = await recognizeTextFromImage(canvas90, `${fileName}_90deg`);
    if (hasLikelyBoletoData(text90)) return text90;

    const canvas270 = rotateCanvas(canvas, 270);
    const text270 = await recognizeTextFromImage(canvas270, `${fileName}_270deg`);
    if (hasLikelyBoletoData(text270)) return text270;
  } catch {}

  return text0;
}

/**
 * Extração de texto de streams descompactados de PDF (FlateDecode Fallback)
 */
async function extractTextFromDecompressedStreams(bytes: Uint8Array, binaryStr: string): Promise<string[]> {
  const pageTexts: string[] = [];
  if (typeof DecompressionStream === 'undefined' || bytes.length === 0) return pageTexts;

  try {
    let pos = 0;
    let streamCount = 0;
    const streamMarker = 'stream';
    const endMarker = 'endstream';
    const chunks: string[] = [];

    while (pos < binaryStr.length && streamCount < 150) {
      const startIdx = binaryStr.indexOf(streamMarker, pos);
      if (startIdx === -1) break;

      const endIdx = binaryStr.indexOf(endMarker, startIdx + 6);
      if (endIdx === -1) break;

      let contentStart = startIdx + 6;
      if (binaryStr.charCodeAt(contentStart) === 13 && binaryStr.charCodeAt(contentStart + 1) === 10) {
        contentStart += 2;
      } else if (binaryStr.charCodeAt(contentStart) === 10 || binaryStr.charCodeAt(contentStart) === 13) {
        contentStart += 1;
      }

      let contentEnd = endIdx;
      if (contentEnd > contentStart && binaryStr.charCodeAt(contentEnd - 1) === 10) contentEnd--;
      if (contentEnd > contentStart && binaryStr.charCodeAt(contentEnd - 1) === 13) contentEnd--;

      if (contentEnd > contentStart) {
        const streamBuffer = bytes.subarray(contentStart, contentEnd);
        try {
          let rawDeflateData = streamBuffer;
          if (streamBuffer.length > 2 && streamBuffer[0] === 0x78) {
            rawDeflateData = streamBuffer.subarray(2);
          }

          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(rawDeflateData);
          writer.close();

          const reader = ds.readable.getReader();
          const outChunks: Uint8Array[] = [];
          let totalLen = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              outChunks.push(value);
              totalLen += value.length;
            }
          }

          if (totalLen > 0) {
            const merged = new Uint8Array(totalLen);
            let offset = 0;
            for (const chunk of outChunks) {
              merged.set(chunk, offset);
              offset += chunk.length;
            }
            const textDecoder = new TextDecoder('latin1');
            const decompressed = textDecoder.decode(merged);

            // Extrai texto de operadores TJ / Tj
            const extractedWords: string[] = [];
            const tjRegex = /\(([^)]+)\)\s*Tj/g;
            let m;
            while ((m = tjRegex.exec(decompressed)) !== null) {
              extractedWords.push(m[1]);
            }

            const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
            while ((m = tjArrayRegex.exec(decompressed)) !== null) {
              const innerRegex = /\(([^)]+)\)/g;
              let im;
              while ((im = innerRegex.exec(m[1])) !== null) {
                extractedWords.push(im[1]);
              }
            }

            if (extractedWords.length > 0) {
              chunks.push(extractedWords.join(' '));
            } else if (decompressed.length > 30) {
              chunks.push(decompressed.replace(/[^\x20-\x7E\xC0-\xFF]/g, ' '));
            }
          }
        } catch {
          // Stream não-deflate
        }
      }

      pos = endIdx + 9;
      streamCount++;
    }

    if (chunks.length > 0) {
      pageTexts.push(chunks.join('\n'));
    }
  } catch (err) {
    console.warn('[SmartExtractionEngine] Fallback de stream falhou:', err);
  }

  return pageTexts;
}

/**
 * Extrai texto bruto e páginas do PDF com múltiplos mecanismos de contingência
 */
export async function extractRawTextFromPdf(file: File): Promise<{ fullText: string; pageTexts: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const pageTexts: string[] = [];

  // Estratégia 1: PDF.js estrutural
  try {
    const pdfjsLib = await getPdfJs();
    if (pdfjsLib) {
      const loadingTask = pdfjsLib.getDocument({
        data: bytes,
        stopAtErrors: false,
        useSystemFonts: true,
      } as any);

      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages || 1;

      for (let pageNum = 1; pageNum <= Math.min(numPages, 30); pageNum++) {
        try {
          const page = await pdfDoc.getPage(pageNum);
          const pageRotate = page.rotate || 0;
          const textContent = await page.getTextContent();
          const items = (textContent.items || []) as any[];

          const lines: string[] = [];
          let currentLine = '';
          let lastY: number | null = null;

          for (const item of items) {
            const text = item.str || '';
            const transform = item.transform;
            const y = transform ? transform[5] : null;

            if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
              if (currentLine.trim()) lines.push(currentLine.trim());
              currentLine = text;
            } else {
              currentLine += (currentLine ? ' ' : '') + text;
            }
            lastY = y;
          }
          if (currentLine.trim()) lines.push(currentLine.trim());

          let pageCombined = lines.join('\n');

          // Se a página estiver rotacionada ou invertida, inclui linhas na ordem invertida para garantir regex
          if (pageRotate === 180 || items.some((it) => it.transform && (it.transform[0] < 0 || it.transform[3] < 0))) {
            const reversedLines = [...lines].reverse().join('\n');
            pageCombined = `${pageCombined}\n\n${reversedLines}`;
          }

          // Se a página extraída for escaneada (pouco texto vetorial ou sem dados reconhecíveis), renderiza em Canvas e roda OCR inteligente
          if (pageCombined.trim().length < 25 || !hasLikelyBoletoData(pageCombined)) {
            try {
              if (typeof document !== 'undefined') {
                const viewport = page.getViewport({ scale: 2.0, rotation: pageRotate });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const canvasCtx = canvas.getContext('2d');
                if (canvasCtx) {
                  await page.render({ canvasContext: canvasCtx, viewport }).promise;
                  const ocrText = await performOcrWithAutoRotation(canvas, `${file.name}_p${pageNum}`);
                  if (ocrText && ocrText.trim().length > 15) {
                    pageCombined = ocrText;
                  }
                }
              }
            } catch (canvasErr) {
              console.warn(`[SmartEngine] Falha no OCR de canvas para pág ${pageNum}:`, canvasErr);
            }
          }

          if (pageCombined.trim().length > 10) {
            pageTexts.push(pageCombined);
          }
        } catch (pageErr) {
          console.warn(`[SmartEngine] Erro ao ler página ${pageNum}:`, pageErr);
        }
      }
    }
  } catch (pdfErr) {
    console.warn('[SmartEngine] Falha no PDF.js, acionando extratores alternativos:', pdfErr);
  }

  // Estratégia 2: Se PDF.js retornou vazio, roda leitor de stream descomprimido
  if (pageTexts.length === 0 || pageTexts.every((t) => t.trim().length < 15)) {
    let binaryStr = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryStr += String.fromCharCode(bytes[i]);
    }
    const streamTexts = await extractTextFromDecompressedStreams(bytes, binaryStr);
    if (streamTexts.length > 0) {
      pageTexts.push(...streamTexts);
    }
  }

  // Estratégia 3: Leitura binária direta de sequências de texto legíveis
  if (pageTexts.length === 0 || pageTexts.every((t) => t.trim().length < 15)) {
    const textDecoder = new TextDecoder('latin1');
    const rawContent = textDecoder.decode(bytes);
    const readableBlocks = rawContent.match(/[A-Za-z0-9\s.,\/:;\-_=+%#*()$]{8,}/g);
    if (readableBlocks && readableBlocks.length > 0) {
      pageTexts.push(readableBlocks.join('\n'));
    }
  }

  const fullText = pageTexts.join('\n\n--- NOVA PÁGINA ---\n\n');
  return { fullText, pageTexts };
}

/**
 * Processa um bloco de texto ou página e extrai os dados do documento
 */
function extractDocDataFromText(
  text: string,
  fileName: string,
  chosenCategory: SmartDocCategory,
  pageIndex?: number,
  totalPages?: number
): SmartExtractedDocument {
  const startTime = performance.now();
  const id = `smart-doc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${pageIndex !== undefined ? `-p${pageIndex + 1}` : ''}`;

  let targetCategory = chosenCategory;
  let detectedBrand: string | undefined;

  if (chosenCategory === 'auto_detect') {
    const classification = classifySmartDocument(text, fileName);
    targetCategory = classification.category;
    detectedBrand = classification.detectedBrand;
  }

  const learnedLayout = matchSmartLayout(text, targetCategory);

  let partialData: Partial<SmartExtractedDocument>;

  switch (targetCategory) {
    case 'montadora_fidc':
      partialData = parseAutomotiveDocument(text, fileName);
      break;
    case 'detran_ipva':
      partialData = parseDetranIpvaDocument(text, fileName);
      break;
    case 'darf_das_tributos':
      partialData = parseTaxDarfDasDocument(text, fileName);
      break;
    case 'gru_uniao':
      partialData = parseGruUniaoDocument(text, fileName);
      break;
    case 'gnre_icms':
      partialData = parseGnreDocument(text, fileName);
      break;
    case 'concessionarias':
      partialData = parseUtilityDocument(text, fileName);
      break;
    case 'boleto_bancario':
    default:
      partialData = parseStandardBoletoDocument(text, fileName);
      break;
  }

  const validation = validateExtractedDocument({
    linhaDigitavel: partialData.linhaDigitavel,
    codigoBarras: partialData.codigoBarras,
    valor: partialData.valor,
    valorOriginal: partialData.valorOriginal,
    valorCobrado: partialData.valorCobrado,
    dataVencimento: partialData.dataVencimento,
    favorecidoNome: partialData.favorecidoNome,
    favorecidoCnpjCpf: partialData.favorecidoCnpjCpf,
    pagadorNome: partialData.pagadorNome,
    pagadorCnpjCpf: partialData.pagadorCnpjCpf,
    seuNumero: partialData.seuNumero,
    nossoNumero: partialData.nossoNumero,
    chassi: partialData.chassi,
    placa: partialData.placa,
    docCategory: targetCategory,
  });

  const pageSuffix = totalPages && totalPages > 1 ? ` (Pág ${pageIndex! + 1}/${totalPages})` : '';

  const fullDoc: SmartExtractedDocument = {
    id,
    fileName: `${fileName}${pageSuffix}`,
    fileSize: 0,
    docCategory: chosenCategory,
    detectedCategory: targetCategory,
    status: validation.overallStatus === 'error' && !partialData.linhaDigitavel && !partialData.valor ? 'error' : 'success',
    progress: 100,
    processingTimeMs: Math.round(performance.now() - startTime),
    linhaDigitavel: partialData.linhaDigitavel || '',
    codigoBarras: partialData.codigoBarras || partialData.linhaDigitavel?.replace(/\D/g, '') || '',
    favorecidoNome: partialData.favorecidoNome || 'Beneficiário / Cedente',
    favorecidoCnpjCpf: partialData.favorecidoCnpjCpf || '',
    pagadorNome: partialData.pagadorNome || '',
    pagadorCnpjCpf: partialData.pagadorCnpjCpf || '',
    valor: partialData.valor || 0,
    valorOriginal: partialData.valorOriginal || partialData.valor || 0,
    valorCobrado: partialData.valorCobrado || partialData.valor || 0,
    desconto: partialData.desconto || 0,
    jurosMulta: partialData.jurosMulta || 0,
    dataVencimento: partialData.dataVencimento || new Date().toISOString().split('T')[0],
    dataEmissao: partialData.dataEmissao || '',
    dataPagamento: partialData.dataVencimento || new Date().toISOString().split('T')[0],
    seuNumero: partialData.seuNumero || `DOC-${fileName.replace(/\.pdf$/i, '')}`,
    nossoNumero: partialData.nossoNumero || '',
    bancoCodigo: partialData.bancoCodigo || '001',
    bancoNome: partialData.bancoNome || 'Banco Emissor',
    tipoBoleto: partialData.tipoBoleto || 'titulo_bancario',
    montadoraMarca: partialData.montadoraMarca || detectedBrand,
    chassi: partialData.chassi,
    placa: partialData.placa,
    renavam: partialData.renavam,
    autoInfracao: partialData.autoInfracao,
    codigoReceita: partialData.codigoReceita,
    periodoApuracao: partialData.periodoApuracao,
    numeroReferencia: partialData.numeroReferencia,
    ugGestao: partialData.ugGestao,
    ufFavorecida: partialData.ufFavorecida,
    observacoes: partialData.observacoes || '',
    layoutName: learnedLayout ? learnedLayout.layoutName : partialData.layoutName,
    isLearnedLayout: !!learnedLayout,
    confidence: partialData.confidence || 0.95,
    rawTextPreview: text.substring(0, 500),
    validation,
    selected: validation.overallStatus !== 'error',
  };

  if (fullDoc.linhaDigitavel || (fullDoc.favorecidoNome && fullDoc.favorecidoNome !== 'Beneficiário / Cedente')) {
    try {
      const learned = learnSmartDocLayout(fullDoc, text);
      if (learned) {
        fullDoc.layoutName = learned.layoutName;
        fullDoc.isLearnedLayout = true;
      }
    } catch {}
  }

  return fullDoc;
}

/**
 * Processa um arquivo e extrai todos os documentos/boletos contidos (incluindo PDFs multi-páginas)
 */
export async function processSmartDocumentsFromFile(
  file: File,
  chosenCategory: SmartDocCategory,
  onProgress?: (progress: number, stepMessage: string) => void
): Promise<SmartExtractedDocument[]> {
  try {
    onProgress?.(20, 'Carregando estrutura e extraindo texto vetorial...');
    const { fullText, pageTexts } = await extractRawTextFromPdf(file);

    onProgress?.(50, 'Identificando boletos e guias no documento...');

    // Se o PDF tem múltiplas páginas e cada página contém um boleto/guia com linha digitável ou parcela diferente
    if (pageTexts.length > 1) {
      const docs: SmartExtractedDocument[] = [];
      const distinctLines = new Set<string>();

      for (let i = 0; i < pageTexts.length; i++) {
        const pageText = pageTexts[i];
        if (pageText.trim().length < 15) continue;

        const doc = extractDocDataFromText(pageText, file.name, chosenCategory, i, pageTexts.length);
        doc.fileSize = file.size;

        const key = doc.linhaDigitavel || `${doc.seuNumero}-${doc.valor}-${doc.dataVencimento}`;
        if (!distinctLines.has(key)) {
          distinctLines.add(key);
          docs.push(doc);
        }
      }

      if (docs.length > 0) {
        onProgress?.(100, `${docs.length} guia(s)/boleto(s) identificados na remessa!`);
        return docs;
      }
    }

    // Processamento de documento de página única ou texto consolidado
    onProgress?.(70, 'Aplicando extratores especializados...');
    const singleDoc = extractDocDataFromText(fullText, file.name, chosenCategory);
    singleDoc.fileSize = file.size;

    onProgress?.(100, 'Extração e validação concluídas com sucesso!');
    return [singleDoc];
  } catch (err: any) {
    console.error(`[SmartEngine] Erro ao processar ${file.name}:`, err);
    return [
      {
        id: `smart-doc-err-${Date.now()}`,
        fileName: file.name,
        fileSize: file.size,
        docCategory: chosenCategory,
        detectedCategory: chosenCategory,
        status: 'error',
        progress: 100,
        processingTimeMs: 0,
        errorMessage: err.message || 'Falha ao processar arquivo PDF',
        linhaDigitavel: '',
        codigoBarras: '',
        favorecidoNome: 'Não identificado',
        favorecidoCnpjCpf: '',
        pagadorNome: '',
        pagadorCnpjCpf: '',
        valor: 0,
        dataVencimento: new Date().toISOString().split('T')[0],
        seuNumero: `ERRO-${file.name}`,
        nossoNumero: '',
        bancoCodigo: '000',
        bancoNome: 'Não identificado',
        tipoBoleto: 'titulo_bancario',
        confidence: 0,
        validation: {
          overallStatus: 'error',
          score: 0,
          barcode: { status: 'error', message: 'Falha na extração' },
          valor: { status: 'error', message: 'Não extraído' },
          vencimento: { status: 'error', message: 'Não extraído' },
          beneficiario: { status: 'error', message: 'Não extraído' },
          beneficiarioCnpjCpf: { status: 'error', message: 'Não extraído' },
          pagador: { status: 'error', message: 'Não extraído' },
          pagadorCnpjCpf: { status: 'error', message: 'Não extraído' },
          numeroDocumento: { status: 'error', message: 'Não extraído' },
          requiresReview: true,
          reviewReasons: ['Erro fatal na extração do arquivo'],
        },
        selected: false,
      },
    ];
  }
}

/**
 * Compatibilidade legada para processar 1 documento
 */
export async function processSmartDocument(
  file: File,
  chosenCategory: SmartDocCategory,
  onProgress?: (progress: number, stepMessage: string) => void
): Promise<SmartExtractedDocument> {
  const docs = await processSmartDocumentsFromFile(file, chosenCategory, onProgress);
  return docs[0];
}

/**
 * Converte um SmartExtractedDocument para BoletoItem do sistema principal com total compatibilidade
 */
export function convertSmartDocToBoletoItem(doc: SmartExtractedDocument): BoletoItem {
  return {
    id: `bol-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    codigoBarras: doc.codigoBarras || doc.linhaDigitavel.replace(/\D/g, ''),
    linhaDigitavel: doc.linhaDigitavel,
    favorecidoNome: doc.favorecidoNome || 'Beneficiário',
    favorecidoCnpjCpf: doc.favorecidoCnpjCpf || '',
    beneficiario: doc.favorecidoNome || 'Beneficiário',
    beneficiarioCnpjCpf: doc.favorecidoCnpjCpf || '',
    pagador: doc.pagadorNome || '',
    pagadorCnpjCpf: doc.pagadorCnpjCpf || '',
    valor: doc.valor,
    dataVencimento: doc.dataVencimento,
    dataPagamento: doc.dataPagamento || doc.dataVencimento,
    seuNumero: doc.seuNumero || `DOC-${Date.now()}`,
    numeroDocumento: doc.seuNumero,
    nossoNumero: doc.nossoNumero,
    bancoCodigo: doc.bancoCodigo || '001',
    bancoNome: doc.bancoNome,
    tipoBoleto: (doc.tipoBoleto as any) || 'titulo_bancario',
    desconto: doc.desconto || 0,
    jurosMulta: doc.jurosMulta || 0,
    valorCobrado: doc.valorCobrado || doc.valor,
    chassi: doc.chassi,
    placa: doc.placa,
    renavam: doc.renavam,
    autoInfracao: doc.autoInfracao,
    isValid: doc.validation.overallStatus !== 'error',
    selected: true,
    createdAt: new Date().toISOString(),
  };
}
