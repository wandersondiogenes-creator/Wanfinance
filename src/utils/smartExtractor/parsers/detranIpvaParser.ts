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
 * Parser Especializado em Guias DETRAN, IPVA, Licenciamento e Multas de Trânsito
 */
export function parseDetranIpvaDocument(text: string, fileName: string = ''): Partial<SmartExtractedDocument> {
  const textUpper = text.toUpperCase();
  let estado = 'DETRAN / SEFAZ';
  const ufMatch = textUpper.match(/\b(DETRAN|SEFAZ|GOVERNO DO ESTADO)\s*(?:DE|DO|DA)?\s*([A-Z]{2})\b/);
  if (ufMatch) {
    estado = `DETRAN-${ufMatch[2]}`;
  } else if (textUpper.includes('SAO PAULO') || textUpper.includes('SÃO PAULO') || textUpper.includes('SP')) {
    estado = 'DETRAN-SP (Secretaria da Fazenda)';
  } else if (textUpper.includes('MINAS GERAIS') || textUpper.includes('MG')) {
    estado = 'DETRAN-MG (Secretaria da Fazenda)';
  } else if (textUpper.includes('RIO DE JANEIRO') || textUpper.includes('RJ')) {
    estado = 'DETRAN-RJ / Bradesco';
  } else if (textUpper.includes('CEARA') || textUpper.includes('CEARÁ') || textUpper.includes('CE')) {
    estado = 'DETRAN-CE';
  }

  let favorecidoNome = `${estado} - IPVA / Taxas de Trânsito`;
  let placa = '';
  let renavam = '';
  let autoInfracao = '';
  let valor = 0;
  let dataVencimento = '';
  let linhaDigitavel = '';

  // 1. Placa
  const placaMatch = text.match(/(?:Placa|PLACA)\s*[:\s\r\n]*([A-Z]{3}-?\d[A-Z0-9]\d{2})/i) ||
    text.match(/\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2})\b/);
  if (placaMatch) {
    placa = placaMatch[1].replace('-', '').toUpperCase();
  }

  // 2. Renavam
  const renavamMatch = text.match(/(?:Renavam|RENAVAM|C[oó]d(?:igo)?\s*Renavam)\s*[:\s\r\n]*(\d{9,11})/i) ||
    text.match(/\b(\d{11})\b/);
  if (renavamMatch) {
    renavam = renavamMatch[1].trim();
  }

  // 3. Auto de Infração
  const autoMatch = text.match(/(?:Auto\s+de\s+Infra[cç][aã]o|AIT|N[oº°]\s+Infra[cç][aã]o)\s*[:\s\r\n]*([A-Z0-9-]{6,20})/i);
  if (autoMatch) {
    autoInfracao = autoMatch[1].trim();
  }

  // 4. Linha Digitável de Arrecadação 48 dígitos (iniciada por 8) ou 47
  const linhaMatch = text.match(/(8[0-9\s.-]{47,60})/i) ||
    text.match(/(\d{5}\.?\d{5}\s+\d{5}\.?\d{6}\s+\d{5}\.?\d{6}\s+\d\s+\d{14})/i);
  if (linhaMatch) {
    linhaDigitavel = linhaMatch[1].replace(/\D/g, '');
  }

  // 5. Valor
  const valMatch = text.match(/(?:Valor\s+Total|Total\s+a\s+Pagar|Valor\s+do\s+IPVA|Valor\s*\(R\$\))\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i);
  if (valMatch) valor = parseNumBR(valMatch[1]);

  // 6. Vencimento
  const vencMatch = text.match(/(?:Data\s+de\s+Vencimento|Vencimento|Pagar\s+at[eé])\s*[:\s\r\n]*(\d{2}[/.-]\d{2}[/.-]\d{4})/i);
  if (vencMatch) dataVencimento = parseDateBR(vencMatch[1]);

  return {
    docCategory: 'detran_ipva',
    detectedCategory: 'detran_ipva',
    favorecidoNome,
    placa,
    renavam,
    autoInfracao,
    valor,
    valorOriginal: valor,
    valorCobrado: valor,
    dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
    seuNumero: autoInfracao || renavam || `DETRAN-${placa || fileName.replace(/\.pdf$/i, '')}`,
    bancoCodigo: '858',
    bancoNome: 'Arrecadação / Órgãos Públicos Estaduais',
    tipoBoleto: 'tributo_estadual',
    linhaDigitavel,
    codigoBarras: linhaDigitavel,
    confidence: 0.96,
  };
}
