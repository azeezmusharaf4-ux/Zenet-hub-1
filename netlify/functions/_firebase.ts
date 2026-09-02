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

export { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction };
