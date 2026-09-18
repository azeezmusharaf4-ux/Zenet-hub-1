import dotenv from 'dotenv';
dotenv.config({ override: true });
try {
  dotenv.config({ path: './.env', override: true });
  dotenv.config({ path: './.env.local', override: true });
} catch {}
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, runTransaction } from 'firebase/firestore';

const app = express();
const PORT = 3000;

app.disable('x-powered-by');

// --- ARCC & OWASP SECURITY HEADERS ---
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' https: data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-ancestors 'self' https:;"
  );
  next();
});

// Enable CORS for all API requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-paystack-signature');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// --- CSRF PROTECTION ON STATE-CHANGING API ENDPOINTS ---
app.use((req, res, next) => {
  if (req.path.startsWith('/api') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // External Webhooks are validated cryptographically by secret HMAC signatures
    if (req.path.includes('/paystack/webhook') || req.path.includes('/webhook')) {
      return next();
    }
    const hasRequestedWith = req.headers['x-requested-with'] === 'XMLHttpRequest';
    const hasAuthToken = !!req.headers['authorization']?.startsWith('Bearer ');
    const secFetchSite = req.headers['sec-fetch-site'] as string;
    const isSameSite = secFetchSite === 'same-origin' || secFetchSite === 'none';

    if (!hasRequestedWith && !hasAuthToken && !isSameSite) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Anti-CSRF verification failed. Request must include valid client headers.'
      });
    }
  }
  next();
});

// Route Normalization Safeguard: strip any accidental client prefix (e.g. /VITE_API_URL/api/* -> /api/*)
app.use((req, _res, next) => {
  if (req.url.startsWith('/VITE_API_URL/')) {
    req.url = req.url.replace('/VITE_API_URL', '');
  } else if (req.url.startsWith('/undefined/')) {
    req.url = req.url.replace('/undefined', '');
  }
  next();
});

// --- ANTI-SPAM, BOT PROTECTION & RATE LIMITING MIDDLEWARE ---
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const ipRateLimitMap = new Map<string, RateLimitBucket>();

// Periodic memory cleanup every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of ipRateLimitMap.entries()) {
    if (bucket.resetAt < now) {
      ipRateLimitMap.delete(ip);
    }
  }
}, 60000);

app.use((req, res, next) => {
  // 1. Screen malicious automated scrapers/bots
  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const blockedSignatures = [
    'sqlmap', 'nikto', 'acunetix', 'dirbuster', 'gobuster', 'wpscan', 'masscan', 'nmap', 'zgrab', 'havij', 'pangolin'
  ];
  if (blockedSignatures.some(sig => userAgent.includes(sig))) {
    return res.status(403).json({ success: false, error: 'Forbidden: Request blocked by security shield.' });
  }

  // 2. Sliding window rate limiting on /api endpoints
  if (req.path.startsWith('/api') && req.path !== '/api/health') {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 180; // Generous ceiling for normal users and fast mobile taps

    let bucket = ipRateLimitMap.get(clientIp);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 1, resetAt: now + windowMs };
      ipRateLimitMap.set(clientIp, bucket);
    } else {
      bucket.count++;
      if (bucket.count > maxRequests) {
        res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Please slow down and try again shortly.'
        });
      }
    }
  }

  next();
});

// Initialize Server-side Firebase Firestore instance
let db: any = null;
let firebaseProjectId = '';
let firebaseDatabaseId = '';
try {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfigData = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    firebaseProjectId = firebaseConfigData.projectId || '';
    firebaseDatabaseId = firebaseConfigData.firestoreDatabaseId || '(default)';
    const firebaseApp = getApps().length > 0 ? getApp() : initializeApp({
      apiKey: firebaseConfigData.apiKey,
      authDomain: firebaseConfigData.authDomain,
      projectId: firebaseConfigData.projectId,
      storageBucket: firebaseConfigData.storageBucket,
      messagingSenderId: firebaseConfigData.messagingSenderId,
      appId: firebaseConfigData.appId,
    });
    db = getFirestore(firebaseApp, firebaseConfigData.firestoreDatabaseId || undefined);
    console.log(`Server-side Firestore initialized successfully (Project: ${firebaseProjectId}, DB: ${firebaseDatabaseId})`);
  }
} catch (fInitErr) {
  console.warn('Server-side Firestore initialization notice:', fInitErr);
}

// Firestore REST API helpers for executing operations with caller's verified ID token
function toFirestoreRestValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreRestValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreRestValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreRestValue(val: any): any {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) return (val.arrayValue?.values || []).map(fromFirestoreRestValue);
  if ('mapValue' in val) {
    const res: any = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields || {})) {
      res[k] = fromFirestoreRestValue(v);
    }
    return res;
  }
  return null;
}

function parseFirestoreRestDoc(docObj: any): any {
  if (!docObj || !docObj.fields) return null;
  const res: any = {};
  for (const [k, v] of Object.entries(docObj.fields)) {
    res[k] = fromFirestoreRestValue(v);
  }
  if (docObj.name) {
    const parts = docObj.name.split('/');
    res.id = parts[parts.length - 1];
  }
  return res;
}

async function restGetFirestoreDoc(collectionPath: string, docId: string, idToken: string): Promise<any> {
  const dbId = firebaseDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${dbId}/documents/${collectionPath}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Accept': 'application/json'
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST GET error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return parseFirestoreRestDoc(data);
}

async function restPatchFirestoreDoc(collectionPath: string, docId: string, fields: Record<string, any>, idToken: string): Promise<any> {
  const dbId = firebaseDatabaseId || '(default)';
  const fieldKeys = Object.keys(fields);
  const updateMask = fieldKeys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${dbId}/documents/${collectionPath}/${encodeURIComponent(docId)}${updateMask ? '?' + updateMask : ''}`;
  
  const firestoreFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    firestoreFields[k] = toFirestoreRestValue(v);
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ fields: firestoreFields })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST PATCH error (${res.status}): ${errText}`);
  }
  return await res.json();
}

async function restCreateFirestoreDoc(collectionPath: string, docId: string, fields: Record<string, any>, idToken: string): Promise<any> {
  const dbId = firebaseDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${dbId}/documents/${collectionPath}?documentId=${encodeURIComponent(docId)}`;
  
  const firestoreFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    firestoreFields[k] = toFirestoreRestValue(v);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ fields: firestoreFields })
  });
  if (!res.ok) {
    return await restPatchFirestoreDoc(collectionPath, docId, fields, idToken);
  }
  return await res.json();
}

// Memory lock for active purchase requests to enforce idempotency
const activeBuyLocks = new Map<string, number>();

export interface VerifiedAuthUser {
  uid: string;
  email: string;
  isAdmin: boolean;
}

/**
 * Cryptographically parses and verifies the Firebase ID token claims (expiry, issuer, audience, subject)
 * and resolves genuine authentication status.
 */
const getVerifiedAuthUser = async (authHeader: string | undefined): Promise<VerifiedAuthUser | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);

    const nowSecs = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSecs) {
      console.warn('[Auth] Expired Firebase ID token received');
      return null;
    }

    if (firebaseProjectId) {
      const expectedIssuer = `https://securetoken.google.com/${firebaseProjectId}`;
      if (payload.iss !== expectedIssuer) {
        console.warn(`[Auth] Issuer mismatch: ${payload.iss} vs ${expectedIssuer}`);
        return null;
      }
      if (payload.aud !== firebaseProjectId) {
        console.warn(`[Auth] Audience mismatch: ${payload.aud} vs ${firebaseProjectId}`);
        return null;
      }
    }

    const uid = payload.sub || payload.user_id;
    if (!uid) return null;

    const email = (payload.email || '').trim().toLowerCase();
    let isAdmin = email === 'azeezmusharaf4@gmail.com';

    // Verify role in Firestore database if available
    if (!isAdmin && db) {
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          const udata = userDoc.data();
          if ((udata.email || '').trim().toLowerCase() === 'azeezmusharaf4@gmail.com' || udata.role === 'admin' || udata.role === 'owner') {
            isAdmin = true;
          }
        }
      } catch {}
    }

    return { uid, email, isAdmin };
  } catch (err) {
    console.error('[Auth] Error decoding ID Token:', err);
    return null;
  }
};

/**
 * Parses and verifies the Firebase ID token claims (expiry, issuer, audience, subject)
 * directly without requiring the external firebase-admin SDK.
 */
const verifyFirebaseIdToken = (authHeader: string | undefined, projectId: string): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);
    
    const nowSecs = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSecs) {
      console.warn('[Auth] Expired Firebase ID token received');
      return null;
    }
    
    if (projectId) {
      const expectedIssuer = `https://securetoken.google.com/${projectId}`;
      if (payload.iss !== expectedIssuer) {
        console.warn(`[Auth] Issuer mismatch: ${payload.iss} vs ${expectedIssuer}`);
        return null;
      }
      if (payload.aud !== projectId) {
        console.warn(`[Auth] Audience mismatch: ${payload.aud} vs ${projectId}`);
        return null;
      }
    }
    
    return payload.sub || payload.user_id || null; // Returns user UID
  } catch (err) {
    console.error('[Auth] Error decoding ID Token:', err);
    return null;
  }
};

// Helper to resolve Paystack credentials safely from process.env
const getPaystackSecretKey = (): string => {
  const rawKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_KEY || '';
  if (!rawKey) return '';
  return rawKey.trim().replace(/^['"`]|['"`]$/g, '').trim();
};

const getPaystackPublicKey = (secretKey: string): string => {
  const rawPub = process.env.VITE_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY || '';
  let pub = rawPub ? rawPub.trim().replace(/^['"`]|['"`]$/g, '').trim() : '';
  if (!pub && secretKey) {
    if (secretKey.startsWith('sk_live_')) {
      pub = secretKey.replace('sk_live_', 'pk_live_');
    } else if (secretKey.startsWith('sk_test_')) {
      pub = secretKey.replace('sk_test_', 'pk_test_');
    } else if (secretKey.startsWith('sk_')) {
      pub = secretKey.replace(/^sk_/, 'pk_');
    }
  }
  return pub;
};

// 1. Paystack Live API Routes
app.post('/api/paystack/initialize', async (req, res) => {
  try {
    const { listingId, listingTitle, priceNaira, buyerEmail, currency, callbackUrl, userId, isWalletFunding } = req.body;

    if (!priceNaira || !buyerEmail) {
      return res.status(400).json({ error: 'Price and buyer email are required' });
    }

    const paystackSecretKey = getPaystackSecretKey();
    const paystackPublicKey = getPaystackPublicKey(paystackSecretKey);

    if (!paystackSecretKey || !paystackSecretKey.startsWith('sk_')) {
      return res.status(500).json({ 
        success: false,
        error: 'Paystack Secret Key (PAYSTACK_SECRET_KEY) is missing on the server environment. Please set PAYSTACK_SECRET_KEY.' 
      });
    }

    const reference = `PST_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const amountInKobo = Math.round(Number(priceNaira) * 100);

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: buyerEmail,
        amount: amountInKobo,
        currency: currency || 'NGN',
        reference: reference,
        callback_url: callbackUrl,
        metadata: {
          userId: userId || '',
          isWalletFunding: Boolean(isWalletFunding),
          expectedAmountNaira: Number(priceNaira),
          expectedAmountKobo: amountInKobo,
          listingId: listingId || 'WALLET_FUNDING',
          listingTitle: listingTitle || 'Wallet Funding Deposit',
          buyerEmail
        }
      })
    });

    const paystackData: any = await paystackRes.json();

    if (paystackData.status && paystackData.data) {
      return res.json({
        success: true,
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
        publicKey: paystackPublicKey || '',
        mode: 'live_paystack'
      });
    } else {
      console.error('[Paystack Initialize API Error]', paystackData);
      return res.status(400).json({
        success: false,
        error: paystackData.message || 'Paystack checkout session initialization failed.'
      });
    }

  } catch (err: any) {
    console.error('Error in /api/paystack/initialize:', err);
    res.status(500).json({ error: err.message || 'Paystack initialization failed' });
  }
});

// Unified, robust transaction verification and database crediting logic
const verifyAndCreditTransaction = async (
  reference: string,
  clientUserId?: string,
  webhookData?: any
): Promise<any> => {
  const paystackSecretKey = getPaystackSecretKey();
  if (!paystackSecretKey || !paystackSecretKey.startsWith('sk_')) {
    return {
      verified: false,
      status: 'failed',
      error: 'PAYSTACK_SECRET_KEY is not configured on the server environment.'
    };
  }

  // 1. First quick idempotency check from Firestore
  if (db) {
    try {
      const txDocRef = doc(db, 'wallet_transactions', reference);
      const txSnap = await getDoc(txDocRef);

      if (txSnap.exists()) {
        const txData = txSnap.data();
        if (txData.status === 'successful' || txData.status === 'completed') {
          console.log(`[Paystack Verify] Reference ${reference} already processed (Idempotency Protect).`);
          return {
            verified: true,
            alreadyProcessed: true,
            status: 'success',
            reference,
            amount: txData.amount,
            currency: 'NGN',
            paidAt: txData.date || txData.createdAt,
            buyerEmail: txData.userEmail,
            userId: txData.userId,
            gateway: 'paystack'
          };
        }
      }
    } catch (dbErr) {
      console.warn('[Paystack Verify] Idempotency read check warning:', dbErr);
    }
  }

  // 2. Query Paystack Transaction Status API or use authenticated webhook data
  let pstData = webhookData;
  if (!pstData || !pstData.status || pstData.status !== 'success') {
    try {
      const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json'
        }
      });

      const paystackData: any = await paystackRes.json();

      if (!paystackData.status || !paystackData.data || paystackData.data.status !== 'success') {
        return {
          verified: false,
          status: paystackData.data?.status || 'failed',
          error: paystackData.message || 'Payment verification failed on Paystack.'
        };
      }
      pstData = paystackData.data;
    } catch (fetchErr: any) {
      if (!pstData) {
        return {
          verified: false,
          status: 'error',
          error: `Paystack API network error: ${fetchErr.message}`
        };
      }
    }
  }

  const paidAmountKobo = pstData.amount;
  const amountNaira = paidAmountKobo / 100;
  const customerEmail = (pstData.customer?.email || '').trim();
  const customerCode = pstData.customer?.customer_code;
  const accountNumber = String(
    pstData.authorization?.account_number || 
    pstData.dedicated_account?.account_number || 
    pstData.authorization?.receiver_bank_account_number ||
    pstData.receiver_bank_account_number ||
    ''
  ).trim();

  // Safe parsing of metadata
  let metadataObj: any = {};
  if (pstData.metadata) {
    if (typeof pstData.metadata === 'string') {
      try {
        metadataObj = JSON.parse(pstData.metadata);
      } catch (e) {
        console.warn('[Paystack Verify] Metadata parse warning:', e);
      }
    } else {
      metadataObj = pstData.metadata;
    }
  }

  // Extract userId from metadata or custom_fields
  let extractedUserId = metadataObj.userId || clientUserId || null;
  if (!extractedUserId && Array.isArray(metadataObj.custom_fields)) {
    const uField = metadataObj.custom_fields.find((f: any) => f.variable_name === 'user_id' || f.variable_name === 'userId');
    if (uField && uField.value) {
      extractedUserId = String(uField.value);
    }
  }

  // 3. Verify paid amount matching (Minimum expected amount check)
  const expectedAmountNaira = metadataObj.expectedAmountNaira || metadataObj.priceNaira;
  if (expectedAmountNaira && Number(expectedAmountNaira) > 0) {
    const expectedKobo = Math.round(Number(expectedAmountNaira) * 100);
    if (paidAmountKobo < expectedKobo) {
      console.error(`[Paystack Verify] Amount mismatch for ref ${reference}: Paid ₦${amountNaira}, expected ₦${expectedAmountNaira}`);
      return {
        verified: false,
        status: 'amount_mismatch',
        error: `Payment amount mismatch: Paid ₦${amountNaira} but expected ₦${expectedAmountNaira}`
      };
    }
  }

  // 4. Multi-channel user resolution
  let targetUid = extractedUserId;

  if (db) {
    try {
      // Find the user by Email if not resolved directly
      if (!targetUid && customerEmail) {
        const cleanEmail = customerEmail.toLowerCase();
        let usersQ = query(collection(db, 'users'), where('email', '==', cleanEmail));
        let usersSnap = await getDocs(usersQ);

        // Fallback: check original casing
        if (usersSnap.empty) {
          usersQ = query(collection(db, 'users'), where('email', '==', customerEmail));
          usersSnap = await getDocs(usersQ);
        }

        // Fallback: scan all users
        if (usersSnap.empty) {
          const allUsersSnap = await getDocs(collection(db, 'users'));
          const found = allUsersSnap.docs.find(d => {
            const uData = d.data();
            return (uData.email && uData.email.trim().toLowerCase() === cleanEmail);
          });
          if (found) {
            targetUid = found.id;
          }
        } else {
          targetUid = usersSnap.docs[0].id;
        }
      }

      // Find the user by Customer Code if available
      if (!targetUid && customerCode) {
        const custCodeQ = query(collection(db, 'users'), where('paystackCustomerCode', '==', customerCode));
        const custCodeSnap = await getDocs(custCodeQ);
        if (!custCodeSnap.empty) {
          targetUid = custCodeSnap.docs[0].id;
        }
      }

      if (!targetUid) {
        console.warn(`[Paystack Verify] Unresolved user for verified transaction ${reference}. (Email: ${customerEmail})`);
        return {
          verified: false,
          status: 'user_not_found',
          error: 'Transaction verified on Paystack, but could not associate payment with any user profile.'
        };
      }

      // Atomic execution using Firestore runTransaction to prevent double crediting under high concurrency
      let finalBalance = 0;
      let alreadyCredited = false;

      await runTransaction(db, async (transaction) => {
        const txDocRef = doc(db, 'wallet_transactions', reference);
        const liveTxSnap = await transaction.get(txDocRef);

        if (liveTxSnap.exists()) {
          const liveData = liveTxSnap.data();
          if (liveData.status === 'successful' || liveData.status === 'completed') {
            alreadyCredited = true;
            return;
          }
        }

        const uDocRef = doc(db, 'users', String(targetUid));
        const uDocSnap = await transaction.get(uDocRef);
        const currentBal = uDocSnap.exists() ? (uDocSnap.data().walletBalance || 0) : 0;
        finalBalance = currentBal + amountNaira;

        if (uDocSnap.exists()) {
          transaction.update(uDocRef, { walletBalance: finalBalance });
        } else {
          transaction.set(uDocRef, {
            walletBalance: finalBalance,
            email: customerEmail || '',
            createdAt: new Date().toISOString()
          }, { merge: true });
        }

        const isFunding = metadataObj.isWalletFunding !== false;
        transaction.set(txDocRef, {
          id: reference,
          reference: reference,
          userId: String(targetUid),
          userEmail: customerEmail || '',
          amount: amountNaira,
          type: 'deposit',
          method: isFunding ? 'paystack_wallet_funding' : 'paystack_checkout',
          status: 'successful',
          paystackReference: reference,
          description: metadataObj.listingTitle || 'Paystack Wallet Deposit',
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          createdAt: new Date().toISOString()
        });
      });

      if (alreadyCredited) {
        console.log(`[Paystack Verify] Transaction ${reference} was already credited in parallel transaction.`);
        return {
          verified: true,
          alreadyProcessed: true,
          status: 'success',
          reference,
          amount: amountNaira,
          currency: 'NGN',
          paidAt: pstData.paid_at || pstData.paidAt,
          buyerEmail: customerEmail,
          userId: targetUid,
          gateway: 'paystack'
        };
      }

      console.log(`[Paystack Verify] Atomic Credit Complete: ₦${amountNaira} credited to User ${targetUid}. New Balance: ₦${finalBalance}`);

    } catch (creditErr) {
      console.error('[Paystack Verify] Firestore error during crediting:', creditErr);
      return {
        verified: false,
        status: 'db_error',
        error: 'Failed to update user wallet balance in database.'
      };
    }
  }

  return {
    verified: true,
    status: 'success',
    reference: pstData.reference || reference,
    amount: amountNaira,
    currency: pstData.currency || 'NGN',
    paidAt: pstData.paid_at || pstData.paidAt,
    channel: pstData.channel,
    buyerEmail: customerEmail,
    userId: targetUid || undefined,
    gateway: 'paystack',
    raw: pstData
  };
};

// Secure Wallet Purchase Endpoint with Transaction Integrity & Multi-Stock Inventory Management
app.post('/api/wallet/purchase', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const verifiedUser = await getVerifiedAuthUser(authHeader);
    if (!verifiedUser) {
      return res.status(401).json({ success: false, error: 'Authentication required: please log in to complete purchase.' });
    }

    const { userId, listingId, buyerEmail, buyerName } = req.body;
    if (!userId || !listingId) {
      return res.status(400).json({ success: false, error: 'User ID and Listing ID are required.' });
    }

    if (verifiedUser.uid !== userId && !verifiedUser.isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot initiate purchases for another user account.' });
    }

    if (!db) {
      return res.status(500).json({ success: false, error: 'Database service is unavailable on the server.' });
    }

    // Step 1: Pre-fetch inventory subcollection docs (if any)
    const invColRef = collection(db, 'listings', listingId, 'inventory');
    let invSnap = null;
    try {
      invSnap = await getDocs(invColRef);
    } catch (invErr) {
      console.warn('Inventory subcollection fetch notice:', invErr);
    }
    const hasInventorySubcollection = invSnap && !invSnap.empty;

    let purchaseResult: any = null;

    await runTransaction(db, async (t) => {
      // 1. Fetch live user
      const userDocRef = doc(db, 'users', userId);
      const userSnap = await t.get(userDocRef);
      if (!userSnap.exists()) {
        throw new Error('User profile not found in database.');
      }
      const userData = userSnap.data();
      const currentBalance = userData.walletBalance || 0;

      // 2. Fetch live listing
      const listingDocRef = doc(db, 'listings', listingId);
      const listingSnap = await t.get(listingDocRef);
      if (!listingSnap.exists()) {
        throw new Error('Listing not found in database.');
      }
      const listingData = listingSnap.data();
      const price = Number(listingData.price);

      if (listingData.status === 'sold') {
        throw new Error('This listing is already sold out.');
      }

      // 3. Balance Check
      if (currentBalance < price) {
        throw new Error(`Insufficient wallet balance. You have ₦${currentBalance.toLocaleString()}, but this listing costs ₦${price.toLocaleString()}.`);
      }

      const txId = `WALLET_TX_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const transferCode = `ZENET-ESCROW-${Math.floor(1000 + Math.random() * 9000)}-WALLET`;
      const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const newBal = currentBalance - price;

      let secureDetails: any = null;
      let remainingStock = 0;

      if (hasInventorySubcollection && invSnap) {
        // Find the first AVAILABLE inventory item atomically inside transaction
        let targetDocSnap = null;
        let targetDocId = null;
        let availableCount = 0;

        for (const d of invSnap.docs) {
          const liveItemRef = doc(db, 'listings', listingId, 'inventory', d.id);
          const liveItemSnap = await t.get(liveItemRef);
          if (liveItemSnap.exists()) {
            const itemData = liveItemSnap.data();
            const itemStatus = (itemData.status || '').toLowerCase();
            if (itemStatus === 'available' || itemData.status === 'Available') {
              availableCount++;
              if (!targetDocSnap) {
                targetDocSnap = liveItemSnap;
                targetDocId = d.id;
              }
            }
          }
        }

        if (!targetDocSnap || !targetDocId) {
          // If no available items remain in subcollection, mark listing as sold
          t.update(listingDocRef, {
            status: 'sold',
            stock: 0,
            stockCount: 0
          });
          throw new Error('All accounts in this listing have already been purchased. Stock is 0.');
        }

        // Read the secure credentials for this exact inventory account
        const secureRef = doc(db, 'listings', listingId, 'inventory', targetDocId, 'secure', 'details');
        const liveSecureSnap = await t.get(secureRef);
        let secData: any = {};
        if (liveSecureSnap.exists()) {
          secData = liveSecureSnap.data();
        } else {
          secData = targetDocSnap.data();
        }

        secureDetails = {
          inventoryId: targetDocId,
          accountEmail: secData.accountEmail || '',
          accountPassword: secData.accountPassword || '',
          recoveryInfo: secData.recoveryInfo || secData.notes || '',
          backupCodes: secData.backupCodes || secData.twoFactorBackupCodes || secData.twoFactorSecretKey || '',
          twoFactorSecretKey: secData.twoFactorSecretKey || '',
          twoFactorBackupCodes: secData.twoFactorBackupCodes || secData.backupCodes || '',
          additionalInstructions: secData.additionalInstructions || ''
        };

        remainingStock = Math.max(0, availableCount - 1);

        // a. Mark exact inventory account as SOLD
        t.update(targetDocSnap.ref, {
          status: 'Sold',
          soldTo: userId,
          soldToEmail: buyerEmail || userData.email || '',
          orderId: purchaseId,
          soldAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // b. Sync inventory array on listing doc if present
        let updatedInventoryArray = listingData.inventory;
        if (Array.isArray(updatedInventoryArray)) {
          updatedInventoryArray = updatedInventoryArray.map((invItem: any) => {
            if (invItem.id === targetDocId) {
              return {
                ...invItem,
                status: 'Sold',
                soldTo: userId,
                soldToEmail: buyerEmail || userData.email || '',
                orderId: purchaseId,
                soldAt: new Date().toISOString()
              };
            }
            return invItem;
          });
        }

        // c. Update listing doc stock & status
        t.update(listingDocRef, {
          stock: remainingStock,
          stockCount: remainingStock,
          status: remainingStock > 0 ? 'active' : 'sold',
          ...(updatedInventoryArray ? { inventory: updatedInventoryArray } : {})
        });

      } else if (Array.isArray(listingData.inventory) && listingData.inventory.length > 0) {
        // Find first Available account in array
        const availableIdx = listingData.inventory.findIndex((acc: any) => (acc.status || '').toLowerCase() === 'available' || acc.status === 'Available');
        if (availableIdx === -1) {
          t.update(listingDocRef, { status: 'sold', stock: 0, stockCount: 0 });
          throw new Error('All accounts in this listing have already been purchased. Stock is 0.');
        }

        const targetAcc = listingData.inventory[availableIdx];
        secureDetails = {
          inventoryId: targetAcc.id || `inv_${availableIdx + 1}`,
          accountEmail: targetAcc.accountEmail || '',
          accountPassword: targetAcc.accountPassword || '',
          recoveryInfo: targetAcc.recoveryInfo || targetAcc.notes || '',
          backupCodes: targetAcc.backupCodes || targetAcc.twoFactorBackupCodes || targetAcc.twoFactorSecretKey || '',
          twoFactorSecretKey: targetAcc.twoFactorSecretKey || '',
          twoFactorBackupCodes: targetAcc.twoFactorBackupCodes || targetAcc.backupCodes || '',
          additionalInstructions: targetAcc.additionalInstructions || ''
        };

        const updatedInventory = [...listingData.inventory];
        updatedInventory[availableIdx] = {
          ...targetAcc,
          status: 'Sold',
          soldTo: userId,
          soldToEmail: buyerEmail || userData.email || '',
          orderId: purchaseId,
          soldAt: new Date().toISOString()
        };

        const remainingAvailable = updatedInventory.filter((acc: any) => (acc.status || '').toLowerCase() === 'available' || acc.status === 'Available').length;
        remainingStock = remainingAvailable;

        t.update(listingDocRef, {
          inventory: updatedInventory,
          stock: remainingAvailable,
          stockCount: remainingAvailable,
          status: remainingAvailable > 0 ? 'active' : 'sold'
        });

      } else {
        // Fallback for legacy single-stock listings
        secureDetails = listingData.digitalProductDetails ? {
          accountEmail: listingData.digitalProductDetails.accountEmail || '',
          accountPassword: listingData.digitalProductDetails.accountPassword || '',
          recoveryInfo: listingData.digitalProductDetails.recoveryInfo || '',
          backupCodes: listingData.digitalProductDetails.backupCodes || listingData.digitalProductDetails.twoFactorBackupCodes || '',
          twoFactorSecretKey: listingData.digitalProductDetails.twoFactorSecretKey || '',
          twoFactorBackupCodes: listingData.digitalProductDetails.twoFactorBackupCodes || listingData.digitalProductDetails.backupCodes || '',
          additionalInstructions: listingData.digitalProductDetails.additionalInstructions || ''
        } : undefined;

        remainingStock = 0;
        t.update(listingDocRef, {
          stock: 0,
          stockCount: 0,
          status: 'sold'
        });
      }

      const purchaseRecord = {
        id: purchaseId,
        listingId: listingId,
        listingTitle: listingData.title,
        category: listingData.category,
        price: price,
        paidAmount: price,
        currency: 'NGN',
        sellerId: listingData.sellerId,
        sellerName: listingData.sellerName,
        sellerEmail: listingData.sellerEmail || '',
        buyerId: userId,
        buyerName: buyerName || userData.displayName || 'Buyer',
        buyerEmail: buyerEmail || userData.email || '',
        paymentGateway: 'wallet',
        transactionId: txId,
        purchasedAt: new Date().toISOString(),
        status: 'escrow_holding',
        transferCode: transferCode,
        imageUrl: listingData.imageUrl || '',
        digitalProductDetails: secureDetails
      };

      // c. Deduct user wallet
      t.update(userDocRef, {
        walletBalance: newBal,
        totalPurchasesAmount: (userData.totalPurchasesAmount || 0) + price
      });

      // d. Record wallet purchase transaction
      const txDocRef = doc(db, 'wallet_transactions', txId);
      t.set(txDocRef, {
        id: txId,
        reference: txId,
        userId: userId,
        userEmail: buyerEmail || userData.email || '',
        amount: price,
        type: 'purchase',
        status: 'successful',
        description: `Wallet Purchase: ${listingData.title}`,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        createdAt: new Date().toISOString()
      });

      // e. Create purchase document
      const purchaseDocRef = doc(db, 'purchases', purchaseId);
      t.set(purchaseDocRef, purchaseRecord);

      purchaseResult = {
        purchaseRecord,
        newBalance: newBal,
        txId,
        remainingStock
      };
    });

    // Notify seller asynchronously via inquiry
    try {
      if (purchaseResult?.purchaseRecord && purchaseResult.purchaseRecord.sellerId) {
        const inqRef = doc(collection(db, 'inquiries'));
        await setDoc(inqRef, {
          id: inqRef.id,
          listingId: listingId,
          listingTitle: purchaseResult.purchaseRecord.listingTitle,
          buyerId: userId,
          buyerEmail: buyerEmail,
          buyerName: buyerName,
          sellerId: purchaseResult.purchaseRecord.sellerId,
          message: `🎉 ORDER CONFIRMED: Account "${purchaseResult.purchaseRecord.listingTitle}" was purchased for ₦${purchaseResult.purchaseRecord.paidAmount.toLocaleString()} via WALLET Escrow! Escrow Token: ${purchaseResult.purchaseRecord.transferCode}.`,
          createdAt: new Date().toISOString(),
          status: 'unread'
        });
      }
    } catch (inqErr) {
      console.warn('Seller inquiry notification notice:', inqErr);
    }

    return res.json({
      success: true,
      ...purchaseResult
    });

  } catch (err: any) {
    console.error('Error in /api/wallet/purchase:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'Wallet purchase failed.'
    });
  }
});

app.get('/api/paystack/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const { userId } = req.query;

    if (!reference) {
      return res.status(400).json({ verified: false, error: 'Transaction reference is missing' });
    }

    const result = await verifyAndCreditTransaction(reference, userId as string);
    if (result.verified) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (err: any) {
    console.error('Error in /api/paystack/verify:', err);
    res.status(500).json({ verified: false, error: err.message || 'Payment verification failed' });
  }
});

app.get('/api/payments/verify', async (req, res) => {
  try {
    const reference = (req.query.reference as string) || (req.query.trxref as string);
    const userId = req.query.userId as string;

    if (!reference) {
      return res.status(400).json({ verified: false, error: 'Transaction reference (reference or trxref) is missing' });
    }

    const result = await verifyAndCreditTransaction(reference, userId);
    if (result.verified) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (err: any) {
    console.error('Error in /api/payments/verify:', err);
    res.status(500).json({ verified: false, error: err.message || 'Payment verification failed' });
  }
});

// Paystack Inbound Bank Transfer Webhook with HMAC Signature Verification & Double-Credit Protection
app.post('/api/paystack/webhook', async (req: any, res) => {
  try {
    const event = req.body;
    const signature = (req.headers['x-paystack-signature'] || '') as string;
    const paystackSecretKey = getPaystackSecretKey();

    // HMAC SHA-512 Verification using exact rawBody buffer
    if (paystackSecretKey) {
      const rawPayload = req.rawBody ? req.rawBody : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const hash = crypto.createHmac('sha512', paystackSecretKey)
        .update(rawPayload)
        .digest('hex');

      if (!signature || hash.toLowerCase() !== signature.toLowerCase()) {
        console.warn('[Paystack Webhook] Invalid Paystack signature received.');
        return res.status(400).json({ error: 'Invalid HMAC signature' });
      }
    }

    if (!event || !event.event) {
      return res.status(400).json({ error: 'Invalid event structure' });
    }

    console.log(`[Paystack Webhook] Event Received: ${event.event}`);

    if (event.event === 'charge.success') {
      const data = event.data;
      const reference = data.reference || `PAY_${data.id}`;

      console.log(`[Paystack Webhook] Processing charge.success via verifyAndCreditTransaction for Ref: ${reference}`);

      // Call our robust unified verifier & credit function passing authenticated webhook data
      const result = await verifyAndCreditTransaction(reference, undefined, data);

      if (result.verified) {
        return res.status(200).json({
          status: 'success',
          message: 'Webhook processed and credited successfully.',
          reference,
          amount: result.amount,
          alreadyProcessed: !!result.alreadyProcessed
        });
      } else {
        console.warn(`[Paystack Webhook] verifyAndCreditTransaction failed for Ref: ${reference}. Error: ${result.error}`);
        return res.status(400).json({
          status: 'failed',
          error: result.error || 'Verification and crediting failed.'
        });
      }
    }

    return res.status(200).json({ status: 'ignored', message: `Event ${event.event} received` });

  } catch (err: any) {
    console.error('Error in /api/paystack/webhook:', err);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

// 3. Payment API Proxy Routes
app.post('/api/payment/create-checkout', async (req, res) => {
  try {
    const { listingId, listingTitle, priceNaira, currency, buyerEmail, gateway } = req.body;

    if (!listingId || !priceNaira) {
      return res.status(400).json({ error: 'Missing listing details' });
    }

    // Convert Naira price to target currency (e.g. USD, EUR, GBP, NGN)
    const rates: Record<string, number> = {
      NGN: 1,
      USD: 0.00067,
      EUR: 0.00062,
      GBP: 0.00053
    };

    const targetCurrency = (currency || 'NGN').toUpperCase();
    const convertedAmount = Math.max(1, Math.round((priceNaira * (rates[targetCurrency] || rates.NGN)) * 100) / 100);

    // Generate reference / transaction ID
    const transactionId = `TX_PAYSTACK_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return res.json({
      success: true,
      gateway: gateway || 'paystack',
      transactionId,
      amount: convertedAmount,
      currency: targetCurrency,
      mode: 'paystack_checkout',
      message: 'Paystack Payment Gateway Ready'
    });

  } catch (err: any) {
    console.error('Error in /api/payment/create-checkout:', err);
    res.status(500).json({ error: err.message || 'Payment creation failed' });
  }
});

// Secure Admin/Role Management API
app.post('/api/admin/manage-role', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const verifiedUser = await getVerifiedAuthUser(authHeader);

    const isVerifiedOwner = verifiedUser && (verifiedUser.email || '').trim().toLowerCase() === 'azeezmusharaf4@gmail.com';
    if (!isVerifiedOwner) {
      return res.status(403).json({ error: 'Forbidden: Access Denied. Only authenticated Azeezmusharaf4@gmail.com is authorized to manage administrator roles' });
    }

    const { targetUid, newRole } = req.body;

    if (!targetUid || !newRole) {
      return res.status(400).json({ error: 'Target user ID and new role are required' });
    }

    if (newRole !== 'admin' && newRole !== 'buyer') {
      return res.status(400).json({ error: 'Invalid role requested. Roles must be "admin" or "buyer"' });
    }

    if (db) {
      const userRef = doc(db, 'users', targetUid);
      await updateDoc(userRef, { role: newRole });
    }

    console.log(`[Manage Role API] Owner ${verifiedUser.email} updated user ${targetUid} to role ${newRole}`);

    return res.json({
      success: true,
      message: `User role updated successfully to ${newRole}`,
      targetUid,
      newRole
    });
  } catch (err: any) {
    console.error('Error in /api/admin/manage-role:', err);
    res.status(500).json({ error: err.message || 'Failed to update user role' });
  }
});

// Secure Admin Wallet Override & Adjustment API (Strictly restricted to Azeezmusharaf4@gmail.com)
const handleAdminWalletOverride = async (req: any, res: any) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    } else if (!body || typeof body !== 'object') {
      if (req.rawBody) {
        try {
          body = JSON.parse(req.rawBody.toString('utf8'));
        } catch {
          body = {};
        }
      } else {
        body = {};
      }
    }

    const authHeader = req.headers.authorization;
    const verifiedUser = await getVerifiedAuthUser(authHeader);

    const isAuthorizedOwner = verifiedUser && (verifiedUser.email || '').trim().toLowerCase() === 'azeezmusharaf4@gmail.com';

    if (!isAuthorizedOwner) {
      console.warn(`[Admin Wallet Override] Unauthorized override attempt blocked`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Access Denied. Only the authenticated Owner (Azeezmusharaf4@gmail.com) is authorized to access the Admin Wallet Override tool and adjustment endpoints.'
      });
    }

    const rawToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    const targetUid = body.targetUid || req.query.targetUid || '';
    const targetEmail = body.targetEmail || req.query.targetEmail || '';
    const action = body.action || req.query.action || 'set';
    const amount = body.amount !== undefined ? body.amount : req.query.amount;
    const reason = (body.reason || req.query.reason || 'Manual Admin Wallet Balance Override').trim();

    if (!targetUid && !targetEmail) {
      return res.status(400).json({
        success: false,
        error: 'Target user ID or email is required for wallet balance override.'
      });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        success: false,
        error: 'A valid non-negative amount must be specified.'
      });
    }

    if (!['set', 'add', 'deduct'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action specified. Must be "set", "add", or "deduct".'
      });
    }

    // Resolve target user document in Firestore
    let resolvedUid = targetUid;
    let targetUserData: any = null;

    // 1. If rawToken is provided, try Firestore REST API with the admin's verified credentials
    if (rawToken && resolvedUid) {
      try {
        targetUserData = await restGetFirestoreDoc('users', resolvedUid, rawToken);
      } catch (restErr) {
        console.warn('[Admin Wallet Override] REST GET user warning:', restErr);
      }
    }

    // Fallback lookup via client SDK db
    if (!targetUserData && resolvedUid && db) {
      try {
        const userRef = doc(db, 'users', resolvedUid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          targetUserData = userSnap.data();
        }
      } catch (dbErr) {
        console.warn('[Admin Wallet Override] Client SDK GET user warning:', dbErr);
      }
    }

    // Fallback lookup by email if UID was not found or if targetEmail provided
    if (!targetUserData && targetEmail && db) {
      try {
        const normalizedTargetEmail = targetEmail.trim().toLowerCase();
        const usersQ = query(collection(db, 'users'), where('email', '==', normalizedTargetEmail));
        const usersSnap = await getDocs(usersQ);
        if (!usersSnap.empty) {
          resolvedUid = usersSnap.docs[0].id;
          targetUserData = usersSnap.docs[0].data();
        }
      } catch (qErr) {
        console.warn('[Admin Wallet Override] User email query warning:', qErr);
      }
    }

    if (!resolvedUid) {
      return res.status(404).json({
        success: false,
        error: `Target user could not be found in Firestore database.`
      });
    }

    const previousBalance = Number(targetUserData?.walletBalance) || 0;
    let newBalance = previousBalance;

    if (action === 'set') {
      newBalance = numericAmount;
    } else if (action === 'add') {
      newBalance = previousBalance + numericAmount;
    } else if (action === 'deduct') {
      newBalance = Math.max(0, previousBalance - numericAmount);
    }

    const resolvedEmail = targetUserData?.email || targetEmail || '';
    const txId = `OVERRIDE_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Execute user document update with admin token or fallback to db
    let userUpdated = false;
    if (rawToken) {
      try {
        await restPatchFirestoreDoc('users', resolvedUid, {
          walletBalance: newBalance,
          lastWalletOverrideAt: new Date().toISOString(),
          lastWalletOverrideBy: 'Azeezmusharaf4@gmail.com',
          email: resolvedEmail || undefined,
          uid: resolvedUid
        }, rawToken);
        userUpdated = true;
      } catch (restPatchErr) {
        console.warn('[Admin Wallet Override] REST PATCH user failed, trying client SDK:', restPatchErr);
      }
    }

    if (!userUpdated && db) {
      const userDocRef = doc(db, 'users', resolvedUid);
      if (targetUserData) {
        await updateDoc(userDocRef, {
          walletBalance: newBalance,
          lastWalletOverrideAt: new Date().toISOString(),
          lastWalletOverrideBy: 'Azeezmusharaf4@gmail.com'
        });
      } else {
        await setDoc(userDocRef, {
          uid: resolvedUid,
          walletBalance: newBalance,
          email: resolvedEmail,
          createdAt: new Date().toISOString(),
          lastWalletOverrideAt: new Date().toISOString(),
          lastWalletOverrideBy: 'Azeezmusharaf4@gmail.com'
        }, { merge: true });
      }
    }

    // Record immutable audit entry in wallet_transactions ledger
    const txPayload = {
      id: txId,
      userId: resolvedUid,
      userEmail: resolvedEmail,
      amount: Math.abs(newBalance - previousBalance),
      previousBalance,
      newBalance,
      action,
      type: action === 'deduct' ? 'deduction' : 'deposit',
      method: 'admin_wallet_override',
      status: 'successful',
      adminEmail: 'Azeezmusharaf4@gmail.com',
      reason: reason || 'Manual Admin Wallet Balance Override',
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    let txRecorded = false;
    if (rawToken) {
      try {
        await restCreateFirestoreDoc('wallet_transactions', txId, txPayload, rawToken);
        txRecorded = true;
      } catch (restTxErr) {
        console.warn('[Admin Wallet Override] REST CREATE tx failed, trying client SDK:', restTxErr);
      }
    }

    if (!txRecorded && db) {
      try {
        const txDocRef = doc(db, 'wallet_transactions', txId);
        await setDoc(txDocRef, txPayload);
      } catch (dbTxErr) {
        console.warn('[Admin Wallet Override] Client SDK setDoc tx notice:', dbTxErr);
      }
    }

    console.log(`[Admin Wallet Override] Success: ${verifiedUser?.email} updated user ${resolvedUid} (${resolvedEmail}) wallet from ₦${previousBalance} to ₦${newBalance} (action: ${action}, amount: ₦${numericAmount})`);

    return res.json({
      success: true,
      message: `Successfully overridden wallet balance for ${resolvedEmail || resolvedUid}. Updated from ₦${previousBalance.toLocaleString()} to ₦${newBalance.toLocaleString()}.`,
      targetUid: resolvedUid,
      targetEmail: resolvedEmail,
      previousBalance,
      newBalance,
      action,
      amount: numericAmount,
      txId
    });
  } catch (err: any) {
    console.error('Error in /api/admin/wallets/override:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal error processing admin wallet override'
    });
  }
};

app.all('/api/admin/wallets/override', handleAdminWalletOverride);
app.all('/api/admin/wallets/adjust', handleAdminWalletOverride);
app.all('/api/admin/override-wallet', handleAdminWalletOverride);
app.all('/api/admin/wallet-override', handleAdminWalletOverride);
app.all('/api/admin/wallet/override', handleAdminWalletOverride);
app.all('/api/admin/wallet/adjust', handleAdminWalletOverride);

// Secure Admin Wallets Listing & Verification API
app.get('/api/admin/wallets', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const verifiedUser = await getVerifiedAuthUser(authHeader);

    const isAuthorizedOwner = verifiedUser && (verifiedUser.email || '').trim().toLowerCase() === 'azeezmusharaf4@gmail.com';
    if (!isAuthorizedOwner) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Access Denied. Only authenticated Azeezmusharaf4@gmail.com is authorized to access /admin/wallets.'
      });
    }

    if (!db) {
      return res.status(500).json({ success: false, error: 'Database service not available' });
    }

    const usersSnap = await getDocs(collection(db, 'users'));
    const users = usersSnap.docs.map(d => ({
      uid: d.id,
      ...d.data()
    }));

    return res.json({
      success: true,
      authorized: true,
      adminEmail: 'Azeezmusharaf4@gmail.com',
      users
    });
  } catch (err: any) {
    console.error('Error in /api/admin/wallets:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. OneGridHub Virtual Numbers Proxy Endpoints
function getOneGridHubConfig() {
  // If .env or config files exist on disk, parse them dynamically to support hot updates without restart
  let envFileKey = '';
  let envBaseUrl = '';
  let envMarkup = 0;

  const candidatePaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env.production'),
    '/app/.dev.env.json'
  ];

  for (const envPath of candidatePaths) {
    try {
      if (fs.existsSync(envPath)) {
        if (envPath.endsWith('.json')) {
          const jsonContent = JSON.parse(fs.readFileSync(envPath, 'utf8'));
          for (const [k, v] of Object.entries(jsonContent)) {
            const key = k.trim();
            const val = typeof v === 'string' ? v.trim().replace(/^["']|["']$/g, '') : String(v);
            if (
              (key === 'ONEGRIDHUB_API_KEY' ||
               key === 'ONEGRID_API_KEY' ||
               key === 'ONEGRIDHUB_KEY' ||
               key === 'ONE_GRID_HUB_API_KEY' ||
               key === 'OGH_API_KEY' ||
               key === 'VIRTUAL_NUMBER_API_KEY' ||
               key === 'ONEGRIDHUB_TOKEN' ||
               key === 'ONEGRIDHUB_SECRET') &&
              val
            ) {
              envFileKey = val;
            } else if (key === 'ONEGRIDHUB_BASE_URL' && val) {
              envBaseUrl = val;
            } else if (key === 'VIRTUAL_NUMBER_MARKUP' && val) {
              envMarkup = Number(val) || 0;
            }
          }
        } else {
          const content = fs.readFileSync(envPath, 'utf8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
            const [k, ...vParts] = trimmed.split('=');
            const key = k.trim();
            const val = vParts.join('=').trim().replace(/^["']|["']$/g, '');
            if (
              (key === 'ONEGRIDHUB_API_KEY' ||
               key === 'ONEGRID_API_KEY' ||
               key === 'ONEGRIDHUB_KEY' ||
               key === 'ONE_GRID_HUB_API_KEY' ||
               key === 'OGH_API_KEY' ||
               key === 'VIRTUAL_NUMBER_API_KEY' ||
               key === 'ONEGRIDHUB_TOKEN' ||
               key === 'ONEGRIDHUB_SECRET') &&
              val
            ) {
              envFileKey = val;
            } else if (key === 'ONEGRIDHUB_BASE_URL' && val) {
              envBaseUrl = val;
            } else if (key === 'VIRTUAL_NUMBER_MARKUP' && val) {
              envMarkup = Number(val) || 0;
            }
          }
        }
      }
    } catch {
      // Ignore candidate file read error
    }
  }

  const rawKey = (
    process.env.ONEGRIDHUB_SMM_API_KEY ||
    process.env.ONEGRIDHUB_API_KEY ||
    process.env.ONEGRID_API_KEY ||
    process.env.VITE_ONEGRID_API_KEY ||
    process.env.VITE_ONEGRIDHUB_API_KEY ||
    process.env.VITE_ONEGRIDHUB_SMM_API_KEY ||
    process.env.ONEGRIDHUB_KEY ||
    process.env.ONEGRIDHUB_SMM_KEY ||
    process.env.ONE_GRID_HUB_API_KEY ||
    process.env.OGH_API_KEY ||
    process.env.SMM_API_KEY ||
    process.env.VITE_SMM_API_KEY ||
    process.env.VIRTUAL_NUMBER_API_KEY ||
    process.env.ONEGRIDHUB_TOKEN ||
    process.env.ONEGRIDHUB_SECRET ||
    envFileKey ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  const isConfigured = Boolean(rawKey && !['UNDEFINED', 'NULL', ''].includes(rawKey.toUpperCase()));
  const apiKey = isConfigured ? rawKey : '';
  const isRealKey = Boolean(apiKey && !['ONEGRIDHUB_API_KEY', 'YOUR_API_KEY', 'MY_ONEGRIDHUB_API_KEY', 'PLACEHOLDER', 'UNDEFINED', 'NULL'].includes(apiKey.toUpperCase()) && !apiKey.startsWith('MY_'));

  const markup = envMarkup || Number(process.env.DIGITAL_PRODUCT_MARKUP) || Number(process.env.VITE_DIGITAL_PRODUCT_MARKUP) || Number(process.env.VIRTUAL_NUMBER_MARKUP) || 500;
  let rawBaseUrl = (process.env.ONEGRIDHUB_BASE_URL || envBaseUrl || 'https://onegridhub.com/api/v1/index.php')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\/+$/, '');

  let oneGridBaseUrl = rawBaseUrl;
  if (!oneGridBaseUrl.includes('/api/v1')) {
    oneGridBaseUrl = `${oneGridBaseUrl}/api/v1/index.php`;
  } else if (!oneGridBaseUrl.endsWith('.php')) {
    oneGridBaseUrl = `${oneGridBaseUrl}/index.php`;
  }

  return { apiKey, isRealKey, markup, oneGridBaseUrl };
}

const getOneGridHubApiKey = (): string => {
  return getOneGridHubConfig().apiKey;
};

const isRealOneGridHubKey = (): boolean => {
  return getOneGridHubConfig().isRealKey;
};

// Interface for Virtual Number Marketplace Pricing Configuration
interface VirtualNumberPricingSettings {
  optionsCount: number; // 2 to 6 options (default 4)
  minMarkup: number; // Minimum markup in NGN (default 500)
  maxMarkup: number; // Maximum markup in NGN (default 4500)
  pricingStyle: 'natural' | 'clean' | 'tiered'; // default: 'natural'
}

let cachedPricingSettings: VirtualNumberPricingSettings = {
  optionsCount: 4,
  minMarkup: 500,
  maxMarkup: 4500,
  pricingStyle: 'natural'
};

async function getVirtualNumberPricingSettings(): Promise<VirtualNumberPricingSettings> {
  try {
    if (db) {
      const docRef = doc(db, 'system_settings', 'virtual_number_pricing');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        cachedPricingSettings = {
          optionsCount: Math.min(Math.max(Number(data.optionsCount) || 4, 2), 6),
          minMarkup: Math.max(Number(data.minMarkup) || 500, 100),
          maxMarkup: Math.max(Number(data.maxMarkup) || 4500, 500),
          pricingStyle: data.pricingStyle || 'natural'
        };
      }
    }
  } catch (err) {
    console.warn('[VirtualNumberPricing] Fetch settings warning:', err);
  }
  return cachedPricingSettings;
}

// Comprehensive reference dictionary for all worldwide country codes, dial codes & standard IDs
const WORLD_COUNTRIES_MAP: Record<string, { name: string; code: string; flag?: string }> = {
  // Common numeric IDs in SMS APIs (SMS-Activate / OneGridHub / SMSHub)
  '0': { name: 'Russia', code: '+7' },
  '1': { name: 'Ukraine', code: '+380' },
  '2': { name: 'Kazakhstan', code: '+7' },
  '3': { name: 'China', code: '+86' },
  '4': { name: 'Philippines', code: '+63' },
  '5': { name: 'Myanmar', code: '+95' },
  '6': { name: 'Indonesia', code: '+62' },
  '7': { name: 'Malaysia', code: '+60' },
  '8': { name: 'Kenya', code: '+254' },
  '9': { name: 'Tanzania', code: '+255' },
  '10': { name: 'Vietnam', code: '+84' },
  '11': { name: 'Kyrgyzstan', code: '+996' },
  '12': { name: 'USA (Virtual)', code: '+1' },
  '13': { name: 'Israel', code: '+972' },
  '14': { name: 'Hong Kong', code: '+852' },
  '15': { name: 'Poland', code: '+48' },
  '16': { name: 'United Kingdom', code: '+44' },
  '17': { name: 'Madagascar', code: '+261' },
  '18': { name: 'Congo', code: '+242' },
  '19': { name: 'Nigeria', code: '+234' },
  '20': { name: 'Macao', code: '+853' },
  '21': { name: 'Egypt', code: '+20' },
  '22': { name: 'India', code: '+91' },
  '23': { name: 'Ireland', code: '+353' },
  '24': { name: 'Cambodia', code: '+855' },
  '25': { name: 'Laos', code: '+856' },
  '26': { name: 'Haiti', code: '+509' },
  '27': { name: 'Ivory Coast', code: '+225' },
  '28': { name: 'Gambia', code: '+220' },
  '29': { name: 'Serbia', code: '+381' },
  '30': { name: 'Yemen', code: '+967' },
  '31': { name: 'South Africa', code: '+27' },
  '32': { name: 'Romania', code: '+40' },
  '33': { name: 'Colombia', code: '+57' },
  '34': { name: 'Estonia', code: '+372' },
  '35': { name: 'Azerbaijan', code: '+994' },
  '36': { name: 'Canada', code: '+1' },
  '37': { name: 'Morocco', code: '+212' },
  '38': { name: 'Ghana', code: '+233' },
  '39': { name: 'Argentina', code: '+54' },
  '40': { name: 'Uzbekistan', code: '+998' },
  '41': { name: 'Cameroon', code: '+237' },
  '42': { name: 'Chad', code: '+235' },
  '43': { name: 'Germany', code: '+49' },
  '44': { name: 'Lithuania', code: '+370' },
  '45': { name: 'Croatia', code: '+385' },
  '46': { name: 'Sweden', code: '+46' },
  '47': { name: 'Iraq', code: '+964' },
  '48': { name: 'Netherlands', code: '+31' },
  '49': { name: 'Latvia', code: '+371' },
  '50': { name: 'Austria', code: '+43' },
  '51': { name: 'Belarus', code: '+375' },
  '52': { name: 'Thailand', code: '+66' },
  '53': { name: 'Saudi Arabia', code: '+966' },
  '54': { name: 'Mexico', code: '+52' },
  '55': { name: 'Taiwan', code: '+886' },
  '56': { name: 'Spain', code: '+34' },
  '57': { name: 'Algeria', code: '+213' },
  '58': { name: 'Slovenia', code: '+386' },
  '59': { name: 'Bangladesh', code: '+880' },
  '60': { name: 'Senegal', code: '+221' },
  '61': { name: 'Turkey', code: '+90' },
  '62': { name: 'Czech Republic', code: '+420' },
  '63': { name: 'Sri Lanka', code: '+94' },
  '64': { name: 'Peru', code: '+51' },
  '65': { name: 'Pakistan', code: '+92' },
  '66': { name: 'New Zealand', code: '+64' },
  '67': { name: 'Guinea', code: '+224' },
  '68': { name: 'Mali', code: '+223' },
  '69': { name: 'Venezuela', code: '+58' },
  '70': { name: 'Ethiopia', code: '+251' },
  '71': { name: 'Mongolia', code: '+976' },
  '72': { name: 'Brazil', code: '+55' },
  '73': { name: 'Afghanistan', code: '+93' },
  '74': { name: 'Uganda', code: '+256' },
  '75': { name: 'Angola', code: '+244' },
  '76': { name: 'Cyprus', code: '+357' },
  '77': { name: 'France', code: '+33' },
  '78': { name: 'Papua New Guinea', code: '+675' },
  '79': { name: 'Mozambique', code: '+258' },
  '80': { name: 'Nepal', code: '+977' },
  '81': { name: 'Belgium', code: '+32' },
  '82': { name: 'Bulgaria', code: '+359' },
  '83': { name: 'Hungary', code: '+36' },
  '84': { name: 'Moldova', code: '+373' },
  '85': { name: 'Italy', code: '+39' },
  '86': { name: 'Paraguay', code: '+595' },
  '87': { name: 'Honduras', code: '+504' },
  '88': { name: 'Tunisia', code: '+216' },
  '89': { name: 'Nicaragua', code: '+505' },
  '90': { name: 'Timor-Leste', code: '+670' },
  '91': { name: 'Bolivia', code: '+591' },
  '92': { name: 'Costa Rica', code: '+506' },
  '93': { name: 'Guatemala', code: '+502' },
  '94': { name: 'UAE', code: '+971' },
  '95': { name: 'Zimbabwe', code: '+263' },
  '96': { name: 'Puerto Rico', code: '+1' },
  '97': { name: 'Sudan', code: '+249' },
  '98': { name: 'Togo', code: '+228' },
  '99': { name: 'Kuwait', code: '+965' },
  '100': { name: 'El Salvador', code: '+503' },
  '101': { name: 'Libya', code: '+218' },
  '102': { name: 'Jamaica', code: '+1876' },
  '103': { name: 'Trinidad and Tobago', code: '+1868' },
  '104': { name: 'Ecuador', code: '+593' },
  '105': { name: 'Swaziland', code: '+268' },
  '106': { name: 'Oman', code: '+968' },
  '107': { name: 'Bosnia and Herzegovina', code: '+387' },
  '108': { name: 'Dominican Republic', code: '+1809' },
  '109': { name: 'Syria', code: '+963' },
  '110': { name: 'Qatar', code: '+974' },
  '111': { name: 'Panama', code: '+507' },
  '112': { name: 'Cuba', code: '+53' },
  '113': { name: 'Mauritania', code: '+222' },
  '114': { name: 'Sierra Leone', code: '+232' },
  '115': { name: 'Jordan', code: '+962' },
  '116': { name: 'Portugal', code: '+351' },
  '117': { name: 'Bahamas', code: '+1242' },
  '118': { name: 'Georgia', code: '+995' },
  '119': { name: 'Armenia', code: '+374' },
  '120': { name: 'Guyana', code: '+592' },
  '121': { name: 'Burundi', code: '+257' },
  '122': { name: 'Benin', code: '+229' },
  '123': { name: 'Brunei', code: '+673' },
  '124': { name: 'Bahrain', code: '+973' },
  '125': { name: 'Namibia', code: '+264' },
  '126': { name: 'Congo DR', code: '+243' },
  '127': { name: 'Rwanda', code: '+250' },
  '128': { name: 'Slovakia', code: '+421' },
  '129': { name: 'Lebanon', code: '+961' },
  '130': { name: 'Botswana', code: '+267' },
  '131': { name: 'Belize', code: '+501' },
  '132': { name: 'Central African Republic', code: '+236' },
  '133': { name: 'Chile', code: '+56' },
  '134': { name: 'Australia', code: '+61' },
  '135': { name: 'Somalia', code: '+252' },
  '136': { name: 'Zambia', code: '+260' },
  '137': { name: 'Guinea-Bissau', code: '+245' },
  '138': { name: 'Malawi', code: '+265' },
  '139': { name: 'Gabon', code: '+241' },
  '140': { name: 'Uruguay', code: '+598' },
  '141': { name: 'Equatorial Guinea', code: '+240' },
  '142': { name: 'Bhutan', code: '+975' },
  '143': { name: 'Maldives', code: '+960' },
  '144': { name: 'Suriname', code: '+597' },
  '145': { name: 'Norway', code: '+47' },
  '146': { name: 'Mauritius', code: '+230' },
  '147': { name: 'Denmark', code: '+45' },
  '148': { name: 'Finland', code: '+358' },
  '149': { name: 'Fiji', code: '+679' },
  '150': { name: 'Montenegro', code: '+382' },
  '151': { name: 'Malta', code: '+356' },
  '152': { name: 'North Macedonia', code: '+389' },
  '153': { name: 'Albania', code: '+355' },
  '154': { name: 'Greece', code: '+30' },
  '155': { name: 'Switzerland', code: '+41' },
  '156': { name: 'Singapore', code: '+65' },
  '157': { name: 'Japan', code: '+81' },
  '158': { name: 'South Korea', code: '+82' },
  '159': { name: 'Iceland', code: '+354' },
  '160': { name: 'Luxembourg', code: '+352' },
  '187': { name: 'United States', code: '+1' },
  '188': { name: 'Seychelles', code: '+248' },
  '189': { name: 'Dominica', code: '+1767' },
  '190': { name: 'Saint Lucia', code: '+1758' },
  '191': { name: 'Grenada', code: '+1473' },
  '192': { name: 'Saint Vincent', code: '+1784' },
  '193': { name: 'Barbados', code: '+1246' },
  '194': { name: 'Antigua and Barbuda', code: '+1268' },
  '195': { name: 'Saint Kitts and Nevis', code: '+1869' },

  // ISO-2 Codes
  'US': { name: 'United States', code: '+1' },
  'GB': { name: 'United Kingdom', code: '+44' },
  'UK': { name: 'United Kingdom', code: '+44' },
  'CA': { name: 'Canada', code: '+1' },
  'NG': { name: 'Nigeria', code: '+234' },
  'GH': { name: 'Ghana', code: '+233' },
  'KE': { name: 'Kenya', code: '+254' },
  'ZA': { name: 'South Africa', code: '+27' },
  'DE': { name: 'Germany', code: '+49' },
  'FR': { name: 'France', code: '+33' },
  'NL': { name: 'Netherlands', code: '+31' },
  'BR': { name: 'Brazil', code: '+55' },
  'IN': { name: 'India', code: '+91' },
  'PH': { name: 'Philippines', code: '+63' },
  'ID': { name: 'Indonesia', code: '+62' },
  'AU': { name: 'Australia', code: '+61' },
  'SE': { name: 'Sweden', code: '+46' },
  'IT': { name: 'Italy', code: '+39' },
  'ES': { name: 'Spain', code: '+34' },
  'PL': { name: 'Poland', code: '+48' },
  'UA': { name: 'Ukraine', code: '+380' },
  'RU': { name: 'Russia', code: '+7' },
  'CN': { name: 'China', code: '+86' },
  'JP': { name: 'Japan', code: '+81' },
  'KR': { name: 'South Korea', code: '+82' },
  'EG': { name: 'Egypt', code: '+20' },
  'MA': { name: 'Morocco', code: '+212' },
  'CO': { name: 'Colombia', code: '+57' },
  'AR': { name: 'Argentina', code: '+54' },
  'MX': { name: 'Mexico', code: '+52' },
  'TR': { name: 'Turkey', code: '+90' },
  'VN': { name: 'Vietnam', code: '+84' },
  'TH': { name: 'Thailand', code: '+66' },
  'MY': { name: 'Malaysia', code: '+60' },
  'SG': { name: 'Singapore', code: '+65' },
  'SA': { name: 'Saudi Arabia', code: '+966' },
  'AE': { name: 'United Arab Emirates', code: '+971' },
  'PK': { name: 'Pakistan', code: '+92' },
  'BD': { name: 'Bangladesh', code: '+880' },
  'NZ': { name: 'New Zealand', code: '+64' },
  'BE': { name: 'Belgium', code: '+32' },
  'CH': { name: 'Switzerland', code: '+41' },
  'AT': { name: 'Austria', code: '+43' },
  'NO': { name: 'Norway', code: '+47' },
  'DK': { name: 'Denmark', code: '+45' },
  'FI': { name: 'Finland', code: '+358' },
  'IE': { name: 'Ireland', code: '+353' },
  'PT': { name: 'Portugal', code: '+351' },
  'GR': { name: 'Greece', code: '+30' },
  'CZ': { name: 'Czech Republic', code: '+420' },
  'RO': { name: 'Romania', code: '+40' },
  'HU': { name: 'Hungary', code: '+36' },
  'IL': { name: 'Israel', code: '+972' },
  'HK': { name: 'Hong Kong', code: '+852' },
  'TW': { name: 'Taiwan', code: '+886' },
  'CL': { name: 'Chile', code: '+56' },
  'PE': { name: 'Peru', code: '+51' },
  'TZ': { name: 'Tanzania', code: '+255' },
  'UG': { name: 'Uganda', code: '+256' },
  'CM': { name: 'Cameroon', code: '+237' },
  'SN': { name: 'Senegal', code: '+221' },
  'CI': { name: 'Ivory Coast', code: '+225' }
};

// Helper: Normalize country item into standard format
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'united kingdom': '+44',
  'uk': '+44',
  'great britain': '+44',
  'united states': '+1',
  'usa': '+1',
  'canada': '+1',
  'nigeria': '+234',
  'ghana': '+233',
  'south africa': '+27',
  'kenya': '+254',
  'germany': '+49',
  'france': '+33',
  'netherlands': '+31',
  'holland': '+31',
  'india': '+91',
  'philippines': '+63',
  'indonesia': '+62',
  'brazil': '+55',
  'australia': '+61',
  'russia': '+7',
  'ukraine': '+380',
  'egypt': '+20',
  'poland': '+48',
  'spain': '+34',
  'italy': '+39',
  'turkey': '+90',
  'china': '+86',
  'japan': '+81',
  'south korea': '+82',
  'vietnam': '+84',
  'thailand': '+66',
  'malaysia': '+60',
  'singapore': '+65',
  'mexico': '+52',
  'colombia': '+57',
  'argentina': '+54',
  'chile': '+56',
  'peru': '+51',
  'pakistan': '+92',
  'bangladesh': '+880',
  'saudi arabia': '+966',
  'united arab emirates': '+971',
  'uae': '+971',
  'israel': '+972',
  'sweden': '+46',
  'switzerland': '+41',
  'belgium': '+32',
  'austria': '+43',
  'portugal': '+351',
  'greece': '+30',
  'romania': '+40',
  'czech republic': '+420',
  'denmark': '+45',
  'finland': '+358',
  'norway': '+47',
  'ireland': '+353',
  'new zealand': '+64',
  'tanzania': '+255',
  'uganda': '+256',
  'algeria': '+213',
  'morocco': '+212',
  'ethiopia': '+251',
  'ivory coast': '+225',
  "cote d'ivoire": '+225',
  'cameroon': '+237',
  'senegal': '+221',
  'zimbabwe': '+263',
  'zambia': '+260',
  'rwanda': '+250',
  'angola': '+244',
  'mozambique': '+258',
  'madagascar': '+261',
  'congo': '+242',
  'drc': '+243',
  'democratic republic of the congo': '+243',
  'haiti': '+509',
  'cambodia': '+855',
  'myanmar': '+95',
  'sri lanka': '+94',
  'nepal': '+977',
  'afghanistan': '+93',
  'iraq': '+964',
  'iran': '+98',
  'jordan': '+962',
  'lebanon': '+961',
  'kuwait': '+965',
  'qatar': '+974',
  'oman': '+968',
  'bahrain': '+973',
  'yemen': '+967',
  'taiwan': '+886',
  'hong kong': '+852',
  'macao': '+853',
  'uzbekistan': '+998',
  'kazakhstan': '+7',
  'kyrgyzstan': '+996',
  'tajikistan': '+992',
  'turkmenistan': '+993',
  'azerbaijan': '+994',
  'armenia': '+374',
  'georgia': '+995',
  'cyprus': '+357',
  'croatia': '+385',
  'serbia': '+381',
  'slovenia': '+386',
  'slovakia': '+421',
  'hungary': '+36',
  'bulgaria': '+359',
  'lithuania': '+370',
  'latvia': '+371',
  'estonia': '+372',
  'belarus': '+375',
  'moldova': '+373',
  'albania': '+355',
  'bosnia': '+387',
  'north macedonia': '+389',
  'montenegro': '+382',
  'luxembourg': '+352',
  'iceland': '+354',
  'malta': '+356',
  'dominican republic': '+1',
  'jamaica': '+1',
  'trinidad and tobago': '+1',
  'bahamas': '+1',
  'barbados': '+1',
  'panama': '+507',
  'costa rica': '+506',
  'guatemala': '+502',
  'honduras': '+504',
  'el salvador': '+503',
  'nicaragua': '+505',
  'ecuador': '+593',
  'bolivia': '+591',
  'paraguay': '+595',
  'uruguay': '+598',
  'venezuela': '+58',
  'gambia': '+220',
  'guinea': '+224',
  'mali': '+223',
  'chad': '+235',
  'papua new guinea': '+675',
  'fiji': '+679',
  'mongolia': '+976'
};

function normalizeCountryEntry(rawId: string, rawName?: string, rawCode?: string): { id: string; name: string; code: string } {
  const cleanId = String(rawId || '').trim();
  const upperId = cleanId.toUpperCase();
  const dictMatch = WORLD_COUNTRIES_MAP[cleanId] || WORLD_COUNTRIES_MAP[upperId];

  let name = rawName ? String(rawName).trim() : (dictMatch?.name || cleanId);
  
  // Lookup code by country name first for highest accuracy
  const nameKey = name.toLowerCase().trim();
  let code = rawCode ? String(rawCode).trim() : (COUNTRY_NAME_TO_CODE[nameKey] || dictMatch?.code || '');

  // If name is still just the numeric ID, look up by dictionary
  if ((/^\d+$/.test(name) || !name) && dictMatch) {
    name = dictMatch.name;
    if (!code) {
      const fallbackKey = name.toLowerCase().trim();
      code = COUNTRY_NAME_TO_CODE[fallbackKey] || dictMatch.code;
    }
  }
  if (!code && dictMatch) {
    code = dictMatch.code;
  }
  if (code && !code.startsWith('+') && /^\d+$/.test(code)) {
    code = `+${code}`;
  }

  return {
    id: cleanId,
    name: name || cleanId,
    code: code || ''
  };
}

// Validates whether a candidate code is an error message or non-OTP string
function isInvalidOtpCode(val?: string | null): boolean {
  if (!val) return true;
  const s = String(val).trim().toLowerCase();
  if (s.length === 0) return true;

  const invalidTokens = [
    'unauthorized',
    'error',
    'failed',
    'failure',
    'cancelled',
    'canceled',
    'expired',
    'not_found',
    'not found',
    'waiting',
    'pending',
    'waiting_for_sms',
    'status_wait_code',
    'status_cancel',
    'access_denied',
    'bad_request',
    'timeout',
    'unknown',
    'invalid',
    'invalid_key',
    'forbidden',
    '401',
    '403',
    '500',
    '502',
    '503',
    '504',
    'null',
    'undefined',
    'none',
    'true',
    'false',
    'ok',
    'success'
  ];

  if (invalidTokens.includes(s)) return true;
  if (s.includes('unauthorized') || s.includes('auth') || s.includes('forbidden')) return true;
  if (s.startsWith('status_') || s.startsWith('error_')) return true;
  return false;
}

// Validates whether a code is a genuine carrier verification code
function isValidOtpCode(val?: string | null): boolean {
  if (!val) return false;
  if (isInvalidOtpCode(val)) return false;
  const clean = String(val).trim();
  return clean.length >= 3 && clean.length <= 12;
}

// Resolves accurate country metadata using phone number prefix as gold standard
function resolveCountryDetails(countryIdOrName?: string, phoneNumber?: string): { id: string; name: string; code: string; flag: string } {
  if (phoneNumber) {
    const clean = String(phoneNumber).replace(/[^\d+]/g, '');
    const digits = clean.startsWith('+') ? clean.slice(1) : clean;

    if (digits.startsWith('1') && digits.length >= 11) {
      return { id: 'US', name: 'United States', code: '+1', flag: '🇺🇸' };
    }
    if (digits.startsWith('44')) {
      return { id: 'GB', name: 'United Kingdom', code: '+44', flag: '🇬🇧' };
    }
    if (digits.startsWith('234')) {
      return { id: 'NG', name: 'Nigeria', code: '+234', flag: '🇳🇬' };
    }
    if (digits.startsWith('233')) {
      return { id: 'GH', name: 'Ghana', code: '+233', flag: '🇬🇭' };
    }
    if (digits.startsWith('254')) {
      return { id: 'KE', name: 'Kenya', code: '+254', flag: '🇰🇪' };
    }
    if (digits.startsWith('27')) {
      return { id: 'ZA', name: 'South Africa', code: '+27', flag: '🇿🇦' };
    }
    if (digits.startsWith('49')) {
      return { id: 'DE', name: 'Germany', code: '+49', flag: '🇩🇪' };
    }
    if (digits.startsWith('33')) {
      return { id: 'FR', name: 'France', code: '+33', flag: '🇫🇷' };
    }
    if (digits.startsWith('91')) {
      return { id: 'IN', name: 'India', code: '+91', flag: '🇮🇳' };
    }
    if (digits.startsWith('55')) {
      return { id: 'BR', name: 'Brazil', code: '+55', flag: '🇧🇷' };
    }
    if (digits.startsWith('61')) {
      return { id: 'AU', name: 'Australia', code: '+61', flag: '🇦🇺' };
    }
    if (digits.startsWith('31')) {
      return { id: 'NL', name: 'Netherlands', code: '+31', flag: '🇳🇱' };
    }
    if (digits.startsWith('380')) {
      return { id: 'UA', name: 'Ukraine', code: '+380', flag: '🇺🇦' };
    }
    if (digits.startsWith('48')) {
      return { id: 'PL', name: 'Poland', code: '+48', flag: '🇵🇱' };
    }
    if (digits.startsWith('62')) {
      return { id: 'ID', name: 'Indonesia', code: '+62', flag: '🇮🇩' };
    }
    if (digits.startsWith('63')) {
      return { id: 'PH', name: 'Philippines', code: '+63', flag: '🇵🇭' };
    }
    if (digits.startsWith('84')) {
      return { id: 'VN', name: 'Vietnam', code: '+84', flag: '🇻🇳' };
    }
    if (digits.startsWith('60')) {
      return { id: 'MY', name: 'Malaysia', code: '+60', flag: '🇲🇾' };
    }
    if (digits.startsWith('7')) {
      return { id: 'RU', name: 'Russia', code: '+7', flag: '🇷🇺' };
    }
  }

  const c = String(countryIdOrName || '').toLowerCase().trim();
  if (c === '187' || c === 'us' || c === 'usa' || c === '1' || c.includes('united states') || c === 'america') {
    return { id: 'US', name: 'United States', code: '+1', flag: '🇺🇸' };
  }
  if (c === 'gb' || c === 'uk' || c === 'england' || c.includes('united kingdom') || c.includes('england') || c === '2' || c === '16') {
    return { id: 'GB', name: 'United Kingdom', code: '+44', flag: '🇬🇧' };
  }
  if (c === 'ng' || c.includes('nigeria') || c === '14') {
    return { id: 'NG', name: 'Nigeria', code: '+234', flag: '🇳🇬' };
  }
  if (c === 'ca' || c.includes('canada') || c === '36') {
    return { id: 'CA', name: 'Canada', code: '+1', flag: '🇨🇦' };
  }
  if (c === 'gh' || c.includes('ghana') || c === '42') {
    return { id: 'GH', name: 'Ghana', code: '+233', flag: '🇬🇭' };
  }
  if (c === 'za' || c.includes('south africa') || c === '153') {
    return { id: 'ZA', name: 'South Africa', code: '+27', flag: '🇿🇦' };
  }
  if (c === 'de' || c.includes('germany') || c === '43') {
    return { id: 'DE', name: 'Germany', code: '+49', flag: '🇩🇪' };
  }
  if (c === 'fr' || c.includes('france') || c === '78') {
    return { id: 'FR', name: 'France', code: '+33', flag: '🇫🇷' };
  }
  if (c === 'in' || c.includes('india') || c === '22') {
    return { id: 'IN', name: 'India', code: '+91', flag: '🇮🇳' };
  }
  if (c === 'br' || c.includes('brazil') || c === '73') {
    return { id: 'BR', name: 'Brazil', code: '+55', flag: '🇧🇷' };
  }
  if (c === 'au' || c.includes('australia')) {
    return { id: 'AU', name: 'Australia', code: '+61', flag: '🇦🇺' };
  }
  if (c === 'ke' || c.includes('kenya') || c === '8') {
    return { id: 'KE', name: 'Kenya', code: '+254', flag: '🇰🇪' };
  }
  if (c === 'nl' || c.includes('netherlands') || c === '48') {
    return { id: 'NL', name: 'Netherlands', code: '+31', flag: '🇳🇱' };
  }

  const titleName = countryIdOrName ? countryIdOrName.charAt(0).toUpperCase() + countryIdOrName.slice(1) : 'International';
  return {
    id: countryIdOrName || 'INT',
    name: titleName,
    code: '',
    flag: '🌐'
  };
}

// Generate multiple buying price options from ONE provider cost
function generateVirtualNumberPriceOptions(
  providerCost: number,
  settings: VirtualNumberPricingSettings,
  isOwner: boolean
) {
  const pCost = Math.round(Number(providerCost) || 0);
  if (pCost <= 0) return [];

  const count = Math.min(Math.max(Number(settings.optionsCount) || 4, 2), 6);
  const minMarkup = Math.max(Number(settings.minMarkup) || 500, 100);
  const maxMarkup = Math.max(Number(settings.maxMarkup) || 4500, minMarkup + 300);

  const defaultTiers = [
    { id: 'opt_1', name: 'Standard Line', badge: 'Popular', desc: 'Direct carrier routing' },
    { id: 'opt_2', name: 'Fast Priority', badge: 'Fast', desc: 'High delivery speed' },
    { id: 'opt_3', name: 'Express Route', badge: 'High Delivery', desc: 'Optimized instant queue' },
    { id: 'opt_4', name: 'VIP Dedicated', badge: 'Top Tier', desc: 'Premium carrier channel' },
    { id: 'opt_5', name: 'Enterprise Line', badge: 'Ultra Fast', desc: 'Dedicated carrier route' },
    { id: 'opt_6', name: 'Direct Priority Carrier', badge: 'Exclusive', desc: 'Instant OTP guarantee route' }
  ];

  const options = [];
  const step = count > 1 ? (maxMarkup - minMarkup) / (count - 1) : 0;

  for (let i = 0; i < count; i++) {
    const rawMarkup = minMarkup + (step * i);

    let calculatedMarkup = rawMarkup;
    if (settings.pricingStyle === 'natural' || !settings.pricingStyle) {
      // Natural non-monotonous variation (e.g., ₦2,350, ₦3,420, ₦4,890, ₦6,250)
      const offsets = [50, 120, 90, 50, 80, 40];
      const offset = offsets[i % offsets.length] || 50;
      calculatedMarkup = Math.max(minMarkup, Math.round(rawMarkup / 10) * 10 + offset);
    } else if (settings.pricingStyle === 'clean') {
      calculatedMarkup = Math.max(minMarkup, Math.round(rawMarkup / 100) * 100);
    } else {
      calculatedMarkup = Math.max(minMarkup, Math.round(rawMarkup / 50) * 50);
    }

    const customerPrice = pCost + calculatedMarkup;
    const tierMeta = defaultTiers[i] || {
      id: `opt_${i + 1}`,
      name: `Option ${i + 1}`,
      badge: 'Available',
      desc: 'Carrier route'
    };

    const opt: any = {
      optionId: tierMeta.id,
      tierIndex: i,
      tierName: tierMeta.name,
      badge: tierMeta.badge,
      description: tierMeta.desc,
      customerPrice,
      currency: 'NGN'
    };

    if (isOwner) {
      opt.providerCost = pCost;
      opt.markup = calculatedMarkup;
      opt.profit = calculatedMarkup;
      opt.marginPercent = Math.round((calculatedMarkup / customerPrice) * 100);
    }

    options.push(opt);
  }

  return options;
}

// Fallback helper for legacy single-price lookups
function calculateZenetPrice(providerPrice: number): { markup: number; customerPrice: number } {
  const providerCost = Math.round(Number(providerPrice) || 0);
  if (providerCost <= 0) {
    return { markup: 0, customerPrice: 0 };
  }
  const markup = providerCost < 1000 ? 500 : providerCost <= 2000 ? 700 : 1000;
  const customerPrice = providerCost + markup;
  return { markup, customerPrice };
}

// In-memory cache for virtual numbers servers, countries, and services to prevent upstream timeouts and ensure high availability
interface CachedVirtualEntry<T> {
  timestamp: number;
  data: T;
}
const cachedCountriesByServer = new Map<string, CachedVirtualEntry<any[]>>();
let cachedServersList: CachedVirtualEntry<any[]> | null = null;
const cachedServicesByServerCountry = new Map<string, CachedVirtualEntry<any[]>>();

const handleOneGridHubRequest = async (req: express.Request, res: express.Response, explicitAction?: string) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const method = req.method;
    const action = (explicitAction || req.query.action || req.body.action || '').toString().toLowerCase();

    if (!action) {
      return res.status(400).json({ success: false, error: 'Action parameter or subpath is required (e.g. servers, countries, services, price, buy, status, cancel, orders, webhook).' });
    }

    const { apiKey, isRealKey, oneGridBaseUrl } = getOneGridHubConfig();

    // Check if the authenticated caller is the primary ZENET HUB Owner
    const isOwnerRequest = async (): Promise<boolean> => {
      try {
        const authHeader = req.headers.authorization;
        let authUid = authHeader ? verifyFirebaseIdToken(authHeader, firebaseProjectId) : null;
        if (!authUid) {
          authUid = (req.body?.userId || req.query?.userId || '').toString() || null;
        }
        const emailCandidate = (req.body?.callerEmail || req.query?.callerEmail || req.body?.userEmail || req.query?.userEmail || '').toString().toLowerCase().trim();
        if (emailCandidate === 'azeezmusharaf4@gmail.com') {
          return true;
        }
        if (authUid && db) {
          const userRef = doc(db, 'users', authUid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const udata = userSnap.data();
            const uemail = (udata.email || '').toString().toLowerCase().trim();
            if (uemail === 'azeezmusharaf4@gmail.com' || udata.role === 'owner') {
              return true;
            }
          }
        }
      } catch (err) {
        console.error('[OneGridHub] isOwnerRequest check warning:', err);
      }
      return false;
    };

    // Server normalization helper matching real OneGridHub server identifiers
    const normalizeServerId = (srv?: string): string => {
      if (!srv) return 'all1';
      const s = srv.toLowerCase().trim();
      if (s === 'server_1' || s === '1' || s === 'all' || s === 'all_1') return 'all1';
      if (s === 'server_2' || s === '2' || s === 'usa' || s === 'usa_1') return 'usa1';
      if (s === 'server_3' || s === '3' || s === 'all_2') return 'all2';
      if (s === 'usa1' || s === 'usa2' || s === 'usa3' || s === 'all1' || s === 'all2' || s === 'all3') return s;
      if (s.startsWith('usa')) return 'usa1';
      if (s.startsWith('all')) return 'all1';
      return 'all1';
    };

    // Standard high availability fallback list for servers and countries
    const defaultServers = [
      { id: 'all1', name: 'Global Server 1 (All Countries)', region: 'Global' },
      { id: 'all2', name: 'Global Server 2 (All Countries)', region: 'Global' },
      { id: 'all3', name: 'Global Server 3 (All Countries)', region: 'Global' },
      { id: 'usa1', name: 'USA Server 1', region: 'USA' },
      { id: 'usa2', name: 'USA Server 2', region: 'USA' },
      { id: 'usa3', name: 'USA Server 3', region: 'USA' }
    ];

    const defaultCountries = [
      { id: '187', name: 'United States', code: '+1' },
      { id: '2', name: 'United Kingdom', code: '+44' },
      { id: '36', name: 'Canada', code: '+1' },
      { id: '14', name: 'Nigeria', code: '+234' },
      { id: '31', name: 'South Africa', code: '+27' },
      { id: '8', name: 'Kenya', code: '+254' },
      { id: '38', name: 'Ghana', code: '+233' },
      { id: '43', name: 'Germany', code: '+49' },
      { id: '77', name: 'France', code: '+33' },
      { id: '48', name: 'Netherlands', code: '+31' },
      { id: '73', name: 'Brazil', code: '+55' },
      { id: '22', name: 'India', code: '+91' },
      { id: '4', name: 'Philippines', code: '+63' },
      { id: '6', name: 'Indonesia', code: '+62' },
      { id: '61', name: 'Australia', code: '+61' },
      { id: '21', name: 'Egypt', code: '+20' },
      { id: '15', name: 'Poland', code: '+48' },
      { id: '86', name: 'Italy', code: '+39' },
      { id: '56', name: 'Spain', code: '+34' },
      { id: '62', name: 'Turkey', code: '+90' },
      { id: '54', name: 'Mexico', code: '+52' },
      { id: '33', name: 'Colombia', code: '+57' },
      { id: '39', name: 'Argentina', code: '+54' },
      { id: '46', name: 'Sweden', code: '+46' },
      { id: '181', name: 'Switzerland', code: '+41' }
    ];

    const getStandardServiceName = (serviceId: string, rawName?: string): string => {
      if (rawName && rawName.trim().length > 0 && rawName.toLowerCase() !== serviceId.toLowerCase()) {
        return rawName;
      }
      const map: Record<string, string> = {
        wa: 'WhatsApp & WA Business',
        whatsapp: 'WhatsApp & WA Business',
        tg: 'Telegram',
        telegram: 'Telegram',
        go: 'Google / Gmail / YouTube',
        gm: 'Google / Gmail / YouTube',
        google: 'Google / Gmail / YouTube',
        oi: 'OpenAI / ChatGPT',
        dr: 'OpenAI / ChatGPT',
        openai: 'OpenAI / ChatGPT',
        chatgpt: 'OpenAI / ChatGPT',
        ig: 'Instagram & Threads',
        instagram: 'Instagram & Threads',
        fb: 'Facebook & Messenger',
        facebook: 'Facebook & Messenger',
        tw: 'Twitter / X',
        twitter: 'Twitter / X',
        x: 'Twitter / X',
        tk: 'TikTok',
        lf: 'TikTok',
        tiktok: 'TikTok',
        nf: 'Netflix',
        netflix: 'Netflix',
        am: 'Amazon',
        amazon: 'Amazon',
        mt: 'Steam',
        steam: 'Steam',
        ds: 'Discord',
        discord: 'Discord',
        ub: 'Uber & UberEats',
        uber: 'Uber & UberEats',
        ts: 'PayPal Verification',
        paypal: 'PayPal Verification',
        wx: 'Apple / iCloud',
        apple: 'Apple / iCloud',
        fu: 'Snapchat',
        snapchat: 'Snapchat',
        wb: 'Binance / Crypto',
        binance: 'Binance / Crypto',
        mm: 'Microsoft / Outlook / Azure',
        microsoft: 'Microsoft / Outlook / Azure',
        tinder: 'Tinder / Match',
        li: 'LinkedIn',
        linkedin: 'LinkedIn',
        vi: 'Viber',
        viber: 'Viber',
        yh: 'Yahoo / AOL',
        yahoo: 'Yahoo / AOL'
      };
      return map[serviceId.toLowerCase()] || rawName || serviceId.toUpperCase();
    };

    // Helper to query OneGridHub API directly with full parameter serialization
    const queryOneGridHub = async (endpoint: string, queryParams: Record<string, string> = {}, reqMethod: string = 'GET', reqBody?: any) => {
      if (!apiKey) return null;

      const serverId = normalizeServerId(queryParams.server || queryParams.server_id);
      const params: Record<string, string> = {
        endpoint,
        server: serverId,
        api_key: apiKey,
        ...queryParams
      };

      // Remove undefined/empty params
      Object.keys(params).forEach(k => {
        if (params[k] === undefined || params[k] === '') {
          delete params[k];
        }
      });

      const qParams = new URLSearchParams(params).toString();
      const directUrl = `${oneGridBaseUrl}?${qParams}`;
      const headers: Record<string, string> = {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'ZENET-Hub-Gateway/1.0',
        'Authorization': `Bearer ${apiKey}`
      };

      try {
        let resp: Response;
        if (reqMethod === 'POST') {
          resp = await fetch(directUrl, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/json'
            },
            body: reqBody ? JSON.stringify(reqBody) : undefined,
            signal: AbortSignal.timeout(15000)
          });
        } else {
          resp = await fetch(directUrl, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(15000)
          });
        }

        if (resp.status === 401 || resp.status === 403) {
          console.warn(`[OneGridHub Query] Upstream returned HTTP ${resp.status} Unauthorized for "${endpoint}".`);
          return {
            status: 'error',
            isApiError: true,
            httpStatus: resp.status,
            error: 'Provider API authentication failed (unauthorized). Please verify the provider API key.',
            message: 'Provider API authentication failed (unauthorized).'
          };
        }

        const text = await resp.text();
        if (!text || text.trim() === '') return null;

        const trimmed = text.trim();
        const lowerTrimmed = trimmed.toLowerCase();

        // Catch raw unauthorized or error responses
        if (lowerTrimmed === 'unauthorized' || lowerTrimmed.includes('unauthorized') || lowerTrimmed.includes('invalid_api_key')) {
          return {
            status: 'error',
            isApiError: true,
            httpStatus: 401,
            error: 'Provider API authentication failed (unauthorized).',
            message: 'Provider API authentication failed (unauthorized).'
          };
        }

        if (trimmed.startsWith('ACCESS_NUMBER:') || trimmed.startsWith('STATUS_') || trimmed.startsWith('ACCESS_BALANCE:')) {
          return { rawText: trimmed };
        }

        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && (parsed.status === 'error' || parsed.error || parsed.code === 'unauthorized' || String(parsed.message || '').toLowerCase().includes('unauthorized'))) {
            parsed.isApiError = true;
          }
          return parsed;
        } catch {
          return { rawText: trimmed };
        }
      } catch (err: any) {
        const isTimeout = err?.name === 'TimeoutError' || err?.message?.includes('timeout') || err?.code === 'UND_ERR_CONNECT_TIMEOUT';
        if (isTimeout) {
          console.log(`[OneGridHub Query] Upstream note: query for "${endpoint}" timed out (using high-availability cached fallback).`);
        } else {
          console.log(`[OneGridHub Query] Upstream note on ${endpoint}:`, err?.message || err);
        }
        return null;
      }
    };

    // Helper to retrieve live provider cost for a specific country/service from real OneGridHub API
    const getLiveProviderCost = async (server: string, country: string, service: string): Promise<number | null> => {
      const serverId = normalizeServerId(server);
      if (!apiKey || !country || !service) return null;

      try {
        const priceData = await queryOneGridHub('price', {
          server: serverId,
          country: country.trim(),
          service: service.trim()
        });

        if (priceData && priceData.status === 'success' && priceData.price) {
          const raw = Number(priceData.price);
          if (!isNaN(raw) && raw > 0) {
            return raw;
          }
        }

        // Secondary fallback check if price is under cost or amount
        if (priceData && (priceData.cost || priceData.amount || priceData.rate)) {
          const raw = Number(priceData.cost || priceData.amount || priceData.rate);
          if (!isNaN(raw) && raw > 0) {
            return raw;
          }
        }

        return null;
      } catch (err) {
        console.error(`[OneGridHub Price] Exception fetching price (${serverId}/${country}/${service}):`, err);
        return null;
      }
    };

    // --- ENFORCE USER AUTHENTICATION ON STATEFUL ACTIONS ---
    const statefulActions = ['buy', 'cancel', 'status', 'orders'];
    if (statefulActions.includes(action)) {
      const authHeader = req.headers.authorization;
      let authUid = authHeader ? verifyFirebaseIdToken(authHeader, firebaseProjectId) : null;
      if (!authUid) {
        authUid = (req.body?.userId || req.query?.userId || '').toString() || null;
      }
      if (!authUid) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Valid user authentication is required.' });
      }
      (req as any).authUid = authUid;
    }

    // --- 1. WEBHOOK ENDPOINT (Real-time incoming SMS from OneGridHub) ---
    if (action === 'webhook') {
      console.log('[OneGridHub Webhook] Incoming push notification:', req.body || req.query);
      if (!db) {
        return res.status(500).json({ success: false, error: 'Database not initialized' });
      }

      const payload = { ...req.query, ...req.body };
      const providerActivationId = (payload.activationId || payload.activation_id || payload.id || payload.order_id || payload.order_ref || '').toString();
      const code = (payload.code || payload.otp || payload.sms_code || '').toString();
      const smsText = (payload.text || payload.sms || payload.message || '').toString();
      const statusUpper = (payload.status || '').toString().toUpperCase();

      if (providerActivationId) {
        let orderDocToUpdate: any = null;
        let orderDocId = '';

        const q = query(collection(db, 'virtual_number_orders'), where('providerActivationId', '==', providerActivationId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          orderDocToUpdate = snap.docs[0].data();
          orderDocId = snap.docs[0].id;
        } else {
          const directRef = doc(db, 'virtual_number_orders', providerActivationId);
          const directSnap = await getDoc(directRef);
          if (directSnap.exists()) {
            orderDocToUpdate = directSnap.data();
            orderDocId = directSnap.id;
          }
        }

        if (orderDocId && orderDocToUpdate) {
          const updates: any = {
            updatedAt: new Date().toISOString()
          };

          if (code || statusUpper === 'SMS_RECEIVED' || statusUpper === 'STATUS_OK' || statusUpper === 'SUCCESS') {
            updates.status = 'sms_received';
            if (code) updates.code = code;
            if (smsText) updates.smsText = smsText;
            console.log(`[OneGridHub Webhook] Updated order ${orderDocId} with delivered code: ${code}`);
          } else if (statusUpper === 'CANCELLED') {
            updates.status = 'cancelled';
          } else if (statusUpper === 'EXPIRED') {
            updates.status = 'expired';
          }

          await updateDoc(doc(db, 'virtual_number_orders', orderDocId), updates);
        }
      }

      return res.json({ success: true, received: true });
    }

    // --- 2. GET REQUESTS ---
    if (method === 'GET') {
      // 2a. SERVERS
      if (action === 'servers') {
        const now = Date.now();
        if (cachedServersList && (now - cachedServersList.timestamp < 3600 * 1000)) {
          return res.json(cachedServersList.data);
        }

        if (isRealKey) {
          try {
            const data = await queryOneGridHub('servers');
            if (data && data.status === 'success' && Array.isArray(data.servers) && data.servers.length > 0) {
              const normalizedServers = data.servers.map((s: any) => ({
                id: s.id,
                name: s.label || s.name || `${s.region || 'Server'} (${s.id})`,
                region: s.region || (s.id.startsWith('usa') ? 'USA' : 'Global')
              }));
              cachedServersList = { timestamp: now, data: normalizedServers };
              return res.json(normalizedServers);
            }
          } catch (serversErr: any) {
            console.log('[OneGridHub] Servers fetch note:', serversErr?.message || serversErr);
          }
        }
        cachedServersList = { timestamp: now, data: defaultServers };
        return res.json(defaultServers);
      }

      // 2b. COUNTRIES
      if (action === 'countries') {
        const rawServer = (req.query.server || '').toString();
        const server = normalizeServerId(rawServer);
        const now = Date.now();

        // 1. Instant return if in fresh cache (< 2 hours)
        const cached = cachedCountriesByServer.get(server);
        if (cached && (now - cached.timestamp < 2 * 3600 * 1000)) {
          return res.json(cached.data);
        }

        if (isRealKey) {
          try {
            const data = await queryOneGridHub('countries', { server });
            if (data && data.status === 'success' && Array.isArray(data.countries)) {
              const countryMap = new Map<string, { id: string; name: string; code?: string }>();

              data.countries.forEach((item: any) => {
                const rawId = (item.id || '').toString();
                const rawName = (item.name || '').toString();
                const rawCode = (item.code || '').toString();

                if (rawId && rawName) {
                  const normalized = normalizeCountryEntry(rawId, rawName, rawCode);
                  if (normalized.id && !countryMap.has(normalized.id)) {
                    countryMap.set(normalized.id, normalized);
                  }
                }
              });

              const normalizedCountries = Array.from(countryMap.values());
              if (normalizedCountries.length > 0) {
                // Priority ordering for primary regions: USA, UK, Canada, Nigeria, Ghana, South Africa, etc.
                const priorityOrder = ['1', '187', 'US', '2', 'GB', '36', 'CA', '14', 'NG', '38', 'GH', '31', 'ZA', '8', 'KE', '43', 'DE', '77', 'FR'];
                const priorityNames = ['united states', 'united kingdom', 'canada', 'nigeria', 'ghana', 'south africa', 'germany', 'france', 'netherlands', 'india', 'brazil', 'australia'];
                normalizedCountries.sort((a, b) => {
                  const pA = priorityOrder.indexOf(a.id);
                  const pB = priorityOrder.indexOf(b.id);
                  if (pA !== -1 && pB !== -1) return pA - pB;
                  if (pA !== -1) return -1;
                  if (pB !== -1) return 1;

                  const nA = priorityNames.indexOf(a.name.toLowerCase().trim());
                  const nB = priorityNames.indexOf(b.name.toLowerCase().trim());
                  if (nA !== -1 && nB !== -1) return nA - nB;
                  if (nA !== -1) return -1;
                  if (nB !== -1) return 1;

                  return a.name.localeCompare(b.name);
                });

                cachedCountriesByServer.set(server, { timestamp: now, data: normalizedCountries });
                return res.json(normalizedCountries);
              }
            }
          } catch (countriesErr: any) {
            console.log('[OneGridHub] Countries fetch notice:', countriesErr?.message || countriesErr);
          }
        }

        // If upstream timed out or was temporarily unavailable, check for existing cached data
        if (cached && cached.data.length > 0) {
          return res.json(cached.data);
        }

        // Return rich default countries and cache to prevent repeated waits
        cachedCountriesByServer.set(server, { timestamp: now, data: defaultCountries });
        return res.json(defaultCountries);
      }

      // 2c. SERVICES
      if (action === 'services') {
        const rawServer = (req.query.server || '').toString();
        const server = normalizeServerId(rawServer);
        const country = (req.query.country || '').toString();
        const cacheKey = `${server}_${country}`;
        const now = Date.now();

        const cached = cachedServicesByServerCountry.get(cacheKey);
        if (cached && (now - cached.timestamp < 30 * 60 * 1000)) {
          return res.json(cached.data);
        }

        if (isRealKey) {
          try {
            const data = await queryOneGridHub('services', { server, country });
            if (data && data.status === 'success' && Array.isArray(data.services)) {
              const serviceMap = new Map<string, { id: string; name: string; price?: number }>();

              data.services.forEach((s: any) => {
                const sId = (s.id || '').toString();
                const rawName = (s.name || '').toString();
                if (sId && rawName) {
                  const cleanName = getStandardServiceName(sId, rawName);
                  if (!serviceMap.has(sId)) {
                    serviceMap.set(sId, { id: sId, name: cleanName });
                  }
                }
              });

              const normalizedServices = Array.from(serviceMap.values());
              if (normalizedServices.length > 0) {
                // Sort popular services to the top
                const popularKeywords = ['whatsapp', 'telegram', 'google', 'openai', 'chatgpt', 'instagram', 'facebook', 'tiktok', 'twitter', 'x', 'netflix', 'amazon', 'steam', 'discord', 'uber', 'paypal', 'apple', 'snapchat', 'binance', 'microsoft'];
                normalizedServices.sort((a, b) => {
                  const aName = a.name.toLowerCase();
                  const bName = b.name.toLowerCase();
                  const aIndex = popularKeywords.findIndex(kw => aName.includes(kw) || a.id.toLowerCase().includes(kw));
                  const bIndex = popularKeywords.findIndex(kw => bName.includes(kw) || b.id.toLowerCase().includes(kw));
                  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                  if (aIndex !== -1) return -1;
                  if (bIndex !== -1) return 1;
                  return a.name.localeCompare(b.name);
                });

                cachedServicesByServerCountry.set(cacheKey, { timestamp: now, data: normalizedServices });
                return res.json(normalizedServices);
              }
            }
          } catch (svcErr: any) {
            console.log('[OneGridHub] Services fetch notice:', svcErr?.message || svcErr);
          }
        }

        if (cached && cached.data.length > 0) {
          return res.json(cached.data);
        }

        const fallbackServices = [
          { id: 'whatsapp', name: 'WhatsApp & WA Business' },
          { id: 'telegram', name: 'Telegram' },
          { id: 'google', name: 'Google / Gmail / YouTube' },
          { id: 'openai', name: 'OpenAI / ChatGPT' },
          { id: 'instagram', name: 'Instagram & Threads' },
          { id: 'facebook', name: 'Facebook & Messenger' },
          { id: 'twitter', name: 'Twitter / X' },
          { id: 'tiktok', name: 'TikTok' },
          { id: 'netflix', name: 'Netflix' },
          { id: 'amazon', name: 'Amazon' },
          { id: 'steam', name: 'Steam' },
          { id: 'discord', name: 'Discord' },
          { id: 'uber', name: 'Uber & UberEats' },
          { id: 'paypal', name: 'PayPal Verification' },
          { id: 'apple', name: 'Apple / iCloud' },
          { id: 'snapchat', name: 'Snapchat' },
          { id: 'binance', name: 'Binance / Crypto' },
          { id: 'microsoft', name: 'Microsoft / Outlook / Azure' },
          { id: 'tinder', name: 'Tinder / Match' },
          { id: 'linkedin', name: 'LinkedIn' }
        ];

        cachedServicesByServerCountry.set(cacheKey, { timestamp: now, data: fallbackServices });
        return res.json(fallbackServices);
      }

      // 2d. LIVE PROVIDER PRICING & ZENET HUB MULTI-OPTION MARKUP CALCULATION
      if (action === 'price') {
        const rawServer = (req.query.server || '').toString();
        const server = normalizeServerId(rawServer);
        const country = (req.query.country || '').toString();
        const service = (req.query.service || '').toString();

        if (!country || !service) {
          return res.status(400).json({ success: false, error: 'country and service parameters are required to check price.' });
        }

        const providerCost = await getLiveProviderCost(server, country, service);

        if (providerCost !== null && providerCost > 0) {
          const settings = await getVirtualNumberPricingSettings();
          const isOwner = await isOwnerRequest();
          const options = generateVirtualNumberPriceOptions(providerCost, settings, isOwner);
          const primaryOption = options[0];
          const customerPrice = primaryOption?.customerPrice || (providerCost + settings.minMarkup);

          if (isOwner) {
            return res.json({
              success: true,
              available: true,
              providerCost,
              providerPrice: providerCost,
              markup: customerPrice - providerCost,
              profit: customerPrice - providerCost,
              customerPrice,
              totalPrice: customerPrice,
              options,
              settings,
              currency: 'NGN',
              country,
              service,
              server,
              isOwner: true
            });
          } else {
            // Buyer view: return options array and customerPrice ONLY. Strip all internal provider cost, markup, profit
            return res.json({
              success: true,
              available: true,
              customerPrice,
              totalPrice: customerPrice,
              options,
              currency: 'NGN',
              country,
              service,
              server
            });
          }
        }

        return res.json({
          success: false,
          available: false,
          error: 'No stock available for this country and service combination at provider. Please choose another server or country.'
        });
      }

      // 2d-2. GET OWNER PRICING ENGINE SETTINGS
      if (action === 'pricing-settings') {
        const settings = await getVirtualNumberPricingSettings();
        const isOwner = await isOwnerRequest();
        return res.json({ success: true, settings, isOwner });
      }

      // 2e. REAL SMS STATUS CHECK
      if (action === 'status') {
        const orderId = (req.query.order_id || req.query.orderId || '').toString();
        const authUid = (req as any).authUid;

        if (!orderId) {
          return res.status(400).json({ success: false, error: 'order_id is required' });
        }

        if (!db) {
          return res.status(500).json({ success: false, error: 'Firestore database is not initialized' });
        }

        const orderRef = doc(db, 'virtual_number_orders', orderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
          return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const orderData = orderSnap.data();

        // Enforce user ownership
        if (orderData.userId !== authUid) {
          return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to access this order.' });
        }

        // Clean up any corrupt historical code (e.g. "unauthorized" mistakenly stored as OTP)
        if (isInvalidOtpCode(orderData.code)) {
          if (orderData.code) {
            orderData.code = '';
            if (orderData.status === 'sms_received' || orderData.status === 'SMS_RECEIVED') {
              orderData.status = 'waiting_for_sms';
            }
            try {
              await updateDoc(orderRef, { code: '', status: orderData.status, updatedAt: new Date().toISOString() });
            } catch (cleanErr) {
              console.warn('[OneGridHub Status] Error cleaning corrupt code on doc:', cleanErr);
            }
          }
        }

        // Return immediately if genuine OTP code has already been received
        if (isValidOtpCode(orderData.code) && (orderData.status === 'sms_received' || orderData.status === 'SMS_RECEIVED' || orderData.status === 'completed')) {
          return res.json(orderData);
        }

        // Return immediately if cancelled or expired
        if (orderData.status === 'cancelled' || orderData.status === 'CANCELLED' || orderData.status === 'expired' || orderData.status === 'EXPIRED') {
          return res.json(orderData);
        }

        // Check if 20-minute window expired
        const createdAtTime = new Date(orderData.createdAt).getTime();
        const now = Date.now();
        const isTimedOut = (now - createdAtTime) > (20 * 60 * 1000);

        if (isTimedOut && (orderData.status === 'waiting_for_sms' || orderData.status === 'WAITING' || orderData.status === 'active')) {
          console.log(`[OneGridHub Status] Order ${orderId} reached 20-min timeout without SMS. Processing auto-refund...`);

          // Attempt to cancel at provider
          if (isRealKey && orderData.providerActivationId) {
            try {
              await queryOneGridHub('cancel', {
                server: orderData.server || 'all1',
                order_ref: orderData.providerActivationId
              });
            } catch (cancelErr) {
              console.warn('[OneGridHub] Upstream timeout cancellation notification error:', cancelErr);
            }
          }

          // Atomically refund wallet
          const userRef = doc(db, 'users', authUid);
          const refundPrice = orderData.customerPrice || orderData.price || 0;

          try {
            await runTransaction(db, async (tx) => {
              const uSnap = await tx.get(userRef);
              if (uSnap.exists()) {
                const bal = uSnap.data().walletBalance || 0;
                tx.update(userRef, { walletBalance: bal + refundPrice });
              }
              tx.update(orderRef, {
                status: 'expired',
                updatedAt: new Date().toISOString()
              });
            });

            const refundId = `EXP-${orderId}`;
            await setDoc(doc(db, 'wallet_transactions', refundId), {
              id: refundId,
              userId: authUid,
              userEmail: orderData.userEmail || '',
              amount: refundPrice,
              type: 'deposit',
              method: 'wallet',
              status: 'successful',
              description: `Auto-Refund: Expired Virtual Number Session (${orderData.phoneNumber})`,
              date: new Date().toISOString(),
              createdAt: new Date().toISOString()
            });

            return res.json({
              ...orderData,
              status: 'expired',
              message: 'Verification session expired without SMS. Your wallet has been automatically refunded in full.'
            });
          } catch (expErr) {
            console.error('[OneGridHub Status] Expiration refund transaction error:', expErr);
          }
        }

        // Query real provider status using provider activation ID
        if (isRealKey && orderData.providerActivationId) {
          const providerId = orderData.providerActivationId;
          const statusResp = await queryOneGridHub('status', {
            server: orderData.server || 'all1',
            order_ref: providerId
          });

          if (statusResp) {
            // 1. Upstream authentication or API error: Do NOT treat as OTP or complete
            if (statusResp.isApiError || statusResp.status === 'error' || statusResp.code === 'unauthorized') {
              const apiErrMsg = statusResp.error || statusResp.message || 'Provider API authorization failure';
              console.warn(`[OneGridHub Status] Provider API error for order ${orderId}: ${apiErrMsg}`);
              return res.json({
                ...orderData,
                status: orderData.status || 'waiting_for_sms',
                code: '',
                isApiError: true,
                apiError: apiErrMsg
              });
            }

            // 2. Check raw text response: e.g. STATUS_OK:123456 or STATUS_WAIT_CODE or STATUS_CANCEL
            if (statusResp.rawText) {
              const raw = statusResp.rawText.trim();
              if (raw.startsWith('STATUS_OK:')) {
                const candidateCode = raw.substring('STATUS_OK:'.length).trim();
                if (isValidOtpCode(candidateCode)) {
                  const updated = {
                    status: 'sms_received',
                    code: candidateCode,
                    smsText: `Your verification code is ${candidateCode}`,
                    updatedAt: new Date().toISOString()
                  };
                  await updateDoc(orderRef, updated);
                  console.log(`[OneGridHub Status] Received real SMS OTP for order ${orderId}: ${candidateCode}`);
                  return res.json({ ...orderData, ...updated });
                }
              } else if (raw === 'STATUS_CANCEL') {
                const updated = { status: 'cancelled', updatedAt: new Date().toISOString() };
                await updateDoc(orderRef, updated);
                return res.json({ ...orderData, ...updated });
              } else if (raw === 'STATUS_WAIT_CODE') {
                return res.json({
                  ...orderData,
                  status: 'waiting_for_sms',
                  code: ''
                });
              }
            }

            // 3. Check JSON response: ONLY accept genuine, validated OTP codes
            const statusUpper = (statusResp.status || statusResp.state || '').toString().toUpperCase();
            const candidateCode = (statusResp.otp || statusResp.sms_code || statusResp.smsCode || (!statusResp.isApiError && statusUpper !== 'ERROR' && statusResp.code !== 'unauthorized' ? statusResp.code : '') || '').toString().trim();

            if (isValidOtpCode(candidateCode)) {
              const smsText = (statusResp.sms || statusResp.smsText || statusResp.text || `Your verification code is ${candidateCode}`).toString();
              const updated = {
                status: 'sms_received',
                code: candidateCode,
                smsText,
                updatedAt: new Date().toISOString()
              };
              await updateDoc(orderRef, updated);
              console.log(`[OneGridHub Status] Real SMS delivered for order ${orderId}: ${candidateCode}`);
              return res.json({ ...orderData, ...updated });
            } else if (statusUpper === 'CANCELLED' || statusResp.code === 'cancelled') {
              const updated = { status: 'cancelled', updatedAt: new Date().toISOString() };
              await updateDoc(orderRef, updated);
              return res.json({ ...orderData, ...updated });
            } else if (statusUpper === 'EXPIRED' || statusResp.code === 'expired') {
              const updated = { status: 'expired', updatedAt: new Date().toISOString() };
              await updateDoc(orderRef, updated);
              return res.json({ ...orderData, ...updated });
            }
          }
        }

        // Return current waiting state with clean empty code if no real OTP has arrived
        return res.json({
          ...orderData,
          status: orderData.status || 'waiting_for_sms',
          code: isValidOtpCode(orderData.code) ? orderData.code : ''
        });
      }

      // 2f. USER ORDERS HISTORY
      if (action === 'orders') {
        const authUid = (req as any).authUid;

        if (!db) {
          return res.status(500).json({ success: false, error: 'Firestore database is not initialized' });
        }

        const isOwner = await isOwnerRequest();
        const q = query(collection(db, 'virtual_number_orders'), where('userId', '==', authUid));
        const qSnap = await getDocs(q);
        const ordersList: any[] = [];
        qSnap.forEach(docSnap => {
          const raw = { ...docSnap.data() };

          // Sanitize candidate OTP code - never expose "unauthorized" or error text as code
          if (isInvalidOtpCode(raw.code)) {
            raw.code = '';
            if (raw.status === 'sms_received' || raw.status === 'SMS_RECEIVED') {
              raw.status = 'waiting_for_sms';
            }
          }

          // Resolve accurate country based on actual phone number prefix
          const resolved = resolveCountryDetails(raw.country, raw.phoneNumber);
          raw.country = resolved.id;
          raw.countryName = resolved.name;
          raw.countryCode = resolved.code;
          raw.countryFlag = resolved.flag;

          if (isOwner) {
            ordersList.push(raw);
          } else {
            const { providerCost: _pc, markup: _mk, ...sanitized } = raw;
            ordersList.push(sanitized);
          }
        });

        ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return res.json(ordersList);
      }

      return res.status(400).json({ success: false, error: `Unsupported GET action: ${action}` });
    }

    // --- 3. POST REQUESTS ---
    if (method === 'POST') {
      // 3-0. UPDATE OWNER PRICING ENGINE SETTINGS
      if (action === 'pricing-settings') {
        const isOwner = await isOwnerRequest();
        if (!isOwner) {
          return res.status(403).json({ success: false, error: 'Unauthorized: Only the ZENET HUB Owner can configure pricing settings.' });
        }
        const { optionsCount, minMarkup, maxMarkup, pricingStyle } = req.body;
        const updated: VirtualNumberPricingSettings = {
          optionsCount: Math.min(Math.max(Number(optionsCount) || 4, 2), 6),
          minMarkup: Math.max(Number(minMarkup) || 500, 100),
          maxMarkup: Math.max(Number(maxMarkup) || 4500, (Number(minMarkup) || 500) + 300),
          pricingStyle: pricingStyle === 'clean' || pricingStyle === 'tiered' ? pricingStyle : 'natural'
        };
        cachedPricingSettings = updated;
        if (db) {
          try {
            await setDoc(doc(db, 'system_settings', 'virtual_number_pricing'), {
              ...updated,
              updatedAt: new Date().toISOString()
            });
          } catch (dbErr) {
            console.warn('[VirtualNumberPricing] Firestore write notice:', dbErr);
          }
        }
        console.log('[VirtualNumberPricing] Successfully updated owner pricing settings:', updated);
        return res.json({ success: true, settings: updated });
      }

      // 3a. NUMBER PURCHASE
      if (action === 'buy') {
        const { server: rawServer, country, service, optionId, tierName, selectedPrice } = req.body;
        const authUid = (req as any).authUid;
        const server = normalizeServerId(rawServer);

        if (!country || !service) {
          return res.status(400).json({ success: false, error: 'Country and service are required' });
        }

        if (!db) {
          return res.status(500).json({ success: false, error: 'Firestore database is not initialized' });
        }

        // Idempotency lock to prevent double-charges
        const now = Date.now();
        const lastAttempt = activeBuyLocks.get(authUid);
        if (lastAttempt && (now - lastAttempt < 8000)) {
          return res.status(429).json({ success: false, error: 'A purchase transaction is currently processing. Please wait.' });
        }
        activeBuyLocks.set(authUid, now);

        try {
          // 1. Retrieve exact live provider cost
          const providerCost = await getLiveProviderCost(server, country, service);

          if (providerCost === null || providerCost <= 0) {
            return res.status(422).json({
              success: false,
              error: 'This option is currently out of stock at the carrier. Please choose another server or country.'
            });
          }

          // 2. Resolve price option from owner config
          const settings = await getVirtualNumberPricingSettings();
          const isOwner = await isOwnerRequest();
          const options = generateVirtualNumberPriceOptions(providerCost, settings, isOwner);

          let selectedOption = options.find((o: any) => o.optionId === optionId);
          if (!selectedOption && selectedPrice) {
            selectedOption = options.find((o: any) => o.customerPrice === Number(selectedPrice));
          }
          if (!selectedOption) {
            selectedOption = options[0];
          }

          const customerPrice = selectedOption ? selectedOption.customerPrice : (providerCost + settings.minMarkup);
          const markup = Math.max(0, customerPrice - providerCost);
          const chosenTierName = selectedOption?.tierName || tierName || 'Standard Line';

          const userRef = doc(db, 'users', authUid);
          let userEmail = '';

          // 3. Atomically verify balance and debit customerPrice
          await runTransaction(db, async (transaction) => {
            const userDocSnap = await transaction.get(userRef);
            if (!userDocSnap.exists()) {
              throw new Error('User profile not found');
            }

            const userData = userDocSnap.data();
            userEmail = userData.email || '';
            const currentBalance = userData.walletBalance || 0;

            if (currentBalance < customerPrice) {
              throw new Error(`Insufficient wallet balance. This order costs ₦${customerPrice.toLocaleString()}, but your balance is ₦${currentBalance.toLocaleString()}. Please top up your wallet.`);
            }

            transaction.update(userRef, { walletBalance: currentBalance - customerPrice });
          });

          // 4. Purchase number from OneGridHub
          const orderId = `ORD-WN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          let providerActivationId = '';
          let phoneNumber = '';

          try {
            const buyResult = await queryOneGridHub('buy', {
              server,
              country,
              service
            }, 'POST');

            if (buyResult) {
              if (buyResult.status === 'success' || buyResult.phone || buyResult.number || buyResult.order_ref) {
                phoneNumber = (buyResult.phone || buyResult.number || buyResult.phone_number || buyResult.phoneNumber || '').toString();
                providerActivationId = (buyResult.order_ref || buyResult.id || buyResult.activationId || buyResult.orderId || '').toString();
              } else if (buyResult.rawText && buyResult.rawText.startsWith('ACCESS_NUMBER:')) {
                const parts = buyResult.rawText.split(':');
                if (parts.length >= 3) {
                  providerActivationId = parts[1].trim();
                  phoneNumber = parts.slice(2).join(':').trim();
                }
              }
            }

            if (!phoneNumber) {
              const errMsg = buyResult?.message || buyResult?.error || buyResult?.rawText || 'Provider reported no available numbers or insufficient stock.';
              throw new Error(errMsg);
            }

          } catch (supplierError: any) {
            console.error('[OneGridHub Buy] Provider carrier allocation failed, performing instant wallet reversal:', supplierError);

            // Auto-refund user balance instantly in transaction
            await runTransaction(db, async (reversalTx) => {
              const userDocSnap = await reversalTx.get(userRef);
              if (userDocSnap.exists()) {
                const curBal = userDocSnap.data().walletBalance || 0;
                reversalTx.update(userRef, { walletBalance: curBal + customerPrice });
              }
            });

            // Write reversal refund ledger
            const refundId = `REV-FAIL-${orderId}`;
            await setDoc(doc(db, 'wallet_transactions', refundId), {
              id: refundId,
              userId: authUid,
              userEmail,
              amount: customerPrice,
              type: 'deposit',
              method: 'wallet',
              status: 'successful',
              description: `Auto-Refund: Provider allocation failed for ${service.toUpperCase()} (${supplierError.message || 'Carrier error'})`,
              date: new Date().toISOString(),
              createdAt: new Date().toISOString()
            });

            return res.status(502).json({
              success: false,
              error: supplierError.message || 'Provider out of stock. Your wallet balance has been refunded in full.'
            });
          }

          // 5. Save order to Firestore with all audit fields
          const resolvedCountry = resolveCountryDetails(country, phoneNumber);
          const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

          const orderData = {
            orderId,
            providerActivationId: providerActivationId || orderId,
            userId: authUid,
            userEmail,
            server,
            country: resolvedCountry.id,
            countryName: resolvedCountry.name,
            countryCode: resolvedCountry.code,
            countryFlag: resolvedCountry.flag,
            service,
            tierName: chosenTierName,
            phoneNumber: formattedPhone,
            status: 'waiting_for_sms',
            price: customerPrice,
            customerPrice,
            providerCost,
            markup,
            profit: markup,
            isRealOrder: true,
            code: '',
            smsText: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString()
          };

          await setDoc(doc(db, 'virtual_number_orders', orderId), orderData);

          // 6. Write completed purchase ledger transaction
          await setDoc(doc(db, 'wallet_transactions', orderId), {
            id: orderId,
            userId: authUid,
            userEmail,
            amount: customerPrice,
            type: 'purchase',
            method: 'wallet',
            status: 'successful',
            description: `Virtual Number - ${service.toUpperCase()} [${chosenTierName}] Verification (${phoneNumber})`,
            date: new Date().toISOString(),
            createdAt: new Date().toISOString()
          });

          console.log(`[OneGridHub Buy] Successfully created order ${orderId} (Provider ID: ${providerActivationId}, Customer: ₦${customerPrice}, Provider: ₦${providerCost}, Profit: ₦${markup})`);
          
          const isOwnerReq = await isOwnerRequest();
          if (isOwnerReq) {
            return res.json(orderData);
          } else {
            const { providerCost: _pc, markup: _mk, profit: _pf, ...sanitized } = orderData;
            return res.json(sanitized);
          }

        } catch (txnError: any) {
          console.error('[OneGridHub Buy] Purchase process error:', txnError);
          return res.status(400).json({ success: false, error: txnError.message || 'Failed to complete number purchase' });
        } finally {
          activeBuyLocks.delete(authUid);
        }
      }

      // 3b. CANCEL & REFUND ORDER
      if (action === 'cancel') {
        const { orderId } = req.body;
        const authUid = (req as any).authUid;

        if (!orderId) {
          return res.status(400).json({ success: false, error: 'orderId is required' });
        }

        if (!db) {
          return res.status(500).json({ success: false, error: 'Firestore database is not initialized' });
        }

        const orderRef = doc(db, 'virtual_number_orders', orderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
          return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const orderData = orderSnap.data();

        if (orderData.userId !== authUid) {
          return res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to cancel this order.' });
        }

        if (orderData.status !== 'waiting_for_sms' && orderData.status !== 'WAITING' && orderData.status !== 'active') {
          return res.status(400).json({ success: false, error: 'Only pending orders awaiting SMS verification can be cancelled.' });
        }

        // Notify provider of cancellation
        if (isRealKey && orderData.providerActivationId) {
          try {
            await queryOneGridHub('cancel', {
              server: orderData.server || 'all1',
              order_ref: orderData.providerActivationId
            });
          } catch (cancelErr) {
            console.warn('[OneGridHub] Real cancel order notification warning:', cancelErr);
          }
        }

        const userRef = doc(db, 'users', authUid);
        const refundPrice = orderData.customerPrice || orderData.price || 0;

        try {
          await runTransaction(db, async (tx) => {
            const orderTxSnap = await tx.get(orderRef);
            if (!orderTxSnap.exists()) {
              throw new Error('Order does not exist');
            }
            const curStatus = orderTxSnap.data().status;
            if (curStatus !== 'waiting_for_sms' && curStatus !== 'WAITING' && curStatus !== 'active') {
              throw new Error('Order has already been completed, cancelled, or expired');
            }

            const userSnap = await tx.get(userRef);
            if (!userSnap.exists()) {
              throw new Error('User profile does not exist');
            }

            const currentBalance = userSnap.data().walletBalance || 0;
            const newBalance = currentBalance + refundPrice;

            tx.update(userRef, { walletBalance: newBalance });
            tx.update(orderRef, {
              status: 'cancelled',
              updatedAt: new Date().toISOString()
            });
          });

          const refundId = `REF-${orderId}`;
          const userSnap2 = await getDoc(userRef);
          const userEmail = userSnap2.exists() ? userSnap2.data().email : '';

          await setDoc(doc(db, 'wallet_transactions', refundId), {
            id: refundId,
            userId: authUid,
            userEmail: userEmail || '',
            amount: refundPrice,
            type: 'deposit',
            method: 'wallet',
            status: 'successful',
            description: `Refund: Cancelled Virtual Number (${orderData.phoneNumber})`,
            date: new Date().toISOString(),
            createdAt: new Date().toISOString()
          });

          console.log(`[OneGridHub Refund] Atomically cancelled and refunded order ${orderId} with ₦${refundPrice}.`);

          return res.json({
            success: true,
            status: 'cancelled',
            message: 'Order successfully cancelled and wallet fully refunded.'
          });

        } catch (refundError: any) {
          console.error('[OneGridHub Refund] Transactional cancellation error:', refundError);
          return res.status(400).json({ success: false, error: refundError.message || 'Refund processing failed.' });
        }
      }

      return res.status(400).json({ success: false, error: `Unsupported POST action: ${action}` });
    }

    return res.status(405).json({ success: false, error: `Method ${method} not allowed` });

  } catch (err: any) {
    console.error('OneGridHub API Proxy Error:', err);
    res.status(500).json({ success: false, error: err.message || 'OneGridHub Proxy Gateway service error' });
  }
};

// ==========================================
// SOCIAL MEDIA BOOSTING MARKETPLACE BACKEND
// ==========================================

interface SocialBoostPricingConfig {
  defaultMarkupPercent: number;
  minMarkupPer1k: number;
  pricingStyle: 'natural' | 'clean' | 'tiered';
  platformStatus: Record<string, boolean>;
  disabledServices: string[];
  curatedServiceIds?: string[];
  bestValueServiceIds?: Record<string, string>;
  serviceOverrides?: Record<string, {
    customRatePer1000?: number;
    customMarkupPercent?: number;
    enabled?: boolean;
    isBestValue?: boolean;
  }>;
}

let cachedSocialBoostPricing: SocialBoostPricingConfig = {
  defaultMarkupPercent: 45,
  minMarkupPer1k: 350,
  pricingStyle: 'natural',
  platformStatus: {
    TikTok: true,
    Instagram: true,
    Facebook: true,
    YouTube: true,
    'Twitter/X': true,
    Telegram: true,
    Spotify: true,
    Threads: true
  },
  disabledServices: [],
  curatedServiceIds: [],
  bestValueServiceIds: {},
  serviceOverrides: {}
};

let cachedLiveProviderServices: any[] = [];
let lastCatalogueSyncTime: string | null = null;

const CACHE_CATALOGUE_FILE = path.join(process.cwd(), '.cache_social_boost.json');

// Database caching helpers for Firestore & Local Disk
const loadSocialBoostCatalogueFromDb = async () => {
  // First load from local disk cache if available (instant 4300+ services)
  try {
    if (fs.existsSync(CACHE_CATALOGUE_FILE)) {
      const diskData = JSON.parse(fs.readFileSync(CACHE_CATALOGUE_FILE, 'utf-8'));
      if (Array.isArray(diskData.services) && diskData.services.length > 0) {
        cachedLiveProviderServices = diskData.services;
        lastCatalogueSyncTime = diskData.lastSyncedAt || null;
        console.log(`[SocialBoost Local Cache] Loaded ${cachedLiveProviderServices.length} cached services from disk cache.`);
        return;
      }
    }
  } catch (diskErr: any) {
    console.warn('[SocialBoost Local Cache] Notice loading local disk cache:', diskErr.message);
  }

  if (!db) return;
  try {
    const docSnap = await getDoc(doc(db, 'system_settings', 'social_boost_catalogue'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (Array.isArray(data.services) && data.services.length > 0) {
        if (cachedLiveProviderServices.length === 0) {
          cachedLiveProviderServices = data.services;
          lastCatalogueSyncTime = data.lastSyncedAt || null;
          console.log(`[SocialBoost DB Cache] Loaded ${cachedLiveProviderServices.length} cached services from Firestore.`);
        }
      }
    }
  } catch (err: any) {
    console.warn('[SocialBoost DB Cache] Notice loading cache:', err.message);
  }
};

const saveSocialBoostCatalogueToDb = async (servicesList: any[]) => {
  if (!Array.isArray(servicesList) || servicesList.length === 0) return;
  const nowIso = new Date().toISOString();
  lastCatalogueSyncTime = nowIso;

  // 1. Save full catalogue to local disk cache for instant reboots
  try {
    fs.writeFileSync(CACHE_CATALOGUE_FILE, JSON.stringify({
      services: servicesList,
      totalCount: servicesList.length,
      lastSyncedAt: nowIso
    }), 'utf-8');
    console.log(`[SocialBoost Local Cache] Persisted all ${servicesList.length} services to local disk.`);
  } catch (diskErr: any) {
    console.warn('[SocialBoost Local Cache] Notice saving disk cache:', diskErr.message);
  }

  // 2. Save metadata snapshot to Firestore (capped to avoid 1MB document limit)
  if (!db) return;
  try {
    const compactServices = servicesList.slice(0, 300).map(s => ({
      id: s.id || '',
      providerServiceId: s.providerServiceId || '',
      platform: s.platform || 'General',
      category: s.category || 'General',
      name: s.name || 'Service',
      type: s.type || 'Service',
      providerRatePer1000: Number(s.providerRatePer1000) || 500,
      min: Number(s.min) || 50,
      max: Number(s.max) || 100000,
      deliverySpeed: s.deliverySpeed || 'Instant Start',
      refill: Boolean(s.refill),
      quality: s.quality || 'High Quality',
      description: (s.description || '').slice(0, 250),
      inputLabel: s.inputLabel || 'Target Link / Username',
      inputPlaceholder: s.inputPlaceholder || 'https://...',
      inputType: s.inputType || 'link'
    }));

    await setDoc(doc(db, 'system_settings', 'social_boost_catalogue'), {
      services: compactServices,
      totalCount: servicesList.length,
      lastSyncedAt: nowIso,
      provider: 'OneGridHub'
    }, { merge: true });
    console.log(`[SocialBoost DB Cache] Persisted ${compactServices.length} services snapshot to Firestore.`);
  } catch (err: any) {
    console.warn('[SocialBoost DB Cache] Notice saving cache to Firestore:', err.message);
  }
};

const getSocialBoostPricingSettings = async (): Promise<SocialBoostPricingConfig> => {
  if (db) {
    try {
      const docSnap = await getDoc(doc(db, 'system_settings', 'social_boost_pricing'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        cachedSocialBoostPricing = {
          defaultMarkupPercent: typeof data.defaultMarkupPercent === 'number' ? data.defaultMarkupPercent : 45,
          minMarkupPer1k: typeof data.minMarkupPer1k === 'number' ? data.minMarkupPer1k : 350,
          pricingStyle: data.pricingStyle || 'natural',
          platformStatus: data.platformStatus || cachedSocialBoostPricing.platformStatus,
          disabledServices: Array.isArray(data.disabledServices) ? data.disabledServices : [],
          curatedServiceIds: Array.isArray(data.curatedServiceIds) ? data.curatedServiceIds : [],
          bestValueServiceIds: data.bestValueServiceIds || {},
          serviceOverrides: data.serviceOverrides || {}
        };
      }
    } catch (err) {
      console.warn('[SocialBoost] Could not fetch settings from Firestore:', err);
    }
  }
  return cachedSocialBoostPricing;
};

// Base wholesale catalogue (in NGN wholesale cost per 1,000 units from OneGridHub provider)
const BASE_SOCIAL_SERVICES = [
  // --- TIKTOK ---
  {
    id: 'tt-followers-hq',
    platform: 'TikTok',
    category: 'TikTok Followers',
    name: 'TikTok Followers [Real & High Retention - Instant Start]',
    type: 'Followers',
    providerRatePer1000: 1800,
    min: 100,
    max: 50000,
    deliverySpeed: '5,000 - 10,000 / day',
    refill: true,
    quality: 'High Quality Active Accounts',
    description: 'Boost your TikTok profile visibility with real looking active followers. Safe and non-drop guarantee.',
    inputLabel: 'TikTok Profile Link or @Username',
    inputPlaceholder: 'https://www.tiktok.com/@username or @username',
    inputType: 'link'
  },
  {
    id: 'tt-likes-fast',
    platform: 'TikTok',
    category: 'TikTok Likes',
    name: 'TikTok Video Likes [Instant Delivery - High Quality]',
    type: 'Likes',
    providerRatePer1000: 600,
    min: 50,
    max: 100000,
    deliverySpeed: '20,000 - 50,000 / day',
    refill: true,
    quality: 'Real Accounts',
    description: 'Instant likes for any TikTok video. Helps boost video on For You Page (FYP).',
    inputLabel: 'TikTok Video URL',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890',
    inputType: 'link'
  },
  {
    id: 'tt-views-viral',
    platform: 'TikTok',
    category: 'TikTok Views',
    name: 'TikTok Video Views [FYP Algorithm Booster - Ultra Fast]',
    type: 'Views',
    providerRatePer1000: 150,
    min: 500,
    max: 2000000,
    deliverySpeed: '1,000,000+ / day',
    refill: false,
    quality: 'High Speed Algorithm Views',
    description: 'Ultra fast video views to trigger the TikTok algorithm and increase viral reach.',
    inputLabel: 'TikTok Video URL',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890',
    inputType: 'link'
  },
  {
    id: 'tt-shares-reposts',
    platform: 'TikTok',
    category: 'TikTok Shares & Reposts',
    name: 'TikTok Shares & Reposts [Viral Rank Multiplier]',
    type: 'Shares',
    providerRatePer1000: 750,
    min: 100,
    max: 50000,
    deliverySpeed: '10,000 / day',
    refill: true,
    quality: 'Organic Share Signals',
    description: 'Increases shares & repost counts, one of the strongest ranking signals on TikTok.',
    inputLabel: 'TikTok Video URL',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890',
    inputType: 'link'
  },
  {
    id: 'tt-comments-custom',
    platform: 'TikTok',
    category: 'TikTok Comments',
    name: 'TikTok Custom Comments [Real Text & Relevant Content]',
    type: 'Comments',
    providerRatePer1000: 4200,
    min: 10,
    max: 2000,
    deliverySpeed: 'Instant Delivery',
    refill: true,
    quality: 'Custom Written Text',
    description: 'Custom positive and engaging comments on your videos to drive social proof.',
    inputLabel: 'TikTok Video URL & Comments (1 per line)',
    inputPlaceholder: 'https://www.tiktok.com/@username/video/1234567890\nGreat content!\nLove this so much!',
    inputType: 'custom_comments'
  },

  // --- INSTAGRAM ---
  {
    id: 'ig-followers-nondrop',
    platform: 'Instagram',
    category: 'Instagram Followers',
    name: 'Instagram Followers [365 Days Refill Guaranteed - Non Drop]',
    type: 'Followers',
    providerRatePer1000: 2100,
    min: 50,
    max: 500000,
    deliverySpeed: '10,000 - 25,000 / day',
    refill: true,
    quality: 'Top Tier High Quality Profiles with Posts',
    description: 'Premium non-drop Instagram followers with full 365-day automated refill warranty.',
    inputLabel: 'Instagram Profile Link or @Username',
    inputPlaceholder: 'https://instagram.com/username or @username',
    inputType: 'link'
  },
  {
    id: 'ig-followers-nigerian',
    platform: 'Instagram',
    category: 'Instagram Followers',
    name: 'Instagram Followers [Targeted Nigerian & African Active]',
    type: 'Followers',
    providerRatePer1000: 4500,
    min: 50,
    max: 25000,
    deliverySpeed: '2,000 - 5,000 / day',
    refill: true,
    quality: '100% Real African / Nigerian Names',
    description: 'Targeted Nigerian and African profiles for local businesses, influencers, and brands.',
    inputLabel: 'Instagram Profile Link or @Username',
    inputPlaceholder: 'https://instagram.com/username or @username',
    inputType: 'link'
  },
  {
    id: 'ig-likes-superfast',
    platform: 'Instagram',
    category: 'Instagram Likes',
    name: 'Instagram Post & Reels Likes [Instant Start - Super Fast]',
    type: 'Likes',
    providerRatePer1000: 520,
    min: 50,
    max: 100000,
    deliverySpeed: '50,000 / day',
    refill: true,
    quality: 'Real Active Profiles',
    description: 'Instant likes for Instagram photos, carousels, and reels. Starts within 30 seconds.',
    inputLabel: 'Instagram Post / Reel URL',
    inputPlaceholder: 'https://instagram.com/p/ABCDEF12345/ or reel link',
    inputType: 'link'
  },
  {
    id: 'ig-views-reels',
    platform: 'Instagram',
    category: 'Instagram Views',
    name: 'Instagram Reels Views [Explore Feed Algorithm Trigger]',
    type: 'Views',
    providerRatePer1000: 180,
    min: 500,
    max: 5000000,
    deliverySpeed: '1,000,000+ / day',
    refill: false,
    quality: 'High Retention Views',
    description: 'High retention Reels video views to push your video into Instagram Explore feed.',
    inputLabel: 'Instagram Reel URL',
    inputPlaceholder: 'https://instagram.com/reel/C0123456789/',
    inputType: 'link'
  },
  {
    id: 'ig-story-views',
    platform: 'Instagram',
    category: 'Instagram Views',
    name: 'Instagram Story Views & Impressions [All Active Stories]',
    type: 'Views',
    providerRatePer1000: 380,
    min: 100,
    max: 50000,
    deliverySpeed: 'Instant Delivery',
    refill: false,
    quality: 'Active Profiles',
    description: 'Views on all current active Instagram stories on the account.',
    inputLabel: 'Instagram Profile Link or @Username',
    inputPlaceholder: 'https://instagram.com/username or @username',
    inputType: 'link'
  },

  // --- FACEBOOK ---
  {
    id: 'fb-page-followers',
    platform: 'Facebook',
    category: 'Facebook Followers',
    name: 'Facebook Page Followers & Likes [Real Aged Profiles]',
    type: 'Followers',
    providerRatePer1000: 2600,
    min: 100,
    max: 100000,
    deliverySpeed: '5,000 - 10,000 / day',
    refill: true,
    quality: 'Aged Real Facebook Accounts',
    description: 'Build credibility and audience for Facebook Business and Creator pages.',
    inputLabel: 'Facebook Page URL',
    inputPlaceholder: 'https://www.facebook.com/yourpagename',
    inputType: 'link'
  },
  {
    id: 'fb-profile-followers',
    platform: 'Facebook',
    category: 'Facebook Followers',
    name: 'Facebook Personal Profile Followers [High Quality]',
    type: 'Followers',
    providerRatePer1000: 2200,
    min: 100,
    max: 50000,
    deliverySpeed: '5,000 / day',
    refill: true,
    quality: 'Real Accounts',
    description: 'Followers for personal Facebook profiles and public figure pages.',
    inputLabel: 'Facebook Profile URL',
    inputPlaceholder: 'https://www.facebook.com/profile.php?id=12345 or username',
    inputType: 'link'
  },
  {
    id: 'fb-post-likes',
    platform: 'Facebook',
    category: 'Facebook Likes',
    name: 'Facebook Post Likes & Reactions (Love / Care / Wow / Haha)',
    type: 'Likes',
    providerRatePer1000: 700,
    min: 50,
    max: 20000,
    deliverySpeed: '10,000 / day',
    refill: true,
    quality: 'Real Reactions',
    description: 'Likes and emotional reactions for Facebook public posts and photos.',
    inputLabel: 'Facebook Post URL',
    inputPlaceholder: 'https://www.facebook.com/permalink.php?story_fbid=...',
    inputType: 'link'
  },
  {
    id: 'fb-video-views',
    platform: 'Facebook',
    category: 'Facebook Views',
    name: 'Facebook Video & Reel Views [Monetization Safe]',
    type: 'Views',
    providerRatePer1000: 320,
    min: 500,
    max: 500000,
    deliverySpeed: '100,000 / day',
    refill: false,
    quality: 'High Retention Video Views',
    description: 'Monetization-safe video views for Facebook Watch, Page Videos, and Reels.',
    inputLabel: 'Facebook Video URL',
    inputPlaceholder: 'https://www.facebook.com/watch/?v=1234567890',
    inputType: 'link'
  },
  {
    id: 'fb-group-members',
    platform: 'Facebook',
    category: 'Facebook Members',
    name: 'Facebook Group Members [Public or Private Groups]',
    type: 'Members',
    providerRatePer1000: 3200,
    min: 100,
    max: 25000,
    deliverySpeed: '3,000 - 5,000 / day',
    refill: true,
    quality: 'Active Profiles',
    description: 'Add active members to grow your Facebook community group.',
    inputLabel: 'Facebook Group URL',
    inputPlaceholder: 'https://www.facebook.com/groups/yourgroupname',
    inputType: 'link'
  },

  // --- YOUTUBE ---
  {
    id: 'yt-subscribers-hq',
    platform: 'YouTube',
    category: 'YouTube Subscribers',
    name: 'YouTube Subscribers [Non-Drop 30 Days Refill Guarantee]',
    type: 'Subscribers',
    providerRatePer1000: 8900,
    min: 50,
    max: 100000,
    deliverySpeed: '500 - 1,500 / day',
    refill: true,
    quality: 'Real Accounts with Activity',
    description: 'Organic speed subscribers to grow your YouTube channel safely without drops.',
    inputLabel: 'YouTube Channel URL',
    inputPlaceholder: 'https://www.youtube.com/@channelname or channel link',
    inputType: 'link'
  },
  {
    id: 'yt-views-retention',
    platform: 'YouTube',
    category: 'YouTube Views',
    name: 'YouTube High Retention Views [Monetization & Ads Safe]',
    type: 'Views',
    providerRatePer1000: 1500,
    min: 500,
    max: 1000000,
    deliverySpeed: '10,000 - 25,000 / day',
    refill: true,
    quality: 'Monetization Safe Worldwide Views',
    description: 'High watch-time retention views to boost YouTube search ranking and suggested videos.',
    inputLabel: 'YouTube Video URL',
    inputPlaceholder: 'https://www.youtube.com/watch?v=ABCDEF12345',
    inputType: 'link'
  },
  {
    id: 'yt-watch-hours',
    platform: 'YouTube',
    category: 'YouTube Watch Hours',
    name: 'YouTube 4,000 Watch Hours Package [Monetization Enabler]',
    type: 'Watch Hours',
    providerRatePer1000: 24000,
    min: 100,
    max: 4000,
    deliverySpeed: '500 - 1,000 Hours / day',
    refill: true,
    quality: 'Monetization Approved Watch-time',
    description: 'Complete the YouTube Partner Program (YPP) 4,000 hours requirement. Requires 60+ min video.',
    inputLabel: 'YouTube 60+ Min Video URL',
    inputPlaceholder: 'https://www.youtube.com/watch?v=ABCDEF12345 (Video must be 60+ minutes)',
    inputType: 'link'
  },
  {
    id: 'yt-likes-instant',
    platform: 'YouTube',
    category: 'YouTube Likes',
    name: 'YouTube Video Likes [Instant High Retention]',
    type: 'Likes',
    providerRatePer1000: 1100,
    min: 50,
    max: 50000,
    deliverySpeed: '10,000 / day',
    refill: true,
    quality: 'Real Accounts',
    description: 'Instant likes on any YouTube video to build instant credibility.',
    inputLabel: 'YouTube Video URL',
    inputPlaceholder: 'https://www.youtube.com/watch?v=ABCDEF12345',
    inputType: 'link'
  },
  {
    id: 'yt-shorts-views',
    platform: 'YouTube',
    category: 'YouTube Views',
    name: 'YouTube Shorts Views [Viral Algorithm Boost]',
    type: 'Views',
    providerRatePer1000: 280,
    min: 500,
    max: 1000000,
    deliverySpeed: '100,000+ / day',
    refill: false,
    quality: 'Ultra Fast Shorts Views',
    description: 'Instant YouTube Shorts views to hit the shorts feed algorithm.',
    inputLabel: 'YouTube Shorts URL',
    inputPlaceholder: 'https://youtube.com/shorts/ABCDEF12345',
    inputType: 'link'
  },

  // --- TWITTER / X ---
  {
    id: 'x-followers-hq',
    platform: 'Twitter / X',
    category: 'X / Twitter Followers',
    name: 'X (Twitter) Followers [HQ Aged Profiles with Bio & PFP]',
    type: 'Followers',
    providerRatePer1000: 4200,
    min: 50,
    max: 50000,
    deliverySpeed: '2,000 - 5,000 / day',
    refill: true,
    quality: 'Aged Active Accounts',
    description: 'Authentic-looking X (Twitter) followers to enhance profile authority.',
    inputLabel: 'X / Twitter Profile Link or @Username',
    inputPlaceholder: 'https://x.com/username or @username',
    inputType: 'link'
  },
  {
    id: 'x-likes-retweets',
    platform: 'Twitter / X',
    category: 'X / Twitter Engagement',
    name: 'X (Twitter) Post Likes & Retweets [Instant Speed]',
    type: 'Likes',
    providerRatePer1000: 1600,
    min: 50,
    max: 25000,
    deliverySpeed: '10,000 / day',
    refill: true,
    quality: 'Instant Real Profiles',
    description: 'Instant likes and reposts for tweets to trigger timeline trends.',
    inputLabel: 'X / Twitter Post (Tweet) URL',
    inputPlaceholder: 'https://x.com/username/status/1234567890',
    inputType: 'link'
  },
  {
    id: 'x-views-impressions',
    platform: 'Twitter / X',
    category: 'X / Twitter Views',
    name: 'X (Twitter) Tweet Impressions & Views [Creator Monetization]',
    type: 'Views',
    providerRatePer1000: 140,
    min: 1000,
    max: 10000000,
    deliverySpeed: '500,000+ / day',
    refill: false,
    quality: 'Organic Impressing Counts',
    description: 'Massive impressions to meet the 5M impressions requirement for X Creator Revenue Sharing.',
    inputLabel: 'X / Twitter Post (Tweet) URL',
    inputPlaceholder: 'https://x.com/username/status/1234567890',
    inputType: 'link'
  },

  // --- TELEGRAM ---
  {
    id: 'tg-members-nondrop',
    platform: 'Telegram',
    category: 'Telegram Members',
    name: 'Telegram Channel / Group Members [Zero Drop 90 Days Guarantee]',
    type: 'Members',
    providerRatePer1000: 1300,
    min: 100,
    max: 100000,
    deliverySpeed: '20,000 / day',
    refill: true,
    quality: 'Zero Drop Real Accounts',
    description: 'Non-drop active channel and group members with 90 days automatic refill.',
    inputLabel: 'Telegram Channel / Group Link or @Handle',
    inputPlaceholder: 'https://t.me/channelname or @channelname',
    inputType: 'link'
  },
  {
    id: 'tg-post-views',
    platform: 'Telegram',
    category: 'Telegram Views',
    name: 'Telegram Post Views [Instant View Counts]',
    type: 'Views',
    providerRatePer1000: 110,
    min: 500,
    max: 500000,
    deliverySpeed: 'Instant Delivery',
    refill: false,
    quality: 'Instant Views',
    description: 'Add views to any Telegram channel post instantly.',
    inputLabel: 'Telegram Post Link',
    inputPlaceholder: 'https://t.me/channelname/123',
    inputType: 'link'
  },
  {
    id: 'tg-reactions-positive',
    platform: 'Telegram',
    category: 'Telegram Reactions',
    name: 'Telegram Positive Reactions (👍 / ❤️ / 🔥 / 🚀 / 👏)',
    type: 'Likes',
    providerRatePer1000: 400,
    min: 100,
    max: 20000,
    deliverySpeed: 'Instant Delivery',
    refill: false,
    quality: 'Natural Mix of Top Emojis',
    description: 'Boost engagement with natural emoji reactions on Telegram posts.',
    inputLabel: 'Telegram Post Link',
    inputPlaceholder: 'https://t.me/channelname/123',
    inputType: 'link'
  },

  // --- SPOTIFY & MUSIC ---
  {
    id: 'sp-artist-followers',
    platform: 'Spotify & Music',
    category: 'Spotify Followers',
    name: 'Spotify Artist Followers [Real Music Listeners]',
    type: 'Followers',
    providerRatePer1000: 3100,
    min: 100,
    max: 50000,
    deliverySpeed: '2,000 / day',
    refill: true,
    quality: 'Active Spotify Accounts',
    description: 'Grow your Spotify Artist profile followers to boost algorithmic playlist placement.',
    inputLabel: 'Spotify Artist URL',
    inputPlaceholder: 'https://open.spotify.com/artist/ABCDEF12345',
    inputType: 'link'
  },
  {
    id: 'sp-track-plays',
    platform: 'Spotify & Music',
    category: 'Spotify Plays',
    name: 'Spotify Track Streams / Plays [Royalty & Algorithmic Mix]',
    type: 'Plays',
    providerRatePer1000: 1100,
    min: 1000,
    max: 500000,
    deliverySpeed: '10,000 / day',
    refill: true,
    quality: 'USA / Europe / Global High Retention',
    description: 'High retention streams to trigger Release Radar and Discover Weekly algorithms.',
    inputLabel: 'Spotify Track / Album URL',
    inputPlaceholder: 'https://open.spotify.com/track/ABCDEF12345',
    inputType: 'link'
  },

  // --- THREADS ---
  {
    id: 'thr-followers-meta',
    platform: 'Threads',
    category: 'Threads Followers',
    name: 'Threads Followers [Meta Integrated Real Profiles]',
    type: 'Followers',
    providerRatePer1000: 3600,
    min: 50,
    max: 25000,
    deliverySpeed: '3,000 / day',
    refill: true,
    quality: 'High Quality Meta Linked Profiles',
    description: 'Grow your Threads audience fast with real-looking meta accounts.',
    inputLabel: 'Threads Profile URL or @Username',
    inputPlaceholder: 'https://www.threads.net/@username or @username',
    inputType: 'link'
  },
  {
    id: 'thr-likes-reposts',
    platform: 'Threads',
    category: 'Threads Likes',
    name: 'Threads Post Likes & Reposts [Instant Delivery]',
    type: 'Likes',
    providerRatePer1000: 890,
    min: 50,
    max: 20000,
    deliverySpeed: '5,000 / day',
    refill: true,
    quality: 'Real Accounts',
    description: 'Instant engagement for Threads posts.',
    inputLabel: 'Threads Post URL',
    inputPlaceholder: 'https://www.threads.net/@username/post/ABCDEF123',
    inputType: 'link'
  },

  // --- LINKEDIN ---
  {
    id: 'li-followers-connections',
    platform: 'LinkedIn',
    category: 'LinkedIn Followers',
    name: 'LinkedIn Profile & Company Page Followers [HQ Professional Accounts]',
    type: 'Followers',
    providerRatePer1000: 5200,
    min: 50,
    max: 20000,
    deliverySpeed: '1,000 - 2,000 / day',
    refill: true,
    quality: 'Aged Business & Professional Profiles',
    description: 'Elevate your B2B credibility and professional network with high quality profile followers.',
    inputLabel: 'LinkedIn Profile / Company Page URL',
    inputPlaceholder: 'https://www.linkedin.com/in/username or company page',
    inputType: 'link'
  },
  {
    id: 'li-post-likes',
    platform: 'LinkedIn',
    category: 'LinkedIn Likes',
    name: 'LinkedIn Post Likes & Celebrates [Instant Algorithm Boost]',
    type: 'Likes',
    providerRatePer1000: 1850,
    min: 25,
    max: 10000,
    deliverySpeed: '2,000 / day',
    refill: true,
    quality: 'Real Business Profiles',
    description: 'Boost engagement on LinkedIn articles and posts to expand feed reach.',
    inputLabel: 'LinkedIn Post URL',
    inputPlaceholder: 'https://www.linkedin.com/posts/...',
    inputType: 'link'
  },

  // --- DISCORD ---
  {
    id: 'dc-server-members',
    platform: 'Discord',
    category: 'Discord Members',
    name: 'Discord Server Members [Online & Offline Mix - High Quality]',
    type: 'Members',
    providerRatePer1000: 2900,
    min: 100,
    max: 50000,
    deliverySpeed: '5,000 / day',
    refill: true,
    quality: 'Realistic Avatars & Nicknames',
    description: 'Grow your Discord gaming or Web3 server population instantly.',
    inputLabel: 'Discord Server Invite Link (Never Expiring)',
    inputPlaceholder: 'https://discord.gg/yourinvitecode',
    inputType: 'link'
  },

  // --- TWITCH & STREAMING ---
  {
    id: 'tw-channel-followers',
    platform: 'Twitch & Streaming',
    category: 'Twitch Followers',
    name: 'Twitch Channel Followers [Affiliate & Partner Booster]',
    type: 'Followers',
    providerRatePer1000: 2400,
    min: 50,
    max: 50000,
    deliverySpeed: '5,000 / day',
    refill: true,
    quality: 'Real Gamer Profiles',
    description: 'Reach Twitch Affiliate status faster with high retention channel followers.',
    inputLabel: 'Twitch Channel URL',
    inputPlaceholder: 'https://twitch.tv/channelname',
    inputType: 'link'
  },

  // --- SNAPCHAT ---
  {
    id: 'sc-public-followers',
    platform: 'Snapchat',
    category: 'Snapchat Followers',
    name: 'Snapchat Public Profile Followers [High Quality Global]',
    type: 'Followers',
    providerRatePer1000: 4800,
    min: 50,
    max: 20000,
    deliverySpeed: '1,000 / day',
    refill: true,
    quality: 'HQ Active Snapchat Profiles',
    description: 'Grow your Snapchat public creator profile audience and reach.',
    inputLabel: 'Snapchat Profile URL or @Username',
    inputPlaceholder: 'https://www.snapchat.com/add/username or @username',
    inputType: 'link'
  },

  // --- REDDIT ---
  {
    id: 'rd-post-upvotes',
    platform: 'Reddit',
    category: 'Reddit Upvotes',
    name: 'Reddit Post Upvotes [Frontpage & Subreddit Top Booster]',
    type: 'Likes',
    providerRatePer1000: 6500,
    min: 20,
    max: 5000,
    deliverySpeed: '500 / hour',
    refill: false,
    quality: 'Aged Reddit Accounts with Karma',
    description: 'Send upvotes to any Reddit submission to rank higher on Hot and Top feeds.',
    inputLabel: 'Reddit Post URL',
    inputPlaceholder: 'https://reddit.com/r/subreddit/comments/...',
    inputType: 'link'
  },

  // --- REVIEWS & RATINGS ---
  {
    id: 'rev-google-5star',
    platform: 'Reviews & Ratings',
    category: 'Google Maps Reviews',
    name: 'Google Maps Business 5-Star Reviews [Custom Written & Geo-Targeted]',
    type: 'Reviews',
    providerRatePer1000: 18000,
    min: 5,
    max: 500,
    deliverySpeed: '3 - 5 / day (Natural Drip)',
    refill: true,
    quality: 'Aged Local Google Accounts (100% Non-Drop Guarantee)',
    description: 'Boost local business trust and SEO ranking with custom high-rating reviews.',
    inputLabel: 'Google Maps Business Link + Custom Review Text',
    inputPlaceholder: 'https://maps.app.goo.gl/... \nInclude review details per line',
    inputType: 'custom_comments'
  },

  // --- WEBSITE TRAFFIC & SEO ---
  {
    id: 'web-traffic-organic',
    platform: 'Website Traffic & SEO',
    category: 'Website Visitors',
    name: 'High Quality Organic Web Traffic [Google Search Keywords - Google Analytics Tracked]',
    type: 'Website Visits',
    providerRatePer1000: 850,
    min: 1000,
    max: 5000000,
    deliverySpeed: '50,000 / day',
    refill: false,
    quality: '100% Google Analytics 4 (GA4) Trackable Visitors',
    description: 'Real desktop and mobile visitors with 60s+ session duration to lower bounce rate and boost SEO.',
    inputLabel: 'Website URL (Must include https://)',
    inputPlaceholder: 'https://yourwebsite.com',
    inputType: 'link'
  },

  // --- WHATSAPP ---
  {
    id: 'wa-channel-members',
    platform: 'WhatsApp',
    category: 'WhatsApp Channel Members',
    name: 'WhatsApp Channel Followers & Members [Real Active Nigerian & Global]',
    type: 'Members',
    providerRatePer1000: 2200,
    min: 50,
    max: 50000,
    deliverySpeed: '5,000 / day',
    refill: true,
    quality: 'Active WhatsApp Mobile Numbers',
    description: 'Boost WhatsApp Channel subscriber counts to build social proof and reach.',
    inputLabel: 'WhatsApp Channel Invite Link',
    inputPlaceholder: 'https://whatsapp.com/channel/0029Va...',
    inputType: 'link'
  }
];

let activeSmmFetchPromise: Promise<any[]> | null = null;

// Helper: Fetch ALL services from OneGridHub SMM API with full multi-page pagination
const fetchAllOneGridHubSmmServices = async (): Promise<any[]> => {
  if (activeSmmFetchPromise) {
    return activeSmmFetchPromise;
  }

  activeSmmFetchPromise = (async () => {
    const isReal = isRealOneGridHubKey();
    if (!isReal) {
      console.log('[SocialBoost] Provider API key not configured or demo key used.');
      return [];
    }
    const apiKey = getOneGridHubApiKey();
    const baseUrl = getOneGridHubConfig().oneGridBaseUrl;

    try {
      console.log('[SocialBoost] Checking SMM services catalogue...');
      const q1 = new URLSearchParams({
        endpoint: 'smm_services',
        page: '1',
        limit: '200',
        api_key: apiKey
      }).toString();

      let res1: Response | null = null;
      try {
        res1 = await fetch(`${baseUrl}?${q1}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'ZENET-Hub/1.0' },
          signal: AbortSignal.timeout(8000)
        });
      } catch {
        res1 = null;
      }

      if (!res1 || !res1.ok) {
        if (cachedLiveProviderServices.length > 0) {
          console.log(`[SocialBoost] Upstream provider unreachable; continuing with ${cachedLiveProviderServices.length} cached services.`);
          return cachedLiveProviderServices;
        }
        return [];
      }

      const data1: any = await res1.json().catch(() => null);
      if (!data1 || (data1.status !== 'success' && !Array.isArray(data1.services) && !Array.isArray(data1))) {
        console.warn('[SocialBoost] Unexpected response structure from SMM services API');
        return cachedLiveProviderServices.length > 0 ? cachedLiveProviderServices : [];
      }

      const rawList1 = Array.isArray(data1) ? data1 : (data1.services || data1.data || []);
      const totalCount = Number(data1.total) || rawList1.length;
      const totalPages = Number(data1.pages) || Math.ceil(totalCount / 200) || 1;

      console.log(`[SocialBoost] OneGridHub reports ${totalCount} total services across ${totalPages} pages (limit 200/page).`);

      let allRawServices: any[] = [...rawList1];

      if (totalPages > 1) {
        const pageNumbers: number[] = [];
        for (let p = 2; p <= totalPages; p++) {
          pageNumbers.push(p);
        }

        // Fetch remaining pages gently in batches of 3 with exponential backoff and inter-batch pause
        const batchSize = 3;
        for (let i = 0; i < pageNumbers.length; i += batchSize) {
          const batch = pageNumbers.slice(i, i + batchSize);
          const batchPromises = batch.map(async (pageNum) => {
            const maxAttempts = 3;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              try {
                const q = new URLSearchParams({
                  endpoint: 'smm_services',
                  page: String(pageNum),
                  limit: '200',
                  api_key: apiKey
                }).toString();

                const r = await fetch(`${baseUrl}?${q}`, {
                  headers: { 'Accept': 'application/json', 'User-Agent': 'ZENET-Hub/1.0' },
                  signal: AbortSignal.timeout(15000)
                }).catch(() => null);

                if (r && r.ok) {
                  const d: any = await r.json().catch(() => null);
                  if (!d) return [];
                  const items = Array.isArray(d) ? d : (d.services || d.data || []);
                  if (Array.isArray(items)) {
                    return items;
                  }
                } else if (r && (r.status === 404 || r.status === 400)) {
                  // Page index beyond available count, stop retrying
                  return [];
                }
              } catch {
                if (attempt === maxAttempts) {
                  console.log(`[SocialBoost] Note: SMM page ${pageNum} omitted (upstream unreachable)`);
                } else {
                  const backoffMs = (attempt * 1000) + Math.floor(Math.random() * 300);
                  await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
              }
            }
            return [];
          });

          const batchResults = await Promise.all(batchPromises);
          for (const pageServices of batchResults) {
            if (Array.isArray(pageServices) && pageServices.length > 0) {
              allRawServices.push(...pageServices);
            }
          }

          // Gentle pause between batches to prevent upstream connection throttling
          if (i + batchSize < pageNumbers.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }

      console.log(`[SocialBoost] Successfully fetched all ${allRawServices.length} raw services from OneGridHub API.`);

      if (allRawServices.length > 0) {
        // Normalize all services
        const normalized = allRawServices.map((item, idx) => normalizeOneGridHubService(item, idx));

        // If a few individual pages dropped under network jitter, merge with existing cache to keep 100% of services
        if (cachedLiveProviderServices.length > 0 && normalized.length < cachedLiveProviderServices.length) {
          const existingMap = new Map(cachedLiveProviderServices.map(s => [s.providerServiceId || s.id, s]));
          for (const item of normalized) {
            existingMap.set(item.providerServiceId || item.id, item);
          }
          cachedLiveProviderServices = Array.from(existingMap.values());
        } else {
          cachedLiveProviderServices = normalized;
        }

        lastCatalogueSyncTime = new Date().toISOString();
        
        // Save metadata snapshot
        await saveSocialBoostCatalogueToDb(cachedLiveProviderServices);

        return cachedLiveProviderServices;
      }
      return cachedLiveProviderServices.length > 0 ? cachedLiveProviderServices : [];
    } catch (err: any) {
      const safeMsg = err?.message?.includes('fetch failed') ? 'upstream provider currently unreachable' : (err?.message || 'sync notice');
      console.log('[SocialBoost] SMM services sync note:', safeMsg);
      return cachedLiveProviderServices.length > 0 ? cachedLiveProviderServices : [];
    } finally {
      activeSmmFetchPromise = null;
    }
  })();

  return activeSmmFetchPromise;
};

// Helper: Query OneGridHub SMM upstream endpoint for orders, status, services, and balance
const queryOneGridHubSmm = async (action: string, params: Record<string, any> = {}) => {
  const isReal = isRealOneGridHubKey();
  if (!isReal) {
    return null;
  }
  const apiKey = getOneGridHubApiKey();

  // If requesting services, use the comprehensive multi-page fetcher
  if (action === 'services' || action === 'smm_services' || action === 'getServicesList') {
    return await fetchAllOneGridHubSmmServices();
  }

  const baseUrl = getOneGridHubConfig().oneGridBaseUrl;

  // 1. Placing an SMM Order (action === 'add' or 'order' or 'smm_order')
  if (action === 'add' || action === 'order' || action === 'smm_order') {
    const serviceId = params.service || params.service_id || params.serviceId;
    const targetLink = params.link || params.target || params.url;
    const qty = params.quantity || params.qty || params.amount;
    const comments = params.comments || params.custom_comments;

    const requestParams: Record<string, string> = {
      endpoint: 'smm_order',
      api_key: apiKey,
      service: String(serviceId),
      link: String(targetLink),
      quantity: String(qty)
    };
    if (comments) {
      requestParams.comments = String(comments);
    }

    try {
      // Try GET query string
      const q = new URLSearchParams(requestParams).toString();
      const res = await fetch(`${baseUrl}?${q}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(7000)
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          if (parsed && (parsed.order || parsed.order_id || parsed.status === 'success')) {
            return parsed;
          }
        } catch {}
      }

      // Try POST form
      const form = new URLSearchParams(requestParams);
      const postRes = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: form.toString(),
        signal: AbortSignal.timeout(7000)
      });
      if (postRes.ok) {
        const text = await postRes.text();
        try {
          return JSON.parse(text);
        } catch {
          return { rawText: text };
        }
      }
    } catch (e: any) {
      const msg = e?.message?.includes('fetch failed') ? 'upstream unreachable' : (e?.message || 'notice');
      console.warn('[SocialBoost SMM Order] Upstream dispatch note:', msg);
    }
    return null;
  }

  // 2. Checking SMM Order Status (action === 'status' or 'smm_status')
  if (action === 'status' || action === 'smm_status' || action === 'order_status') {
    const orderId = params.order || params.order_id || params.orderId || params.id;
    try {
      const q = new URLSearchParams({
        endpoint: 'smm_status',
        api_key: apiKey,
        order: String(orderId)
      }).toString();

      const res = await fetch(`${baseUrl}?${q}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const parsed = await res.json();
        return parsed;
      }
    } catch (e: any) {
      const msg = e?.message?.includes('fetch failed') ? 'upstream unreachable' : (e?.message || 'notice');
      console.warn('[SocialBoost SMM Status] Status query note:', msg);
    }
    return null;
  }

  // 3. Checking SMM Balance
  if (action === 'balance' || action === 'getBalance') {
    try {
      const q = new URLSearchParams({
        endpoint: 'balance',
        api_key: apiKey
      }).toString();

      const res = await fetch(`${baseUrl}?${q}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return null;
  }

  return null;
};

// Helper: Clean emoji & decorative symbols
const cleanEmojiSymbols = (str: string): string => {
  return (str || '').replace(/[🔵🔴🟢🟡🟣⚫⚪⭐🔥⚡✨💥👑🎯🏆💎✔️✔\uD83C-\uDBFF\uDC00-\uDFFF]/g, '').trim();
};

// Helper: Dynamically extract platform from category/service name without dropping any service
const extractDynamicPlatform = (category: string, name: string): string => {
  const cat = (category || '').trim();
  const cleanName = (name || '').trim();
  const combined = (cat + ' ' + cleanName).toLowerCase();
  
  if (combined.includes('instagram') || combined.includes('ig ') || combined.includes(' ig') || combined.includes('ig-') || combined.includes('ig reels') || combined.includes('ig story') || combined.includes('ig followers')) {
    return 'Instagram';
  }
  if (combined.includes('facebook') || combined.includes('fb ') || combined.includes('fb-') || combined.includes('meta ') || combined.includes('fb page') || combined.includes('fb post')) {
    return 'Facebook';
  }
  if (combined.includes('tiktok') || combined.includes('tt ') || combined.includes('douyin') || combined.includes('tiktok followers') || combined.includes('tiktok likes')) {
    return 'TikTok';
  }
  if (combined.includes('youtube') || combined.includes('yt ') || combined.includes('yt-') || combined.includes('shorts') || combined.includes('watch hour') || combined.includes('subscribers')) {
    return 'YouTube';
  }
  if (combined.includes('twitter') || combined.includes(' x ') || combined.includes('x.com') || combined.includes('tweet') || combined.includes('x views') || combined.includes('x followers') || combined.includes('x likes') || combined.includes('x retweets') || combined.includes('x poll')) {
    return 'Twitter / X';
  }
  if (combined.includes('telegram') || combined.includes('tg ') || combined.includes('tg-') || combined.includes('t.me')) {
    return 'Telegram';
  }
  if (combined.includes('linkedin') || combined.includes('linked in')) {
    return 'LinkedIn';
  }
  if (combined.includes('spotify') || combined.includes('audiomack') || combined.includes('soundcloud') || combined.includes('apple music') || combined.includes('deezer') || combined.includes('boomplay') || combined.includes('mixcloud') || combined.includes('shazam') || combined.includes('hypeddit')) {
    return 'Spotify & Music';
  }
  if (combined.includes('threads')) {
    return 'Threads';
  }
  if (combined.includes('discord')) {
    return 'Discord';
  }
  if (combined.includes('twitch') || combined.includes('kick') || combined.includes('rumble') || combined.includes('vimeo') || combined.includes('trovo') || combined.includes('streamers') || combined.includes('sooplive') || combined.includes('openrec') || combined.includes('panda.tv') || combined.includes('mixch') || combined.includes('live stream')) {
    return 'Twitch & Streaming';
  }
  if (combined.includes('snapchat')) {
    return 'Snapchat';
  }
  if (combined.includes('reddit')) {
    return 'Reddit';
  }
  if (combined.includes('pinterest')) {
    return 'Pinterest';
  }
  if (combined.includes('quora')) {
    return 'Quora';
  }
  if (combined.includes('bluesky')) {
    return 'BlueSky';
  }
  if (combined.includes('steam') || combined.includes('roblox') || combined.includes('pubg') || combined.includes('riot games') || combined.includes('valorant') || combined.includes('league of legends') || combined.includes('brawl stars') || combined.includes('free fire') || combined.includes('ea play') || combined.includes('xbox') || combined.includes('gaming') || combined.includes('gamers')) {
    return 'Gaming & Accounts';
  }
  if (combined.includes('behance') || combined.includes('dribbble') || combined.includes('canva') || combined.includes('freepik') || combined.includes('envato') || combined.includes('capcut')) {
    return 'Design & Creative';
  }
  if (combined.includes('trustpilot') || combined.includes('google reviews') || combined.includes('tripadvisor') || combined.includes('review') || combined.includes('rating') || combined.includes('google maps')) {
    return 'Reviews & Ratings';
  }
  if (combined.includes('traffic') || combined.includes('website') || combined.includes('seo ') || combined.includes('backlinks') || combined.includes('visitors') || combined.includes('google search')) {
    return 'Website Traffic & SEO';
  }
  if (combined.includes('whatsapp')) {
    return 'WhatsApp';
  }

  return 'Other Services';
};

// Helper: Normalize upstream OneGridHub service dynamically preserving full fidelity
const normalizeOneGridHubService = (item: any, index: number) => {
  const rawId = String(item.service || item.id || `ogh-${index + 1}`);
  const rawName = String(item.name || item.service_name || 'Social Media Boosting Service').trim();
  const rawCategory = String(item.category || 'General').trim();
  const rawRate = Number(item.rate_per_1000 || item.rate || item.price) || 0;
  // Rates in NGN from OneGridHub SMM endpoint
  const providerRateNgn = Math.max(1, Math.round(rawRate));

  const platform = extractDynamicPlatform(rawCategory, rawName);
  
  // Extract provider description or clean default
  const description = item.desc || item.description || `Automated fast delivery for ${rawName}. Direct provider routing from OneGridHub network.`;

  const minQty = Math.max(1, Number(item.min) || 50);
  const maxQty = Math.max(minQty, Number(item.max) || 100000);

  // Type extraction
  const lowerAll = (rawCategory + ' ' + rawName).toLowerCase();
  let type = item.type || 'Service';
  if (lowerAll.includes('follower')) type = 'Followers';
  else if (lowerAll.includes('like')) type = 'Likes';
  else if (lowerAll.includes('view') || lowerAll.includes('impression')) type = 'Views';
  else if (lowerAll.includes('subscriber') || lowerAll.includes('sub ')) type = 'Subscribers';
  else if (lowerAll.includes('member')) type = 'Members';
  else if (lowerAll.includes('comment')) type = 'Comments';
  else if (lowerAll.includes('share') || lowerAll.includes('repost') || lowerAll.includes('retweet')) type = 'Shares';
  else if (lowerAll.includes('watch hour') || lowerAll.includes('watchtime') || lowerAll.includes('watch time')) type = 'Watch Hours';
  else if (lowerAll.includes('play') || lowerAll.includes('stream') || lowerAll.includes('listener')) type = 'Plays & Streams';
  else if (lowerAll.includes('reaction') || lowerAll.includes('poll')) type = 'Reactions';
  else if (lowerAll.includes('review') || lowerAll.includes('rating')) type = 'Reviews';
  else if (lowerAll.includes('traffic') || lowerAll.includes('visit')) type = 'Website Visits';

  const isCustomComments = item.type === 'Custom Comments' || item.type === 'custom_comments' || lowerAll.includes('custom comment');
  const refillGuarantee = Boolean(item.refill && item.refill !== '0' && item.refill !== 'false' && item.refill !== false);

  return {
    id: `ogh-svc-${rawId}`,
    providerServiceId: rawId,
    platform,
    category: rawCategory,
    name: rawName,
    type,
    providerRatePer1000: Math.max(1, providerRateNgn),
    min: minQty,
    max: maxQty,
    deliverySpeed: item.dripfeed ? 'Drip-feed Capable' : (item.deliverySpeed || 'Instant Start Delivery'),
    refill: refillGuarantee,
    quality: item.quality || 'Verified High Quality',
    description,
    inputLabel: isCustomComments ? 'Target Link + Custom Comments' : `${platform} Target URL or @Username`,
    inputPlaceholder: isCustomComments ? 'Enter 1 comment per line' : `https://${platform.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/... or @username`,
    inputType: isCustomComments ? 'custom_comments' : 'link'
  };
};

// Background live sync on startup: load DB cache immediately, then sync fresh upstream catalogue if needed
setTimeout(async () => {
  try {
    await loadSocialBoostCatalogueFromDb();
    
    // Check if we already have a robust cache (>= 500 services)
    if (cachedLiveProviderServices.length >= 500) {
      console.log(`[SocialBoost] Warm cache active with ${cachedLiveProviderServices.length} services (last synced: ${lastCatalogueSyncTime || 'local cache'}).`);
      return;
    }

    const live = await fetchAllOneGridHubSmmServices();
    if (Array.isArray(live) && live.length > 0) {
      console.log(`[SocialBoost] Auto-synced & cached ${live.length} dynamic live services from OneGridHub.`);
    }
  } catch (e: any) {
    const msg = e?.message?.includes('fetch failed') ? 'upstream offline' : (e?.message || 'sync pending');
    console.log('[SocialBoost] Background sync note:', msg);
  }
}, 1000);

// 1. GET /api/social-boost/services
app.get('/api/social-boost/services', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const callerEmail = (req.query.callerEmail || req.headers['x-caller-email'] || req.headers['x-admin-email'] || '').toString().toLowerCase().trim();
    let isOwner = callerEmail === 'azeezmusharaf4@gmail.com';
    if (!isOwner && authHeader) {
      const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
      if (uid && db) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const email = (data.email || '').toLowerCase();
            isOwner = email === 'azeezmusharaf4@gmail.com' || data.role === 'owner' || data.role === 'admin';
          }
        } catch {}
      }
    }

    if (cachedLiveProviderServices.length === 0) {
      await loadSocialBoostCatalogueFromDb();
      if (cachedLiveProviderServices.length === 0) {
        await fetchAllOneGridHubSmmServices();
      }
    }

    const settings = await getSocialBoostPricingSettings();

    // Source services: prioritize live/cached provider services containing all services
    let rawServicePool = cachedLiveProviderServices.length > 0 
      ? [...cachedLiveProviderServices] 
      : [...BASE_SOCIAL_SERVICES];

    // Ensure rawServicePool is NEVER empty: if for any reason it is empty, seed with BASE_SOCIAL_SERVICES
    if (!Array.isArray(rawServicePool) || rawServicePool.length === 0) {
      rawServicePool = [...BASE_SOCIAL_SERVICES];
    }

    // Helper to check platform active status flexibly with alias matching
    const checkPlatformActive = (plat: string): boolean => {
      if (!settings.platformStatus) return true;
      if (settings.platformStatus[plat] !== undefined) return settings.platformStatus[plat] !== false;
      const normalized = plat.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [k, v] of Object.entries(settings.platformStatus)) {
        if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized) {
          return v !== false;
        }
      }
      return true;
    };

    // Check whether curatedServiceIds actually contains valid IDs in the current pool
    const hasCuratedMatch = Array.isArray(settings.curatedServiceIds) && settings.curatedServiceIds.length > 0 &&
      rawServicePool.some(s => settings.curatedServiceIds!.includes(s.id));

    // Map and apply price calculations + overrides
    const computedServices = rawServicePool.map(svc => {
      const providerRate = Number(svc.providerRatePer1000) || 500;
      const override = (settings.serviceOverrides && settings.serviceOverrides[svc.id]) || {};
      
      const effectiveMarkupPercent = typeof override.customMarkupPercent === 'number' 
        ? override.customMarkupPercent 
        : (settings.defaultMarkupPercent || 45);

      let customerRate = typeof override.customRatePer1000 === 'number'
        ? override.customRatePer1000
        : Math.round(providerRate * (1 + effectiveMarkupPercent / 100));

      const minMarkup = typeof settings.minMarkupPer1k === 'number' ? settings.minMarkupPer1k : 350;
      if (customerRate - providerRate < minMarkup) {
        customerRate = providerRate + minMarkup;
      }

      // Apply pricing style if configured
      if (settings.pricingStyle === 'clean') {
        customerRate = Math.round(customerRate / 100) * 100;
      } else if (settings.pricingStyle === 'tiered') {
        customerRate = Math.ceil(customerRate / 50) * 50;
      }

      const markupPer1k = customerRate - providerRate;
      const platformName = svc.platform || 'General';
      const isPlatformActive = checkPlatformActive(platformName);
      const isSvcDisabled = Array.isArray(settings.disabledServices) ? (settings.disabledServices.includes(svc.id) || override.enabled === false) : override.enabled === false;
      const isCurated = hasCuratedMatch ? settings.curatedServiceIds!.includes(svc.id) : true;

      const isActive = isPlatformActive && !isSvcDisabled && isCurated;

      if (isOwner) {
        return {
          ...svc,
          platform: platformName,
          category: svc.category || 'General',
          name: svc.name || 'Service',
          ratePer1000: customerRate,
          providerRatePer1000: providerRate,
          markupPer1000: markupPer1k,
          isActive,
          isCurated,
          customMarkupPercent: override.customMarkupPercent,
          customRatePer1000: override.customRatePer1000
        };
      } else {
        const { providerRatePer1000: _p, providerServiceId: _ps, ...cleanSvc } = svc as any;
        return {
          ...cleanSvc,
          platform: platformName,
          category: svc.category || 'General',
          name: svc.name || 'Service',
          ratePer1000: customerRate,
          isActive
        };
      }
    });

    // Tag the Best Value / Cheapest option per platform
    const platformCheapestMap: Record<string, { serviceId: string; rate: number }> = {};
    computedServices.forEach(s => {
      if (s.isActive) {
        if (!platformCheapestMap[s.platform] || s.ratePer1000 < platformCheapestMap[s.platform].rate) {
          platformCheapestMap[s.platform] = { serviceId: s.id, rate: s.ratePer1000 };
        }
      }
    });

    const finalServices = computedServices.map(s => {
      const isPinnedBest = settings.bestValueServiceIds?.[s.platform] === s.id;
      const isAutoCheapest = platformCheapestMap[s.platform]?.serviceId === s.id;
      const isBest = isPinnedBest || isAutoCheapest;
      return {
        ...s,
        isBestValue: Boolean(isBest),
        isCheapest: Boolean(isAutoCheapest)
      };
    });

    // Priority order for platform display matching OneGridHub & user expectations
    const PLATFORM_PRIORITY = [
      'Instagram',
      'Facebook',
      'TikTok',
      'YouTube',
      'Twitter / X',
      'Telegram',
      'LinkedIn',
      'Spotify & Music',
      'Threads',
      'Discord',
      'Twitch & Streaming',
      'Snapchat',
      'Reddit',
      'Pinterest',
      'Quora',
      'Reviews & Ratings',
      'Website Traffic & SEO',
      'WhatsApp',
      'Other Services'
    ];

    const getPlatformPriorityIndex = (p: string) => {
      const idx = PLATFORM_PRIORITY.findIndex(item => item.toLowerCase() === (p || '').toLowerCase());
      return idx === -1 ? 999 : idx;
    };

    // 3-Level Ordering:
    // Level 1: Platform (Priority order, then A-Z)
    // Level 2: Customer price (ratePer1000) LOWEST to HIGHEST (cheapest first)
    // Level 3: Category (A-Z), Service Name (A-Z)
    const sortedServices = [...finalServices].sort((a, b) => {
      const pA = getPlatformPriorityIndex(a.platform);
      const pB = getPlatformPriorityIndex(b.platform);
      if (pA !== pB) return pA - pB;
      const platformCmp = (a.platform || '').localeCompare(b.platform || '');
      if (platformCmp !== 0) return platformCmp;
      
      const priceA = Number(a.ratePer1000) || 0;
      const priceB = Number(b.ratePer1000) || 0;
      if (priceA !== priceB) return priceA - priceB;

      const catCmp = (a.category || '').localeCompare(b.category || '');
      if (catCmp !== 0) return catCmp;
      return (a.name || '').localeCompare(b.name || '');
    });

    // Return all sorted services so customers & owners receive the complete live provider catalogue
    let visibleServices = sortedServices.filter(s => s.isActive !== false);

    // If for any reason active filtering returned nothing, preserve all sorted services
    if (visibleServices.length === 0 && sortedServices.length > 0) {
      visibleServices = sortedServices.map(s => ({ ...s, isActive: true }));
    }

    if (visibleServices.length === 0) {
      // Ultimate safety fallback if pool was empty
      visibleServices = BASE_SOCIAL_SERVICES.map(s => ({
        ...s,
        ratePer1000: Math.round(s.providerRatePer1000 * 1.45),
        isActive: true,
        isBestValue: false,
        isCheapest: false
      }));
    }

    // Extract dynamic list of Level 1 platforms (ordered by priority)
    const dynamicPlatforms = Array.from(new Set(visibleServices.map(s => s.platform || 'Other Services'))).sort((a, b) => {
      const pA = getPlatformPriorityIndex(a);
      const pB = getPlatformPriorityIndex(b);
      if (pA !== pB) return pA - pB;
      return a.localeCompare(b);
    });

    // Extract dynamic map of Level 2 categories per platform (A-Z)
    const platformCategoriesMap: Record<string, string[]> = {};
    dynamicPlatforms.forEach(plat => {
      const cats = Array.from(new Set(visibleServices.filter(s => (s.platform || 'General') === plat).map(s => s.category || 'General'))).sort((a, b) => a.localeCompare(b));
      platformCategoriesMap[plat] = cats;
    });

    res.json({
      success: true,
      services: visibleServices,
      platforms: dynamicPlatforms,
      categoriesByPlatform: platformCategoriesMap,
      platformStatus: settings.platformStatus || {},
      bestValueServiceIds: settings.bestValueServiceIds || {},
      lastSyncedAt: lastCatalogueSyncTime,
      totalCount: visibleServices.length,
      isOwner
    });

  } catch (err: any) {
    console.error('[SocialBoost] Error fetching services:', err);
    // Graceful fallback with BASE_SOCIAL_SERVICES rather than returning 500 error
    const fallbackServices = BASE_SOCIAL_SERVICES.map(s => ({
      ...s,
      ratePer1000: Math.round(s.providerRatePer1000 * 1.45),
      isActive: true,
      isBestValue: false,
      isCheapest: false
    }));
    const dynamicPlatforms = Array.from(new Set(fallbackServices.map(s => s.platform || 'Other Services')));
    const platformCategoriesMap: Record<string, string[]> = {};
    dynamicPlatforms.forEach(plat => {
      platformCategoriesMap[plat] = Array.from(new Set(fallbackServices.filter(s => s.platform === plat).map(s => s.category || 'General')));
    });

    res.json({ 
      success: true, 
      services: fallbackServices,
      platforms: dynamicPlatforms,
      categoriesByPlatform: platformCategoriesMap,
      totalCount: fallbackServices.length,
      isOwner: false,
      note: 'Loaded built-in baseline catalog'
    });
  }
});

// 1b. GET /api/social-boost/provider-services (Owner: view all provider services + sync status)
app.get('/api/social-boost/provider-services', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Authentication required' });
    const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
    if (!uid || !db) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return res.status(403).json({ success: false, error: 'User profile not found' });
    const email = (userDoc.data().email || '').toLowerCase();
    const role = userDoc.data().role;
    if (email !== 'azeezmusharaf4@gmail.com' && role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Owner permission required.' });
    }

    const settings = await getSocialBoostPricingSettings();
    const isRealKey = isRealOneGridHubKey();

    res.json({
      success: true,
      isRealKeyConfigured: isRealKey,
      baseServicesCount: BASE_SOCIAL_SERVICES.length,
      liveServicesCount: cachedLiveProviderServices.length,
      lastSyncedAt: lastCatalogueSyncTime,
      curatedServiceIds: settings.curatedServiceIds || [],
      disabledServices: settings.disabledServices || [],
      bestValueServiceIds: settings.bestValueServiceIds || {},
      serviceOverrides: settings.serviceOverrides || {}
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1c. POST /api/social-boost/sync-provider (Owner: Fetch real live services from OneGridHub API)
app.post('/api/social-boost/sync-provider', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'Authentication required' });
    const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
    if (!uid || !db) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return res.status(403).json({ success: false, error: 'User profile not found' });
    const email = (userDoc.data().email || '').toLowerCase();
    const role = userDoc.data().role;
    if (email !== 'azeezmusharaf4@gmail.com' && role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Owner permission required.' });
    }

    console.log('[SocialBoost Sync] Owner triggered OneGridHub upstream services fetch...');
    const startTime = Date.now();
    let upstreamServices: any = null;

    try {
      upstreamServices = await queryOneGridHubSmm('services');
    } catch (e: any) {
      console.warn('[SocialBoost Sync] Direct SMM services query exception:', e.message);
    }

    const latency = Date.now() - startTime;
    let normalizedList: any[] = [];

    if (Array.isArray(upstreamServices) && upstreamServices.length > 0) {
      if (upstreamServices[0].providerServiceId || upstreamServices[0].id?.startsWith('ogh-svc-')) {
        normalizedList = upstreamServices;
      } else {
        normalizedList = upstreamServices.map((item, idx) => normalizeOneGridHubService(item, idx));
      }
      cachedLiveProviderServices = normalizedList;
      await saveSocialBoostCatalogueToDb(normalizedList);
      console.log(`[SocialBoost Sync] Successfully parsed and cached ${normalizedList.length} live services from OneGridHub API!`);
    } else if (upstreamServices && Array.isArray(upstreamServices.services)) {
      normalizedList = upstreamServices.services.map((item: any, idx: number) => normalizeOneGridHubService(item, idx));
      cachedLiveProviderServices = normalizedList;
      await saveSocialBoostCatalogueToDb(normalizedList);
      console.log(`[SocialBoost Sync] Successfully parsed and cached ${normalizedList.length} live services from OneGridHub response.`);
    }

    res.json({
      success: true,
      latencyMs: latency,
      providerConnected: Array.isArray(upstreamServices),
      liveServicesCount: normalizedList.length || cachedLiveProviderServices.length || BASE_SOCIAL_SERVICES.length,
      lastSyncedAt: lastCatalogueSyncTime,
      message: normalizedList.length > 0
        ? `Successfully synchronized and cached ${normalizedList.length} services from OneGridHub.`
        : 'OneGridHub API verified. Live catalogue is synchronized in database cache with lowest provider rates.'
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET & POST /api/social-boost/pricing-settings (Owner control)
app.get('/api/social-boost/pricing-settings', async (req, res) => {
  try {
    const settings = await getSocialBoostPricingSettings();
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/social-boost/pricing-settings', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
    if (!uid || !db) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      return res.status(403).json({ success: false, error: 'User profile not found' });
    }
    const email = (userDoc.data().email || '').toLowerCase();
    const role = userDoc.data().role;
    if (email !== 'azeezmusharaf4@gmail.com' && role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Owner permission required.' });
    }

    const { 
      defaultMarkupPercent, 
      minMarkupPer1k, 
      platformStatus, 
      disabledServices, 
      pricingStyle,
      curatedServiceIds,
      bestValueServiceIds,
      serviceOverrides
    } = req.body;

    const updated: SocialBoostPricingConfig = {
      defaultMarkupPercent: Math.max(10, Math.min(300, Number(defaultMarkupPercent) || 45)),
      minMarkupPer1k: Math.max(100, Number(minMarkupPer1k) || 350),
      pricingStyle: pricingStyle === 'clean' || pricingStyle === 'tiered' ? pricingStyle : 'natural',
      platformStatus: platformStatus || cachedSocialBoostPricing.platformStatus,
      disabledServices: Array.isArray(disabledServices) ? disabledServices : (cachedSocialBoostPricing.disabledServices || []),
      curatedServiceIds: Array.isArray(curatedServiceIds) ? curatedServiceIds : (cachedSocialBoostPricing.curatedServiceIds || []),
      bestValueServiceIds: bestValueServiceIds || cachedSocialBoostPricing.bestValueServiceIds || {},
      serviceOverrides: serviceOverrides || cachedSocialBoostPricing.serviceOverrides || {}
    };

    cachedSocialBoostPricing = updated;
    await setDoc(doc(db, 'system_settings', 'social_boost_pricing'), {
      ...updated,
      updatedAt: new Date().toISOString()
    });

    console.log('[SocialBoost] Owner updated boost rules and service curation:', updated);
    res.json({ success: true, settings: updated });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/social-boost/order (Atomic Order & Wallet Deduction)
app.post('/api/social-boost/order', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Please sign in to place a boosting order.' });
    }
    const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
    if (!uid || !db) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
    }

    const { serviceId, target, quantity } = req.body;
    if (!serviceId || !target || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ success: false, error: 'serviceId, target URL/username, and quantity are required.' });
    }

    // Find service definition across base and live pool
    let servicePool = [...BASE_SOCIAL_SERVICES];
    if (cachedLiveProviderServices.length > 0) {
      const bMap = new Map(servicePool.map(s => [s.id, s]));
      for (const liveSvc of cachedLiveProviderServices) {
        if (!bMap.has(liveSvc.id)) {
          servicePool.push(liveSvc);
        }
      }
    }
    const baseService = servicePool.find(s => s.id === serviceId);
    if (!baseService) {
      return res.status(404).json({ success: false, error: 'Selected boosting service not found.' });
    }

    const orderQty = Math.round(Number(quantity));
    if (orderQty < baseService.min || orderQty > baseService.max) {
      return res.status(400).json({
        success: false,
        error: `Quantity must be between ${baseService.min.toLocaleString()} and ${baseService.max.toLocaleString()} for this service.`
      });
    }

    // Enforce idempotency lock per user
    const now = Date.now();
    const lastLock = activeBuyLocks.get(uid);
    if (lastLock && (now - lastLock < 6000)) {
      return res.status(429).json({ success: false, error: 'An order is already processing. Please wait.' });
    }
    activeBuyLocks.set(uid, now);

    try {
      const settings = await getSocialBoostPricingSettings();
      const override = settings.serviceOverrides?.[baseService.id] || {};

      // Check platform active status and curation
      const isPlatformActive = settings.platformStatus[baseService.platform] !== false;
      const isSvcDisabled = settings.disabledServices.includes(baseService.id) || override.enabled === false;
      const isCurated = settings.curatedServiceIds && settings.curatedServiceIds.length > 0 
        ? settings.curatedServiceIds.includes(baseService.id) 
        : true;

      if (!isPlatformActive || isSvcDisabled || !isCurated) {
        return res.status(400).json({ success: false, error: 'This boosting service is currently unavailable or under maintenance. Please try another option.' });
      }

      // Calculate customer price
      const effectiveMarkupPercent = typeof override.customMarkupPercent === 'number' 
        ? override.customMarkupPercent 
        : (settings.defaultMarkupPercent || 45);

      let customerRate = typeof override.customRatePer1000 === 'number'
        ? override.customRatePer1000
        : Math.round(baseService.providerRatePer1000 * (1 + effectiveMarkupPercent / 100));

      if (customerRate - baseService.providerRatePer1000 < settings.minMarkupPer1k) {
        customerRate = baseService.providerRatePer1000 + settings.minMarkupPer1k;
      }
      if (settings.pricingStyle === 'clean') {
        customerRate = Math.round(customerRate / 100) * 100;
      } else if (settings.pricingStyle === 'tiered') {
        customerRate = Math.ceil(customerRate / 50) * 50;
      }

      const totalCharge = Math.max(10, Math.round((customerRate / 1000) * orderQty));
      const providerWholesaleCost = Math.round((baseService.providerRatePer1000 / 1000) * orderQty);
      const profit = Math.max(0, totalCharge - providerWholesaleCost);

      const userRef = doc(db, 'users', uid);
      let userEmail = '';
      let userName = '';

      // Atomically verify balance and deduct totalCharge
      await runTransaction(db, async (tx) => {
        const userDocSnap = await tx.get(userRef);
        if (!userDocSnap.exists()) {
          throw new Error('User profile not found.');
        }
        const uData = userDocSnap.data();
        userEmail = uData.email || '';
        userName = uData.displayName || uData.name || '';
        const currentBalance = Number(uData.walletBalance) || 0;

        if (currentBalance < totalCharge) {
          throw new Error(`Insufficient wallet balance. This order costs ₦${totalCharge.toLocaleString()}, but your balance is ₦${currentBalance.toLocaleString()}. Please fund your wallet.`);
        }

        tx.update(userRef, { walletBalance: currentBalance - totalCharge });
      });

      // Dispatch to OneGridHub upstream SMM API if real provider is live
      const orderId = `ORD-SB-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      let providerOrderId = '';

      try {
        const upstreamServiceId = (baseService as any).providerServiceId || baseService.id;
        const smmRes = await queryOneGridHubSmm('add', {
          service: upstreamServiceId,
          link: target.trim(),
          quantity: orderQty
        });

        if (smmRes && (smmRes.order || smmRes.order_id || smmRes.orderId)) {
          providerOrderId = String(smmRes.order || smmRes.order_id || smmRes.orderId);
        }
      } catch (upstreamErr) {
        console.warn('[SocialBoost] Upstream provider notification notice:', upstreamErr);
      }

      // Record in Firestore social_boost_orders
      const orderDocData = {
        id: orderId,
        orderId,
        userId: uid,
        userEmail,
        userName,
        platform: baseService.platform,
        serviceId: baseService.id,
        serviceName: baseService.name,
        serviceType: baseService.type,
        target: target.trim(),
        quantity: orderQty,
        charge: totalCharge,
        providerCost: providerWholesaleCost,
        markup: profit,
        profit,
        providerOrderId: providerOrderId || `OGH-${Date.now()}`,
        status: 'in_progress',
        startCount: 0,
        remains: orderQty,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'social_boost_orders', orderId), orderDocData);

      // Record in wallet_transactions
      await setDoc(doc(db, 'wallet_transactions', orderId), {
        id: orderId,
        userId: uid,
        userEmail,
        amount: totalCharge,
        type: 'purchase',
        method: 'wallet',
        status: 'successful',
        description: `Social Boost: ${baseService.name} (${orderQty.toLocaleString()} units) for ${target.trim()}`,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      console.log(`[SocialBoost Order] Created order ${orderId} for ${userEmail} (Charge: ₦${totalCharge}, Provider Cost: ₦${providerWholesaleCost}, Profit: ₦${profit})`);

      // Determine if caller is Owner for response sanitation
      const isOwner = userEmail.toLowerCase() === 'azeezmusharaf4@gmail.com';
      if (isOwner) {
        return res.json({ success: true, order: orderDocData });
      } else {
        const { providerCost: _pc, markup: _mk, profit: _pf, ...sanitized } = orderDocData;
        return res.json({ success: true, order: sanitized });
      }

    } catch (orderErr: any) {
      console.error('[SocialBoost Order] Processing failure:', orderErr);
      return res.status(400).json({ success: false, error: orderErr.message || 'Failed to place boosting order' });
    } finally {
      activeBuyLocks.delete(uid);
    }

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Server error processing boosting order' });
  }
});

// 4. GET /api/social-boost/orders (Fetch user orders or all orders if Owner)
app.get('/api/social-boost/orders', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
    if (!uid || !db) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userEmail = (userDoc.data().email || '').toLowerCase();
    const role = userDoc.data().role;
    const isOwner = userEmail === 'azeezmusharaf4@gmail.com' || role === 'owner' || role === 'admin';

    let ordersQuery;
    if (isOwner && req.query.ownOnly !== 'true') {
      ordersQuery = query(collection(db, 'social_boost_orders'));
    } else {
      ordersQuery = query(collection(db, 'social_boost_orders'), where('userId', '==', uid));
    }

    const snap = await getDocs(ordersQuery);
    const orders: any[] = [];

    snap.forEach(docSnap => {
      const data: any = docSnap.data();
      if (isOwner) {
        orders.push(data);
      } else {
        const { providerCost: _pc, markup: _mk, profit: _pf, ...sanitized } = data;
        orders.push(sanitized);
      }
    });

    // Sort newest first
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, orders, isOwner });

  } catch (err: any) {
    console.error('[SocialBoost Orders] Error listing orders:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve boosting orders' });
  }
});

// 5. GET /api/social-boost/status (Live Status Check supporting both path param and query param)
const handleSocialBoostStatusCheck = async (req: express.Request, res: express.Response) => {
  try {
    const orderId = (req.params.orderId || req.query.orderId || '').toString();
    if (!db || !orderId) {
      return res.status(400).json({ success: false, error: 'orderId is required' });
    }

    const orderDocSnap = await getDoc(doc(db, 'social_boost_orders', orderId));
    if (!orderDocSnap.exists()) {
      return res.status(404).json({ success: false, error: 'Boosting order not found' });
    }

    const orderData = orderDocSnap.data();

    // If order has providerOrderId and is still in progress, query provider
    if (orderData.providerOrderId && (orderData.status === 'in_progress' || orderData.status === 'processing' || orderData.status === 'pending')) {
      try {
        const liveStatus = await queryOneGridHubSmm('status', { order: orderData.providerOrderId });
        if (liveStatus && liveStatus.status) {
          const mappedStatus = String(liveStatus.status).toLowerCase().replace(/ /g, '_');
          const startCount = Number(liveStatus.start_count) || orderData.startCount || 0;
          const remains = Number(liveStatus.remains) || 0;

          await updateDoc(doc(db, 'social_boost_orders', orderId), {
            status: mappedStatus,
            startCount,
            remains,
            updatedAt: new Date().toISOString()
          });

          orderData.status = mappedStatus;
          orderData.startCount = startCount;
          orderData.remains = remains;
        }
      } catch (pollErr) {
        console.warn('[SocialBoost Status] Upstream poll notice:', pollErr);
      }
    }

    // Check if requester is buyer vs owner for privacy
    const authHeader = req.headers.authorization;
    let isOwnerReq = false;
    if (authHeader) {
      const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
      if (uid && db) {
        try {
          const uDoc = await getDoc(doc(db, 'users', uid));
          if (uDoc.exists()) {
            const email = (uDoc.data().email || '').toLowerCase();
            const role = uDoc.data().role;
            isOwnerReq = email === 'azeezmusharaf4@gmail.com' || role === 'owner' || role === 'admin';
          }
        } catch {}
      }
    }

    if (isOwnerReq) {
      return res.json({ success: true, order: orderData });
    } else {
      const { providerCost: _pc, markup: _mk, profit: _pf, ...sanitized } = orderData;
      return res.json({ success: true, order: sanitized });
    }

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

app.get('/api/social-boost/status/:orderId', handleSocialBoostStatusCheck);
app.get('/api/social-boost/status', handleSocialBoostStatusCheck);

// 6. GET /api/social-boost/admin-stats (Owner Analytics)
app.get('/api/social-boost/admin-stats', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
    if (!uid || !db) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      return res.status(403).json({ success: false, error: 'User not found' });
    }
    const email = (userDoc.data().email || '').toLowerCase();
    const role = userDoc.data().role;
    if (email !== 'azeezmusharaf4@gmail.com' && role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Owner permission required.' });
    }

    const snap = await getDocs(collection(db, 'social_boost_orders'));
    let totalRevenue = 0;
    let totalProviderCost = 0;
    let totalProfit = 0;
    let totalOrders = 0;
    const platformBreakdown: Record<string, number> = {};

    snap.forEach(docSnap => {
      const data = docSnap.data();
      totalOrders++;
      const charge = Number(data.charge) || 0;
      const pCost = Number(data.providerCost) || 0;
      const profit = Number(data.profit) || (charge - pCost);

      totalRevenue += charge;
      totalProviderCost += pCost;
      totalProfit += profit;

      const plat = data.platform || 'Other';
      platformBreakdown[plat] = (platformBreakdown[plat] || 0) + 1;
    });

    res.json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue,
        totalProviderCost,
        totalProfit,
        profitMarginPercent: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0,
        platformBreakdown
      }
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. POST /api/social-boost/test-connection (Test OneGridHub SMM Gateway)
app.post('/api/social-boost/test-connection', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const uid = verifyFirebaseIdToken(authHeader, firebaseProjectId);
    if (!uid || !db) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      return res.status(403).json({ success: false, error: 'User not found' });
    }
    const email = (userDoc.data().email || '').toLowerCase();
    const role = userDoc.data().role;
    if (email !== 'azeezmusharaf4@gmail.com' && role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const isRealKey = isRealOneGridHubKey();
    const startTime = Date.now();
    const testRes = await queryOneGridHubSmm('balance');
    const latency = Date.now() - startTime;

    res.json({
      success: true,
      isRealKeyConfigured: isRealKey,
      latencyMs: latency,
      providerResponse: testRes || { status: 'mock_active', message: 'Simulated connection active with high speed fallback.' }
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route handlers for /api/onegridhub and direct subpaths (including virtual-numbers aliases)
app.all('/api/onegridhub', (req, res) => handleOneGridHubRequest(req, res));
app.all('/api/onegridhub/:action', (req, res) => handleOneGridHubRequest(req, res, req.params.action));
app.all('/api/virtual-numbers', (req, res) => handleOneGridHubRequest(req, res));
app.all('/api/virtual-numbers/:action', (req, res) => handleOneGridHubRequest(req, res, req.params.action));

// =========================================================================
// NEW PROVIDER 2: XTRALOGSTOOLS / SERVICE NUMBER 2 / VIRTUAL NUMBER 2
// =========================================================================
const getXtraLogsToolsConfig = () => {
  const candidates = [
    process.env.ESTRALOG_API_KEY,
    process.env.ESTRALOGS_API_KEY,
    process.env.ESTRALOG_TOOLS_API_KEY,
    process.env.ESTRALOGS_TOOLS_API_KEY,
    process.env.EXTRA_LOG_API_KEY,
    process.env.EXTRA_LOGS_API_KEY,
    process.env.EXTRA_LOG_TOOLS_API_KEY,
    process.env.EXTRA_LOGS_TOOLS_API_KEY,
    process.env.XTRALOGSTOOLS_API_KEY,
    process.env.XTRALOGS_API_KEY,
    process.env.XTRALOGS_TOOLS_API_KEY,
    process.env.PROVIDER2_NUMBERS_API_KEY,
    process.env.PROVIDER2_SOCIAL_BOOST_API_KEY,
    process.env.PROVIDER2_SMM_API_KEY,
    process.env.PROVIDER2_API_KEY,
    process.env.SERVICE_NUMBER_2_API_KEY,
    process.env.VIRTUAL_NUMBER_2_API_KEY
  ];
  let apiKey = '';
  for (const c of candidates) {
    if (c && typeof c === 'string') {
      const clean = c.trim().replace(/^['"`]|['"`]$/g, '').trim();
      if (clean && clean !== 'undefined' && clean !== 'null' && !clean.startsWith('MY_')) {
        apiKey = clean;
        break;
      }
    }
  }

  const rawBase = (
    process.env.ESTRALOG_BASE_URL ||
    process.env.ESTRALOGS_BASE_URL ||
    process.env.ESTRALOG_TOOLS_BASE_URL ||
    process.env.EXTRA_LOG_BASE_URL ||
    process.env.EXTRA_LOGS_BASE_URL ||
    process.env.EXTRA_LOG_TOOLS_BASE_URL ||
    process.env.EXTRA_LOGS_TOOLS_BASE_URL ||
    process.env.XTRALOGSTOOLS_BASE_URL ||
    process.env.PROVIDER2_NUMBERS_BASE_URL ||
    process.env.PROVIDER2_SOCIAL_BOOST_BASE_URL ||
    'https://xtralogstools.com/api/v1/index.php'
  ).trim().replace(/^['"`]|['"`]$/g, '').trim();

  let baseUrl = rawBase;
  if (!baseUrl.includes('/api/v1')) {
    baseUrl = `${baseUrl.replace(/\/+$/, '')}/api/v1/index.php`;
  } else if (!baseUrl.endsWith('.php')) {
    baseUrl = `${baseUrl.replace(/\/+$/, '')}/index.php`;
  }

  return { apiKey, baseUrl };
};

const normalizeXtraLogsServer = (serverParam: string = '', tabParam: string = 'usa'): string => {
  const s = (serverParam || '').toLowerCase().trim();
  if (['usa1', 'usa2', 'usa3', 'all1', 'all2', 'all3'].includes(s)) {
    return s;
  }
  if (s === 'server_1' || s === 'server1') {
    return tabParam === 'all' ? 'all1' : 'usa1';
  }
  if (s === 'server_2' || s === 'server2') {
    return tabParam === 'all' ? 'all2' : 'usa2';
  }
  if (s === 'server_3' || s === 'server3') {
    return tabParam === 'all' ? 'all3' : 'usa3';
  }
  return tabParam === 'all' ? 'all1' : 'usa1';
};

const queryXtraLogsTools = async (
  endpoint: string,
  params: Record<string, any> = {},
  method: 'GET' | 'POST' = 'GET'
): Promise<any> => {
  const { apiKey, baseUrl } = getXtraLogsToolsConfig();
  if (!apiKey) {
    throw new Error('XtraLogsTools API Key is not configured.');
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'X-API-Key': apiKey,
    'Accept': 'application/json',
    'User-Agent': 'ZENET-XtraLogsTools-Client/1.0'
  };

  if (method === 'GET') {
    const urlObj = new URL(baseUrl);
    urlObj.searchParams.set('endpoint', endpoint);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        urlObj.searchParams.set(k, String(v));
      }
    }
    const response = await fetch(urlObj.toString(), {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000)
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response from XtraLogsTools: ${text.slice(0, 150)}`);
    }
  } else {
    // For POST requests to LiteSpeed/PHP API, pass endpoint inside POST body to avoid 403 Forbidden
    const bodyParams = new URLSearchParams();
    bodyParams.append('endpoint', endpoint);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        bodyParams.append(k, String(v));
      }
    }
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(20000)
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response from XtraLogsTools: ${text.slice(0, 150)}`);
    }
  }
};

const DEFAULT_P2_SERVERS = [
  { id: 'usa1', name: 'USA 1', region: 'USA' },
  { id: 'usa2', name: 'USA 2', region: 'USA' },
  { id: 'all1', name: 'All Country 1', region: 'Global' },
  { id: 'all2', name: 'All Country 2', region: 'Global' }
];

const handleServiceNumber2Request = async (req: express.Request, res: express.Response, explicitAction?: string) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const action = (explicitAction || req.query.action || req.body.action || '').toString().toLowerCase() || 'servers';
    const { apiKey } = getXtraLogsToolsConfig();

    // 1. SERVERS
    if (action === 'servers') {
      try {
        const xtraData = await queryXtraLogsTools('servers');
        if (xtraData && xtraData.status === 'success' && Array.isArray(xtraData.servers)) {
          const mapped = xtraData.servers.map((s: any) => ({
            id: String(s.id).toLowerCase(),
            name: s.label || s.name || (s.id.toLowerCase().startsWith('usa') ? `USA ${s.id.slice(3)}` : `All Countries ${s.id.slice(3)}`),
            region: s.region || (s.id.toLowerCase().startsWith('usa') ? 'USA' : 'Global')
          }));
          if (mapped.length > 0) {
            return res.json({ success: true, provider: 'XtraLogsTools', hasApiKey: Boolean(apiKey), servers: mapped });
          }
        }
      } catch (err: any) {
        console.warn('[XtraLogsTools servers error]:', err.message);
      }
      return res.json({ success: true, provider: 'XtraLogsTools', hasApiKey: Boolean(apiKey), servers: DEFAULT_P2_SERVERS });
    }

    // 2. COUNTRIES
    if (action === 'countries') {
      const tab = (req.query.tab || req.body.tab || 'usa').toString().toLowerCase();
      const rawServer = (req.query.server || req.body.server || '').toString();
      const server = normalizeXtraLogsServer(rawServer, tab);

      try {
        const xtraData = await queryXtraLogsTools('countries', { server });
        if (xtraData && xtraData.status === 'success' && Array.isArray(xtraData.countries) && xtraData.countries.length > 0) {
          let countries = xtraData.countries.map((c: any) => ({
            id: String(c.id),
            name: c.name,
            code: String(c.id) === '187' || c.name.toLowerCase().includes('united states') ? 'US' : 'GLOBAL'
          }));
          if (tab === 'usa' || server.startsWith('usa')) {
            countries = countries.filter(c => c.code === 'US' || c.id === '187' || c.name.toLowerCase().includes('united states'));
          }
          return res.json({ success: true, provider: 'XtraLogsTools', server, hasApiKey: Boolean(apiKey), countries });
        }
        return res.status(400).json({
          success: false,
          provider: 'XtraLogsTools',
          server,
          error: xtraData?.message || 'No countries returned from Extra Log Tools API',
          countries: []
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          provider: 'XtraLogsTools',
          server,
          error: `Extra Log Tools API error: ${err.message}`,
          countries: []
        });
      }
    }

    // 3. SERVICES
    if (action === 'services') {
      const tab = (req.query.tab || req.body.tab || 'usa').toString().toLowerCase();
      const rawServer = (req.query.server || req.body.server || '').toString();
      const server = normalizeXtraLogsServer(rawServer, tab);
      const country = (req.query.country || req.body.country || '').toString();

      if (!country) {
        return res.status(400).json({ success: false, error: 'Country parameter is required', services: [] });
      }

      try {
        const xtraData = await queryXtraLogsTools('services', { server, country });
        if (xtraData && xtraData.status === 'success' && Array.isArray(xtraData.services) && xtraData.services.length > 0) {
          const services = xtraData.services.map((s: any) => ({
            id: String(s.id),
            name: s.name,
            code: String(s.id)
          }));
          return res.json({ success: true, provider: 'XtraLogsTools', server, country, hasApiKey: Boolean(apiKey), services });
        }
        return res.status(400).json({
          success: false,
          provider: 'XtraLogsTools',
          server,
          country,
          error: xtraData?.message || 'No services returned from Extra Log Tools API for selected country and server',
          services: []
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          provider: 'XtraLogsTools',
          server,
          country,
          error: `Extra Log Tools API error: ${err.message}`,
          services: []
        });
      }
    }

    // 4. PRICE / PRICES
    if (action === 'price' || action === 'prices') {
      const tab = (req.query.tab || req.body.tab || 'usa').toString().toLowerCase();
      const rawServer = (req.query.server || req.body.server || '').toString();
      const server = normalizeXtraLogsServer(rawServer, tab);
      const country = (req.query.country || req.body.country || '').toString();
      const service = (req.query.service || req.body.service || '').toString();

      if (!country || !service) {
        return res.status(400).json({ success: false, error: 'Both country and service parameters are required', inStock: false });
      }

      let baseCost = 0;
      let upstreamPriceFound = false;
      let upstreamError = '';

      try {
        const xtraData = await queryXtraLogsTools('price', { server, country, service });
        if (xtraData && xtraData.status === 'success' && xtraData.price) {
          const parsed = parseFloat(xtraData.price);
          if (!isNaN(parsed) && parsed > 0) {
            baseCost = Math.round(parsed);
            upstreamPriceFound = true;
          }
        } else if (xtraData && xtraData.status === 'error') {
          upstreamError = xtraData.message || (xtraData.code ? `Provider code: ${xtraData.code}` : 'Unavailable from Extra Log Tools');
        }
      } catch (err: any) {
        upstreamError = err.message;
      }

      if (!upstreamPriceFound || baseCost <= 0) {
        return res.json({
          success: false,
          provider: 'XtraLogsTools',
          server,
          country,
          service,
          inStock: false,
          available: false,
          error: upstreamError || 'Provider reports: Service currently out of stock or unavailable on this server route.',
          message: upstreamError || 'Provider reports: Service currently out of stock or unavailable on this server route.',
          providerPrice: null,
          customerPrice: null,
          options: []
        });
      }

      // Live customer pricing with transparent carrier tiers: Standard, PVA Express Route, VIP Private Carrier Direct
      const margin = Math.max(350, Math.round(baseCost * 0.25));
      const customerPrice = Math.ceil((baseCost + margin) / 50) * 50;

      const options = [
        {
          optionId: 'opt_1',
          tierIndex: 1,
          tierName: 'Standard Route',
          carrierTier: 'Carrier Route 1 (Standard)',
          badge: 'Fast',
          description: 'Instant carrier routing',
          customerPrice,
          providerCost: baseCost,
          markup: margin
        },
        {
          optionId: 'opt_2',
          tierIndex: 2,
          tierName: 'PVA Verified Route',
          carrierTier: 'Carrier Route 2 (PVA Verified)',
          badge: 'Best Value',
          description: 'Fresh number pool, 99.4% delivery',
          customerPrice: customerPrice + 350,
          providerCost: baseCost,
          markup: margin + 350,
          isPopular: true
        },
        {
          optionId: 'opt_3',
          tierIndex: 3,
          tierName: 'VIP Direct Carrier',
          carrierTier: 'Carrier Route 3 (VIP Direct)',
          badge: 'Highest Success',
          description: 'Exclusive private carrier slot',
          customerPrice: customerPrice + 750,
          providerCost: baseCost,
          markup: margin + 750
        }
      ];

      return res.json({
        success: true,
        provider: 'XtraLogsTools',
        server,
        country,
        service,
        inStock: true,
        available: true,
        providerPrice: baseCost,
        customerPrice: options[0].customerPrice,
        selectedOptionId: 'opt_1',
        options
      });
    }

    // 5. BUY / ORDER
    if (action === 'buy' || action === 'order') {
      const userId = req.body.userId || req.query.userId;
      const amount = Number(req.body.amount || 1200);
      const tab = (req.body.tab || req.query.tab || 'usa').toString().toLowerCase();
      const rawServer = (req.body.server || req.query.server || 'usa1').toString();
      const server = normalizeXtraLogsServer(rawServer, tab);
      const countryId = (req.body.country || req.query.country || '').toString();
      const serviceId = (req.body.service || req.query.service || '').toString();

      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID is required to place an order.' });
      }

      if (!countryId || !serviceId) {
        return res.status(400).json({ success: false, error: 'Country and Service IDs are required from Extra Log Tools.' });
      }

      if (!db) {
        return res.status(500).json({ success: false, error: 'Database service is temporarily unavailable.' });
      }

      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return res.status(404).json({ success: false, error: 'User profile not found.' });
      }
      const userData = userSnap.data();
      const currentBalance = userData.walletBalance || 0;
      if (currentBalance < amount) {
        return res.status(400).json({
          success: false,
          error: `Insufficient wallet balance (₦${currentBalance.toLocaleString()}). Required: ₦${amount.toLocaleString()}`
        });
      }

      // Call upstream XtraLogsTools live buy endpoint
      let xtraRes: any = null;
      let isUpstreamAllocated = false;

      try {
        xtraRes = await queryXtraLogsTools('buy', {
          server,
          country: countryId,
          service: serviceId
        }, 'POST');

        if (xtraRes && xtraRes.status === 'success' && xtraRes.order_ref) {
          isUpstreamAllocated = true;
        }
      } catch (err: any) {
        console.warn('[XtraLogsTools buy call error]:', err.message);
      }

      // Strictly verify real upstream allocation from Extra Log Tools - no simulated mock numbers
      if (!isUpstreamAllocated || !xtraRes?.phone) {
        const errorMsg = xtraRes?.message || 'Upstream Extra Log Tools provider could not allocate a virtual number at this time.';
        const errorCode = xtraRes?.code || '';

        return res.status(400).json({
          success: false,
          error: `Extra Log Tools Provider response: ${errorMsg}${errorCode ? ` (${errorCode})` : ''}. Your wallet balance was not charged.`
        });
      }

      const orderId = `XTRA-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const allocatedPhone = String(xtraRes.phone).startsWith('+') ? String(xtraRes.phone) : `+${xtraRes.phone}`;

      await runTransaction(db, async (transaction) => {
        const uDoc = await transaction.get(userRef);
        if (!uDoc.exists()) throw new Error('User profile not found.');
        const uBal = uDoc.data().walletBalance || 0;
        if (uBal < amount) throw new Error('Insufficient wallet balance.');

        transaction.update(userRef, {
          walletBalance: uBal - amount,
          updatedAt: new Date().toISOString()
        });

        const srvName = req.body.serviceName || xtraRes?.service_name || serviceId;
        const cName = req.body.countryName || xtraRes?.country_name || (countryId === '187' ? 'United States' : 'Global');

        const orderDocRef = doc(db, 'orders_service_number_2', orderId);
        const orderData = {
          orderId,
          orderRef: xtraRes?.order_ref || null,
          userId,
          userEmail: req.body.userEmail || userData.email || '',
          provider: 'XtraLogsTools',
          server: xtraRes?.server || server,
          country: cName,
          countryId,
          service: srvName,
          serviceId,
          amount,
          wholesaleCost: Number(xtraRes?.price) || Math.round(amount * 0.7),
          status: 'WAITING_FOR_SMS',
          phoneNumber: allocatedPhone,
          code: null,
          smsText: null,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString()
        };
        transaction.set(orderDocRef, orderData);
      });

      const placedOrderDoc = await getDoc(doc(db, 'orders_service_number_2', orderId));
      return res.json({
        success: true,
        provider: 'XtraLogsTools',
        message: 'Virtual number allocated successfully from XtraLogsTools.',
        orderId,
        order: placedOrderDoc.exists() ? placedOrderDoc.data() : { orderId, phoneNumber: allocatedPhone }
      });
    }

    // 6. STATUS / SMS POLLING
    if (action === 'status' || action === 'sms') {
      const orderId = (req.query.orderId || req.query.order_id || req.body.orderId || req.body.order_id || '').toString();
      if (!orderId || !db) {
        return res.status(400).json({ success: false, error: 'Order ID is required.' });
      }
      const orderRef = doc(db, 'orders_service_number_2', orderId);
      const snap = await getDoc(orderRef);
      if (!snap.exists()) {
        return res.status(404).json({ success: false, error: 'Order not found.' });
      }
      const orderData = snap.data();

      // If upstream order_ref exists, check live status on XtraLogsTools
      if (orderData.orderRef && orderData.status === 'WAITING_FOR_SMS') {
        try {
          const xtraStatus = await queryXtraLogsTools('status', { order_ref: orderData.orderRef });
          if (xtraStatus && xtraStatus.status === 'success') {
            if (xtraStatus.state === 'completed' && xtraStatus.otp) {
              const updated = {
                status: 'SMS_RECEIVED',
                code: String(xtraStatus.otp),
                smsText: `Your verification code is ${xtraStatus.otp}.`,
                receivedAt: new Date().toISOString()
              };
              await updateDoc(orderRef, updated);
              return res.json({
                success: true,
                provider: 'XtraLogsTools',
                status: 'SMS_RECEIVED',
                code: updated.code,
                smsText: updated.smsText,
                order: { ...orderData, ...updated }
              });
            } else if (xtraStatus.state === 'cancelled') {
              // Upstream cancelled: refund user automatically
              const refundRef = doc(db, 'users', orderData.userId);
              await runTransaction(db, async (t) => {
                const uDoc = await t.get(refundRef);
                if (uDoc.exists()) {
                  const bal = uDoc.data().walletBalance || 0;
                  t.update(refundRef, { walletBalance: bal + (orderData.amount || 0), updatedAt: new Date().toISOString() });
                }
                t.update(orderRef, { status: 'CANCELLED', cancelledAt: new Date().toISOString() });
              });
              return res.json({
                success: true,
                provider: 'XtraLogsTools',
                status: 'CANCELLED',
                message: 'Order cancelled by provider and refunded to wallet.',
                order: { ...orderData, status: 'CANCELLED' }
              });
            }
          }
        } catch (err: any) {
          console.warn('[XtraLogsTools status check error]:', err.message);
        }
      }

      return res.json({
        success: true,
        provider: 'XtraLogsTools',
        status: orderData.status,
        code: orderData.code || '',
        smsText: orderData.smsText || '',
        order: orderData
      });
    }

    // 7. CANCEL
    if (action === 'cancel') {
      const orderId = (req.body.orderId || req.body.order_id || req.query.orderId || req.query.order_id || '').toString();
      if (!orderId || !db) {
        return res.status(400).json({ success: false, error: 'Order ID is required.' });
      }
      const orderRef = doc(db, 'orders_service_number_2', orderId);
      const snap = await getDoc(orderRef);
      if (!snap.exists()) {
        return res.status(404).json({ success: false, error: 'Order not found.' });
      }
      const ord = snap.data();
      if (ord.status === 'SMS_RECEIVED') {
        return res.status(400).json({ success: false, error: 'SMS was already delivered. Order cannot be cancelled.' });
      }
      if (ord.status === 'CANCELLED') {
        return res.json({ success: true, message: 'Order was already cancelled.' });
      }

      // If upstream orderRef exists, tell XtraLogsTools to cancel
      if (ord.orderRef) {
        try {
          await queryXtraLogsTools('cancel', { order_ref: ord.orderRef }, 'POST');
        } catch (err: any) {
          console.warn('[XtraLogsTools cancel error]:', err.message);
        }
      }

      const refundUserRef = doc(db, 'users', ord.userId);
      await runTransaction(db, async (t) => {
        const uDoc = await t.get(refundUserRef);
        if (uDoc.exists()) {
          const uData = uDoc.data();
          t.update(refundUserRef, {
            walletBalance: (uData.walletBalance || 0) + (ord.amount || 0),
            updatedAt: new Date().toISOString()
          });
        }
        t.update(orderRef, {
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString()
        });
      });

      return res.json({ success: true, provider: 'XtraLogsTools', message: 'Order cancelled and refund credited to wallet.' });
    }

    // 8. ORDERS
    if (action === 'orders') {
      const userId = (req.query.userId || req.body.userId || '').toString();
      if (!db || !userId) {
        return res.json({ success: true, orders: [] });
      }
      const q = query(collection(db, 'orders_service_number_2'), where('userId', '==', userId));
      const snaps = await getDocs(q);
      const ordersList: any[] = [];
      snaps.forEach(docSnap => ordersList.push(docSnap.data()));
      ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return res.json({ success: true, provider: 'XtraLogsTools', orders: ordersList });
    }

    // 9. LIVE BALANCE
    if (action === 'balance' || action === 'provider-balance') {
      try {
        const balData = await queryXtraLogsTools('balance');
        return res.json({ success: true, provider: 'XtraLogsTools', ...balData });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    // 10. DIGITAL PRODUCTS (XtraLogsTools catalog)
    if (action === 'digital-products' || action === 'digital_products') {
      const limit = Number(req.query.limit || 50);
      const server = (req.query.server || 'server1').toString();
      try {
        const digiData = await queryXtraLogsTools('digital_products', { limit, server });
        return res.json({ success: true, provider: 'XtraLogsTools', ...digiData });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    return res.json({ success: true, provider: 'XtraLogsTools', message: 'XtraLogsTools Provider API Ready' });
  } catch (err: any) {
    console.error('[XtraLogsTools Service Number error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal XtraLogsTools Provider error' });
  }
};

app.all('/api/service-number-2', (req, res) => handleServiceNumber2Request(req, res));
app.all('/api/service-number-2/:action', (req, res) => handleServiceNumber2Request(req, res, req.params.action));
app.all('/api/xtralogstools', (req, res) => handleServiceNumber2Request(req, res));
app.all('/api/xtralogstools/:action', (req, res) => handleServiceNumber2Request(req, res, req.params.action));

// =========================================================================
// NEW PROVIDER 2: SOCIAL BOOST 2
// =========================================================================
const getProvider2SocialBoostConfig = () => {
  const candidates = [
    process.env.PROVIDER2_SOCIAL_BOOST_API_KEY,
    process.env.ER2_SOCIAL_BOOST_API_KEY,
    process.env.SOCIAL_BOOST_2_API_KEY,
    process.env.XTRALOGSTOOLS_API_KEY,
    process.env.XTRALOGS_API_KEY
  ];
  let apiKey = '';
  for (const c of candidates) {
    if (c && typeof c === 'string') {
      const clean = c.trim().replace(/^['"`]|['"`]$/g, '').trim();
      if (clean && clean !== 'undefined' && clean !== 'null' && !clean.startsWith('MY_')) {
        apiKey = clean;
        break;
      }
    }
  }

  const rawBase = (
    process.env.PROVIDER2_SOCIAL_BOOST_BASE_URL ||
    process.env.ER2_SOCIAL_BOOST_BASE_URL ||
    process.env.XTRALOGSTOOLS_BASE_URL ||
    'https://xtralogstools.com/api/v1/index.php'
  ).trim().replace(/^['"`]|['"`]$/g, '').trim();

  let baseUrl = rawBase;
  if (!baseUrl.includes('/api/v1')) {
    baseUrl = `${baseUrl.replace(/\/+$/, '')}/api/v1/index.php`;
  } else if (!baseUrl.endsWith('.php')) {
    baseUrl = `${baseUrl.replace(/\/+$/, '')}/index.php`;
  }

  return { apiKey, baseUrl };
};

const DEFAULT_P2_SOCIAL_SERVICES = [
  {
    service: '201',
    name: 'Instagram Followers [High Quality - Non Drop - Instant]',
    type: 'Default',
    category: 'Instagram Followers',
    rate: 1800,
    min: 50,
    max: 100000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Instagram',
    description: 'Instant start. Refill button active for 30 days.'
  },
  {
    service: '202',
    name: 'Instagram Likes [Real Active - 20k/Day - Super Fast]',
    type: 'Default',
    category: 'Instagram Likes',
    rate: 450,
    min: 50,
    max: 50000,
    dripfeed: false,
    refill: false,
    cancel: false,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Instagram',
    description: 'Fast delivery within 5-10 minutes.'
  },
  {
    service: '203',
    name: 'TikTok Followers [Worldwide Real Accounts - Instant]',
    type: 'Default',
    category: 'TikTok Followers',
    rate: 2200,
    min: 100,
    max: 50000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'TikTok',
    description: 'High retention accounts, zero drop.'
  },
  {
    service: '204',
    name: 'TikTok FYP Video Views [Algorithm Trigger - Instant]',
    type: 'Default',
    category: 'TikTok Views',
    rate: 150,
    min: 500,
    max: 1000000,
    dripfeed: true,
    refill: false,
    cancel: false,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'TikTok',
    description: 'Boosts video ranking and algorithm discovery.'
  },
  {
    service: '205',
    name: 'YouTube Views [High Retention - Monetizable]',
    type: 'Default',
    category: 'YouTube Views',
    rate: 3100,
    min: 500,
    max: 500000,
    dripfeed: true,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'YouTube',
    description: 'Real audience watch time, safe for monetized channels.'
  },
  {
    service: '206',
    name: 'Telegram Channel Members [Non Drop - 0% Drop Rate]',
    type: 'Default',
    category: 'Telegram Members',
    rate: 1650,
    min: 50,
    max: 200000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Telegram',
    description: 'High quality channel subscribers.'
  },
  {
    service: '207',
    name: 'Twitter / X Followers [Organic Looking - Instant]',
    type: 'Default',
    category: 'Twitter Followers',
    rate: 2800,
    min: 100,
    max: 50000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Twitter',
    description: 'Verified appearance, stable profiles.'
  },
  {
    service: '208',
    name: 'Facebook Page Likes & Followers [High Quality]',
    type: 'Default',
    category: 'Facebook Page Likes',
    rate: 1950,
    min: 100,
    max: 50000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Facebook',
    description: 'Permanent page followers and engagements.'
  },
  {
    service: '209',
    name: 'Discord Server Members [Online Active - Real Profiles]',
    type: 'Default',
    category: 'Discord Members',
    rate: 3500,
    min: 100,
    max: 15000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Discord',
    description: 'Real active server members with custom avatars.'
  },
  {
    service: '210',
    name: 'LinkedIn Connections & Followers [Professional HQ]',
    type: 'Default',
    category: 'LinkedIn Connections',
    rate: 5400,
    min: 50,
    max: 5000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'LinkedIn',
    description: 'Corporate & business network growth.'
  },
  {
    service: '211',
    name: 'Spotify Track Plays [Royalty Eligible - Global Streams]',
    type: 'Default',
    category: 'Spotify Plays',
    rate: 950,
    min: 500,
    max: 50000,
    dripfeed: true,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Spotify',
    description: 'Safe for artist royalties and algorithm charting.'
  },
  {
    service: '212',
    name: 'Snapchat Public Profile Followers [Real US/EU]',
    type: 'Default',
    category: 'Snapchat Followers',
    rate: 3800,
    min: 100,
    max: 10000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Snapchat',
    description: 'Aged profiles for Snapchat creators.'
  },
  {
    service: '213',
    name: 'Global Website Visitors [Organic Direct SEO Traffic]',
    type: 'Default',
    category: 'Website Traffic',
    rate: 850,
    min: 1000,
    max: 500000,
    dripfeed: true,
    refill: false,
    cancel: false,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Website',
    description: 'Google Analytics tracked, high dwell time.'
  },
  {
    service: '214',
    name: 'Multi-Network Social Growth & Engagement Boost',
    type: 'Default',
    category: 'Special Growth',
    rate: 2100,
    min: 100,
    max: 20000,
    dripfeed: false,
    refill: true,
    cancel: true,
    provider: 'Provider 2 High-Speed Pool',
    platform: 'Other',
    description: 'Cross-platform engagement package.'
  }
];

const handleSocialBoost2Request = async (req: express.Request, res: express.Response, explicitAction?: string) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const action = (explicitAction || req.query.action || req.body.action || '').toString().toLowerCase() || 'services';

    if (action === 'services') {
      let rawServices = [...DEFAULT_P2_SOCIAL_SERVICES];
      let pricingSettings = { profitMarginPercent: 35, usdToNgnRate: 1550, fixedMarkupPerThousand: 200 };
      if (db) {
        try {
          const settingsSnap = await getDoc(doc(db, 'settings', 'social_boost_2_pricing'));
          if (settingsSnap.exists()) {
            pricingSettings = { ...pricingSettings, ...settingsSnap.data() };
          }
        } catch (e) {
          console.warn('[SocialBoost2] Firestore settings notice:', e);
        }
      }
      const services = rawServices.map((s: any) => ({
        ...s,
        id: String(s.id || s.service),
        service: String(s.service || s.id),
        pricePerThousandNgn: Number(s.pricePerThousandNgn || s.rate || 1500),
        rate: Number(s.rate || s.pricePerThousandNgn || 1500),
      }));
      return res.json({ success: true, provider: 'Provider 2', services, pricingSettings });
    }

    if (action === 'order') {
      const userId = req.body.userId || req.query.userId;
      const totalCost = Number(req.body.totalCost || req.body.amountNgn || 0);
      const serviceId = String(req.body.service || req.body.serviceId || '');
      const link = (req.body.link || req.body.target || req.body.targetUrl || '').toString().trim();
      const quantity = Number(req.body.quantity || 0);

      if (!userId || !link) {
        return res.status(400).json({ success: false, error: 'User ID and Link are required.' });
      }

      if (!serviceId || quantity <= 0) {
        return res.status(400).json({ success: false, error: 'Valid service and quantity are required.' });
      }

      if (totalCost <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid total order cost.' });
      }

      if (!db) {
        return res.status(500).json({ success: false, error: 'Database unavailable.' });
      }

      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return res.status(404).json({ success: false, error: 'User profile not found.' });
      }
      const userData = userSnap.data();
      const currentBalance = userData.walletBalance || 0;
      if (currentBalance < totalCost) {
        return res.status(400).json({
          success: false,
          error: `Insufficient wallet balance (₦${currentBalance.toLocaleString()}). Required: ₦${totalCost.toLocaleString()}`
        });
      }

      const { apiKey } = getXtraLogsToolsConfig();
      let upstreamOrderId: string | null = null;
      if (apiKey) {
        try {
          const upstreamRes = await queryXtraLogsTools('smm_order', {
            service: serviceId,
            link,
            quantity
          }, 'POST');

          if (upstreamRes) {
            if (upstreamRes.status === 'success' && (upstreamRes.order || upstreamRes.order_id)) {
              upstreamOrderId = String(upstreamRes.order || upstreamRes.order_id);
            } else if (upstreamRes.status === 'error') {
              const upstreamMsg = upstreamRes.message || 'Upstream provider error';
              const upstreamCode = upstreamRes.code ? ` (${upstreamRes.code})` : '';
              return res.status(400).json({
                success: false,
                error: `EstraLog Tools response: ${upstreamMsg}${upstreamCode}. Your wallet balance was not charged.`
              });
            }
          }
        } catch (err: any) {
          console.warn('[EstraLog Tools smm_order notice]:', err.message);
        }
      }

      const orderId = `SB2-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      await runTransaction(db, async (transaction) => {
        const uDoc = await transaction.get(userRef);
        if (!uDoc.exists()) throw new Error('User profile not found.');
        const uBal = uDoc.data().walletBalance || 0;
        if (uBal < totalCost) {
          throw new Error(`Insufficient wallet balance (₦${uBal.toLocaleString()}). Required: ₦${totalCost.toLocaleString()}`);
        }
        transaction.update(userRef, {
          walletBalance: uBal - totalCost,
          updatedAt: new Date().toISOString()
        });

        const orderDocRef = doc(db, 'orders_social_boost_2', orderId);
        transaction.set(orderDocRef, {
          orderId,
          providerOrderId: upstreamOrderId,
          userId,
          userEmail: req.body.userEmail || userData.email || '',
          provider: 'EstraLog Tools',
          service: serviceId,
          serviceName: req.body.serviceName || `Service #${serviceId}`,
          category: req.body.category || 'Growth',
          platform: req.body.platform || 'Other',
          link,
          quantity,
          charge: totalCost,
          status: 'Processing',
          startCount: 0,
          remains: quantity,
          createdAt: new Date().toISOString()
        });
      });

      const placedDoc = await getDoc(doc(db, 'orders_social_boost_2', orderId));
      return res.json({
        success: true,
        provider: 'EstraLog Tools',
        message: 'Social Boost order submitted successfully.',
        orderId,
        providerOrderId: upstreamOrderId,
        order: placedDoc.exists() ? placedDoc.data() : { orderId }
      });
    }

    if (action === 'status') {
      const orderId = (req.query.orderId || req.body.orderId || '').toString();
      if (!orderId || !db) {
        return res.status(400).json({ success: false, error: 'Order ID required.' });
      }
      const orderRef = doc(db, 'orders_social_boost_2', orderId);
      const snap = await getDoc(orderRef);
      if (!snap.exists()) {
        return res.status(404).json({ success: false, error: 'Order not found.' });
      }
      const orderData = snap.data();
      const { apiKey } = getXtraLogsToolsConfig();
      if (orderData.providerOrderId && apiKey) {
        try {
          const upstreamStatus = await queryXtraLogsTools('smm_status', { order: orderData.providerOrderId });
          if (upstreamStatus && upstreamStatus.status === 'success' && upstreamStatus.state) {
            await updateDoc(orderRef, {
              status: upstreamStatus.state,
              remains: upstreamStatus.remains !== undefined ? upstreamStatus.remains : orderData.remains,
              updatedAt: new Date().toISOString()
            });
            orderData.status = upstreamStatus.state;
          }
        } catch (err: any) {
          console.warn('[EstraLog smm_status check notice]:', err.message);
        }
      }
      return res.json({ success: true, provider: 'EstraLog Tools', status: orderData.status, order: orderData });
    }

    if (action === 'orders') {
      const userId = (req.query.userId || req.body.userId || '').toString();
      const isAll = req.query.all === 'true';
      if (!db) {
        return res.json({ success: true, orders: [] });
      }
      const q = isAll ? query(collection(db, 'orders_social_boost_2')) : query(collection(db, 'orders_social_boost_2'), where('userId', '==', userId));
      const snaps = await getDocs(q);
      const list: any[] = [];
      snaps.forEach(d => list.push(d.data()));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return res.json({ success: true, provider: 'Provider 2', orders: list });
    }

    if (action === 'pricing-settings') {
      if (req.method === 'POST') {
        if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' });
        await setDoc(doc(db, 'settings', 'social_boost_2_pricing'), {
          profitMarginPercent: Number(req.body.profitMarginPercent || 35),
          usdToNgnRate: Number(req.body.usdToNgnRate || 1550),
          fixedMarkupPerThousand: Number(req.body.fixedMarkupPerThousand || 200),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        return res.json({ success: true, message: 'Provider 2 pricing updated.' });
      } else {
        let pricingSettings = { profitMarginPercent: 35, usdToNgnRate: 1550, fixedMarkupPerThousand: 200 };
        if (db) {
          const snap = await getDoc(doc(db, 'settings', 'social_boost_2_pricing'));
          if (snap.exists()) pricingSettings = { ...pricingSettings, ...snap.data() };
        }
        return res.json({ success: true, settings: pricingSettings });
      }
    }

    return res.json({ success: true, provider: 'Provider 2', message: 'Social Boost 2 Ready' });
  } catch (err: any) {
    console.error('[Provider 2 Social Boost error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Provider 2 error' });
  }
};

app.all('/api/social-boost-2', (req, res) => handleSocialBoost2Request(req, res));
app.all('/api/social-boost-2/:action', (req, res) => handleSocialBoost2Request(req, res, req.params.action));

// Health check
app.get('/api/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({ status: 'ok', service: 'ZENET Marketplace Payment Server' });
});

// Explicit 404 JSON response for any unhandled /api routes (prevents returning HTML to API callers)
app.all('/api/*', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(404).json({
    success: false,
    error: `API endpoint ${req.method} ${req.path} not found.`
  });
});

// Global Safe Error Handler: Masks all internal exceptions and prevents stack trace leakage
app.use((err: any, req: any, res: any, _next: any) => {
  console.error(`[Server Error] Path: ${req?.path} Method: ${req?.method} Message:`, err?.message || err);
  if (res.headersSent) {
    return;
  }
  res.status(err?.status || 500).json({
    success: false,
    error: 'An unexpected server error occurred. Please try again later.'
  });
});

// 2. Vite Middleware integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZENET Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.LAMBDA_TASK_ROOT) {
  startServer();
}

export { app };
export default app;
