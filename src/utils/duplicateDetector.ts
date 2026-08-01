import { BoletoItem, CNABBatchHistory } from '../types';
import { onlyNumbers } from './boletoParser';

export interface DuplicateInfo {
  isDuplicate: boolean;
  isSameBatchDuplicate: boolean; // Repetido no mesmo arquivo/lote
  isSystemDuplicate: boolean;    // Repetido em relação a boletos já existentes/cadastrados
  isHistoryDuplicate: boolean;   // Já gerado em remessa anterior (histórico)
  duplicateReason?: string;
  matchedBoletoId?: string;
  matchedBatchFilename?: string;
}

/**
 * Normalizes a boleto payment string to numbers only for clean comparison
 */
export function getBoletoCleanKey(linhaDigitavel?: string, codigoBarras?: string): string {
  const cleanLinha = onlyNumbers(linhaDigitavel || '');
  if (cleanLinha.length >= 10) return cleanLinha;
  const cleanBarras = onlyNumbers(codigoBarras || '');
  if (cleanBarras.length >= 10) return cleanBarras;
  return '';
}

/**
 * Evaluates duplicate status for a single candidate boleto against:
 * 1. Current list/file items
 * 2. Existing system boletos
 * 3. History of exported batches
 */
export function detectBoletoDuplicate(
  candidate: { linhaDigitavel?: string; codigoBarras?: string; id?: string; seuNumero?: string; favorecidoCnpjCpf?: string },
  currentBatchItems: Array<{ linhaDigitavel?: string; codigoBarras?: string; id?: string; seuNumero?: string; favorecidoCnpjCpf?: string }>,
  existingBoletos: BoletoItem[] = [],
  history: CNABBatchHistory[] = []
): DuplicateInfo {
  const candidateKey = getBoletoCleanKey(candidate.linhaDigitavel, candidate.codigoBarras);
  const candidateRef = candidate.seuNumero?.trim().toUpperCase();
  const candidateCnpj = onlyNumbers(candidate.favorecidoCnpjCpf || '');

  let isSameBatchDuplicate = false;
  let isSystemDuplicate = false;
  let isHistoryDuplicate = false;
  let duplicateReason = '';
  let matchedBatchFilename = '';

  // 1. Check duplicate within current file / batch
  if (currentBatchItems && currentBatchItems.length > 1) {
    const sameBatchMatches = currentBatchItems.filter((item) => {
      if (item.id && candidate.id && item.id === candidate.id) return false;
      const key = getBoletoCleanKey(item.linhaDigitavel, item.codigoBarras);
      if (candidateKey && key && candidateKey === key) return true;

      // Match by reference number + CNPJ if key is missing
      const itemRef = item.seuNumero?.trim().toUpperCase();
      const itemCnpj = onlyNumbers(item.favorecidoCnpjCpf || '');
      if (candidateRef && itemRef && candidateRef === itemRef && candidateCnpj && itemCnpj && candidateCnpj === itemCnpj) {
        return true;
      }
      return false;
    });

    if (sameBatchMatches.length > 0) {
      isSameBatchDuplicate = true;
      duplicateReason = 'Repetido no mesmo arquivo / lote';
    }
  }

  // 2. Check duplicate against existing system boletos (outside current batch)
  if (existingBoletos && existingBoletos.length > 0) {
    const existingMatch = existingBoletos.find((existing) => {
      if (candidate.id && existing.id === candidate.id) return false;
      const existingKey = getBoletoCleanKey(existing.linhaDigitavel, existing.codigoBarras);
      if (candidateKey && existingKey && candidateKey === existingKey) return true;

      const existingRef = existing.seuNumero?.trim().toUpperCase();
      const existingCnpj = onlyNumbers(existing.favorecidoCnpjCpf || '');
      if (candidateRef && existingRef && candidateRef === existingRef && candidateCnpj && existingCnpj && candidateCnpj === existingCnpj) {
        return true;
      }
      return false;
    });

    if (existingMatch) {
      isSystemDuplicate = true;
      if (!duplicateReason) {
        duplicateReason = `Já cadastrado no sistema (${existingMatch.favorecidoNome || 'Boleto cadastrado'})`;
      }
    }
  }

  // 3. Check duplicate against exported history batches
  if (history && history.length > 0) {
    for (const batch of history) {
      if (!batch.boletos) continue;
      const historyMatch = batch.boletos.find((hBoleto) => {
        if (candidate.id && hBoleto.id === candidate.id) return false;
        const hKey = getBoletoCleanKey(hBoleto.linhaDigitavel, hBoleto.codigoBarras);
        if (candidateKey && hKey && candidateKey === hKey) return true;
        return false;
      });

      if (historyMatch) {
        isHistoryDuplicate = true;
        matchedBatchFilename = batch.filename;
        if (!duplicateReason) {
          duplicateReason = `Já enviado em remessa anterior (${batch.filename})`;
        }
        break;
      }
    }
  }

  const isDuplicate = isSameBatchDuplicate || isSystemDuplicate || isHistoryDuplicate;

  return {
    isDuplicate,
    isSameBatchDuplicate,
    isSystemDuplicate,
    isHistoryDuplicate,
    duplicateReason,
    matchedBatchFilename,
  };
}

/**
 * Returns a map of boleto ID -> DuplicateInfo for an array of boletos
 */
export function getBoletosDuplicateMap(
  boletos: BoletoItem[],
  existingBoletos: BoletoItem[] = [],
  history: CNABBatchHistory[] = []
): Map<string, DuplicateInfo> {
  const map = new Map<string, DuplicateInfo>();

  for (const boleto of boletos) {
    const dupInfo = detectBoletoDuplicate(boleto, boletos, existingBoletos, history);
    map.set(boleto.id, dupInfo);
  }

  return map;
}
