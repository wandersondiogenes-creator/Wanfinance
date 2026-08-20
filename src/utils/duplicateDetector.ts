import { BoletoItem, CNABBatchHistory } from '../types';
import { onlyNumbers } from './boletoParser.js';

export interface DuplicateInfo {
  isDuplicate: boolean;
  isSameBatchDuplicate: boolean; // Repetido na Lista Atual (mesmo arquivo ou lote)
  isMemoryDuplicate: boolean;    // Repetido na Memória Temporal da sessão
  isSystemDuplicate: boolean;    // Repetido no Banco de Dados / Cadastro do Sistema
  isHistoryDuplicate: boolean;   // Repetido no Histórico de Remessas CNAB
  duplicateReason?: string;
  matchedBoletoId?: string;
  matchedBatchFilename?: string;
  duplicateSourceLabel?: string; // Rótulo curto: 'Lista Atual' | 'Memória Temporal' | 'Banco de Dados' | 'Histórico CNAB'
}

/**
 * Checks if a reference number (seuNumero) is generic/placeholder/synthetic
 * (e.g., '0', '1', 'S/N', 'DOC', 'N/A', '-', 'PDF-BROWSER-1', 'DOC-12345', etc.)
 */
export function isGenericRef(ref?: string): boolean {
  if (!ref) return true;
  const trimmed = ref.trim().toUpperCase();
  const clean = trimmed.replace(/[^A-Z0-9]/g, '');
  if (clean.length < 3) return true;

  // Catch synthetic system-generated prefixes
  if (/^(PDF|BROWSER|DOC|MANUAL|BOL|ITEM|TEMP|LOTE|AUTO|GERADO|REF|TESTE|DOCUMENTO)/i.test(trimmed)) {
    return true;
  }

  const genericSet = new Set([
    '0', '00', '000', '0000', '00000', '000000', '0000000', '00000000',
    '1', '01', '001', '0001', '00001',
    'SN', 'NA', 'DOC', 'FATURA', 'BOLETO', 'SEUNUMERO', 'PARCELA', 'DIVERSOS', 'TAXA', 'GUIA', 'RECIBO', 'DUPLICATA',
    'SEM NUMERO', 'SEMNUMERO', 'NAO INFORMADO', 'NAOINFORMADO', 'NA', 'ND'
  ]);

  return genericSet.has(clean);
}

/**
 * Normalizes a boleto payment string to numbers only for clean comparison.
 * Requires at least 40 digits (valid barcode / linha digitável) to avoid false matches.
 */
export function getBoletoCleanKey(linhaDigitavel?: string, codigoBarras?: string): string {
  const cleanLinha = onlyNumbers(linhaDigitavel || '');
  if (cleanLinha.length >= 40) return cleanLinha;
  const cleanBarras = onlyNumbers(codigoBarras || '');
  if (cleanBarras.length >= 40) return cleanBarras;
  return '';
}

/**
 * Evaluates duplicate status for a single candidate boleto against:
 * 1. Current list/file items (Lista Atual)
 * 2. Session / Temporal Memory (Memória Temporal)
 * 3. Existing active system boletos (Banco de Dados)
 * 4. History of exported batches (Histórico CNAB)
 */
export function detectBoletoDuplicate(
  candidate: { linhaDigitavel?: string; codigoBarras?: string; id?: string; seuNumero?: string; favorecidoCnpjCpf?: string; valor?: number },
  currentBatchItems: Array<{ linhaDigitavel?: string; codigoBarras?: string; id?: string; seuNumero?: string; favorecidoCnpjCpf?: string; valor?: number }> = [],
  existingBoletos: BoletoItem[] = [],
  history: CNABBatchHistory[] = [],
  temporalMemory: BoletoItem[] = []
): DuplicateInfo {
  const candidateKey = getBoletoCleanKey(candidate.linhaDigitavel, candidate.codigoBarras);
  const candidateRef = candidate.seuNumero?.trim().toUpperCase();
  const candidateCnpj = onlyNumbers(candidate.favorecidoCnpjCpf || '');
  const hasValidRef = !isGenericRef(candidateRef) && candidateCnpj.length >= 11;

  let isSameBatchDuplicate = false;
  let isMemoryDuplicate = false;
  let isSystemDuplicate = false;
  let isHistoryDuplicate = false;

  let matchedBoletoId: string | undefined;
  let matchedBatchFilename = '';
  let duplicateReason = '';
  let duplicateSourceLabel = '';

  const checkItemMatch = (item: { linhaDigitavel?: string; codigoBarras?: string; id?: string; seuNumero?: string; favorecidoCnpjCpf?: string; valor?: number }): boolean => {
    // 1. Prevent self-matching if both have an id and ids match
    if (candidate.id && item.id && candidate.id === item.id) return false;
    // 2. Prevent self-matching by reference
    if (candidate === item) return false;

    const itemKey = getBoletoCleanKey(item.linhaDigitavel, item.codigoBarras);

    // CRITICAL RULE: If BOTH have valid barcode / linha digitável keys (>= 40 digits):
    if (candidateKey && itemKey) {
      // If keys are different, they are definitely DIFFERENT boletos (e.g. 2 invoices from same company with different numbers)
      return candidateKey === itemKey;
    }

    // Rule B: Match by specific non-generic reference number (seuNumero) + CNPJ ONLY when at least one lacks barcode
    if (hasValidRef) {
      const itemRef = item.seuNumero?.trim().toUpperCase();
      const itemCnpj = onlyNumbers(item.favorecidoCnpjCpf || '');
      if (!isGenericRef(itemRef) && itemCnpj.length >= 11 && candidateRef === itemRef && candidateCnpj === itemCnpj) {
        return true;
      }
    }

    return false;
  };

  // 1. Check duplicate within current file / batch (Lista Atual)
  if (currentBatchItems && currentBatchItems.length > 0) {
    const sameBatchMatch = currentBatchItems.find((item) => checkItemMatch(item));
    if (sameBatchMatch) {
      isSameBatchDuplicate = true;
      matchedBoletoId = sameBatchMatch.id;
      duplicateReason = 'Duplicado na Lista Atual (Item repetido no mesmo lote/arquivo)';
      duplicateSourceLabel = 'Lista Atual';
    }
  }

  // 2. Check duplicate within temporal memory (Memória Temporal)
  if (temporalMemory && temporalMemory.length > 0) {
    const memoryMatch = temporalMemory.find((item) => checkItemMatch(item));
    if (memoryMatch) {
      isMemoryDuplicate = true;
      matchedBoletoId = memoryMatch.id;
      if (!duplicateReason) {
        duplicateReason = 'Duplicado na Memória Temporal (Mantido no cache temporário recente)';
        duplicateSourceLabel = 'Memória Temporal';
      }
    }
  }

  // 3. Check duplicate against existing system boletos (Banco de Dados / Cadastro Ativo)
  if (existingBoletos && existingBoletos.length > 0) {
    const existingMatch = existingBoletos.find((existing) => checkItemMatch(existing));
    if (existingMatch) {
      isSystemDuplicate = true;
      matchedBoletoId = existingMatch.id;
      if (!duplicateReason) {
        duplicateReason = `Duplicado no Banco de Dados (Já cadastrado: ${existingMatch.favorecidoNome || 'Boleto Ativo'})`;
        duplicateSourceLabel = 'Banco de Dados';
      }
    }
  }

  // 4. Check duplicate against exported history batches (Histórico CNAB)
  if (history && history.length > 0) {
    for (const batch of history) {
      if (!batch.boletos) continue;
      const historyMatch = batch.boletos.find((hBoleto) => checkItemMatch(hBoleto));
      if (historyMatch) {
        isHistoryDuplicate = true;
        matchedBoletoId = historyMatch.id;
        matchedBatchFilename = batch.filename || 'Remessa CNAB';
        if (!duplicateReason) {
          duplicateReason = `Duplicado no Histórico (Enviado na Remessa CNAB: ${matchedBatchFilename})`;
          duplicateSourceLabel = `Histórico CNAB (${matchedBatchFilename})`;
        }
        break;
      }
    }
  }

  const isDuplicate = isSameBatchDuplicate || isMemoryDuplicate || isSystemDuplicate || isHistoryDuplicate;

  return {
    isDuplicate,
    isSameBatchDuplicate,
    isMemoryDuplicate,
    isSystemDuplicate,
    isHistoryDuplicate,
    duplicateReason,
    matchedBoletoId,
    matchedBatchFilename,
    duplicateSourceLabel,
  };
}

/**
 * Returns a map of boleto ID -> DuplicateInfo for an array of boletos
 */
export function getBoletosDuplicateMap(
  boletos: BoletoItem[],
  existingBoletos: BoletoItem[] = [],
  history: CNABBatchHistory[] = [],
  temporalMemory: BoletoItem[] = []
): Map<string, DuplicateInfo> {
  const map = new Map<string, DuplicateInfo>();

  for (const boleto of boletos) {
    const dupInfo = detectBoletoDuplicate(boleto, boletos, existingBoletos, history, temporalMemory);
    map.set(boleto.id, dupInfo);
  }

  return map;
}
