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
 * Parser de GRU (Guia de Recolhimento da União)
 */
export function parseGruUniaoDocument(text: string, fileName: string = ''): Partial<SmartExtractedDocument> {
  let favorecidoNome = 'MINISTÉRIO DA FAZENDA - SECRETARIA DO TESOURO NACIONAL (GRU)';
  let ugGestao = '';
  let codigoReceita = '';
  let numeroReferencia = '';
  let valor = 0;
  let dataVencimento = '';
  let linhaDigitavel = '';

  // 1. UG / Gestão
  const ugMatch = text.match(/(?:Unidade\s+Gestora\s*\(UG\)|UG\s*\/\s*Gest[aã]o)\s*[:\s\r\n]*(\d{5,8}\s*\/?\s*\d{0,5})/i);
  if (ugMatch) ugGestao = ugMatch[1].trim();

  // 2. Código de Recolhimento
  const codMatch = text.match(/(?:C[oó]digo\s+de\s+Recolhimento|C[oó]d\.\s*Recolhimento)\s*[:\s\r\n]*(\d{4,6})/i);
  if (codMatch) codigoReceita = codMatch[1].trim();

  // 3. Número de Referência
  const refMatch = text.match(/(?:N[uú]mero\s+de\s+Refer[eê]ncia|Refer[eê]ncia)\s*[:\s\r\n]*(\d{5,25})/i);
  if (refMatch) numeroReferencia = refMatch[1].trim();

  // 4. Linha Digitável
  const linhaMatch = text.match(/(8[0-9\s.-]{47,60})/i) ||
    text.match(/(\d{5}\.?\d{5}\s+\d{5}\.?\d{6}\s+\d{5}\.?\d{6}\s+\d\s+\d{14})/i);
  if (linhaMatch) linhaDigitavel = linhaMatch[1].replace(/\D/g, '');

  // 5. Valor
  const valMatch = text.match(/(?:Valor\s+Total|Total|Valor\s+Principal|Valor\s*\(R\$\))\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i);
  if (valMatch) valor = parseNumBR(valMatch[1]);

  // 6. Vencimento
  const vencMatch = text.match(/(?:Vencimento|Data\s+de\s+Vencimento)\s*[:\s\r\n]*(\d{2}[/.-]\d{2}[/.-]\d{4})/i);
  if (vencMatch) dataVencimento = parseDateBR(vencMatch[1]);

  return {
    docCategory: 'gru_uniao',
    detectedCategory: 'gru_uniao',
    favorecidoNome,
    favorecidoCnpjCpf: '00.394.460/0058-87',
    ugGestao,
    codigoReceita,
    numeroReferencia,
    valor,
    valorOriginal: valor,
    valorCobrado: valor,
    dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
    seuNumero: numeroReferencia || (ugGestao ? `UG-${ugGestao}` : `GRU-${fileName.replace(/\.pdf$/i, '')}`),
    bancoCodigo: '858',
    bancoNome: 'Governo Federal / STN',
    tipoBoleto: 'gru',
    linhaDigitavel,
    codigoBarras: linhaDigitavel,
    confidence: 0.95,
  };
}
