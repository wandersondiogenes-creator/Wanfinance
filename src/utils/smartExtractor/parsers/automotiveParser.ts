import { SmartExtractedDocument } from '../smartDocTypes';
import { validateExtractedDocument } from '../smartValidator';
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
 * Parser Especializado em Boletos de Montadoras, Concessionárias e FIDCs Automotivos
 */
export function parseAutomotiveDocument(text: string, fileName: string = ''): Partial<SmartExtractedDocument> {
  const textUpper = text.toUpperCase();
  let brand = 'Montadora / FIDC Automotivo';
  let favorecidoNome = 'Beneficiário Automotivo';
  let favorecidoCnpjCpf = '';
  let pagadorNome = '';
  let pagadorCnpjCpf = '';
  let bancoCodigo = '237';
  let bancoNome = 'Banco Bradesco S.A.';
  let chassi = '';
  let compromisso = '';
  let nossoNumero = '';
  let valor = 0;
  let dataVencimento = '';
  let linhaDigitavel = '';

  // Identificação da Montadora / Emissor
  if (textUpper.includes('FIDC VITA AUTO') || textUpper.includes('VITA AUTO') || textUpper.includes('050.095.909/0001-49') || (textUpper.includes('FIAT') && (textUpper.includes('02856-COBFLEX') || textUpper.includes('BETIM')))) {
    brand = 'FIAT (FIDC Vita Auto)';
    favorecidoNome = 'FIDC VITA AUTO (FIAT)';
    favorecidoCnpjCpf = '050.095.909/0001-49';
    bancoCodigo = '237';
    bancoNome = 'Banco Bradesco S.A.';
    pagadorNome = 'VIA SUL VEICULOS S/A';
    pagadorCnpjCpf = '040.841.736/0002-98';
  } else if (textUpper.includes('LEAPMOTOR') || textUpper.includes('LEAP MOTOR') || textUpper.includes('STELLANTIS')) {
    brand = 'LEAPMOTOR (Stellantis)';
    favorecidoNome = 'BANCO FIDIS S/A - LEAPMOTOR / STELLANTIS';
    favorecidoCnpjCpf = '062.237.425/0001-76';
    bancoCodigo = '237';
    bancoNome = 'Banco Bradesco S.A.';
  } else if (textUpper.includes('GEELY') || textUpper.includes('VOLVO')) {
    brand = 'GEELY / VOLVO';
    favorecidoNome = 'GEELY AUTO DO BRASIL LTDA';
    bancoCodigo = '033';
    bancoNome = 'Banco Santander (Brasil) S.A.';
  } else if (textUpper.includes('OMODA') || textUpper.includes('JAECOO') || textUpper.includes('CHERY')) {
    brand = 'OMODA & JAECOO (Chery)';
    favorecidoNome = 'SANTANDER VEICULOS - OMODA & JAECOO';
    favorecidoCnpjCpf = '21.126.275/0001-46';
    bancoCodigo = '033';
    bancoNome = 'Banco Santander (Brasil) S.A.';
  } else if (textUpper.includes('BANCO FIDIS') || textUpper.includes('062.237.425/0001-76') || textUpper.includes('02011-COBFLEX')) {
    brand = 'JEEP / FIAT (Banco Fidis)';
    favorecidoNome = 'BANCO FIDIS S/A.';
    favorecidoCnpjCpf = '062.237.425/0001-76';
    bancoCodigo = '237';
    bancoNome = 'Banco Bradesco S.A.';
  } else if (textUpper.includes('FIDC COMPLEMENTAR AUTO FORD') || textUpper.includes('FIDC AUTO FORD') || textUpper.includes('043.489.824/0001-80') || textUpper.includes('GRANVIA')) {
    brand = 'FORD (FIDC Complementar Auto Ford)';
    favorecidoNome = 'FIDC COMPLEMENTAR AUTO FORD';
    favorecidoCnpjCpf = '043.489.824/0001-80';
    bancoCodigo = '237';
    bancoNome = 'Banco Bradesco S.A.';
  } else if (textUpper.includes('BYD AUTO') || textUpper.includes('50.351.104/0001-19') || textUpper.includes('0339905481')) {
    brand = 'BYD Auto do Brasil';
    favorecidoNome = 'BYD AUTO DO BRASIL LTDA';
    favorecidoCnpjCpf = '50.351.104/0001-19';
    bancoCodigo = '033';
    bancoNome = 'Banco Santander (Brasil) S.A.';
  } else if (textUpper.includes('BYD DO BRASIL') || textUpper.includes('17.140.820/0007-77') || textUpper.includes('0339901241')) {
    brand = 'BYD do Brasil';
    favorecidoNome = 'BYD DO BRASIL LTDA';
    favorecidoCnpjCpf = '17.140.820/0007-77';
    bancoCodigo = '033';
    bancoNome = 'Banco Santander (Brasil) S.A.';
  } else if (textUpper.includes('BAJAJ') || textUpper.includes('45.859.932/0001-22') || textUpper.includes('J.P. MORGAN')) {
    brand = 'BAJAJ do Brasil';
    favorecidoNome = 'BAJAJ DO BRASIL COMERCIO DE MOTOCICLETAS LTDA';
    favorecidoCnpjCpf = '45.859.932/0001-22';
    bancoCodigo = '376';
    bancoNome = 'Banco J.P. Morgan S.A.';
  } else if (textUpper.includes('VENDA DE VEICULOS FUNDO') || textUpper.includes('21.126.275/0001-46') || textUpper.includes('RENAULT')) {
    brand = 'RENAULT (FIDC Veículos)';
    favorecidoNome = 'VENDA DE VEÍCULOS FUNDO DE INVESTIMENTO EM DIREITOS CREDITÓRIOS';
    favorecidoCnpjCpf = '21.126.275/0001-46';
    bancoCodigo = '033';
    bancoNome = 'Banco Santander (Brasil) S.A.';
  } else if (textUpper.includes('NEWVIA')) {
    brand = 'NEWVIA Veículos';
    favorecidoNome = 'NEWVIA COMERCIO DE VEICULOS LTDA';
  } else if (textUpper.includes('TOYOTA')) {
    brand = 'TOYOTA';
    favorecidoNome = 'BANCO TOYOTA DO BRASIL S.A.';
  } else if (textUpper.includes('VOLKSWAGEN')) {
    brand = 'VOLKSWAGEN';
    favorecidoNome = 'BANCO VOLKSWAGEN S.A.';
  } else if (textUpper.includes('HYUNDAI')) {
    brand = 'HYUNDAI';
    favorecidoNome = 'BANCO HYUNDAI CAPITAL BRASIL S.A.';
  } else if (textUpper.includes('GENERAL MOTORS') || textUpper.includes('CHEVROLET')) {
    brand = 'GM / CHEVROLET';
    favorecidoNome = 'BANCO GM S.A.';
  }

  // 1. Extração da Linha Digitável Real se presente no texto
  const linhaMatch = text.match(/(0339[0-9\s.-]{40,60})/i) ||
    text.match(/(2379[0-9\s.-]{40,60})/i) ||
    text.match(/(3419[0-9\s.-]{40,60})/i) ||
    text.match(/(376[0-9\s.-]{40,60})/i) ||
    text.match(/(0019[0-9\s.-]{40,60})/i) ||
    text.match(/(1049[0-9\s.-]{40,60})/i) ||
    text.match(/(\d{5}\.?\d{5}\s+\d{5}\.?\d{6}\s+\d{5}\.?\d{6}\s+\d\s+\d{14})/i) ||
    text.match(/(\d{5}\.?\d{5}\s+\d{5}\.?\d{6}\s+\d{5}\.?\d{6}\s+\d\s+\d{10})/i);

  if (linhaMatch) {
    const rawClean = linhaMatch[1].replace(/\D/g, '');
    if (rawClean.length === 47) {
      linhaDigitavel = rawClean;
      bancoCodigo = rawClean.substring(0, 3);
      bancoNome = getBankInfo(bancoCodigo).name;
    }
  }

  // 2. Extração via Tabela de Compromisso / Relação ao Caixa
  const tableRowMatch = text.match(/(?:Compromisso|COMPROMISSO)[^\r\n]*\r?\n\s*(\d{6,20})\s+(\d{2}[/.-]\d{2}[/.-]\d{4})\s+(\d{2}[/.-]\d{2}[/.-]\d{4})\s+([\d\.]+(?:,\d{2}))\s+(\d{8,25})\s+(\d+)\s+([A-Z0-9]{5,17})/i) ||
    text.match(/(\d{6,20})\s+(\d{2}[/.-]\d{2}[/.-]\d{4})\s+(\d{2}[/.-]\d{2}[/.-]\d{4})\s+([\d\.]+(?:,\d{2}))\s+(\d{8,25})\s+(\d+)\s+([A-Z0-9]{17})/i) ||
    text.match(/(?:Compromisso|COMPROMISSO)[^\r\n]*\r?\n\s*(\d{6,20})\s+(\d{2}[/.-]\d{2}[/.-]\d{4})\s+(\d{2}[/.-]\d{2}[/.-]\d{4})\s+([\d\.]+(?:,\d{2}))/i);

  if (tableRowMatch) {
    compromisso = tableRowMatch[1].trim();
    dataVencimento = parseDateBR(tableRowMatch[2]);
    valor = parseNumBR(tableRowMatch[4]);
    if (tableRowMatch[5]) nossoNumero = tableRowMatch[5].trim();
    if (tableRowMatch[7]) chassi = tableRowMatch[7].trim().toUpperCase();
  }

  // Extração de Valores Detalhados (Valor do Documento, Multa/Mora, Valor Cobrado)
  let valorOriginal = 0;
  let valorCobrado = 0;
  let jurosMulta = 0;

  const valDocMatch = text.match(/(?:Valor\s+do\s+Documento|\(=\)\s*Valor\s+do\s+Documento)\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i) ||
    text.match(/(?:Valor\s+Original)\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i);
  if (valDocMatch) valorOriginal = parseNumBR(valDocMatch[1]);

  const valCobradoMatch = text.match(/(?:Valor\s+Cobrado|\(=\)\s*Valor\s+Cobrado)\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i);
  if (valCobradoMatch) valorCobrado = parseNumBR(valCobradoMatch[1]);

  const multaMatch = text.match(/(?:\(\+\)\s*Mora\s*\/?\s*Multa|Mora\s*\/\s*Multa)\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i);
  if (multaMatch) jurosMulta = parseNumBR(multaMatch[1]);

  // Se valor cobrado existe, usamos como valor final
  if (valorCobrado > 0) {
    valor = valorCobrado;
  } else if (valorOriginal > 0) {
    valor = valorOriginal;
  }

  // Fallbacks para valores soltos
  if (!valor) {
    const valMatch = text.match(/(?:Valor\s*(?:Cobrado|Documento|Original)|Valor\s+do\s+Documento|Valor\s+Total|Valor\s*\(R\$\))\s*[:\s\r\n]*R?\$\s*([\d\.]+(?:,\d{2}))/i);
    if (valMatch) valor = parseNumBR(valMatch[1]);
  }

  if (!dataVencimento) {
    const vencMatch = text.match(/(?:Data\s+de\s+Vencimento|Vencimento)\s*[:\s\r\n]*(\d{2}[/.-]\d{2}[/.-]\d{4})/i);
    if (vencMatch) dataVencimento = parseDateBR(vencMatch[1]);
  }

  if (!compromisso) {
    const compMatch = text.match(/(?:Compromisso|N[oº°]\.?\s*(?:do\s*)?Documento|Número\s+do\s+Documento)\s*[:\s\r\n]*([A-Z0-9-]{5,20})/i);
    if (compMatch) compromisso = compMatch[1].trim();
  }

  if (!nossoNumero) {
    const nossoMatch = text.match(/(?:Nosso\s+N[uú]mero|NOSSO\s+N[UÚ]MERO)\s*[:\s\r\n]*(\d{6,25})/i);
    if (nossoMatch) nossoNumero = nossoMatch[1].trim();
  }

  if (!chassi) {
    const chassiMatch = text.match(/(?:Chassi|CHASSI)\s*[:\s\r\n]*([A-HJ-NPR-Z0-9]{7,17})/i) ||
      text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    if (chassiMatch) chassi = chassiMatch[1].trim().toUpperCase();
  }

  // Favorecido / Beneficiário CNPJ
  if (!favorecidoCnpjCpf) {
    const favCnpjMatch = text.match(/(?:Benefici[aá]rio|Cedente)[^\d]{1,40}(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i) ||
      text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (favCnpjMatch) favorecidoCnpjCpf = favCnpjMatch[1].trim();
  }

  // Pagador Extraction
  const pagCnpjMatch = text.match(/(?:Pagador|Sacado)[^\d]{1,40}(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i);
  if (pagCnpjMatch) pagadorCnpjCpf = pagCnpjMatch[1].trim();

  if (!pagadorNome) {
    const pagMatch = text.match(/(?:Pagador|Sacado)\s*[:\s\r\n]*([A-Z0-9\s.,/-]{4,50})(?:\s+\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})?/i);
    if (pagMatch && !pagMatch[1].includes('Não identificado')) {
      pagadorNome = pagMatch[1].trim();
    }
  }

  return {
    docCategory: 'montadora_fidc',
    detectedCategory: 'montadora_fidc',
    montadoraMarca: brand,
    favorecidoNome,
    favorecidoCnpjCpf,
    pagadorNome: pagadorNome || 'VIA SUL VEÍCULOS S/A',
    pagadorCnpjCpf,
    valor: valor || valorCobrado || valorOriginal,
    valorOriginal: valorOriginal || valor,
    valorCobrado: valorCobrado || valor,
    jurosMulta: jurosMulta || 0,
    dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
    seuNumero: compromisso || nossoNumero || `DOC-${fileName.replace(/\.pdf$/i, '')}`,
    nossoNumero: nossoNumero || compromisso,
    chassi,
    bancoCodigo,
    bancoNome,
    tipoBoleto: 'titulo_bancario',
    linhaDigitavel,
    codigoBarras: linhaDigitavel.replace(/\D/g, ''),
    layoutName: `Boleto Automotivo - ${brand}`,
    confidence: 0.98,
  };
}
