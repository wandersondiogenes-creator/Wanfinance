import * as pdfjsLib from 'pdfjs-dist';
import { SmartDocCategory, SmartExtractedDocument } from './smartDocTypes';
import { classifySmartDocument } from './smartClassifier';
import { validateExtractedDocument } from './smartValidator';
import { matchSmartLayout } from './smartLayoutMemory';
import { parseAutomotiveDocument } from './parsers/automotiveParser';
import { parseStandardBoletoDocument } from './parsers/standardBoletoParser';
import { parseDetranIpvaDocument } from './parsers/detranIpvaParser';
import { parseTaxDarfDasDocument } from './parsers/taxDarfDasParser';
import { parseGruUniaoDocument } from './parsers/gruParser';
import { parseGnreDocument } from './parsers/gnreParser';
import { parseUtilityDocument } from './parsers/utilityParser';
import { BoletoItem } from '../../types';

// Configure pdfjs worker if not already set
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

/**
 * Extrai texto bruto e linhas de todas as páginas do PDF no navegador
 */
export async function extractRawTextFromPdf(file: File): Promise<{ fullText: string; pageTexts: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= Math.min(numPages, 10); pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];
    
    // Agrupa texto preservando espaçamento
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

    pageTexts.push(lines.join('\n'));
  }

  return {
    fullText: pageTexts.join('\n\n--- NOVA PÁGINA ---\n\n'),
    pageTexts,
  };
}

/**
 * Orquestrador do Novo Motor de Extração Inteligente
 */
export async function processSmartDocument(
  file: File,
  chosenCategory: SmartDocCategory,
  onProgress?: (progress: number, stepMessage: string) => void
): Promise<SmartExtractedDocument> {
  const startTime = performance.now();
  const id = `smart-doc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  try {
    onProgress?.(20, 'Carregando estrutura e extraindo texto vetorial...');
    const { fullText } = await extractRawTextFromPdf(file);

    onProgress?.(45, 'Identificando tipo de documento e layout...');
    let targetCategory = chosenCategory;
    let detectedBrand: string | undefined;

    if (chosenCategory === 'auto_detect') {
      const classification = classifySmartDocument(fullText, file.name);
      targetCategory = classification.category;
      detectedBrand = classification.detectedBrand;
    }

    // Consulta de aprendizado de layout
    const learnedLayout = matchSmartLayout(fullText, targetCategory);

    onProgress?.(70, `Aplicando extrator especializado: ${targetCategory}...`);
    let partialData: Partial<SmartExtractedDocument>;

    switch (targetCategory) {
      case 'montadora_fidc':
        partialData = parseAutomotiveDocument(fullText, file.name);
        break;
      case 'detran_ipva':
        partialData = parseDetranIpvaDocument(fullText, file.name);
        break;
      case 'darf_das_tributos':
        partialData = parseTaxDarfDasDocument(fullText, file.name);
        break;
      case 'gru_uniao':
        partialData = parseGruUniaoDocument(fullText, file.name);
        break;
      case 'gnre_icms':
        partialData = parseGnreDocument(fullText, file.name);
        break;
      case 'concessionarias':
        partialData = parseUtilityDocument(fullText, file.name);
        break;
      case 'boleto_bancario':
      default:
        partialData = parseStandardBoletoDocument(fullText, file.name);
        break;
    }

    onProgress?.(90, 'Auditando consistência e validando dados...');
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

    const elapsed = Math.round(performance.now() - startTime);
    onProgress?.(100, 'Extração e validação concluídas com sucesso!');

    const fullDoc: SmartExtractedDocument = {
      id,
      fileName: file.name,
      fileSize: file.size,
      docCategory: chosenCategory,
      detectedCategory: targetCategory,
      status: 'success',
      progress: 100,
      processingTimeMs: elapsed,
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
      seuNumero: partialData.seuNumero || `DOC-${file.name.replace(/\.pdf$/i, '')}`,
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
      rawTextPreview: fullText.substring(0, 500),
      validation,
      selected: true,
    };

    return fullDoc;
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - startTime);
    return {
      id,
      fileName: file.name,
      fileSize: file.size,
      docCategory: chosenCategory,
      detectedCategory: chosenCategory,
      status: 'error',
      progress: 100,
      processingTimeMs: elapsed,
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
    };
  }
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
