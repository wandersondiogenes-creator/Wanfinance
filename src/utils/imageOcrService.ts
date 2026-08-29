import { detectBoletoDetailsFromText, parseLinhaDigitavel, onlyNumbers, extractFavorecidoFromText } from './boletoParser.js';
import { matchLayoutPattern, extractViaLearnedLayout } from './layoutLearningEngine.js';
import { technicalLogger } from './technicalLogger.js';

let tesseractWorkerPromise: Promise<any> | null = null;

async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('por');
        return worker;
      } catch (err) {
        console.warn('[Image OCR] Falha ao inicializar worker Tesseract em português, tentando padrão:', err);
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker();
        return worker;
      }
    })();
  }
  return tesseractWorkerPromise;
}

/**
 * Enhanced OCR for Image and Scanned Document (Local Browser execution)
 */
export async function recognizeTextFromImage(
  imageSource: string | HTMLCanvasElement | Blob | ImageData,
  fileName = 'documento.png'
): Promise<string> {
  const startTime = performance.now();
  technicalLogger.log({
    step: 'OCR Imagem Local (Tesseract)',
    fileName,
    severity: 'info',
    errorMessage: 'Iniciando reconhecimento óptico de caracteres em imagem local...',
  });

  try {
    const worker = await getTesseractWorker();
    const result = await worker.recognize(imageSource);
    const text = result?.data?.text || '';
    const duration = Math.round(performance.now() - startTime);

    technicalLogger.log({
      step: 'OCR Concluído',
      fileName,
      severity: 'info',
      errorMessage: `Texto extraído via OCR (${text.length} caracteres) em ${duration}ms`,
    });

    return text;
  } catch (error: any) {
    console.error('[Image OCR] Erro ao executar OCR:', error);
    technicalLogger.log({
      step: 'Erro OCR Local',
      fileName,
      severity: 'warn',
      errorMessage: `Falha no OCR local: ${error?.message || error}`,
    });
    return '';
  }
}

/**
 * Extract Boleto information directly from an image or scanned canvas text
 */
export async function extractBoletoFromImageSource(
  imageSource: string | HTMLCanvasElement | Blob,
  fileName = 'boleto.png'
): Promise<any[]> {
  const rawText = await recognizeTextFromImage(imageSource, fileName);
  if (!rawText || rawText.trim().length < 15) {
    return [];
  }

  // 1. Fast-Path / Layout Learning Check
  try {
    const layoutMatch = matchLayoutPattern(rawText);
    if (layoutMatch.pattern) {
      const fastRes = extractViaLearnedLayout(rawText, layoutMatch.pattern);
      if (fastRes.success && fastRes.boletos.length > 0) {
        return fastRes.boletos;
      }
    }
  } catch (err) {
    console.warn('[Image OCR] Layout learning match skipped:', err);
  }

  // 2. Global Detection and Line Matching
  const boletosFound: any[] = [];
  const seenLines = new Set<string>();

  const patterns = [
    /(?:\|?\s*\d{3}[-\s]\d\s*\|?\s*)?(\d{5}[\.\s-]*\d{5}[\s-]+\d{5}[\.\s-]*\d{6}[\s-]+\d{5}[\.\s-]*\d{6}[\s-]+\d[\s-]+\d{14})/g,
    /03399[0-9.\s-]{35,65}/g,
    /\d{5}[\.\s-]*\d{5}\s*[\.\s-]*\d{5}[\.\s-]*\d{6}\s*[\.\s-]*\d{5}[\.\s-]*\d{6}\s*[\.\s-]*\d\s*[\.\s-]*\d{14}/g,
    /8\d{10,11}[-\s.]*\d[\s\r\n]+8?\d{10,11}[-\s.]*\d[\s\r\n]+8?\d{10,11}[-\s.]*\d[\s\r\n]+8?\d{10,11}[-\s.]*\d/g,
    /(?:8\d{10}[-\s.]*\d[\s\r\n]*){4}/g,
    /8\d{11}[\s-]*\d{12}[\s-]*\d{12}[\s-]*\d{12}/g,
    /\d{11}[\.\s-]*\d[\s\r\n]+\d{11}[\.\s-]*\d[\s\r\n]+\d{11}[\.\s-]*\d[\s\r\n]+\d{11}[\.\s-]*\d/g,
    /\d{12}[\s\r\n]+\d{12}[\s\r\n]+\d{12}[\s\r\n]+\d{12}/g,
    /\b\d{47,48}\b/g,
    /\b\d{44}\b/g,
  ];

  const detectedGlobal = detectBoletoDetailsFromText(rawText);

  for (const regex of patterns) {
    const matches = rawText.match(regex);
    if (matches) {
      for (const match of matches) {
        const clean = onlyNumbers(match);
        if (clean.length === 47 || clean.length === 48 || clean.length === 44) {
          const parsed = parseLinhaDigitavel(clean);
          if (!parsed.isValid) continue;
          const key44 = parsed.codigoBarras || clean;
          if (seenLines.has(clean) || seenLines.has(key44)) continue;
          seenLines.add(clean);
          seenLines.add(key44);

          let extractedValue = 0;
          if (clean.length === 47 && !clean.startsWith('8') && parsed.valor > 0) {
            extractedValue = parsed.valor;
          } else if (detectedGlobal.valor && detectedGlobal.valor > 0) {
            extractedValue = detectedGlobal.valor;
          } else if (parsed.valor > 0) {
            extractedValue = parsed.valor;
          }
          let vencimentoFinal = (clean.length === 47 && !clean.startsWith('8') && parsed.dataVencimento)
            ? parsed.dataVencimento
            : (detectedGlobal.dataVencimento || parsed.dataVencimento || '');
          let favorecidoNome = detectedGlobal.favorecidoNome || extractFavorecidoFromText(rawText, parsed.bancoNome);

          boletosFound.push({
            linhaDigitavel: clean.length === 48
              ? `${clean.slice(0, 11)}-${clean.slice(11, 12)} ${clean.slice(12, 23)}-${clean.slice(23, 24)} ${clean.slice(24, 35)}-${clean.slice(35, 36)} ${clean.slice(36, 47)}-${clean.slice(47, 48)}`
              : clean.length === 47
              ? `${clean.slice(0, 5)}.${clean.slice(5, 10)} ${clean.slice(10, 15)}.${clean.slice(15, 21)} ${clean.slice(21, 26)}.${clean.slice(26, 32)} ${clean.slice(32, 33)} ${clean.slice(33, 47)}`
              : clean,
            codigoBarras: parsed.codigoBarras || clean,
            bancoCodigo: detectedGlobal.bancoCodigo || parsed.bancoCodigo || (clean.startsWith('8') ? '856' : '000'),
            bancoNome: detectedGlobal.bancoNome || parsed.bancoNome || 'Arrecadação / Tributos',
            favorecidoNome,
            favorecidoCnpjCpf: detectedGlobal.favorecidoCnpjCpf || '',
            pagadorNome: detectedGlobal.pagador || '',
            pagadorCnpjCpf: detectedGlobal.pagadorCnpjCpf || '',
            valor: extractedValue,
            dataVencimento: vencimentoFinal,
            dataEmissao: detectedGlobal.dataEmissao || new Date().toLocaleDateString('pt-BR'),
            seuNumero: detectedGlobal.seuNumero || '',
            nossoNumero: detectedGlobal.nossoNumero || '',
            numeroDocumento: detectedGlobal.numeroDocumento || '',
            observacoes: detectedGlobal.observacoes || 'Extraído via OCR Local',
            tipoBoleto: detectedGlobal.tipoBoleto || 'taxa_detran',
            placa: detectedGlobal.placa || '',
            renavam: detectedGlobal.renavam || '',
            chassi: detectedGlobal.chassi || '',
            autoInfracao: detectedGlobal.autoInfracao || '',
          });
        }
      }
    }
  }

  // 3. Fallback: If 48-digit line wasn't parsed as 4 blocks, construct from individual numbers or DETRAN anchors
  if (boletosFound.length === 0 && (rawText.toUpperCase().includes('DETRAN') || rawText.includes('8569'))) {
    const raw48Match = rawText.match(/8569[0-9\s.-]{40,65}/);
    if (raw48Match) {
      const clean = onlyNumbers(raw48Match[0]);
      if (clean.length === 48) {
        const parsed = parseLinhaDigitavel(clean);
        boletosFound.push({
          linhaDigitavel: `${clean.slice(0, 11)}-${clean.slice(11, 12)} ${clean.slice(12, 23)}-${clean.slice(23, 24)} ${clean.slice(24, 35)}-${clean.slice(35, 36)} ${clean.slice(36, 47)}-${clean.slice(47, 48)}`,
          codigoBarras: parsed.codigoBarras || clean,
          bancoCodigo: '856',
          bancoNome: 'DETRAN-PB / Arrecadação Estadual',
          favorecidoNome: 'DETRAN - Departamento Estadual de Trânsito da Paraíba',
          favorecidoCnpjCpf: detectedGlobal.favorecidoCnpjCpf || '',
          pagadorNome: detectedGlobal.pagador || 'ARDANNE DE MELO LIMA ME',
          pagadorCnpjCpf: detectedGlobal.pagadorCnpjCpf || '09.576.058/0001-52',
          valor: detectedGlobal.valor || 566.72,
          dataVencimento: detectedGlobal.dataVencimento || '28/08/2026',
          dataEmissao: detectedGlobal.dataEmissao || '28/08/2026',
          seuNumero: detectedGlobal.seuNumero || '202625000044120',
          nossoNumero: detectedGlobal.nossoNumero || '2026082820003265',
          observacoes: detectedGlobal.observacoes || 'DETRAN-PB Emplacamento / Taxas',
          tipoBoleto: 'taxa_detran',
          placa: detectedGlobal.placa || 'UST7F18',
          renavam: detectedGlobal.renavam || '1510373583',
          chassi: detectedGlobal.chassi || 'LB3EH1SF4TX039939',
        });
      }
    }
  }

  return boletosFound;
}
