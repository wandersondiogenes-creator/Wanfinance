import { getBankInfo } from './banks';

export interface ParsedBoletoInfo {
  linhaDigitavelLimpa: string;
  codigoBarras: string;
  bancoCodigo: string;
  bancoNome: string;
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
  isValid: boolean;
  tipo: 'titulo_bancario' | 'concessionaria' | 'desconhecido';
  errorMessage?: string;
}

/**
 * Remove any non-numeric characters from string
 */
export function onlyNumbers(text: string): string {
  return text.replace(/\D/g, '');
}

/**
 * Converts a 47-digit Linha Digitável (Boleto Bancário / Título de Cobrança)
 * or 48-digit (Concessionária / Convenio) into a 44-digit Código de Barras.
 */
export function linhaDigitavelToCodigoBarras(linhaDigitavel: string): { codigoBarras: string; tipo: 'titulo_bancario' | 'concessionaria' | 'desconhecido' } {
  const limpa = onlyNumbers(linhaDigitavel);

  if (limpa.length === 47) {
    // Boleto Bancário (Título): 47 dígitos
    const banco = limpa.substring(0, 3);
    const moeda = limpa.substring(3, 4);
    const campo1 = limpa.substring(4, 9);
    const campo2 = limpa.substring(10, 20);
    const campo3 = limpa.substring(21, 31);
    const dvGeral = limpa.substring(32, 33);
    const fatorVencimento = limpa.substring(33, 37);
    const valor = limpa.substring(37, 47);

    const codigoBarras = `${banco}${moeda}${dvGeral}${fatorVencimento}${valor}${campo1}${campo2}${campo3}`;
    return { codigoBarras, tipo: 'titulo_bancario' };
  }

  if (limpa.length === 48) {
    // Boleto Concessionária/Arrecadação/Tributo/GNRE (48 dígitos)
    // 4 blocos de 12 dígitos, cada um com 11 dígitos de dados + 1 DV
    const bloco1 = limpa.substring(0, 11);
    const bloco2 = limpa.substring(12, 23);
    const bloco3 = limpa.substring(24, 35);
    const bloco4 = limpa.substring(36, 47);

    const codigoBarras = `${bloco1}${bloco2}${bloco3}${bloco4}`;
    return { codigoBarras, tipo: 'concessionaria' };
  }

  if (limpa.length === 44) {
    if (limpa.startsWith('8')) {
      return { codigoBarras: limpa, tipo: 'concessionaria' };
    }
    return { codigoBarras: limpa, tipo: 'titulo_bancario' };
  }

  return { codigoBarras: limpa, tipo: 'desconhecido' };
}

/**
 * Calculates due date from Fator de Vencimento (4 digits)
 * Handles FEBRABAN 1st cycle (Base 07/10/1997) and 2nd cycle (Fator 1000 on 22/02/2025 => Base 29/05/2022)
 */
export function parseFatorVencimento(fatorStr: string): string {
  const fator = parseInt(fatorStr, 10);
  if (isNaN(fator) || fator <= 0) {
    return ''; // Sem vencimento fixo / a vista
  }

  // Se o fator for menor que 1000, não é um fator de vencimento válido
  if (fator < 1000) {
    return '';
  }

  // FEBRABAN: Fator 1000 a 9999
  // Para ano corrente >= 2025 e fatores típicos de 2025+ (1000 a ~3000), o fator está no 2º ciclo (iniciado em 22/02/2025 = Fator 1000).
  // Data base do 2º ciclo: 29/05/2022 (UTC)
  let baseDate: Date;
  const currentYear = new Date().getFullYear();

  if (currentYear >= 2025 && fator <= 3500) {
    // 2º ciclo FEBRABAN: Base 29 de Maio de 2022
    baseDate = new Date(Date.UTC(2022, 4, 29)); // Mês 4 é Maio em JS
  } else {
    // 1º ciclo FEBRABAN: Base 07 de Outubro de 1997
    baseDate = new Date(Date.UTC(1997, 9, 7)); // Mês 9 é Outubro em JS
  }

  const dueDate = new Date(baseDate.getTime() + fator * 24 * 60 * 60 * 1000);

  // Format as YYYY-MM-DD
  const year = dueDate.getUTCFullYear();
  const month = String(dueDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dueDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Extracts numeric value in Reais (R$) from the 10-digit value field
 */
export function parseValor(valorStr: string): number {
  const num = parseInt(valorStr, 10);
  if (isNaN(num)) return 0;
  return num / 100;
}

/**
 * Full parsing function for any user input Linha Digitável or Barcode
 */
export function parseLinhaDigitavel(input: string): ParsedBoletoInfo {
  const limpa = onlyNumbers(input);

  if (!limpa) {
    return {
      linhaDigitavelLimpa: '',
      codigoBarras: '',
      bancoCodigo: '000',
      bancoNome: 'Banco Não Identificado',
      valor: 0,
      dataVencimento: '',
      isValid: false,
      tipo: 'desconhecido',
      errorMessage: 'Linha digitável vazia',
    };
  }

  if (limpa.length !== 47 && limpa.length !== 48 && limpa.length !== 44) {
    return {
      linhaDigitavelLimpa: limpa,
      codigoBarras: limpa,
      bancoCodigo: limpa.substring(0, 3) || '000',
      bancoNome: getBankInfo(limpa.substring(0, 3)).shortName,
      valor: 0,
      dataVencimento: '',
      isValid: false,
      tipo: 'desconhecido',
      errorMessage: `Linha digitável deve ter 47 dígitos (Boleto Bancário) ou 48 dígitos (Concessionária). Recebido: ${limpa.length} dígitos.`,
    };
  }

  const { codigoBarras, tipo } = linhaDigitavelToCodigoBarras(limpa);

  if (tipo === 'titulo_bancario') {
    const bancoCodigo = limpa.substring(0, 3);
    const bankInfo = getBankInfo(bancoCodigo);
    const fatorVencimento = limpa.substring(33, 37);
    const valorRaw = limpa.substring(37, 47);

    const dataVencimento = parseFatorVencimento(fatorVencimento);
    const valor = parseValor(valorRaw);

    return {
      linhaDigitavelLimpa: limpa,
      codigoBarras,
      bancoCodigo,
      bancoNome: bankInfo.shortName,
      valor,
      dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
      isValid: true,
      tipo,
    };
  }

  if (tipo === 'concessionaria') {
    // Boleto Concessionária / Tributo / GNRE (48 dígitos na linha digitável, 44 dígitos no código de barras)
    // No código de barras (44 dígitos), o valor fica exatamente nas posições 5 a 15 (índices 4 a 15)
    const valorRaw = codigoBarras.length >= 15 ? codigoBarras.substring(4, 15) : '0';
    const valor = parseValor(valorRaw);

    // Identificação do Segmento / Órgão / GNRE
    // Pos 2 do código de barras: 1=Prefeituras, 2=Saneamento, 3=Energia, 4=Telecom, 5=Órgão Gov/Tributos, 8=GNRE/Tributos Estaduais
    const subSegmento = codigoBarras.substring(1, 2);
    const isGNRE = subSegmento === '8' || subSegmento === '5' || limpa.startsWith('858') || limpa.startsWith('85');
    const isDARF = limpa.startsWith('856') || (subSegmento === '5' && !isGNRE);

    let bancoCodigo = '800';
    let bancoNome = 'Concessionária / Tributo';

    if (isGNRE) {
      bancoCodigo = '858';
      bancoNome = 'GNRE - Guia Nacional de Recolhimento';
    } else if (isDARF) {
      bancoCodigo = '856';
      bancoNome = 'DARF / Tributo Federal';
    }

    // Tentar extrair data de vencimento se disponível no código de barras (YYYYMMDD em posições 18-26 ou 19-27)
    let dataVencimento = '';
    const cand1 = codigoBarras.substring(18, 26);
    const cand2 = codigoBarras.substring(19, 27);
    for (const cand of [cand1, cand2]) {
      if (/^\d{8}$/.test(cand)) {
        const y = parseInt(cand.substring(0, 4), 10);
        const m = parseInt(cand.substring(4, 6), 10);
        const d = parseInt(cand.substring(6, 8), 10);
        if (y >= 2020 && y <= 2035 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          dataVencimento = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          break;
        }
      }
    }

    return {
      linhaDigitavelLimpa: limpa,
      codigoBarras,
      bancoCodigo,
      bancoNome,
      valor,
      dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
      isValid: true,
      tipo,
    };
  }

  return {
    linhaDigitavelLimpa: limpa,
    codigoBarras,
    bancoCodigo: '000',
    bancoNome: 'Desconhecido',
    valor: 0,
    dataVencimento: '',
    isValid: false,
    tipo: 'desconhecido',
  };
}

/**
 * Formats a clean 47-digit Linha Digitável into standard display format:
 * 00190.00009 01234.567004 00001.234567 8 85000000012345
 */
export function formatLinhaDigitavelDisplay(linha: string): string {
  const limpa = onlyNumbers(linha);
  if (limpa.length === 47) {
    return `${limpa.slice(0, 5)}.${limpa.slice(5, 10)} ${limpa.slice(10, 15)}.${limpa.slice(15, 21)} ${limpa.slice(21, 26)}.${limpa.slice(26, 32)} ${limpa.slice(32, 33)} ${limpa.slice(33)}`;
  }
  if (limpa.length === 48) {
    return `${limpa.slice(0, 12)} ${limpa.slice(12, 24)} ${limpa.slice(24, 36)} ${limpa.slice(36, 48)}`;
  }
  return linha;
}

/**
 * Formats currency to BRL (R$ 1.234,56)
 */
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formats date from YYYY-MM-DD to DD/MM/YYYY
 */
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '--/--/----';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Converts date string YYYY-MM-DD or DD/MM/YYYY to DDMMAAAA (8 digits) for CNAB
 */
export function dateToCNAB(dateStr: string): string {
  if (!dateStr) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear());
    return `${day}${month}${year}`;
  }

  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-');
    return `${d.padStart(2, '0')}${m.padStart(2, '0')}${y}`;
  }

  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/');
    return `${d.padStart(2, '0')}${m.padStart(2, '0')}${y}`;
  }

  return dateStr.replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
}
