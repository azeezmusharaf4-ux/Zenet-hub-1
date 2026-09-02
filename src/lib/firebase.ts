import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserLocalPersistence, onIdTokenChanged, User } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseConfigData from '../../firebase-applet-config.json';

// Set Firestore log level to error to avoid harmless stream cancellation RPC debug notices
if (typeof window !== 'undefined') {
  try {
    setLogLevel('error');
  } catch {}
}

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

// Initialize Firebase App
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth with Local Persistence
export const auth: Auth = getAuth(app);

if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Firebase Auth] Persistence initialization notice:', err);
  });
}

/**
 * Safely retrieves an ID token with a timeout to prevent UI freezes
 * after device sleep or network reconnection.
 */
export async function getSafeIdToken(user?: User | null, forceRefresh = false): Promise<string | null> {
  const targetUser = user || auth.currentUser;
  if (!targetUser) return null;

  try {
    const tokenPromise = targetUser.getIdToken(forceRefresh);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
    const token = await Promise.race([tokenPromise, timeoutPromise]);
    return token || null;
  } catch (err) {
    console.warn('[Firebase Auth] Token acquisition notice:', err);
    return null;
  }
}

// Initialize Firestore
export const db: Firestore = getFirestore(app, firebaseConfigData.firestoreDatabaseId);

// Initialize Firebase Storage
export const storage: FirebaseStorage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
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
  };
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
  };
  console.warn('Firestore Error Info: ', JSON.stringify(errInfo));
  return errInfo;
}

// Validate connection per skill instructions asynchronously without blocking auth initialization
if (typeof window !== 'undefined') {
  const testConnection = async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('Firebase connection notice: client is offline');
      } else {
        // Suppress expected transient token or network init notices during boot
        console.debug('Firebase initial connection check notice:', error);
      }
    }
  };

  // Run testConnection after the initial execution frame to avoid racing with auth token init
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => testConnection(), { timeout: 3000 });
  } else {
    setTimeout(testConnection, 1500);
  }
}

/**
 * Sanitizes object payload by recursively stripping out any undefined property values
 * to prevent Firestore SDK throws on undefined field values.
 */
export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' && item !== null ? sanitizeFirestorePayload(item) : item)) as any;
  }

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
        clean[key] = sanitizeFirestorePayload(val);
      } else {
        clean[key] = val;
      }
    }
  }
  return clean;
}

export default app;
