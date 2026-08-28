import { parseLinhaDigitavel, onlyNumbers, extractFavorecidoFromText, detectBoletoDetailsFromText } from './boletoParser.js';
import { technicalLogger } from './technicalLogger.js';
import { extractBoletoFromImageSource } from './imageOcrService.js';

/**
 * Client-Side Browser Fallback for PDF & Image Boleto Data Extraction.
 * Uses pdfjs-dist page-by-page text parsing, OCR for image/scanned files, and intelligent regex matching.
 */
export async function extractBoletosLocallyInBrowser(fileBase64: string, fileName: string): Promise<any[]> {
  const startTime = performance.now();
  const isImageFile = /\.(png|jpe?g|webp|bmp|tiff)$/i.test(fileName) || fileBase64.startsWith('data:image/');

  technicalLogger.log({
    step: 'Extração Local PDF / Imagem (Browser)',
    fileName,
    severity: 'info',
    errorMessage: `Iniciando varredura local no navegador (${isImageFile ? 'Modo Imagem/OCR' : 'Modo Vetorial/PDF'})...`,
  });

  // Direct OCR path for image uploads
  if (isImageFile) {
    try {
      const imageBoletos = await extractBoletoFromImageSource(fileBase64, fileName);
      if (imageBoletos && imageBoletos.length > 0) {
        return imageBoletos;
      }
    } catch (imgErr) {
      console.warn('[Local Browser Extractor] Erro no OCR de imagem:', imgErr);
    }
  }

  const boletosFound: any[] = [];
  const seenLines = new Set<string>();

  try {
    let cleanBase64 = fileBase64;
    const dataUriMatch = fileBase64.match(/^data:([^;]+);base64,(.*)$/s);
    if (dataUriMatch) {
      cleanBase64 = dataUriMatch[2];
    } else {
      cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    }

    // Strip whitespace, linebreaks, and handle padding for atob safely
    cleanBase64 = cleanBase64.replace(/[\r\n\s]+/g, '');
    const padLength = cleanBase64.length % 4;
    if (padLength > 0) {
      cleanBase64 += '='.repeat(4 - padLength);
    }

    let binaryStr = '';
    try {
      binaryStr = atob(cleanBase64);
    } catch {
      // Fallback binary decode if atob fails
      binaryStr = '';
    }

    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const pageTexts: string[] = [];
    let pdfDocRef: any = null;

    // 1. Structural PDF page-by-page extraction using pdfjs-dist
    if (bytes.length > 0) {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        if (pdfjsLib) {
          try {
            if (pdfjsLib.GlobalWorkerOptions) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version || '4.10.38'}/pdf.worker.min.mjs`;
            }
          } catch {}
          if ('verbosity' in pdfjsLib) {
            (pdfjsLib as any).verbosity = 0; // Silent verbosity mode
          }
        }
        const loadingTask = pdfjsLib.getDocument({
          data: bytes,
          stopAtErrors: false,
        } as any);
        const pdfDoc = await loadingTask.promise;
        pdfDocRef = pdfDoc;

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items.map((item: any) => (item as any)?.str || '');
          const pageCombined = pageStrings.join(' ');
          pageTexts.push(pageCombined);
        }
      } catch (pdfJsErr: any) {
        const msg = String(pdfJsErr?.message || pdfJsErr);
        technicalLogger.log({
          step: 'Aviso pdfjs-dist',
          fileName,
          severity: 'warn',
          errorMessage: msg,
        });
      }
    }

    // If PDF has no text layer (scanned PDF), render first page to canvas and run OCR
    if (pageTexts.join('').trim().length < 25 && pdfDocRef) {
      try {
        const firstPage = await pdfDocRef.getPage(1);
        const viewport = firstPage.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await firstPage.render({ canvasContext: ctx, viewport }).promise;
          const ocrBoletos = await extractBoletoFromImageSource(canvas, fileName);
          if (ocrBoletos && ocrBoletos.length > 0) {
            return ocrBoletos;
          }
        }
      } catch (scanErr) {
        console.warn('[Browser Scanned PDF OCR] Falha ao renderizar página para OCR:', scanErr);
      }
    }

    // If pdfjs failed to get text, try decompressed streams safely without regex
    if (pageTexts.length === 0 && typeof DecompressionStream !== 'undefined') {
      try {
        let pos = 0;
        let streamCount = 0;
        const streamMarker = "stream";
        const endMarker = "endstream";

        while (pos < binaryStr.length && streamCount < 100) {
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
              await writer.write(rawDeflateData);
              await writer.close();

              const response = new Response(ds.readable);
              const decompressedArray = await response.arrayBuffer();
              const text = new TextDecoder('utf-8').decode(decompressedArray);
              if (text && text.length > 10) pageTexts.push(text);
            } catch {
              // Ignore corrupted or non-standard flate stream chunks
            }
          }

          pos = endIdx + 8;
          streamCount++;
        }
      } catch (err) {
        console.warn('[Browser PDF Extractor] Decompression error:', err);
      }
    }

    const fullDocText = pageTexts.join(' \n ');

    // 2. Scan each page text for 47 and 48 digit linha digitável patterns
    const patterns = [
      // 1. Bank slips with bank code badge prefix e.g. |237-2| 23792... (banks 001-799)
      /(?:\|?\s*[0-7]\d{2}[-\s]\d\s*\|?\s*)?([0-7]\d{4}[\.\s-]*\d{5}[\s-]+[0-7]?\d{4,5}[\.\s-]*\d{6}[\s-]+\d{5}[\.\s-]*\d{6}[\s-]+\d[\s-]+\d{14})/g,
      // 2. Santander specific prefix
      /03399[0-9.\s-]{35,65}/g,
      // 3. Flexible 47-digit bank pattern (banks 001-799)
      /[0-7]\d{4}[\.\s-]*\d{5}\s*[\.\s-]*\d{5}[\.\s-]*\d{6}\s*[\.\s-]*\d{5}[\.\s-]*\d{6}\s*[\.\s-]*\d\s*[\.\s-]*\d{14}/g,
      // 4. Standard 48-digit Concessionária/Tributo/SEFAZ/IPVA/DETRAN (4 blocks of 11.1 or 12)
      /8\d{10,11}[-\s.]*\d\s+8?\d{10,11}[-\s.]*\d\s+8?\d{10,11}[-\s.]*\d\s+8?\d{10,11}[-\s.]*\d/g,
      /\d{11}[\.\s-]*\d[\s-]+\d{11}[\.\s-]*\d[\s-]+\d{11}[\.\s-]*\d[\s-]+\d{11}[\.\s-]*\d/g,
      /\d{12}[\s-]+\d{12}[\s-]+\d{12}[\s-]+\d{12}/g,
      /(?:8\d{10}[-\s.]*\d\s*){4}/g,
      // 5. Generic 48-digit Arrecadação / IPVA / SEFAZ / DETRAN
      /8\d{11}[\s-]*\d{12}[\s-]*\d{12}[\s-]*\d{12}/g,
      // 6. Contiguous digits (48 digits starting with 8, or 47 digits starting with 0-7)
      /\b8\d{47}\b/g,
      /\b[0-7]\d{46}\b/g,
      /\b\d{44}\b/g,
      // 7. Generic Brazilian bank line digitavel
      /(?:0\d{2}|1\d{2}|2\d{2}|3\d{2}|4\d{2}|6\d{2}|7\d{2})9[0-9.\s-]{40,65}/g,
    ];

    for (const textBlock of pageTexts) {
      const blockText = textBlock || fullDocText;
      const detectedGlobal = detectBoletoDetailsFromText(blockText);

      for (const pattern of patterns) {
        let match: RegExpExecArray | null;
        const regex = new RegExp(pattern.source, pattern.flags);
        while ((match = regex.exec(textBlock)) !== null) {
          const matchStr = match[1] || match[0];
          const matchIdx = match.index || 0;
          let clean = onlyNumbers(matchStr);

          // If bank code badge (e.g. 237-2) was captured at the start of a 47-digit bank slip, trim it to 47 digits
          // NEVER trim 48-digit Concessionária/Tributo/SEFAZ/DETRAN lines (starting with 8)
          if (clean.length > 48 && clean.length <= 54 && !clean.startsWith('8')) {
            const last47 = clean.slice(-47);
            const parsedLast47 = parseLinhaDigitavel(last47);
            if (parsedLast47.isValid && !last47.startsWith('8')) {
              clean = last47;
            }
          } else if (clean.length > 47 && !clean.startsWith('8') && clean.length <= 54) {
            const last47 = clean.slice(-47);
            const parsedLast47 = parseLinhaDigitavel(last47);
            if (parsedLast47.isValid && !last47.startsWith('8')) {
              clean = last47;
            }
          }

          // Ignore invalid 47-digit lines starting with 8 (tributos must have 48 digits)
          if (clean.length === 47 && clean.startsWith('8')) {
            continue;
          }

          if (clean.length === 47 || clean.length === 48 || clean.length === 44) {
            const parsed = parseLinhaDigitavel(clean);
            if (!parsed.isValid && clean.length !== 48) {
              continue;
            }

            const key44 = parsed.codigoBarras || clean;
            if (seenLines.has(clean) || seenLines.has(key44)) {
              continue;
            }
            seenLines.add(clean);
            seenLines.add(key44);

            // Extract localized context window around this specific match (800 chars before/after)
            const contextStart = Math.max(0, matchIdx - 800);
            const contextEnd = Math.min(textBlock.length, matchIdx + matchStr.length + 800);
            const localContextText = textBlock.substring(contextStart, contextEnd);
            const localDetected = detectBoletoDetailsFromText(localContextText, parsed.bancoNome);

            // Priority:
            // For standard 47-digit bank slips (Títulos Bancários: Bradesco, Itaú, Santander, BB, etc.),
            // the value encoded in the barcode (parsed.valor) is mathematically authoritative and represents the total aglutinated amount.
            // For 48-digit concessionárias/tributos (starting with 8), prioritize text-detected value (Valor Cobrado / Total a Recolher).
            let extractedValue = 0;
            if (clean.length === 47 && !clean.startsWith('8') && parsed.valor > 0) {
              extractedValue = parsed.valor;
            } else if (localDetected.valor && localDetected.valor > 0) {
              extractedValue = localDetected.valor;
            } else if (detectedGlobal.valor && detectedGlobal.valor > 0) {
              extractedValue = detectedGlobal.valor;
            } else if (parsed.valor > 0) {
              extractedValue = parsed.valor;
            }

            if (extractedValue <= 0) {
              const valorPatterns = [
                /(?:Valor\s+a\s+[Pp]agar|VALOR\s+A\s+PAGAR|VALOR\s+COBRADO|Valor\s+Cobrado|VALOR\s+DOCUMENTO|Valor\s+Documento|VALOR\s+ORIGINAL|Valor\s+Original|TOTAL\s+A\s+RECOLHER|TOTAL\s+A\s+PAGAR|VALOR\s+TOTAL(?:\s+A\s+RECOLHER)?|VALOR\s+PRINCIPAL|VALOR\s+COM\s+DESCONTO|VALOR\s+L[ÍI]QUIDO|(?:1|6)\s*\([^)]*\)\s*Valor\s*(?:Documento|Cobrado))\s*[:\s\r\n]*R?\$?\s*([\d\.]+(?:[,\.]\d{2}))/i,
                /(?:TOTAL|Valor)\s*[:\s\r\n]*R?\$?\s*([\d\.]+(?:[,\.]\d{2}))/i,
              ];
              for (const vp of valorPatterns) {
                const vm = localContextText.match(vp) || blockText.match(vp);
                if (vm && vm[1]) {
                  let valStr = vm[1].trim();
                  if (valStr.includes(',')) {
                    valStr = valStr.replace(/\./g, '').replace(',', '.');
                  }
                  const parsedVal = parseFloat(valStr);
                  if (!isNaN(parsedVal) && parsedVal > 0) {
                    extractedValue = parsedVal;
                    break;
                  }
                }
              }
            }

            let docNumber = localDetected.autoInfracao || localDetected.seuNumero || detectedGlobal.autoInfracao || '';
            let nossoNum = localDetected.nossoNumero || detectedGlobal.nossoNumero || '';

            // Capture document number with support for No. do Documento, Nº Doc, Número do Documento
            const numDocMatch = localContextText.match(/(?:N[oº°]\.?\s*(?:do\s*)?Documento|Número\s+do\s+Documento|N[oº°]\.?\s*Doc|N[oº°]\.?\s*de\s+Controle|Número\s+de\s+Controle|Seu\s+Número|Compromisso|Fatura|Nota\s+Fiscal|NF)\s*[:\s\r\n]*([\w\/\.-]{5,30})/i)
              || blockText.match(/(?:N[oº°]\.?\s*(?:do\s*)?Documento|Número\s+do\s+Documento|N[oº°]\.?\s*Doc|N[oº°]\.?\s*de\s+Controle|Número\s+de\s+Controle|Seu\s+Número|Compromisso|Fatura|Nota\s+Fiscal|NF)\s*[:\s\r\n]*([\w\/\.-]{5,30})/i);
            if (numDocMatch && !docNumber) docNumber = numDocMatch[1].trim();

            // Capture Nosso Número
            const nossoNumMatch = localContextText.match(/(?:Nosso\s+N[uú]mero|NOSSO\s+N[UÚ]MERO|Cart\.\s*\/\s*Nosso\s+N[uú]mero|Nosso\s+Numero|Nosso\s+N[oº°]\.?)\s*[:\s\r\n]*([\w\/\.-]{5,25})/i)
              || blockText.match(/(?:Nosso\s+N[uú]mero|NOSSO\s+N[UÚ]MERO|Cart\.\s*\/\s*Nosso\s+N[uú]mero|Nosso\s+Numero|Nosso\s+N[oº°]\.?)\s*[:\s\r\n]*([\w\/\.-]{5,25})/i);
            if (nossoNumMatch && !nossoNum) nossoNum = nossoNumMatch[1].trim();

            const finalFavorecido = (localDetected.favorecidoNome && localDetected.favorecidoNome !== 'Beneficiário / Cedente' ? localDetected.favorecidoNome : null)
              || (detectedGlobal.favorecidoNome && detectedGlobal.favorecidoNome !== 'Beneficiário / Cedente' ? detectedGlobal.favorecidoNome : null)
              || extractFavorecidoFromText(localContextText || blockText || fullDocText, parsed.bancoNome);

            const finalPagador = localDetected.pagador || detectedGlobal.pagador || 'Pagador Não Identificado';
            const finalPagadorCnpj = localDetected.pagadorCnpjCpf || detectedGlobal.pagadorCnpjCpf || '';
            const finalBeneficiarioCnpj = localDetected.favorecidoCnpjCpf || detectedGlobal.favorecidoCnpjCpf || '';

            const uniqueRef = docNumber || nossoNum || localDetected.seuNumero || detectedGlobal.seuNumero || `BOL-${clean.substring(33, 47) || Date.now()}`;

            const descontoVal = localDetected.desconto || detectedGlobal.desconto || 0;
            const jurosVal = localDetected.juros || detectedGlobal.juros || 0;
            const multaVal = localDetected.multa || detectedGlobal.multa || 0;
            let jurosMultaVal = localDetected.jurosMulta || detectedGlobal.jurosMulta || 0;
            if (jurosMultaVal === 0 && (jurosVal > 0 || multaVal > 0)) {
              jurosMultaVal = Number((jurosVal + multaVal).toFixed(2));
            }

            boletosFound.push({
              linhaDigitavel: clean,
              codigoBarras: parsed.codigoBarras || clean,
              favorecidoNome: finalFavorecido,
              favorecidoCnpjCpf: finalBeneficiarioCnpj,
              beneficiarioCnpjCpf: finalBeneficiarioCnpj,
              pagador: finalPagador,
              pagadorCnpjCpf: finalPagadorCnpj,
              valor: extractedValue,
              valorDocumento: localDetected.valorDocumento || detectedGlobal.valorDocumento || extractedValue,
              valorCobrado: localDetected.valorCobrado || detectedGlobal.valorCobrado || extractedValue,
              desconto: descontoVal,
              juros: jurosVal,
              multa: multaVal,
              jurosMulta: jurosMultaVal,
              dataVencimento: localDetected.dataVencimento || detectedGlobal.dataVencimento || parsed.dataVencimento || new Date().toISOString().split('T')[0],
              numeroDocumento: docNumber || nossoNum || uniqueRef,
              seuNumero: uniqueRef,
              nossoNumero: nossoNum,
              bancoCodigo: localDetected.bancoCodigo || detectedGlobal.bancoCodigo || parsed.bancoCodigo,
              bancoNome: localDetected.bancoNome || detectedGlobal.bancoNome || parsed.bancoNome,
              tipoBoleto: localDetected.tipoBoleto || detectedGlobal.tipoBoleto,
              placa: localDetected.placa || detectedGlobal.placa,
              renavam: localDetected.renavam || detectedGlobal.renavam,
              autoInfracao: localDetected.autoInfracao || detectedGlobal.autoInfracao,
              observacoes: localDetected.observacoes || detectedGlobal.observacoes || (boletosFound.length > 0 ? `Boleto #${boletosFound.length + 1} do arquivo` : 'Extraído via leitor de PDF local'),
              confidence: 0.95,
            });
          }
        }
      }
    }

    // 3. Fallback scan: Contiguous 47 or 48-digit valid lines
    if (boletosFound.length === 0) {
      for (const textBlock of pageTexts) {
        const textDigitsOnly = onlyNumbers(textBlock);
        const detected = detectBoletoDetailsFromText(textBlock || fullDocText);
        if (textDigitsOnly.length >= 47 && textDigitsOnly.length < 10000) {
          for (let i = 0; i <= textDigitsOnly.length - 47; i++) {
            if (i <= textDigitsOnly.length - 48) {
              const chunk48 = textDigitsOnly.substring(i, i + 48);
              if (chunk48.startsWith('8')) {
                const parsed48 = parseLinhaDigitavel(chunk48);
                const key44 = parsed48.codigoBarras || chunk48;
                if (!seenLines.has(chunk48) && !seenLines.has(key44)) {
                  seenLines.add(chunk48);
                  seenLines.add(key44);
                  const fbVal48 = parsed48.valor > 0 ? parsed48.valor : (detected.valor || 0);
                  boletosFound.push({
                    linhaDigitavel: chunk48,
                    codigoBarras: parsed48.codigoBarras || chunk48,
                    favorecidoNome: detected.favorecidoNome || extractFavorecidoFromText(textBlock || fullDocText, parsed48.bancoNome),
                    favorecidoCnpjCpf: detected.favorecidoCnpjCpf || '',
                    beneficiarioCnpjCpf: detected.favorecidoCnpjCpf || '',
                    pagador: detected.pagador || '',
                    pagadorCnpjCpf: detected.pagadorCnpjCpf || '',
                    valor: fbVal48,
                    valorDocumento: detected.valorDocumento || fbVal48,
                    valorCobrado: detected.valorCobrado || fbVal48,
                    desconto: detected.desconto || 0,
                    juros: detected.juros || 0,
                    multa: detected.multa || 0,
                    jurosMulta: detected.jurosMulta || 0,
                    dataVencimento: detected.dataVencimento || parsed48.dataVencimento || new Date().toISOString().split('T')[0],
                    seuNumero: detected.seuNumero || `PDF-BROWSER-${boletosFound.length + 1}`,
                    nossoNumero: '',
                    bancoCodigo: detected.bancoCodigo || parsed48.bancoCodigo,
                    bancoNome: detected.bancoNome || parsed48.bancoNome,
                    tipoBoleto: detected.tipoBoleto,
                    placa: detected.placa,
                    renavam: detected.renavam,
                    autoInfracao: detected.autoInfracao,
                    observacoes: detected.observacoes || 'Extraído via varredura de texto local (GNRE/Tributo)',
                    confidence: 0.85,
                  });
                }
                i += 47;
                continue;
              }
            }

            const chunk = textDigitsOnly.substring(i, i + 47);
            const parsed = parseLinhaDigitavel(chunk);
            if (parsed.bancoCodigo !== '000' || parsed.isValid) {
              const key44 = parsed.codigoBarras || chunk;
              if (!seenLines.has(chunk) && !seenLines.has(key44)) {
                seenLines.add(chunk);
                seenLines.add(key44);
                const fbVal47 = parsed.valor > 0 ? parsed.valor : (detected.valor || 0);
                boletosFound.push({
                  linhaDigitavel: chunk,
                  codigoBarras: parsed.codigoBarras || chunk,
                  favorecidoNome: detected.favorecidoNome || extractFavorecidoFromText(textBlock || fullDocText, parsed.bancoNome),
                  favorecidoCnpjCpf: detected.favorecidoCnpjCpf || '',
                  beneficiarioCnpjCpf: detected.favorecidoCnpjCpf || '',
                  pagador: detected.pagador || '',
                  pagadorCnpjCpf: detected.pagadorCnpjCpf || '',
                  valor: fbVal47,
                  valorDocumento: detected.valorDocumento || fbVal47,
                  valorCobrado: detected.valorCobrado || fbVal47,
                  desconto: detected.desconto || 0,
                  juros: detected.juros || 0,
                  multa: detected.multa || 0,
                  jurosMulta: detected.jurosMulta || 0,
                  dataVencimento: detected.dataVencimento || parsed.dataVencimento || new Date().toISOString().split('T')[0],
                  seuNumero: detected.seuNumero || `PDF-BROWSER-${boletosFound.length + 1}`,
                  nossoNumero: '',
                  bancoCodigo: detected.bancoCodigo || parsed.bancoCodigo,
                  bancoNome: detected.bancoNome || parsed.bancoNome,
                  tipoBoleto: detected.tipoBoleto,
                  placa: detected.placa,
                  renavam: detected.renavam,
                  autoInfracao: detected.autoInfracao,
                  observacoes: detected.observacoes || 'Extraído via varredura de texto local',
                  confidence: 0.85,
                });
                i += 46;
              }
            }
          }
        }
      }
    }
  } catch (err: any) {
    technicalLogger.log({
      step: 'Erro na Extração Local PDF',
      fileName,
      severity: 'error',
      errorMessage: err.message || String(err),
    });
  }

  const duration = Math.round(performance.now() - startTime);
  technicalLogger.log({
    step: 'Conclusão Extração Local PDF',
    fileName,
    processingTimeMs: duration,
    severity: boletosFound.length > 0 ? 'info' : 'warn',
    errorMessage: `Encontrados ${boletosFound.length} boleto(s) localmente no navegador em ${duration}ms`,
  });

  return boletosFound;
}

/**
 * Extrai todo o texto bruto do documento PDF no navegador para alimentar os modelos aprendidos e Fast Path
 */
export async function extractRawTextFromPDFInBrowser(fileBase64: string, fileName: string): Promise<string> {
  try {
    let cleanBase64 = fileBase64;
    const dataUriMatch = fileBase64.match(/^data:([^;]+);base64,(.*)$/s);
    if (dataUriMatch) {
      cleanBase64 = dataUriMatch[2];
    } else {
      cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    }

    cleanBase64 = cleanBase64.replace(/[\r\n\s]+/g, '');
    const padLength = cleanBase64.length % 4;
    if (padLength > 0) {
      cleanBase64 += '='.repeat(4 - padLength);
    }

    let binaryStr = '';
    try {
      binaryStr = atob(cleanBase64);
    } catch {
      binaryStr = '';
    }

    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const pageTexts: string[] = [];

    if (bytes.length > 0) {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        if (pdfjsLib) {
          try {
            if (pdfjsLib.GlobalWorkerOptions) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version || '4.10.38'}/pdf.worker.min.mjs`;
            }
          } catch {}
          if ('verbosity' in pdfjsLib) {
            (pdfjsLib as any).verbosity = 0;
          }
        }
        const loadingTask = pdfjsLib.getDocument({
          data: bytes,
          stopAtErrors: false,
        } as any);
        const pdfDoc = await loadingTask.promise;

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items.map((item: any) => (item as any)?.str || '');
          pageTexts.push(pageStrings.join(' '));
        }
      } catch {}
    }

    if (pageTexts.length === 0 && typeof DecompressionStream !== 'undefined') {
      try {
        let pos = 0;
        let streamCount = 0;
        while (pos < binaryStr.length && streamCount < 100) {
          const startIdx = binaryStr.indexOf('stream', pos);
          if (startIdx === -1) break;
          const endIdx = binaryStr.indexOf('endstream', startIdx + 6);
          if (endIdx === -1) break;

          let contentStart = startIdx + 6;
          if (binaryStr.charCodeAt(contentStart) === 13 && binaryStr.charCodeAt(contentStart + 1) === 10) contentStart += 2;
          else if (binaryStr.charCodeAt(contentStart) === 10 || binaryStr.charCodeAt(contentStart) === 13) contentStart += 1;

          let contentEnd = endIdx;
          if (contentEnd > contentStart && binaryStr.charCodeAt(contentEnd - 1) === 10) contentEnd--;
          if (contentEnd > contentStart && binaryStr.charCodeAt(contentEnd - 1) === 13) contentEnd--;

          if (contentEnd > contentStart) {
            const streamBuffer = bytes.subarray(contentStart, contentEnd);
            try {
              let rawDeflateData = streamBuffer;
              if (streamBuffer.length > 2 && streamBuffer[0] === 0x78) rawDeflateData = streamBuffer.subarray(2);
              const ds = new DecompressionStream('deflate-raw');
              const writer = ds.writable.getWriter();
              await writer.write(rawDeflateData);
              await writer.close();
              const response = new Response(ds.readable);
              const decompressedArray = await response.arrayBuffer();
              const text = new TextDecoder('utf-8').decode(decompressedArray);
              if (text && text.length > 10) pageTexts.push(text);
            } catch {}
          }
          pos = endIdx + 8;
          streamCount++;
        }
      } catch {}
    }

    let fullText = pageTexts.join(' \n ');

    // If text is still empty and it is an image or scanned document, run OCR
    if (fullText.trim().length < 20) {
      const isImageFile = /\.(png|jpe?g|webp|bmp|tiff)$/i.test(fileName) || fileBase64.startsWith('data:image/');
      if (isImageFile) {
        try {
          const { recognizeTextFromImage } = await import('./imageOcrService.js');
          fullText = await recognizeTextFromImage(fileBase64, fileName);
        } catch {}
      }
    }

    return fullText;
  } catch (err) {
    console.warn('[PDF Local Extractor] Erro ao extrair texto:', err);
    return '';
  }
}

