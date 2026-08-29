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
 * Parser de Tributos Federais (DARF Ordinário, DARF Numerado, DAS / Simples Nacional, GPS)
 */
export function parseTaxDarfDasDocument(text: string, fileName: string = ''): Partial<SmartExtractedDocument> {
  const textUpper = text.toUpperCase();
  const isDAS = textUpper.includes('SIMPLES NACIONAL') || textUpper.includes('DAS -') || textUpper.includes('DAS');
  let favorecidoNome = isDAS
    ? 'MINISTÉRIO DA FAZENDA - SIMPLES NACIONAL (DAS)'
    : 'MINISTÉRIO DA FAZENDA - SECRETARIA DA RECEITA FEDERAL (DARF)';
  let codigoReceita = '';
  let periodoApuracao = '';
  let numeroReferencia = '';
  let valor = 0;
  let dataVencimento = '';
  let linhaDigitavel = '';
  let pagadorNome = '';
  let pagadorCnpjCpf = '';

  // 1. Código da Receita
  const codMatch = text.match(/(?:C[oó]digo\s+da\s+Receita|C[oó]d\.\s*Receita)\s*[:\s\r\n]*(\d{4})/i);
  if (codMatch) codigoReceita = codMatch[1].trim();

  // 2. Período de Apuração
  const perMatch = text.match(/(?:Per[ií]odo\s+de\s+Apura[cç][aã]o|Compet[eê]ncia)\s*[:\s\r\n]*(\d{2}[/.-]\d{2}[/.-]\d{4}|\d{2}\/\d{4})/i);
  if (perMatch) periodoApuracao = perMatch[1].trim();

  // 3. Número de Referência
  const refMatch = text.match(/(?:N[uú]mero\s+de\s+Refer[eê]ncia|Nº\s+Refer[eê]ncia|Doc\.\s*Origem)\s*[:\s\r\n]*([A-Z0-9-]{6,25})/i);
  if (refMatch) numeroReferencia = refMatch[1].trim();

  // 4. Linha Digitável 48 dígitos (inicia com 858...) ou 47 dígitos se DARF Numerado
  const linhaMatch = text.match(/(858[0-9\s.-]{45,60})/i) ||
    text.match(/(8[0-9\s.-]{47,60})/i) ||
    text.match(/(\d{5}\.?\d{5}\s+\d{5}\.?\d{6}\s+\d{5}\.?\d{6}\s+\d\s+\d{14})/i);
  if (linhaMatch) {
    linhaDigitavel = linhaMatch[1].replace(/\D/g, '');
  }

  // 5. CNPJ / Pagador
  const cnpjMatch = text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  if (cnpjMatch) pagadorCnpjCpf = cnpjMatch[1].trim();

  const pagMatch = text.match(/(?:Raz[aã]o\s+Social|Nome\s+Empresarial|Contribuinte)\s*[:\s\r\n]*([A-Z0-9\s.,/-]{5,60})/i);
  if (pagMatch) pagadorNome = pagMatch[1].trim();

  // 6. Valor Total
  const valMatch = text.match(/(?:Valor\s+Total|Total\s+a\s+Recolher|Valor\s+do\s+Principal|Valor\s*\(R\$\))\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i);
  if (valMatch) valor = parseNumBR(valMatch[1]);

  // 7. Vencimento
  const vencMatch = text.match(/(?:Data\s+de\s+Vencimento|Pagar\s+at[eé]|Vencimento)\s*[:\s\r\n]*(\d{2}[/.-]\d{2}[/.-]\d{4})/i);
  if (vencMatch) dataVencimento = parseDateBR(vencMatch[1]);

  return {
    docCategory: 'darf_das_tributos',
    detectedCategory: 'darf_das_tributos',
    favorecidoNome,
    favorecidoCnpjCpf: '00.394.460/0058-87',
    pagadorNome,
    pagadorCnpjCpf,
    codigoReceita,
    periodoApuracao,
    numeroReferencia,
    valor,
    valorOriginal: valor,
    valorCobrado: valor,
    dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
    seuNumero: numeroReferencia || (codigoReceita ? `REC-${codigoReceita}` : `DARF-${fileName.replace(/\.pdf$/i, '')}`),
    bancoCodigo: '858',
    bancoNome: 'Tributos Federais / Receita Federal',
    tipoBoleto: isDAS ? 'das' : 'darf',
    linhaDigitavel,
    codigoBarras: linhaDigitavel,
    confidence: 0.95,
  };
}
