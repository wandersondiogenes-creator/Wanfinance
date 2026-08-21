import { getBankInfo } from './banks.js';
import { BoletoType } from '../types';

export interface ParsedBoletoInfo {
  linhaDigitavelLimpa: string;
  codigoBarras: string;
  bancoCodigo: string;
  bancoNome: string;
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
  isValid: boolean;
  tipo: BoletoType;
  tipoBoleto?: BoletoType;
  placa?: string;
  renavam?: string;
  autoInfracao?: string;
  descricaoDebito?: string;
  favorecidoNome?: string;
  errorMessage?: string;
}

export interface DetectedBoletoMetadata {
  tipoBoleto: BoletoType;
  favorecidoNome: string;
  favorecidoCnpjCpf?: string;
  pagador?: string;
  pagadorCnpjCpf?: string;
  bancoCodigo: string;
  bancoNome: string;
  placa?: string;
  renavam?: string;
  autoInfracao?: string;
  dataVencimento?: string;
  valor?: number;
  seuNumero?: string;
  nossoNumero?: string;
  observacoes?: string;
}

/**
 * Intelligent detector for Vehicle Taxes (IPVA), DETRAN Fees, Traffic Fines (CTTU/AMC/DETRAN),
 * Utility bills, and Tributos from raw document text.
 */
export function detectBoletoDetailsFromText(rawText: string, bancoNomeDefault: string = ''): DetectedBoletoMetadata {
  if (!rawText) {
    return {
      tipoBoleto: 'titulo_bancario',
      favorecidoNome: 'Beneficiário / Cedente',
      bancoCodigo: '000',
      bancoNome: bancoNomeDefault || 'Banco Não Identificado',
    };
  }

  const textUpper = rawText.toUpperCase();

  // 1. Placa extraction
  let placa = '';
  const placaMatch = rawText.match(/(?:PLACA|PLACA\/UF|VEÍCULO|VEICULO|PLACA\s+VEÍCULO|ORIGEM\/PLACA\s+VEÍCULO)\s*[:\s]*([A-Z]{3}[0-9][A-Z0-9][0-9]{2}|[A-Z]{3}-?[0-9]{4})/i);
  if (placaMatch) {
    placa = placaMatch[1].replace('-', '').toUpperCase();
  } else {
    // Try standalone Mercosul or Old Plate format
    const standalonePlaca = rawText.match(/\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2}|[A-Z]{3}-[0-9]{4})\b/g);
    if (standalonePlaca) {
      for (const cand of standalonePlaca) {
        const cleanCand = cand.replace('-', '').toUpperCase();
        if (!['BRL', 'BCO', 'CON', 'PDF', 'TXT', 'CPF', 'CNPJ', 'CTTU', 'SEFAZ', 'REAL', 'AUTO'].includes(cleanCand)) {
          placa = cleanCand;
          break;
        }
      }
    }
  }

  // 2. RENAVAM extraction
  let renavam = '';
  const renavamMatch = rawText.match(/(?:RENAVAM|CÓDIGO\s+RENAVAM|CODIGO\s+RENAVAM)\s*[:\s]*(\d{9,11})/i);
  if (renavamMatch) {
    renavam = renavamMatch[1].trim();
  }

  // 3. Auto de Infração extraction
  let autoInfracao = '';
  const autoMatch = rawText.match(/(?:Auto\s+de\s+Infração|Auto\s+Infração|Nº\s+do\s+Auto\s+de\s+Infração|Nº\s+Auto|Auto)\s*[:\s]*([\w\d/-]{5,25})/i);
  if (autoMatch) {
    autoInfracao = autoMatch[1].trim();
  } else {
    const standaloneAuto = rawText.match(/\b(PD\d{8}|V\d{9})\b/i);
    if (standaloneAuto) {
      autoInfracao = standaloneAuto[1].toUpperCase();
    }
  }

  // 4. Extracted Due Date (Vencimento)
  // CRITICAL RULE FOR GNRE / TRIBUTOS / GUIA DE ARRECADAÇÃO:
  // If "Documento Válido para pagamento", "Válido para pagamento até", or "Valido para pagamento" is present in the text,
  // THAT limit/validity date takes precedence as the official dataVencimento (due date) over the standard "Data de Vencimento" field.
  let dataVencimento = '';
  const validoPagamentoMatch = rawText.match(/(?:DOCUMENTO\s+VÁLIDO\s+PARA\s+PAGAMENTO|DOCUMENTO\s+VALIDO\s+PARA\s+PAGAMENTO|VÁLIDO\s+PARA\s+PAGAMENTO\s+ATÉ|VALIDO\s+PARA\s+PAGAMENTO\s+ATE|VÁLIDO\s+PARA\s+PAGAMENTO|VALIDO\s+PARA\s+PAGAMENTO)\s*[:\s\r\n]*(\d{2}[/-]\d{2}[/-]\d{4})/i);
  if (validoPagamentoMatch) {
    const [d, m, y] = validoPagamentoMatch[1].split(/[/-]/);
    dataVencimento = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  } else {
    const vencMatch = rawText.match(/(?:VENCIMENTO|DATA\s+DE\s+VENCIMENTO|DATA\s+VENCIMENTO|PAGAR\s+ATÉ|VALIDO\s+ATE)\s*[:\s]*(\d{2}[/-]\d{2}[/-]\d{4})/i);
    if (vencMatch) {
      const [d, m, y] = vencMatch[1].split(/[/-]/);
      dataVencimento = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else {
      // Search for dates near the Vencimento section/table row
      const vencIdx = rawText.search(/VENCIMENTO|Vencimento/i);
      if (vencIdx !== -1) {
        const textAfterVenc = rawText.substring(vencIdx);
        const nextDate = textAfterVenc.match(/\b(\d{2}[/-]\d{2}[/-]\d{4})\b/);
        if (nextDate) {
          const [d, m, y] = nextDate[1].split(/[/-]/);
          dataVencimento = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }
    }
  }

  // 5. Extracted Values (Valor Cobrado / Valor Documento / Valor Total)
  let valor: number | undefined;

  // Specific regex for Valor Documento or Valor Cobrado on same line / immediate token
  const valorDirectMatch = rawText.match(/(?:Valor\s+do\s+Documento|Valor\s+Documento|Valor\s+Cobrado|VALOR\s+DOCUMENTO|VALOR\s+COBRADO|VALOR\s+DO\s+DOCUMENTO|\(=\)\s*Valor\s+Cobrado|\(=\)\s*Valor\s+Documento)\s*[:\s]*R?\$?\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:,[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/i);
  if (valorDirectMatch) {
    const parsedVal = parseExtractedValor(valorDirectMatch[1]);
    if (parsedVal > 0) {
      valor = parsedVal;
    }
  }

  if (!valor) {
    const valorCobradoMatch = rawText.match(/(?:(?:1|6)\s*\([^)]*\)\s*Valor\s*(?:Cobrado|Documento)|(?:=\s*)?Valor\s+Cobrado|VALOR\s+COBRADO|(?:=\s*)?Valor\s+do\s+Documento|VALOR\s+DO\s+DOCUMENTO|Valor\s+Documento|VALOR\s+DOCUMENTO|Valor\s+a\s+[Pp]agar|VALOR\s+A\s+PAGAR|TOTAL\s+A\s+RECOLHER|TOTAL\s+A\s+PAGAR|VALOR\s+TOTAL(?:\s+A\s+RECOLHER)?|VALOR\s+PRINCIPAL|VALOR\s+COM\s+DESCONTO)\s*[:\s]*R?\$?\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:,[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/i);
    if (valorCobradoMatch) {
      const parsedVal = parseExtractedValor(valorCobradoMatch[1]);
      if (parsedVal > 0) {
        valor = parsedVal;
      }
    }
  }

  if (!valor) {
    // Check table-row format where "Valor documento" is at the end of the header row and number is at the end of next row
    const tableValorMatch = rawText.match(/(?:Valor\s+(?:do\s+)?Documento|Valor\s+Cobrado|\(=\)\s*Valor\s+documento)[^\r\n]*\r?\n[^\r\n]*?R?\$?\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:,[0-9]{2})|[0-9]+(?:\.[0-9]{2}))\s*$/im);
    if (tableValorMatch) {
      const parsedVal = parseExtractedValor(tableValorMatch[1]);
      if (parsedVal > 0) {
        valor = parsedVal;
      }
    }
  }

  if (!valor) {
    // Secondary fallback (e.g. Total or generic Valor if no main header matched)
    const fallbackValMatch = rawText.match(/(?:TOTAL|Valor\s+Original|VALOR)\s*[:\s]*R?\$?\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:,[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/i);
    if (fallbackValMatch) {
      const parsedVal = parseExtractedValor(fallbackValMatch[1]);
      if (parsedVal > 0) {
        valor = parsedVal;
      }
    }
  }

  // GNRE / Control Number / Nosso Numero / Numero do Documento / Compromisso
  let gnomeNum = '';
  let nossoNumero = '';

  // Extract Numero do Documento
  const numDocDirect = rawText.match(/(?:N[oº°]\.?\s*(?:do\s*)?Documento|Número\s+do\s+Documento|Nº\s+do\s+Documento|N[oº°]\.?\s*Doc)\s*[:\s\r\n]*([0-9]{4,25}[-\w]*)/i);
  if (numDocDirect && !/^(?:CPF|CNPJ|Vencimento|Valor|Data|Esp[ée]cie|Aceite)/i.test(numDocDirect[1])) {
    gnomeNum = numDocDirect[1].trim();
  } else {
    const tableHeaderNum = rawText.match(/(?:N[oº°]\.?\s*(?:do\s*)?Documento|Número\s+do\s+Documento)[^\r\n]*\r?\n\s*([0-9]{4,25})/i);
    if (tableHeaderNum) {
      gnomeNum = tableHeaderNum[1].trim();
    }
  }

  // Extract Nosso Número
  const nossoDirect = rawText.match(/(?:Nosso\s+N[úu]mero|NOSSO\s+N[ÚU]MERO|Nosso\s+Numero|Nosso\s+N[º°o]\.?|Cart\.\s*\/\s*Nosso\s+N[uú]mero)\s*[:\s\r\n]*([0-9]{4,25}(?:-[0-9A-Za-z]+)?)/i);
  if (nossoDirect && !/^(?:Data|Uso|Valor|Esp[ée]cie|Carteira|Aceite)/i.test(nossoDirect[1])) {
    nossoNumero = nossoDirect[1].trim();
  } else {
    const tableHeaderNosso = rawText.match(/Nosso\s+n[úu]mero[^\r\n]*\r?\n[^\r\n]*?([0-9]{4,25}(?:-[0-9A-Za-z]+)?)\s*$/im);
    if (tableHeaderNosso) {
      nossoNumero = tableHeaderNosso[1].trim();
    }
  }

  if (!gnomeNum && !nossoNumero) {
    const gnreCtrlMatch = rawText.match(/(?:N[oº°]\.?\s*de\s+Controle|Número\s+de\s+Controle|Nº\s+Documento\s+de\s+Origem|Doc\.\s*Origem|Protocolo|Compromisso)\s*[:\s\r\n]*([0-9\/\.-]{5,30})/i);
    if (gnreCtrlMatch && !/^(?:CPF|CNPJ|Vencimento|Valor|Data)/i.test(gnreCtrlMatch[1])) {
      gnomeNum = gnreCtrlMatch[1].trim();
    }
  }

  // Beneficiário & Pagador CNPJ/CPF and Name Extraction
  let favorecidoCnpjCpf = '';
  let pagador = '';
  let pagadorCnpjCpf = '';

  if (/BANCO\s+FIDIS/i.test(rawText) || rawText.includes('062.237.425/0001-76') || rawText.includes('062237425000176')) {
    favorecidoCnpjCpf = '062.237.425/0001-76';
  }
  if (/BAJAJ\s+DO\s+BRASIL/i.test(rawText) || /BAJAJ/i.test(rawText) || rawText.includes('45.859.932/0001-22') || rawText.includes('45859932000122')) {
    favorecidoCnpjCpf = '45.859.932/0001-22';
  }
  if (/FIDC\s+COMPLEMENTAR\s+AUTO\s+FORD/i.test(rawText) || /FIDC\s+AUTO\s+FORD/i.test(rawText) || rawText.includes('043.489.824/0001-80') || rawText.includes('043489824000180')) {
    favorecidoCnpjCpf = '043.489.824/0001-80';
  }
  if (/VENDA\s+DE\s+VE[IÍ]CULOS\s+FUNDO/i.test(rawText) || /FIDC\s+VENDA\s+DE\s+VE[IÍ]CULOS/i.test(rawText) || rawText.includes('21.126.275/0001-46') || rawText.includes('21126275000146')) {
    favorecidoCnpjCpf = '21.126.275/0001-46';
  }
  if (/BYD\s+AUTO/i.test(rawText) || rawText.includes('50.351.104/0001-19') || rawText.includes('50351104000119')) {
    favorecidoCnpjCpf = '50.351.104/0001-19';
  }
  if (/BYD\s+DO\s+BRASIL/i.test(rawText) || rawText.includes('17.140.820/0007-77') || rawText.includes('17140820000777')) {
    favorecidoCnpjCpf = '17.140.820/0007-77';
  }
  if (/NEWVIA\s+MOTOS/i.test(rawText) || rawText.includes('51.478.180/0003-14') || rawText.includes('51478180000314')) {
    pagador = 'NEWVIA MOTOS LTDA';
    pagadorCnpjCpf = '51.478.180/0003-14';
  }
  if (/GRANVIA\s+VEICULOS/i.test(rawText) || rawText.includes('012.946.886/0001-40') || rawText.includes('012946886000140')) {
    pagador = 'GRANVIA VEICULOS S/A';
    pagadorCnpjCpf = '012.946.886/0001-40';
  }
  if (/EUROVIA\s+VEICULOS/i.test(rawText) || rawText.includes('02.671.595') || rawText.includes('02671595')) {
    pagador = 'EUROVIA VEICULOS S.A.';
    const euroviaCnpj = rawText.match(/02\.671\.595\/\d{4}-\d{2}|02671595\d{6}/);
    if (euroviaCnpj) {
      const rawCnpj = euroviaCnpj[0].replace(/\D/g, '');
      if (rawCnpj.length === 14) {
        pagadorCnpjCpf = `${rawCnpj.slice(0, 2)}.${rawCnpj.slice(2, 5)}.${rawCnpj.slice(5, 8)}/${rawCnpj.slice(8, 12)}-${rawCnpj.slice(12, 14)}`;
      } else {
        pagadorCnpjCpf = euroviaCnpj[0];
      }
    }
  } else if (/EUROVIA\s+AUTO/i.test(rawText) || rawText.includes('60.933.323/0002-40') || rawText.includes('60933323000240')) {
    pagador = 'EUROVIA AUTO LTDA';
    pagadorCnpjCpf = '60.933.323/0002-40';
  }
  if (/VIA\s+SUL\s+AUTO/i.test(rawText) || rawText.includes('54.122.933/0001-80') || rawText.includes('54122933000180')) {
    pagador = 'VIA SUL AUTO LTDA';
    pagadorCnpjCpf = '54.122.933/0001-80';
  } else if (/VIA\s+SUL\s+VEICULOS/i.test(rawText) || rawText.includes('040.841.736') || rawText.includes('040841736')) {
    pagador = 'VIA SUL VEICULOS S/A';
    const viaSulCnpjMatch = rawText.match(/040\.841\.736\/\d{4}-\d{2}|040841736\d{6}/);
    if (viaSulCnpjMatch) {
      const rawC = viaSulCnpjMatch[0].replace(/\D/g, '');
      if (rawC.length === 14) {
        pagadorCnpjCpf = `${rawC.slice(0, 2)}.${rawC.slice(2, 5)}.${rawC.slice(5, 8)}/${rawC.slice(8, 12)}-${rawC.slice(12, 14)}`;
      } else {
        pagadorCnpjCpf = viaSulCnpjMatch[0];
      }
    } else {
      pagadorCnpjCpf = '040.841.736/0010-06';
    }
  }

  // Extract Pagador / Proprietário (including format: "168.356.034-53 EVALDO OLIVEIRA PIO")
  if (!pagadorCnpjCpf || !pagador) {
    const propDirectMatch = rawText.match(/(?:PROPRIET[AÁ]RIO|PROPRIETARIO)\s*[:\s\r\n]*(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+([A-ZÀ-Ú\s.]{3,60})/i);
    if (propDirectMatch) {
      if (!pagadorCnpjCpf) pagadorCnpjCpf = propDirectMatch[1].trim();
      if (!pagador) pagador = propDirectMatch[2].trim();
    }
  }

  // Extract Beneficiário CNPJ if not matched
  if (!favorecidoCnpjCpf) {
    const benCnpjMatch = rawText.match(/(?:Beneficiário|Beneficiario|Cedente|Razão\s+Social|Favorecido)[^]*?(?:CPF\/CNPJ|CNPJ|CPF|CNPJ\/MF|CPF\/MF)\s*[:\s]*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/i);
    if (benCnpjMatch) {
      favorecidoCnpjCpf = benCnpjMatch[1].trim();
    }
  }

  // Extract Pagador CNPJ if not matched
  if (!pagadorCnpjCpf) {
    const pagCnpjMatch = rawText.match(/(?:Pagador|Sacado|Devedor|Sacado\/Avalista)[^]*?(?:CPF\/CNPJ|CNPJ|CPF|CNPJ\/MF|CPF\/MF)\s*[:\s]*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/i);
    if (pagCnpjMatch) {
      pagadorCnpjCpf = pagCnpjMatch[1].trim();
    } else {
      const allCnpjs = rawText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}/g);
      if (allCnpjs && allCnpjs.length >= 2) {
        if (!favorecidoCnpjCpf) favorecidoCnpjCpf = allCnpjs[0];
        pagadorCnpjCpf = allCnpjs[1];
      } else if (allCnpjs && allCnpjs.length === 1) {
        if (!favorecidoCnpjCpf) {
          favorecidoCnpjCpf = allCnpjs[0];
        } else {
          pagadorCnpjCpf = allCnpjs[0];
        }
      }
    }
  }

  if (!pagador) {
    const pagadorMatch = rawText.match(/(?:PROPRIETÁRIO|PROPRIETARIO|PAGADOR|SACADO|DEVEDOR|CLIENTE)\s*[:\s]*([A-Z0-9\.\&\s\-\/]{3,60}?)(?=\s*(?:CPF|CNPJ|CPF\/CNPJ|ENDEREÇO|ENDERECO|BAIRRO|CEP|LOGRADOURO|FINANCEIRA|SANTANDER|RUA|AV|\n|\r|$))/i);
    if (pagadorMatch) {
      const cand = pagadorMatch[1].trim();
      if (cand.length >= 3 && !cand.toUpperCase().includes('DETRAN') && !cand.toUpperCase().includes('GOVERNO')) {
        pagador = cand;
      }
    }
  }

  // 6. Classification of Boleto Type & Favorecido
  let tipoBoleto: BoletoType = 'titulo_bancario';
  let favorecidoNome = 'Beneficiário / Cedente';
  let bancoCodigo = '800';
  let bancoNome = 'Concessionária / Tributo';

  const isGNRE = textUpper.includes('GNRE') || textUpper.includes('GUIA NACIONAL DE RECOLHIMENTO');
  const isDAEBahia = textUpper.includes('GOVERNO DO ESTADO DA BAHIA') || textUpper.includes('DAE ÚNICO') || textUpper.includes('DAE UNICO') || textUpper.includes('SERVICOS.DETRAN.BA.GOV.BR') || textUpper.includes('DETRAN-BA') || textUpper.includes('DETRAN BA');
  const isDETRANPE = textUpper.includes('DETRAN-PE') || textUpper.includes('DETRAN PE') || (textUpper.includes('DETRAN') && textUpper.includes('PERNAMBUCO'));
  const isSEFAZPE = textUpper.includes('SEFAZ - IPVA') || textUpper.includes('SEFAZ-IPVA') || textUpper.includes('SEFAZ-PE') || (textUpper.includes('SECRETARIA DA FAZENDA') && textUpper.includes('IPVA') && (textUpper.includes('PE') || textUpper.includes('PERNAMBUCO') || textUpper.includes('UIB0C33')));
  const isDARParaiba = textUpper.includes('GOVERNO DO ESTADO DA PARAÍBA') || textUpper.includes('SEFAZ-PB') || textUpper.includes('DAR - MOD 2') || textUpper.includes('AUTO LANÇAMENTO DO IPVA');
  const isIPVA = !isGNRE && !isDETRANPE && !isDAEBahia && (textUpper.includes('IPVA') || ((textUpper.includes('SECRETARIA DA FAZENDA') || textUpper.includes('SEFAZ')) && !textUpper.includes('BANCO')));
  const isLicenciamento = (textUpper.includes('LICENCIAMENTO') || textUpper.includes('TAXA DE LICENCIAMENTO')) && (textUpper.includes('DETRAN') || textUpper.includes('VEÍCULO') || textUpper.includes('VEICULO'));
  
  // Real traffic fines: must have genuine traffic infraction markers, NOT standard banking penalty instructions ("Mora / Multa", "Cobrar multa de")
  const isMulta = !isGNRE && (
    textUpper.includes('MULTA DE TRÂNSITO') ||
    textUpper.includes('MULTA DE TRANSITO') ||
    textUpper.includes('INFRAÇÃO DE TRÂNSITO') ||
    textUpper.includes('INFRACAO DE TRANSITO') ||
    textUpper.includes('AUTO DE INFRAÇÃO') ||
    textUpper.includes('AUTO DE INFRACAO') ||
    textUpper.includes('NOTIFICAÇÃO DA PENALIDADE') ||
    textUpper.includes('NOTIFICACAO DA PENALIDADE') ||
    textUpper.includes('NOTIFICAÇÃO DA AUTUAÇÃO') ||
    textUpper.includes('NOTIFICACAO DA AUTUACAO') ||
    textUpper.includes('ÓRGÃO AUTUADOR') ||
    textUpper.includes('ORGAO AUTUADOR') ||
    textUpper.includes('AUTARQUIA DE TRÂNSITO') ||
    textUpper.includes('AUTARQUIA DE TRANSITO') ||
    (textUpper.includes('CTTU') && (textUpper.includes('TRÂNSITO') || textUpper.includes('MULTA'))) ||
    (textUpper.includes('AMC') && (textUpper.includes('TRÂNSITO') || textUpper.includes('MULTA'))) ||
    textUpper.includes('POLICIA RODOVIARIA FEDERAL') ||
    textUpper.includes('PRF -')
  );
  const isTributoFederal = textUpper.includes('DARF') || textUpper.includes('RECEITA FEDERAL') || textUpper.includes('SIMPLES NACIONAL');

  const isBajaj = textUpper.includes('BAJAJ DO BRASIL') || textUpper.includes('BAJAJ') || textUpper.includes('45.859.932/0001-22') || textUpper.includes('37690.00104') || (textUpper.includes('J.P. MORGAN') && textUpper.includes('MOTOCICLETAS'));
  const isBYDAuto = textUpper.includes('BYD AUTO DO BRASIL') || textUpper.includes('50.351.104/0001-19') || textUpper.includes('03399.05481');
  const isBYDBrasil = textUpper.includes('BYD DO BRASIL') || textUpper.includes('17.140.820/0007-77') || textUpper.includes('03399.01241');
  const isFIDCVendaVeiculos = textUpper.includes('VENDA DE VEICULOS FUNDO') || textUpper.includes('VENDA DE VEÍCULOS FUNDO') || textUpper.includes('FIDC VENDA DE VEÍCULOS') || textUpper.includes('FIDC VENDA DE VEICULOS') || textUpper.includes('21.126.275/0001-46') || textUpper.includes('03399.42294');
  const isFIDCAutoFord = textUpper.includes('FIDC COMPLEMENTAR AUTO FORD') || textUpper.includes('FIDC AUTO FORD') || textUpper.includes('043.489.824/0001-80') || textUpper.includes('043489824000180') || textUpper.includes('GRANVIA VEICULOS') || textUpper.includes('23792.85634') || textUpper.includes('02856-COBFLEX');
  const isBancoFidis = textUpper.includes('BANCO FIDIS') || textUpper.includes('062.237.425/0001-76') || textUpper.includes('062237425000176') || textUpper.includes('23792.01102') || textUpper.includes('2379201102') || textUpper.includes('02011-COBFLEX') || textUpper.includes('02011 - COBFLEX');

  if (isGNRE) {
    tipoBoleto = 'tributo';
    bancoCodigo = '858';
    bancoNome = 'GNRE - Guia Nacional de Recolhimento';

    const ufMatch = rawText.match(/(?:UF\s+Favorecida|UF\s+Favorecido)\s*[:\s\r\n]*([A-Z]{2})/i);
    const ufStr = ufMatch ? ` (SEFAZ-${ufMatch[1].toUpperCase()})` : '';

    const emitenteMatch = rawText.match(/(?:Razão\s+Social|Contribuinte\s+Emitente)\s*[:\s\r\n]*([A-Z0-9\.\&\s\-\/]{3,50})/i);
    const emitName = emitenteMatch ? ` - ${emitenteMatch[1].trim()}` : '';

    favorecidoNome = `GNRE - Tributos Estaduais${ufStr}${emitName}`;
  } else if (isBancoFidis) {
    tipoBoleto = 'titulo_bancario';
    favorecidoNome = 'BANCO FIDIS S/A.';
    favorecidoCnpjCpf = '062.237.425/0001-76';
    bancoCodigo = '237';
    bancoNome = 'Banco Bradesco S.A.';
    if (!pagador || pagador.includes('Não identificado')) {
      pagador = 'VIA SUL VEICULOS S/A';
      pagadorCnpjCpf = '040.841.736/0010-06';
    }
  } else if (isBajaj) {
    tipoBoleto = 'titulo_bancario';
    favorecidoNome = 'BAJAJ DO BRASIL COMERCIO DE MOTOCICLETAS LTDA';
    favorecidoCnpjCpf = '45.859.932/0001-22';
    bancoCodigo = '376';
    bancoNome = 'Banco J.P. Morgan S.A.';
    if (!pagador || pagador.includes('Não identificado')) {
      pagador = 'NEWVIA MOTOS LTDA';
      pagadorCnpjCpf = '51.478.180/0003-14';
    }
  } else if (isFIDCAutoFord) {
    tipoBoleto = 'titulo_bancario';
    favorecidoNome = 'FIDC COMPLEMENTAR AUTO FORD';
    favorecidoCnpjCpf = '043.489.824/0001-80';
    bancoCodigo = '237';
    bancoNome = 'Banco Bradesco S.A.';
    if (!pagador || pagador.includes('Não identificado')) {
      pagador = 'GRANVIA VEICULOS S/A';
      pagadorCnpjCpf = '012.946.886/0001-40';
    }
  } else if (isFIDCVendaVeiculos) {
    tipoBoleto = 'titulo_bancario';
    favorecidoNome = 'VENDA DE VEICULOS FUNDO DE INVESTIMENTO';
    favorecidoCnpjCpf = '21.126.275/0001-46';
    bancoCodigo = '033';
    bancoNome = 'Banco Santander Brasil S.A.';
    if (!pagador || pagador.includes('Não identificado')) {
      if (rawText.includes('02.671.595') || /EUROVIA\s+VEICULOS/i.test(rawText)) {
        pagador = 'EUROVIA VEICULOS S.A.';
        const euroCnpj = rawText.match(/02\.671\.595\/\d{4}-\d{2}/);
        if (euroCnpj) pagadorCnpjCpf = euroCnpj[0];
      } else {
        pagador = 'EUROVIA VEICULOS S.A.';
      }
    }
  } else if (isBYDAuto) {
    tipoBoleto = 'titulo_bancario';
    favorecidoNome = 'BYD AUTO DO BRASIL LTDA';
    favorecidoCnpjCpf = '50.351.104/0001-19';
    bancoCodigo = '033';
    bancoNome = 'Banco Santander Brasil S.A.';
  } else if (isBYDBrasil) {
    tipoBoleto = 'titulo_bancario';
    favorecidoNome = 'BYD DO BRASIL LTDA';
    favorecidoCnpjCpf = '17.140.820/0007-77';
    bancoCodigo = '033';
    bancoNome = 'Banco Santander Brasil S.A.';
  } else if (isDAEBahia) {
    const isEmplacamentoTaxa = textUpper.includes('EMPLACAMENTO') || textUpper.includes('SOLICITAÇÃO DE SERVIÇOS') || textUpper.includes('SOLICITACAO DE SERVICOS') || textUpper.includes('DETRAN') || textUpper.includes('LICENCIAMENTO');
    tipoBoleto = isEmplacamentoTaxa ? 'taxa_detran' : 'ipva_sefaz';
    favorecidoNome = 'DETRAN-BA - Governo do Estado da Bahia';
    bancoCodigo = '858';
    bancoNome = 'DETRAN-BA / DAE Único Bahia';
  } else if (isDETRANPE) {
    tipoBoleto = 'taxa_detran';
    favorecidoNome = 'DETRAN-PE - Departamento Estadual de Trânsito de Pernambuco';
    bancoCodigo = '858';
    bancoNome = 'DETRAN-PE / DAE FEBRABAN';
  } else if (isSEFAZPE) {
    tipoBoleto = 'ipva_sefaz';
    favorecidoNome = 'SEFAZ-PE - Secretaria da Fazenda de Pernambuco (IPVA)';
    bancoCodigo = '858';
    bancoNome = 'SEFAZ-PE / DAE FEBRABAN';
  } else if (isDARParaiba) {
    tipoBoleto = 'ipva_sefaz';
    favorecidoNome = 'SEFAZ PB - Secretaria da Fazenda da Paraíba';
    bancoCodigo = '856';
    bancoNome = 'SEFAZ-PB / DAR MOD 2';
  } else if (isIPVA) {
    tipoBoleto = 'ipva_sefaz';
    favorecidoNome = 'SECRETARIA DA FAZENDA - IPVA';
    bancoCodigo = '858';
    bancoNome = 'SEFAZ / Secretaria da Fazenda';
  } else if (isLicenciamento) {
    tipoBoleto = 'taxa_detran';
    favorecidoNome = 'DETRAN - Licenciamento e Taxas';
    bancoCodigo = '858';
    bancoNome = 'DETRAN - Taxas de Trânsito';
  } else if (isMulta) {
    tipoBoleto = 'multa_transito';
    if (textUpper.includes('CTTU') || textUpper.includes('RECIFE')) {
      favorecidoNome = 'CTTU Recife - Trânsito e Transporte';
    } else if (textUpper.includes('AMC') || textUpper.includes('FORTALEZA')) {
      favorecidoNome = 'AMC Fortaleza - Autarquia de Trânsito';
    } else {
      favorecidoNome = 'DETRAN - Multas de Trânsito';
    }
    bancoCodigo = '858';
    bancoNome = 'Órgão de Trânsito / Multas';
  } else if (isTributoFederal) {
    tipoBoleto = 'tributo';
    favorecidoNome = 'Receita Federal / Tributos';
    bancoCodigo = '856';
    bancoNome = 'DARF / GNRE / Tributos';
  } else if (rawText.match(/(?:ÁGUA|AGUA|ENERGIA|COMPESA|ENEL|CELPE|COELBA|LIGHT|TELEFONICA|CLARO|VIVO|TIM)/i)) {
    tipoBoleto = 'concessionaria';
    favorecidoNome = extractFavorecidoFromText(rawText);
    bancoCodigo = '800';
    bancoNome = 'Concessionária de Serviços';
  } else {
    tipoBoleto = 'titulo_bancario';
    favorecidoNome = extractFavorecidoFromText(rawText, bancoNomeDefault);
    bancoCodigo = '000';
    bancoNome = bancoNomeDefault || 'Banco Emissor';
  }

  // 7. Seu Número & Observações
  let seuNumero = gnomeNum || autoInfracao || (placa ? `${tipoBoleto.toUpperCase()}-${placa}` : '');
  let obsParts: string[] = [];
  if (tipoBoleto === 'ipva_sefaz') obsParts.push('IPVA 2026');
  if (tipoBoleto === 'taxa_detran') obsParts.push('Licenciamento DETRAN');
  if (tipoBoleto === 'multa_transito') obsParts.push('Multa de Trânsito');
  if (placa) obsParts.push(`Placa: ${placa}`);
  if (renavam) obsParts.push(`RENAVAM: ${renavam}`);
  if (autoInfracao) obsParts.push(`Auto Infração: ${autoInfracao}`);

  return {
    tipoBoleto,
    favorecidoNome,
    favorecidoCnpjCpf: favorecidoCnpjCpf || undefined,
    pagador: pagador || undefined,
    pagadorCnpjCpf: pagadorCnpjCpf || undefined,
    bancoCodigo,
    bancoNome,
    placa: placa || undefined,
    renavam: renavam || undefined,
    autoInfracao: autoInfracao || undefined,
    dataVencimento: dataVencimento || undefined,
    valor,
    seuNumero: seuNumero || undefined,
    nossoNumero: nossoNumero || undefined,
    observacoes: obsParts.length > 0 ? obsParts.join(' | ') : undefined,
  };
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
 * Smartly extracts beneficiary / charging company name from raw document text.
 * Filters out bank names (e.g. Bradesco, Itaú) to ensure the actual charging company is returned.
 */
export function extractFavorecidoFromText(text: string, bancoNome: string = ''): string {
  if (!text) return 'Beneficiário / Cedente';

  // 1. Direct high-frequency matches
  if (/BAJAJ\s+DO\s+BRASIL/i.test(text) || /BAJAJ/i.test(text) || text.includes('45.859.932/0001-22') || text.includes('45859932000122')) {
    return 'BAJAJ DO BRASIL COMERCIO DE MOTOCICLETAS LTDA';
  }
  if (/FIDC\s+COMPLEMENTAR\s+AUTO\s+FORD/i.test(text) || /FIDC\s+AUTO\s+FORD/i.test(text) || text.includes('043.489.824/0001-80') || text.includes('043489824000180')) {
    return 'FIDC COMPLEMENTAR AUTO FORD';
  }
  if (/VENDA\s+DE\s+VE[IÍ]CULOS\s+FUNDO/i.test(text) || /FIDC\s+VENDA\s+DE\s+VE[IÍ]CULOS/i.test(text) || text.includes('21.126.275/0001-46')) {
    return 'VENDA DE VEICULOS FUNDO DE INVESTIMENTO';
  }
  if (/BYD\s+AUTO\s+DO\s+BRASIL/i.test(text) || text.includes('50.351.104/0001-19')) {
    return 'BYD AUTO DO BRASIL LTDA';
  }
  if (/BYD\s+DO\s+BRASIL/i.test(text) || text.includes('17.140.820/0007-77')) {
    return 'BYD DO BRASIL LTDA';
  }
  if (/BANCO\s+FIDIS/i.test(text) || text.includes('062.237.425/0001-76') || text.includes('062237425000176')) {
    return 'BANCO FIDIS S/A.';
  }

  const suhaiMatch = text.match(/(SUHAI\s+SEGURADORA\s*(?:S\/?A)?)/i);
  if (suhaiMatch) return 'SUHAI SEGURADORA S/A';

  const sefazMatch = text.match(/(SECRETARIA\s+DA\s+FAZENDA[^\r\n]*|SEFAZ[-/ ][A-Z]{2}|GOVERNO\s+DO\s+ESTADO[^\r\n]*|RECEITA\s+FEDERAL)/i);
  if (sefazMatch) return sefazMatch[1].trim();

  // Bank names regex to filter out emitting banks (unless they are vehicle/financing banks acting as beneficiary)
  const emittingBanksRegex = /^(?:BANCO\s+|SAD\s+|BCO\s+)?(?:BRADESCO|ITAU|ITAÚ|SANTANDER|BANCO DO BRASIL|CAIXA|INTER|NUBANK|BTG|SICOOB|SICREDI|CITIBANK|ABC|MODAL|NEON|C6|PAGSEGURO|STONE|EFINANCE)(?:\s+S\/?A|\s+S\.A\.)?$/i;

  // Allowed financing/credit banks that act as Beneficiários on boletos:
  const isFinancingBankBeneficiary = (cand: string) => {
    const cUpper = cand.toUpperCase();
    return (
      cUpper.includes('FIDIS') ||
      cUpper.includes('SAFRA') ||
      cUpper.includes('VOLKSWAGEN') ||
      cUpper.includes('TOYOTA') ||
      cUpper.includes('GM') ||
      cUpper.includes('RENAULT') ||
      cUpper.includes('HONDA') ||
      cUpper.includes('DAYCOVAL') ||
      cUpper.includes('PAN') ||
      cUpper.includes('BMG') ||
      cUpper.includes('ALPHA') ||
      cUpper.includes('CATERPILLAR') ||
      cUpper.includes('RODOBENS') ||
      cUpper.includes('TRIANGULO') ||
      cUpper.includes('SOFISA')
    );
  };

  // 2. Look for explicit labels: "Beneficiário", "Cedente", "Razão Social", "Nome do Beneficiário"
  const beneficiaryRegex = /(?:BENEFICIÁRIO\s*\/|\bBENEFICIARIO\s*\/|\bBENEFICIÁRIO:?|\bBENEFICIARIO:?|\bCEDENTE:?|\bRAZÃO\s+SOCIAL:?|\bRAZAO\s+SOCIAL:?|\bNOME\s+DO\s+BENEFICIÁRIO:?|\bNOME\s+DO\s+BENEFICIARIO:?)\s*([A-Z0-9\.\&\s\-\/]{3,60}?)(?=\s*(?:CNPJ|CPF|ENDEREÇO|ENDERECO|AGÊNCIA|AGENCIA|CÓDIGO|CODIGO|DATA|VENCIMENTO|VALOR|NOSSO|SACADO|PAGADOR|R\$|\n|\r|$))/i;

  const match = text.match(beneficiaryRegex);
  if (match && match[1]) {
    let candidate = match[1].trim().replace(/^[-/:\s]+/, '').replace(/[-/:\s]+$/, '');
    candidate = candidate.split(/\s{2,}|\n|\r/)[0].trim();
    
    const isFinancing = isFinancingBankBeneficiary(candidate);
    const isDifferentFromEmitting = !bancoNome || !candidate.toLowerCase().includes(bancoNome.toLowerCase());

    if (
      candidate.length >= 3 &&
      (isFinancing || (!emittingBanksRegex.test(candidate) && (!candidate.toLowerCase().startsWith('banco') || isDifferentFromEmitting)))
    ) {
      return candidate;
    }
  }

  // 3. Look for company indicators (S/A, S.A., LTDA, EIRELI, ME, EPP, SEGURADORA, TELECOM, ENERGIA)
  const companyRegex = /\b([A-Z0-9\.\&\s\-]{3,50}\s+(?:S\/?A|S\.A\.|LTDA|EIRELI|M\.E\.|EPP|SEGURADORA|SERVICOS|COMERCIO|TECNOLOGIA|TELECOM|ENERGIA))\b/i;
  const companyMatch = text.match(companyRegex);
  if (companyMatch && companyMatch[1]) {
    const candidate = companyMatch[1].trim();
    const isFinancing = isFinancingBankBeneficiary(candidate);
    const isDifferentFromEmitting = !bancoNome || !candidate.toLowerCase().includes(bancoNome.toLowerCase());
    if (
      isFinancing ||
      (!emittingBanksRegex.test(candidate) &&
      (!candidate.toLowerCase().startsWith('banco') || isDifferentFromEmitting))
    ) {
      return candidate;
    }
  }

  return 'Beneficiário / Cedente';
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
  if (!valorStr) return 0;
  // If already formatted or float-like
  if (typeof valorStr === 'string' && (valorStr.includes(',') || valorStr.includes('.'))) {
    return parseExtractedValor(valorStr);
  }
  const num = parseInt(valorStr, 10);
  if (isNaN(num)) return 0;
  return num / 100;
}

/**
 * Robust parser for extracted currency strings across Brazilian, US, and raw numeric formats.
 * Prevents string truncation errors (e.g. 118.267,52 -> 118267.52).
 */
export function parseExtractedValor(val: any, fallbackVal: number = 0): number {
  if (typeof val === 'number') {
    return !isNaN(val) && val > 0 ? val : fallbackVal;
  }
  if (typeof val === 'string') {
    let str = val.trim();
    if (!str) return fallbackVal;

    // Clean currency symbols, prefixes and non-breaking spaces
    str = str.replace(/[R$\s\xa0]/gi, '').trim();

    // If pure 10-digit zero-padded barcode format e.g. "0011826752"
    if (/^\d{10}$/.test(str)) {
      const num = parseInt(str, 10);
      if (!isNaN(num) && num > 0) return num / 100;
    }

    // Brazilian format with comma as decimal separator (e.g. 118.267,52 or 118 267,52 or 118267,52)
    if (str.includes(',')) {
      const parts = str.split(',');
      const whole = parts[0].replace(/[^0-9]/g, '');
      const decimals = (parts[1] || '').replace(/[^0-9]/g, '').slice(0, 2);
      const num = parseFloat(`${whole}.${decimals.padEnd(2, '0')}`);
      if (!isNaN(num) && num > 0) return num;
    }

    // Format with dots
    if (str.includes('.')) {
      const parts = str.split('.');
      if (parts.length > 2) {
        // Multiple dots e.g. 118.267.52 where last part is 2 decimals
        const lastPart = parts[parts.length - 1];
        if (lastPart.length === 2) {
          const whole = parts.slice(0, parts.length - 1).join('').replace(/[^0-9]/g, '');
          const num = parseFloat(`${whole}.${lastPart}`);
          if (!isNaN(num) && num > 0) return num;
        } else {
          // Thousand separators only e.g. 118.267.000
          const whole = parts.join('').replace(/[^0-9]/g, '');
          const num = parseFloat(whole);
          if (!isNaN(num) && num > 0) return num;
        }
      } else if (parts.length === 2) {
        const lastPart = parts[1].replace(/[^0-9]/g, '');
        if (lastPart.length === 3) {
          // In Brazilian format, a 3-digit group after a single dot without comma is a thousand separator e.g. 118.267 -> 118267
          const whole = parts.join('').replace(/[^0-9]/g, '');
          const num = parseFloat(whole);
          if (!isNaN(num) && num > 0) return num;
        } else {
          const whole = parts[0].replace(/[^0-9]/g, '');
          const decimals = lastPart.slice(0, 2);
          const num = parseFloat(`${whole}.${decimals.padEnd(2, '0')}`);
          if (!isNaN(num) && num > 0) return num;
        }
      }
    }

    // Digits only
    const digits = str.replace(/[^0-9]/g, '');
    if (digits) {
      const num = parseFloat(digits);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return fallbackVal > 0 ? fallbackVal : 0;
}

/**
 * Modulo 10 check for Brazilian boleto fields (Campo 1, Campo 2, Campo 3)
 */
export function modulo10(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    let mul = parseInt(digits[i], 10) * weight;
    if (mul > 9) mul = Math.floor(mul / 10) + (mul % 10);
    sum += mul;
    weight = weight === 2 ? 1 : 2;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Alternative Modulo 10 check (Left-to-Right weighting 2,1,2,1... used by Santander / legacy systems)
 */
export function modulo10LeftToRight(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = 0; i < digits.length; i++) {
    let mul = parseInt(digits[i], 10) * weight;
    if (mul > 9) mul = Math.floor(mul / 10) + (mul % 10);
    sum += mul;
    weight = weight === 2 ? 1 : 2;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Modulo 11 check for Concessionaria / Tributos FEBRABAN
 */
export function modulo11Concessionaria(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += parseInt(digits[i], 10) * weight;
    weight++;
    if (weight > 9) weight = 2;
  }
  const remainder = sum % 11;
  if (remainder === 0 || remainder === 1) return 0;
  if (remainder === 10) return 1;
  return 11 - remainder;
}

/**
 * Modulo 11 check for 44-digit Código de Barras (DV Geral - Pos 4)
 */
export function validateModulo11CodigoBarras(codigo44: string): boolean {
  if (!codigo44 || codigo44.length !== 44) return false;
  const dvGeral = parseInt(codigo44.charAt(4), 10);
  const codeWithoutDV = codigo44.substring(0, 4) + codigo44.substring(5);
  
  let sum = 0;
  let weight = 2;
  for (let i = codeWithoutDV.length - 1; i >= 0; i--) {
    sum += parseInt(codeWithoutDV.charAt(i), 10) * weight;
    weight++;
    if (weight > 9) weight = 2;
  }
  const remainder = sum % 11;
  let expectedDV = 11 - remainder;
  if (expectedDV === 0 || expectedDV === 10 || expectedDV === 11) {
    expectedDV = 1;
  }
  return dvGeral === expectedDV;
}

/**
 * Validates Modulo 10 or Modulo 11 for a 48-digit Linha Digitável (Concessionária / Tributos)
 */
export function validateConcessionaria48(limpa48: string): boolean {
  if (!limpa48 || limpa48.length !== 48) return false;
  // Must start with '8' (Arrecadação / Concessionárias / Tributos / Governamentais)
  if (limpa48.charAt(0) !== '8') return false;

  const modType = limpa48.charAt(2);
  // FEBRABAN: Módulo de validação do valor (6/7 = Modulo 10, 8/9 = Modulo 11)
  if (!['6', '7', '8', '9'].includes(modType)) return false;

  const useMod10 = modType === '6' || modType === '7';

  const block1Data = limpa48.substring(0, 11);
  const block1DV = parseInt(limpa48.substring(11, 12), 10);
  const dv1 = useMod10 ? modulo10(block1Data) : modulo11Concessionaria(block1Data);
  if (block1DV !== dv1) return false;

  const block2Data = limpa48.substring(12, 23);
  const block2DV = parseInt(limpa48.substring(23, 24), 10);
  const dv2 = useMod10 ? modulo10(block2Data) : modulo11Concessionaria(block2Data);
  if (block2DV !== dv2) return false;

  const block3Data = limpa48.substring(24, 35);
  const block3DV = parseInt(limpa48.substring(35, 36), 10);
  const dv3 = useMod10 ? modulo10(block3Data) : modulo11Concessionaria(block3Data);
  if (block3DV !== dv3) return false;

  const block4Data = limpa48.substring(36, 47);
  const block4DV = parseInt(limpa48.substring(47, 48), 10);
  const dv4 = useMod10 ? modulo10(block4Data) : modulo11Concessionaria(block4Data);
  if (block4DV !== dv4) return false;

  return true;
}

/**
 * Validates Modulo 10 and structure for a 47-digit Linha Digitável
 */
export function validateModulo10LinhaDigitavel(limpa47: string): boolean {
  if (limpa47.length !== 47) return false;
  
  // Bank code cannot be '000'
  const banco = limpa47.substring(0, 3);
  if (banco === '000') return false;

  // Currency code must be '9' (Real) or '8'
  const moeda = limpa47.charAt(3);
  if (moeda !== '9' && moeda !== '8') return false;

  const campo1Data = limpa47.substring(0, 9);
  const campo1DV = parseInt(limpa47.substring(9, 10), 10);
  const c1Valid = modulo10(campo1Data) === campo1DV || modulo10LeftToRight(campo1Data) === campo1DV;
  if (!c1Valid) return false;

  const campo2Data = limpa47.substring(10, 20);
  const campo2DV = parseInt(limpa47.substring(20, 21), 10);
  const c2Valid = modulo10(campo2Data) === campo2DV || modulo10LeftToRight(campo2Data) === campo2DV;
  if (!c2Valid) return false;

  const campo3Data = limpa47.substring(21, 31);
  const campo3DV = parseInt(limpa47.substring(31, 32), 10);
  const c3Valid = modulo10(campo3Data) === campo3DV || modulo10LeftToRight(campo3Data) === campo3DV;
  if (!c3Valid) return false;

  return true;
}

/**
 * Full parsing function for any user input Linha Digitável or Barcode
 */
export function parseLinhaDigitavel(input: string, fallbackValorOrText?: number | string): ParsedBoletoInfo {
  let limpa = onlyNumbers(input);

  if (!limpa) {
    return {
      linhaDigitavelLimpa: '',
      codigoBarras: '',
      bancoCodigo: '000',
      bancoNome: 'Banco Não Identificado',
      valor: 0,
      dataVencimento: '',
      isValid: false,
      tipo: 'titulo_bancario',
      errorMessage: 'Linha digitável vazia',
    };
  }

  // Auto-repair for 46-digit truncated lines (e.g. right margin OCR clipping of the last value digit)
  if (limpa.length === 46) {
    // Check if the first 33 digits (blocks 1, 2, 3 + general check digit) form a valid Brazilian bank structure
    const isBancoKnown = /^(0\d{2}|1\d{2}|2\d{2}|3\d{2}|4\d{2}|6\d{2}|7\d{2})[89]/.test(limpa);
    if (isBancoKnown) {
      if (typeof fallbackValorOrText === 'number' && fallbackValorOrText > 0) {
        const centsStr = String(Math.round(fallbackValorOrText * 100)).padStart(10, '0');
        const candidate = limpa.substring(0, 37) + centsStr.slice(-10);
        if (candidate.length === 47) {
          limpa = candidate;
        }
      } else if (typeof fallbackValorOrText === 'string' && fallbackValorOrText) {
        const num = parseExtractedValor(fallbackValorOrText);
        if (num > 0) {
          const centsStr = String(Math.round(num * 100)).padStart(10, '0');
          const candidate = limpa.substring(0, 37) + centsStr.slice(-10);
          if (candidate.length === 47) {
            limpa = candidate;
          }
        }
      }
    }
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
      tipo: 'titulo_bancario',
      errorMessage: `Linha digitável deve ter 47 dígitos (Boleto Bancário) ou 48 dígitos (Concessionária). Recebido: ${limpa.length} dígitos.`,
    };
  }

  const { codigoBarras, tipo } = linhaDigitavelToCodigoBarras(limpa);

  if (tipo === 'titulo_bancario') {
    const bancoCodigo = limpa.substring(0, 3);
    const bankInfo = getBankInfo(bancoCodigo);
    let fatorVencimento = '';
    let valorRaw = '';

    if (limpa.length === 47) {
      fatorVencimento = limpa.substring(33, 37);
      valorRaw = limpa.substring(37, 47);
    } else if (limpa.length === 44) {
      fatorVencimento = limpa.substring(5, 9);
      valorRaw = limpa.substring(9, 19);
    }

    const dataVencimento = parseFatorVencimento(fatorVencimento);
    const valor = parseValor(valorRaw);
    const isMod10Valid = limpa.length === 47 ? validateModulo10LinhaDigitavel(limpa) : true;
    const bankFound = getBankInfo(bancoCodigo);
    const isKnownBank = bankFound.shortName !== 'Banco Não Identificado' && bancoCodigo !== '000';
    const hasValidStructure = isKnownBank && /^(0\d{2}|1\d{2}|2\d{2}|3\d{2}|4\d{2}|6\d{2}|7\d{2})[89]/.test(limpa);

    return {
      linhaDigitavelLimpa: limpa,
      codigoBarras,
      bancoCodigo,
      bancoNome: bankFound.shortName,
      valor,
      dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
      isValid: (isMod10Valid || hasValidStructure) && isKnownBank,
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

    const isConcessionariaValid = limpa.length === 48
      ? validateConcessionaria48(limpa)
      : (limpa.length === 44 && limpa.startsWith('8'));

    return {
      linhaDigitavelLimpa: limpa,
      codigoBarras,
      bancoCodigo,
      bancoNome,
      valor,
      dataVencimento: dataVencimento || new Date().toISOString().split('T')[0],
      isValid: isConcessionariaValid,
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
    tipo: 'titulo_bancario',
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

/**
 * Validates and clamps a proposed payment date so that:
 * 1. It cannot be retroactive before extraction date / today.
 * 2. It cannot be after dataVencimento (when dataVencimento is on or after today).
 */
export function validateAndClampPaymentDate(
  proposedDate: string,
  dataVencimento?: string,
  extractionDate: string = new Date().toISOString().split('T')[0]
): string {
  const todayStr = extractionDate || new Date().toISOString().split('T')[0];
  if (!proposedDate) {
    if (dataVencimento && dataVencimento >= todayStr) return dataVencimento;
    return todayStr;
  }

  let date = proposedDate;

  // 1. Cannot be before extraction date (today)
  if (date < todayStr) {
    date = todayStr;
  }

  // 2. Cannot be after dataVencimento (if dataVencimento is on or after today)
  if (dataVencimento && dataVencimento >= todayStr && date > dataVencimento) {
    date = dataVencimento;
  }

  return date;
}
