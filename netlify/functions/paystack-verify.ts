import { getDb, doc, getDoc, setDoc, updateDoc } from './_firebase';

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-paystack-signature',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const rawSecretKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_KEY || '';
    const paystackSecretKey = rawSecretKey ? rawSecretKey.trim().replace(/^['"`]|['"`]$/g, '').trim() : '';

    const reference = event.queryStringParameters?.reference || event.path?.split('/').pop();
    const queryUserId = event.queryStringParameters?.userId;

    if (!reference) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ verified: false, error: 'Transaction reference is missing' })
      };
    }

    if (!paystackSecretKey || !paystackSecretKey.startsWith('sk_')) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          verified: false,
          error: 'PAYSTACK_SECRET_KEY is missing or not configured in Netlify environment variables.'
        })
      };
    }

    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json'
      }
    });

    const paystackData: any = await paystackRes.json();

    if (paystackData.status && paystackData.data && paystackData.data.status === 'success') {
      const pstData = paystackData.data;
      const paidAmountKobo = pstData.amount;
      const amountNaira = paidAmountKobo / 100;
      const metadata = pstData.metadata || {};
      const targetUid = metadata.userId || queryUserId;
      const expectedAmountNaira = metadata.expectedAmountNaira || metadata.priceNaira;

      if (expectedAmountNaira && Number(expectedAmountNaira) > 0) {
        const expectedKobo = Math.round(Number(expectedAmountNaira) * 100);
        if (paidAmountKobo < expectedKobo) {
          console.error(`[Netlify Paystack Verify] Amount mismatch for ref ${reference}: Paid ₦${amountNaira}, expected ₦${expectedAmountNaira}`);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              verified: false,
              status: 'amount_mismatch',
              error: `Payment amount mismatch: Paid ₦${amountNaira} but expected ₦${expectedAmountNaira}`
            })
          };
        }
      }

      // Update Firestore user wallet & transaction ledger with idempotency
      const db = getDb();
      if (db && targetUid) {
        try {
          const txDocRef = doc(db, 'wallet_transactions', reference);
          const txSnap = await getDoc(txDocRef);

          if (txSnap.exists()) {
            console.log(`[Netlify Paystack Verify] Reference ${reference} already processed in wallet_transactions.`);
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                verified: true,
                alreadyProcessed: true,
                status: 'success',
                reference: pstData.reference,
                amount: txSnap.data().amount || amountNaira,
                currency: pstData.currency || 'NGN',
                paidAt: pstData.paid_at || pstData.paidAt,
                channel: pstData.channel,
                buyerEmail: pstData.customer?.email,
                userId: targetUid,
                gateway: 'paystack'
              })
            };
          }

          const uDocRef = doc(db, 'users', String(targetUid));
          const uDocSnap = await getDoc(uDocRef);
          const currentBal = uDocSnap.exists() ? (uDocSnap.data().walletBalance || 0) : 0;
          const newBal = currentBal + amountNaira;

          if (uDocSnap.exists()) {
            await updateDoc(uDocRef, { walletBalance: newBal });
          } else {
            await setDoc(uDocRef, { walletBalance: newBal }, { merge: true });
          }

          await setDoc(txDocRef, {
            id: reference,
            userId: String(targetUid),
            userEmail: pstData.customer?.email || '',
            amount: amountNaira,
            type: 'deposit',
            method: 'paystack',
            status: 'successful',
            paystackReference: reference,
            description: metadata.listingTitle || 'Paystack Wallet Deposit',
            date: new Date().toISOString(),
            createdAt: new Date().toISOString()
          });

          console.log(`[Netlify Paystack Verify] Credited ₦${amountNaira} to User ${targetUid}. New Bal: ₦${newBal}`);
        } catch (creditErr) {
          console.warn('[Netlify Paystack Verify] Wallet credit notice:', creditErr);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          verified: true,
          status: 'success',
          reference: pstData.reference,
          amount: amountNaira,
          currency: pstData.currency || 'NGN',
          paidAt: pstData.paid_at || pstData.paidAt,
          channel: pstData.channel,
          buyerEmail: pstData.customer?.email,
          userId: targetUid,
          gateway: 'paystack',
          raw: pstData
        })
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          verified: false,
          status: paystackData.data?.status || 'failed',
          error: paystackData.message || 'Payment verification failed on Paystack.'
        })
      };
    }
  } catch (err: any) {
    console.error('Error in Netlify paystack-verify:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        verified: false,
        error: err.message || 'Payment verification failed'
      })
    };
  }
};
