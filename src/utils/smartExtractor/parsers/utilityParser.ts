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
 * Parser de Faturas de Concessionárias (Energia, Água/Saneamento, Telecomunicações, Gás)
 */
export function parseUtilityDocument(text: string, fileName: string = ''): Partial<SmartExtractedDocument> {
  const textUpper = text.toUpperCase();
  let favorecidoNome = 'Concessionária de Serviços Públicos';
  let favorecidoCnpjCpf = '';

  if (textUpper.includes('ENEL')) {
    favorecidoNome = 'ENEL DISTRIBUIÇÃO';
  } else if (textUpper.includes('CPFL')) {
    favorecidoNome = 'CPFL ENERGIA';
  } else if (textUpper.includes('CEMIG')) {
    favorecidoNome = 'CEMIG DISTRIBUIÇÃO S.A.';
  } else if (textUpper.includes('LIGHT')) {
    favorecidoNome = 'LIGHT SERVIÇOS DE ELETRICIDADE S.A.';
  } else if (textUpper.includes('SABESP')) {
    favorecidoNome = 'CIA DE SANEAMENTO BÁSICO DO ESTADO DE SÃO PAULO - SABESP';
  } else if (textUpper.includes('COPASA')) {
    favorecidoNome = 'COPASA - COMPANHIA DE SANEAMENTO DE MINAS GERAIS';
  } else if (textUpper.includes('SANEPAR')) {
    favorecidoNome = 'SANEPAR - CIA DE SANEAMENTO DO PARANÁ';
  } else if (textUpper.includes('VIVO') || textUpper.includes('TELEFONICA')) {
    favorecidoNome = 'TELEFÔNICA BRASIL S.A. (VIVO)';
  } else if (textUpper.includes('CLARO')) {
    favorecidoNome = 'CLARO S.A.';
  } else if (textUpper.includes('TIM')) {
    favorecidoNome = 'TIM S.A.';
  } else if (textUpper.includes('COMGAS')) {
    favorecidoNome = 'COMGÁS - CIA DE GÁS DE SÃO PAULO';
  }

  let valor = 0;
  let dataVencimento = '';
  let linhaDigitavel = '';
  let numeroConta = '';

  // 1. Linha 48 dígitos iniciada por 846 / 848 / 8...
  const linhaMatch = text.match(/(8[0-9\s.-]{47,60})/i);
  if (linhaMatch) {
    linhaDigitavel = linhaMatch[1].replace(/\D/g, '');
  }

  // 2. Número da Conta / Instalação / Matrícula
  const contaMatch = text.match(/(?:Instala[cç][aã]o|N[oº°]\s+do\s+Cliente|C[oó]digo\s+do\s+Cliente|Conta\s+Contrato|Matr[ií]cula)\s*[:\s\r\n]*(\d{5,20})/i);
  if (contaMatch) numeroConta = contaMatch[1].trim();

  // 3. Valor
  const valMatch = text.match(/(?:Total\s+a\s+Pagar|Valor\s+Total|Valor\s+a\s+Pagar|Valor\s*\(R\$\))\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i);
  if (valMatch) valor = parseNumBR(valMatch[1]);

  // 4. Vencimento
  const vencMatch = text.match(/(?:Data\s+de\s+Vencimento|Vencimento|Vencimento\s*:\s*)\s*[:\s\r\n]*(\d{2}[/.-]\d{2}[/.-]\d{4})/i);
  if (vencMatch) dataVencimento = parseDateBR(vencMatch[1]);

  return {
    docCategory: 'concessionarias',
    detectedCategory: 'concessionarias',
    favorecidoNome,
    favorecidoCnpjCpf,
    valor,
    valorOriginal: valor,
    valorCobrado: valor,
    dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
    seuNumero: numeroConta || `FAT-${fileName.replace(/\.pdf$/i, '')}`,
    bancoCodigo: '846',
    bancoNome: 'Concessionária / Utilidades Públicas',
    tipoBoleto: 'concessionaria',
    linhaDigitavel,
    codigoBarras: linhaDigitavel,
    confidence: 0.94,
  };
}
