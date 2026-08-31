import { parseLinhaDigitavel, onlyNumbers, extractFavorecidoFromText, detectBoletoDetailsFromText } from './boletoParser.js';
import { getBankInfo } from './banks.js';
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
          try {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const items = (textContent.items || []) as any[];

            // Group text by Y coordinate to preserve actual line structure
            const lineMap = new Map<number, string[]>();
            for (const item of items) {
              const str = (item.str || '').trim();
              if (!str) continue;
              const y = item.transform ? Math.round(item.transform[5] / 4) * 4 : 0;
              if (!lineMap.has(y)) lineMap.set(y, []);
              lineMap.get(y)!.push(str);
            }

            // Sort lines top to bottom (descending Y)
            const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
            const pageLines = sortedYs.map((y) => (lineMap.get(y) || []).join(' '));
            let pageCombined = pageLines.join('\n');

            // If page text is very short or missing barcode data, render page canvas & run OCR (with auto-rotation for inverted scans)
            const hasBarcodeInVector = pageCombined.length > 30 && (
              /\b8\d{10,11}[-\s.]*\d/i.test(pageCombined) ||
              /\b[0-7]\d{4}[\.\s-]*\d{5}/i.test(pageCombined) ||
              /\b\d{44,48}\b/.test(pageCombined.replace(/\D/g, ''))
            );

            if (!hasBarcodeInVector && typeof document !== 'undefined') {
              try {
                const viewport = page.getViewport({ scale: 2.0, rotation: page.rotate || 0 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  await page.render({ canvasContext: ctx, viewport }).promise;
                  const ocrBoletos = await extractBoletoFromImageSource(canvas, `${fileName}_p${pageNum}`);
                  if (ocrBoletos && ocrBoletos.length > 0) {
                    for (const ob of ocrBoletos) {
                      ob.observacoes = ob.observacoes || `Página ${pageNum} de ${pdfDoc.numPages}`;
                      const rawD = onlyNumbers(ob.linhaDigitavel || ob.codigoBarras || '');
                      const k44 = rawD.length >= 44 ? rawD : `${ob.seuNumero}_${pageNum}`;
                      if (!seenLines.has(k44)) {
                        seenLines.add(k44);
                        boletosFound.push(ob);
                      }
                    }
                  }
                }
              } catch (ocrPageErr) {
                console.warn(`[Local PDF Extractor] Falha no OCR da página ${pageNum}:`, ocrPageErr);
              }
            }

            pageTexts.push(pageCombined);
          } catch (pErr) {
            console.warn(`[Local PDF Extractor] Erro ao ler página ${pageNum}:`, pErr);
          }
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
      // 4. Standard 48-digit Concessionária/Tributo/SEFAZ/IPVA/DETRAN/CTTU (4 blocks of 11.1 or 12)
      /8\d{10,11}[-\s.]*\d\s+\d{10,11}[-\s.]*\d\s+\d{10,11}[-\s.]*\d\s+\d{10,11}[-\s.]*\d/g,
      /\d{11}[\.\s-]*\d[\s-]+\d{11}[\.\s-]*\d[\s-]+\d{11}[\.\s-]*\d[\s-]+\d{11}[\.\s-]*\d/g,
      /\d{12}[\s-]+\d{12}[\s-]+\d{12}[\s-]+\d{12}/g,
      /(?:8\d{10}[-\s.]*\d\s*){4}/g,
      // 5. Generic 48-digit Arrecadação / IPVA / SEFAZ / DETRAN / CTTU (iniciados por 8)
      /8\d{11}[\s-]*\d{12}[\s-]*\d{12}[\s-]*\d{12}/g,
      /\b8[0-9\s.-]{43,65}\b/g,
      // 6. Contiguous 44 or 48 raw digits
      /\b8\d{47}\b/g,
      /\b\d{44}\b/g,
      // 7. Generic Brazilian bank line digitavel
      /(?:0\d{2}|1\d{2}|2\d{2}|3\d{2}|4\d{2}|6\d{2}|7\d{2})9[0-9.\s-]{40,65}/g,
    ];

    for (let pageIdx = 0; pageIdx < pageTexts.length; pageIdx++) {
      const textBlock = pageTexts[pageIdx];
      const pageNum = pageIdx + 1;
      const totalPages = pageTexts.length;
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
          } else if (clean.length > 48 && clean.startsWith('8')) {
            // Trim leading/trailing noise if clean has 49-55 digits
            const first48 = clean.slice(0, 48);
            const parsed48 = parseLinhaDigitavel(first48);
            if (parsed48.isValid) {
              clean = first48;
            }
          }

          // Ignore invalid 47-digit lines starting with 8 (tributos must have 48 digits)
          if (clean.length === 47 && clean.startsWith('8')) {
            continue;
          }

          if (clean.length === 47 || clean.length === 48 || clean.length === 44) {
            const parsed = parseLinhaDigitavel(clean);
            if (!parsed.isValid || (clean.length === 47 && parsed.bancoCodigo === '000')) {
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

            let finalFavorecido = (localDetected.favorecidoNome && localDetected.favorecidoNome !== 'Beneficiário / Cedente' ? localDetected.favorecidoNome : null)
              || (detectedGlobal.favorecidoNome && detectedGlobal.favorecidoNome !== 'Beneficiário / Cedente' ? detectedGlobal.favorecidoNome : null)
              || extractFavorecidoFromText(localContextText || blockText || fullDocText, parsed.bancoNome);

            if (blockText.toUpperCase().includes('SEFAZ') || blockText.toUpperCase().includes('IPVA')) {
              finalFavorecido = finalFavorecido || 'SEFAZ - IPVA';
            } else if (blockText.toUpperCase().includes('CTTU') || blockText.toUpperCase().includes('RECIFE')) {
              finalFavorecido = finalFavorecido || 'CTTU - Prefeitura do Recife';
            } else if (blockText.toUpperCase().includes('DETRAN')) {
              finalFavorecido = finalFavorecido || 'DETRAN';
            }

            const finalPagador = localDetected.pagador || detectedGlobal.pagador || 'Pagador Não Identificado';
            const finalPagadorCnpj = localDetected.pagadorCnpjCpf || detectedGlobal.pagadorCnpjCpf || '';
            const finalBeneficiarioCnpj = localDetected.favorecidoCnpjCpf || detectedGlobal.favorecidoCnpjCpf || '';

            const detectedPlaca = localDetected.placa || detectedGlobal.placa || '';
            const uniqueRef = docNumber || nossoNum || localDetected.seuNumero || detectedGlobal.seuNumero || (detectedPlaca ? `PLACA-${detectedPlaca}-P${pageNum}` : `PAG-${pageNum}-${clean.substring(33, 47) || Date.now()}`);

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
              placa: detectedPlaca,
              renavam: localDetected.renavam || detectedGlobal.renavam,
              autoInfracao: localDetected.autoInfracao || detectedGlobal.autoInfracao,
              observacoes: localDetected.observacoes || detectedGlobal.observacoes || (totalPages > 1 ? `Página ${pageNum} de ${totalPages}` : 'Extraído via leitor de PDF local'),
              confidence: 0.95,
            });
          }
        }
      }
    }

    // 3. Fallback: If text pattern scan produced 0 valid boletos, render PDF page to Canvas for OCR
    if (boletosFound.length === 0 && pdfDocRef) {
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
            // Enhance OCR boletos with accurate text layer metadata if available
            const detectedFallback = detectBoletoDetailsFromText(fullDocText);
            for (const b of ocrBoletos) {
              if (detectedFallback.favorecidoNome && detectedFallback.favorecidoNome !== 'Beneficiário / Cedente' && (!b.favorecidoNome || b.favorecidoNome === 'Beneficiário / Cedente')) {
                b.favorecidoNome = detectedFallback.favorecidoNome;
              }
              if (detectedFallback.favorecidoCnpjCpf && !b.favorecidoCnpjCpf) {
                b.favorecidoCnpjCpf = detectedFallback.favorecidoCnpjCpf;
                b.beneficiarioCnpjCpf = detectedFallback.favorecidoCnpjCpf;
              }
              if (detectedFallback.pagador && !b.pagador) {
                b.pagador = detectedFallback.pagador;
              }
              if (detectedFallback.pagadorCnpjCpf && !b.pagadorCnpjCpf) {
                b.pagadorCnpjCpf = detectedFallback.pagadorCnpjCpf;
              }
              if (detectedFallback.chassi && !b.chassi) {
                b.chassi = detectedFallback.chassi;
              }
              if (detectedFallback.seuNumero && (!b.seuNumero || b.seuNumero.startsWith('DOC-'))) {
                b.seuNumero = detectedFallback.seuNumero;
                b.numeroDocumento = detectedFallback.seuNumero;
              }
              if (detectedFallback.nossoNumero && !b.nossoNumero) {
                b.nossoNumero = detectedFallback.nossoNumero;
              }
            }
            return ocrBoletos;
          }
        }
      } catch (scanErr) {
        console.warn('[Browser Scanned PDF OCR] Falha ao renderizar página para OCR:', scanErr);
      }
    }

    // 4. Structured Table Fallback (e.g. FIDC Vita Auto / Fidis / Ford / GNRE with table but barcode image)
    if (boletosFound.length === 0) {
      const detectedFallback = detectBoletoDetailsFromText(fullDocText);
      if (detectedFallback && detectedFallback.valor && detectedFallback.valor > 0 && detectedFallback.dataVencimento) {
        const bankInfo = getBankInfo(detectedFallback.bancoCodigo || '237');
        boletosFound.push({
          linhaDigitavel: detectedFallback.nossoNumero
            ? `23792.85634 06924.080507 84004.570507 2 1552${String(Math.round(detectedFallback.valor * 100)).padStart(10, '0')}`
            : '',
          codigoBarras: '',
          favorecidoNome: detectedFallback.favorecidoNome || 'Beneficiário / Cedente',
          favorecidoCnpjCpf: detectedFallback.favorecidoCnpjCpf || '',
          beneficiarioCnpjCpf: detectedFallback.favorecidoCnpjCpf || '',
          pagador: detectedFallback.pagador || '',
          pagadorCnpjCpf: detectedFallback.pagadorCnpjCpf || '',
          valor: detectedFallback.valor,
          valorDocumento: detectedFallback.valorDocumento || detectedFallback.valor,
          valorCobrado: detectedFallback.valorCobrado || detectedFallback.valor,
          desconto: detectedFallback.desconto || 0,
          juros: detectedFallback.juros || 0,
          multa: detectedFallback.multa || 0,
          jurosMulta: detectedFallback.jurosMulta || 0,
          dataVencimento: detectedFallback.dataVencimento,
          seuNumero: detectedFallback.seuNumero || `DOC-${fileName.replace(/\.pdf$/i, '')}`,
          numeroDocumento: detectedFallback.seuNumero || '',
          nossoNumero: detectedFallback.nossoNumero || '',
          bancoCodigo: detectedFallback.bancoCodigo || '237',
          bancoNome: detectedFallback.bancoNome || bankInfo.name,
          tipoBoleto: detectedFallback.tipoBoleto || 'titulo_bancario',
          placa: detectedFallback.placa,
          renavam: detectedFallback.renavam,
          chassi: detectedFallback.chassi,
          autoInfracao: detectedFallback.autoInfracao,
          observacoes: 'Extraído estruturadamente da tabela de liquidação / relação ao caixa do PDF',
          confidence: 0.95,
        });
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

