import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { cleanFirestoreData } from './storage';

export interface LearnedCorrection {
  id: string;
  scope: 'GLOBAL' | 'BANK' | 'BENEFICIARY' | 'COMPANY' | 'LAYOUT' | 'DOC_PATTERN';
  bankCode?: string;
  beneficiarioNomeKey?: string; // Normalized string key
  field: string; // e.g. 'favorecidoNome', 'seuNumero', 'vencimento', 'valor'
  originalExtractedValue: string;
  correctedValue: string;
  confirmationCount: number; // 1, 2, 3...
  stage: 'OBSERVADO' | 'CONFIRMADO' | 'CONSOLIDADO';
  createdDate: string;
  lastUpdatedDate: string;
  lastEditedBy?: string;
  patternSignature?: string;
}

const STORAGE_KEY_CORRECTIONS = 'cnab_learned_corrections_v1';

/**
 * Loads learned corrections from LocalStorage and syncs with Firestore
 */
export function loadLearnedCorrections(): LearnedCorrection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CORRECTIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Corrections Memory] Erro ao carregar correções locais:', e);
  }
  return [];
}

/**
 * Saves learned corrections to LocalStorage & Firestore
 */
export function saveLearnedCorrections(corrections: LearnedCorrection[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CORRECTIONS, JSON.stringify(corrections));
    // Asynchronous Firestore sync
    corrections.forEach((c) => {
      const firestoreData = cleanFirestoreData(c);
      setDoc(doc(db, 'learned_corrections', c.id), firestoreData, { merge: true }).catch((err) =>
        console.warn('[Firestore] Sync correction warning:', err)
      );
    });
  } catch (e) {
    console.warn('[Corrections Memory] Erro ao salvar correções:', e);
  }
}

/**
 * Syncs learned corrections from Firestore into local cache on boot
 */
export async function syncLearnedCorrectionsFromCloud(): Promise<LearnedCorrection[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'learned_corrections'));
    const cloudCorrections: LearnedCorrection[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as LearnedCorrection;
      if (data && data.id) {
        cloudCorrections.push(data);
      }
    });

    if (cloudCorrections.length > 0) {
      const local = loadLearnedCorrections();
      const mergedMap = new Map<string, LearnedCorrection>();
      local.forEach((item) => mergedMap.set(item.id, item));
      cloudCorrections.forEach((item) => {
        const existing = mergedMap.get(item.id);
        if (!existing || new Date(item.lastUpdatedDate) > new Date(existing.lastUpdatedDate)) {
          mergedMap.set(item.id, item);
        }
      });
      const merged = Array.from(mergedMap.values());
      saveLearnedCorrections(merged);
      return merged;
    }
  } catch (err) {
    console.warn('[Firestore] Sync corrections error:', err);
  }
  return loadLearnedCorrections();
}

/**
 * Normalizes text strings for matching memory keys
 */
export function normalizeMemoryKey(val: string): string {
  if (!val) return '';
  return val
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Records a manual correction made by a user.
 * Increments confirmation count and promotes stage (OBSERVADO -> CONFIRMADO -> CONSOLIDADO)
 */
export function recordUserCorrection(
  field: string,
  originalExtractedValue: any,
  correctedValue: any,
  bankCode?: string,
  beneficiarioNome?: string,
  patternSignature?: string,
  userEmail?: string
): LearnedCorrection | null {
  const origStr = String(originalExtractedValue || '').trim();
  const corrStr = String(correctedValue || '').trim();

  if (!origStr || !corrStr || origStr === corrStr) {
    return null; // No actual change
  }

  const corrections = loadLearnedCorrections();
  const benefKey = normalizeMemoryKey(beneficiarioNome || '');
  const fieldKey = field.trim();

  // Look for existing correction in hierarchy
  const existingIndex = corrections.findIndex(
    (c) =>
      c.field === fieldKey &&
      c.originalExtractedValue === origStr &&
      c.beneficiarioNomeKey === benefKey &&
      (!bankCode || c.bankCode === bankCode)
  );

  let updatedCorrection: LearnedCorrection;

  if (existingIndex !== -1) {
    const existing = corrections[existingIndex];
    existing.confirmationCount += 1;
    existing.correctedValue = corrStr; // Update to latest corrected value
    existing.lastUpdatedDate = new Date().toISOString();
    if (userEmail) existing.lastEditedBy = userEmail;

    // Promote stage based on confirmation count
    if (existing.confirmationCount >= 50) {
      existing.stage = 'CONSOLIDADO';
    } else if (existing.confirmationCount >= 5) {
      existing.stage = 'CONFIRMADO';
    } else {
      existing.stage = 'OBSERVADO';
    }

    updatedCorrection = existing;
    corrections[existingIndex] = existing;
  } else {
    const scope: LearnedCorrection['scope'] = benefKey ? 'BENEFICIARY' : bankCode ? 'BANK' : 'GLOBAL';
    updatedCorrection = {
      id: `corr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      scope,
      bankCode,
      beneficiarioNomeKey: benefKey,
      field: fieldKey,
      originalExtractedValue: origStr,
      correctedValue: corrStr,
      confirmationCount: 1,
      stage: 'OBSERVADO',
      createdDate: new Date().toISOString(),
      lastUpdatedDate: new Date().toISOString(),
      lastEditedBy: userEmail,
      patternSignature,
    };
    corrections.unshift(updatedCorrection);
  }

  saveLearnedCorrections(corrections);
  console.log(
    `[Learned Correction] Registrada com Sucesso (${updatedCorrection.stage}): Campo '${field}' => '${corrStr}' (Confirmado ${updatedCorrection.confirmationCount}x)`
  );

  return updatedCorrection;
}

/**
 * Applies active hierarchical corrections to an extracted boleto object
 */
export function applyLearnedCorrectionsToBoleto(
  boleto: any,
  corrections: LearnedCorrection[] = loadLearnedCorrections()
): { boleto: any; appliedCorrections: string[] } {
  if (!boleto || corrections.length === 0) return { boleto, appliedCorrections: [] };

  const copy = { ...boleto };
  const applied: string[] = [];
  const benefKey = normalizeMemoryKey(copy.favorecidoNome || copy.beneficiario || '');
  const bankCode = copy.bancoCodigo;

  for (const corr of corrections) {
    // Only apply CONFIRMADO (5+ times) or CONSOLIDADO (50+ times) automatically to ensure safety
    if (corr.stage === 'OBSERVADO') continue;

    const matchesBenef = !corr.beneficiarioNomeKey || corr.beneficiarioNomeKey === benefKey;
    const matchesBank = !corr.bankCode || corr.bankCode === bankCode;

    if (matchesBenef && matchesBank) {
      const field = corr.field;
      const currentVal = String(copy[field] || '').trim();

      if (currentVal === corr.originalExtractedValue) {
        copy[field] = corr.correctedValue;
        applied.push(`Campo '${field}' ajustado via memória aprendida [${corr.stage}]: ${corr.correctedValue}`);
      }
    }
  }

  return { boleto: copy, appliedCorrections: applied };
}

/**
 * Delete / Revert a learned correction
 */
export function deleteLearnedCorrection(id: string): void {
  const corrections = loadLearnedCorrections();
  const updated = corrections.filter((c) => c.id !== id);
  saveLearnedCorrections(updated);
  deleteDoc(doc(db, 'learned_corrections', id)).catch((err) =>
    console.warn('[Firestore] Error deleting correction:', err)
  );
}
