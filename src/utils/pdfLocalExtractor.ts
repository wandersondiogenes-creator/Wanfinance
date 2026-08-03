import { parseLinhaDigitavel, onlyNumbers, extractFavorecidoFromText } from './boletoParser';

/**
 * Client-Side Browser Fallback for PDF & Image Boleto Data Extraction.
 * Uses pdfjs-dist page-by-page text parsing and intelligent regex matching.
 */
export async function extractBoletosLocallyInBrowser(fileBase64: string, fileName: string): Promise<any[]> {
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

    const binaryStr = atob(cleanBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const pageTexts: string[] = [];

    // 1. Structural PDF page-by-page extraction using pdfjs-dist
    try {
      const pdfjsLib = await import('pdfjs-dist');
      if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      }
      const loadingTask = pdfjsLib.getDocument({ data: bytes.buffer });
      const pdfDoc = await loadingTask.promise;

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageStrings = textContent.items.map((item: any) => item.str || '');
        const pageCombined = pageStrings.join(' ');
        pageTexts.push(pageCombined);
      }
    } catch (pdfJsErr) {
      console.warn('[PDFJS Extractor] Avisos no PDF.js:', pdfJsErr);
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
              writer.write(rawDeflateData);
              writer.close();

              const response = new Response(ds.readable);
              const decompressedArray = await response.arrayBuffer();
              const text = new TextDecoder('utf-8').decode(decompressedArray);
              if (text && text.length > 10) pageTexts.push(text);
            } catch {
              // Stream skipped
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

    // Extract Favorecido / Beneficiário from overall text if available
    let docFavorecido = 'Beneficiário Emissor';
    const suhaiMatch = fullDocText.match(/(SUHAI\s+SEGURADORA\s*(?:S\/?A)?)/i);
    const sefazMatch = fullDocText.match(/(SECRETARIA\s+DA\s+FAZENDA[^\r\n]*|SEFAZ[-/ ][A-Z]{2}|GOVERNO\s+DO\s+ESTADO[^\r\n]*|RECEITA\s+FEDERAL)/i);
    
    if (suhaiMatch) {
      docFavorecido = 'SUHAI SEGURADORA S/A';
    } else if (sefazMatch) {
      docFavorecido = sefazMatch[1].trim();
    }

    // 2. Scan each page text for 47 and 48 digit linha digitável patterns
    const patterns = [
      /\d{5}[\.\s-]*\d{5}[\.\s-]*\d{5}[\.\s-]*\d{6}[\.\s-]*\d{5}[\.\s-]*\d{6}[\.\s-]*\d[\.\s-]*\d{14}/g,
      /\d{11,12}[\.\s-]*\d{11,12}[\.\s-]*\d{11,12}[\.\s-]*\d{11,12}/g,
      /\b\d{47,48}\b/g,
      /\b\d{44}\b/g,
    ];

    for (const textBlock of pageTexts) {
      for (const pattern of patterns) {
        const matches = textBlock.match(pattern);
        if (matches) {
          for (const matchStr of matches) {
            const clean = onlyNumbers(matchStr);
            if ((clean.length === 47 || clean.length === 48 || clean.length === 44) && !seenLines.has(clean)) {
              const parsed = parseLinhaDigitavel(clean);
              if (parsed.isValid) {
                seenLines.add(clean);
                let extractedValue = parsed.valor || 0;

                const valorMatch = textBlock.match(/(?:TOTAL\s+A\s+RECOLHER|VALOR\s+TOTAL(?:\s+A\s+RECOLHER)?|TOTAL\s+A\s+PAGAR|VALOR\s+DO\s+DOCUMENTO|VALOR\s+PRINCIPAL)\s*[:\s]*R?\$?\s*([\d\.]+(?:,\d{2})?)/i);
                if (valorMatch) {
                  const valStr = valorMatch[1].replace(/\./g, '').replace(',', '.');
                  const parsedVal = parseFloat(valStr);
                  if (!isNaN(parsedVal) && parsedVal > 0) {
                    if (extractedValue === 0 || parsed.bancoCodigo === '858' || parsed.bancoCodigo === '856') {
                      extractedValue = parsedVal;
                    }
                  }
                }

                const blockFavorecido = extractFavorecidoFromText(textBlock || fullDocText, parsed.bancoNome);

                boletosFound.push({
                  linhaDigitavel: clean,
                  codigoBarras: parsed.codigoBarras || clean,
                  favorecidoNome: blockFavorecido,
                  favorecidoCnpjCpf: '',
                  valor: extractedValue,
                  dataVencimento: parsed.dataVencimento || new Date().toISOString().split('T')[0],
                  seuNumero: `PDF-BROWSER-${boletosFound.length + 1}`,
                  nossoNumero: '',
                  bancoCodigo: parsed.bancoCodigo,
                  bancoNome: parsed.bancoNome,
                  observacoes: 'Extraído via leitor de PDF local',
                  confidence: 0.9,
                });
              }
            }
          }
        }
      }
    }

    // 3. Scan for scattered 47-digit sequences in extracted clean page text (e.g., spaces or linebreaks in numbers)
    if (boletosFound.length === 0) {
      for (const textBlock of pageTexts) {
        const textDigitsOnly = onlyNumbers(textBlock);
        // Only scan if text came from actual PDF text items (length reasonable)
        if (textDigitsOnly.length >= 47 && textDigitsOnly.length < 5000) {
          for (let i = 0; i <= textDigitsOnly.length - 47; i++) {
            const chunk = textDigitsOnly.substring(i, i + 47);
            if (!seenLines.has(chunk)) {
              const parsed = parseLinhaDigitavel(chunk);
              if (parsed.isValid && parsed.valor > 0 && parsed.bancoCodigo !== '000') {
                seenLines.add(chunk);
                boletosFound.push({
                  linhaDigitavel: chunk,
                  codigoBarras: parsed.codigoBarras || chunk,
                  favorecidoNome: extractFavorecidoFromText(textBlock || fullDocText, parsed.bancoNome),
                  favorecidoCnpjCpf: '',
                  valor: parsed.valor,
                  dataVencimento: parsed.dataVencimento || new Date().toISOString().split('T')[0],
                  seuNumero: `PDF-BROWSER-${boletosFound.length + 1}`,
                  nossoNumero: '',
                  bancoCodigo: parsed.bancoCodigo,
                  bancoNome: parsed.bancoNome,
                  observacoes: 'Extraído via varredura de texto local',
                  confidence: 0.85,
                });
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Browser PDF Extractor] Erro na extração local:', err);
  }

  return boletosFound;
}
