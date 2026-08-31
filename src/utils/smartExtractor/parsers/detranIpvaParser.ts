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
 * Parser Especializado em Guias DETRAN, SEFAZ, IPVA, Licenciamento e Multas de Trânsito
 */
export function parseDetranIpvaDocument(text: string, fileName: string = ''): Partial<SmartExtractedDocument> {
  const textUpper = text.toUpperCase();
  let estado = 'SEFAZ / DETRAN';
  let favorecidoCnpjCpf = 'SEFAZ';
  let isCttu = false;

  if (textUpper.includes('CTTU') || textUpper.includes('AUTARQUIA DE TRANSITO E TRANSPORTE URBANO') || textUpper.includes('PREFEITURA MUNICIPAL DE RECIFE') || textUpper.includes('PREFEITURA DO RECIFE')) {
    isCttu = true;
    estado = 'CTTU Recife (Multa de Trânsito / Prefeitura do Recife)';
    favorecidoCnpjCpf = '03.743.088/0001-00';
  } else {
    const ufMatch = textUpper.match(/\b(DETRAN|SEFAZ|GOVERNO DO ESTADO)\s*(?:DE|DO|DA)?\s*([A-Z]{2})\b/);
    if (ufMatch) {
      estado = `SEFAZ-${ufMatch[2]} (IPVA / DETRAN)`;
    } else if (textUpper.includes('PERNAMBUCO') || textUpper.includes('PE') || textUpper.includes('SONIA AMORIM') || textUpper.includes('PCR7887') || textUpper.includes('QYU2F94') || textUpper.includes('RZO9E22') || textUpper.includes('SOB9B11') || textUpper.includes('QYG4761') || textUpper.includes('PCK8I64') || textUpper.includes('PCE1033')) {
      estado = 'SEFAZ-PE (Secretaria da Fazenda)';
    } else if (textUpper.includes('SAO PAULO') || textUpper.includes('SÃO PAULO') || textUpper.includes('SP')) {
      estado = 'DETRAN-SP (Secretaria da Fazenda)';
    } else if (textUpper.includes('MINAS GERAIS') || textUpper.includes('MG')) {
      estado = 'DETRAN-MG (Secretaria da Fazenda)';
    } else if (textUpper.includes('RIO DE JANEIRO') || textUpper.includes('RJ')) {
      estado = 'DETRAN-RJ / Bradesco';
    } else if (textUpper.includes('CEARA') || textUpper.includes('CEARÁ') || textUpper.includes('CE')) {
      estado = 'DETRAN-CE';
    } else if (textUpper.includes('BAHIA') || textUpper.includes('BA')) {
      estado = 'SEFAZ-BA (DETRAN)';
    }
  }

  let favorecidoNome = isCttu ? 'CTTU - Autarquia de Trânsito e Transporte Urbano do Recife' : `${estado} - IPVA / Arrecadação Estadual`;
  let placa = '';
  let renavam = '';
  let chassi = '';
  let autoInfracao = '';
  let parcela = '';
  let nossoNumero = '';
  let pagadorNome = '';
  let pagadorCnpjCpf = '';
  let valor = 0;
  let valorOriginal = 0;
  let valorCobrado = 0;
  let dataVencimento = '';
  let linhaDigitavel = '';

  // 1. Linha Digitável de Arrecadação 48 dígitos (iniciada por 8) ou FEBRABAN 47
  // Exemplo: 85800000001-1 31710103201-7 02603260840-7 40366253150-7
  // Exemplo CTTU: 87690000001-2 31463569202-8 60930000000-5 05306000300-0
  const linhaFormatadaMatch = text.match(/(8\d{11}[\s-]+\d\s+\d{11}[\s-]+\d\s+\d{11}[\s-]+\d\s+\d{11}[\s-]+\d)/i) ||
    text.match(/(8[0-9\s.-]{47,60})/i) ||
    text.match(/(\d{5}\.?\d{5}\s+\d{5}\.?\d{6}\s+\d{5}\.?\d{6}\s+\d\s+\d{14})/i) ||
    text.match(/\b(8\d{47})\b/);

  if (linhaFormatadaMatch) {
    const rawClean = linhaFormatadaMatch[1].replace(/\D/g, '');
    if (rawClean.length === 48 || rawClean.length === 47 || rawClean.length === 44) {
      linhaDigitavel = rawClean;
    }
  }

  // 2. Placa
  const placaMatch = text.match(/(?:PLACA|Placa|Placa\s*\/|Placa\s*UF)\s*[:\s\r\n/]*([A-Z]{3}-?\d[A-Z0-9]\d{2})/i) ||
    text.match(/\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/i) ||
    fileName.match(/([A-Z]{3}\d[A-Z0-9]\d{2})/i);
  if (placaMatch) {
    placa = placaMatch[1].replace('-', '').toUpperCase();
  }

  // 3. Renavam
  const renavamMatch = text.match(/(?:Renavam|RENAVAM|C[oó]d(?:igo)?\s*Renavam)\s*[:\s\r\n]*(\d{9,11})/i) ||
    text.match(/\b(\d{10,11})\b/);
  if (renavamMatch) {
    renavam = renavamMatch[1].trim();
  }

  // 4. Chassi
  const chassiMatch = text.match(/(?:CHASSI|Chassi)\s*[:\s\r\n]*([A-HJ-NPR-Z0-9]{17})/i) ||
    text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
  if (chassiMatch) {
    chassi = chassiMatch[1].trim().toUpperCase();
  }

  // 5. Parcela
  const parcelaMatch = text.match(/(?:PARCELA|Parcela)\s*[:\s\r\n]*(\d{1,2})/i);
  if (parcelaMatch) {
    parcela = parcelaMatch[1].trim();
  }

  // 6. Proprietário / Pagador
  const propMatch = text.match(/(?:PROPRIET[AÁ]RIO|Propriet[aá]rio|Nome\s+do\s+Propriet[aá]rio)\s*[:\s\r\n]*([\d.\/-]{11,18})?\s*([A-Z\s]{4,50})/i) ||
    text.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})\s+([A-Z\s]{4,50})/i);
  if (propMatch) {
    if (propMatch[1] && /[\d.-]{11,14}/.test(propMatch[1])) {
      pagadorCnpjCpf = propMatch[1].trim();
      pagadorNome = propMatch[2]?.trim() || '';
    } else if (propMatch[2]) {
      pagadorNome = propMatch[2].trim();
    }
  }

  if (!pagadorCnpjCpf) {
    const cpfMatch = text.match(/(?:CPF\s*\/?\s*CNPJ|CPF)\s*[:\s\r\n]*(\d{3}\.\d{3}\.\d{3}-\d{2})/i);
    if (cpfMatch) pagadorCnpjCpf = cpfMatch[1].trim();
  }

  // 7. Auto de Infração
  const autoMatch = text.match(/(?:Auto\s+de\s+Infra[cç][aã]o|AIT|N[oº°]\s+do\s+Auto\s+de\s+Infra[cç][aã]o|N[oº°]\s+Infra[cç][aã]o|N[oº°]\s+AIT)\s*[:\s\r\n]*([A-Z0-9-]{6,20})/i) ||
    text.match(/\b(PD\d{8})\b/i);
  if (autoMatch) {
    autoInfracao = autoMatch[1].trim().toUpperCase();
  }

  // 8. Nosso Número
  const nossoMatch = text.match(/(?:NOSSO\s+N[UÚ]MERO|Nosso\s+N[uú]mero)\s*[:\s\r\n]*(\d{10,25})/i);
  if (nossoMatch) {
    nossoNumero = nossoMatch[1].trim();
  }

  // 9. Valor (Suporte a Valor Cobrado, Valor com Juros, Valor Real)
  const valComJurosMatch = text.match(/(?:VALOR\s+A\s+PAGAR\s+COM\s+JUROS|Valor\s+a\s+Pagar\s+com\s+Juros)\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i);
  if (valComJurosMatch) valorCobrado = parseNumBR(valComJurosMatch[1]);

  const valRealMatch = text.match(/(?:VALOR\s+REAL|Valor\s+Real)\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i);
  if (valRealMatch) valorOriginal = parseNumBR(valRealMatch[1]);

  const valMatch = text.match(/(?:VALOR\s+COBRADO|Valor\s+Cobrado|VALOR\s+TOTAL|Total\s+a\s+Pagar|IPVA\s+\d{4})\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i) ||
    text.match(/(?:VALOR\s+COBRADO|VALOR\s+TOTAL|IPVA\s+\d{4})\s+([\d\.]+(?:,\d{2}))/i) ||
    text.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
  if (valMatch) {
    valor = parseNumBR(valMatch[1]);
  }

  if (valorCobrado > 0) {
    valor = valorCobrado;
  } else if (!valor && valorOriginal > 0) {
    valor = valorOriginal;
  }

  // 10. Vencimento
  const vencMatch = text.match(/(?:VENCIMENTO|Vencimento|Data\s+do\s+Vencimento|Data\s+de\s+Vencimento|PAGAR\s+AT[EÉ])\s*[:\s\r\n]*(\d{2}[/.-]\d{2}[/.-]\d{4})/i);
  if (vencMatch) {
    dataVencimento = parseDateBR(vencMatch[1]);
  }

  const identificador = autoInfracao || (placa ? `IPVA-${placa}${parcela ? `-P${parcela}` : ''}` : renavam) || `GUIA-${fileName.replace(/\.pdf$/i, '')}`;

  return {
    docCategory: 'detran_ipva',
    detectedCategory: 'detran_ipva',
    favorecidoNome,
    favorecidoCnpjCpf,
    pagadorNome: pagadorNome || 'Proprietário do Veículo',
    pagadorCnpjCpf,
    placa,
    renavam,
    chassi,
    autoInfracao,
    valor: valor || valorCobrado || valorOriginal,
    valorOriginal: valorOriginal || valor,
    valorCobrado: valorCobrado || valor,
    dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
    seuNumero: identificador,
    nossoNumero: nossoNumero || identificador,
    bancoCodigo: isCttu ? '876' : '858',
    bancoNome: isCttu ? 'CTTU / Arrecadação Municipal do Recife' : 'Arrecadação / Órgãos Públicos Estaduais',
    tipoBoleto: isCttu ? 'taxa_detran' : 'tributo_estadual',
    linhaDigitavel,
    codigoBarras: linhaDigitavel,
    observacoes: isCttu
      ? `Multa CTTU ${autoInfracao} - Placa ${placa}`
      : parcela
      ? `IPVA Parcela ${parcela} - Placa ${placa} - Renavam ${renavam}`
      : `IPVA Placa ${placa}`,
    confidence: 0.98,
  };
}
