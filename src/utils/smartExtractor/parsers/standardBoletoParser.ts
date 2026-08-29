import { SmartExtractedDocument } from '../smartDocTypes';
import { getBankInfo } from '../../banks';

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
 * Parser de Boletos Bancários Tradicionais FEBRABAN
 */
export function parseStandardBoletoDocument(text: string, fileName: string = ''): Partial<SmartExtractedDocument> {
  let linhaDigitavel = '';
  let bancoCodigo = '001';
  let bancoNome = 'Banco do Brasil S.A.';
  let valor = 0;
  let dataVencimento = '';
  let favorecidoNome = 'Beneficiário / Cedente';
  let favorecidoCnpjCpf = '';
  let pagadorNome = '';
  let pagadorCnpjCpf = '';
  let seuNumero = '';
  let nossoNumero = '';

  // 1. Linha Digitável 47 dígitos
  const linhaMatch = text.match(/(\d{5}\.?\d{5}\s+\d{5}\.?\d{6}\s+\d{5}\.?\d{6}\s+\d\s+\d{14})/i) ||
    text.match(/(\d{5}\.?\d{5}\s+\d{5}\.?\d{6}\s+\d{5}\.?\d{6}\s+\d\s+\d{10})/i) ||
    text.match(/([0-9]{5}\.[0-9]{5}\s+[0-9]{5}\.[0-9]{6}\s+[0-9]{5}\.[0-9]{6}\s+[0-9]\s+[0-9]{14})/i);

  if (linhaMatch) {
    const rawClean = linhaMatch[1].replace(/\D/g, '');
    if (rawClean.length === 47) {
      linhaDigitavel = rawClean;
      bancoCodigo = rawClean.substring(0, 3);
      bancoNome = getBankInfo(bancoCodigo).name;

      // Extrai valor dos últimos 10 dígitos se presente
      const valStr = rawClean.substring(37);
      const valInt = parseInt(valStr, 10);
      if (valInt > 0) {
        valor = valInt / 100;
      }
    }
  }

  // 2. Extração do Favorecido & CNPJ
  const favCnpjMatch = text.match(/(?:Benefici[aá]rio|Cedente|Raz[aã]o\s+Social)[^\d]{1,40}(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i) ||
    text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  if (favCnpjMatch) {
    favorecidoCnpjCpf = favCnpjMatch[1].trim();
  }

  const favNomeMatch = text.match(/(?:Benefici[aá]rio|Cedente|Nome\s+do\s+Benefici[aá]rio)\s*[:\s\r\n]*([A-Z0-9\s.,/-]{5,60})/i);
  if (favNomeMatch && !favNomeMatch[1].includes('Não identificado')) {
    favorecidoNome = favNomeMatch[1].trim();
  }

  // 3. Pagador
  const pagNomeMatch = text.match(/(?:Pagador|Sacado)\s*[:\s\r\n]*([A-Z0-9\s.,/-]{5,60})/i);
  if (pagNomeMatch) {
    pagadorNome = pagNomeMatch[1].trim();
  }
  const pagCnpjMatch = text.match(/(?:Pagador|Sacado)[^\d]{1,40}(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i);
  if (pagCnpjMatch) {
    pagadorCnpjCpf = pagCnpjMatch[1].trim();
  }

  // 4. Valor Documento Fallback
  if (!valor || valor === 0) {
    const valMatch = text.match(/(?:Valor\s+do\s+Documento|Valor\s+Cobrado|Valor\s*\(R\$\))\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i);
    if (valMatch) valor = parseNumBR(valMatch[1]);
  }

  // 5. Vencimento Fallback
  if (!dataVencimento) {
    const vencMatch = text.match(/(?:Data\s+de\s+Vencimento|Vencimento)\s*[:\s\r\n]*(\d{2}[/.-]\d{2}[/.-]\d{4})/i);
    if (vencMatch) dataVencimento = parseDateBR(vencMatch[1]);
  }

  // 6. Número do Documento / Nosso Número
  const docMatch = text.match(/(?:N[oº°]\.?\s*(?:do\s*)?Documento|Número\s+do\s+Documento)\s*[:\s\r\n]*([\w\d\/\.-]{4,25})/i);
  if (docMatch) seuNumero = docMatch[1].trim();

  const nossoMatch = text.match(/(?:Nosso\s+N[uú]mero|NOSSO\s+N[UÚ]MERO)\s*[:\s\r\n]*([\w\d\/\.-]{4,25})/i);
  if (nossoMatch) nossoNumero = nossoMatch[1].trim();

  return {
    docCategory: 'boleto_bancario',
    detectedCategory: 'boleto_bancario',
    linhaDigitavel,
    codigoBarras: linhaDigitavel.replace(/\D/g, ''),
    favorecidoNome,
    favorecidoCnpjCpf,
    pagadorNome,
    pagadorCnpjCpf,
    valor,
    valorOriginal: valor,
    valorCobrado: valor,
    dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
    seuNumero: seuNumero || `DOC-${fileName.replace(/\.pdf$/i, '')}`,
    nossoNumero: nossoNumero || seuNumero,
    bancoCodigo,
    bancoNome,
    tipoBoleto: 'titulo_bancario',
    confidence: 0.95,
  };
}
