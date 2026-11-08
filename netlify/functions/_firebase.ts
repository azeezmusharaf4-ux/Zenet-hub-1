import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, type Auth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, runTransaction, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0874836857",
  appId: process.env.FIREBASE_APP_ID || "1:547531748438:web:d46a93954047839330b7f7",
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCV6oap4QQtnQyG8lD0l42L8UTKZfaFJIc",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "gen-lang-client-0874836857.firebaseapp.com",
  firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || "ai-studio-zenetmarketplace-7ba093fa-b6fb-4165-994b-445510dd6aa9",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "gen-lang-client-0874836857.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "547531748438",
};

const SERVER_SERVICE_EMAIL = 'zenet-backend-service@zenetmarketplace.internal';
const SERVER_SERVICE_PASSWORD = 'ZenetSecureSystemBackend2026!#';

let db: Firestore | null = null;
let authInstance: Auth | null = null;

export async function ensureServerAuthenticated(): Promise<boolean> {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    if (!authInstance) {
      authInstance = getAuth(app);
    }
    if (authInstance.currentUser && authInstance.currentUser.email === SERVER_SERVICE_EMAIL) {
      return true;
    }
    try {
      await signInWithEmailAndPassword(authInstance, SERVER_SERVICE_EMAIL, SERVER_SERVICE_PASSWORD);
      return true;
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(authInstance, SERVER_SERVICE_EMAIL, SERVER_SERVICE_PASSWORD);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  } catch (e) {
    console.warn('[Netlify Firebase Auth] ensureServerAuthenticated notice:', e);
    return false;
  }
}

export function getDb(): Firestore {
  if (db) return db;
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
    return db;
  } catch (err) {
    console.warn('[Netlify Firebase] Init notice:', err);
    const app = getApps()[0] || initializeApp(firebaseConfig);
    db = getFirestore(app);
    return db;
  }
}

export async function getAuthenticatedDb(): Promise<Firestore | null> {
  await ensureServerAuthenticated();
  return getDb();
}

export interface DecodedAuthToken {
  uid: string;
  email?: string;
}

export function parseAndVerifyToken(authHeader?: string): DecodedAuthToken | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    // Allow 5 minutes clock-skew grace period
    if (payload.exp && (payload.exp + 300) < now) return null;

    const uid = payload.sub || payload.user_id;
    if (!uid) return null;

    if (payload.iss && !payload.iss.startsWith('https://securetoken.google.com/')) {
      return null;
    }

    const validProjectIds = [
      firebaseConfig.projectId,
      'gen-lang-client-0874836857',
      'ai-studio-zenetmarketplace-7ba093fa-b6fb-4165-994b-445510dd6aa9'
    ].filter(Boolean);

    if (payload.aud && validProjectIds.length > 0) {
      const matchesAud = validProjectIds.some(pid =>
        payload.aud === pid || payload.aud.includes(pid) || pid.includes(payload.aud)
      );
      if (!matchesAud && payload.iss !== `https://securetoken.google.com/${payload.aud}`) {
        return null;
      }
    }

    return {
      uid,
      email: payload.email
    };
  } catch {
    return null;
  }
}

export { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, runTransaction };
