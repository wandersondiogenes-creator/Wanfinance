import { SmartExtractedDocument } from '../smartDocTypes';

function parseNumBR(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/[^\d.,]/g, '');
  if (clean.includes(',') && clean.includes('.')) {
    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  }
  if (clean.includes(',')) {
    return parseFloat(clean.replace(',', '.'));
  }
  return parseFloat(clean) || 0;
}

function parseDateBR(str: string): string {
  if (!str) return '';
  const match = str.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return '';
}

/**
 * Parser de GNRE e Tributos Estaduais (ICMS ST / DIFAL)
 */
export function parseGnreDocument(text: string, fileName: string = ''): Partial<SmartExtractedDocument> {
  let ufFavorecida = '';
  const ufMatch = text.match(/(?:UF\s+Favorecida|UF\s*:\s*)\s*[:\s\r\n]*([A-Z]{2})/i);
  if (ufMatch) ufFavorecida = ufMatch[1].toUpperCase();

  let codigoReceita = '';
  const codMatch = text.match(/(?:C[oó]digo\s+da\s+Receita|C[oó]d\.\s*Receita)\s*[:\s\r\n]*(\d{6}|\d{4})/i);
  if (codMatch) codigoReceita = codMatch[1].trim();

  let documentoOrigem = '';
  const docMatch = text.match(/(?:Documento\s+de\s+Origem|Doc\.\s*Origem|Nº\s+do\s+Documento)\s*[:\s\r\n]*([A-Z0-9-]{4,25})/i);
  if (docMatch) documentoOrigem = docMatch[1].trim();

  let favorecidoNome = ufFavorecida ? `GNRE - SEFAZ ${ufFavorecida} (ICMS / Tributos)` : 'GNRE - Tributos Estaduais';
  let valor = 0;
  let dataVencimento = '';
  let linhaDigitavel = '';

  // Linha 48 dígitos
  const linhaMatch = text.match(/(858[0-9\s.-]{45,60})/i) ||
    text.match(/(8[0-9\s.-]{47,60})/i);
  if (linhaMatch) linhaDigitavel = linhaMatch[1].replace(/\D/g, '');

  // Valor
  const valMatch = text.match(/(?:Valor\s+Total|Total|Valor\s+Principal|Valor\s*\(R\$\))\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i);
  if (valMatch) valor = parseNumBR(valMatch[1]);

  // Vencimento
  const vencMatch = text.match(/(?:Data\s+de\s+Vencimento|Vencimento|Pagar\s+at[eé])\s*[:\s\r\n]*(\d{2}[/.-]\d{2}[/.-]\d{4})/i);
  if (vencMatch) dataVencimento = parseDateBR(vencMatch[1]);

  return {
    docCategory: 'gnre_icms',
    detectedCategory: 'gnre_icms',
    favorecidoNome,
    ufFavorecida,
    codigoReceita,
    numeroReferencia: documentoOrigem,
    valor,
    valorOriginal: valor,
    valorCobrado: valor,
    dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
    seuNumero: documentoOrigem || (codigoReceita ? `REC-${codigoReceita}` : `GNRE-${fileName.replace(/\.pdf$/i, '')}`),
    bancoCodigo: '858',
    bancoNome: 'Governo Estadual / SEFAZ',
    tipoBoleto: 'gnre',
    linhaDigitavel,
    codigoBarras: linhaDigitavel,
    confidence: 0.96,
  };
}
