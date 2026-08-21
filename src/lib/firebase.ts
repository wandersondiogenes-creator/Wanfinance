import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  getDocs,
  disableNetwork,
  SetOptions,
  Query,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const STORAGE_QUOTA_KEY = 'FIRESTORE_QUOTA_EXHAUSTED_TIME';

function checkInitialQuotaExceeded(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_QUOTA_KEY);
    if (saved) {
      const time = parseInt(saved, 10);
      // Quotas reset daily. If marked within the last 12 hours, keep quota circuit breaker active.
      if (!isNaN(time) && Date.now() - time < 12 * 60 * 60 * 1000) {
        return true;
      }
    }
  } catch (_) {}
  return false;
}

// In-memory & persistent circuit breaker flag for Firestore quota exhaustion
let firestoreQuotaExceeded = checkInitialQuotaExceeded();
let quotaWarningLogged = false;

// If already exceeded on startup, disable network immediately to stop background retry storm
if (firestoreQuotaExceeded) {
  try {
    disableNetwork(db).catch(() => {});
  } catch (_) {}
}

export function isFirestoreQuotaExceeded(): boolean {
  return firestoreQuotaExceeded;
}

export function setFirestoreQuotaExceeded(exceeded: boolean) {
  firestoreQuotaExceeded = exceeded;
  if (exceeded) {
    try {
      localStorage.setItem(STORAGE_QUOTA_KEY, Date.now().toString());
    } catch (_) {}
    if (!quotaWarningLogged) {
      quotaWarningLogged = true;
      console.warn(
        '[Firestore Quota Breaker] Cota diária gratuita do Firestore atingida. Conexão pausada para evitar repetições. O app continuará funcionando normalmente com persistência local e Supabase.'
      );
    }
    try {
      disableNetwork(db).catch(() => {});
    } catch (_) {}
  }
}

/**
 * Safe wrapper for setDoc that handles quota limits and prevents backoff retry storms
 */
export async function safeSetDoc(
  docRef: any,
  data: any,
  options?: SetOptions
): Promise<boolean> {
  if (firestoreQuotaExceeded) {
    return false;
  }

  try {
    if (options) {
      await setDoc(docRef, data, options);
    } else {
      await setDoc(docRef, data);
    }
    return true;
  } catch (error: any) {
    const errorMsg = String(error?.message || error || '');
    if (
      errorMsg.includes('resource-exhausted') ||
      errorMsg.includes('Quota limit exceeded') ||
      errorMsg.includes('Quota exceeded') ||
      error?.code === 'resource-exhausted'
    ) {
      setFirestoreQuotaExceeded(true);
      return false;
    }
    console.warn(`[Firestore] Sync error at ${docRef?.path || 'unknown'}:`, errorMsg);
    return false;
  }
}

/**
 * Safe wrapper for deleteDoc with quota checking
 */
export async function safeDeleteDoc(docRef: any): Promise<boolean> {
  if (firestoreQuotaExceeded) {
    return false;
  }

  try {
    await deleteDoc(docRef);
    return true;
  } catch (error: any) {
    const errorMsg = String(error?.message || error || '');
    if (
      errorMsg.includes('resource-exhausted') ||
      errorMsg.includes('Quota limit exceeded') ||
      errorMsg.includes('Quota exceeded') ||
      error?.code === 'resource-exhausted'
    ) {
      setFirestoreQuotaExceeded(true);
      return false;
    }
    console.warn(`[Firestore] Delete error at ${docRef?.path || 'unknown'}:`, errorMsg);
    return false;
  }
}

/**
 * Safe wrapper for getDocs with quota checking
 */
export async function safeGetDocs(
  queryObj: Query<DocumentData, DocumentData>
): Promise<QuerySnapshot<DocumentData, DocumentData> | null> {
  if (firestoreQuotaExceeded) {
    return null;
  }

  try {
    return await getDocs(queryObj);
  } catch (error: any) {
    const errorMsg = String(error?.message || error || '');
    if (
      errorMsg.includes('resource-exhausted') ||
      errorMsg.includes('Quota limit exceeded') ||
      errorMsg.includes('Quota exceeded') ||
      error?.code === 'resource-exhausted'
    ) {
      setFirestoreQuotaExceeded(true);
      return null;
    }
    console.warn('[Firestore] Query error:', errorMsg);
    return null;
  }
}

export async function testFirestoreConnection() {
  if (firestoreQuotaExceeded) return false;
  try {
    await getDocFromServer(doc(db, 'system', 'connection_test'));
    console.log('[Firebase] Firestore database connected successfully!');
    return true;
  } catch (error: any) {
    const errorMsg = String(error?.message || error || '');
    if (
      errorMsg.includes('resource-exhausted') ||
      errorMsg.includes('Quota limit exceeded') ||
      error?.code === 'resource-exhausted'
    ) {
      setFirestoreQuotaExceeded(true);
      return false;
    }
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn('[Firebase] Firestore offline or network check:', error.message);
    } else {
      console.log('[Firebase] Connection check:', error);
    }
    return false;
  }
}
