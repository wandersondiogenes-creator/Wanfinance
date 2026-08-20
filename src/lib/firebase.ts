import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc, deleteDoc, SetOptions } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// In-memory circuit breaker flag for Firestore quota exhaustion
let firestoreQuotaExceeded = false;
let quotaWarningLogged = false;

export function isFirestoreQuotaExceeded(): boolean {
  return firestoreQuotaExceeded;
}

export function setFirestoreQuotaExceeded(exceeded: boolean) {
  firestoreQuotaExceeded = exceeded;
  if (exceeded && !quotaWarningLogged) {
    quotaWarningLogged = true;
    console.warn(
      '[Firestore Quota Breaker] Cota diária gratuita do Firestore atingida. O app continuará funcionando normalmente com persistência local (LocalStorage / Supabase).'
    );
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
      error?.code === 'resource-exhausted'
    ) {
      setFirestoreQuotaExceeded(true);
      return false;
    }
    console.warn(`[Firestore] Delete error at ${docRef?.path || 'unknown'}:`, errorMsg);
    return false;
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
