import crypto from 'crypto';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction
} from 'firebase/firestore';

// Load Firebase configuration
import firebaseConfig from '../../firebase-applet-config.json';

function getDb() {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } catch (err) {
    console.error('[Vercel Paystack Webhook] Firebase Init Error:', err);
    return null;
  }
}

// Vercel Serverless Function config to disable automatic body parsing
// so we can compute the exact HMAC SHA-512 signature from raw stream bytes
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  // CORS & Options pre-flight handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-paystack-signature');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Read raw stream payload for HMAC signature verification
    const rawBuffer = await getRawBody(req);
    const rawPayload = rawBuffer.toString('utf8');

    // 2. Fetch Paystack secret key from server-side environment
    const rawSecretKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_KEY || '';
    const paystackSecretKey = rawSecretKey ? rawSecretKey.trim().replace(/^['"`]|['"`]$/g, '').trim() : '';

    const signature = (req.headers['x-paystack-signature'] || req.headers['X-Paystack-Signature'] || '') as string;

    // 3. Secure HMAC SHA-512 Verification
    if (paystackSecretKey && signature) {
      const hash = crypto.createHmac('sha512', paystackSecretKey)
        .update(rawBuffer)
        .digest('hex');

      if (!signature || hash.toLowerCase() !== signature.toLowerCase()) {
        console.warn('[Vercel Paystack Webhook] Invalid HMAC signature received.');
        return res.status(400).json({ error: 'Invalid HMAC signature' });
      }
    } else if (!paystackSecretKey) {
      console.warn('[Vercel Paystack Webhook] Warning: PAYSTACK_SECRET_KEY missing in server environment.');
    }

    // 4. Parse JSON payload
    let event: any = {};
    try {
      event = JSON.parse(rawPayload);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body payload' });
    }

    if (!event || !event.event) {
      return res.status(400).json({ error: 'Invalid event structure' });
    }

    console.log(`[Vercel Paystack Webhook] Event Received: ${event.event}`);

    if (event.event === 'charge.success') {
      const data = event.data || {};
      const reference = data.reference || `PAY_${data.id}`;
      const amountNGN = data.amount ? data.amount / 100 : 0;
      const customerEmail = (data.customer?.email || '').trim().toLowerCase();
      const customerCode = data.customer?.customer_code;

      console.log(`[Vercel Paystack Webhook] Processing charge.success for ₦${amountNGN} (Ref: ${reference})`);

      const db = getDb();
      if (!db) {
        console.error('[Vercel Paystack Webhook] Database unavailable.');
        return res.status(500).json({ error: 'Database unavailable' });
      }

      // Safe metadata extraction
      let metadataObj: any = {};
      if (data.metadata) {
        if (typeof data.metadata === 'string') {
          try { metadataObj = JSON.parse(data.metadata); } catch {}
        } else {
          metadataObj = data.metadata;
        }
      }

      let extractedUserId = metadataObj.userId || null;
      if (!extractedUserId && Array.isArray(metadataObj.custom_fields)) {
        const uField = metadataObj.custom_fields.find((f: any) => f.variable_name === 'user_id' || f.variable_name === 'userId');
        if (uField && uField.value) extractedUserId = String(uField.value);
      }

      // Resolve user in Firestore
      let targetUserId: string | null = extractedUserId;

      if (!targetUserId && customerCode) {
        const custCodeQ = query(collection(db, 'users'), where('paystackCustomerCode', '==', customerCode));
        const custCodeSnap = await getDocs(custCodeQ);
        if (!custCodeSnap.empty) {
          targetUserId = custCodeSnap.docs[0].id;
        }
      }

      if (!targetUserId && customerEmail) {
        const usersQ = query(collection(db, 'users'), where('email', '==', customerEmail));
        const usersSnap = await getDocs(usersQ);
        if (!usersSnap.empty) {
          targetUserId = usersSnap.docs[0].id;
        } else {
          const allUsersSnap = await getDocs(collection(db, 'users'));
          const found = allUsersSnap.docs.find(d => {
            const uData = d.data();
            return uData.email && uData.email.trim().toLowerCase() === customerEmail;
          });
          if (found) targetUserId = found.id;
        }
      }

      if (!targetUserId) {
        console.warn(`[Vercel Paystack Webhook] User profile not located for email: ${customerEmail}`);
        return res.status(200).json({
          status: 'user_not_found',
          message: 'Webhook event received but target user account could not be mapped.'
        });
      }

      // Atomic execution using Firestore runTransaction to prevent duplicate crediting
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

        const uDocRef = doc(db, 'users', String(targetUserId));
        const uDocSnap = await transaction.get(uDocRef);
        const currentBal = uDocSnap.exists() ? (uDocSnap.data().walletBalance || 0) : 0;
        finalBalance = currentBal + amountNGN;

        if (uDocSnap.exists()) {
          transaction.update(uDocRef, { walletBalance: finalBalance });
        } else {
          transaction.set(uDocRef, {
            walletBalance: finalBalance,
            email: customerEmail || '',
            createdAt: new Date().toISOString()
          }, { merge: true });
        }

        const bankName = data.authorization?.bank || data.dedicated_account?.bank?.name || 'Paystack Deposit';
        transaction.set(txDocRef, {
          id: reference,
          reference: reference,
          userId: String(targetUserId),
          userEmail: customerEmail || '',
          amount: amountNGN,
          type: 'deposit',
          method: 'paystack_webhook',
          status: 'successful',
          paystackReference: reference,
          description: metadataObj.listingTitle || `Paystack Deposit (${bankName})`,
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          createdAt: new Date().toISOString()
        });
      });

      if (alreadyCredited) {
        console.log(`[Vercel Paystack Webhook] Transaction ${reference} was already credited. Skipping.`);
        return res.status(200).json({
          status: 'success',
          message: 'Transaction already processed (Idempotent)',
          reference
        });
      }

      console.log(`[Vercel Paystack Webhook] Atomic credit success: ₦${amountNGN} credited to user ${targetUserId}. New balance: ₦${finalBalance}`);

      return res.status(200).json({
        status: 'success',
        message: 'Webhook processed and user wallet credited successfully.',
        reference,
        amount: amountNGN,
        userId: targetUserId
      });
    }

    return res.status(200).json({
      status: 'ignored',
      message: `Event ${event.event} received and acknowledged`
    });

  } catch (err: any) {
    console.error('[Vercel Paystack Webhook Error]:', err);
    return res.status(500).json({ error: 'Internal server error processing webhook' });
  }
}
