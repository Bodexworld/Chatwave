import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';
import toast from 'react-hot-toast';

const app = initializeApp(firebaseConfig);

// Initialize Firestore without persistent cache to avoid indexeddb hangs
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();

export const messaging = typeof window !== 'undefined' && 'Notification' in window ? getMessaging(app) : null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));

  // The instruction mandates throwing specifically for Missing or insufficient permissions.
  // Quota exceeded should not crash the entire app if possible.
  const errorMsg = errInfo.error.toLowerCase();
  
  if (errorMsg.includes("missing or insufficient permissions") || errorMsg.includes("permission_denied")) {
    throw new Error(JSON.stringify(errInfo));
  } else if (errorMsg.includes("quota exceeded")) {
    // Show a user friendly message instead of crashing
    toast.error("Cloud database limits reached for today. Please try again tomorrow or upgrade your plan.", { id: 'quota-error' });
  } else {
    // Throw other critical errors
    throw new Error(JSON.stringify(errInfo));
  }
}

// Check connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
