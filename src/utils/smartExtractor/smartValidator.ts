import { SmartValidationSummary, SmartFieldValidation } from './smartDocTypes';

/**
 * Validação de dígitos verificadores de CPF
 */
export function isValidCPF(cpfRaw: string): boolean {
  const cpf = (cpfRaw || '').replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf.charAt(10), 10);
}

/**
 * Validação de dígitos verificadores de CNPJ
 */
export function isValidCNPJ(cnpjRaw: string): boolean {
  const cnpj = (cnpjRaw || '').replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += parseInt(cnpj.charAt(i), 10) * pesos1[i];
  }
  let resto = soma % 11;
  const dv1 = resto < 2 ? 0 : 11 - resto;
  if (dv1 !== parseInt(cnpj.charAt(12), 10)) return false;

  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  soma = 0;
  for (let i = 0; i < 13; i++) {
    soma += parseInt(cnpj.charAt(i), 10) * pesos2[i];
  }
  resto = soma % 11;
  const dv2 = resto < 2 ? 0 : 11 - resto;
  return dv2 === parseInt(cnpj.charAt(13), 10);
}

/**
 * Validação de CPF ou CNPJ
 */
export function isValidCpfCnpj(doc: string): boolean {
  const clean = (doc || '').replace(/\D/g, '');
  if (clean.length === 11) return isValidCPF(clean);
  if (clean.length === 14) return isValidCNPJ(clean);
  return false;
}

/**
 * Módulo 10 FEBRABAN para blocos de linha digitável
 */
function modulo10(bloco: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = bloco.length - 1; i >= 0; i--) {
    let mul = parseInt(bloco.charAt(i), 10) * peso;
    if (mul > 9) {
      mul = Math.floor(mul / 10) + (mul % 10);
    }
    soma += mul;
    peso = peso === 2 ? 1 : 2;
  }
  const dezenaSuperior = Math.ceil(soma / 10) * 10;
  const dv = dezenaSuperior - soma;
  return dv === 10 ? 0 : dv;
}

/**
 * Valida a linha digitável bancária (47 dígitos) ou de arrecadação/concessionária (48 dígitos)
 */
export function validateBarcodeOrLinha(linhaOrBarcode: string): { isValid: boolean; type: string; message: string } {
  const clean = (linhaOrBarcode || '').replace(/\D/g, '');
  if (!clean) {
    return { isValid: false, type: 'none', message: 'Código de barras ou linha digitável ausente' };
  }

  // 47 dígitos - Título Bancário
  if (clean.length === 47) {
    if (clean.startsWith('8')) {
      return { isValid: false, type: 'bancario', message: 'Linha de 47 dígitos não pode iniciar com dígito 8' };
    }
    const c1Data = clean.substring(0, 9);
    const c1Dv = parseInt(clean.substring(9, 10), 10);
    const c2Data = clean.substring(10, 20);
    const c2Dv = parseInt(clean.substring(20, 21), 10);
    const c3Data = clean.substring(21, 31);
    const c3Dv = parseInt(clean.substring(31, 32), 10);

    const c1Ok = modulo10(c1Data) === c1Dv;
    const c2Ok = modulo10(c2Data) === c2Dv;
    const c3Ok = modulo10(c3Data) === c3Dv;

    if (c1Ok && c2Ok && c3Ok) {
      return { isValid: true, type: 'bancario_47', message: 'Linha digitável FEBRABAN 100% válida (Módulo 10 OK)' };
    } else {
      return { isValid: false, type: 'bancario_47', message: 'Dígito verificador (DV) da linha digitável incorreto' };
    }
  }

  // 48 dígitos - Arrecadação / Concessionárias / Tributos
  if (clean.length === 48) {
    if (!clean.startsWith('8')) {
      return { isValid: false, type: 'arrecadacao', message: 'Linha de arrecadação de 48 dígitos deve iniciar com 8' };
    }
    return { isValid: true, type: 'arrecadacao_48', message: 'Linha de arrecadação/tributo 48 dígitos reconhecida' };
  }

  // 44 dígitos - Código de barras puro
  if (clean.length === 44) {
    return { isValid: true, type: 'barcode_44', message: 'Código de barras de 44 dígitos reconhecido' };
  }

  return { isValid: false, type: 'invalid_length', message: `Tamanho inválido (${clean.length} dígitos, esperado 44, 47 ou 48)` };
}

/**
 * Validação de Chassi Veicular (VIN Standard 17 chars)
 */
export function isValidChassi(chassi: string): boolean {
  if (!chassi) return false;
  const clean = chassi.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 17) return false;
  // Letras I, O, Q não são permitidas no padrão internacional VIN
  if (/[IOQ]/.test(clean)) return false;
  return true;
}

/**
 * Motor de Validação e Conferência Inteligente de Documento
 */
export function validateExtractedDocument(doc: {
  linhaDigitavel?: string;
  codigoBarras?: string;
  valor?: number;
  valorOriginal?: number;
  valorCobrado?: number;
  dataVencimento?: string;
  favorecidoNome?: string;
  favorecidoCnpjCpf?: string;
  pagadorNome?: string;
  pagadorCnpjCpf?: string;
  seuNumero?: string;
  nossoNumero?: string;
  chassi?: string;
  placa?: string;
  docCategory?: string;
}): SmartValidationSummary {
  const reasons: string[] = [];
  let score = 100;

  // 1. Barcode / Linha Digitavel
  const barcodeCheck = validateBarcodeOrLinha(doc.linhaDigitavel || doc.codigoBarras || '');
  const barcodeVal: SmartFieldValidation = {
    status: barcodeCheck.isValid ? 'valid' : 'error',
    message: barcodeCheck.message,
    isVerified: barcodeCheck.isValid,
  };
  if (!barcodeCheck.isValid) {
    score -= 30;
    reasons.push(barcodeCheck.message);
  }

  // 2. Valor
  let valorVal: SmartFieldValidation;
  const val = Number(doc.valor || 0);
  if (isNaN(val) || val <= 0) {
    valorVal = { status: 'error', message: 'Valor não informado ou zerado' };
    score -= 25;
    reasons.push('Valor do documento está zerado ou inválido');
  } else if (val > 10000000) {
    valorVal = { status: 'warning', message: 'Valor muito elevado, confira centavos' };
    score -= 10;
    reasons.push('Valor extraordinariamente alto (> R$ 10.000.000,00)');
  } else {
    // Check if barcode value matches text value if both exist
    const cleanLinha = (doc.linhaDigitavel || '').replace(/\D/g, '');
    if (cleanLinha.length === 47) {
      const barcodeValorCents = parseInt(cleanLinha.substring(37), 10);
      const textValorCents = Math.round(val * 100);
      if (barcodeValorCents > 0 && Math.abs(barcodeValorCents - textValorCents) > 1) {
        valorVal = {
          status: 'warning',
          message: `Valor digitável (R$ ${(barcodeValorCents / 100).toFixed(2)}) diverge do texto (R$ ${val.toFixed(2)})`,
        };
        score -= 15;
        reasons.push('Divergência entre o valor da linha digitável e o valor lido do texto');
      } else {
        valorVal = { status: 'valid', message: 'Valor validado com sucesso' };
      }
    } else {
      valorVal = { status: 'valid', message: 'Valor validado com sucesso' };
    }
  }

  // 3. Vencimento
  let vencVal: SmartFieldValidation;
  if (!doc.dataVencimento || !/^\d{4}-\d{2}-\d{2}$/.test(doc.dataVencimento)) {
    vencVal = { status: 'error', message: 'Data de vencimento ausente ou formato inválido' };
    score -= 20;
    reasons.push('Data de vencimento não identificada');
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = doc.dataVencimento.split('-').map(Number);
    const dueDate = new Date(y, m - 1, d);

    if (isNaN(dueDate.getTime()) || y < 2000 || y > 2040) {
      vencVal = { status: 'error', message: 'Ano de vencimento fora da faixa razoável' };
      score -= 20;
      reasons.push('Ano de vencimento inválido');
    } else if (dueDate < today) {
      vencVal = { status: 'warning', message: 'Boleto vencido (data anterior a hoje)' };
      score -= 5;
      reasons.push('Documento com data de vencimento anterior à data de hoje');
    } else {
      // Check weekend
      const dayOfWeek = dueDate.getDay(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        vencVal = { status: 'warning', message: 'Vencimento em final de semana (sábado/domingo)' };
        reasons.push('Vencimento em dia não útil (sábado ou domingo)');
      } else {
        vencVal = { status: 'valid', message: 'Data de vencimento válida' };
      }
    }
  }

  // 4. Beneficiário & CNPJ/CPF
  let benVal: SmartFieldValidation;
  const favNome = (doc.favorecidoNome || '').trim();
  if (!favNome || favNome === 'Beneficiário / Cedente' || favNome === 'Não identificado') {
    benVal = { status: 'warning', message: 'Beneficiário não especificado' };
    score -= 10;
    reasons.push('Nome do beneficiário não identificado');
  } else {
    benVal = { status: 'valid', message: 'Beneficiário identificado' };
  }

  let benCnpjVal: SmartFieldValidation;
  const favCnpj = (doc.favorecidoCnpjCpf || '').replace(/\D/g, '');
  if (!favCnpj) {
    benCnpjVal = { status: 'warning', message: 'CNPJ/CPF do beneficiário não informado' };
    score -= 5;
  } else if (isValidCpfCnpj(favCnpj)) {
    benCnpjVal = { status: 'valid', message: 'CNPJ/CPF com dígitos verificadores corretos' };
  } else {
    benCnpjVal = { status: 'error', message: 'CNPJ/CPF com dígito verificador inválido' };
    score -= 10;
    reasons.push('Dígitos verificadores do CNPJ/CPF do beneficiário são inválidos');
  }

  // 5. Pagador & CNPJ/CPF
  let pagVal: SmartFieldValidation;
  const pagNome = (doc.pagadorNome || '').trim();
  if (!pagNome || pagNome === 'Não informado' || pagNome === 'Pagador') {
    pagVal = { status: 'valid', message: 'Pagador opcional' };
  } else {
    pagVal = { status: 'valid', message: 'Pagador preenchido' };
  }

  let pagCnpjVal: SmartFieldValidation;
  const pagCnpj = (doc.pagadorCnpjCpf || '').replace(/\D/g, '');
  if (!pagCnpj) {
    pagCnpjVal = { status: 'valid', message: 'Opcional' };
  } else if (isValidCpfCnpj(pagCnpj)) {
    pagCnpjVal = { status: 'valid', message: 'CNPJ/CPF do pagador validado' };
  } else {
    pagCnpjVal = { status: 'warning', message: 'CNPJ/CPF do pagador inconsistente' };
    score -= 5;
  }

  // 6. Número do Documento
  let numDocVal: SmartFieldValidation;
  const seuNum = (doc.seuNumero || '').trim();
  if (!seuNum || seuNum === 'Vencimento' || seuNum === 'Não informado') {
    numDocVal = { status: 'warning', message: 'Número do documento genérico ou ausente' };
  } else {
    numDocVal = { status: 'valid', message: 'Número de documento identificado' };
  }

  // 7. Dados Veiculares (para montadoras/Detran)
  let veicVal: SmartFieldValidation | undefined;
  if (doc.docCategory === 'montadora_fidc' || doc.chassi || doc.placa) {
    if (doc.chassi) {
      if (isValidChassi(doc.chassi)) {
        veicVal = { status: 'valid', message: `Chassi padrão VIN válido (${doc.chassi})` };
      } else {
        veicVal = { status: 'warning', message: `Chassi com formato atípico (${doc.chassi})` };
      }
    } else {
      veicVal = { status: 'warning', message: 'Chassi do veículo não localizado' };
    }
  }

  // Overall status calculation
  score = Math.max(0, Math.min(100, score));
  let overallStatus: 'valid' | 'warning' | 'error' = 'valid';
  if (score < 60 || barcodeVal.status === 'error' || valorVal.status === 'error' || vencVal.status === 'error') {
    overallStatus = 'error';
  } else if (score < 90 || reasons.length > 0) {
    overallStatus = 'warning';
  }

  return {
    overallStatus,
    score,
    barcode: barcodeVal,
    valor: valorVal,
    vencimento: vencVal,
    beneficiario: benVal,
    beneficiarioCnpjCpf: benCnpjVal,
    pagador: pagVal,
    pagadorCnpjCpf: pagCnpjVal,
    numeroDocumento: numDocVal,
    veiculoDados: veicVal,
    requiresReview: reasons.length > 0,
    reviewReasons: reasons,
  };
}
