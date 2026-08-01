import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'system', 'connection_test'));
    console.log('[Firebase] Firestore database connected successfully!');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn('[Firebase] Firestore offline or network check:', error.message);
    } else {
      console.log('[Firebase] Connection check:', error);
    }
    return false;
  }
}
