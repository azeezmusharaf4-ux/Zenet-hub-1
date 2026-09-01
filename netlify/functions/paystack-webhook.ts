import crypto from 'crypto';
import { getDb, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from './_firebase';

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-paystack-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const rawSecretKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_KEY || '';
    const paystackSecretKey = rawSecretKey ? rawSecretKey.trim().replace(/^['"`]|['"`]$/g, '').trim() : '';

    const signature = event.headers['x-paystack-signature'] || event.headers['X-Paystack-Signature'];

    const rawPayload = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : (typeof event.body === 'string' ? event.body : JSON.stringify(event.body || {}));

    if (paystackSecretKey && signature) {
      const hash = crypto.createHmac('sha512', paystackSecretKey)
        .update(rawPayload)
        .digest('hex');

      if (hash !== signature) {
        console.warn('[Netlify Paystack Webhook] Invalid Paystack signature received.');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid HMAC signature' })
        };
      }
    }

    let parsedEvent: any = {};
    try {
      parsedEvent = JSON.parse(rawPayload);
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    if (!parsedEvent || !parsedEvent.event) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid event structure' }) };
    }

    console.log(`[Netlify Paystack Webhook] Event Received: ${parsedEvent.event}`);

    if (parsedEvent.event === 'charge.success') {
      const data = parsedEvent.data;
      const reference = data.reference || `PAY_${data.id}`;
      const amountNGN = data.amount ? data.amount / 100 : 0;
      const customerEmail = data.customer?.email;
      const customerCode = data.customer?.customer_code;
      const accountNumber = data.authorization?.account_number || data.dedicated_account?.account_number || data.authorization?.receiver_bank_account_number;

      console.log(`[Netlify Paystack Webhook] Processing charge.success for ₦${amountNGN} (Ref: ${reference})`);

      const db = getDb();
      if (db) {
        try {
          const txDocRef = doc(db, 'wallet_transactions', reference);
          const txSnap = await getDoc(txDocRef);

          if (txSnap.exists()) {
            console.log(`[Netlify Paystack Webhook] Reference ${reference} already credited. Skipping duplicate.`);
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ status: 'success', message: 'Transaction already processed (Idempotent)' })
            };
          }

          let targetUserId: string | null = null;
          let currentBalance = 0;

          if (customerCode) {
            const custCodeQ = query(collection(db, 'users'), where('paystackCustomerCode', '==', customerCode));
            const custCodeSnap = await getDocs(custCodeQ);
            if (!custCodeSnap.empty) {
              const userDoc = custCodeSnap.docs[0];
              targetUserId = userDoc.id;
              currentBalance = userDoc.data().walletBalance || 0;
            }
          }

          if (!targetUserId && customerEmail) {
            const usersQ = query(collection(db, 'users'), where('email', '==', customerEmail));
            const usersSnap = await getDocs(usersQ);
            if (!usersSnap.empty) {
              const userDoc = usersSnap.docs[0];
              targetUserId = userDoc.id;
              currentBalance = userDoc.data().walletBalance || 0;
            }
          }

          if (targetUserId) {
            const newBalance = currentBalance + amountNGN;
            await updateDoc(doc(db, 'users', targetUserId), { walletBalance: newBalance });

            const bankName = data.authorization?.bank || data.dedicated_account?.bank?.name || 'Bank Transfer';
            await setDoc(txDocRef, {
              id: reference,
              userId: targetUserId,
              userEmail: customerEmail || '',
              amount: amountNGN,
              type: 'deposit',
              method: 'dedicated_virtual_account',
              status: 'successful',
              paystackReference: reference,
              description: `Paystack Dedicated Virtual Account Deposit (${bankName})`,
              date: new Date().toISOString(),
              createdAt: new Date().toISOString()
            });

            console.log(`[Netlify Paystack Webhook] Successfully credited ₦${amountNGN} to User ID ${targetUserId}`);
          }
        } catch (dbErr: any) {
          console.error('[Netlify Paystack Webhook] Firestore error:', dbErr);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'success',
          message: 'Webhook processed successfully.',
          reference,
          customerEmail,
          amount: amountNGN
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'ignored', message: `Event ${parsedEvent.event} received` })
    };
  } catch (err: any) {
    console.error('Error in Netlify paystack-webhook:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Webhook processing error' })
    };
  }
};
