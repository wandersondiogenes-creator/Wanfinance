import { parseLinhaDigitavel, onlyNumbers } from './boletoParser';

/**
 * Client-Side Browser Fallback for PDF & Image Boleto Data Extraction
 * Uses pdfjs-dist and stream decoders to extract text directly in the browser.
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

    // Convert Base64 to ArrayBuffer and Uint8Array
    const binaryStr = atob(cleanBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    let combinedText = '';

    // 1. Try pdfjs-dist first for full structural PDF text extraction
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
        combinedText += ' ' + pageStrings.join(' ');
      }
    } catch (pdfJsErr) {
      console.warn('[PDFJS Extractor] Avisos no PDF.js, tentando leitores alternativos:', pdfJsErr);
    }

    // 2. Fallback Plain text view
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      combinedText += ' ' + decoder.decode(bytes);
    } catch {
      // Ignore
    }

    try {
      const latinDecoder = new TextDecoder('iso-8859-1');
      combinedText += ' ' + latinDecoder.decode(bytes);
    } catch {
      // Ignore
    }

    // 3. Try inflating PDF streams using DecompressionStream if supported by browser
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const pdfStr = binaryStr;
        const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
        let match: RegExpExecArray | null;

        while ((match = streamRegex.exec(pdfStr)) !== null) {
          const streamStart = match.index + match[0].indexOf(match[1]);
          const streamEnd = streamStart + match[1].length;
          const streamBuffer = bytes.subarray(streamStart, streamEnd);

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
            if (text) combinedText += ' ' + text;
          } catch {
            // Stream decompression skipped
          }
        }
      } catch (err) {
        console.warn('[Browser PDF Extractor] Decompression stream scan error:', err);
      }
    }

    // 4. Scan combined text for Brazilian Boleto, GNRE, DARF and Concessionaire patterns
    const patterns = [
      /\d{5}[\.\s]?\d{5}[\.\s]?\d{5}[\.\s]?\d{6}[\.\s]?\d{5}[\.\s]?\d{6}[\.\s]?\d[\.\s]?\d{14}/g,
      /\d{11,12}[\.\s-]?\d{11,12}[\.\s-]?\d{11,12}[\.\s-]?\d{11,12}/g,
      /\b\d{47,48}\b/g,
      /\b\d{44}\b/g,
    ];

    for (const pattern of patterns) {
      const matches = combinedText.match(pattern);
      if (matches) {
        for (const matchStr of matches) {
          const clean = onlyNumbers(matchStr);
          if ((clean.length === 47 || clean.length === 48 || clean.length === 44) && !seenLines.has(clean)) {
            seenLines.add(clean);
            const parsed = parseLinhaDigitavel(clean);
            if (parsed.isValid) {
              let extractedValue = parsed.valor || 0;

              const valorMatch = combinedText.match(/(?:TOTAL\s+A\s+RECOLHER|VALOR\s+TOTAL(?:\s+A\s+RECOLHER)?|TOTAL\s+A\s+PAGAR|VALOR\s+PRINCIPAL)\s*[:\s]*R?\$?\s*([\d\.]+(?:,\d{2})?)/i);
              if (valorMatch) {
                const valStr = valorMatch[1].replace(/\./g, '').replace(',', '.');
                const parsedVal = parseFloat(valStr);
                if (!isNaN(parsedVal) && parsedVal > 0) {
                  if (extractedValue === 0 || parsed.bancoCodigo === '858' || parsed.bancoCodigo === '856') {
                    extractedValue = parsedVal;
                  }
                }
              }

              let favorecidoNome = `Beneficiário (${parsed.bancoNome})`;
              const sefazMatch = combinedText.match(/(SECRETARIA\s+DA\s+FAZENDA[^\r\n]*|SEFAZ[-/ ][A-Z]{2}|GOVERNO\s+DO\s+ESTADO[^\r\n]*|RECEITA\s+FEDERAL)/i);
              if (sefazMatch) {
                favorecidoNome = sefazMatch[1].trim();
              } else if (parsed.bancoCodigo === '858') {
                favorecidoNome = 'SEFAZ - Guia GNRE';
              } else if (parsed.bancoCodigo === '856') {
                favorecidoNome = 'Receita Federal - DARF';
              }

              boletosFound.push({
                linhaDigitavel: clean,
                codigoBarras: parsed.codigoBarras || clean,
                favorecidoNome,
                favorecidoCnpjCpf: '',
                valor: extractedValue,
                dataVencimento: parsed.dataVencimento || new Date().toISOString().split('T')[0],
                seuNumero: `PDF-BROWSER-${boletosFound.length + 1}`,
                nossoNumero: '',
                bancoCodigo: parsed.bancoCodigo,
                bancoNome: parsed.bancoNome,
                observacoes: 'Extraído no navegador via leitor inteligente',
                confidence: 0.9,
              });
            }
          }
        }
      }
    }

    // 5. If no boletos matched, scan continuous digit streams in browser memory
    if (boletosFound.length === 0) {
      const digitsOnly = onlyNumbers(combinedText);
      for (let i = 0; i <= digitsOnly.length - 47; i++) {
        const chunk = digitsOnly.substring(i, i + 47);
        if (!seenLines.has(chunk)) {
          const parsed = parseLinhaDigitavel(chunk);
          if (parsed.isValid && parsed.valor > 0) {
            seenLines.add(chunk);
            boletosFound.push({
              linhaDigitavel: chunk,
              codigoBarras: parsed.codigoBarras || chunk,
              favorecidoNome: `Beneficiário (${parsed.bancoNome})`,
              favorecidoCnpjCpf: '',
              valor: parsed.valor,
              dataVencimento: parsed.dataVencimento || new Date().toISOString().split('T')[0],
              seuNumero: `PDF-BROWSER-${boletosFound.length + 1}`,
              nossoNumero: '',
              bancoCodigo: parsed.bancoCodigo,
              bancoNome: parsed.bancoNome,
              observacoes: 'Extraído via varredura contínua no navegador',
              confidence: 0.85,
            });
            break;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Browser PDF Extractor] Erro na extração local:', err);
  }

  return boletosFound;
}
