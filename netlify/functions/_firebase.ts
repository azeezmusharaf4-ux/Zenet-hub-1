import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0874836857",
  appId: "1:547531748438:web:d46a93954047839330b7f7",
  apiKey: "AIzaSyCV6oap4QQtnQyG8lD0l42L8UTKZfaFJIc",
  authDomain: "gen-lang-client-0874836857.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-zenetmarketplace-7ba093fa-b6fb-4165-994b-445510dd6aa9",
  storageBucket: "gen-lang-client-0874836857.firebasestorage.app",
  messagingSenderId: "547531748438",
};

let db: Firestore | null = null;

export function getDb(): Firestore | null {
  if (db) return db;
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    return db;
  } catch (err) {
    console.warn('[Netlify Firebase] Init notice:', err);
    return null;
  }
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
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    if (payload.iss !== `https://securetoken.google.com/${firebaseConfig.projectId}`) return null;
    if (payload.aud !== firebaseConfig.projectId) return null;
    return {
      uid: payload.sub || payload.user_id,
      email: payload.email
    };
  } catch {
    return null;
  }
}

export { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction };
